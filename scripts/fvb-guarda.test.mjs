// Prova de que a guarda MORDE: parte de um estado que passa e aplica mutacoes; toda mutacao tem de falhar.
// Roda com `node --test scripts/fvb-guarda.test.mjs` (faz parte de `npm run test:fvb`).
// Escrita ANTES do codigo da fatia (revisao-fvb.md, C3): o cenario e sintetico e nao depende do repositorio.
import test from "node:test"
import assert from "node:assert/strict"
import { MARCA_HTML_FIM, MARCA_HTML_INICIO, MARCA_TS_FIM, MARCA_TS_INICIO, balanceado, separarBlocos, sha, verificar } from "./fvb-guarda.mjs"

const clone = (x) => JSON.parse(JSON.stringify(x))
const ML = "src/frontend/MainLayout.svelte"
const SH = "src/frontend/components/show/ShowHeader.svelte"
const AE = "src/frontend/utils/aliancaAbasEditor.ts"
const NOVO = "src/frontend/components/main/AliancaAbasLaterais.svelte"

// ---------- unidade ----------
test("separarBlocos: tira so o que esta entre os marcadores, em linha propria", () => {
    const t = `a\n${MARCA_HTML_INICIO}\nX\n${MARCA_HTML_FIM}\nb\n${MARCA_TS_INICIO}\nimport y\n${MARCA_TS_FIM}\nc`
    const r = separarBlocos(t)
    assert.equal(r.resto, "a\nb\nc")
    assert.equal(r.blocos.length, 2)
    assert.deepEqual(r.erros, [])
    assert.equal(r.blocos[0].html, true)
    assert.equal(r.blocos[1].html, false)
})
test("separarBlocos: INICIO sem FIM, FIM sem INICIO, aninhado e marcador com texto junto", () => {
    assert.ok(separarBlocos(`a\n${MARCA_HTML_INICIO}\nb`).erros.length)
    assert.ok(separarBlocos(`a\n${MARCA_HTML_FIM}\nb`).erros.length)
    assert.ok(separarBlocos(`${MARCA_HTML_INICIO}\n${MARCA_HTML_INICIO}\n${MARCA_HTML_FIM}\n${MARCA_HTML_FIM}`).erros.length)
    assert.ok(separarBlocos(`a <!-- FVB:INICIO -->\nb`).erros.length)
    assert.ok(separarBlocos(`${MARCA_HTML_INICIO}\nx\n${MARCA_TS_FIM}`).erros.length, "estilos diferentes")
})
test("balanceado", () => {
    assert.equal(balanceado("{#if a}\n{#each b as c}\n{/each}\n{/if}"), true)
    assert.equal(balanceado("{#if a}\nx"), false)
    assert.equal(balanceado("x\n{/if}"), false)
})
test("sha: ignora CRLF", () => assert.equal(sha("a\r\nb"), sha("a\nb")))

// ---------- cenario sintetico ----------
const BLOCO_MARCACAO = `{#if $modoAlianca === "preparar" && page === "show"}\n    <AliancaAbasLaterais />\n{/if}`
const BLOCO_IMPORT = `import AliancaAbasLaterais from "./components/main/AliancaAbasLaterais.svelte"`

function sintetico() {
    const mlBase = `<script lang="ts">\n    import Top from "./Top.svelte"\n    $: page = $activePage\n</script>\n\n<div class="left panel">\n    {#if page === "show"}\n        <div class="projectsWrap">\n            <Projects />\n        </div>\n        <LibraryTabs />\n    {/if}\n</div>\n\n<style>\n    .left {\n        color: red;\n    }\n</style>\n`
    const mlHead = mlBase.replace("    import Top", `    ${MARCA_TS_INICIO}\n    ${BLOCO_IMPORT}\n    ${MARCA_TS_FIM}\n    import Top`).replace('<div class="left panel">\n', `<div class="left panel">\n    ${MARCA_HTML_INICIO}\n    ${BLOCO_MARCACAO.split("\n").join("\n    ")}\n    ${MARCA_HTML_FIM}\n`)
    const shBase = `<script lang="ts">\n    import Icon from "./Icon.svelte"\n</script>\n\n<div class="right">\n    {#if $modoAlianca === "preparar" && !hideOptions}\n        <b>Dividir</b>\n    {/if}\n</div>\n`
    const shHead = shBase.replace("    import Icon", `    ${MARCA_TS_INICIO}\n    import { abrirEditorDoShow } from "../../utils/aliancaBiblioteca"\n    ${MARCA_TS_FIM}\n    import Icon`).replace('<div class="right">\n', `<div class="right">\n    ${MARCA_HTML_INICIO}\n    {#if $modoAlianca === "preparar"}\n        <b>Editar</b>\n    {/if}\n    ${MARCA_HTML_FIM}\n`)
    const aeAntes1 = 'import { abaAoEntrarNoEditor, abasEscondidasNoEditor } from "./aliancaGavetaLogica"'
    const aeDepois1 = 'import { abaAoEntrarNoEditor } from "./aliancaGavetaLogica"'
    const aeAntes2 = "export const abasEscondidas = derived([modoAlianca], ([$modo]) => new Set(abasEscondidasNoEditor(TODAS, { preparar: $modo === 'preparar' })))"
    const aeDepois2 = "export const abasEscondidas = derived([modoAlianca, abaLateral], ([$modo, $aba]) => new Set(abasEscondidasNaBiblioteca(TODAS, { preparar: $modo === 'preparar', naBiblioteca: $aba === 'biblioteca' })))"
    const aeBase = `${aeAntes1}\nconst TODAS = []\n${aeAntes2}\n`
    const aeHead = `${aeDepois1}\n${MARCA_TS_INICIO}\nimport { abaLateral } from "./aliancaBibliotecaEstado"\n${MARCA_TS_FIM}\nconst TODAS = []\n${aeDepois2}\n`
    const pkBase = '{\n    "scripts": {\n        "test:fv": "x"\n    }\n}\n'
    const pkHead = '{\n    "scripts": {\n        "test:fv": "x",\n        "test:fvb": "y"\n    }\n}\n'
    const manifesto = {
        arquivos: [
            {
                arquivo: ML,
                blocos: [
                    { sha: sha(BLOCO_IMPORT) },
                    {
                        sha: sha(
                            BLOCO_MARCACAO.split("\n")
                                .map((l, i) => (i ? "    " + l : "    " + l))
                                .join("\n")
                        )
                    }
                ],
                pares: []
            },
            { arquivo: SH, blocos: [{ sha: sha('    import { abrirEditorDoShow } from "../../utils/aliancaBiblioteca"') }, { sha: sha('    {#if $modoAlianca === "preparar"}\n        <b>Editar</b>\n    {/if}') }], pares: [] },
            {
                arquivo: AE,
                blocos: [{ sha: sha('import { abaLateral } from "./aliancaBibliotecaEstado"') }],
                pares: [
                    { antes: aeAntes1, depois: aeDepois1 },
                    { antes: aeAntes2, depois: aeDepois2 }
                ]
            }
        ]
    }
    // o SHA do bloco de import do ML tem a indentacao (4 espacos) que o texto tem
    manifesto.arquivos[0].blocos[0].sha = sha("    " + BLOCO_IMPORT)
    return {
        manifesto,
        alterados: [
            { caminho: ML, status: "M" },
            { caminho: SH, status: "M" },
            { caminho: AE, status: "M" },
            { caminho: "package.json", status: "M" },
            { caminho: NOVO, status: "A" },
            { caminho: "src/frontend/utils/aliancaBibliotecaLogica.ts", status: "A" },
            { caminho: "scripts/fvb-guarda.mjs", status: "A" }
        ],
        base: { [ML]: mlBase, [SH]: shBase, [AE]: aeBase, "package.json": pkBase, [NOVO]: null, "src/frontend/utils/aliancaBibliotecaLogica.ts": null, "scripts/fvb-guarda.mjs": null },
        head: { [ML]: mlHead, [SH]: shHead, [AE]: aeHead, "package.json": pkHead, [NOVO]: "<div />", "src/frontend/utils/aliancaBibliotecaLogica.ts": "export {}", "scripts/fvb-guarda.mjs": "//" }
    }
}

test("sintetico: o estado bom passa", () => {
    assert.deepEqual(verificar(sintetico()), [])
})

const mutacoes = {
    // as do plano (5.1)
    "acrescenta linha fora do marcador": (c) => (c.head[ML] = c.head[ML].replace("<LibraryTabs />", "<LibraryTabs />\n        <i></i>")),
    "muda uma linha dentro do <style>": (c) => (c.head[ML] = c.head[ML].replace("color: red;", "color: blue;")),
    "re-indenta o bloco projectsWrap": (c) => (c.head[ML] = c.head[ML].replace('        <div class="projectsWrap">\n            <Projects />\n        </div>', '            <div class="projectsWrap">\n                <Projects />\n            </div>')),
    "envolve Projects num {#if} (com re-indentacao)": (c) => (c.head[ML] = c.head[ML].replace("            <Projects />", "            {#if algo}\n                <Projects />\n            {/if}")),
    "troca o {#if page === show}": (c) => (c.head[ML] = c.head[ML].replace('{#if page === "show"}\n        <div class="projectsWrap">', '{#if page !== "scripture"}\n        <div class="projectsWrap">')),
    "marcador sem fim": (c) => (c.head[ML] = c.head[ML].replace(MARCA_HTML_FIM, "")),
    "marcador fim sem inicio": (c) => (c.head[SH] = c.head[SH].replace(MARCA_HTML_INICIO, "")),
    "arquivo nao listado alterado": (c) => {
        c.alterados.push({ caminho: "src/frontend/components/main/Top.svelte", status: "M" })
        c.base["src/frontend/components/main/Top.svelte"] = "a"
        c.head["src/frontend/components/main/Top.svelte"] = "b"
    },
    "arquivo novo fora da lista branca": (c) => {
        c.alterados.push({ caminho: "src/frontend/utils/shortcutsNovo.ts", status: "A" })
        c.base["src/frontend/utils/shortcutsNovo.ts"] = null
        c.head["src/frontend/utils/shortcutsNovo.ts"] = "export {}"
    },
    "refs iguais: head = base": (c) => {
        c.head = clone(c.base)
        c.alterados = []
    },
    // as da revisao (C3)
    "dois blocos marcados envolvendo Projects SEM re-indentar": (c) => {
        c.head[ML] = c.head[ML].replace('        <div class="projectsWrap">', `        ${MARCA_HTML_INICIO}\n        {#if algo}\n        ${MARCA_HTML_FIM}\n        <div class="projectsWrap">`).replace("        <LibraryTabs />", `        ${MARCA_HTML_INICIO}\n        {/if}\n        ${MARCA_HTML_FIM}\n        <LibraryTabs />`)
    },
    "$: dentro de bloco marcado do <script>": (c) => (c.head[ML] = c.head[ML].replace(`    ${BLOCO_IMPORT}\n`, `    ${BLOCO_IMPORT}\n    $: rodaNoCulto = 1\n`)),
    "bloco marcado dentro do <style>": (c) => (c.head[ML] = c.head[ML].replace("        color: red;\n", `        color: red;\n    ${MARCA_HTML_INICIO}\n    {#if $modoAlianca === "preparar"}\n    .x{}\n    {/if}\n    ${MARCA_HTML_FIM}\n`)),
    "conteudo de bloco alterado sem atualizar o manifesto": (c) => (c.head[ML] = c.head[ML].replace("<AliancaAbasLaterais />", "<AliancaAbasLaterais extra />")),
    "bloco a mais": (c) => (c.head[SH] = c.head[SH].replace("</div>\n", `    ${MARCA_TS_INICIO}\n    import x from "y"\n    ${MARCA_TS_FIM}\n</div>\n`)),
    "bloco a menos (marcadores tirados, conteudo ficou)": (c) => (c.head[ML] = c.head[ML].replace(`    ${MARCA_TS_INICIO}\n`, "").replace(`    ${MARCA_TS_FIM}\n`, "")),
    "bloco de marcacao que nao comeca por {#if $modoAlianca === preparar": (c) => {
        const novo = '{#if page === "show"}\n    <AliancaAbasLaterais />\n{/if}'
        c.head[ML] = c.head[ML].replace(BLOCO_MARCACAO.split("\n").join("\n    "), novo.split("\n").join("\n    "))
        c.manifesto.arquivos[0].blocos[1].sha = sha("    " + novo.split("\n").join("\n    "))
    },
    "bloco de marcacao desbalanceado": (c) => {
        const novo = '{#if $modoAlianca === "preparar"}\n    <AliancaAbasLaterais />'
        c.head[SH] = c.head[SH].replace('    {#if $modoAlianca === "preparar"}\n        <b>Editar</b>\n    {/if}', novo)
        c.manifesto.arquivos[1].blocos[1].sha = sha(novo)
    },
    "bloco de .ts com algo que nao e import": (c) => {
        c.head[AE] = c.head[AE].replace('import { abaLateral } from "./aliancaBibliotecaEstado"', 'import { abaLateral } from "./aliancaBibliotecaEstado"\nconsole.log(1)')
        c.manifesto.arquivos[2].blocos[0].sha = sha('import { abaLateral } from "./aliancaBibliotecaEstado"\nconsole.log(1)')
    },
    "par: o depois some do head": (c) => (c.head[AE] = c.head[AE].replace("abasEscondidasNaBiblioteca", "outra")),
    "par: linha existente alterada alem do par": (c) => (c.head[AE] = c.head[AE].replace("const TODAS = []", "const TODAS = [1]")),
    ".svelte novo importado por quem nao pode": (c) => {
        c.head[SH] = c.head[SH].replace("    import Icon", '    import Y from "./AliancaBiblioteca.svelte"\n    import Icon')
        c.alterados.push({ caminho: "src/frontend/components/main/AliancaBiblioteca.svelte", status: "A" })
        c.base["src/frontend/components/main/AliancaBiblioteca.svelte"] = null
        c.head["src/frontend/components/main/AliancaBiblioteca.svelte"] = "<div />"
    },
    "package.json: mexe em outra linha": (c) => (c.head["package.json"] = c.head["package.json"].replace('"test:fv": "x"', '"test:fv": "z"')),
    "manifesto vazio": (c) => (c.manifesto.arquivos = []),
    "arquivo do manifesto revertido (nao mudou)": (c) => {
        c.head[ML] = c.base[ML]
        c.alterados = c.alterados.filter((a) => a.caminho !== ML)
    },
    "arquivo removido": (c) => (c.alterados.find((x) => x.caminho === SH).status = "D")
}

for (const [nome, fn] of Object.entries(mutacoes)) {
    test(`sintetico, mutacao morde: ${nome}`, () => {
        const c = clone(sintetico())
        fn(c)
        const erros = verificar(c)
        assert.ok(erros.length > 0, `a guarda deixou passar: ${nome}`)
    })
}

test("sintetico: CRLF no head nao conta como mudanca", () => {
    const c = clone(sintetico())
    c.head[ML] = c.head[ML].replace(/\n/g, "\r\n")
    c.base[ML] = c.base[ML].replace(/\n/g, "\r\n")
    assert.deepEqual(verificar(c), [])
})
