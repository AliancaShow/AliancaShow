// Cabine 4, pedido 2: as propriedades do Editar em BLOCOS que abrem e recolhem (estilo Photoshop). Aqui mora so a conta (pura): qual bloco
// nasce aberto, como se le/serializa o que o operador deixou aberto ou recolhido. O armazenamento esta em aliancaBlocosEstado.ts.

export type EstadoBlocos = Record<string, boolean>
export type GrupoDoBloco = "vista" | "mais" | "avancado"

export const CHAVE_BLOCOS = "aliancashow.editar.blocos.v1"

/** a chave de um bloco: o escopo (tipo da caixa: text, media, item...) mais a chave da entrada ("vista:default", "mais:shadow", "grupo:mais") */
export const chaveDoBloco = (escopo: string, chave: string): string => `${escopo || "x"}|${chave}`

/** O que a vista traz (Fonte, Alinhamento, Texto, Linhas) nasce aberto; o raro (Mais, Avancado e o que fica dentro) nasce recolhido. */
export function abertoPorPadrao(grupo: GrupoDoBloco | null): boolean {
    return grupo === "vista"
}

/** A escolha do operador manda; sem escolha vale o padrao. */
export function blocoAberto(estado: EstadoBlocos, chave: string, padrao: boolean): boolean {
    return Object.prototype.hasOwnProperty.call(estado, chave) ? !!estado[chave] : padrao
}

/** Texto guardado -> estado. Qualquer lixo (JSON quebrado, tipo errado, valor nao booleano) vira o que der para aproveitar, nunca excecao. */
export function lerBlocos(texto: string | null | undefined): EstadoBlocos {
    if (!texto) return {}
    try {
        const bruto = JSON.parse(texto)
        if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {}
        const limpo: EstadoBlocos = {}
        for (const [k, v] of Object.entries(bruto)) if (typeof v === "boolean") limpo[k] = v
        return limpo
    } catch {
        return {}
    }
}

export const serializarBlocos = (estado: EstadoBlocos): string => JSON.stringify(estado)

/** Novo estado com o bloco no valor pedido (nao muda o de entrada). */
export function comBloco(estado: EstadoBlocos, chave: string, aberto: boolean): EstadoBlocos {
    return { ...estado, [chave]: aberto }
}

/**
 * O bloco esta na tela? Bloco que LIGA um recurso (contorno, sombra, lista...) vindo do armazenamento so abre com o recurso ligado neste item
 * (senao abriria o campo cru, sem o valor-base). Mas o bloco que o operador abriu AGORA fica aberto mesmo que o valor volte ao padrao no meio
 * do arrasto da regua (`abertoAgora`): ele nao some debaixo do mouse.
 */
export function blocoNaTela(p: { aberto: boolean; ligaRecurso: boolean; mudou: boolean; abertoAgora: boolean }): boolean {
    if (!p.aberto) return false
    return !p.ligaRecurso || p.mudou || p.abertoAgora
}
