// As copias dos prototipos em aplicar/leiaute-v2 so podem diferir do original pelos atributos `data-regiao`: tirados eles, o SHA-256 tem de ser o do
// original aprovado (Tela-luz.dc.html e Tela-luz-1080.dc.html, de bancada/leiaute-v2-prototipos, 17/nov/2026).
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const ORIGINAIS = {
    "Tela-luz.dc.html": "664d9896ae73114f1724729a1879a12a3fecdb4324dda1695b9ba609fdbe9833",
    "Tela-luz-1080.dc.html": "185ee8ccf1176aac082c2cd85f317645365820b4b2bb4f7d543cecf0817b4eb0"
}
const REGIOES = ["topo", "roteiro", "centro", "biblioteca", "no-ar"]
const sha = (buf) => createHash("sha256").update(buf).digest("hex")
const tirar = (txt) => txt.replace(/ data-regiao="[a-z-]+"/g, "")

for (const [nome, esperado] of Object.entries(ORIGINAIS)) {
    const txt = readFileSync(join(RAIZ, "aplicar", "leiaute-v2", nome), "utf8")
    test(`${nome}: sem data-regiao e igual ao original (SHA-256)`, () => {
        assert.equal(sha(Buffer.from(tirar(txt), "utf8")), esperado)
    })
    test(`${nome}: as cinco regioes estao anotadas, uma vez cada`, () => {
        for (const r of REGIOES) assert.equal(txt.split(`data-regiao="${r}"`).length - 1, 1, r)
    })
    test(`${nome}: a mutacao morde (um byte a mais reprova)`, () => {
        assert.notEqual(sha(Buffer.from(tirar(txt) + " ", "utf8")), esperado)
    })
}
