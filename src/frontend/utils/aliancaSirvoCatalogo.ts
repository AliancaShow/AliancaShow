// ----- AliançaShow · o catálogo de músicas vai para o Sirvo (F3, fatia S1) -----
//
// O Show manda a lista de músicas da biblioteca para o Sirvo, onde a Produção
// e o Louvor vão escolher as músicas de cada bloco. Quem decide se ESTE
// computador publica é a chave (o admin liga "publica as músicas" em Perfil →
// chaves do AliançaShow), não o posto do Firebase: o PC de casa, com chave só
// de leitura, nunca sobrescreve o catálogo da igreja.
//
// Quando: ao conectar, 10 s depois de mudar a biblioteca, e um ping a cada 6 h.
// Sempre pergunta primeiro só com o hash; a lista só vai se o Sirvo disser que
// está desatualizado. Tudo em segundo plano e por fora do `chamar` da ponte:
// uma falha aqui nunca muda o estado da conexão do roteiro.

import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { requestMain } from "../IPC/main"
import { categories, shows, special } from "../stores"
import { hashDoCatalogo, itensParaSirvo, lerRespostaDoCatalogo, musicasDaBiblioteca } from "./aliancaCatalogo"
import { sirvo } from "./aliancaSirvo"
import { lerLigacoesSirvo } from "./aliancaSirvoMontar"

const DEPOIS_DE_MUDAR_MS = 10_000
const AO_CONECTAR_MS = 3_000
const PING_MS = 6 * 60 * 60_000
// chave sem "publica as músicas": pergunta de novo em 5 min (só o hash, barato),
// para o admin ligar e ver a lista chegar sem reiniciar o Show
const NAO_PUBLICA_MS = 5 * 60_000
const FALHOU_MS = 5 * 60_000

let iniciado = false
let timer: ReturnType<typeof setTimeout> | null = null
let emVoo = false
let deNovo = false
let conectadoAntes = false
let naoPublicaAte = 0
/** o último hash que o Sirvo confirmou (publicado ou "igual") nesta sessão */
let hashConfirmado = ""

export function iniciarCatalogoSirvo() {
    if (iniciado) return
    iniciado = true

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

async function publicar() {
    if (emVoo) {
        deNovo = true
        return
    }
    if (Date.now() < naoPublicaAte) return
    if (get(sirvo).status !== "conectado") return // ao conectar, volta sozinho

    const itens = itensParaSirvo(musicasDaBiblioteca(get(shows) as any, get(categories) as any), lerLigacoesSirvo())
    if (!itens.length) return // lista vazia nunca é publicada
    const hash = hashDoCatalogo(itens)
    if (hash === hashConfirmado) return

    emVoo = true
    try {
        let acao = lerRespostaDoCatalogo(await chamar({ p_hash: hash }))
        if (acao.acao === "mandar_lista") acao = lerRespostaDoCatalogo(await chamar({ p_hash: hash, p_musicas: itens }))

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
