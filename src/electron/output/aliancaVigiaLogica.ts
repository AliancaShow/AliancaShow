// Cabine 6 (F1, vigia de queda): a decisao pura de "o que fazer quando a janela de uma saida cai". Sem electron: testavel no vitest.
//
// Regras (desenho-motor-de-saida.md, secao 5 e adendo):
//   - quedas duplicadas (render-process-gone + o crash forcado de uma trava, ou dois eventos seguidos) contam UMA vez enquanto a
//     recuperacao anterior nao terminou;
//   - recria sozinho no maximo MAX_RECRIAR vezes em JANELA_MS; depois desiste e fica "fora do ar" (alto, fixo), sem laco de recriar.

export const JANELA_MS = 60_000
export const MAX_RECRIAR = 3
/** quanto esperar depois do `unresponsive` antes de derrubar o processo travado e recarregar */
export const TRAVA_MS = 5_000
/** batida do processo principal na pagina da saida (executeJavaScript("1")); sem resposta em BATIDA_LIMITE_MS = travou */
export const BATIDA_MS = 1_000
export const BATIDA_LIMITE_MS = 3_000
/** quanto esperar a pagina da saida carregar depois de cada tentativa de recarregar */
export const RECARGA_MS = 6_000
/** recuperacao que nao terminou nesse tempo deixa de segurar quedas novas (a pagina nunca carregou) */
export const RECUPERANDO_MAX_MS = 20_000

export type RegistroQueda = { recuperando: boolean; desde: number; tentativas: number[] }

export type AcaoQueda = "ignorar" | "recriar" | "desistir"

export function registroVazio(): RegistroQueda {
    return { recuperando: false, desde: 0, tentativas: [] }
}

export function decidirQueda(anterior: RegistroQueda | undefined, agora: number): { acao: AcaoQueda; registro: RegistroQueda } {
    const reg = anterior ? { ...anterior, tentativas: anterior.tentativas.filter((t) => agora - t < JANELA_MS) } : registroVazio()
    if (reg.recuperando && agora - reg.desde < RECUPERANDO_MAX_MS) return { acao: "ignorar", registro: reg }
    if (reg.tentativas.length >= MAX_RECRIAR) return { acao: "desistir", registro: { ...reg, recuperando: false } }
    return { acao: "recriar", registro: { recuperando: true, desde: agora, tentativas: [...reg.tentativas, agora] } }
}

/** a pagina da saida carregou de novo: fecha a recuperacao e devolve quanto tempo levou (null se nao havia recuperacao aberta) */
export function concluirRecuperacao(reg: RegistroQueda | undefined, agora: number): { ms: number | null; registro: RegistroQueda } {
    if (!reg || !reg.recuperando) return { ms: null, registro: reg || registroVazio() }
    return { ms: agora - reg.desde, registro: { ...reg, recuperando: false } }
}

/** motivos de `render-process-gone` que nao sao queda (fechar a janela, sair do programa) */
export function quedaDeVerdade(reason: string | undefined): boolean {
    return reason !== "clean-exit"
}
