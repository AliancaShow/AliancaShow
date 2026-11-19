// Configuracoes (C4, cabine 18/nov): a parte pura do "N alteracoes nao salvas" e do "Descartar".
// As configuracoes valem na hora (o app e ao vivo); "rascunho" aqui e a diferenca entre o estado de agora e a FOTO tirada quando a pagina abriu
// (ou quando o ultimo "Salvar" confirmou). Contar = quantas coisas diferem; Descartar = devolver cada uma ao que a foto guardou.

export type Foto = { [loja: string]: any }

/** chaves de uma saida que o Descartar sabe desfazer sem mexer em janela (as outras ligam/desligam janela, NDI... e valem na hora) */
export const CHAVES_DE_SAIDA = ["name", "color", "style", "stageOutput"] as const

const ehObjeto = (v: unknown): v is { [k: string]: any } => !!v && typeof v === "object" && !Array.isArray(v)
const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** a vista das saidas que conta: so as chaves reversiveis de cada saida (o resto e estado vivo ou vale na hora) */
export function vistaDasSaidas(outs: { [id: string]: any } | null | undefined): { [id: string]: any } {
    const r: { [id: string]: any } = {}
    for (const [id, o] of Object.entries(outs || {})) {
        const v: { [k: string]: any } = {}
        for (const k of CHAVES_DE_SAIDA) if (o && o[k] !== undefined) v[k] = o[k]
        r[id] = v
    }
    return r
}

/** o que mudou numa loja: objeto simples conta chave por chave (inclusive entrada nova e apagada); o resto conta 1 se for diferente */
export function mudancasDaLoja(antes: unknown, depois: unknown): string[] {
    if (igual(antes, depois)) return []
    if (ehObjeto(antes) && ehObjeto(depois)) {
        const chaves = new Set([...Object.keys(antes), ...Object.keys(depois)])
        return [...chaves].filter((k) => !igual(antes[k], depois[k]))
    }
    return [""]
}

/** quantas alteracoes ha entre a foto e o estado atual (cada loja soma as suas) */
export function contarMudancas(foto: Foto, agora: Foto): number {
    let n = 0
    for (const loja of Object.keys(foto)) n += mudancasDaLoja(foto[loja], agora[loja]).length
    return n
}

/** "2 alterações não salvas" / "1 alteração não salva" / "" (nada) */
export function textoDeAlteracoes(n: number): string {
    if (!n) return ""
    return n === 1 ? "1 alteração não salva" : `${n} alterações não salvas`
}

/** lojas que diferem (para o Descartar saber o que devolver) */
export function lojasMudadas(foto: Foto, agora: Foto): string[] {
    return Object.keys(foto).filter((loja) => mudancasDaLoja(foto[loja], agora[loja]).length > 0)
}
