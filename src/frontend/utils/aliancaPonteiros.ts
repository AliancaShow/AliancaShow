import { get } from "svelte/store"
import { OutputHelper } from "../components/helpers/OutputHelper"
import { activeFocus, activeProject, activeShow, outputs, outputSlideCache, projects } from "../stores"
import { estruturaDoProjetoMudou } from "./aliancaControle"
import { alinhar, idsDaLista, mesmosIds, novaPosicao } from "./aliancaPonteirosLogica"

// ----- AliançaShow · Preparar, fatia 6: o que está no ar acompanha o MESMO item da lista -----
//
// A conta é aliancaPonteirosLogica.ts. Aqui fica o gancho único: a cada mudança de `projects`, compara os ids
// da lista de cada projeto com a foto da última vez e, no projeto ABERTO, leva os ponteiros por posição para onde
// o item foi parar:
//   outputs[*].out.slide.projectIndex · outputSlideCache[*].projectIndex · activeShow.index · activeFocus.index
// Cobre Ctrl+Z/refazer, drop, mover, "Pôr no culto", tirar (o × e o Desfazer da F3), Remote/API e o Sirvo.
// Limite (igual ao do Sirvo): `projectIndex` não guarda de qual projeto veio; ao trocar de projeto o ponteiro
// continua apontando para a posição que tinha.

/** os ids de cada projeto na última notificação (strings, nunca a referência do array: ele é alterado no lugar) */
const fotos = new Map<string, string[]>()
let emCurso = false
let iniciado = false

export function iniciarPonteiros() {
    if (iniciado) return
    iniciado = true
    projects.subscribe(aoMudar)
}

function aoMudar(todos: any) {
    if (emCurso) return
    try {
        const aberto = get(activeProject)
        let reapontarAberto: { antes: string[]; depois: string[] } | null = null

        for (const [id, p] of Object.entries(todos || {}) as [string, any][]) {
            const depois = idsDaLista(p?.shows)
            const antes = fotos.get(id)
            if (antes && mesmosIds(antes, depois)) continue
            // a foto é atualizada ANTES de escrever nos stores
            fotos.set(id, depois)
            if (antes && id === aberto) reapontarAberto = { antes, depois }
        }
        for (const id of [...fotos.keys()]) if (!todos?.[id]) fotos.delete(id)

        if (reapontarAberto) reapontarProjetoAberto(reapontarAberto.antes, reapontarAberto.depois)
    } catch (erro) {
        console.error("Preparar: falha ao levar o que está no ar para a lista nova", erro)
    }
}

function reapontarProjetoAberto(antes: string[], depois: string[]) {
    emCurso = true
    try {
        const casado = alinhar(antes, depois)
        const nova = (p: { index?: number | null; id?: string | null } | null | undefined) => novaPosicao(antes, depois, casado, p)

        const mexe = (s: any) => !!s && nova({ index: s.projectIndex, id: s.id }) !== null
        if (Object.values(get(outputs) || {}).some((o: any) => mexe(o?.out?.slide))) {
            outputs.update((a) => {
                for (const o of Object.values(a) as any[]) {
                    const s = o?.out?.slide
                    const j = s ? nova({ index: s.projectIndex, id: s.id }) : null
                    if (j !== null) o.out.slide = { ...s, projectIndex: j }
                }
                return a
            })
        }
        if (Object.values(get(outputSlideCache) || {}).some((s: any) => mexe(s))) {
            outputSlideCache.update((a) => {
                for (const [id, s] of Object.entries(a || {}) as [string, any][]) {
                    const j = s ? nova({ index: s.projectIndex, id: s.id }) : null
                    if (j !== null) a[id] = { ...s, projectIndex: j }
                }
                return a
            })
        }

        const aberto = get(activeShow)
        const ja = nova(aberto)
        if (aberto && ja !== null) activeShow.set({ ...aberto, index: ja })
        const foco = get(activeFocus)
        const jf = nova(foco)
        if (foco && jf !== null) activeFocus.set({ ...foco, index: jf })

        OutputHelper.esquecerItemAtivo()
        try {
            estruturaDoProjetoMudou()
        } catch (erro) {
            console.error("Preparar: falha ao avisar o celular da ordem nova", erro)
        }
    } finally {
        emCurso = false
    }
}
