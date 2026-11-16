// Chave `special.aliancaLayoutCulto`: "novo" (padrao) | "classico". Ela e a saida de emergencia: "classico" devolve o Culto como era.
//
// `layoutNovo()` CONGELA o valor na 1a chamada DEPOIS de `loaded` (os leiautes nao trocam no meio do culto: trocar a chave so vale
// ao reabrir o programa). Antes de `loaded` devolve `true` sem congelar (nesse momento o modo e o Culto de qualquer forma).
// Nao importa `stores.ts` (sem ciclo): o stores.ts entrega as fontes por `configurarLayoutCulto`. Sem assinatura no nivel do modulo.
export const VALORES = ["novo", "classico"] as const
export type LayoutCulto = (typeof VALORES)[number]

type Fontes = { especial: () => any; carregado: () => boolean }
let fontes: Fontes | null = null
let congelado: boolean | null = null

export function configurarLayoutCulto(f: Fontes) {
    fontes = f
}

/** "novo" so quando o valor nao e exatamente "classico" (ausente, vazio ou lixo = novo) */
export const valorDaChave = (especial: any): LayoutCulto => (especial?.aliancaLayoutCulto === "classico" ? "classico" : "novo")

export function layoutNovo(): boolean {
    if (congelado !== null) return congelado
    if (!fontes || !fontes.carregado()) return true
    congelado = valorDaChave(fontes.especial()) === "novo"
    return congelado
}

/** o que a sessao esta usando agora (para o texto "ativo agora" em Configuracoes) */
export const layoutAtivo = (): LayoutCulto => (layoutNovo() ? "novo" : "classico")

/** so testes */
export function _reiniciarLayoutCulto() {
    fontes = null
    congelado = null
}
