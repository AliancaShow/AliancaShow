// Prova de que o comparador MORDE. Roda com `node --test scripts/prova-culto/comparar.test.mjs`.
// Cada mutacao parte de uma gravacao sintetica que passa e tem de reprovar (ou o esquema/mascara tem de ser recusado).
import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { achatar, comparar, normalizarPerfil, validarEsperado, validarRuido } from "./compararLogica.mjs"

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
    assert.equal(validarEsperado(itens).length, 0)
    assert.equal(comparar(base(), base(), { ruido, esperado: itens }).fantasmas.length, 0)
    const orfao = [{ tipo: "aposentar", fatia: "1a", alvo: "nao-existe", porque: "x", decisaoDeProduto: "d" }]
    assert.ok(validarEsperado(orfao).length > 0)
})
test("aposentar item que AINDA ocorre: a divergencia volta a reprovar", () => {
    const b = base()
    b.passos[0].principal.sinais.drawer.height = 40
    const itens = [item(), { tipo: "aposentar", fatia: "1a", alvo: "e1", porque: "x", decisaoDeProduto: "d" }]
    assert.equal(comparar(base(), b, { ruido, esperado: itens }).naoDeclaradas.length, 1)
})
test("esquema: sem curinga", () => {
    assert.ok(validarEsperado([item({ decisaoDeProduto: "d", caminho: "drawer/*" })]).length > 0)
    assert.ok(validarEsperado([item({ decisaoDeProduto: "d", passo: "" })]).length > 0)
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

test("normalizarPerfil: a raiz do perfil some da gravacao nos dois formatos de barra, e so ela", () => {
    const raiz = "C:/Users/x/bancada/perfil"
    const g = {
        a: "C:/Users/x/bancada/perfil/midia/f1.png",
        b: "C:\\Users\\x\\bancada\\perfil\\midia\\v1.mp4",
        c: "c:/users/x/bancada/perfil",
        d: "C:/Users/x/bancada/perfil-bak/midia/f1.png",
        e: "C:/Users/x/bancada/perfil\\store\\media-cache\\i1.png",
    }
    const n = JSON.parse(normalizarPerfil(JSON.stringify(g), raiz))
    assert.equal(n.a, "__PERFIL__/midia/f1.png")
    assert.equal(n.b, "__PERFIL__\\midia\\v1.mp4")
    assert.equal(n.c, "__PERFIL__")
    assert.equal(n.d, g.d, "perfil-bak nao e o perfil")
    assert.equal(n.e, "__PERFIL__\\store\\media-cache\\i1.png")
    // a raiz pode chegar com barra invertida e barra no fim (FS_PERFIL_DIR cru do Windows)
    assert.deepEqual(JSON.parse(normalizarPerfil(JSON.stringify(g), "C:\\Users\\x\\bancada\\perfil\\")), n)
    // sem raiz, ou raiz rasa demais, nao mexe em nada
    assert.equal(normalizarPerfil("C:/a", ""), "C:/a")
    assert.equal(normalizarPerfil("C:/a", "C:/"), "C:/a")
})

// Q5 (fatia R): a ferramenta nao conhece mais o leiaute antigo. Roda o comparar.mjs de verdade, em processo filho.
const BASELINE = "scripts/prova-culto/baseline/slice0-base.json"
const comparar_mjs = (...args) => spawnSync(process.execPath, ["scripts/prova-culto/comparar.mjs", ...args], { encoding: "utf8" })
test("Q5: flag desconhecida sai com 2", () => {
    const r = comparar_mjs(BASELINE, BASELINE, "--classico")
    assert.equal(r.status, 2)
    assert.match(r.stderr, /flag desconhecida: --classico/)
    assert.equal(comparar_mjs(BASELINE, BASELINE, "--qualquer-outra").status, 2)
})
test("Q5: --esperado continua aceito", () => {
    const r = comparar_mjs(BASELINE, BASELINE, "--esperado", "scripts/prova-culto/esperado.json")
    // o baseline contra ele mesmo deixa os itens declarados sem ocorrer (status 1), mas a flag e aceita: nunca 2
    assert.equal(r.status, 1, r.stderr)
    assert.match(r.stdout, /comparadas \d+ chaves/)
})
test("Q5: gravacao com leiaute diferente de novo sai com 2", () => {
    const dir = mkdtempSync(join(tmpdir(), "q5-"))
    const g = JSON.parse(readFileSync(BASELINE, "utf8"))
    g.cabecalho.layout = "classico"
    const arq = join(dir, "antiga.json")
    writeFileSync(arq, JSON.stringify(g))
    const r = comparar_mjs(BASELINE, arq)
    assert.equal(r.status, 2)
    assert.match(r.stderr, /nao existe mais/)
})
