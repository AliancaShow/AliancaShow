// Modo "so retorno" (fatia 8): o estado e os dois gestos (ligar/desligar). A parte pura vive em aliancaSoRetornoLogica.ts.
// Fica ligado ate o operador desligar (sem timer, sem desligar sozinho). Nao e persistido: uma sessao nova nasce desligada, e o
// `iniciarSoRetorno` devolve qualquer `settings.output` que uma queda tenha deixado trocado.
import { get, writable } from "svelte/store"
import { outputs, stageShows } from "../stores"
import { devolverFonte, idsDeRetorno, porQueNaoLigar, temMarca, trocarFonte } from "./aliancaSoRetornoLogica"

/** O `setOutput` consulta o modo? Vira true junto com o ajuste aprovado de `components/helpers/output.ts` (fecho da saida, ancora). */
export const SAIDA_RESPEITA_MODO = false

export const soRetorno = writable(false)

export const retornosLigados = () => idsDeRetorno(get(outputs) as any)
export const porQueNaoLigarSoRetorno = () => porQueNaoLigar(retornosLigados(), SAIDA_RESPEITA_MODO)

/** ids para onde o envio ao ar vai AGORA: o retorno com o modo ligado; `null` = comportamento normal (o `setOutput` nao muda nada) */
export function destinoDoEnvio(): string[] | null {
    return get(soRetorno) ? retornosLigados() : null
}

export function ligarSoRetorno(): { ok: boolean; motivo: string } {
    const motivo = porQueNaoLigarSoRetorno()
    if (motivo) return { ok: false, motivo }
    const ids = retornosLigados()
    const o = get(outputs) as any
    stageShows.update(
        (s) =>
            trocarFonte(
                s as any,
                ids.map((id) => ({ id, layout: o[id].stageOutput }))
            ) as any
    )
    soRetorno.set(true)
    return { ok: true, motivo: "" }
}

/** desliga, devolve a fonte do layout e tira do retorno o que o modo mandou (o telao nao e tocado) */
export function desligarSoRetorno() {
    if (!get(soRetorno)) return
    const ids = retornosLigados()
    soRetorno.set(false)
    stageShows.update((s) => devolverFonte(s as any) as any)
    outputs.update((a: any) => {
        for (const id of ids) if (a[id]?.out) a[id].out = { ...a[id].out, slide: null, background: null }
        return a
    })
}

/** na partida (e quando os layouts terminam de carregar): devolve o que uma queda com o modo ligado deixou trocado. Devolve quem cancela a assinatura */
export function iniciarSoRetorno(): () => void {
    return stageShows.subscribe((s) => {
        if (!get(soRetorno) && temMarca(s as any)) stageShows.update((x) => devolverFonte(x as any) as any)
    })
}
