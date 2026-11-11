// ----- AliançaShow · o catálogo de músicas vai para o Sirvo (F3, fatia S1) -----
//
// O Show manda a lista de músicas da biblioteca para o Sirvo, onde a Produção
// e o Louvor vão escolher as músicas de cada bloco. Quem decide se ESTE
// computador publica é a chave (o admin liga "publica as músicas" em Perfil →
// chaves do AliançaShow), não o posto do Firebase: o PC de casa, com chave só
// de leitura, nunca sobrescreve o catálogo da igreja.
//
// Quando: ao conectar, 10 s depois de mudar a biblioteca, e um ping a cada 6 h
// — e nunca antes de a biblioteca terminar de carregar (`loaded`).
// Sempre pergunta primeiro só com o hash; a lista só vai se o Sirvo disser que
// está desatualizado. Tudo em segundo plano e por fora do `chamar` da ponte:
// uma falha aqui nunca muda o estado da conexão do roteiro.

import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { requestMain } from "../IPC/main"
import { categories, loaded, shows, showsCache, special } from "../stores"
import { comDetalhesDosNaoSalvos, deveTirarALetra, hashDoCatalogo, itensParaSirvo, lerRespostaDoCatalogo, musicasDaBiblioteca, semLetra, tamanhoDoCorpo } from "./aliancaCatalogo"
import { sirvo } from "./aliancaSirvo"
import { lerLigacoesSirvo } from "./aliancaSirvoMontar"
import { rastreioDeSalvos } from "./aliancaShowsSalvos"

const DEPOIS_DE_MUDAR_MS = 10_000
const AO_CONECTAR_MS = 3_000
const PING_MS = 6 * 60 * 60_000
// chave sem "publica as músicas": pergunta de novo em 5 min (só o hash, barato),
// para o admin ligar e ver a lista chegar sem reiniciar o Show
const NAO_PUBLICA_MS = 5 * 60_000
const FALHOU_MS = 5 * 60_000
// o Show ainda está carregando a biblioteca (`loaded`): a lista estaria pela metade
const CARREGANDO_MS = 3_000

let iniciado = false
let timer: ReturnType<typeof setTimeout> | null = null
let emVoo = false
let deNovo = false
let conectadoAntes = false
let naoPublicaAte = 0
/** o último hash que o Sirvo confirmou (publicado ou "igual") nesta sessão */
let hashConfirmado = ""

/** ids que já estavam no disco quando a biblioteca terminou de carregar */
let idsDoDisco: Set<string> | null = null

export function iniciarCatalogoSirvo() {
    if (iniciado) return
    iniciado = true

    // quais shows foram editados e ainda não gravados (o arquivo estaria velho para o trecho/letra)
    loaded.subscribe((l) => {
        if (l && !idsDoDisco) idsDoDisco = new Set(Object.keys(get(shows) || {}))
    })
    showsCache.subscribe((cache) => rastreioDeSalvos.observar(cache as any, (id) => !idsDoDisco || idsDoDisco.has(id)))

    sirvo.subscribe((e) => {
        const conectado = e.status === "conectado"
        if (conectado && !conectadoAntes) {
            naoPublicaAte = 0 // chave nova ou o admin acabou de ligar: pergunta de novo
            agendar(AO_CONECTAR_MS)
        }
        if (!conectado && conectadoAntes) hashConfirmado = "" // chave trocada ou caiu: confere de novo
        conectadoAntes = conectado
    })
    let primeira = true
    // `special`: o "é esta?" (F3) muda as ligações, que vão no catálogo
    for (const store of [shows, categories, special]) {
        store.subscribe(() => {
            if (primeira) return
            agendar(DEPOIS_DE_MUDAR_MS)
        })
    }
    primeira = false
    setInterval(() => {
        hashConfirmado = ""
        agendar(0)
    }, PING_MS)
}

function agendar(ms: number) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
        timer = null
        publicar()
    }, ms)
}

async function chamar(args: { [key: string]: any }) {
    return (await requestMain(Main.SIRVO_CHAMAR, { funcao: "show_publicar_catalogo", args })) as any
}

/** Manda os detalhes do que está só em memória; o main preenche o resto do disco. */
function itensComDetalhes(itens: ReturnType<typeof itensParaSirvo>) {
    const cache = get(showsCache) as any
    return comDetalhesDosNaoSalvos(itens, (id) => rastreioDeSalvos.naoSalvo(id, cache), cache)
}

async function publicar() {
    if (emVoo) {
        deNovo = true
        return
    }
    if (Date.now() < naoPublicaAte) {
        // uma mudança na biblioteca agendou por cima da tentativa de 5 min: não perde a volta
        agendar(naoPublicaAte - Date.now() + 1000)
        return
    }
    if (!get(loaded)) {
        agendar(CARREGANDO_MS)
        return
    }
    if (get(sirvo).status !== "conectado") return // ao conectar, volta sozinho

    const itens = itensParaSirvo(musicasDaBiblioteca(get(shows) as any, get(categories) as any), lerLigacoesSirvo())
    if (!itens.length) return // lista vazia nunca é publicada
    const hash = hashDoCatalogo(itens)
    if (hash === hashConfirmado) return

    emVoo = true
    try {
        let acao = lerRespostaDoCatalogo(await chamar({ p_hash: hash }))
        if (acao.acao === "mandar_lista") {
            const completos = itensComDetalhes(itens)
            let corpo = completos
            let resposta: any = null
            // corpo já grande demais: nem tenta com letra
            if (!deveTirarALetra(null, tamanhoDoCorpo(completos))) resposta = await chamar({ p_hash: hash, p_musicas: completos })
            if (!resposta || deveTirarALetra(resposta, 0)) {
                console.warn("Sirvo: catálogo grande demais com as letras; publicando sem elas.")
                corpo = semLetra(completos)
                resposta = await chamar({ p_hash: hash, p_musicas: corpo })
            }
            acao = lerRespostaDoCatalogo(resposta)
        }

        switch (acao.acao) {
            case "em_dia":
                hashConfirmado = hash
                break
            case "publicado":
                hashConfirmado = hash
                console.info(`Sirvo: catálogo publicado (${itens.length} músicas, ${acao.novas} novas, ${acao.removidas} saíram).`)
                if (acao.rejeitadas.length) console.warn("Sirvo: músicas recusadas no catálogo:", acao.rejeitadas)
                break
            case "reagendar":
                agendar(acao.ms)
                break
            case "nao_publica":
                naoPublicaAte = Date.now() + NAO_PUBLICA_MS
                agendar(NAO_PUBLICA_MS + 1000)
                break
            case "recusado_metade":
                // Some de uma vez mais da metade das músicas: ninguém força
                // sozinho. Confere de novo no próximo ping ou na próxima mudança.
                hashConfirmado = hash
                console.warn(`Sirvo: o catálogo não foi publicado — tiraria ${acao.removeria} de ${acao.vivas} músicas.`)
                break
            case "falhou":
                console.warn("Sirvo: falha ao publicar o catálogo:", acao.mensagem)
                agendar(FALHOU_MS)
                break
        }
    } catch (err) {
        console.warn("Sirvo: falha ao publicar o catálogo:", err)
        agendar(FALHOU_MS)
    } finally {
        emVoo = false
        if (deNovo) {
            deNovo = false
            agendar(DEPOIS_DE_MUDAR_MS)
        }
    }
}
