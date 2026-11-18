// Leiaute v2: o estado das tres divisorias da tela (largura da esquerda e da direita, altura da biblioteca), em px.
// So cria `writable`s; ninguem da janela de saida os assina. Gravado na chave `aliancaTela` das configuracoes (save.ts) e lido por
// updateSettings.ts. As chaves antigas (`resized`, `drawer`) NAO sao lidas pela tela nova: toda instalacao abre com 280 / 330 / 260.
import { writable } from "svelte/store"

export type AliancaTelaValores = { esq: number; dir: number; bib: number }

export const TELA_PADRAO: AliancaTelaValores = { esq: 280, dir: 330, bib: 260 }

export const aliancaTela = writable<AliancaTelaValores>({ ...TELA_PADRAO })

