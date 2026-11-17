// Juiz por invariantes da secao H (Preparar), puro (sem CDP, sem disco). Testado em invariantes.test.mjs.
// Nao compara com baseline: diz se a gravacao viola o que o Preparar NUNCA pode fazer.

/**
 * Canais OUTPUT:* e STAGE:* que o Preparar PODE tocar. Quem a preenche e o dono do projeto; nasceu VAZIA.
 * Se uma rodada limpa da secao H mostrar um canal que nao esta aqui, e PARADA 1 do plano: devolva a lista vista com o passo de cada um.
 * Um canal permitido NUNCA basta: as regras 1 (zero escrita em outputs) e 3 (hash do telao igual) valem POR PASSO, com ou sem canal na lista.
 *
 * OUTPUT:PROJECTS e OUTPUT:SHOWS (autorizados pelo dono, 1a): espelho de dados da janela de saida (listeners.ts showsCache/projects ->
 * receivers.ts SHOWS/PROJECTS), disparado por troca de pagina, igual no Culto; nao escreve outputs nem muda o telao.
 */
export const CANAIS_PERMITIDOS_NO_PREPARAR = ["OUTPUT:PROJECTS", "OUTPUT:SHOWS"]

const ehCanalDeSaida = (c) => /^(OUTPUT|STAGE):/.test(c)

/**
 * gravacao = o json do rodar.mjs com roteiro "preparar"; permitidos = lista de canais liberados (padrao: a lista vazia exportada acima).
 * Devolve { erros: [mensagens de gravacao invalida], violacoes: [{ passo, regra, detalhe }] }.
 */
export function invariantes(gravacao, permitidos = CANAIS_PERMITIDOS_NO_PREPARAR) {
    const erros = []
    const violacoes = []
    if (gravacao?.cabecalho?.roteiro !== "preparar") erros.push('a gravacao nao e do roteiro "preparar" (cabecalho.roteiro)')
    const passos = (gravacao?.passos || []).filter((p) => p.secao === "H")
    if (!passos.length) erros.push("a gravacao nao tem passos da secao H")
    for (const p of passos) {
        if (!p.antesDoGesto || !p.depois) {
            erros.push(`${p.id}: gravacao sem antesDoGesto/depois (regrave com o rodar.mjs da 0c)`)
            continue
        }
        const v = (regra, detalhe) => violacoes.push({ passo: p.id, regra, detalhe })
        const pr = p.principal || {}
        // 1. nada escrito em outputs
        if (pr.outputs?.length) v(1, `principal.outputs tem ${pr.outputs.length} evento(s)`)
        // 2. nenhum canal de saida fora da lista branca
        for (const c of Object.keys(pr.canais || {})) if (ehCanalDeSaida(c) && !permitidos.includes(c)) v(2, `canal ${c} fora de CANAIS_PERMITIDOS_NO_PREPARAR`)
        // 3. o telao nao mudou
        if (p.saida?.saida?.hash !== p.antesDoGesto.hash) v(3, `saida.hash ${p.antesDoGesto.hash} -> ${p.saida?.saida?.hash}`)
        // 4. a pagina em que o passo termina
        if (p.paginaFinal !== undefined && p.paginaFinal !== null && p.paginaFinal !== p.depois.pagina) v(4, `paginaFinal ${JSON.stringify(p.paginaFinal)} != depois.pagina ${JSON.stringify(p.depois.pagina)}`)
    }
    // 5. a gravacao inteira sem violacao do roteiro (alvo coberto, efeito abaixo do minimo...)
    for (const x of gravacao?.violacoes || []) violacoes.push({ passo: String(x).split(":")[0], regra: 5, detalhe: String(x) })
    return { erros, violacoes }
}
