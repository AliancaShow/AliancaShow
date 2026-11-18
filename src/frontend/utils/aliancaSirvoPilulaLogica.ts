// Pilula Sirvo (leiaute v2): a logica de `calcular` que vivia em SirvoIndicador.svelte, levada sem mudar de regra. Pura: so le o que
// recebe (o relogio e `adiadaDesde` entram por parametro). Texto do Sirvo so por interpolacao {...} no componente, nunca {@html}.
import type { Readable } from "svelte/store"
import { intervaloRev, type sirvo } from "./aliancaSirvo"
import type { sirvoMaterialEstado } from "./aliancaSirvoMaterial"

type Val<T> = T extends Readable<infer U> ? U : never
export type EstadoSirvo = Val<typeof sirvo>
export type CultoSirvo = EstadoSirvo["cultos"][number] | null
export type MaterialSirvo = Val<typeof sirvoMaterialEstado>

const fmtDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" })
const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
export function quando(iso: string): string {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ""
    const [h, m] = fmtHora.format(d).split(":")
    return `${fmtDia.format(d).replace(/\.,?/g, "").replace(",", "")} ${h}h${m === "00" ? "" : m}`
}

// dia no fuso da igreja, "2026-11-08", para comparar só a data
const fmtDiaIso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
function jaPassou(iso: string, t: number): boolean {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return false
    return fmtDiaIso.format(d) < fmtDiaIso.format(new Date(t))
}

function minutos(ms: number): string {
    const min = Math.floor(ms / 60_000)
    return min < 1 ? "há instantes" : `há ${min} min`
}

export type Visual = { tom: "verde" | "cinza" | "laranja" | "vermelho"; texto: string; dica: string; clicavel: boolean }

function materialTexto(m: MaterialSirvo): { texto: string; dica: string; falhou: boolean } {
    if (m.falhas.length) {
        const n = m.falhas.length
        const nomes = m.falhas.map((f) => f.nome).join(", ")
        return { texto: ` · ${n} ${n === 1 ? "arquivo falhou" : "arquivos falharam"}`, dica: ` Material do Sirvo que não baixou (o Show tenta de novo sozinho, aos poucos: 1, 5, 15 e 60 min): ${nomes}.`, falhou: true }
    }
    if (m.baixando || m.naFila) return { texto: ` · baixando ${m.lote.feitos} de ${m.lote.total}`, dica: " Baixando o material da semana enviado pelo Sirvo.", falhou: false }
    return { texto: "", dica: "", falhou: false }
}

const GB = 1024 ** 3
const SETE_DIAS = 7 * 86_400_000
function discoTexto(m: MaterialSirvo, t: number, adiadaDesde: number): { dica: string; aviso: boolean } {
    const d = m.disco
    if (!d || d.usado < 0) return { dica: "", aviso: false }
    const gb = (n: number) => (n / GB).toFixed(1).replace(".", ",")
    const pouco = d.livre >= 0 && d.livre < 10 * GB
    const adiada = !!d.limpeza.adiada && adiadaDesde > 0 && t - adiadaDesde > SETE_DIAS
    const livre = d.livre >= 0 ? ` · ${gb(d.livre)} GB livres` : ""
    const limpeza = d.limpeza.adiada ? ` · limpeza adiada (${d.limpeza.adiada})` : ""
    return { dica: ` Material do Sirvo no disco: ${gb(d.usado)} GB${livre}${limpeza}.`, aviso: pouco || adiada }
}

export function calcular(e: EstadoSirvo, c: CultoSirvo, t: number, m: MaterialSirvo, adiadaDesde = 0): Visual | null {
    if (e.status === "sem_chave") return null
    if (e.status === "chave_invalida") return { tom: "vermelho", texto: "Chave do Sirvo recusada", dica: "A chave guardada não vale mais. Clique para abrir Conexão.", clicavel: true }
    if (e.status === "conectando") return { tom: "cinza", texto: "Sirvo · conectando…", dica: "", clicavel: false }

    // com culto: vale a idade da última resposta do roteiro; sem culto, o status
    const limite = Math.max(10_000, 2 * intervaloRev())
    const base = c ? e.ultimoRoteiroOk : e.ultimaResposta
    const caido = c ? (base ? t - base > limite : e.status === "caido") : e.status === "caido"
    if (caido) {
        const texto = base ? `Sem Sirvo ${minutos(t - base)}` : "Sem conexão com o Sirvo"
        const dica = e.roteiroNoAr ? "O timer segue pelo último estado recebido. Clique para abrir Conexão." : "Clique para abrir Conexão."
        return { tom: "laranja", texto, dica, clicavel: true }
    }

    if (!c) return { tom: "cinza", texto: "Sirvo · nenhum culto por perto", dica: "", clicavel: false }
    if (jaPassou(c.comeca_em, t) && !e.roteiroNoAr) {
        const como = e.escolhaManual ? "escolhido à mão" : "escolhido automaticamente"
        return { tom: "laranja", texto: `${quando(c.comeca_em)} · já passou`, dica: `Seguindo ${c.titulo}, um culto que já passou (${como}). Clique para escolher outro em Conexão.`, clicavel: true }
    }
    const estado = e.roteiroNoAr ? " · no ar" : e.roteiroEncerrado ? " · encerrado" : ""
    const papel = e.podeConduzir ? " · conduz" : " · só lê"
    const dicaPapel = e.podeConduzir ? " Esta chave conduz: o Show pode encerrar blocos e mexer no roteiro." : " Esta chave só lê o roteiro."
    const dica = `Seguindo ${c.titulo} · ${quando(c.comeca_em)}${estado}${e.escolhaManual ? " · escolhido à mão" : " · escolhido automaticamente"}.${dicaPapel}`
    const mat = materialTexto(m)
    const dsc = discoTexto(m, t, adiadaDesde)
    return { tom: mat.falhou || dsc.aviso ? "laranja" : "verde", texto: `${quando(c.comeca_em)}${estado}${papel}${mat.texto}`, dica: dica + mat.dica + dsc.dica, clicavel: false }
}
