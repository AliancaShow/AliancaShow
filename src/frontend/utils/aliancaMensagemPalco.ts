// Mensagem pro palco (leiaute v2, coluna No ar): o Show escreve no Sirvo pelo MESMO caminho das outras escritas (`pedirAoSirvo`, que chama o
// main com a chave do cofre). Sem a chave "conduz" nao ha caminho: acende a faixa de falha (nunca engole) e a caixa diz o motivo.
// As funcoes `show_enviar_mensagem_palco` e `show_limpar_mensagem_palco` vivem no Sirvo (migration 0093); o texto chega ao palco pelo
// proprio roteiro (`mensagem_palco`), que `pedirAoSirvo` rebusca na hora. Nada aqui escreve em `outputs`.
import { get } from "svelte/store"
import { falhaAlta } from "./aliancaFalha"
import { MINUTOS_PADRAO, prepararMensagem } from "./aliancaMensagemPalcoLogica"
import { pedirAoSirvo, porQueNaoConduz, sirvo } from "./aliancaSirvo"

export type ResultadoMensagem = { ok: true } | { ok: false; mensagem: string }

export const ORIGEM_FALHA = "mensagem-palco"

function semCaminho(): string {
    const motivo = porQueNaoConduz()
    if (!motivo) return ""
    falhaAlta(ORIGEM_FALHA, `Sirvo: mensagem pro palco ainda não ligada (${motivo})`)
    return motivo
}

export async function enviarMensagemPalco(bruto: string, minutos = MINUTOS_PADRAO): Promise<ResultadoMensagem> {
    const p = prepararMensagem(bruto)
    if (!p.ok) return { ok: false, mensagem: p.motivo }
    const motivo = semCaminho()
    if (motivo) return { ok: false, mensagem: motivo }
    const r = await pedirAoSirvo("show_enviar_mensagem_palco", { p_event: get(sirvo).cultoId, p_texto: p.texto, p_minutos: minutos })
    return r.ok ? { ok: true } : { ok: false, mensagem: r.mensagem }
}

export async function limparMensagemPalco(): Promise<ResultadoMensagem> {
    const motivo = semCaminho()
    if (motivo) return { ok: false, mensagem: motivo }
    const r = await pedirAoSirvo("show_limpar_mensagem_palco", { p_event: get(sirvo).cultoId })
    return r.ok ? { ok: true } : { ok: false, mensagem: r.mensagem }
}
