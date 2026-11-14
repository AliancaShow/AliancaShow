import { derived } from "svelte/store"
import { activeProject, categories, editingProjectTemplate, projects, shows, showsCache, textCache } from "../stores"
import { paraConferir } from "./aliancaConferir"
import { categoriasDeMusica, ehSemLetra, type Pendencias } from "./aliancaSemLetraLogica"

// ----- AliançaShow · Preparar, fatia 4: "sem letra" nos stores (a conta é aliancaSemLetraLogica.ts) -----

/** quantos itens-show do projeto aberto estão sem letra (0 em template) */
export const semLetraNoCulto = derived([projects, activeProject, editingProjectTemplate, shows, categories, showsCache, textCache], ([$projects, $ativo, $template, $shows, $categories, $showsCache, $textCache]) => {
    if ($template || !$ativo) return 0
    const musicas = categoriasDeMusica($categories)
    let n = 0
    for (const item of $projects[$ativo]?.shows || []) {
        if ((item.type || "show") !== "show") continue
        const s = $shows[item.id]
        if (s && ehSemLetra({ ehMusica: musicas.has(s.category || ""), carregado: $showsCache[item.id], textoDoCache: $textCache[item.id] })) n++
    }
    return n
})

/** o que a faixa do Preparar mostra: "N pra conferir" (fatia 3) e "K sem letra" (fatia 4), numa conta só */
export const pendenciasDoCulto = derived([paraConferir, semLetraNoCulto], ([$conferir, $semLetra]): Pendencias => ({ conferir: $conferir, semLetra: $semLetra }))
