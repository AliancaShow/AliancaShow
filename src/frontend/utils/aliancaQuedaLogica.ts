// Cabine 6 (F1, vigia de queda), lado da janela principal: o que a LINHA DE AVISOS diz quando a janela de uma saida cai. Puro (testavel).
// O processo principal manda um aviso por evento (caiu, travou, respondeu, voltou, fora). Cada saida tem UMA chave na fila dos avisos
// (`queda-saida:<id>`): o estado novo substitui o anterior no mesmo lugar, e o historico ("Ultimos avisos") guarda cada passo.
// Andre, 23/nov: a faixa vermelha que flutuava por cima do conteudo (AliancaQuedaSaida) virou ERRO na linha de avisos, no leiaute.
//   - caiu / travou / fora: ERRO fixo (sem x) enquanto a saida esta fora; "fora do ar" (mais de 3 quedas em 60 s) so sai quando resolve
//   - voltou / respondeu: ERRO que se pode dispensar; sai sozinho depois de VOLTOU_FICA_MS (a falha alta do rodape segue registrando a queda)
import type { EstadoQueda, QuedaSaida } from "../../types/aliancaSaidaCanais"
import type { NovoAviso } from "./aliancaAvisosLogica"

/** quanto tempo "voltou"/"respondeu" fica na linha antes de sair (o historico e a falha alta continuam registrando a queda) */
export const VOLTOU_FICA_MS = 20_000

export const chaveDaQueda = (outputId: string) => "queda-saida:" + outputId

export function hora(em: number): string {
    const d = new Date(em)
    const p = (n: number) => String(n).padStart(2, "0")
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function segundos(ms: number): string {
    return (ms / 1000).toFixed(1).replace(".", ",") + " s"
}

/** o texto da linha; null para um estado que ninguem conhece (o chamador acende a falha alta) */
export function textoDaQueda(a: QuedaSaida): string | null {
    const n = a.nome || "Saída"
    const h = hora(a.em)
    switch (a.estado) {
        case "caiu":
            return `${n} CAIU às ${h} — recriando a tela… (${a.motivo})`
        case "travou":
            return `${n} TRAVOU às ${h} — se não voltar em 5 s, a tela é recriada`
        case "fora":
            return `${n} FORA DO AR desde ${h} — ${a.motivo}. Feche e abra a saída.`
        case "voltou":
            return `${n} caiu e voltou às ${h}${a.ms !== undefined ? " (" + segundos(a.ms) + ")" : ""}`
        case "respondeu":
            return `${n} travou e voltou a responder às ${h}`
        default:
            return null
    }
}

/** a saida ainda esta fora (caiu, travou, fora do ar): o aviso nao tem x */
export const aindaFora = (estado: EstadoQueda) => estado === "caiu" || estado === "travou" || estado === "fora"

/**
 * o aviso que a linha mostra para um evento do vigia. `nomeAtual` = o nome da saida que o operador ve hoje (o processo principal manda o
 * titulo da janela, que e o nome na CRIACAO). `someEm` = ms ate sair sozinho (so voltou/respondeu); null = fica ate resolver.
 * null quando o evento nao tem saida ou o estado e desconhecido (aviso torto: o chamador acende a falha alta)
 */
export function avisoDaQueda(a: QuedaSaida, nomeAtual?: string, anterior?: EstadoQueda): { novo: NovoAviso; someEm: number | null } | null {
    if (!a?.outputId) return null
    const texto = textoDaQueda({ ...a, nome: nomeAtual || a.nome })
    if (texto === null) return null
    const fora = aindaFora(a.estado)
    // conta (o "(2×)" da linha) so um EPISODIO novo: a saida estava bem (ou voltou) e caiu/travou/saiu do ar. Travou -> caiu (o vigia derruba
    // a tela travada), caiu -> fora (a recarga nao voltou) e caiu -> voltou sao o mesmo episodio mudando de estado
    const soma = fora && !(anterior && aindaFora(anterior))
    return { novo: { chave: chaveDaQueda(a.outputId), texto, nivel: "erro", fixo: fora, soma }, someEm: fora ? null : VOLTOU_FICA_MS }
}

/** as saidas com aviso de queda na linha que ja nao existem (apagadas) ou foram desabilitadas: o assunto acabou, a linha solta */
export function quedasSemSaida(comAviso: Iterable<string>, saidas: { [id: string]: { enabled?: boolean } | undefined }): string[] {
    return [...comAviso].filter((id) => !saidas[id] || saidas[id]!.enabled === false)
}
