// 1b, D7 + D8: a conta pura da moldura de pagina do Preparar e da lista branca de paginas. Sem store, sem DOM, sem import: este arquivo
// entra no fecho da janela de saida (via startup.ts) e nao pode ter efeito.
// Nao existe modo antigo: no Culto `molduraDaPagina` devolve `null` e `paginaPermitida` libera tudo, como sempre foi.

/** as unicas paginas que o operador alcanca no Preparar (Q14). Tem de ser igual a `PAGINAS_DA_BUSCA_NO_PREPARAR` (teste). */
export const PAGINAS_DO_PREPARAR = ["show", "edit", "stage", "settings"] as const
export type PaginaDoPreparar = (typeof PAGINAS_DO_PREPARAR)[number]

/** paginas que "lembram de onde vieram" para o Voltar (D7) */
export const PAGINAS_COM_VOLTA = ["stage", "settings"] as const

export type TipoDeMoldura = "editor" | "pagina" | "fora"
export type Moldura = { tipo: TipoDeMoldura; titulo: string; rotuloVoltar: string }

export const ROTULO_VOLTAR = "← Voltar"
export const ROTULO_VOLTAR_AO_CULTO = "← Voltar ao culto"
export const ROTULO_VOLTAR_A_BIBLIOTECA = "← Voltar à biblioteca"

const TITULOS: Record<string, string> = { stage: "Monitor de retorno", settings: "Configurações" }

export function paginaPermitida(modo: string, pagina: unknown): boolean {
    if (modo !== "preparar") return true
    return (PAGINAS_DO_PREPARAR as readonly unknown[]).includes(pagina)
}

/** o texto do toast quando a pagina e recusada no Preparar */
export function textoDaRecusa(pagina: unknown): string {
    return pagina === "draw" || pagina === "scripture" ? "Desenhar e Bíblia em tela cheia ficam no Culto." : "Essa página não abre no Preparar."
}

/**
 * Que moldura a barra do Preparar mostra. `null` = a barra de culto (pagina `show`) ou o Culto (nada monta moldura la).
 * `fora` nunca fica sem Voltar: dura no maximo ate o redirecionamento de D8 (se ele nao acontecer, Q15 acende a faixa).
 */
export function molduraDaPagina({ modo, pagina, abaLateral }: { modo: string; pagina: unknown; abaLateral?: string }): Moldura | null {
    if (modo !== "preparar") return null
    if (pagina === "show") return null
    if (pagina === "edit") return { tipo: "editor", titulo: "", rotuloVoltar: abaLateral === "biblioteca" ? ROTULO_VOLTAR_A_BIBLIOTECA : ROTULO_VOLTAR_AO_CULTO }
    if (pagina === "stage" || pagina === "settings") return { tipo: "pagina", titulo: TITULOS[pagina], rotuloVoltar: ROTULO_VOLTAR }
    return { tipo: "fora", titulo: "", rotuloVoltar: ROTULO_VOLTAR }
}

/** para onde o Voltar leva: a origem se for permitida e diferente da atual; senao `show`. O alvo de `edit` e sempre `show`. */
export function alvoDeVoltar({ pagina, anterior }: { pagina: unknown; anterior: unknown }): PaginaDoPreparar {
    if (pagina === "edit") return "show"
    if (anterior !== pagina && (PAGINAS_DO_PREPARAR as readonly unknown[]).includes(anterior)) return anterior as PaginaDoPreparar
    return "show"
}

/**
 * Quem e a `paginaAnterior` depois de uma troca de pagina. So o Preparar lembra; so `stage` e `settings` pedem a volta;
 * ir para `show` ou `edit` esquece (nada la volta para outro lugar).
 */
export function paginaAnteriorDepois({ modo, de, para, atual }: { modo: string; de: unknown; para: unknown; atual: string | null }): string | null {
    if (modo !== "preparar") return null
    if (!(PAGINAS_COM_VOLTA as readonly unknown[]).includes(para)) return null
    if (de !== para && (PAGINAS_DO_PREPARAR as readonly unknown[]).includes(de)) return de as string
    return atual
}

// ---------------------------------------------------------------- crumb do editor

/** o tipo que o crumb mostra; `null` para um tipo que o leiaute nao conhece (o chamador faz falhaAlta) */
export function tipoDoCrumb(tipo: string | undefined, ehMusica: boolean): string | null {
    switch (tipo || "show") {
        case "show":
            return ehMusica ? "Música" : "Apresentação"
        case "media":
        case "camera":
            return "Mídia"
        case "template":
            return "Modelo"
        case "overlay":
            return "Sobreposição"
        case "effect":
            return "Efeito"
        case "audio":
            return "Áudio"
        default:
            return null
    }
}

/**
 * `<Tipo> · <nome> · slide N de M` (`slide` e indice de zero). So Musica e Apresentacao (o show) tem slides: sem slide ou sem layout, `sem slides`.
 * Midia, audio, modelo, sobreposicao e efeito nao tem a 3a parte (`Midia · foto.jpg`). `null` se o tipo e desconhecido.
 */
export function textoDoCrumb({ tipo, nome, slide, total, ehMusica }: { tipo: string | undefined; nome: string; slide: number | undefined; total: number; ehMusica: boolean }): string | null {
    const t = tipoDoCrumb(tipo, ehMusica)
    if (t === null) return null
    const ehShow = (tipo || "show") === "show"
    if (!ehShow) return `${t} · ${nome}`
    const temSlide = typeof slide === "number" && slide >= 0 && total > 0
    return `${t} · ${nome} · ${temSlide ? `slide ${slide + 1} de ${total}` : "sem slides"}`
}

/** o nome do que esta aberto no editor (o show aberto e o `activeShow`; `id` e o caminho para midia/audio, o id para o resto) */
export function nomeDoEditado(edit: { type?: string; id?: string } | null | undefined, fontes: { activeShowId?: string; shows: any; templates: any; overlays: any; effects: any }): string {
    if (!edit) return ""
    const tipo = edit.type || "show"
    const semCaminho = (p: string) => decodeURIComponent(String(p).split(/[\\/]/).pop() || "")
    if (tipo === "show") return fontes.shows?.[fontes.activeShowId || ""]?.name || ""
    if (tipo === "template") return fontes.templates?.[edit.id || ""]?.name || ""
    if (tipo === "overlay") return fontes.overlays?.[edit.id || ""]?.name || ""
    if (tipo === "effect") return fontes.effects?.[edit.id || ""]?.name || ""
    return edit.id ? semCaminho(edit.id) : ""
}
