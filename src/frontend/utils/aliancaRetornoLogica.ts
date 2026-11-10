// AliançaShow: modo "Só no Retorno" (pacote Saídas, fatia 1) — a parte pura.
//
// Com o modo ligado, o que o operador clica vai só para o palco (Retorno da
// banda, monitor do pregador). O público não vê nem ouve nada mudar.
//
// Como funciona:
// - Existe uma saída escondida, a "Fonte do Retorno" (`retornoFonte: true`).
//   Ela NÃO tem janela: os layouts de palco leem o `out` dela pelo store.
// - Ela só fica habilitada enquanto o modo está ligado. Desligada, sai de
//   todos os filtros (todos exigem `enabled`), e o modo normal fica idêntico
//   ao FreeShow.
// - Ligar: habilita a Fonte com uma CÓPIA do que o palco mostrava, aponta os
//   layouts de palco em uso para ela e trava as saídas de público. O que foi
//   mudado fica guardado na própria Fonte (`retornoModo`), que é salva em disco.
// - Desligar: desfaz exatamente isso. Nada é reenviado (nenhuma ação dispara).
//
// Aqui não há store nem I/O: tudo recebe o mapa de saídas e devolve um novo.
// Quem aplica é `aliancaRetorno.ts`.

import type { Output, Outputs, RegistroSoRetorno } from "../../types/Output"
import type { StageLayouts } from "../../types/Stage"

export const NOME_FONTE = "Fonte do Retorno"
export const COR_SO_RETORNO = "#ff8a00"

type SaidaComId = Output & { id: string }

const porNome = (a: SaidaComId, b: SaidaComId) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true, sensitivity: "base" })

function comIds(outs: Outputs | null | undefined): SaidaComId[] {
    return Object.entries(outs || {})
        .filter(([, o]) => !!o)
        .map(([id, o]) => ({ ...o, id }))
}

const copia = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))

export function ehFonteDoRetorno(output: Partial<Output> | null | undefined): boolean {
    return !!output?.retornoFonte
}

export function idDaFonte(outs: Outputs | null | undefined): string {
    return Object.keys(outs || {}).find((id) => outs![id]?.retornoFonte) || ""
}

export function modoSoRetornoLigado(outs: Outputs | null | undefined): boolean {
    const id = idDaFonte(outs)
    return !!id && outs![id].enabled === true
}

/** saídas que o público vê: habilitadas, sem as de palco e sem a Fonte do Retorno, em ordem de nome */
export function saidasDePrograma(outs: Outputs | null | undefined): SaidaComId[] {
    return comIds(outs)
        .filter((o) => o.enabled === true && !o.stageOutput && !o.retornoFonte)
        .sort(porNome)
}

/**
 * A primeira saída de programa. Com o modo ligado todas estão travadas, então
 * vale a trava de ANTES do modo: o resultado é o mesmo que daria com o modo
 * desligado. `ignorarTrava` = a primeira por nome (o fallback do palco).
 */
export function primeiraSaidaDePrograma(outs: Outputs | null | undefined, opcoes: { ignorarTrava?: boolean } = {}): SaidaComId | null {
    const lista = saidasDePrograma(outs)
    if (!lista.length) return null
    if (opcoes.ignorarTrava) return lista[0]

    const registro = modoSoRetornoLigado(outs) ? outs![idDaFonte(outs)].retornoModo : undefined
    const estavaAtiva = (o: SaidaComId) => (registro && o.id in registro.travas ? registro.travas[o.id] : o.active === true)
    return lista.find(estavaAtiva) || lista[0]
}

/** os layouts de palco que estão numa saída de palco habilitada (decisão 3: todos seguem o modo) */
export function layoutsDePalcoEmUso(outs: Outputs | null | undefined, stageShows: StageLayouts | null | undefined): string[] {
    const ids = comIds(outs)
        .filter((o) => o.enabled === true && typeof o.stageOutput === "string" && o.stageOutput)
        .map((o) => o.stageOutput as string)
    return [...new Set(ids)].filter((id) => !!stageShows?.[id])
}

export type ResultadoLigar = { ok: true; outputs: Outputs; stageShows: StageLayouts; fonteId: string } | { ok: false; motivo: string }

export function ligarSoRetorno(outs: Outputs, stageShows: StageLayouts, opcoes: { novoId: string; agora: number }): ResultadoLigar {
    if (modoSoRetornoLigado(outs)) return { ok: false, motivo: "O modo Só no Retorno já está ligado." }

    const layouts = layoutsDePalcoEmUso(outs, stageShows)
    if (!layouts.length) return { ok: false, motivo: "Não há saída de palco ligada para receber o Só no Retorno." }

    const novasSaidas = copia(outs)
    const novosLayouts = copia(stageShows)
    const fonteId = idDaFonte(outs) || opcoes.novoId

    // de onde copiar: a fonte que o 1º layout já usava, senão a 1ª saída de programa
    const programa = saidasDePrograma(outs)
    const fonteDoPalco = layouts.map((id) => stageShows[id]?.settings?.output).find((id) => !!id && programa.some((o) => o.id === id))
    const origem = (fonteDoPalco && outs[fonteDoPalco]) || primeiraSaidaDePrograma(outs, { ignorarTrava: true })

    // guarda e trava as saídas de público
    const travas: RegistroSoRetorno["travas"] = {}
    programa.forEach(({ id }) => {
        travas[id] = novasSaidas[id].active === true
        novasSaidas[id].active = false
    })

    // guarda e reaponta os layouts de palco
    const fontes: RegistroSoRetorno["fontes"] = {}
    layouts.forEach((id) => {
        const settings = novosLayouts[id].settings || (novosLayouts[id].settings = {})
        fontes[id] = settings.output || null
        settings.output = fonteId
    })

    const anterior = novasSaidas[fonteId] || ({} as Output)
    const fonte: Output = {
        ...anterior,
        name: NOME_FONTE,
        color: COR_SO_RETORNO,
        enabled: true,
        active: true,
        retornoFonte: true,
        invisible: true,
        hideFromPreview: true,
        screen: null,
        bounds: copia(origem?.bounds) || { x: 0, y: 0, width: 1920, height: 1080 },
        out: copia(origem?.out) || {},
        retornoModo: { travas, fontes, desde: opcoes.agora }
    }
    if (origem?.style) fonte.style = origem.style
    else delete fonte.style
    novasSaidas[fonteId] = fonte

    return { ok: true, outputs: novasSaidas, stageShows: novosLayouts, fonteId }
}

export type ResultadoDesligar = { outputs: Outputs; stageShows: StageLayouts } | null

/** desfaz o `ligarSoRetorno`. Devolve null se não havia nada para desfazer. */
export function desligarSoRetorno(outs: Outputs, stageShows: StageLayouts): ResultadoDesligar {
    const fonteId = idDaFonte(outs)
    if (!fonteId) return null
    const fonteAtual = outs[fonteId]
    if (!fonteAtual.enabled && !fonteAtual.retornoModo) return null

    const novasSaidas = copia(outs)
    const novosLayouts = copia(stageShows || {})
    const registro: RegistroSoRetorno = fonteAtual.retornoModo || { travas: {}, fontes: {}, desde: 0 }

    // travas como estavam
    Object.entries(registro.travas).forEach(([id, ativa]) => {
        if (novasSaidas[id]) novasSaidas[id].active = ativa
    })
    // nunca deixar o público sem nenhuma saída destravada
    const programa = saidasDePrograma(novasSaidas)
    if (programa.length && !programa.some((o) => o.active === true)) novasSaidas[programa[0].id].active = true

    // layouts de palco de volta para a fonte de antes
    Object.entries(novosLayouts).forEach(([id, layout]) => {
        if (layout?.settings?.output !== fonteId) return
        const antes = registro.fontes[id]
        if (antes && novasSaidas[antes]) layout.settings.output = antes
        else delete layout.settings.output
    })

    const fonte = novasSaidas[fonteId]
    fonte.enabled = false
    fonte.active = false
    fonte.out = {}
    delete fonte.retornoModo

    return { outputs: novasSaidas, stageShows: novosLayouts }
}

/**
 * O que "Limpar tudo" faz com o modo ligado.
 * - pelo botão da barra: limpa só o Retorno (imagem; som e timers do salão ficam);
 * - pelo Esc (e qualquer outro pânico): desliga o modo e limpa tudo, salão e Retorno (decisão 1).
 */
export function planoDoLimparTudo(outs: Outputs | null | undefined, peloBotao: boolean): "normal" | "so_retorno" | "desligar_e_limpar" {
    if (!modoSoRetornoLigado(outs)) return "normal"
    return peloBotao ? "so_retorno" : "desligar_e_limpar"
}

// ativações de ações que vêm de um clique de saída. No modo, nenhuma dispara (clique = Alt).
const ATIVACOES_DO_CLIQUE = new Set(["output_changed", "slide_click", "group_start", "pdf_start", "scripture_start", "slide_cleared", "background_cleared"])

export function ativacaoSilenciada(ativacao: string, outs: Outputs | null | undefined): boolean {
    return ATIVACOES_DO_CLIQUE.has(ativacao) && modoSoRetornoLigado(outs)
}

/** vídeo e player online tocam som pelo player da janela principal: no modo, não vão só para o palco */
export function fundoComSom(tipo: string | undefined): boolean {
    return tipo === "video" || tipo === "player"
}
