// Mensagem pro palco (leiaute v2, coluna No ar): o Show escreve no Sirvo pelo main (Main.SIRVO_CHAMAR, com a chave do cofre). Sem a chave
// "conduz" nao ha caminho: acende a faixa de falha (so esse motivo, que e persistente) e a caixa diz o motivo; o passageiro (Sirvo fora do
// ar, sem culto seguido, sem chave) fala so na linha de estado da caixa.
// As funcoes `show_enviar_mensagem_palco` e `show_limpar_mensagem_palco` vivem no Sirvo (migration 0093); o texto chega ao palco pelo
// proprio roteiro (`mensagem_palco`), que o ciclo do Sirvo rebusca (2 s no culto). Nada aqui escreve em `outputs`.
//
// FILA PROPRIA (M4): a mensagem NAO passa por `pedirAoSirvo`, cuja trava (`enviando`) e uma so para todas as escritas do roteiro: mandar
// a mensagem com rede ruim deixaria "Avancar bloco" recusado por ate ~16 s, e o contrario tambem. Aqui o pedido vai direto ao main e nao
// liga a trava global. O que sobra compartilhado e o intervalo de 500 ms entre escritas que o PROPRIO main impoe (sirvo.ts, fora do
// que esta fatia pode mexer): se ele disser "ocupado", a mensagem espera 650 ms e tenta UMA vez de novo, sem o operador ver.
import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { requestMain } from "../IPC/main"
import { falhaAlta } from "./aliancaFalha"
import { MINUTOS_PADRAO, caminhoDoEnvio, mensagemDeErro, minutosValidos, prepararMensagem } from "./aliancaMensagemPalcoLogica"
import { sirvo } from "./aliancaSirvo"

/** `codigo` (do main): "rede" = nao sei se chegou; "ocupado" = o intervalo entre escritas */
export type ResultadoMensagem = { ok: true } | { ok: false; mensagem: string; codigo?: string }

export const ORIGEM_FALHA = "mensagem-palco"
const ESPERA_OCUPADO_MS = 650

/** a falha alta so para promessa quebrada que persiste (a chave nao conduz); o passageiro (Sirvo fora do ar, sem culto, sem chave) so volta o texto */
function semCaminho(): string {
    const { motivo, persistente } = caminhoDoEnvio(get(sirvo))
    if (motivo && persistente) falhaAlta(ORIGEM_FALHA, `Sirvo: mensagem pro palco ainda não ligada (${motivo})`)
    return motivo
}

type Resposta = { ok: boolean; dados?: any; codigo?: string; mensagem?: string }
async function chamar(funcao: string, args: { [key: string]: any }): Promise<Resposta> {
    const uma = async () => ((await requestMain(Main.SIRVO_CHAMAR, { funcao, args } as any)) as Resposta | undefined) || { ok: false, codigo: "rede", mensagem: "Sem conexão com o Sirvo." }
    const r = await uma()
    if (r.ok || r.codigo !== "ocupado") return r
    await new Promise((resolve) => setTimeout(resolve, ESPERA_OCUPADO_MS))
    return uma()
}

const recusa = (r: Resposta): ResultadoMensagem => ({ ok: false, mensagem: mensagemDeErro(r.codigo, r.mensagem || ""), ...(r.codigo ? { codigo: r.codigo } : {}) })

export async function enviarMensagemPalco(bruto: string, minutos = MINUTOS_PADRAO): Promise<ResultadoMensagem> {
    const p = prepararMensagem(bruto)
    if (!p.ok) return { ok: false, mensagem: p.motivo }
    if (!minutosValidos(minutos)) return { ok: false, mensagem: "A duração vai de 1 a 60 minutos." }
    const motivo = semCaminho()
    if (motivo) return { ok: false, mensagem: motivo }
    const r = await chamar("show_enviar_mensagem_palco", { p_event: get(sirvo).cultoId, p_texto: p.texto, p_minutos: minutos })
    return r.ok ? { ok: true } : recusa(r)
}

export async function limparMensagemPalco(): Promise<ResultadoMensagem> {
    const motivo = semCaminho()
    if (motivo) return { ok: false, mensagem: motivo }
    const r = await chamar("show_limpar_mensagem_palco", { p_event: get(sirvo).cultoId })
    return r.ok ? { ok: true } : recusa(r)
}
