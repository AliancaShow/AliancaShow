// Cabine 6 (F1, vigia de queda), lado da janela principal: o que a faixa vermelha diz. Puro (testavel).
// O processo principal manda um aviso por evento (caiu, travou, respondeu, voltou, fora); aqui se guarda o ultimo por saida.
import type { QuedaSaida } from "../../types/aliancaSaidaCanais"

/** quanto tempo "voltou"/"respondeu" fica na faixa antes de sumir (a faixa de falha do rodape continua registrando a queda) */
export const VOLTOU_FICA_MS = 20_000

export type QuadroQuedas = { [outputId: string]: QuedaSaida }

export function aplicarAviso(quadro: QuadroQuedas, aviso: QuedaSaida): QuadroQuedas {
    if (!aviso?.outputId) return quadro
    return { ...quadro, [aviso.outputId]: aviso }
}

/** tira o que ja terminou bem ha mais de VOLTOU_FICA_MS; queda, trava e "fora do ar" ficam ate mudar */
export function limparVencidos(quadro: QuadroQuedas, agora: number): QuadroQuedas {
    const novo: QuadroQuedas = {}
    for (const [id, a] of Object.entries(quadro)) {
        const resolvido = a.estado === "voltou" || a.estado === "respondeu"
        if (resolvido && agora - a.em > VOLTOU_FICA_MS) continue
        novo[id] = a
    }
    return novo
}

export function hora(em: number): string {
    const d = new Date(em)
    const p = (n: number) => String(n).padStart(2, "0")
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function segundos(ms: number): string {
    return (ms / 1000).toFixed(1).replace(".", ",") + " s"
}

export type LinhaQueda = { outputId: string; texto: string; grave: boolean }

export function linhaDaQueda(a: QuedaSaida): LinhaQueda {
    const n = a.nome || "Saída"
    const h = hora(a.em)
    switch (a.estado) {
        case "caiu":
            return { outputId: a.outputId, texto: `${n} CAIU às ${h} — recriando a tela… (${a.motivo})`, grave: true }
        case "travou":
            return { outputId: a.outputId, texto: `${n} TRAVOU às ${h} — se não voltar em 5 s, a tela é recriada`, grave: true }
        case "fora":
            return { outputId: a.outputId, texto: `${n} FORA DO AR desde ${h} — ${a.motivo}. Feche e abra a saída.`, grave: true }
        case "voltou":
            return { outputId: a.outputId, texto: `${n} caiu e voltou às ${h}${a.ms !== undefined ? " (" + segundos(a.ms) + ")" : ""}`, grave: false }
        case "respondeu":
            return { outputId: a.outputId, texto: `${n} travou e voltou a responder às ${h}`, grave: false }
    }
}

/** o titulo da janela (que o processo principal manda) e o nome da saida na CRIACAO; vale o nome atual do operador, quando houver */
export function comNomesAtuais(quadro: QuadroQuedas, nomes: { [outputId: string]: { name?: string } | undefined }): QuadroQuedas {
    const novo: QuadroQuedas = {}
    for (const [id, a] of Object.entries(quadro)) novo[id] = { ...a, nome: nomes[id]?.name || a.nome }
    return novo
}

/** graves primeiro */
export function linhasDoQuadro(quadro: QuadroQuedas): LinhaQueda[] {
    return Object.values(quadro)
        .map(linhaDaQueda)
        .sort((a, b) => Number(b.grave) - Number(a.grave))
}
