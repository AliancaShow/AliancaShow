// Telas (André, 25/nov, "aprovo papeis-saida"): cada tela e uma tela comum; voce escolhe o que ela MOSTRA (Slides ou Retorno) e qual e a
// SAIDA PRINCIPAL. Substitui o "criar saida de retorno" do FreeShow (a saida nascia de um tipo e nao mudava mais). Vale na hora, como criar e
// apagar saidas: entra na foto do rascunho de Configuracoes (nao conta como "nao salvo" nem volta no Descartar).
import { get } from "svelte/store"
import { outputs, special, stageShows } from "../stores"
import { aceitarCaminhosNaFoto } from "./aliancaConfigRascunho"
import { sortByName, keysToID } from "../components/helpers/array"

export type Papel = "slides" | "retorno"

export const papelDe = (o: { stageOutput?: string | boolean } | null | undefined): Papel => (o?.stageOutput ? "retorno" : "slides")

/** o modelo de retorno que uma tela recebe ao virar retorno: o primeiro por nome; "" = nao ha nenhum */
export function primeiroModeloDeRetorno(): string {
    return sortByName(keysToID(get(stageShows) || {}))[0]?.id || ""
}

/** troca o que a tela mostra. Retorno sem modelo de retorno nenhum nao acontece (devolve false) */
export function mudarPapel(id: string, papel: Papel): boolean {
    const o: any = get(outputs)[id]
    if (!o || papelDe(o) === papel) return false
    const modelo = papel === "retorno" ? primeiroModeloDeRetorno() : ""
    if (papel === "retorno" && !modelo) return false
    outputs.update((a: any) => {
        if (papel === "retorno") a[id].stageOutput = modelo
        else delete a[id].stageOutput
        return a
    })
    aceitarCaminhosNaFoto([["outputs", id, "stageOutput"]])
    return true
}

/** a saida principal escolhida em Telas ("" = a regra: a primeira de slides com janela) */
export function escolherPrincipal(id: string): void {
    special.update((s: any) => ({ ...s, aliancaSaidaPrincipal: id || undefined }))
    aceitarCaminhosNaFoto([["special", "aliancaSaidaPrincipal"]])
}
