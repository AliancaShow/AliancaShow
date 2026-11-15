import { get } from "svelte/store"
import { uid } from "uid"
import { Main } from "../../types/IPC/Main"
import type { ProjectShowRef } from "../../types/Projects"
import type { Show } from "../../types/Show"
import { requestMain } from "../IPC/main"
import { getActiveScripturesContent, getScriptureShow } from "../components/drawer/bible/scripture"
import { history } from "../components/helpers/history"
import { getExtension, getMediaType, removeExtension } from "../components/helpers/media"
import { activeProject, activeScripture, activeShow, drawerTabsData, editingProjectTemplate, projects, shows } from "../stores"
import { newToast } from "./common"
import { montarApresentacaoDeMidias } from "./aliancaApresentacao"
import { alternar, avisoDoQueFicou, cargaDoArrasto, chaveDaBiblia, chaveDe, fotos, garantir, paraItensDoProjeto, posicaoDeEntradaNoCulto, remover, tipoDoArquivo, type Marcado, type TipoMarcado } from "./aliancaGavetaLogica"
import { chavesMarcadas, listaAberta, marcados, ultimoDoCulto } from "./aliancaGavetaEstado"
import { gravarNoDisco } from "./aliancaGravarShow"
import { gavetaNaoToca } from "./aliancaModo"
import { posicaoNoBloco } from "./aliancaTiradosLogica"
import { getAccess } from "./profile"

// ----- AliançaShow · Preparar, fatia 6: a gaveta serve para PEGAR -----
//
// No Preparar o clique num item da gaveta MARCA (não toca, não vai para o ar). As marcações moram aqui, numa lista
// própria em memória (a `selected` do FreeShow some a qualquer clique fora). Não persistem em disco. Ficam
// guardadas, escondidas, quando se vai para o Culto, e reaparecem ao voltar ao Preparar.
// A conta é aliancaGavetaLogica.ts.

export { chavesMarcadas, listaAberta, marcados, ultimoDoCulto, gavetaNaoToca }

// ---------------------------------------------------------------- marcar

const ESPERA_DUPLO_MS = 500
let ultimoToque: { chave: string; em: number } | null = null

function avisarCheio() {
    newToast("máximo 100 itens marcados")
}

/** clique no card: alterna. O segundo clique de um duplo clique não desmarca (o duplo clique só garante). */
export function cliqueDeMarcar(m: Marcado) {
    const chave = chaveDe(m)
    const agora = Date.now()
    if (ultimoToque && ultimoToque.chave === chave && agora - ultimoToque.em < ESPERA_DUPLO_MS) return
    ultimoToque = { chave, em: agora }
    alternarMarca(m)
}

/** duplo clique: deixa marcado, sempre */
export function duploCliqueDeMarcar(m: Marcado) {
    ultimoToque = { chave: chaveDe(m), em: Date.now() }
    const r = garantir(get(marcados), m)
    if (r.efeito === "cheio") return avisarCheio()
    if (r.efeito === "marcou") marcados.set(r.lista)
}

function alternarMarca(m: Marcado) {
    const r = alternar(get(marcados), m)
    if (r.efeito === "cheio") return avisarCheio()
    marcados.set(r.lista)
}

/** o item da gaveta que é arquivo (mídia ou áudio). `null`: não marca (apresentação do PowerPoint). O tipo vem da EXTENSÃO. */
export function marcadoDeArquivo(arquivo: { path: string; name?: string; type?: string; contentProvider?: any }): Marcado | null {
    const path = arquivo.path || ""
    if (!path) return null
    const tipoDaExtensao = getMediaType(getExtension(path))
    const tipo = tipoDoArquivo(tipoDaExtensao)
    if (!tipo) return null
    if (tipo === "audio") return { tipo, chave: path, dado: { path, name: arquivo.name || path } }
    return { tipo, chave: path, dado: { name: arquivo.name || path, path, type: tipoDaExtensao, contentProvider: arquivo.contentProvider || false } }
}

export const marcadoDeShow = (id: string): Marcado => ({ tipo: "show", chave: id, dado: { id } })

/** marca o versículo (ou a seleção) que está aberto na Bíblia; o conteúdo é resolvido AGORA (a seleção viva muda depois) */
export async function marcarBiblia() {
    const conteudo = await getActiveScripturesContent()
    const ref = get(activeScripture).reference
    const aba = get(drawerTabsData).scripture?.activeSubTab || ""
    if (!conteudo?.length || !ref) {
        newToast("escolha um versículo antes de marcar")
        return
    }
    alternarMarca({ tipo: "scripture", chave: chaveDaBiblia(aba, ref.book, ref.chapters, ref.verses), dado: conteudo })
}

export function limparMarcacoes() {
    marcados.set([])
    listaAberta.set(false)
}

export function desmarcar(chaveUnica: string) {
    marcados.update((l) => remover(l, [chaveUnica]))
}

// ---------------------------------------------------------------- existe? (a lista mostra "não existe mais")

/** as chaves únicas que sumiram (show apagado, arquivo ausente). Online não é conferido. */
export async function ausentes(lista: Marcado[]): Promise<Set<string>> {
    const fora = new Set<string>()
    const todosShows = get(shows)
    await Promise.all(
        lista.map(async (m) => {
            if (m.tipo === "show") {
                if (!todosShows[m.chave]) fora.add(chaveDe(m))
            } else if (m.tipo === "media" || m.tipo === "audio") {
                if (/^https?:/i.test(m.chave) || m.dado?.contentProvider) return
                try {
                    const info = await requestMain(Main.FILE_INFO, m.chave)
                    if (!info) fora.add(chaveDe(m))
                } catch {
                    // não deu para conferir: não acusa
                }
            }
        })
    )
    return fora
}

// ---------------------------------------------------------------- o culto aberto

/** por que não dá para pôr no culto agora (null = dá) */
export function motivoSemCulto(): string | null {
    if (get(editingProjectTemplate)) return "o projeto aberto é um modelo"
    const id = get(activeProject)
    const p = id ? get(projects)[id] : null
    if (!id || !p) return "abra um culto primeiro"
    const acesso: any = getAccess("projects")
    if (acesso?.global === "read" || (p.parent && acesso?.[p.parent] === "read")) return "o perfil só pode ler este projeto"
    return null
}

export function nomeDoCultoAberto(): string {
    const id = get(activeProject)
    return (id && get(projects)[id]?.name) || ""
}

function posicaoDeEntrada(vivos: ProjectShowRef[], onde: "depois" | "fim"): number {
    const aberto = get(activeShow)
    const ultimo = get(ultimoDoCulto)
    const id = get(activeProject)
    // o último item em que se clicou na lista do culto (guardado à parte: clicar num show da gaveta abre sem posição);
    // sem ele (ou se a lista mudou e ele não bate mais), o item aberto com posição
    let referencia: number | null = null
    if (ultimo && ultimo.projetoId === id && vivos[ultimo.index]?.id === ultimo.id) referencia = ultimo.index
    else if (typeof aberto?.index === "number" && vivos[aberto.index]?.id === aberto.id) referencia = aberto.index
    return posicaoDeEntradaNoCulto(onde, vivos.length, referencia, posicaoNoBloco(vivos, null))
}

// ---------------------------------------------------------------- "Pôr no culto"

export type ResumoPorNoCulto = { entraram: number; pulados: number; motivo?: string }

/**
 * Põe as marcações no culto aberto. Shows, mídia e áudio entram numa entrada do histórico (UPDATE). A Bíblia vira
 * um show novo por referência (uma entrada `SHOWS`, sem `replace` e com `semLimpar`) mais a entrada do projeto:
 * 2 entradas, 2 Ctrl+Z. Não abre nada. Item que não existe mais é pulado.
 */
export async function porNoCulto(onde: "depois" | "fim"): Promise<ResumoPorNoCulto> {
    const motivo = motivoSemCulto()
    if (motivo) return { entraram: 0, pulados: 0, motivo }

    const lista = [...get(marcados)]
    if (!lista.length) return { entraram: 0, pulados: 0 }
    const projetoId = get(activeProject)!
    const sumidos = await ausentes(lista)
    const vai = lista.filter((m) => !sumidos.has(chaveDe(m)))

    // a Bíblia vira show (uma entrada do histórico para todos)
    const aCriar: { id: string; show: Show }[] = []
    const idDaBiblia = new Map<string, string>()
    for (const m of vai.filter((x) => x.tipo === "scripture")) {
        try {
            const show = await getScriptureShow(m.dado)
            if (!show) continue
            const id = uid()
            aCriar.push({ id, show })
            idDaBiblia.set(chaveDe(m), id)
        } catch (erro) {
            console.error("Preparar: falha ao montar o versículo marcado", erro)
        }
    }

    // o projeto pode ter mudado enquanto a Bíblia montava: nada entra, nada é criado
    if (get(activeProject) !== projetoId || motivoSemCulto()) return { entraram: 0, pulados: lista.length, motivo: "o culto aberto mudou" }

    if (aCriar.length) {
        history({ id: "SHOWS", newData: { data: aCriar, semLimpar: true }, location: { page: "show" } })
        for (const c of aCriar) gravarNoDisco(c.id)
    }
    const vivos = get(projects)[projetoId]?.shows || []

    const novos: ProjectShowRef[] = []
    for (const m of vai) {
        if (m.tipo === "scripture") {
            const id = idDaBiblia.get(chaveDe(m))
            if (id) novos.push({ id, type: "show" } as ProjectShowRef)
        } else novos.push(...paraItensDoProjeto([m], removeExtension))
    }
    if (!novos.length) {
        marcados.update((l) => remover(l, sumidos))
        return { entraram: 0, pulados: lista.length }
    }

    const pos = posicaoDeEntrada(vivos, onde)
    const nova = [...vivos.slice(0, pos), ...novos, ...vivos.slice(pos)]
    history({ id: "UPDATE", newData: { key: "shows", data: nova }, oldData: { id: projetoId }, location: { page: "show", id: "project_key" } })

    // saem das marcações os que entraram e os que não existem mais; o "depois" seguinte continua a partir do último que entrou
    const entraramChaves = vai.filter((m) => m.tipo !== "scripture" || idDaBiblia.has(chaveDe(m))).map(chaveDe)
    marcados.update((l) => remover(l, [...entraramChaves, ...sumidos]))
    ultimoDoCulto.set({ projetoId, index: pos + novos.length - 1, id: novos[novos.length - 1].id })

    const pulados = lista.length - novos.length
    newToast(pulados > 0 ? `${novos.length} ${novos.length === 1 ? "entrou" : "entraram"} no culto · ${pulados} não entraram` : `${novos.length} ${novos.length === 1 ? "item entrou" : "itens entraram"} no culto`)
    return { entraram: novos.length, pulados }
}

// ---------------------------------------------------------------- "Juntar fotos"

/**
 * Monta uma apresentação (avanço manual) com as fotos e a põe no culto, sem abrir. Entradas do histórico: criar o show
 * (`SHOWS`, sem `replace`, `semLimpar`) e pô-lo no culto (`UPDATE`). O 1º Ctrl+Z tira do culto e deixa o show na
 * biblioteca; o 2º apaga o show. Só as fotos usadas saem das marcações.
 */
export function juntarFotos(dados?: any[]): { id: string; noCulto: boolean } | null {
    const usadas = dados ? dados : fotos(get(marcados)).map((m) => m.dado)
    if (usadas.length < 2) {
        newToast("marque pelo menos 2 fotos para juntar")
        return null
    }
    const { id, show } = montarApresentacaoDeMidias(usadas, { automatico: false })
    history({ id: "SHOWS", newData: { data: [{ id, show }], semLimpar: true }, location: { page: "show" } })
    gravarNoDisco(id)

    const saem = usadas.map((d) => chaveDe({ tipo: "media", chave: d.path || d.id }))
    marcados.update((l) => remover(l, saem))

    let noCulto = false
    if (!motivoSemCulto()) {
        const projetoId = get(activeProject)!
        const vivos = get(projects)[projetoId]?.shows || []
        const pos = posicaoDeEntrada(vivos, "depois")
        const nova = [...vivos.slice(0, pos), { id, type: "show" } as ProjectShowRef, ...vivos.slice(pos)]
        history({ id: "UPDATE", newData: { key: "shows", data: nova }, oldData: { id: projetoId }, location: { page: "show", id: "project_key" } })
        ultimoDoCulto.set({ projetoId, index: pos, id })
        noCulto = true
    }
    newToast(noCulto ? `"${show.name}" entrou no culto` : `"${show.name}" criada na biblioteca`)
    return { id, noCulto }
}

// ---------------------------------------------------------------- arrastar

/**
 * No drop no culto: se o item arrastado está marcado, a carga vira todos os marcados do mesmo tipo (que saem das
 * marcações); os de outro tipo continuam marcados, com um aviso. Item não marcado: devolve null (funciona como sempre).
 */
export function cargaDoDropNoCulto(arrastado: { tipo: TipoMarcado; chave: string }): Marcado[] | null {
    if (!gavetaNaoToca()) return null
    const lista = get(marcados)
    const r = cargaDoArrasto(lista, arrastado)
    if (!r) return null
    marcados.set(r.ficam)
    const aviso = avisoDoQueFicou(r.carga, r.ficam)
    if (aviso) newToast(aviso)
    return r.carga
}

/** o item arrastado da gaveta, na linguagem das marcações (null: não é mídia, áudio ou show da gaveta) */
export function marcadoDoArrasto(dragId: string, item: any): { tipo: TipoMarcado; chave: string } | null {
    if (dragId === "show_drawer") return item?.id ? { tipo: "show", chave: item.id } : null
    if (dragId === "media" || dragId === "audio") {
        const m = marcadoDeArquivo({ path: item?.path || "", name: item?.name })
        return m ? { tipo: m.tipo, chave: m.chave } : null
    }
    return null
}
