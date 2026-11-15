// Prova de que a guarda MORDE: parte de um estado que passa e aplica mutacoes; toda mutacao tem de falhar.
// Roda com `node --test scripts/fv-guarda.test.mjs` (faz parte de `npm run test:fv`).
import test from "node:test"
import assert from "node:assert/strict"
import { MARCA_FIM, MARCA_INICIO, resolverTokens, rodar, tirarBlocoFv, verificar } from "./fv-guarda.mjs"

const BASE_SHA = "8abf346"
const clone = (x) => JSON.parse(JSON.stringify(x))

// ---------- unidade: o resolvedor de tokens ----------
test("resolverTokens: parenteses balanceados, nao regex", () => {
    const t = ["--live", "--live-opacity", "--prep-rgb", "--aviso"]
    assert.equal(resolverTokens("a: var(--live, var(--secondary));", t).texto, "a: var(--secondary);")
    assert.equal(resolverTokens("b: rgb(var(--prep-rgb, 224 160 48) / 0.2);", t).texto, "b: rgb(224 160 48 / 0.2);")
    assert.equal(resolverTokens("c: var(--live-opacity, var(--secondary-opacity));", t).texto, "c: var(--secondary-opacity);")
    assert.equal(resolverTokens("d: var(--outro, 1px);", t).texto, "d: var(--outro, 1px);", "var que nao e do manifesto fica")
    assert.deepEqual(resolverTokens("e: var(--live);", t).semFallback, ["--live"])
    assert.equal(resolverTokens("f: var(--aviso, var(--live, red));", t).texto, "f: red;", "token dentro de fallback de token")
})

test("tirarBlocoFv: marcadores unicos e em ordem", () => {
    assert.equal(tirarBlocoFv(`a{}\n\n${MARCA_INICIO}\nb{}\n${MARCA_FIM}\n`)?.trim(), "a{}")
    assert.equal(tirarBlocoFv("a{}"), null)
    assert.equal(tirarBlocoFv(`${MARCA_FIM}\n${MARCA_INICIO}`), null)
    assert.equal(tirarBlocoFv(`${MARCA_INICIO}${MARCA_FIM}${MARCA_INICIO}${MARCA_FIM}`), null)
})

// ---------- cenario sintetico (nao depende do repositorio) ----------
function sintetico() {
    const svBase = '<script lang="ts">\n    let a = 1\n</script>\n\n<div style="border: 1px solid var(--secondary);">x</div>\n\n<style>\n    .a {\n        color: var(--secondary);\n        background: rgb(224 160 48 / 0.2);\n    }\n</style>\n'
    const svHead = svBase.replace("border: 1px solid var(--secondary);", "border: 1px solid var(--live, var(--secondary));").replace("color: var(--secondary);", "color: var(--conteudo-acento, var(--secondary));").replace("rgb(224 160 48 / 0.2)", "rgb(var(--prep-rgb, 224 160 48) / 0.2)")
    const arq = "src/frontend/components/x/A.svelte"
    const manifesto = {
        tokens: ["--live", "--conteudo-acento", "--prep-rgb"],
        entradas: [
            { arquivo: arq, antes: "border: 1px solid var(--secondary);", depois: "border: 1px solid var(--live, var(--secondary));", ocorrencias: 1 },
            { arquivo: arq, antes: "color: var(--secondary);", depois: "color: var(--conteudo-acento, var(--secondary));", ocorrencias: 1 },
            { arquivo: arq, antes: "rgb(224 160 48 / 0.2)", depois: "rgb(var(--prep-rgb, 224 160 48) / 0.2)", ocorrencias: 1 }
        ]
    }
    const cssBase = "body {\n    color: red;\n}\n"
    const cssHead = `${cssBase}\n${MARCA_INICIO}\nbody[data-tema="padrao"] {\n    --live: #f21a27;\n}\n${MARCA_FIM}\n`
    const stBase = "async function startupMain() {\n    setLanguage()\n}\n"
    const stHead = "// FV-A: o tema\nimport { iniciarTemaAlianca } from './aliancaTema'\nasync function startupMain() {\n    iniciarTemaAlianca()\n    setLanguage()\n}\n"
    return {
        manifesto,
        alterados: [
            { caminho: arq, status: "M" },
            { caminho: "public/global.css", status: "M" },
            { caminho: "src/frontend/utils/startup.ts", status: "M" },
            { caminho: "src/frontend/utils/aliancaTema.ts", status: "A" }
        ],
        base: { [arq]: svBase, "public/global.css": cssBase, "src/frontend/utils/startup.ts": stBase, "src/frontend/utils/aliancaTema.ts": null },
        head: { [arq]: svHead, "public/global.css": cssHead, "src/frontend/utils/startup.ts": stHead, "src/frontend/utils/aliancaTema.ts": "export {}" },
        arq
    }
}

// mutacoes: cada uma recebe um cenario e o estraga de um jeito que a guarda TEM de pegar
function mutacoes(arq) {
    const a = arq
    return {
        "troca um fallback": (c) => (c.head[a] = c.head[a].replace("var(--live, var(--secondary))", "var(--live, var(--primary))")),
        "token sem fallback": (c) => (c.head[a] = c.head[a].replace("var(--live, var(--secondary))", "var(--live)")),
        "mexe numa linha de <script>": (c) => (c.head[a] = c.head[a].replace(/<script[^>]*>\n/, (m) => m + "    let intruso = 2\n")),
        "mexe na marcacao": (c) => (c.head[a] = c.head[a] + "<span>novo</span>\n"),
        "mexe numa regra do <style> fora do manifesto": (c) => (c.head[a] = c.head[a].replace("</style>", "    .b {\n        color: red;\n    }\n</style>")),
        "muda a alfa de um rgb": (c) => (c.head[a] = c.head[a].replace("/ 0.2)", "/ 0.3)")),
        "troca o valor de um fallback de rgb": (c) => (c.head[a] = c.head[a].replace("224 160 48) / 0.2", "224 160 49) / 0.2")),
        "global.css: hunk fora do bloco": (c) => (c.head["public/global.css"] = c.head["public/global.css"].replace("color: red;", "color: blue;")),
        "global.css: hunk depois do FIM": (c) => (c.head["public/global.css"] += "body {\n    color: pink;\n}\n"),
        "global.css: sem marcadores": (c) => (c.head["public/global.css"] = c.head["public/global.css"].replace(MARCA_INICIO, "").replace(MARCA_FIM, "")),
        "arquivo fora da lista": (c) => {
            c.alterados.push({ caminho: "src/frontend/App.svelte", status: "M" })
            c.base["src/frontend/App.svelte"] = "<main></main>"
            c.head["src/frontend/App.svelte"] = "<main>x</main>"
        },
        ".svelte alterado fora do manifesto": (c) => {
            c.alterados.push({ caminho: "src/frontend/components/y/B.svelte", status: "M" })
            c.base["src/frontend/components/y/B.svelte"] = "<b></b>"
            c.head["src/frontend/components/y/B.svelte"] = "<b>x</b>"
        },
        "arquivo do manifesto revertido (nao mudou)": (c) => (c.head[a] = c.base[a]),
        "startup.ts: mexe em outra linha": (c) => (c.head["src/frontend/utils/startup.ts"] = c.head["src/frontend/utils/startup.ts"].replace("setLanguage()", "setLanguage(1)")),
        "manifesto vazio": (c) => (c.manifesto.entradas = []),
        "manifesto sem tokens": (c) => (c.manifesto.tokens = []),
        "refs iguais: head = base": (c) => {
            c.head = clone(c.base)
            c.alterados = []
        },
        "arquivo removido": (c) => c.alterados.find((x) => x.caminho === a) && (c.alterados.find((x) => x.caminho === a).status = "D")
    }
}

test("sintetico: o estado bom passa", () => {
    const c = sintetico()
    assert.deepEqual(verificar(c), [])
})

for (const [nome, fn] of Object.entries(mutacoes("src/frontend/components/x/A.svelte"))) {
    test(`sintetico, mutacao morde: ${nome}`, () => {
        const c = clone(sintetico())
        fn(c)
        const erros = verificar(c)
        assert.ok(erros.length > 0, `a guarda deixou passar: ${nome}`)
    })
}

// ---------- o repositorio de verdade ----------
test("real: a arvore de trabalho passa contra a base", () => {
    const r = rodar(BASE_SHA, null)
    assert.deepEqual(r.erros, [])
    assert.ok(r.manifesto.entradas.length > 0)
})

test("real: mutacoes na arvore real, todas pegas", () => {
    const base = rodar(BASE_SHA, null)
    assert.deepEqual(base.erros, [])
    const svelte = [...new Set(base.manifesto.entradas.map((e) => e.arquivo))]
    const alvo = "src/frontend/components/inputs/ShowButton.svelte"
    assert.ok(svelte.includes(alvo))
    const m = mutacoes(alvo)
    // so as que fazem sentido no arquivo real (as que dependem de textos do cenario sintetico trocam por equivalentes)
    const reais = {
        "fallback trocado": (c) => (c.head[alvo] = c.head[alvo].replace(/var\(--live, var\(--secondary\)\)/, "var(--live, var(--primary))")),
        "token sem fallback": (c) => (c.head[alvo] = c.head[alvo].replace(/var\(--live, var\(--secondary\)\)/, "var(--live)")),
        "linha de script": (c) => (c.head[alvo] = c.head[alvo].replace(/<script[^>]*>\n?/, (x) => x + "\n    let intruso = 2\n")),
        marcacao: (c) => (c.head[alvo] = c.head[alvo].replace("</script>", "</script>\n<i></i>")),
        "regra nova no style": (c) => (c.head[alvo] = c.head[alvo].replace("</style>", "    .zz {\n        color: red;\n    }\n</style>")),
        "global.css fora do bloco": (c) => (c.head["public/global.css"] = "/* x */\n" + c.head["public/global.css"]),
        "global.css sem marcador": (c) => (c.head["public/global.css"] = c.head["public/global.css"].replace(MARCA_INICIO, "")),
        "outro arquivo": (c) => {
            c.alterados.push({ caminho: "src/frontend/App.svelte", status: "M" })
            c.base["src/frontend/App.svelte"] = "a"
            c.head["src/frontend/App.svelte"] = "b"
        },
        "manifesto vazio": m["manifesto vazio"],
        "head = base": (c) => {
            c.head = clone(c.base)
            c.alterados = []
        }
    }
    let n = 0
    for (const [nome, fn] of Object.entries(reais)) {
        const c = clone({ manifesto: base.manifesto, alterados: base.alterados, base: base.base, head: base.head })
        fn(c)
        const erros = verificar(c)
        assert.ok(erros.length > 0, `mutacao real passou calada: ${nome}`)
        n++
    }
    assert.equal(n, Object.keys(reais).length)
})
