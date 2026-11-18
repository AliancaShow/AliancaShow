// Cabine 18/nov (A8): o seletor de dia tambem lista os proximos cultos do Sirvo que ainda nao tem projeto aqui (a MESMA lista de Configuracoes > Sirvo,
// `sirvo.cultos`). Escolher um deles SEGUE o culto (`escolherCultoSirvo`): a montagem do Sirvo cria o projeto sozinha quando o roteiro chega, e este
// arquivo abre esse projeto. A conta pura esta em `aliancaSeletorLogica.ts` (`gruposSoNoSirvo`); aqui moram o relogio, o fuso e o store.
import { get } from "svelte/store"
import { projects } from "../stores"
import { escolherCultoSirvo, sirvo } from "./aliancaSirvo"
import { dataDoCulto, projetoLigadoAoCulto } from "./aliancaPastas"
import { newToast } from "./common"
import { gruposSoNoSirvo, PREFIXO_SO_NO_SIRVO, type CultoDoSirvo, type GrupoDeDias, type OpcaoDeDia } from "./aliancaSeletorLogica"

const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
/** "10h" ou "19h30" (Sao Paulo); "" se nao for data */
export function horaDoCulto(comecaEm: string): string {
    const t = Date.parse(comecaEm)
    if (isNaN(t)) return ""
    const [h, m] = fmtHora.format(new Date(t)).split(":")
    return m === "00" ? `${h}h` : `${h}h${m}`
}

/** o grupo "No Sirvo" para o popover: cultos futuros sem projeto ligado e sem projeto local na mesma data */
export function gruposDoSirvo(cultos: CultoDoSirvo[], projetos: { [id: string]: any }, locais: OpcaoDeDia[], hoje: string): GrupoDeDias[] {
    const ligados = new Set<string>()
    for (const p of Object.values(projetos)) if (p && !p.deleted && p.sirvo?.eventId) ligados.add(p.sirvo.eventId)
    const datasLocais = new Set(locais.map((o) => o.cultoId).filter(Boolean))
    return gruposSoNoSirvo({ cultos, ligados, datasLocais, hoje, dataDoCulto, horaDoCulto })
}

export const ehSoNoSirvo = (id: string) => id.startsWith(PREFIXO_SO_NO_SIRVO)
const AGUARDA_MS = 15_000

/**
 * Segue o culto e abre o projeto quando ele nasce. Recusa (com aviso) enquanto o culto seguido esta no ar: trocar o culto seguido no meio do culto
 * mudaria o relogio e as variaveis do palco. Nunca escreve em `outputs`.
 */
export function seguirCultoEAbrir(idDaOpcao: string, abrir: (projetoId: string) => void): void {
    const eventId = idDaOpcao.slice(PREFIXO_SO_NO_SIRVO.length)
    if (get(sirvo).roteiroNoAr) return void newToast("Há um culto no ar. Troque o culto seguido em Configurações > Sirvo depois que ele terminar.")
    escolherCultoSirvo(eventId)
    newToast("Seguindo o culto no Sirvo: o projeto abre quando o roteiro chegar.")
    let feito = false
    let parar: (() => void) | undefined
    const fim = (projetoId: string | null) => {
        if (feito) return
        feito = true
        clearTimeout(limite)
        parar?.()
        if (projetoId) abrir(projetoId)
        else newToast("O roteiro desse culto não chegou. Veja Configurações > Sirvo.")
    }
    const limite = setTimeout(() => fim(null), AGUARDA_MS)
    parar = projects.subscribe((todos) => {
        const id = projetoLigadoAoCulto(todos as any, eventId)
        if (id) queueMicrotask(() => fim(id))
    })
    // a assinatura ja pode ter achado antes de `parar` existir: queueMicrotask cuida de chamar depois
}
