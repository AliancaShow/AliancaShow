// ----- AliançaShow · Preparar, fatia 4: colar letra (com acordes em cima) -----
//
// Só a conta, sem store e sem o importador do FreeShow (`txt.ts` fica intocado: o único que ele ganha
// são dois opcionais). Quem converte em slides é `convertText`; quem pendura os acordes na linha é
// `acordesPorTexto` + o componente. Aqui ficam:
//
//   - o detector de acordes por TOKEN (`ehAcorde`, `classificarLinha`): linha só é de acordes se TODOS
//     os tokens casam inteiros; palavra que parece acorde ("A", "E", "Em") sozinha é letra;
//   - `prepararLetraColada`: devolve a letra LIMPA (sem acorde dentro do texto, que quebraria o
//     importador), o mapa `linha → acordes {pos,key}`, e as linhas que sumiram (para a prévia mostrar).

export type AcordeNaLinha = { pos: number; key: string }

export type LinhaDaPrevia = {
    /** índice da linha no texto colado (0-based), para o "manter como letra" */
    indice: number
    texto: string
}

export type LetraPreparada = {
    /** a letra limpa, pronta pro `convertText` (grupos como `[Refrão]`, sem acorde, sem linha órfã) */
    texto: string
    /** texto da linha de LETRA (já sem o espaço inicial) → acordes; só a primeira ocorrência de cada texto */
    acordes: Map<string, AcordeNaLinha[]>
    /** linhas de acorde que viraram acorde na linha de letra de baixo */
    absorvidas: LinhaDaPrevia[]
    /** linhas só de acorde/tablatura que não têm letra embaixo (intro, solo): saem do slide */
    descartadas: LinhaDaPrevia[]
    /** quantos acordes foram pendurados */
    totalDeAcordes: number
}

// ---------------------------------------------------------------- acorde

const RAIZ = "[A-G][#b]?"
// m, M, maj, min, dim, aug, sus, add, números, °/º/+, "(9)", "(b5)", "(#11)", "(add9)"
const SUFIXO = "(?:maj|min|dim|aug|sus|add|m|M|\\d{1,2}|[°º+]|\\((?:[#b+\\-]?\\d{1,2}|add\\d{1,2}|sus\\d?)\\))*"
const ACORDE = new RegExp(`^${RAIZ}${SUFIXO}(?:/${RAIZ})?$`)
/** só a letra, sem nada: "A", "E", "G" — a forma que mais se confunde com palavra */
const SO_LETRA = /^[A-G]$/
const SEPARADOR = /^[|\-–—/:.~]+$/

/** o token inteiro é um acorde ("Am7(b5)", "C7M", "G/B", "F#m") */
export function ehAcorde(token: string): boolean {
    return ACORDE.test(token)
}

/** acorde "de verdade": qualquer coisa além da letra pura (tem m, 7, #, /, ...) */
const ehAcordeForte = (token: string) => ehAcorde(token) && !SO_LETRA.test(token)

type Tokens = { texto: string; col: number }[]

function tokens(linha: string): Tokens {
    const t: Tokens = []
    const re = /\S+/g
    let m: RegExpExecArray | null
    while ((m = re.exec(linha)) !== null) t.push({ texto: m[0], col: m.index })
    return t
}

export type TipoDeLinha = "vazia" | "acordes" | "letra"

/** o que a linha SOZINHA parece (sem contexto): só de acordes (por token), ou letra */
export function aparenciaDeAcordes(linha: string): { todosAcordes: boolean; tokens: Tokens; fortes: number; separadores: number } {
    const t = tokens(linha)
    let fortes = 0
    let separadores = 0
    let todos = t.length > 0
    for (const k of t) {
        if (SEPARADOR.test(k.texto)) {
            separadores++
            continue
        }
        if (!ehAcorde(k.texto)) {
            todos = false
            break
        }
        if (ehAcordeForte(k.texto)) fortes++
    }
    const acordes = t.filter((k) => !SEPARADOR.test(k.texto))
    return { todosAcordes: todos && acordes.length > 0, tokens: acordes, fortes, separadores }
}

// ---------------------------------------------------------------- cabeçalho de grupo, tablatura, intro

const NOME_DE_GRUPO = "refr[aã]o|coro|ponte|pr[eé][- ]?refr[aã]o|verso|estrofe|intro(?:du[cç][aã]o)?|final|tag|interl[uú]dio"
const CABECALHO = new RegExp(`^\\[?\\s*(${NOME_DE_GRUPO})\\s*(\\d+)?\\s*\\]?\\s*:?\\s*$`, "i")
/** "Refrão: Aleluia" — o grupo e a primeira linha na mesma linha (só com nome de grupo conhecido: "Senhor: tu és" é letra) */
const CABECALHO_COM_TEXTO = new RegExp(`^\\[?\\s*(${NOME_DE_GRUPO})\\s*(\\d+)?\\s*\\]?\\s*:\\s*(\\S.*)$`, "i")
/** só o rótulo (e talvez acordes): "Intro: G D Em C", "Solo:", "Riff", "Base" */
const ROTULO_SO_PARA_ACORDES = /^(?:intro(?:du[cç][aã]o)?|solo|riff|base|interl[uú]dio|ponte|final|tab|dedilhado)\s*:?\s*/i
const TABLATURA = /^\s*[eEBGDAb]?\s*\|[-0-9hpbr\\/~x^|()\s]{4,}$|^[\s|\-0-9hpbr~/\\x()]{8,}$/

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

function nomeDoGrupo(nome: string, numero?: string): string {
    const n = nome.toLowerCase()
    let base: string
    if (/^pr[eé][- ]?refr/.test(n)) base = "Pré-refrão"
    else if (n.startsWith("refr")) base = "Refrão"
    else if (n.startsWith("interl")) base = "Interlúdio"
    else if (n.startsWith("introdu")) base = "Introdução"
    else base = maiuscula(n)
    return `${base}${numero ? " " + numero : ""}`
}

/** a linha é só o nome de um grupo ("Refrão", "REFRÃO:", "[Verso 2]"): o nome normalizado, ou null */
export function cabecalhoDeGrupo(linha: string): { grupo: string; resto: string } | null {
    const l = linha.trim()
    if (!l) return null
    const so = CABECALHO.exec(l)
    if (so) return { grupo: nomeDoGrupo(so[1], so[2]), resto: "" }
    const com = CABECALHO_COM_TEXTO.exec(l)
    if (com) return { grupo: nomeDoGrupo(com[1], com[2]), resto: com[3].trim() }
    return null
}

/** "Intro: G D Em C", "Solo:", tablatura: linha de música que não é letra */
export function ehLinhaTecnica(linha: string): boolean {
    const l = linha.trim()
    if (!l) return false
    if (TABLATURA.test(linha) && /[-]{2,}|\|/.test(l)) return true
    const m = ROTULO_SO_PARA_ACORDES.exec(l)
    if (!m) return false
    const resto = l.slice(m[0].length).trim()
    // "Intro" / "Final" sozinhos são cabeçalho de grupo (tratados antes); "Solo:" / "Riff" sozinhos somem
    if (!resto) return /^(?:solo|riff|base|tab|dedilhado)/i.test(m[0])
    const a = aparenciaDeAcordes(resto)
    return a.todosAcordes
}

// ---------------------------------------------------------------- marcadores de repetição

/** "(2x)" / "bis" no fim da linha somem; linha que é só o marcador vira "x2" (repete o slide) */
export function tirarMarcadorDeRepeticao(linha: string): { texto: string; repete: number } {
    const sozinho = /^\s*(?:\(?\s*(\d)\s*x\s*\)?|\(?\s*bis\s*\)?|x\s*(\d))\s*$/i.exec(linha)
    if (sozinho) {
        const n = Number(sozinho[1] || sozinho[2] || 2)
        return { texto: "", repete: n >= 2 && n < 10 ? n : 2 }
    }
    const fim = /\s+(?:\(\s*\d\s*x\s*\)|\(\s*bis\s*\)|bis)\s*$/i.exec(linha)
    if (fim) return { texto: linha.slice(0, fim.index).trimEnd(), repete: 0 }
    return { texto: linha, repete: 0 }
}

// ---------------------------------------------------------------- o preparo

export type OpcoesDoPreparo = {
    /** linhas (índice no texto colado) que o operador mandou tratar como letra */
    manterComoLetra?: Set<number>
}

/**
 * Classifica cada linha e monta a letra limpa. Regras (revisão B2):
 *  - linha de acordes = TODOS os tokens são acorde inteiro (espaço ou `|`/`-` entre eles);
 *  - linha de UM token só vale se a linha de baixo é letra E há outra linha de acordes na colagem;
 *  - linha só de letras puras ("E A") vale com 3+ tokens, ou 2 se a colagem tem acordes mais fortes
 *    e há letra embaixo;
 *  - acorde sem letra embaixo (nem linha vazia no meio) é órfão: sai (intro, solo, fim de estrofe).
 */
export function prepararLetraColada(bruto: string, opcoes: OpcoesDoPreparo = {}): LetraPreparada {
    const manter = opcoes.manterComoLetra || new Set<number>()
    const linhas = (bruto || "")
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((l) => l.replace(/\s+$/, ""))
    const aparencia = linhas.map((l, i) => (manter.has(i) ? null : aparenciaDeAcordes(l)))

    const ehBranca = (i: number) => !linhas[i].trim()
    const ehTecnica = (i: number) => !manter.has(i) && ehLinhaTecnica(linhas[i])
    const ehCabecalho = (i: number) => !manter.has(i) && !!cabecalhoDeGrupo(linhas[i]) && !aparencia[i]?.todosAcordes

    // há no mínimo uma linha de acordes forte (2+ tokens, todos acorde, ao menos um não-letra-pura)?
    let haForte = aparencia.some((a, i) => !!a && !ehTecnica(i) && a.todosAcordes && a.tokens.length >= 2 && a.fortes >= 1)

    // a linha de baixo é letra de verdade (não vazia, não acorde, não grupo, não técnica)?
    const abaixoEhLetra = (i: number) => {
        const j = i + 1
        if (j >= linhas.length || ehBranca(j) || ehCabecalho(j) || ehTecnica(j)) return false
        return !aparencia[j]?.todosAcordes
    }

    // música só com letras puras ("G D" em várias linhas): duas ou mais linhas assim com letra embaixo já são contexto
    if (!haForte) {
        const nuas = aparencia.filter((a, i) => !!a && !ehBranca(i) && !ehTecnica(i) && !ehCabecalho(i) && a.todosAcordes && a.tokens.length >= 2 && abaixoEhLetra(i)).length
        haForte = nuas >= 2
    }

    const ehLinhaDeAcordes = (i: number): boolean => {
        const a = aparencia[i]
        if (!a || ehBranca(i) || ehTecnica(i) || ehCabecalho(i) || !a.todosAcordes) return false
        const n = a.tokens.length
        if (n === 1) return haForte && abaixoEhLetra(i)
        if (a.fortes >= 1) return true
        // só letras puras ("G D C"): 3+ vale sozinho; 2 só com contexto
        return n >= 3 || (haForte && abaixoEhLetra(i))
    }

    const saida: string[] = []
    const acordes = new Map<string, AcordeNaLinha[]>()
    const absorvidas: LinhaDaPrevia[] = []
    const descartadas: LinhaDaPrevia[] = []
    let total = 0
    let ultimaBranca = true

    const empurra = (l: string) => {
        saida.push(l)
        ultimaBranca = false
    }
    const empurraBranca = () => {
        if (!ultimaBranca && saida.length) saida.push("")
        ultimaBranca = true
    }

    for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i]
        if (ehBranca(i)) {
            empurraBranca()
            continue
        }
        if (ehTecnica(i)) {
            descartadas.push({ indice: i, texto: linha.trim() })
            continue
        }
        if (ehCabecalho(i)) {
            const c = cabecalhoDeGrupo(linha)!
            // grupo começa um bloco novo
            empurraBranca()
            empurra(`[${c.grupo}]`)
            if (c.resto) {
                const r = tirarMarcadorDeRepeticao(c.resto)
                if (r.texto) empurra(r.texto)
            }
            continue
        }
        if (ehLinhaDeAcordes(i)) {
            if (abaixoEhLetra(i)) {
                const letraBruta = linhas[i + 1]
                const margem = letraBruta.length - letraBruta.trimStart().length
                const limpa = tirarMarcadorDeRepeticao(letraBruta.trim())
                const texto = limpa.texto
                const lista = posicoesDosAcordes(linha, letraBruta, margem, texto.length)
                if (texto && lista.length && !acordes.has(texto)) acordes.set(texto, lista)
                total += lista.length
                absorvidas.push({ indice: i, texto: linha.trim() })
                if (texto) empurra(texto)
                if (limpa.repete) empurra(`x${limpa.repete}`)
                i++ // a letra já foi
            } else {
                descartadas.push({ indice: i, texto: linha.trim() })
            }
            continue
        }
        const r = tirarMarcadorDeRepeticao(linha.trim())
        if (r.texto) empurra(r.texto)
        if (r.repete) empurra(`x${r.repete}`)
    }
    while (saida.length && !saida[saida.length - 1].trim()) saida.pop()
    return { texto: saida.join("\n"), acordes, absorvidas, descartadas, totalDeAcordes: total }
}

/** a coluna de cada acorde na linha de cima vira posição na letra (acorde sobre espaço anda pra próxima palavra) */
function posicoesDosAcordes(linhaDeAcordes: string, letra: string, margem: number, tamanho: number): AcordeNaLinha[] {
    const lista: AcordeNaLinha[] = []
    for (const k of aparenciaDeAcordes(linhaDeAcordes).tokens) {
        let col = k.col
        if (col < letra.length && letra[col] === " ") {
            while (col < letra.length && letra[col] === " ") col++
        }
        const pos = Math.max(0, Math.min(col - margem, tamanho))
        lista.push({ pos, key: k.texto })
    }
    return lista
}

// ---------------------------------------------------------------- dividir

export type ModoDeDivisao = "paragrafo" | "linha" | "n"

/** `linhasPorSlide` do `convertText`: 0 = por parágrafo (o texto já traz as linhas em branco) */
export function linhasPorSlideDoModo(modo: ModoDeDivisao, n: number): number {
    if (modo === "linha") return 1
    if (modo === "n") return Math.max(1, Math.min(8, Math.floor(n) || 2))
    return 0
}
