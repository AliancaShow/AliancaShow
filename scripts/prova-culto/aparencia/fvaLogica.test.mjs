// Prova de que o portao de aparencia MORDE. Roda com `node --test scripts/prova-culto/aparencia/fvaLogica.test.mjs`.
import test from "node:test"
import assert from "node:assert/strict"
import { ESTADOS_APARENCIA, ESTADOS_CULTO, TOLERANCIA_PX, compararAparencia, mascaraDePixel, normalizarAtributo } from "./fvaLogica.mjs"
import { VARREDURA } from "./fva-lib.mjs"
import { validarEsperado } from "../compararLogica.mjs"

const clone = (x) => JSON.parse(JSON.stringify(x))
const el = (tag, attrs = "", extra = {}) => ({
    sig: `${tag} ${attrs} #`,
    rect: [0, 0, 10, 10],
    cor: { color: "rgb(0, 0, 0)", backgroundColor: "rgba(0, 0, 0, 0)" },
    ff: "Arial",
    est: { fontSize: "14px", fontWeight: "400", opacity: "1", visibility: "visible", display: "block", pointerEvents: "auto", zIndex: "auto" },
    skip: false,
    tag: tag.toLowerCase(),
    ...extra
})
const lado = () => ({
    cabecalho: { outputDisplay: false, commit: "abc" },
    estados: Object.fromEntries(ESTADOS_APARENCIA.map((e) => [e, { els: [el("DIV"), el("BUTTON", "data-title=Edicao [2]"), el("SPAN", "", { skip: true, rect: [100, 676, 200, 28] })] }]))
})
const dom = (extra = {}) => ({ tipo: "dom", id: "d1", fatia: "1b", estados: ["01-culto-parado", "02-culto-no-ar"], seletor: "BUTTON", atributo: "data-title", de: "Edicao [2]", para: "Edicao", porque: "x", decisaoDeProduto: "d", ...extra })
const trocarTitulo = (G, estados) => {
    for (const e of estados) G.estados[e].els[1].sig = "BUTTON data-title=Edicao #"
    return G
}
const tipos = (r) => r.reprovas.map((x) => `${x.estado}:${x.tipo}`)

test("os 11 estados do Culto e os 2 do Preparar", () => {
    assert.equal(ESTADOS_APARENCIA.length, 13)
    assert.equal(ESTADOS_CULTO.length, 11)
    assert.ok(!ESTADOS_CULTO.includes("11-preparar") && !ESTADOS_CULTO.includes("12-preparar-editor"))
})
test("igual passa", () => {
    const r = compararAparencia(lado(), lado(), [])
    assert.deepEqual(r.reprovas, [])
    assert.deepEqual(r.fantasmas, [])
})
test("MUTACAO data-title trocado sem item reprova; com item passa", () => {
    const B = trocarTitulo(lado(), ["01-culto-parado"])
    assert.deepEqual(tipos(compararAparencia(lado(), B, [])), ["01-culto-parado:dom"])
    const com = compararAparencia(lado(), B, [dom({ estados: ["01-culto-parado"] })])
    assert.deepEqual(com.reprovas, [])
    assert.equal(com.porEstado["01-culto-parado"].declarados, 1)
})
test("MUTACAO item com estado fora da lista nao cobre (e o item e fantasma onde nao ocorreu)", () => {
    const B = trocarTitulo(lado(), ["03-hover-slide"])
    const r = compararAparencia(lado(), B, [dom()]) // o item cobre 01 e 02, a troca esta no 03
    assert.deepEqual(tipos(r), ["03-hover-slide:dom"])
    assert.equal(r.fantasmas.length, 2)
})
test("MUTACAO fantasma: item que nao casou nada num estado da sua lista reprova", () => {
    const B = trocarTitulo(lado(), ["01-culto-parado"]) // so o 01 mudou; o item promete 01 e 02
    const r = compararAparencia(lado(), B, [dom()])
    assert.deepEqual(r.reprovas, [])
    assert.deepEqual(
        r.fantasmas.map((f) => f.estado),
        ["02-culto-no-ar"]
    )
})
test("item so troca o atributo que declara: de errado ou outra mudanca no mesmo elemento nao casa", () => {
    const B = trocarTitulo(lado(), ["01-culto-parado"])
    assert.ok(tipos(compararAparencia(lado(), B, [dom({ estados: ["01-culto-parado"], de: "Outro" })])).includes("01-culto-parado:dom"))
    B.estados["01-culto-parado"].els[1].sig = "BUTTON data-title=Edicao class=x #"
    assert.ok(tipos(compararAparencia(lado(), B, [dom({ estados: ["01-culto-parado"] })])).includes("01-culto-parado:dom"))
})
test("MUTACAO rect diferente nunca e coberto", () => {
    const B = lado()
    B.estados["01-culto-parado"].els[0].rect = [0, 1, 10, 10]
    assert.deepEqual(tipos(compararAparencia(lado(), B, [dom({ estados: ["01-culto-parado"] })])), ["01-culto-parado:rect"])
})
test("MUTACAO opacity diferente (e as outras propriedades de estilo) nunca e coberta", () => {
    for (const p of ["opacity", "fontSize", "fontWeight", "visibility", "display", "pointerEvents", "zIndex"]) {
        const B = lado()
        B.estados["05-gaveta-midia"].els[0].est[p] = "0.5"
        assert.deepEqual(tipos(compararAparencia(lado(), B, [])), ["05-gaveta-midia:estilo"], p)
    }
    const B = lado()
    B.estados["05-gaveta-midia"].els[0].ff = "Outra"
    assert.deepEqual(tipos(compararAparencia(lado(), B, [])), ["05-gaveta-midia:estilo"], "fontFamily")
})
test("MUTACAO cor diferente reprova; contagem de elementos diferente reprova", () => {
    const B = lado()
    B.estados["09-config"].els[0].cor.color = "rgb(255, 0, 0)"
    assert.deepEqual(tipos(compararAparencia(lado(), B, [])), ["09-config:cor"])
    const C = lado()
    C.estados["09-config"].els.push(el("P"))
    assert.deepEqual(tipos(compararAparencia(lado(), C, [])), ["09-config:contagem"])
})
test("estados do Preparar: medidos, sem portao", () => {
    const B = lado()
    B.estados["11-preparar"].els[0].rect = [9, 9, 9, 9]
    B.estados["12-preparar-editor"].els.push(el("P"))
    const r = compararAparencia(lado(), B, [], { px: { "11-preparar": 99999 } })
    assert.deepEqual(r.reprovas, [])
    assert.equal(r.porEstado["11-preparar"].rect, 1)
})
test("MUTACAO lado A com 12 estados reprova; lado B com estado a mais reprova", () => {
    const A = lado()
    delete A.estados["13-culto-depois-da-volta"]
    assert.deepEqual(tipos(compararAparencia(A, lado(), [])), ["13-culto-depois-da-volta:estado-faltando"])
    const B = lado()
    B.estados["14-inventado"] = { els: [] }
    assert.deepEqual(tipos(compararAparencia(lado(), B, [])), ["14-inventado:estado-sobrando"])
})
test("MUTACAO px acima da tolerancia reprova; dentro passa (so no Culto)", () => {
    assert.deepEqual(TOLERANCIA_PX && typeof TOLERANCIA_PX, "object")
    const tol = { "01-culto-parado": 100 }
    assert.deepEqual(tipos(compararAparencia(lado(), lado(), [], { px: { "01-culto-parado": 101 }, tolerancia: tol })), ["01-culto-parado:px"])
    assert.deepEqual(compararAparencia(lado(), lado(), [], { px: { "01-culto-parado": 100 }, tolerancia: tol }).reprovas, [])
    // sem tolerancia medida, o padrao e 0
    assert.deepEqual(tipos(compararAparencia(lado(), lado(), [], { px: { "02-culto-no-ar": 1 }, tolerancia: {} })), ["02-culto-no-ar:px"])
})
test("MUTACAO cabecalho com outputDisplay verdadeiro reprova (nos dois lados)", () => {
    const A = lado()
    A.cabecalho.outputDisplay = true
    assert.deepEqual(tipos(compararAparencia(A, lado(), [])), ["*:saida-ligada"])
    const B = lado()
    B.cabecalho.outputDisplay = true
    assert.deepEqual(tipos(compararAparencia(lado(), B, [])), ["*:saida-ligada"])
})
test("esquema do item dom: estados com curinga, do Preparar, atributo class, lista vazia reprovam", () => {
    assert.deepEqual(validarEsperado([dom()]), [])
    assert.ok(validarEsperado([dom({ estados: ["*"] })]).length > 0)
    assert.ok(validarEsperado([dom({ estados: ["11-preparar"] })]).length > 0)
    assert.ok(validarEsperado([dom({ estados: ["12-preparar-editor"] })]).length > 0)
    assert.ok(validarEsperado([dom({ atributo: "class" })]).length > 0)
    assert.ok(validarEsperado([dom({ estados: [] })]).length > 0)
})
test("mascaraDePixel: os rects de .noAr e .clockArea de uma varredura fabricada (e so os pulados)", () => {
    const v = { els: [el("DIV", "", { tag: "div.noAr", skip: true, rect: [1000, 10, 80, 20] }), el("DIV", "", { tag: "div.clockArea", skip: true, rect: [20, 676, 300, 28] }), el("DIV", "", { rect: [0, 0, 500, 500] })] }
    assert.deepEqual(mascaraDePixel(v), [
        [1000, 10, 81, 21],
        [20, 676, 301, 29]
    ])
    assert.deepEqual(mascaraDePixel({ els: [el("DIV", "", { skip: true, rect: [0, 0, 0, 0] })] }), [])
})
test("normalizarAtributo: classe de escopo do Svelte e ids gerados somem, var() de modo vira o fallback", () => {
    assert.equal(normalizarAtributo("a  svelte-1abc2 b"), "a b")
    assert.equal(normalizarAtributo("zoom_0123456789ab"), "zoom_X")
    assert.equal(normalizarAtributo("color: var(--modo-fundo, #fff)"), "color: #fff")
})

// a VARREDURA de verdade, num DOM de brinquedo (Node, sem navegador): o no de texto vazio nao muda o sig; .noAr e pulado
function varrer(filhos, pulado = false) {
    const e = {
        tagName: "DIV",
        attributes: [],
        childNodes: filhos,
        closest: () => (pulado ? {} : null),
        getBoundingClientRect: () => ({ x: 0, y: 0, width: 5, height: 5 }),
        getAttribute: () => ""
    }
    const doc = {
        querySelectorAll: () => [e],
        querySelector: () => null,
        body: { dataset: {} }
    }
    const cs = new Proxy({ getPropertyValue: () => "" }, { get: (o, k) => (k in o ? o[k] : "x") })
    const corpo = new Function("document", "getComputedStyle", `return (async () => {${VARREDURA}})()`)
    return corpo(doc, () => cs).then((s) => JSON.parse(s).els[0])
}
test("VARREDURA: no de texto vazio a mais nao muda o sig; texto de verdade muda", async () => {
    const t = (s) => ({ nodeType: 3, textContent: s })
    const a = await varrer([t("Oi")])
    const b = await varrer([t("Oi"), t("   ")])
    const c = await varrer([t("   "), t("Oi")])
    assert.equal(a.sig, b.sig)
    assert.equal(a.sig, c.sig)
    assert.notEqual(a.sig, (await varrer([t("Tchau")])).sig)
    assert.deepEqual(Object.keys(a.est).sort(), ["display", "fontSize", "fontWeight", "opacity", "pointerEvents", "visibility", "zIndex"])
    assert.equal(a.skip, false)
})
test("VARREDURA: elemento dentro de .noAr/.clockArea e pulado (skip) e nao grava o texto", async () => {
    const e = await varrer([{ nodeType: 3, textContent: "NO AR 1:23" }], true)
    assert.equal(e.skip, true)
    assert.ok(e.sig.endsWith(" #"), e.sig)
})
test("VARREDURA: a lista de pulados inclui .noAr", () => assert.ok(VARREDURA.includes(".clockArea, .clock, #clock, .noAr")))
