// Cabine 6 (Andre, 23/nov): midia cujo arquivo sumiu do disco NUNCA vai ao ar. O clique pode ser "chamado", mas nada sai; o cartao mostra o X
// (offline) e a linha de avisos guarda o aviso ate resolver. Pura: a decisao e o texto; quem pergunta ao disco e aliancaMidiaSumida.ts.

export type DecisaoMidia = "ao-ar" | "offline"

/** so arquivo local pode sumir; online/provedor seguem como sempre. Local que o disco diz que nao existe: offline */
export function decidirMidia(e: { local: boolean; existe: boolean }): DecisaoMidia {
    if (!e.local) return "ao-ar"
    return e.existe ? "ao-ar" : "offline"
}

export const chaveDeOffline = (caminho: string) => "midia-offline:" + caminho

/** o aviso persistente (laranja) da linha de avisos */
export function avisoDeOffline(nome: string, caminho: string): { chave: string; texto: string } {
    return { chave: chaveDeOffline(caminho), texto: `Mídia offline, não foi ao ar: "${nome}" (arquivo não encontrado em ${caminho})` }
}

/**
 * a "geracao" da verificacao da biblioteca: cada troca de pasta (vista) pede de novo ao disco; na mesma pasta, uma pergunta por arquivo.
 * Devolve a chave do cache para (vista, caminho) e a geracao nova.
 */
export function chaveDeVerificacao(estado: { vista: string | null; geracao: number }, vista: string | null, caminho: string): { chave: string; geracao: number } {
    const geracao = vista === estado.vista ? estado.geracao : estado.geracao + 1
    return { chave: geracao + "\u0000" + caminho, geracao }
}
