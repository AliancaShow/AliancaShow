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
test("passa: arquivo fora do fecho, e do fecho que esta nas excecoes", () => {
    const f = fecho("src/frontend/MainOutput.svelte", leitor)
    assert.deepEqual(verificar({ fechoDaAncora: f, alterados: ["src/frontend/fora.ts", "src/frontend/stores.ts"] }), [])
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
