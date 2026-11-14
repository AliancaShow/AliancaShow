import { get, writable } from "svelte/store"
import { uid } from "uid"
import type { ProjectShowRef } from "../../types/Projects"
import { clone } from "../components/helpers/array"
import { history } from "../components/helpers/history"
import { OutputHelper } from "../components/helpers/OutputHelper"
import { outputs, outputSlideCache, projects } from "../stores"
import { sirvoRoteiro } from "./aliancaSirvo"
import { estruturaDoProjetoMudou } from "./aliancaControle"
import { desfazerDispensasSirvo, lerDispensas } from "./aliancaSirvoDispensar"
import { linhasDoRoteiro, tirarMarca } from "./aliancaSirvoMusicas"
import { desfazendoAgora, indiceAposRepor, indiceAposTirar, limitar, novosRastros, ordenarMarcadores, podar, posicaoDoRastro, semDormindoRepetido, sinteticosDoSirvo, tipoDe, type Tirado } from "./aliancaTiradosLogica"

// ----- AliançaShow · Preparar, fatia 3: o item tirado fica riscado, com Desfazer -----
//
// A conta é aliancaTiradosLogica.ts. Aqui ficam a memória (só a desta janela: NUNCA em `projects`),
// o gancho do `deleteActions.show`, a poda quando a lista muda e o "Desfazer" do botão, que é uma
// entrada do histórico do FreeShow (como o Delete): Ctrl+Z depois dele tira o item de novo.

/** os rastros por projeto (memória da janela principal; fecha o app, some — o da música do Sirvo volta pela dispensa) */
export const tirados = writable<{ [projetoId: string]: Tirado[] }>({})

function guardar(projetoId: string, lista: Tirado[]) {
    tirados.update((a) => {
        const nova = { ...a }
        if (lista.length) nova[projetoId] = lista
        else delete nova[projetoId]
        return nova
    })
}

// ---------------------------------------------------------------- nascer

/** estava no ar nesta posição? (sem `projectIndex` na saída, vale o id) */
function estavaNoAr(item: ProjectShowRef, indice: number): boolean {
    return Object.values(get(outputs) || {}).some((o: any) => {
        const s = o?.out?.slide
        if (!o?.enabled || !s || s.id !== item.id) return false
        return typeof s.projectIndex !== "number" || s.projectIndex === indice
    })
}

/**
 * `deleteActions.show` chama ANTES de escrever: um rastro por item que o operador vai tirar.
 * `itens` é a lista de agora (ainda com eles).
 */
export function registrarTirados(projetoId: string, itens: ProjectShowRef[], indexes: number[]) {
    try {
        if (!projetoId || !indexes.length) return
        const novos = novosRastros(projetoId, itens, indexes, { agora: Date.now(), chaves: () => uid(8), noAr: estavaNoAr })
        if (!novos.length) return
        guardar(projetoId, limitar([...semDormindoRepetido(get(tirados)[projetoId] || [], novos), ...novos]))
    } catch (erro) {
        console.error("Preparar: falha ao guardar o rastro do item tirado", erro)
    }
}

// ---------------------------------------------------------------- a poda (a lista do projeto mudou)

projects.subscribe((todos) => {
    try {
        const atual = get(tirados)
        const ids = Object.keys(atual)
        if (!ids.length) return
        const desfazendo = desfazendoAgora()
        let mudou = false
        const nova = { ...atual }
        for (const id of ids) {
            const r = podar(atual[id], todos[id]?.shows || null, desfazendo)
            if (!r.mudou) continue
            mudou = true
            if (r.lista.length) nova[id] = r.lista
            else delete nova[id]
        }
        if (mudou) tirados.set(nova)
    } catch (erro) {
        console.error("Preparar: falha ao podar os rastros", erro)
    }
})

// ---------------------------------------------------------------- ponteiros por posição (F5)

/**
 * O que está no ar aponta para o projeto por POSIÇÃO (`projectIndex`). Tirou/pôs item acima: a posição anda.
 * Só escreve se mudou (trocar só a posição não reenvia o slide: Output.svelte).
 */
function moverPonteiros(projetoId: string, novoIndice: (i: number) => number) {
    if (get(projects)[projetoId] === undefined) return
    const mexe = (s: any) => s && typeof s.projectIndex === "number" && s.projectIndex >= 0 && novoIndice(s.projectIndex) !== s.projectIndex
    let mexeu = false
    if (Object.values(get(outputs) || {}).some((o: any) => mexe(o?.out?.slide))) {
        mexeu = true
        outputs.update((a) => {
            for (const o of Object.values(a) as any[]) {
                const s = o?.out?.slide
                if (mexe(s)) o.out.slide = { ...s, projectIndex: novoIndice(s.projectIndex) }
            }
            return a
        })
    }
    if (Object.values(get(outputSlideCache) || {}).some((s: any) => mexe(s))) {
        mexeu = true
        outputSlideCache.update((a) => {
            for (const [id, s] of Object.entries(a || {}) as [string, any][]) if (mexe(s)) a[id] = { ...s, projectIndex: novoIndice(s.projectIndex) }
            return a
        })
    }
    OutputHelper.esquecerItemAtivo()
    try {
        estruturaDoProjetoMudou()
    } catch (erro) {
        console.error("Preparar: falha ao avisar o celular da ordem nova", erro)
    }
    return mexeu
}

/** antes de escrever a lista sem os itens `removidos` (índices de antes) */
export function moverPonteirosAoTirar(projetoId: string, removidos: number[]) {
    moverPonteiros(projetoId, (i) => indiceAposTirar(i, removidos))
}

/** antes de escrever a lista com `quantos` itens novos a partir da posição `pos` (F4: "adicionar várias músicas") */
export function moverPonteirosAoInserir(projetoId: string, pos: number, quantos: number) {
    if (quantos <= 0) return
    moverPonteiros(projetoId, (i) => (pos <= i ? i + quantos : i))
}

// ---------------------------------------------------------------- Desfazer (o botão)

/**
 * "Desfazer" do rastro: põe o item de volta onde estava, como uma entrada do histórico.
 * Não chama `undo()`: ele só desfaz a ÚLTIMA entrada, e este rastro pode ser antigo.
 */
export function desfazerTirado(chave: string) {
    try {
        const entrada = Object.entries(get(tirados)).find(([, l]) => l.some((r) => r.chave === chave))
        if (!entrada) return
        const [projetoId, lista] = entrada
        const r = lista.find((x) => x.chave === chave)!
        const projeto = get(projects)[projetoId]
        if (!projeto) return
        const vivos = projeto.shows || []

        const item: ProjectShowRef = clone(r.item)
        if (r.rmId) {
            // a marca só vale se o Sirvo ainda quer a linha (ou há dispensa dela esperando): senão vira item do operador
            const eventId = projeto.sirvo?.eventId
            const roteiro = get(sirvoRoteiro)
            const dispensaViva = lerDispensas().some((d) => d.rmId === r.rmId && d.eventId === eventId)
            const linhaViva = !!roteiro && roteiro.event_id === eventId && linhasDoRoteiro(roteiro.blocos).has(r.rmId)
            if (!dispensaViva && !linhaViva) tirarMarca(item, () => uid(5))
        }

        const pos = posicaoDoRastro(vivos, r)
        const nova = [...vivos]
        nova.splice(pos, 0, item)
        moverPonteiros(projetoId, (i) => indiceAposRepor(i, pos))
        history({ id: "UPDATE", newData: { key: "shows", data: nova }, oldData: { id: projetoId }, location: { page: "show", id: "project_key" } })
    } catch (erro) {
        console.error("Preparar: falha ao desfazer o item tirado", erro)
    }
}

/** o rastro que veio do Sirvo (depois de reabrir): a dispensa cai e a passada repõe o item */
export function desfazerTiradoDoSirvo(rmId: string) {
    desfazerDispensasSirvo([rmId])
}

// ---------------------------------------------------------------- o que a lista mostra

export type RastroNaLista = {
    chave: string
    pos: number
    /** o id do item tirado ("" no que veio do Sirvo) */
    itemId: string
    nome: string
    /** "show" | "section" | "image" ... */
    tipo: string
    /** o item estava no ar quando saiu */
    noAr: boolean
    sintetico: boolean
    /** sem botão Desfazer (só leitura, ou o Sirvo também tirou) */
    semBotao: boolean
    /** texto no lugar do botão quando não há botão */
    nota: string
    rmId: string | null
}

const nomeDoItem = (item: ProjectShowRef, todosShows: any): string => {
    const t = tipoDe(item)
    if (t === "show") return todosShows?.[item.id]?.name || item.name || item.id
    if (item.name) return item.name
    const arq =
        String(item.id || "")
            .split(/[\\/]/)
            .pop() || ""
    return arq.replace(/\.[^.]+$/, "") || "item"
}

type ProjetoMin = { shows?: ProjectShowRef[]; sirvo?: { eventId?: string } | null }

/**
 * Os marcadores do projeto na ordem em que entram na lista viva. `somenteLeitura`: sem Desfazer.
 * Sintéticos (do Sirvo): só no projeto ligado ao culto.
 */
export function rastrosParaLista(projetoId: string | null, projeto: ProjetoMin | null | undefined, todos: { [id: string]: Tirado[] }, dispensas: ReturnType<typeof lerDispensas>, roteiro: { event_id: string; blocos: { id: string }[] } | null, todosShows: any, somenteLeitura: boolean): RastroNaLista[] {
    if (!projetoId || !projeto) return []
    const vivos = projeto.shows || []
    const lista: (RastroNaLista & { indice: number; em: number })[] = []
    const comRastro = new Set<string>()

    for (const r of todos[projetoId] || []) {
        if (r.rmId) comRastro.add(r.rmId)
        if (r.dormindo) continue
        lista.push({ chave: r.chave, pos: posicaoDoRastro(vivos, r), itemId: r.item.id, nome: nomeDoItem(r.item, todosShows), tipo: tipoDe(r.item), noAr: r.noAr, sintetico: false, semBotao: somenteLeitura, nota: "", rmId: r.rmId, indice: r.indice, em: r.em })
    }

    const eventId = projeto.sirvo?.eventId
    if (eventId) {
        const deste = dispensas.filter((d) => d.eventId === eventId)
        const sint = sinteticosDoSirvo(deste, vivos, comRastro, (blocoId) => (roteiro && roteiro.event_id === eventId ? roteiro.blocos.some((b) => b.id === blocoId) : null))
        const envioDe = new Map(deste.map((d) => [d.rmId, d.envio]))
        for (const s of sint) lista.push({ chave: s.chave, pos: s.pos, itemId: "", nome: s.nome, tipo: "show", noAr: false, sintetico: true, semBotao: s.semBotao || somenteLeitura, nota: envioDe.get(s.rmId) === "enviada" ? "tirada também no Sirvo" : "", rmId: s.rmId, indice: Number.MAX_SAFE_INTEGER, em: 0 })
    }

    const ordem = new Map(ordenarMarcadores(lista).map((m, i) => [m.chave, i]))
    return lista.sort((a, b) => ordem.get(a.chave)! - ordem.get(b.chave)!).map(({ indice: _i, em: _e, ...r }) => r)
}
