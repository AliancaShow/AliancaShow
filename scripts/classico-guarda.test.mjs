// Prova de que a guarda do classico MORDE (as 8 mutacoes do plano + a da ancora). Roda com `node --test scripts/classico-guarda.test.mjs`.
import test from "node:test"
import assert from "node:assert/strict"
import { shaDoBloco, verificar } from "./classico-guarda.mjs"

const ARQ = "src/frontend/components/x/Y.svelte"
const bloco = "    <b>antigo</b>\n    <i>verbatim</i>"
const arquivo = `<div>\n    <!-- CLASSICO:INICIO piloto -->\n${bloco}\n    <!-- CLASSICO:FIM piloto -->\n</div>\n`
const cenario = () => ({ arquivos: { [ARQ]: arquivo }, lock: { piloto: { arquivo: ARQ, sha: shaDoBloco(bloco) } } })
const ancora = (f) => (f === ARQ ? `<div>\n${bloco}\n</div>\n` : null)

test("cenario limpo passa (inclusive com CRLF e outro recuo)", () => {
    assert.deepEqual(verificar(cenario()), [])
    const c = cenario()
    c.arquivos[ARQ] = arquivo.replace(/\n/g, "\r\n").replace(/ {4}</g, "        <")
    assert.deepEqual(verificar(c), [])
    assert.deepEqual(verificar({ ...cenario(), ancoraTexto: ancora }), [])
})
const reprova = (nome, mut, extra = {}) =>
    test("MUTACAO " + nome, () => {
        const c = cenario()
        mut(c)
        assert.ok(verificar({ ...c, ...extra }).length > 0, nome)
    })
reprova("um caractere do bloco mudado", (c) => (c.arquivos[ARQ] = arquivo.replace("antigo", "antigO")))
reprova("bloco apagado", (c) => (c.arquivos[ARQ] = "<div></div>\n"))
reprova("marcador sem fim", (c) => (c.arquivos[ARQ] = arquivo.replace("<!-- CLASSICO:FIM piloto -->", "")))
reprova("marcador duplicado", (c) => (c.arquivos["src/frontend/outro.svelte"] = arquivo))
reprova("arquivo marcado fora do lock", (c) => (c.arquivos["src/frontend/novo.svelte"] = "<!-- CLASSICO:INICIO outro -->\nx\n<!-- CLASSICO:FIM outro -->"))
reprova("lock apontando para arquivo inexistente", (c) => (c.lock.piloto.arquivo = "src/frontend/nao-existe.svelte"))
reprova("--exigir-blocos com lock vazio", (c) => (c.lock = {}), { exigirBlocos: true })
reprova("hash trocado no lock sem CLASSICO_PERMITE", (c) => (c.lock.piloto.sha = "0".repeat(64)))
reprova("bloco que nao existe na ancora (nasceu alterado)", (c) => (c.arquivos[ARQ] = arquivo.replace("antigo", "novo")), { ancoraTexto: ancora })
test("CLASSICO_PERMITE libera so o id citado, e so o hash", () => {
    const c = cenario()
    c.lock.piloto.sha = "0".repeat(64)
    assert.deepEqual(verificar({ ...c, permite: ["piloto"] }), [])
    assert.ok(verificar({ ...c, permite: ["outro"] }).length > 0)
})
test("fatia 0: lock vazio e nenhum bloco passa sem --exigir-blocos", () => {
    assert.deepEqual(verificar({ arquivos: { [ARQ]: "<div></div>" }, lock: {} }), [])
})
