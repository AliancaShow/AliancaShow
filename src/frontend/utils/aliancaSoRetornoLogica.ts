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

/**
 * Por que o botao nao pode ligar ("" = pode).
 * `saidaRespeita`: o `setOutput` desta versao consulta o modo? (so depois do ajuste aprovado em output.ts; sem ele ligar seria mentira)
 */
export function porQueNaoLigar(retornos: string[], saidaRespeita: boolean): string {
    if (!retornos.length) return "Nenhum monitor de retorno ligado. Configure em Telas e monitor de retorno."
    if (!saidaRespeita) return "Ainda não ligado à saída: falta o ajuste em output.ts (aguardando aprovação)."
    return ""
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

/** o que o modo diz na faixa e na pilula */
export const ROTULO_FAIXA = "SÓ RETORNO"
export const SUBTITULO_FAIXA = "o telão não muda"

export const temMarca = (stageShows: Layouts): boolean => Object.values(stageShows || {}).some((l: any) => !!l?.settings?.[MARCA])
