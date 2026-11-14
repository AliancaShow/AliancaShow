import { normalizarTitulo } from "./aliancaSirvoMusicas"

// ----- AliançaShow · Preparar, fatia 4: "Adicionar várias músicas" e a checagem de duplicada -----
//
// Só a conta, sem store. A banda visitante manda a lista fora do Sirvo (WhatsApp, e-mail): uma música por
// linha, com ou sem número, às vezes com o cantor ("Música - Cantor") e o tom.

export type LinhaDaLista = {
    /** o que a pessoa escreveu (sem número/marcador), para mostrar */
    original: string
    /** o nome da música, sem cantor, sem tom */
    nome: string
    cantor: string
    /** guardado, ainda sem uso */
    tom: string
    /** lista sem numeração e a linha parece cabeçalho ("Banda X · domingo", "Domingo 16/11"): se não casar, nasce desmarcada */
    pareceCabecalho: boolean
}

const NUMERADA = /^\s*\d+\s*[.)\-–]/
const MARCADOR = /^\s*(?:[•*\-–—·▪►➤→✔✅]+|\p{Extended_Pictographic}+️?)\s*/u
const SEPARADORES_DE_CANTOR = [" - ", " – ", " — ", " | "]
const SO_PONTUACAO = /^[\s\p{P}\p{S}]*$/u
const DIA_DA_SEMANA = /\b(?:domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado)\b/i

const VERSAO = "ao vivo|live|ac[uú]stic[oa]|acoustic|vers[aã]o|playback|remix|part\\.|participa[cç][aã]o|feat\\.?|ft\\.?"
const SO_PALAVRA_DE_VERSAO = new RegExp(`^(?:${VERSAO})(?:\\s|$)`, "i")

/** uma música por linha. Se alguma linha é numerada, só as numeradas contam (o cabeçalho some). */
export function lerLista(texto: string): LinhaDaLista[] {
    const linhas = (texto || "").replace(/\r\n?/g, "\n").split("\n")
    const haNumerada = linhas.some((l) => NUMERADA.test(l))
    const saida: LinhaDaLista[] = []
    for (const bruta of linhas) {
        if (haNumerada && !NUMERADA.test(bruta)) continue
        let l = bruta.replace(/^\s*\d+\s*[.)\-–]\s*/, "")
        l = l.replace(MARCADOR, "").trim()
        if (!l || SO_PONTUACAO.test(l)) continue

        // tom no fim: "- Tom: G", "| Tom A", "(G)", "(Tom A)"
        let tom = ""
        const fimTom = /\s*(?:[-–—|]\s*)?(?:tom\s*:?\s*([A-G][#b]?m?)|\(\s*(?:tom\s*:?\s*)?([A-G][#b]?m?)\s*\))\s*$/i.exec(l)
        if (fimTom && fimTom.index > 0) {
            tom = (fimTom[1] || fimTom[2] || "").trim()
            l = l.slice(0, fimTom.index).trim()
        }
        const original = l

        // cantor: primeiro separador; o resto fica no cantor. Se o "cantor" é só palavra de versão, é sufixo do nome.
        let nome = l
        let cantor = ""
        let melhor = -1
        let sep = ""
        for (const s of SEPARADORES_DE_CANTOR) {
            const i = l.indexOf(s)
            if (i > 0 && (melhor < 0 || i < melhor)) {
                melhor = i
                sep = s
            }
        }
        if (melhor > 0) {
            const a = l.slice(0, melhor).trim()
            const b = l.slice(melhor + sep.length).trim()
            if (SO_PALAVRA_DE_VERSAO.test(b)) nome = `${a} (${b})`
            else if (a && b) {
                nome = a
                cantor = b
            }
        }
        if (!nome) continue
        const pareceCabecalho = !haNumerada && (l.includes("·") || /:\s*$/.test(l) || /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/.test(l) || DIA_DA_SEMANA.test(l))
        saida.push({ original, nome, cantor, tom, pareceCabecalho })
    }
    return saida
}

/**
 * A chave de comparação: o título normalizado (sem acento/caixa/pontuação) e SEM o sufixo de versão.
 * "Bondade de Deus (Ao Vivo)", "OUSADO AMOR!" e "ousado amor" têm a mesma chave de "Bondade de Deus" etc.
 */
export function chaveDeMusica(nome: string | null | undefined): string {
    let t = String(nome || "")
    // (Ao Vivo), [Live], (Acústico), (feat. Fulano), (Part. Fulano) — mas não "(Parte 2)"
    const marca = new RegExp(`[(\\[][^)\\]]*(?:^|[^\\p{L}])(?:${VERSAO})[^)\\]]*[)\\]]|[(\\[](?:${VERSAO})[^)\\]]*[)\\]]`, "giu")
    t = t.replace(marca, " ")
    // "Música - Ao Vivo" no fim
    t = t.replace(new RegExp(`\\s+[-–—]\\s+(?:${VERSAO})[^-–—]*$`, "i"), " ")
    return normalizarTitulo(t)
}

// ---------------------------------------------------------------- casar com a biblioteca

export type MusicaDoCatalogo = {
    id: string
    nome: string
    categoria?: string
    /** `timestamps.used`: a última vez que foi usada num culto */
    usadoEm?: number | null
}

export type Casamento = { tipo: "uma"; showId: string } | { tipo: "varias"; candidatos: string[]; /** a chave era idêntica (e há mais de uma) */ identicas: boolean; preSelecionado: string | null } | { tipo: "nenhuma" }

export const MAX_CANDIDATOS = 5

/** o texto da lista é igual a ele, só mais comprido: "Santo" × "Santo Espírito" (começo de palavra, 4+ letras) */
function contem(a: string, b: string): boolean {
    if (a.length < 4 || b.length < 4 || a === b) return false
    return (" " + b).includes(" " + a) || (" " + a).includes(" " + b)
}

// Cópia da `similarity` do importador (converters/txt.ts), sem puxar o módulo (stores) pra conta pura
function distancia(a: string, b: string): number {
    const custos: number[] = []
    for (let i = 0; i <= a.length; i++) {
        let ultimo = i
        for (let j = 0; j <= b.length; j++) {
            if (i === 0) custos[j] = j
            else if (j > 0) {
                let novo = custos[j - 1]
                if (a.charAt(i - 1) !== b.charAt(j - 1)) novo = Math.min(novo, ultimo, custos[j]) + 1
                custos[j - 1] = ultimo
                ultimo = novo
            }
        }
        if (i > 0) custos[b.length] = ultimo
    }
    return custos[b.length]
}
export function similaridade(s1: string, s2: string): number {
    const longo = s1.length < s2.length ? s2 : s1
    const curto = s1.length < s2.length ? s1 : s2
    if (!longo.length) return 1
    return (longo.length - distancia(longo.toLowerCase(), curto.toLowerCase())) / longo.length
}

/**
 * Casa a linha da lista com a biblioteca. Só chave idêntica ÚNICA vira "uma". "Contém" e parecida (≥ 0,85)
 * sempre viram "qual?" (mesmo com um candidato) com a opção "nenhuma: é outra". Duas idênticas:
 * pré-seleciona a usada mais recentemente.
 */
export function casarComBiblioteca(nome: string, catalogo: MusicaDoCatalogo[]): Casamento {
    const chave = chaveDeMusica(nome)
    if (!chave) return { tipo: "nenhuma" }
    const doCatalogo = catalogo.map((m) => ({ m, chave: chaveDeMusica(m.nome) })).filter((x) => x.chave)

    const identicas = doCatalogo.filter((x) => x.chave === chave).map((x) => x.m)
    if (identicas.length === 1) return { tipo: "uma", showId: identicas[0].id }
    if (identicas.length > 1) {
        const ordem = [...identicas].sort((a, b) => (b.usadoEm || 0) - (a.usadoEm || 0))
        return { tipo: "varias", candidatos: ordem.slice(0, MAX_CANDIDATOS).map((m) => m.id), identicas: true, preSelecionado: ordem[0].id }
    }

    const contidas = doCatalogo.filter((x) => contem(chave, x.chave)).map((x) => x.m)
    const jaVai = new Set(contidas.map((m) => m.id))
    const parecidas = doCatalogo
        .filter((x) => !jaVai.has(x.m.id) && similaridade(chave, x.chave) >= 0.85)
        .map((x) => ({ m: x.m, s: similaridade(chave, x.chave) }))
        .sort((a, b) => b.s - a.s)
        .map((x) => x.m)
    const todos = [...contidas, ...parecidas].slice(0, MAX_CANDIDATOS)
    if (todos.length) return { tipo: "varias", candidatos: todos.map((m) => m.id), identicas: false, preSelecionado: null }
    return { tipo: "nenhuma" }
}

// ---------------------------------------------------------------- onde entra

/** "fim" = fim da lista do projeto (depois do "Fora do roteiro": o que o Sirvo nunca mexe); "depois" = logo depois do selecionado */
export function posicaoDeEntrada(totalDeItens: number, modo: "fim" | "depois", indiceSelecionado: number | null | undefined): number {
    if (modo === "depois" && typeof indiceSelecionado === "number" && indiceSelecionado >= 0 && indiceSelecionado < totalDeItens) return indiceSelecionado + 1
    return totalDeItens
}

// ---------------------------------------------------------------- música duplicada

export type Duplicada = { id: string; nome: string; categoria?: string }

/** o texto sem acento, caixa, pontuação nem acorde `[G]` — pra comparar letra com letra */
export function normalizarLetra(t: string | null | undefined): string {
    return normalizarTitulo(String(t || "").replace(/\[[^\]]*\]/g, " "))
}

/**
 * Já existe? Por nome (chave idêntica) e, quando vem a letra (só em "nova"), por letra: as 3 primeiras linhas
 * (20+ letras) contidas no texto de outro show. `textos` = `textCache` (id → texto minúsculo).
 */
export function duplicadasDe(nome: string, letra: string | null | undefined, catalogo: MusicaDoCatalogo[], textos: { [id: string]: string } = {}): { porNome: Duplicada[]; porLetra: Duplicada[] } {
    const chave = chaveDeMusica(nome)
    const porNome = chave ? catalogo.filter((m) => chaveDeMusica(m.nome) === chave).map((m) => ({ id: m.id, nome: m.nome, categoria: m.categoria })) : []
    const porLetra: Duplicada[] = []
    if (letra) {
        const linhas = letra
            .replace(/\r\n?/g, "\n")
            .split("\n")
            .map((l) => normalizarLetra(l))
            .filter((l) => l && !/^(?:x\s?\d|bis)$/.test(l))
        const trecho = linhas.slice(0, 3).join(" ")
        if (trecho.length >= 20) {
            const jaPorNome = new Set(porNome.map((d) => d.id))
            for (const m of catalogo) {
                if (jaPorNome.has(m.id)) continue
                const t = textos[m.id]
                if (t && normalizarLetra(t).includes(trecho)) porLetra.push({ id: m.id, nome: m.nome, categoria: m.categoria })
            }
        }
    }
    return { porNome, porLetra }
}
