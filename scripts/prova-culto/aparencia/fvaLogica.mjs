// Logica pura do portao de aparencia do Culto (sem CDP, sem disco). Testada em fvaLogica.test.mjs.
// Os 13 estados de fva-estados.mjs gravados em dois apps (referencia e HEAD): nos 11 do Culto, rect, cor e sig exatos sao o portao.

export const ESTADOS_APARENCIA = ["01-culto-parado", "02-culto-no-ar", "03-hover-slide", "04-menu-contexto", "05-gaveta-midia", "06-gaveta-audio", "07-gaveta-biblia", "08-gaveta-shows", "09-config", "10-culto-editor", "11-preparar", "12-preparar-editor", "13-culto-depois-da-volta"]

/** os estados do Culto: todos menos os dois do Preparar (que muda de proposito e nao tem portao) */
export const ESTADOS_CULTO = ESTADOS_APARENCIA.filter((e) => e !== "11-preparar" && e !== "12-preparar-editor")

/** atributos que um item `dom` do esperado.json pode declarar */
export const ATRIBUTOS_DOM = ["data-title", "title", "aria-label"]

/**
 * A mesma normalizacao que a VARREDURA (fva-lib.mjs) aplica ao valor de cada atributo: sem classe de escopo do Svelte, ids gerados
 * viram _X, `var(--x, fallback)` dos tokens de modo vira o fallback, espacos colapsados.
 */
export const normalizarAtributo = (s) =>
    String(s || "")
        .replace(/svelte-[a-z0-9]+/g, "")
        .replace(/(?<![\w-])s-[\w-]{12}(?![\w-])/g, "s-X")
        .replace(/(zoom|picker|id)_[0-9a-f]{6,}/g, "$1_X")
        .replace(/var\(--(?:live-opacity|live|sel-wash|sel-line|conteudo-acento|modo-[a-z-]+|prep-rgb|prep|aviso|sobre-acento),\s*([^()]*(?:\([^()]*\)[^()]*)*)\)/g, "$1")
        .replace(/\s+/g, " ")
        .trim()

/**
 * Tolerancia de pixel por estado do Culto (px = pixels que diferem, fora da mascara). Ausente = 0 (os 2 estados do Preparar nao tem portao).
 * Medida na 0c (16/nov), A/A de 4 rodadas por lado (ref-1 x ref-2/3/4 e head-1 x head-2/3/4): ceil(pior px x 1,25) + 20.
 * As seis medidas de px por estado: 09-config e 10-culto-editor [2, 0, 2, 0, 0, 0] (pior 2, tolerancia 23); os outros nove estados do Culto
 * [0, 0, 0, 0, 0, 0] (pior 0, tolerancia 20). rect, cor, sig, estilo e contagem deram zero nos seis pares.
 */
export const TOLERANCIA_PX = {
    "01-culto-parado": 20,
    "02-culto-no-ar": 20,
    "03-hover-slide": 20,
    "04-menu-contexto": 20,
    "05-gaveta-midia": 20,
    "06-gaveta-audio": 20,
    "07-gaveta-biblia": 20,
    "08-gaveta-shows": 20,
    "09-config": 23,
    "10-culto-editor": 23,
    "13-culto-depois-da-volta": 20
}

/** retangulos [x, y, w, h] dos elementos que a varredura pula (relogio, NO AR): lidos da propria varredura do estado, nao de uma faixa fixa */
export function mascaraDePixel(varredura) {
    const rects = []
    for (const e of varredura?.els || []) {
        if (!e.skip) continue
        const [x, y, w, h] = e.rect
        if (w <= 0 || h <= 0) continue
        rects.push([Math.floor(x), Math.floor(y), Math.ceil(w) + 1, Math.ceil(h) + 1])
    }
    return rects
}

const PROPS_ESTILO = ["fontSize", "fontWeight", "opacity", "visibility", "display", "pointerEvents", "zIndex"]
const comRect = (r) => (r || []).join()

/** troca a PRIMEIRA e unica ocorrencia de `atributo=de` em `sig` por `atributo=para`; devolve null se nao ha exatamente uma */
function trocarAtributo(sig, atributo, de, para) {
    const alvo = `${atributo}=${de}`
    const i = sig.indexOf(alvo)
    if (i < 0 || sig.indexOf(alvo, i + 1) >= 0) return null
    return sig.slice(0, i) + `${atributo}=${para}` + sig.slice(i + alvo.length)
}

/**
 * Compara a aparencia de A (referencia) com B (HEAD).
 *   A, B: { cabecalho?: { outputDisplay }, estados: { <nome>: { els: [...] } } }
 *   itens: itens `dom` do esperado.json (os outros tipos sao ignorados)
 *   opcoes.px: { <estado>: pixels diferentes } (ja fora da mascara); opcoes.tolerancia: padrao TOLERANCIA_PX
 * Devolve { reprovas: [{ estado, tipo, detalhe }], fantasmas: [{ item, estado }], porEstado: { <estado>: { dom, declarados, rect, cor, estilo, contagem, px } } }.
 * Em ESTADOS_CULTO: rect, cor, estilo e contagem de elementos NUNCA sao declaraveis; sig so por item dom; px acima da tolerancia reprova.
 * Os estados do Preparar sao medidos e devolvidos, sem portao.
 */
export function compararAparencia(A, B, itens = [], { px = {}, tolerancia = TOLERANCIA_PX } = {}) {
    const reprovas = []
    const porEstado = {}
    const doms = itens.filter((i) => i.tipo === "dom")
    for (const [nome, G] of [
        ["A", A],
        ["B", B]
    ]) {
        const chaves = Object.keys(G?.estados || {})
        for (const e of ESTADOS_APARENCIA) if (!chaves.includes(e)) reprovas.push({ estado: e, tipo: "estado-faltando", detalhe: `o lado ${nome} nao tem o estado ${e}` })
        for (const e of chaves) if (!ESTADOS_APARENCIA.includes(e)) reprovas.push({ estado: e, tipo: "estado-sobrando", detalhe: `o lado ${nome} tem o estado ${e}, que nao existe` })
        if (G?.cabecalho?.outputDisplay) reprovas.push({ estado: "*", tipo: "saida-ligada", detalhe: `o lado ${nome} foi gravado com a saida (outputDisplay) LIGADA` })
    }
    const casou = new Map() // "<indice do item>|<estado>" -> pares casados
    for (const estado of ESTADOS_APARENCIA) {
        const a = A?.estados?.[estado]
        const b = B?.estados?.[estado]
        if (!a || !b) continue
        const culto = ESTADOS_CULTO.includes(estado)
        const r = { dom: 0, declarados: 0, rect: 0, cor: 0, estilo: 0, contagem: 0, px: px[estado] ?? null }
        porEstado[estado] = r
        const falha = (tipo, detalhe) => {
            if (culto) reprovas.push({ estado, tipo, detalhe })
        }
        if (a.els.length !== b.els.length) {
            r.contagem = Math.abs(a.els.length - b.els.length)
            falha("contagem", `${a.els.length} elementos na referencia e ${b.els.length} no HEAD`)
        }
        const k = Math.min(a.els.length, b.els.length)
        for (let i = 0; i < k; i++) {
            const ea = a.els[i]
            const eb = b.els[i]
            if (ea.sig !== eb.sig) {
                const idx = doms.findIndex((it) => it.estados.includes(estado) && ea.sig.startsWith(it.seletor + " ") && trocarAtributo(ea.sig, it.atributo, it.de, it.para) === eb.sig)
                if (idx >= 0) {
                    r.declarados++
                    const chave = `${idx}|${estado}`
                    casou.set(chave, (casou.get(chave) || 0) + 1)
                } else {
                    r.dom++
                    falha("dom", `elemento ${i}: ${ea.sig.slice(0, 140)}  >>  ${eb.sig.slice(0, 140)}`)
                }
            }
            if (comRect(ea.rect) !== comRect(eb.rect)) {
                r.rect++
                falha("rect", `elemento ${i} ${ea.tag}: [${comRect(ea.rect)}] >> [${comRect(eb.rect)}]`)
            }
            for (const p of Object.keys(ea.cor || {}))
                if (ea.cor[p] !== eb.cor?.[p]) {
                    r.cor++
                    falha("cor", `elemento ${i} ${ea.tag}: ${p} ${ea.cor[p]} >> ${eb.cor?.[p]}`)
                }
            let estilo = ea.ff !== eb.ff ? ["fontFamily"] : []
            for (const p of PROPS_ESTILO) if ((ea.est || {})[p] !== (eb.est || {})[p]) estilo.push(p)
            if (estilo.length) {
                r.estilo++
                falha("estilo", `elemento ${i} ${ea.tag}: ${estilo.join(",")}`)
            }
        }
        if (culto && r.px !== null && r.px > (tolerancia[estado] || 0)) reprovas.push({ estado, tipo: "px", detalhe: `${r.px} pixels diferentes (tolerancia ${tolerancia[estado] || 0})` })
    }
    // fantasma: item dom que nao casou nada num estado da sua lista
    const fantasmas = []
    doms.forEach((item, idx) => {
        for (const estado of item.estados) if (!casou.get(`${idx}|${estado}`)) fantasmas.push({ item, estado })
    })
    return { reprovas, fantasmas, porEstado }
}
