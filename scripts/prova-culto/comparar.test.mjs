// Prova de que o comparador MORDE. Roda com `node --test scripts/prova-culto/comparar.test.mjs`.
// Cada mutacao parte de uma gravacao sintetica que passa e tem de reprovar (ou o esquema/mascara tem de ser recusado).
import test from "node:test"
import assert from "node:assert/strict"
import { TETO_CLASSICO_POR_FATIA, achatar, comparar, validarEsperado, validarRuido } from "./compararLogica.mjs"

const clone = (x) => JSON.parse(JSON.stringify(x))
const out = (index) => ({ op: "update", por: "setOutput@output", mudou: true, v: { default: { slide: { id: "s", index, layout: "default" } } } })
const base = () => ({
    cabecalho: { versaoRoteiro: 1 },
    passos: [
        { id: "A01", principal: { outputs: [out(0)], canais: { "OUTPUT:OUT": { n: 1 }, "OUTPUT:ACTIVE_TIMERS": { t: 5 } }, estado: [{ fluxo: "activePage", v: "show" }], foco: "BODY", sinais: { drawer: { height: 300 } } }, saida: { outputs: [], canais: {}, estado: [], saida: { hash: "aa", elementos: 6 } } },
        { id: "A02", principal: { outputs: [out(1), out(2)], canais: {}, estado: [], foco: "BODY" }, saida: { outputs: [], canais: {}, estado: [], saida: { hash: "bb", elementos: 6 } } }
    ]
})
const ruido = { padroes: ["*/principal/canais/OUTPUT:ACTIVE_TIMERS/*"] }

test("A/A: igual", () => {
    const r = comparar(base(), base(), { ruido })
    assert.equal(r.naoDeclaradas.length, 0)
    assert.equal(r.divergencias.length, 0)
})
test("ruido mascara so o que declara", () => {
    const b = base()
    b.passos[0].principal.canais["OUTPUT:ACTIVE_TIMERS"].t = 9
    const r = comparar(base(), b, { ruido })
    assert.equal(r.divergencias.length, 0)
    assert.equal(r.mascarados, 1)
    const sem = comparar(base(), b, { ruido: { padroes: [] } })
    assert.equal(sem.naoDeclaradas.length, 1)
})
test("MUTACAO extra escrita em outputs reprova e aponta o passo", () => {
    const b = base()
    b.passos[0].principal.outputs.push({ ...out(0), mudou: false })
    const r = comparar(base(), b, { ruido })
    assert.ok(r.naoDeclaradas.length > 0)
    assert.equal(r.naoDeclaradas[0].passo, "A01")
})
test("MUTACAO troca de ordem de dois eventos reprova (teste de unidade do comparador)", () => {
    const b = base()
    b.passos[1].principal.outputs.reverse()
    const r = comparar(base(), b, { ruido })
    assert.ok(r.naoDeclaradas.some((d) => d.passo === "A02"))
})
test("MUTACAO canal de IPC suprimido reprova", () => {
    const b = base()
    delete b.passos[0].principal.canais["OUTPUT:OUT"]
    const r = comparar(base(), b, { ruido })
    assert.ok(r.naoDeclaradas.some((d) => d.passo === "A01" && d.fluxo === "principal.canais"))
})
test("MUTACAO so a receptora muda (escritas iguais, telao diferente) reprova", () => {
    const b = base()
    b.passos[1].saida.saida.hash = "zz"
    const r = comparar(base(), b, { ruido })
    assert.ok(r.naoDeclaradas.some((d) => d.fluxo === "saida.telao"))
})
test("MUTACAO activePage (estado) reprova", () => {
    const b = base()
    b.passos[0].principal.estado[0].v = "edit"
    const r = comparar(base(), b, { ruido })
    assert.ok(r.naoDeclaradas.some((d) => d.fluxo === "principal.estado"))
})
test("MUTACAO out.slide.index mudado reprova, e mascarar esse caminho e RECUSADO", () => {
    const b = base()
    b.passos[1].principal.outputs[1].v.default.slide.index = 7
    const r = comparar(base(), b, { ruido })
    assert.ok(r.naoDeclaradas.length > 0)
    const proibido = comparar(base(), b, { ruido: { padroes: ["*/principal/outputs/*/v/default/slide/index"] } })
    assert.ok(proibido.erros.length > 0)
    assert.ok(validarRuido({ padroes: ["*/principal/outputs/*/v/default/background/path"] }).length > 0)
    assert.ok(validarRuido({ padroes: ["*/principal/outputs/*/v/default/overlays/*"] }).length > 0)
    assert.ok(validarRuido({ padroes: ["*"] }).length > 0)
})
test("teto de ruido", () => {
    assert.ok(validarRuido({ padroes: Array.from({ length: 200 }, (_, i) => `a/b/c${i}`) }).length > 0)
})

const item = (extra = {}) => ({ tipo: "divergencia", id: "e1", fatia: "0b", passo: "A01", fluxo: "principal.sinais", caminho: "drawer/height", de: 300, para: 40, porque: "E1", ...extra })
test("divergencia declarada passa; fora da lista reprova; declarada que nao ocorreu reprova", () => {
    const b = base()
    b.passos[0].principal.sinais.drawer.height = 40
    assert.equal(comparar(base(), b, { ruido, esperado: [item()] }).naoDeclaradas.length, 0)
    assert.equal(comparar(base(), b, { ruido, esperado: [] }).naoDeclaradas.length, 1)
    // item cujo "para" esta errado nao casa
    assert.equal(comparar(base(), b, { ruido, esperado: [item({ para: 41 })] }).naoDeclaradas.length, 1)
    // fantasma
    const r = comparar(base(), base(), { ruido, esperado: [item()] })
    assert.equal(r.fantasmas.length, 1)
})
test("aposentar: item aposentado deixa de ser fantasma, mas so se apontar um item existente", () => {
    const itens = [item({ decisaoDeProduto: "d" }), { tipo: "aposentar", fatia: "1a", alvo: "e1", porque: "modo foco removido", decisaoDeProduto: "doc X" }]
    assert.equal(validarEsperado(itens, { classico: true }).length, 0)
    assert.equal(comparar(base(), base(), { ruido, esperado: itens }).fantasmas.length, 0)
    const orfao = [{ tipo: "aposentar", fatia: "1a", alvo: "nao-existe", porque: "x", decisaoDeProduto: "d" }]
    assert.ok(validarEsperado(orfao, { classico: true }).length > 0)
})
test("aposentar item que AINDA ocorre: a divergencia volta a reprovar", () => {
    const b = base()
    b.passos[0].principal.sinais.drawer.height = 40
    const itens = [item(), { tipo: "aposentar", fatia: "1a", alvo: "e1", porque: "x", decisaoDeProduto: "d" }]
    assert.equal(comparar(base(), b, { ruido, esperado: itens }).naoDeclaradas.length, 1)
})
test("esquema do classico: decisaoDeProduto obrigatoria, sem curinga, teto por fatia", () => {
    assert.ok(validarEsperado([item()], { classico: true }).some((e) => /decisaoDeProduto/.test(e)))
    assert.equal(validarEsperado([item({ decisaoDeProduto: "d" })], { classico: true }).length, 0)
    assert.ok(validarEsperado([item({ decisaoDeProduto: "d", caminho: "drawer/*" })], { classico: true }).length > 0)
    assert.ok(validarEsperado([item({ decisaoDeProduto: "d", passo: "" })], { classico: true }).length > 0)
    const muitos = Array.from({ length: TETO_CLASSICO_POR_FATIA + 1 }, (_, i) => item({ id: "e" + i, decisaoDeProduto: "d", caminho: "drawer/x" + i }))
    assert.ok(validarEsperado(muitos, { classico: true }).some((e) => /teto/.test(e)))
    assert.ok(validarEsperado([{ tipo: "curinga", fatia: "x", porque: "y" }], {}).length > 0)
})
test("tipos efeitoMinimo e dom exigem de/para e motivo", () => {
    assert.ok(validarEsperado([{ tipo: "efeitoMinimo", fatia: "1b", passo: "A10", de: { fluxo: "estado", n: 1 }, para: { semEfeito: "" }, porque: "x" }]).length > 0)
    assert.equal(validarEsperado([{ tipo: "efeitoMinimo", fatia: "1b", passo: "A10", de: { fluxo: "estado", n: 1 }, para: { semEfeito: "teclas 1-6 removidas" }, porque: "x" }]).length, 0)
    assert.ok(validarEsperado([{ tipo: "dom", fatia: "1b", estado: "01", seletor: "*", atributo: "title", de: "a", para: "b", porque: "x" }]).length > 0)
    assert.equal(validarEsperado([{ tipo: "dom", fatia: "1b", estado: "01", seletor: "button.tab", atributo: "title", de: "Edicao [2]", para: "Edicao", porque: "x" }]).length, 0)
})
test("achatar: ausente num lado e divergencia", () => {
    const b = base()
    b.passos[1].principal.outputs.pop()
    assert.ok(achatar(base()).size > achatar(b).size)
    assert.ok(comparar(base(), b, { ruido }).naoDeclaradas.length > 0)
})
