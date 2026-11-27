// AliancaShow (cabine 27/nov): o que a biblioteca de Shows mostra alem do nome, para distinguir musicas de mesmo nome e achar a certa:
// o cantor (meta.artist), quando a musica foi ao ar pela ultima vez e quando foi criada. A lista leve (`shows`) traz o cantor em
// `quickAccess.artista` (lido no Electron, trimShow); o show ja aberto (`showsCache`) tem o valor mais novo e vence.

export type ShowLeve = { name?: string; category?: string | null; timestamps?: { created?: number | null; used?: number | null; modified?: number | null }; quickAccess?: any } | undefined
export type ShowCheio = { meta?: { artist?: string }; timestamps?: { created?: number | null; used?: number | null } } | undefined

export function artistaDoShow(leve: ShowLeve, cheio?: ShowCheio): string {
    const doCache = cheio?.meta?.artist
    if (typeof doCache === "string") return doCache.trim()
    const daLista = leve?.quickAccess?.artista
    return typeof daLista === "string" ? daLista.trim() : ""
}

export function usadoEm(leve: ShowLeve, cheio?: ShowCheio): number {
    return Number(cheio?.timestamps?.used || leve?.timestamps?.used || 0) || 0
}

export function criadoEm(leve: ShowLeve, cheio?: ShowCheio): number {
    return Number(cheio?.timestamps?.created || leve?.timestamps?.created || 0) || 0
}

/** "hoje", "ontem", "há 5 dias" ate uma semana; depois dd/mm/aaaa. Sem data: "" */
export function quandoFoi(ms: number, agora = Date.now()): string {
    if (!ms) return ""
    const d = new Date(ms)
    const hoje = new Date(agora)
    hoje.setHours(0, 0, 0, 0)
    const dia = new Date(ms)
    dia.setHours(0, 0, 0, 0)
    const dias = Math.round((hoje.getTime() - dia.getTime()) / 86400000)
    if (dias === 0) return "hoje"
    if (dias === 1) return "ontem"
    if (dias > 1 && dias < 7) return `há ${dias} dias`
    const dois = (n: number) => String(n).padStart(2, "0")
    return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`
}

export type OrdemDosShows = "nome" | "nome_des" | "cantor" | "cantor_des" | "usado" | "usado_asc" | "criado" | "criado_asc"
export type ColunaDosShows = "nome" | "cantor" | "usado" | "criado"

/** clicar numa coluna: a primeira vez usa o sentido natural (nome A-Z, datas mais novas primeiro); de novo, inverte */
export function proximaOrdem(atual: OrdemDosShows, coluna: ColunaDosShows): OrdemDosShows {
    const natural: OrdemDosShows = coluna === "nome" ? "nome" : coluna === "cantor" ? "cantor" : coluna === "usado" ? "usado" : "criado"
    const inversa = (coluna === "nome" ? "nome_des" : coluna === "cantor" ? "cantor_des" : coluna === "usado" ? "usado_asc" : "criado_asc") as OrdemDosShows
    return atual === natural ? inversa : natural
}

export type LinhaOrdenavel = { nome: string; cantor: string; usado: number; criado: number }

/** ordena sem mexer no original; vazios (sem cantor, nunca usada) sempre no fim; empate desempata pelo nome */
export function ordenarShows<T extends LinhaOrdenavel>(linhas: T[], ordem: OrdemDosShows): T[] {
    const porNome = (a: T, b: T) => a.nome.localeCompare(b.nome, "pt", { sensitivity: "base" })
    const texto = (a: string, b: string, inverte: boolean) => {
        if (!a && !b) return 0
        if (!a) return 1
        if (!b) return -1
        const r = a.localeCompare(b, "pt", { sensitivity: "base" })
        return inverte ? -r : r
    }
    const data = (a: number, b: number, novoPrimeiro: boolean) => {
        if (!a && !b) return 0
        if (!a) return 1
        if (!b) return -1
        return novoPrimeiro ? b - a : a - b
    }
    const cmp = (a: T, b: T): number => {
        switch (ordem) {
            case "nome_des":
                return -porNome(a, b)
            case "cantor":
            case "cantor_des":
                return texto(a.cantor, b.cantor, ordem === "cantor_des") || porNome(a, b)
            case "usado":
            case "usado_asc":
                return data(a.usado, b.usado, ordem === "usado") || porNome(a, b)
            case "criado":
            case "criado_asc":
                return data(a.criado, b.criado, ordem === "criado") || porNome(a, b)
            default:
                return porNome(a, b)
        }
    }
    return [...linhas].sort(cmp)
}
