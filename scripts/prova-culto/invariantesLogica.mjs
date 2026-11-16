// Juiz por invariantes da secao H (Preparar), puro (sem CDP, sem disco). Testado em invariantes.test.mjs.
// Nao compara com baseline: diz se a gravacao viola o que o Preparar NUNCA pode fazer.

/**
 * Canais OUTPUT:* e STAGE:* que o Preparar PODE tocar. Nasce VAZIA e quem a preenche e o dono do projeto.
 * Se uma rodada limpa da secao H mostrar algum desses canais, e PARADA 1 do plano: devolva a lista vista com o passo de cada um.
 */
export const CANAIS_PERMITIDOS_NO_PREPARAR = []

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
