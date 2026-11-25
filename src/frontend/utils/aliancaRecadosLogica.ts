// Coluna No ar, secao "Recados" (Andre, 25/nov: desenho coluna_no_ar_secoes_recolhiveis_v1, "concordo com Recados"). Conta pura: o que a
// linha de titulo mostra quando algo dos recados esta no ar (a secao pode estar recolhida: o que esta no telao/palco nunca fica escondido),
// e as chaves do aberto/recolhido guardado (mesmo armazenamento dos blocos do Editar).
import { restante } from "./aliancaChamadasLogica"

export type AbaRecados = "palco" | "chamadas"

/** chaves em `blocos` (aliancaBlocosEstado): a escolha do operador sobrevive a fechar o app */
export const CHAVE_OUTRAS = "noar|outras-telas"
export const CHAVE_RECADOS = "noar|recados"
/** true = a ultima aba usada foi Palco (abrir Recados volta nela) */
export const CHAVE_ABA_PALCO = "noar|recados-aba-palco"
/** primeira abertura: Outras telas aberta (a previa do retorno ajuda no culto), Recados recolhido (uso esporadico) */
export const OUTRAS_ABERTA_PADRAO = true
export const RECADOS_ABERTO_PADRAO = false

export interface Pilula {
    tipo: AbaRecados
    rotulo: string
    tempo: string | null
    titulo: string
}

/** as pilulas do titulo, na ordem Palco, Chamadas; vazio = nada dos recados no ar */
export function pilulasDosRecados(p: { palco: { texto: string; ateMs: number } | null; chamada: { texto: string; ateMs: number | null } | null; nomeChamada?: string; agoraMs: number }): Pilula[] {
    const r: Pilula[] = []
    if (p.palco) r.push({ tipo: "palco", rotulo: "Palco", tempo: restante(p.palco.ateMs, p.agoraMs), titulo: `No palco: “${p.palco.texto}”` })
    if (p.chamada) r.push({ tipo: "chamadas", rotulo: (p.nomeChamada || "Chamada").trim() || "Chamada", tempo: restante(p.chamada.ateMs, p.agoraMs), titulo: `No telão: “${p.chamada.texto}”` })
    return r
}
