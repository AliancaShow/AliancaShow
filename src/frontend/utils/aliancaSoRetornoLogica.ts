// Modo "so retorno" (leiaute v2, fatia 8, decisao 5): a parte pura. Enquanto ligado, o que vai ao ar (clique em slide, ▶, Mostrar agora,
// setas) vai SO para o monitor de retorno; o telao nao muda. Esc continua limpando o telao.
//
// Como o FreeShow identifica o retorno: uma saida HABILITADA com `stageOutput` (o id do layout de palco que ela desenha). O layout de palco
// le o slide da saida normal ativa, ou de `settings.output` quando ele aponta uma saida. Para o retorno mostrar uma coisa e o telao outra,
// o modo faz `settings.output` do layout apontar para a PROPRIA saida de retorno (e escreve o slide nela); ao desligar devolve o valor de antes.

export type SaidaMinima = { enabled?: boolean; stageOutput?: string; invisible?: boolean; name?: string }

/** ids das saidas de retorno habilitadas (palco), na ordem do cadastro */
export function idsDeRetorno(outs: { [id: string]: SaidaMinima } | null | undefined): string[] {
    return Object.entries(outs || {})
        .filter(([, o]) => !!o && o.enabled === true && !!o.stageOutput)
        .map(([id]) => id)
}

/** Por que o botao nao pode ligar ("" = pode) */
export function porQueNaoLigar(retornos: string[]): string {
    if (!retornos.length) return "Nenhum monitor de retorno ligado. Configure em Telas e monitor de retorno."
    return ""
}

/** o pedido ao `setOutput` VAI AO AR? (limpeza = dado nulo/vazio nunca e desviada: Esc e Limpar atuam no telao) */
export const ehEnvio = (data: unknown): boolean => data !== null && data !== undefined && !(Array.isArray(data) && !data.length)

/**
 * O destino do envio. `desvia: false` = comportamento de sempre (o `setOutput` nao muda nada). Com `desvia: true` o destino sao SO os retornos
 * (`ids`, que pode vir vazio: o retorno sumiu e o envio e descartado, nunca cai no telao).
 */
export function roteamento(modo: boolean, desvio: number, retornos: string[], data: unknown): { desvia: boolean; ids: string[] } {
    if (!modo || desvio > 0 || !ehEnvio(data)) return { desvia: false, ids: [] }
    return { desvia: true, ids: retornos }
}

/**
 * D1 (decisao do coordenador): o modo "so retorno" aceita SO slide de texto (letra/versiculo: o caso de uso da banda ver a letra antes da igreja).
 * Midia (fundo/video), PDF/PowerPoint, audio, sobreposicao, efeito e temporizador de pasta sao RECUSADOS (e ditos alto) em todos os caminhos.
 * `temVideo`: o slide de texto traz um item de video (o tocador nao pode nascer no retorno).
 */
export const aceitaNoModo = (type: string, data: any, temVideo = false): boolean => type === "slide" && !!data && (data.type === undefined || data.type === "show") && !temVideo

/** o que foi recusado, em palavras curtas, para a mensagem */
export function oQueRecusou(type: string, data: any, temVideo = false): string {
    if (type === "slide") return data?.type === "pdf" ? "PDF" : data?.type === "ppt" ? "apresentação" : temVideo ? "vídeo" : "mídia"
    return type === "overlays" ? "sobreposição" : type === "effects" ? "efeito" : "mídia"
}

export const motivoDaRecusa = (oQue: string): string => `Só retorno: só letra vai para o retorno — desligue o modo para mandar ${oQue}`

/** de que saida as setas leem "o slide atual": no modo, do retorno */
export const idDeLeitura = (modo: boolean, retornos: string[], id: string): string => (modo && retornos.length ? retornos[0] : id)

/** o `out` de um retorno vazio (tudo o que o modo escreveu sai; o telao nunca passa por aqui) */
export const outVazio = () => ({ slide: null, background: null, overlays: [], effects: [], transition: null })

/** o slide que o telao mostra agora (o retorno e semeado com ele ao ligar: o monitor do pastor nao apaga) */
export function slideDoTelao(outs: { [id: string]: any } | null | undefined): any {
    const normais = Object.values(outs || {}).filter((o: any) => !!o && o.enabled === true && !o.stageOutput && !o.isKeyOutput)
    const ativas = normais.filter((o: any) => o.active === true)
    for (const o of (ativas.length ? ativas : normais) as any[]) if (o.out?.slide) return o.out.slide
    return null
}

export const MARCA = "aliancaSoRetorno"
type Layouts = { [id: string]: any }

/** aponta a fonte de cada layout de retorno para a propria saida; guarda o valor de antes na marca (so a primeira vez) */
export function trocarFonte(stageShows: Layouts, retornos: { id: string; layout: string }[]): Layouts {
    const novo: Layouts = { ...stageShows }
    for (const r of retornos) {
        const l = novo[r.layout]
        if (!l) continue
        const antes = l.settings?.[MARCA] ? l.settings[MARCA].antes : (l.settings?.output ?? null)
        novo[r.layout] = { ...l, settings: { ...(l.settings || {}), output: r.id, [MARCA]: { antes } } }
    }
    return novo
}

/** devolve `settings.output` ao que era; layout sem marca fica como esta */
export function devolverFonte(stageShows: Layouts): Layouts {
    const novo: Layouts = { ...stageShows }
    for (const [id, l] of Object.entries(stageShows)) {
        const marca = (l as any)?.settings?.[MARCA]
        if (!marca) continue
        const { [MARCA]: _m, output: _o, ...resto } = (l as any).settings
        novo[id] = { ...(l as any), settings: marca.antes ? { ...resto, output: marca.antes } : resto }
    }
    return novo
}

/** o que o retorno mostra, em palavras curtas (a coluna "No ar" avisa enquanto o modo esta ligado: o operador nao manda as cegas) */
export function descreverRetorno(outs: { [id: string]: any } | null | undefined, nomeDoShow: (id: string) => string): string {
    const id = idsDeRetorno(outs as any)[0]
    const out = (id && outs?.[id]?.out) || {}
    if (out.slide?.id) {
        const nome = nomeDoShow(out.slide.id) || (out.slide.type === "pdf" ? "PDF" : "slide")
        return `${nome}${typeof out.slide.index === "number" ? " · slide " + (out.slide.index + 1) : ""}`
    }
    if (out.background) return "mídia"
    return "nada"
}

/** o que o modo diz na faixa e na pilula */
export const ROTULO_FAIXA = "SÓ RETORNO"
export const SUBTITULO_FAIXA = "o telão não muda"

export const temMarca = (stageShows: Layouts): boolean => Object.values(stageShows || {}).some((l: any) => !!l?.settings?.[MARCA])
