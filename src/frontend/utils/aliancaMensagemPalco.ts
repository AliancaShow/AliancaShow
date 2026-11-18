// Mensagem pro palco (leiaute v2, coluna No ar): o Show escreve no Sirvo pelo MESMO caminho das outras escritas (`pedirAoSirvo`, que chama o
// main com a chave do cofre). Sem a chave "conduz" nao ha caminho: acende a faixa de falha (nunca engole) e a caixa diz o motivo.
// As funcoes `show_enviar_mensagem_palco` e `show_limpar_mensagem_palco` vivem no Sirvo (migration 0093); o texto chega ao palco pelo
// proprio roteiro (`mensagem_palco`), que `pedirAoSirvo` rebusca na hora. Nada aqui escreve em `outputs`.
import { get } from "svelte/store"
import { falhaAlta } from "./aliancaFalha"
import { MINUTOS_PADRAO, caminhoDoEnvio, mensagemDeErro, minutosValidos, prepararMensagem } from "./aliancaMensagemPalcoLogica"
import { pedirAoSirvo, sirvo } from "./aliancaSirvo"

export type ResultadoMensagem = { ok: true } | { ok: false; mensagem: string }

export const ORIGEM_FALHA = "mensagem-palco"

/** a falha alta so para promessa quebrada que persiste (a chave nao conduz); o passageiro (Sirvo fora do ar, sem culto, sem chave) so volta o texto */
function semCaminho(): string {
    const { motivo, persistente } = caminhoDoEnvio(get(sirvo))
    if (motivo && persistente) falhaAlta(ORIGEM_FALHA, `Sirvo: mensagem pro palco ainda não ligada (${motivo})`)
    return motivo
}

export async function enviarMensagemPalco(bruto: string, minutos = MINUTOS_PADRAO): Promise<ResultadoMensagem> {
    const p = prepararMensagem(bruto)
    if (!p.ok) return { ok: false, mensagem: p.motivo }
    if (!minutosValidos(minutos)) return { ok: false, mensagem: "A duração vai de 1 a 60 minutos." }
    const motivo = semCaminho()
    if (motivo) return { ok: false, mensagem: motivo }
    const r = await pedirAoSirvo("show_enviar_mensagem_palco", { p_event: get(sirvo).cultoId, p_texto: p.texto, p_minutos: minutos })
    return r.ok ? { ok: true } : { ok: false, mensagem: mensagemDeErro(r.codigo, r.mensagem) }
}

export async function limparMensagemPalco(): Promise<ResultadoMensagem> {
    const motivo = semCaminho()
    if (motivo) return { ok: false, mensagem: motivo }
    const r = await pedirAoSirvo("show_limpar_mensagem_palco", { p_event: get(sirvo).cultoId })
    return r.ok ? { ok: true } : { ok: false, mensagem: mensagemDeErro(r.codigo, r.mensagem) }
}
