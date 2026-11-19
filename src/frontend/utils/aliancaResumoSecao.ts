// Propriedades do Editar (C4): o RESUMO que a secao recolhida mostra no cabecalho ("desligado", "0 · 2 · 10 px"). Parte pura.

/** secoes que, no padrao, nao fazem nada na tela: recolhidas dizem "desligado" em vez de "padrao" */
export const SECOES_DESLIGADAS = ["outline", "border", "chords", "list", "scrolling", "shadow", "backdrop_filters", "filters", "cropping"]

export type EntradaDeResumo = { id: string; mudou: boolean; valores: (string | number | boolean | null | undefined)[]; unidade?: string }

/** sem nada mudado: "desligado" (secoes de efeito) ou "padrão"; com mudanca: os valores de agora, ate quatro, separados por " · " */
export function resumoDaSecao(e: EntradaDeResumo): string {
    if (!e.mudou) return SECOES_DESLIGADAS.includes(e.id) ? "desligado" : "padrão"
    const v = e.valores.filter((x) => x !== undefined && x !== null && x !== "" && typeof x !== "boolean").map((x) => String(x).replace(/['"]/g, "").trim())
    const texto = v.slice(0, 4).join(" · ")
    return texto ? texto + (e.unidade ? " " + e.unidade : "") : "alterado"
}

/** o resumo do cabecalho de um GRUPO fechado (Mais/Avancado): quais secoes dele foram mexidas */
export function resumoDoGrupo(nomesAlterados: string[]): string {
    if (!nomesAlterados.length) return "tudo no padrão"
    if (nomesAlterados.length <= 2) return nomesAlterados.join(" e ") + " alterado" + (nomesAlterados.length > 1 ? "s" : "")
    return `${nomesAlterados.length} seções alteradas`
}
