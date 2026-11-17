// Prova de que o juiz por invariantes da secao H MORDE. Roda com `node --test scripts/prova-culto/invariantes.test.mjs`.
import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { CANAIS_PERMITIDOS_NO_PREPARAR, invariantes } from "./invariantesLogica.mjs"
import { SECOES_PREPARAR } from "./roteiro-preparar.mjs"

const clone = (x) => JSON.parse(JSON.stringify(x))
const passo = (id, extra = {}) => ({
    id,
    secao: "H",
    semEfeito: "o Preparar ignora o teclado",
    antesDoGesto: { hash: "h1", telao: { texto: "t", elementos: 3 }, foco: "BODY", sinais: {}, pagina: "show" },
    depois: { pagina: "show" },
    efeitoMedido: null,
    principal: { outputs: [], canais: { "MAIN:CHECK_RAM_USAGE": null }, estado: [], foco: "BODY", sinais: {} },
    saida: { outputs: [], canais: {}, estado: [], saida: { hash: "h1", texto: "t", elementos: 3 } },
    ...extra
})
const limpa = () => ({ cabecalho: { roteiro: "preparar", versaoRoteiro: 1 }, violacoes: [], passos: [passo("H01"), passo("H02"), passo("H03", { paginaFinal: "show" })] })
const regras = (g, permitidos) => invariantes(g, permitidos).violacoes.map((v) => `${v.passo}:${v.regra}`)

test("a lista de canais permitidos so tem os dois espelhos de dados autorizados", () => assert.deepEqual(CANAIS_PERMITIDOS_NO_PREPARAR, ["OUTPUT:PROJECTS", "OUTPUT:SHOWS"]))
test("MUTACAO canal permitido + escrita em outputs no mesmo passo reprova (regra 1)", () => {
    const g = limpa()
    g.passos[1].principal.canais["OUTPUT:PROJECTS"] = {}
    g.passos[1].principal.canais["OUTPUT:SHOWS"] = {}
    assert.deepEqual(regras(g), [])
    g.passos[1].principal.outputs.push({ op: "update", mudou: true })
    assert.deepEqual(regras(g), ["H02:1"])
})
test("MUTACAO canal permitido + hash do telao mudado no mesmo passo reprova (regra 3)", () => {
    const g = limpa()
    g.passos[1].principal.canais["OUTPUT:SHOWS"] = {}
    g.passos[1].saida.saida.hash = "zz"
    assert.deepEqual(regras(g), ["H02:3"])
})
test("MUTACAO canal OUTPUT novo fora da lista continua reprovando (regra 2)", () => {
    for (const c of ["OUTPUT:SLIDE", "OUTPUT:COLORBARS", "STAGE:DATA"]) {
        const g = limpa()
        g.passos[1].principal.canais["OUTPUT:SHOWS"] = {}
        g.passos[1].principal.canais[c] = {}
        assert.deepEqual(regras(g), ["H02:2"], c)
    }
})
test("gravacao limpa passa", () => {
    const r = invariantes(limpa())
    assert.deepEqual(r, { erros: [], violacoes: [] })
})
test("MUTACAO escrita em outputs reprova (regra 1)", () => {
    const g = limpa()
    g.passos[1].principal.outputs.push({ op: "update", mudou: true })
    assert.deepEqual(regras(g), ["H02:1"])
})
test("MUTACAO canal OUTPUT/STAGE fora da lista reprova (regra 2); em lista de teste passa; canal comum nao conta", () => {
    for (const c of ["OUTPUT:COLORBARS", "OUTPUT:OVERLAYS", "STAGE:SWITCH"]) {
        const g = limpa()
        g.passos[1].principal.canais[c] = {}
        assert.deepEqual(regras(g), ["H02:2"], c)
        assert.deepEqual(regras(g, [c]), [], c + " liberado")
    }
    const g = limpa()
    g.passos[1].principal.canais["MAIN:SAVE"] = {}
    assert.deepEqual(regras(g), [])
})
test("MUTACAO telao mudado reprova (regra 3)", () => {
    const g = limpa()
    g.passos[2].saida.saida.hash = "zz"
    assert.deepEqual(regras(g), ["H03:3"])
})
test("MUTACAO paginaFinal errado reprova (regra 4)", () => {
    const g = limpa()
    g.passos[2].depois.pagina = "settings"
    assert.deepEqual(regras(g), ["H03:4"])
    g.passos[2].paginaFinal = "settings"
    assert.deepEqual(regras(g), [])
})
test("violacao gravada pelo rodar reprova (regra 5)", () => {
    const g = limpa()
    g.violacoes.push("H02: alvo: alvo nao existe")
    assert.deepEqual(regras(g), ["H02:5"])
})
test("gravacao invalida: sem antesDoGesto, sem secao H, ou de outro roteiro", () => {
    const a = limpa()
    delete a.passos[1].antesDoGesto
    assert.ok(invariantes(a).erros.some((e) => /antesDoGesto/.test(e)))
    assert.ok(invariantes({ cabecalho: { roteiro: "preparar" }, passos: [] }).erros.length > 0)
    const b = limpa()
    delete b.cabecalho.roteiro
    assert.ok(invariantes(b).erros.some((e) => /roteiro "preparar"/.test(e)))
})
test("invariantes.mjs: sai com 0 na limpa, 1 na violada e 2 na invalida", () => {
    const dir = mkdtempSync(join(tmpdir(), "inv-"))
    const rodar = (g) => {
        const arq = join(dir, "g.json")
        writeFileSync(arq, JSON.stringify(g))
        return spawnSync(process.execPath, ["scripts/prova-culto/invariantes.mjs", arq], { encoding: "utf8" })
    }
    assert.equal(rodar(limpa()).status, 0)
    const suja = limpa()
    suja.passos[1].principal.outputs.push({})
    const r = rodar(suja)
    assert.equal(r.status, 1)
    assert.match(r.stderr, /passo H02 regra 1/)
    const sem = limpa()
    delete sem.passos[0].antesDoGesto
    assert.equal(rodar(sem).status, 2)
    assert.equal(spawnSync(process.execPath, ["scripts/prova-culto/invariantes.mjs"], { encoding: "utf8" }).status, 2)
})
test("o roteiro H: 28 passos (0c + 1a + 1b); so os que trocam de pagina tem efeito; nenhum liga/desliga a saida", () => {
    const ids = SECOES_PREPARAR[0].passos.map((p) => p.id)
    assert.deepEqual(ids, ["H01-vai-preparar", "H02-espaco", "H03-seta-direita", "H04-f1", "H05-f2", "H06-f3", "H07-f5", "H08-ponto", "H09-esc", "H10-ctrl-o", "H11-pilula", "H12-novo-abre", "H13-novo-esc", "H14-menu-abre", "H15-config", "H16-voltar", "H17-menu-abre", "H18-saida-bloqueada", "H19-esc-fecha-menu", "H20-busca-negada", "H30-digitos", "H31a-menu-abre", "H31-config", "H32-esc-volta", "H33-undo-para-draw", "H34-nuvem-scripture", "H35a-editar", "H35-editor-pronto"])
    for (const p of SECOES_PREPARAR[0].passos) {
        if (["H15-config", "H16-voltar", "H31-config", "H32-esc-volta", "H33-undo-para-draw", "H34-nuvem-scripture", "H35a-editar", "H35-editor-pronto"].includes(p.id)) assert.ok(p.efeito && p.paginaFinal, p.id)
        else assert.ok(p.semEfeito && !p.efeito, p.id)
    }
})
