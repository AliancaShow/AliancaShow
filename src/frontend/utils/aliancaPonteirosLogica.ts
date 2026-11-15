// ----- AliançaShow · Preparar, fatia 6: o que está no ar acompanha o MESMO item da lista (por id) -----
//
// Só a conta, sem store (quem liga aos stores é aliancaPonteiros.ts).
//
// O FreeShow aponta para o projeto por POSIÇÃO (`out.slide.projectIndex`, `activeShow.index`...). Toda vez
// que a lista muda (drop, mover, Ctrl+Z, "Pôr no culto", tirar, Sirvo...) a posição pode ficar velha.
// `reapontar` leva uma posição de `antes` para `depois` pelo id do item, não pela referência do objeto
// (o histórico clona a lista, então a referência não sobrevive ao Ctrl+Z).

export type ItemDaLista = { id: string }

/** a lista que chegou até aqui como ids (strings), para comparar por conteúdo */
export function idsDaLista(itens: ItemDaLista[] | null | undefined): string[] {
    return (itens || []).map((a) => String(a?.id ?? ""))
}

/** duas listas de ids iguais, na mesma ordem? */
export function mesmosIds(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
    if (a === b) return true
    if (!a || !b || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
}

const LIMITE_DP = 4_000_000

/**
 * Casa cada item de `antes` com o de `depois`: devolve, por posição de `antes`, a posição em `depois` (-1 = saiu).
 * 1º passo: a maior subsequência comum, que mantém a ordem relativa (item que não se mexeu fica casado com ele mesmo).
 * 2º passo: o que sobrou de `antes` e tem o mesmo id sobrando em `depois` (item que foi movido) casa com o mais próximo.
 */
export function alinhar(antes: string[], depois: string[]): number[] {
    const n = antes.length
    const m = depois.length
    const casado: number[] = new Array(n).fill(-1)
    const usado: boolean[] = new Array(m).fill(false)

    if (n * m <= LIMITE_DP) {
        const w = m + 1
        const t = new Uint16Array((n + 1) * w)
        for (let i = n - 1; i >= 0; i--) {
            for (let j = m - 1; j >= 0; j--) {
                t[i * w + j] = antes[i] === depois[j] ? t[(i + 1) * w + j + 1] + 1 : Math.max(t[(i + 1) * w + j], t[i * w + j + 1])
            }
        }
        let i = 0
        let j = 0
        while (i < n && j < m) {
            if (antes[i] === depois[j]) {
                casado[i] = j
                usado[j] = true
                i++
                j++
            } else if (t[(i + 1) * w + j] >= t[i * w + j + 1]) i++
            else j++
        }
    } else {
        // lista enorme: casa por ordem de aparição
        const vistos = new Map<string, number[]>()
        depois.forEach((id, j) => vistos.set(id, [...(vistos.get(id) || []), j]))
        const consumido = new Map<string, number>()
        antes.forEach((id, i) => {
            const k = consumido.get(id) || 0
            const lugar = vistos.get(id)?.[k]
            if (lugar === undefined) return
            consumido.set(id, k + 1)
            casado[i] = lugar
            usado[lugar] = true
        })
    }

    // movidos: sobrou em `antes` e sobrou um igual em `depois`
    for (let i = 0; i < n; i++) {
        if (casado[i] >= 0) continue
        let melhor = -1
        for (let j = 0; j < m; j++) {
            if (usado[j] || depois[j] !== antes[i]) continue
            if (melhor < 0 || Math.abs(j - i) < Math.abs(melhor - i)) melhor = j
        }
        if (melhor >= 0) {
            casado[i] = melhor
            usado[melhor] = true
        }
    }
    return casado
}

/**
 * Para onde vai um ponteiro que estava na posição `i` de `antes` quando a lista passa a ser `depois`.
 * `idDoPonteiro`: o id que o ponteiro diz apontar (o slide no ar, o item aberto). Sem ele, vale o item de `antes[i]`.
 *
 * - Ponteiro fora da lista de antes: não é tocado.
 * - Ponteiro coerente (`antes[i].id` é o id dele): vai para onde o MESMO item foi parar. Se o item saiu da lista,
 *   fica na posição onde ele estava (o número de itens de antes[0..i) que continuam), que é o "tirado · ainda no ar" da F3.
 * - Ponteiro órfão (o item no ar já tinha sido tirado; `antes[i]` é o vizinho que ocupou a posição): segue o vizinho
 *   (o "âncora"). Exceção: se o id dele ganhou ocorrência nova em `depois` (o Ctrl+Z da própria retirada), vai para ela.
 */
export function reapontar(antes: ItemDaLista[] | string[], depois: ItemDaLista[] | string[], i: number, idDoPonteiro?: string | null): number {
    const a = paraIds(antes)
    const d = paraIds(depois)
    if (!Number.isInteger(i) || i < 0 || i >= a.length) return i

    const casado = alinhar(a, d)
    return reapontarCom(a, d, casado, i, idDoPonteiro)
}

/** o mesmo, com o alinhamento já feito (várias saídas na mesma passada) */
export function reapontarCom(a: string[], d: string[], casado: number[], i: number, idDoPonteiro?: string | null): number {
    if (!Number.isInteger(i) || i < 0 || i >= a.length) return i
    const coerente = idDoPonteiro === undefined || idDoPonteiro === null || idDoPonteiro === a[i]

    if (!coerente) {
        const id = idDoPonteiro as string
        const antesDele = a.filter((x) => x === id).length
        const novos = d.map((x, j) => ({ x, j })).filter(({ x }) => x === id).length
        if (novos > antesDele) {
            // as ocorrências de `depois` que ninguém de `antes` ocupa são as novas: a mais perto da posição vai
            const ocupados = new Set(casado.filter((j) => j >= 0))
            const livres = d.map((x, j) => ({ x, j })).filter(({ x, j }) => x === id && !ocupados.has(j))
            if (livres.length) return livres.reduce((p, c) => (Math.abs(c.j - i) < Math.abs(p.j - i) ? c : p)).j
        }
        // senão segue o vizinho que ocupa a posição
    }

    if (casado[i] >= 0) return casado[i]
    return casado.slice(0, i).filter((j) => j >= 0).length
}

function paraIds(l: ItemDaLista[] | string[]): string[] {
    return (l as any[]).map((x) => (typeof x === "string" ? x : String(x?.id ?? "")))
}

/** o ponteiro como o FreeShow guarda: posição e id do item */
export type Ponteiro = { index?: number | null; id?: string | null }

/** a posição nova de um ponteiro, ou null se fica como está */
export function novaPosicao(a: string[], d: string[], casado: number[], p: Ponteiro | null | undefined): number | null {
    if (!p || typeof p.index !== "number" || !Number.isInteger(p.index) || p.index < 0 || p.index >= a.length) return null
    const j = reapontarCom(a, d, casado, p.index, p.id ?? undefined)
    return j !== p.index ? j : null
}
