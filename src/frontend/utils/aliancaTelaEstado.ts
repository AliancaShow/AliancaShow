// Leiaute v2: o estado das tres divisorias da tela (largura da esquerda e da direita, altura da biblioteca), em px.
// So cria `writable`s; ninguem da janela de saida os assina. Gravado na chave `aliancaTela` das configuracoes (save.ts) e lido por
// updateSettings.ts. As chaves antigas (`resized`, `drawer`) NAO sao lidas pela tela nova: toda instalacao abre com 280 / 330 / 260.
import { writable } from "svelte/store"

export type AliancaTelaValores = { esq: number; dir: number; bib: number }

export const TELA_PADRAO: AliancaTelaValores = { esq: 280, dir: 330, bib: 260 }

export const aliancaTela = writable<AliancaTelaValores>({ ...TELA_PADRAO })


/** o que vale do `aliancaTela` salvo (settings.json): so numeros finitos, o resto cai no padrao. Os limites (min/max) sao de `prender`, depois. */
export function normalizarTelaSalva(v: unknown): AliancaTelaValores {
    const r: AliancaTelaValores = { ...TELA_PADRAO }
    if (v && typeof v === "object" && !Array.isArray(v)) {
        for (const k of ["esq", "dir", "bib"] as const) {
            const n = (v as Record<string, unknown>)[k]
            if (typeof n === "number" && Number.isFinite(n)) r[k] = Math.round(n)
        }
    }
    return r
}
