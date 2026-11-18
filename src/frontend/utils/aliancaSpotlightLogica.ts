// Leiaute v2, fatia 5: a busca Spotlight (Ctrl+K). So a CONTA, sem importar store nem componente (a janela de saida importa a arvore de stores).
// O que faz cada tecla, a referencia de versiculo ("Rm 8:28", "Romanos 8 28", "Jo 3.16"), as acoes do app e a trava de repeticao moram aqui;
// os efeitos (abrir, pôr no roteiro, mandar ao ar) estao em aliancaSpotlight.ts.

export type TelaDoSpotlight = "mostrar" | "editar" | "pagina"
export type TipoDeResultado = "show" | "midia" | "audio" | "versiculo" | "acao"
/** o que um Enter / Ctrl+Enter faz com o resultado */
export type AcaoDeTecla = "roteiro" | "tocar" | "abrir-show" | "abrir-editar" | "abrir-midia" | "ao-ar" | "abrir-biblia" | "executar"

/** a espera do Enter repetido: mesmo resultado, menos que isto, e o segundo Enter nao faz nada (o Enter em auto-repeat nao dispara duas vezes) */
export const ESPERA_ENTER_MS = 400

// ---------------------------------------------------------------- normalizacao

/** minusculas, sem acento, so letras e numeros (o resto vira espaco), espacos colapsados */
export function normalizar(txt: string): string {
    return String(txt ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
}

// ---------------------------------------------------------------- versiculos

type Livro = { n: number; nome: string; abrevs: string[] }

/** os 66 livros na ordem canonica (o numero e o `book` do `openScripture`). `abrevs` e `nome` sao comparados ja normalizados */
export const LIVROS: Livro[] = [
    { n: 1, nome: "Gênesis", abrevs: ["gn", "ge", "gen"] },
    { n: 2, nome: "Êxodo", abrevs: ["ex", "exo"] },
    { n: 3, nome: "Levítico", abrevs: ["lv", "lev"] },
    { n: 4, nome: "Números", abrevs: ["nm", "num"] },
    { n: 5, nome: "Deuteronômio", abrevs: ["dt", "deut"] },
    { n: 6, nome: "Josué", abrevs: ["js", "jos"] },
    { n: 7, nome: "Juízes", abrevs: ["jz", "juiz"] },
    { n: 8, nome: "Rute", abrevs: ["rt", "rut"] },
    { n: 9, nome: "1 Samuel", abrevs: ["1sm", "1sam"] },
    { n: 10, nome: "2 Samuel", abrevs: ["2sm", "2sam"] },
    { n: 11, nome: "1 Reis", abrevs: ["1rs", "1re"] },
    { n: 12, nome: "2 Reis", abrevs: ["2rs", "2re"] },
    { n: 13, nome: "1 Crônicas", abrevs: ["1cr", "1cro"] },
    { n: 14, nome: "2 Crônicas", abrevs: ["2cr", "2cro"] },
    { n: 15, nome: "Esdras", abrevs: ["ed", "esd"] },
    { n: 16, nome: "Neemias", abrevs: ["ne", "nee"] },
    { n: 17, nome: "Ester", abrevs: ["et", "est"] },
    { n: 18, nome: "Jó", abrevs: ["job"] },
    { n: 19, nome: "Salmos", abrevs: ["sl", "sal", "salmo", "ps"] },
    { n: 20, nome: "Provérbios", abrevs: ["pv", "pr", "prov"] },
    { n: 21, nome: "Eclesiastes", abrevs: ["ec", "ecl"] },
    { n: 22, nome: "Cantares", abrevs: ["ct", "cant", "cantares de salomao"] },
    { n: 23, nome: "Isaías", abrevs: ["is", "isa"] },
    { n: 24, nome: "Jeremias", abrevs: ["jr", "jer"] },
    { n: 25, nome: "Lamentações", abrevs: ["lm", "lam"] },
    { n: 26, nome: "Ezequiel", abrevs: ["ez", "eze"] },
    { n: 27, nome: "Daniel", abrevs: ["dn", "dan"] },
    { n: 28, nome: "Oseias", abrevs: ["os", "ose", "oseias"] },
    { n: 29, nome: "Joel", abrevs: ["jl", "joe"] },
    { n: 30, nome: "Amós", abrevs: ["am", "amo"] },
    { n: 31, nome: "Obadias", abrevs: ["ob", "oba"] },
    { n: 32, nome: "Jonas", abrevs: ["jn", "jon"] },
    { n: 33, nome: "Miqueias", abrevs: ["mq", "miq"] },
    { n: 34, nome: "Naum", abrevs: ["na", "nau"] },
    { n: 35, nome: "Habacuque", abrevs: ["hc", "hab"] },
    { n: 36, nome: "Sofonias", abrevs: ["sf", "sof"] },
    { n: 37, nome: "Ageu", abrevs: ["ag", "age"] },
    { n: 38, nome: "Zacarias", abrevs: ["zc", "zac"] },
    { n: 39, nome: "Malaquias", abrevs: ["ml", "mal"] },
    { n: 40, nome: "Mateus", abrevs: ["mt", "mat"] },
    { n: 41, nome: "Marcos", abrevs: ["mc", "mar", "marc"] },
    { n: 42, nome: "Lucas", abrevs: ["lc", "luc"] },
    { n: 43, nome: "João", abrevs: ["jo", "joa"] },
    { n: 44, nome: "Atos", abrevs: ["at", "ato"] },
    { n: 45, nome: "Romanos", abrevs: ["rm", "rom"] },
    { n: 46, nome: "1 Coríntios", abrevs: ["1co", "1cor"] },
    { n: 47, nome: "2 Coríntios", abrevs: ["2co", "2cor"] },
    { n: 48, nome: "Gálatas", abrevs: ["gl", "gal"] },
    { n: 49, nome: "Efésios", abrevs: ["ef", "efe"] },
    { n: 50, nome: "Filipenses", abrevs: ["fp", "fil", "filip"] },
    { n: 51, nome: "Colossenses", abrevs: ["cl", "col"] },
    { n: 52, nome: "1 Tessalonicenses", abrevs: ["1ts", "1tes"] },
    { n: 53, nome: "2 Tessalonicenses", abrevs: ["2ts", "2tes"] },
    { n: 54, nome: "1 Timóteo", abrevs: ["1tm", "1tim"] },
    { n: 55, nome: "2 Timóteo", abrevs: ["2tm", "2tim"] },
    { n: 56, nome: "Tito", abrevs: ["tt", "tit"] },
    { n: 57, nome: "Filemom", abrevs: ["fm", "flm", "filem"] },
    { n: 58, nome: "Hebreus", abrevs: ["hb", "heb"] },
    { n: 59, nome: "Tiago", abrevs: ["tg", "tia"] },
    { n: 60, nome: "1 Pedro", abrevs: ["1pe", "1pd", "1ped"] },
    { n: 61, nome: "2 Pedro", abrevs: ["2pe", "2pd", "2ped"] },
    { n: 62, nome: "1 João", abrevs: ["1jo", "1joa"] },
    { n: 63, nome: "2 João", abrevs: ["2jo", "2joa"] },
    { n: 64, nome: "3 João", abrevs: ["3jo", "3joa"] },
    { n: 65, nome: "Judas", abrevs: ["jd", "jud"] },
    { n: 66, nome: "Apocalipse", abrevs: ["ap", "apo", "apoc"] }
]

export type ReferenciaBiblica = {
    livro: number
    nomeDoLivro: string
    capitulo: number
    /** `null` = so o capitulo; senao [inicial, final] (iguais num versiculo so) */
    versiculos: [number, number] | null
}

/** o numero do livro para o que se digitou (abreviatura, nome inteiro ou o comeco do nome, a partir de 3 letras); `null` se nao e livro */
export function acharLivro(prefixo: number | null, palavra: string): Livro | null {
    const p = normalizar(palavra).replace(/ /g, "")
    if (!p) return null
    // "Jó" com acento nao e "Jo" (João): a unica abreviatura que o acento distingue
    if (!prefixo && String(palavra).trim().toLowerCase() === "jó") return LIVROS[17]
    const chave = (prefixo ? String(prefixo) : "") + p
    const nomeDe = (l: Livro) => normalizar(l.nome).replace(/ /g, "")
    // a abreviatura vale antes do nome inteiro ("jo" e João, embora "Jó" sem acento tambem se escreva "jo")
    const exato = LIVROS.find((l) => l.abrevs.includes(chave)) || LIVROS.find((l) => nomeDe(l) === chave)
    if (exato) return exato
    // o comeco do nome ("rom" = Romanos); numerado so com o numero ("1 cor"). Abaixo de 3 letras so a abreviatura da lista vale
    if (p.length < 3) return null
    const achados = LIVROS.filter((l) => nomeDe(l).startsWith(chave) && (prefixo ? /^[123]/.test(nomeDe(l)) : !/^[123]/.test(nomeDe(l))))
    return achados.length === 1 ? achados[0] : achados.find((l) => nomeDe(l) === chave) || (achados.length ? achados[0] : null)
}

/**
 * "Rm 8:28", "Romanos 8 28", "Jo 3.16", "1 Co 13:4-7", "Salmos 23". `null` quando nao e uma referencia (nao e livro, ou falta o capitulo).
 * Capitulo ou versiculo zero nao existe. Versiculo final menor que o inicial vira so o inicial.
 */
export function lerReferencia(texto: string): ReferenciaBiblica | null {
    const t = String(texto ?? "")
        .trim()
        .replace(/\s+/g, " ")
    const m = /^(?:([123])\s*[ºo°.]?\s*)?([A-Za-zÀ-ÿ]+)\.?\s*(\d{1,3})(?:\s*[:.,;]\s*|\s+)?(?:(\d{1,3})(?:\s*[-–a]\s*(\d{1,3}))?)?$/.exec(t)
    if (!m) return null
    const livro = acharLivro(m[1] ? Number(m[1]) : null, m[2])
    if (!livro) return null
    const capitulo = Number(m[3])
    if (!capitulo) return null
    let versiculos: [number, number] | null = null
    if (m[4]) {
        const a = Number(m[4])
        if (!a) return null
        const b = m[5] ? Number(m[5]) : a
        versiculos = [a, b >= a ? b : a]
    }
    return { livro: livro.n, nomeDoLivro: livro.nome, capitulo, versiculos }
}

/** "Romanos 8:28", "Romanos 8:28-30" ou "Salmos 23" */
export function rotuloDaReferencia(r: ReferenciaBiblica): string {
    if (!r.versiculos) return `${r.nomeDoLivro} ${r.capitulo}`
    const [a, b] = r.versiculos
    return `${r.nomeDoLivro} ${r.capitulo}:${a}${b > a ? "-" + b : ""}`
}

/** os numeros dos versiculos que o `openScripture` pede (`[[28]]`, `[[28,29,30]]`); capitulo inteiro = `[[1]]` e nao toca */
export function versiculosParaAbrir(r: ReferenciaBiblica): number[][] {
    if (!r.versiculos) return [[1]]
    const [a, b] = r.versiculos
    const lista: number[] = []
    for (let v = a; v <= b && lista.length < 40; v++) lista.push(v)
    return [lista]
}

// ---------------------------------------------------------------- acoes do app

export type AcaoDoApp = { id: string; nome: string; aliases: string[]; atalho?: string }

/** as acoes que a busca oferece (as mesmas do menu do app; Mostrar/Editar nao entram: so o segmentado troca de tela) */
export const ACOES_DO_APP: AcaoDoApp[] = [
    { id: "settings", nome: "Configurações", aliases: ["ajustes", "preferencias", "opcoes"] },
    { id: "display_settings", nome: "Telas", aliases: ["saida", "monitor", "projetor", "telao", "display"] },
    { id: "stage", nome: "Telas e monitor de retorno", aliases: ["palco", "retorno", "stage"] },
    { id: "styles", nome: "Estilos da saída", aliases: ["estilo", "fundo", "aparencia"] },
    { id: "connection", nome: "Conexões", aliases: ["sirvo", "rede", "remoto"] },
    { id: "save", nome: "Salvar", aliases: ["gravar"], atalho: "Ctrl+S" },
    { id: "import", nome: "Importar", aliases: ["abrir arquivo"], atalho: "Ctrl+I" },
    { id: "export", nome: "Exportar", aliases: ["pdf", "backup"], atalho: "Ctrl+E" },
    { id: "history", nome: "Histórico", aliases: ["desfazer", "refazer"], atalho: "Ctrl+H" },
    { id: "fullscreen", nome: "Tela cheia", aliases: ["maximizar"], atalho: "F11" },
    { id: "shortcuts", nome: "Atalhos e ajuda", aliases: ["teclas", "ajuda"] },
    { id: "about", nome: "Sobre o AliançaShow", aliases: ["versao"] },
    { id: "nova_musica", nome: "Nova música", aliases: ["criar musica", "colar letra"] },
    { id: "varias_musicas", nome: "Várias músicas", aliases: ["importar musicas"] },
    { id: "nova_apresentacao", nome: "Nova apresentação", aliases: ["criar apresentacao"] }
]

/** as acoes cujo nome ou apelido comecam, palavra por palavra, pelo que se digitou (todas as palavras do que se digitou precisam bater) */
export function filtrarAcoes(consulta: string, lista: AcaoDoApp[] = ACOES_DO_APP, max = 6): AcaoDoApp[] {
    const palavras = normalizar(consulta).split(" ").filter(Boolean)
    if (!palavras.length) return []
    const pontuar = (a: AcaoDoApp): number => {
        const nome = normalizar(a.nome).split(" ")
        const apelidos = a.aliases.flatMap((x) => normalizar(x).split(" "))
        let pontos = 0
        for (const p of palavras) {
            if (nome.some((n) => n.startsWith(p))) pontos += normalizar(a.nome).startsWith(p) ? 3 : 2
            else if (apelidos.some((n) => n.startsWith(p))) pontos += 1
            else return 0
        }
        return pontos
    }
    return lista
        .map((a) => ({ a, p: pontuar(a) }))
        .filter((x) => x.p > 0)
        .sort((x, y) => y.p - x.p)
        .slice(0, max)
        .map((x) => x.a)
}

// ---------------------------------------------------------------- o que cada tecla faz

/**
 * Enter (`alternativa` falso) e Ctrl+Enter (verdadeiro) por tipo de resultado e por tela. Em Mostrar o show vai ao roteiro com Enter e ao ar com Ctrl+Enter;
 * em Editar a busca nunca manda nada ao ar: Enter abre o show no editor ("Aberto da biblioteca") e Ctrl+Enter poe no roteiro. Versiculo: Enter ao ar
 * (Mostrar), Ctrl+Enter so abre na Biblia; capitulo inteiro nunca toca. `null` = a tecla nao faz nada neste resultado.
 */
export function acaoDaTecla(tipo: TipoDeResultado, tela: TelaDoSpotlight, alternativa: boolean, versiculoCerto = true): AcaoDeTecla | null {
    if (tipo === "acao") return "executar"
    if (tipo === "midia" || tipo === "audio") return "abrir-midia"
    if (tipo === "versiculo") {
        if (tela !== "mostrar" || alternativa || !versiculoCerto) return "abrir-biblia"
        return "ao-ar"
    }
    // show
    if (tela === "editar") return alternativa ? "roteiro" : "abrir-editar"
    // numa pagina do menu (Configuracoes...) nada vai ao ar: Enter abre o show em Mostrar, Ctrl+Enter poe no roteiro
    if (tela === "pagina") return alternativa ? "roteiro" : "abrir-show"
    return alternativa ? "tocar" : "roteiro"
}

/** o segundo Enter no mesmo resultado em menos de `ESPERA_ENTER_MS` nao faz nada */
export function enterRepetido(ultimo: { chave: string; em: number } | null | undefined, chave: string, agora: number, esperaMs = ESPERA_ENTER_MS): boolean {
    return !!ultimo && ultimo.chave === chave && agora - ultimo.em < esperaMs
}

/**
 * A lista na tela e a da consulta que esta ESCRITA? Enter so executa se sim: a busca espera 90 ms depois da ultima tecla, e o Enter que chega
 * antes disso pegaria o resultado da consulta anterior ("jo 3 1" no lugar de "jo 3 16"). Campo vazio nunca libera.
 */
export function listaEmDia(consulta: string, consultaDaLista: string, pendente: boolean): boolean {
    const q = consulta.trim()
    return !!q && !pendente && q === consultaDaLista.trim()
}

/** o indice do resultado selecionado, achado pela chave (a lista ganha secoes no meio do caminho e o indice muda; a identidade nao). Sem chave ou sumiu: o topo */
export function indiceDaChave(lista: { chave: string }[], chave: string | null): number {
    if (chave === null) return 0
    const i = lista.findIndex((r) => r.chave === chave)
    return i < 0 ? 0 : i
}

/**
 * O que fazer com uma tecla enquanto a busca esta aberta e o foco ESCAPOU do campo (clique na barra de rolagem, num titulo, na barra de dicas...).
 * No campo o fluxo normal segue. Fora dele o teclado do telao (Esc que limpa, setas e espaco que avancam, letras de atalho) nao pode agir: Esc fecha a
 * busca, o resto e engolido. So modificador sozinho e Tab passam.
 */
export function destinoDaTecla(e: { key: string; ctrl: boolean; alt: boolean }, focoNoCampo: boolean): "deixar" | "fechar" | "engolir" {
    if (focoNoCampo) return "deixar"
    if (e.key === "Escape") return "fechar"
    if (["Control", "Shift", "Alt", "Meta", "Tab", "CapsLock"].includes(e.key)) return "deixar"
    return "engolir"
}

/** quanto tempo depois de executar um resultado o Enter que sobrar (auto-repeat, segundo toque nervoso) e engolido: o foco ja caiu no body e ele iria ao `Scripture.svelte` */
export const ESPERA_POS_FECHAR_MS = 600
export function enterDepoisDeFechar(ultimaExecucaoEm: number | null, agora: number, aberta: boolean, esperaMs = ESPERA_POS_FECHAR_MS): boolean {
    return !aberta && ultimaExecucaoEm !== null && agora - ultimaExecucaoEm < esperaMs
}

/** a seta anda sem dar a volta (parar no fim e a regra da lista do app); lista vazia = -1 */
export function andar(atual: number, passo: number, total: number): number {
    if (total <= 0) return -1
    return Math.max(0, Math.min(total - 1, atual + passo))
}

/** quantos resultados cabem por secao (a busca nao e a biblioteca: o resto se acha refinando o texto) */
export const MAXIMO_POR_SECAO = { show: 8, midia: 5, audio: 5, acao: 5 } as const

export type SecaoDoSpotlight = { id: "versiculo" | "show" | "midia" | "audio" | "acao"; titulo: string }
// a ordem e FIXA e as secoes que leem disco (midia, audio) ficam por ultimo: quando chegam tarde entram ABAIXO do que ja estava pintado
export const SECOES: SecaoDoSpotlight[] = [
    { id: "versiculo", titulo: "Versículo" },
    { id: "show", titulo: "Músicas e apresentações" },
    { id: "acao", titulo: "Ações" },
    { id: "midia", titulo: "Mídia" },
    { id: "audio", titulo: "Áudio" }
]
