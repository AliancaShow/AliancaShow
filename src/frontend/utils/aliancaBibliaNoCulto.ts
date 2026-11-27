// AliancaShow (cabine 27/nov, "como eu ponho um capitulo ou uma serie de versiculos no culto?"): o botao "＋ roteiro" da Biblia.
// Monta um show com a selecao atual (um slide por versiculo/grupo, com o modelo da Biblia) e o poe no FIM do roteiro, sem abrir nada
// e sem tocar no telao. O mesmo caminho do "Por no culto" das marcacoes (aliancaGaveta.porNoCulto): criar o show e por no culto
// sao 2 entradas do historico (o 1o Ctrl+Z tira do roteiro, o 2o apaga o show).
import { get } from "svelte/store"
import { uid } from "uid"
import type { ProjectShowRef } from "../../types/Projects"
import { getActiveScripturesContent, getScriptureShow } from "../components/drawer/bible/scripture"
import { history } from "../components/helpers/history"
import { activeProject, projects } from "../stores"
import { newToast } from "./common"
import { motivoSemCulto } from "./aliancaGaveta"
import { gravarNoDisco } from "./aliancaGravarShow"

export async function bibliaNoRoteiro(): Promise<string | null> {
    const motivo = motivoSemCulto()
    if (motivo) {
        newToast(motivo)
        return null
    }
    const conteudo = await getActiveScripturesContent()
    if (!conteudo?.[0]?.activeVerses?.[0]?.length) {
        newToast("selecione os versículos primeiro")
        return null
    }
    const projetoId = get(activeProject)!
    const show = await getScriptureShow(conteudo)
    if (!show) return null
    // o culto pode ter mudado enquanto a Biblia montava
    if (get(activeProject) !== projetoId || motivoSemCulto()) return null

    const id = uid()
    history({ id: "SHOWS", newData: { data: [{ id, show }], semLimpar: true }, location: { page: "show" } })
    gravarNoDisco(id)
    const vivos = get(projects)[projetoId]?.shows || []
    const nova: ProjectShowRef[] = [...vivos, { id, type: "show" } as ProjectShowRef]
    history({ id: "UPDATE", newData: { key: "shows", data: nova }, oldData: { id: projetoId }, location: { page: "show", id: "project_key" } })
    newToast(`${show.name || "Bíblia"} entrou no fim do roteiro`)
    return id
}
