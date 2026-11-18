// Leiaute v2, fatia 6: a conta pura do botao direito da biblioteca e do roteiro. Sem stores, sem DOM.

type Ref = { id: string; type?: string; name?: string; [k: string]: unknown }

/** troca o item `indice` com o vizinho (delta -1 sobe, +1 desce). null = nao da (ja esta na ponta, indice invalido). Nao muda a lista recebida. */
export function moverItem<T>(lista: T[], indice: number, delta: -1 | 1): T[] | null {
    const alvo = indice + delta
    if (!Number.isInteger(indice) || indice < 0 || indice >= lista.length || alvo < 0 || alvo >= lista.length) return null
    const nova = [...lista]
    ;[nova[indice], nova[alvo]] = [nova[alvo], nova[indice]]
    return nova
}

/** os blocos da lista: `lead` sao os itens antes da primeira `section`; cada bloco abre numa `section` e vai ate a proxima */
export function blocosDe(lista: Ref[]): { lead: Ref[]; blocos: Ref[][] } {
    const lead: Ref[] = []
    const blocos: Ref[][] = []
    for (const item of lista) {
        if (item.type === "section") blocos.push([item])
        else if (blocos.length) blocos[blocos.length - 1].push(item)
        else lead.push(item)
    }
    return { lead, blocos }
}

/**
 * Move o BLOCO que comeca na `section` de `indice` uma posicao para cima ou para baixo (cada item vai junto). Os itens soltos do comeco (antes do
 * primeiro bloco) ficam onde estao. null = nao da (indice nao e um bloco, ou ja esta na ponta).
 */
export function moverBloco(lista: Ref[], indice: number, delta: -1 | 1): Ref[] | null {
    if (lista[indice]?.type !== "section") return null
    const { lead, blocos } = blocosDe(lista)
    const pos = blocos.findIndex((b) => b[0] === lista[indice])
    const alvo = pos + delta
    if (pos < 0 || alvo < 0 || alvo >= blocos.length) return null
    const ordem = [...blocos]
    ;[ordem[pos], ordem[alvo]] = [ordem[alvo], ordem[pos]]
    return [...lead, ...ordem.flat()]
}

/** novo nome da `section` de `indice`. null = nao da (nao e bloco, nome vazio ou igual) */
export function renomearBloco(lista: Ref[], indice: number, nome: string): Ref[] | null {
    const limpo = nome.trim()
    if (lista[indice]?.type !== "section" || !limpo || limpo === lista[indice].name) return null
    const nova = [...lista]
    nova[indice] = { ...nova[indice], name: limpo }
    return nova
}

/**
 * A lista de itens de um layout de menu que NAO tem destino: estavam no menu antigo, nao estao no novo e ninguem declarou o porque. `declarados` e o
 * mapa item -> destino ("removido: motivo") do mesmo layout. Vazia = tudo tem lugar. Separadores e grupos nao contam.
 */
export function semDestino(antigo: string[], novo: string[], declarados: { [item: string]: string }): string[] {
    const atual = new Set(novo)
    return antigo.filter((i) => i !== "SEPARATOR" && !atual.has(i) && !(i in declarados))
}

/** o clique/gesto repetido no MESMO item dentro da janela e engolido (a decisao 4 do Andre: o video nao dispara 2x) */
export function criarEngolidor(ms = 400) {
    const ultimo = new Map<string, number>()
    return (chave: string, agora: number): boolean => {
        const antes = ultimo.get(chave)
        if (antes !== undefined && agora - antes < ms) return true
        ultimo.set(chave, agora)
        if (ultimo.size > 64) for (const [k, t] of ultimo) if (agora - t >= ms) ultimo.delete(k)
        return false
    }
}

export type Retangulo = { left: number; top: number; right: number; bottom: number }

/**
 * O anteparo do menu de contexto (revisao da fatia 6, achado 2): o primeiro toque num item fecha o menu; o segundo toque de um duplo clique
 * cairia no que estava EMBAIXO dele (um slide do centro, o ▶ de outra linha). Durante `ms` depois do clique que fechou, o ponto dentro do
 * retangulo que o menu ocupava e engolido. Fora do retangulo, ou depois da janela, passa.
 */
export function criarAnteparo(ms = 250) {
    let ativo: { rect: Retangulo; ate: number } | null = null
    return {
        armar(rect: Retangulo, agora: number) {
            ativo = { rect, ate: agora + ms }
        },
        engole(ponto: { x: number; y: number }, agora: number): boolean {
            if (!ativo) return false
            if (agora >= ativo.ate) {
                ativo = null
                return false
            }
            const r = ativo.rect
            return ponto.x >= r.left && ponto.x <= r.right && ponto.y >= r.top && ponto.y <= r.bottom
        }
    }
}
