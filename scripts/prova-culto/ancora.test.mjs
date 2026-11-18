// A ancora tambem MORDE: fecho de imports, arquivo da saida alterado fora da lista, lista alterada sem SHA, fecho vazio.
import test from "node:test"
import assert from "node:assert/strict"
import { EXCECOES, SHA_EXCECOES, fecho, shaDasExcecoes, verificar } from "./ancora.mjs"

const arquivos = {
    "src/frontend/MainOutput.svelte": `<script>import A from "./components/A.svelte"; import { x } from "./utils/u"</script>`,
    "src/frontend/components/A.svelte": `<script>import { y } from "../stores"; const m = await import("./B.svelte")</script>`,
    "src/frontend/components/B.svelte": "",
    "src/frontend/utils/u.ts": `export * from "./v"`,
    "src/frontend/utils/v.ts": "",
    "src/frontend/stores.ts": "",
    "src/frontend/fora.ts": ""
}
const leitor = (c) => (c in arquivos ? arquivos[c] : null)

test("fecho segue import estatico, dinamico, re-export e resolve .ts/.svelte", () => {
    const f = fecho("src/frontend/MainOutput.svelte", leitor)
    for (const k of ["components/A.svelte", "components/B.svelte", "utils/u.ts", "utils/v.ts", "stores.ts"]) assert.ok(f.has("src/frontend/" + k), k)
    assert.ok(!f.has("src/frontend/fora.ts"))
})
test("a lista de excecoes real bate com o SHA travado", () => assert.equal(shaDasExcecoes(), SHA_EXCECOES))
test("passa: arquivo fora do fecho, e do fecho que esta nas excecoes (a lista real esta vazia depois da re-ancoragem da fatia 2: o teste passa uma lista propria)", () => {
    const f = fecho("src/frontend/MainOutput.svelte", leitor)
    const excecoes = { "src/frontend/stores.ts": { motivo: "x", sha: "s" } }
    assert.deepEqual(verificar({ fechoDaAncora: f, alterados: ["src/frontend/fora.ts", "src/frontend/stores.ts"], excecoes }), [])
})
test("MUTACAO arquivo do fecho fora da lista reprova", () => {
    const f = fecho("src/frontend/MainOutput.svelte", leitor)
    assert.ok(verificar({ fechoDaAncora: f, alterados: ["src/frontend/components/A.svelte"] }).length > 0)
})
test("MUTACAO fecho vazio reprova", () => assert.ok(verificar({ fechoDaAncora: new Set(), alterados: [] }).length > 0))
test("MUTACAO lista de excecoes crescida sem SHA reprova", () => {
    EXCECOES["src/frontend/components/A.svelte"] = "x"
    try {
        assert.ok(verificar({ fechoDaAncora: new Set(["a"]), alterados: [] }).some((e) => /lista de excecoes/.test(e)))
    } finally {
        delete EXCECOES["src/frontend/components/A.svelte"]
    }
})

import { fechoDoRef } from "./ancora.mjs"
test("fechoDoRef (git cat-file --batch) acha MainOutput e o fecho tem tamanho plausivel", () => {
    const f = fechoDoRef("src/frontend/MainOutput.svelte", "HEAD")
    assert.ok(f.has("src/frontend/MainOutput.svelte") && f.has("src/frontend/stores.ts") && f.size > 50)
})

// 6.6: diferenca de conjuntos (arquivo novo no fecho) e trava de conteudo (sha) nas duas listas
import { NOVOS_NO_FECHO, SHA_NOVOS, shaDoTexto, shaDosNovos } from "./ancora.mjs"
import { execFileSync } from "node:child_process"
const f0 = () => fecho("src/frontend/MainOutput.svelte", leitor)
test("a lista NOVOS_NO_FECHO real bate com o SHA travado", () => assert.equal(shaDosNovos(), SHA_NOVOS))
test("MUTACAO arquivo novo no fecho fora de NOVOS_NO_FECHO reprova (existisse ou nao na ancora)", () => {
    const head = new Set([...f0(), "src/frontend/fora.ts"]) // `fora.ts` ja existia na ancora, mas passou a ser importado por alguem do fecho
    const erros = verificar({ fechoDaAncora: f0(), fechoDoHead: head, alterados: [] })
    assert.ok(
        erros.some((e) => /fora\.ts.*NOVO no fecho/.test(e)),
        erros.join("; ")
    )
    const head2 = new Set([...f0(), "src/frontend/utils/novo.ts"]) // arquivo que nem existe na ancora
    assert.ok(verificar({ fechoDaAncora: f0(), fechoDoHead: head2, alterados: [] }).some((e) => /novo\.ts.*NOVO no fecho/.test(e)))
})
test("arquivo novo listado em NOVOS_NO_FECHO passa; entrada que nao entrou no fecho reprova", () => {
    const novos = { "src/frontend/fora.ts": { motivo: "x", sha: "s" } }
    const head = new Set([...f0(), "src/frontend/fora.ts"])
    assert.deepEqual(verificar({ fechoDaAncora: f0(), fechoDoHead: head, alterados: [], novos }), [])
    assert.ok(verificar({ fechoDaAncora: f0(), fechoDoHead: f0(), alterados: [], novos }).some((e) => /nao e um arquivo que entrou/.test(e)))
})
test("MUTACAO conteudo de arquivo listado mudado sem atualizar o sha reprova (nas duas listas)", () => {
    const excecoes = { "src/frontend/stores.ts": { motivo: "x", sha: "aaa" } }
    const novos = { "src/frontend/fora.ts": { motivo: "x", sha: "bbb" } }
    const head = new Set([...f0(), "src/frontend/fora.ts"])
    const shaAtual = (c) => (c === "src/frontend/stores.ts" ? "aaa" : c === "src/frontend/fora.ts" ? "bbb" : null)
    assert.deepEqual(verificar({ fechoDaAncora: f0(), fechoDoHead: head, alterados: [], excecoes, novos, shaAtual }), [])
    const mudou = (c) => (c === "src/frontend/stores.ts" ? "outro" : shaAtual(c))
    assert.ok(verificar({ fechoDaAncora: f0(), fechoDoHead: head, alterados: [], excecoes, novos, shaAtual: mudou }).some((e) => /stores\.ts: o conteudo mudou.*EXCECOES/.test(e)))
    const mudouN = (c) => (c === "src/frontend/fora.ts" ? "outro" : shaAtual(c))
    assert.ok(verificar({ fechoDaAncora: f0(), fechoDoHead: head, alterados: [], excecoes, novos, shaAtual: mudouN }).some((e) => /fora\.ts: o conteudo mudou.*NOVOS_NO_FECHO/.test(e)))
})
test("MUTACAO lista NOVOS_NO_FECHO crescida sem SHA_NOVOS reprova", () => {
    NOVOS_NO_FECHO["src/frontend/components/A.svelte"] = { motivo: "x", sha: "s" }
    try {
        assert.ok(verificar({ fechoDaAncora: new Set(["a"]), alterados: [] }).some((e) => /NOVOS_NO_FECHO mudou/.test(e)))
    } finally {
        delete NOVOS_NO_FECHO["src/frontend/components/A.svelte"]
    }
})
test("os sha das duas listas batem com o conteudo real do HEAD (CRLF -> LF)", () => {
    for (const lista of [EXCECOES, NOVOS_NO_FECHO])
        for (const [caminho, e] of Object.entries(lista)) {
            // arquivo APAGADO de proposito (sha "apagado"): o juiz ignora o sha, e aqui o arquivo tem de nao existir mesmo no HEAD
            if (e.sha === "apagado") {
                assert.throws(() => execFileSync("git", ["show", `HEAD:${caminho}`], { encoding: "utf8", stdio: "pipe" }), caminho + " devia estar apagado")
                continue
            }
            const txt = execFileSync("git", ["show", `HEAD:${caminho}`], { encoding: "utf8", maxBuffer: 1 << 28 })
            assert.equal(shaDoTexto(txt), e.sha, caminho)
            assert.equal(shaDoTexto(txt.replace(/\n/g, "\r\n")), e.sha, caminho + " com CRLF")
        }
})
