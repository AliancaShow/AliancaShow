// Prova de que a guarda da FV-S MORDE: parte de um estado que passa e aplica mutacoes; toda mutacao tem de falhar.
// Roda com `node --test scripts/fvs-guarda.test.mjs` (faz parte de `npm run test:fvs`).
// Escrita ANTES do codigo da fatia. O cenario e sintetico, mas usa o manifesto REAL (os `antes` reais, o prefixo e o sufixo reais).
import test from "node:test"
import assert from "node:assert/strict"
import { PARES_FIXOS, PROJECTS, carregarManifesto, checarComponente, checarLogica, construirDepois, recuar, sha, verificar } from "./fvs-guarda.mjs"

const clone = (x) => JSON.parse(JSON.stringify(x))
const manifesto = carregarManifesto()
const par = (id) => manifesto.arquivos[0].pares.find((p) => p.id === id)
const COMP = "src/frontend/components/show/SeletorDeCulto.svelte"
const LOG = "src/frontend/utils/aliancaSeletorLogica.ts"

// ---------- unidade ----------
test("sha: ignora CRLF", () => assert.equal(sha("a\r\nb"), sha("a\nb")))
test("recuar: so linhas nao vazias", () => assert.equal(recuar("a\n\nb", 4), "    a\n\n    b"))
test("manifesto real: prefixo, sufixo e recuo batem com os fixos do script", () => {
    for (const p of manifesto.arquivos[0].pares) {
        assert.equal(sha(p.prefixo), PARES_FIXOS[p.id].prefixo, p.id)
        assert.equal(sha(p.sufixo), PARES_FIXOS[p.id].sufixo, p.id)
        assert.equal(p.recuo, PARES_FIXOS[p.id].recuo, p.id)
    }
})

// ---------- cenario sintetico ----------
function sintetico() {
    const mkBase = () => `<script lang="ts">\n    import Icon from "../helpers/Icon.svelte"\n${par("importacao").antes}\n</script>\n\n<div class="main">\n    {#if !$focusMode}\n${par("faixa").antes}\n    {/if}\n    <div class="options">\n        <MaterialTextInput />\n${par("interruptor").antes}\n    </div>\n</div>\n\n<style>\n    .agendas {\n        color: red;\n    }\n</style>\n`
    const base = mkBase()
    let head = base
    for (const p of manifesto.arquivos[0].pares) head = head.split(p.antes).join(construirDepois(p))
    const pkBase = '{\n    "scripts": {\n        "test:fvb": "x"\n    }\n}\n'
    const pkHead = '{\n    "scripts": {\n        "test:fvb": "x",\n        "test:fvs": "y"\n    }\n}\n'
    const comp = `<script lang="ts">\n    import { onDestroy } from "svelte"\n    function abrir() {\n        window.addEventListener("keydown", tecla, true)\n    }\n    function fechar() {\n        window.removeEventListener("keydown", tecla, true)\n    }\n</script>\n<div />\n`
    return {
        manifesto: clone(manifesto),
        alterados: [
            { caminho: PROJECTS, status: "M" },
            { caminho: "package.json", status: "M" },
            { caminho: COMP, status: "A" },
            { caminho: LOG, status: "A" },
            { caminho: "scripts/fvs-guarda.mjs", status: "A" }
        ],
        base: { [PROJECTS]: base, "package.json": pkBase, [COMP]: null, [LOG]: null, "scripts/fvs-guarda.mjs": null },
        head: { [PROJECTS]: head, "package.json": pkHead, [COMP]: comp, [LOG]: "export const x = 1\n", "scripts/fvs-guarda.mjs": "//" }
    }
}

test("sintetico: o estado bom passa", () => {
    assert.deepEqual(verificar(sintetico()), [])
})

const ELSE_LINHA = '                <button type="button" role="tab" class:ativa={agendaAtiva === aba.id} aria-selected={agendaAtiva === aba.id} on:click={() => escolherAba(aba.id)}>{aba.nome}</button>'
const mutacoes = {
    // as do plano (4.1)
    "acrescenta linha fora do par": (c) => (c.head[PROJECTS] = c.head[PROJECTS].replace("    {#if !$focusMode}", "    <i></i>\n    {#if !$focusMode}")),
    "muda uma linha dentro do ramo {:else}": (c) => (c.head[PROJECTS] = c.head[PROJECTS].replace(ELSE_LINHA.replace(/^ {16}/, "                    "), ELSE_LINHA.replace(/^ {16}/, "                    ").replace("{aba.nome}", "{aba.nome}!"))),
    "tira o {:else} (o ramo antigo some)": (c) => (c.head[PROJECTS] = c.head[PROJECTS].replace("        {:else}\n", "")),
    "envolve outro bloco no mesmo estilo": (c) => (c.head[PROJECTS] = c.head[PROJECTS].replace("        <MaterialTextInput />", "        {#if x}\n        <MaterialTextInput />\n        {/if}")),
    "edita o <style> de Projects": (c) => (c.head[PROJECTS] = c.head[PROJECTS].replace("color: red;", "color: blue;")),
    "marcador sem par (par some do head)": (c) => (c.head[PROJECTS] = c.head[PROJECTS].replace('\n    import SeletorDeCulto from "./SeletorDeCulto.svelte"', "")),
    "tira um par do manifesto": (c) => (c.manifesto.arquivos[0].pares = c.manifesto.arquivos[0].pares.filter((p) => p.id !== "interruptor")),
    "par extra no manifesto": (c) => c.manifesto.arquivos[0].pares.push({ id: "extra", antes: "x", prefixo: "", sufixo: "", recuo: 0 }),
    "refs iguais: head = base": (c) => {
        c.head = clone(c.base)
        c.alterados = []
    },
    "edita shortcuts.ts": (c) => {
        c.alterados.push({ caminho: "src/frontend/utils/shortcuts.ts", status: "M" })
        c.base["src/frontend/utils/shortcuts.ts"] = "a"
        c.head["src/frontend/utils/shortcuts.ts"] = "b"
    },
    "edita ProjectStrip.svelte": (c) => {
        c.alterados.push({ caminho: "src/frontend/components/show/ProjectStrip.svelte", status: "M" })
        c.base["src/frontend/components/show/ProjectStrip.svelte"] = "a"
        c.head["src/frontend/components/show/ProjectStrip.svelte"] = "b"
    },
    // a excecao do ProjectList e travada pelo SHA do conteudo: qualquer outra mudanca nele reprova
    "ProjectList.svelte alem da excecao travada": (c) => {
        const f = "src/frontend/components/show/ProjectList.svelte"
        const alt = c.head[f] ?? "x"
        c.head[f] = alt + " // a mais"
        if (!c.alterados.some((a) => a.caminho === f)) c.alterados.push({ caminho: f, status: "M" })
    },
    "edita global.css": (c) => {
        c.alterados.push({ caminho: "public/global.css", status: "M" })
        c.base["public/global.css"] = "a"
        c.head["public/global.css"] = "b"
    },
    "arquivo novo fora da lista branca": (c) => {
        c.alterados.push({ caminho: "src/frontend/utils/shortcutsNovo.ts", status: "A" })
        c.base["src/frontend/utils/shortcutsNovo.ts"] = null
        c.head["src/frontend/utils/shortcutsNovo.ts"] = "export {}"
    },
    // as da revisao (C4/I4)
    "altera o {:else} E atualiza o manifesto (o antes)": (c) => {
        const p = c.manifesto.arquivos[0].pares.find((x) => x.id === "faixa")
        const novo = p.antes.replace("{aba.nome}", "{aba.nome}!")
        c.head[PROJECTS] = c.head[PROJECTS].split(recuar(p.antes, 4)).join(recuar(novo, 4))
        p.antes = novo
    },
    "altera o {:else} E o `depois` ja nao vem do manifesto (prefixo mexido)": (c) => {
        const p = c.manifesto.arquivos[0].pares.find((x) => x.id === "faixa")
        const pref = p.prefixo.replace("!== false", "=== true")
        c.head[PROJECTS] = c.head[PROJECTS].replace(p.prefixo, pref)
        p.prefixo = pref
    },
    "sufixo do par alterado no head e no manifesto": (c) => {
        const p = c.manifesto.arquivos[0].pares.find((x) => x.id === "faixa")
        const suf = "\n        {/if}\n        <b />"
        c.head[PROJECTS] = c.head[PROJECTS].replace(p.sufixo, suf)
        p.sufixo = suf
    },
    "interruptor com outro texto (head e manifesto)": (c) => {
        const p = c.manifesto.arquivos[0].pares.find((x) => x.id === "interruptor")
        const suf = p.sufixo.replace("Seletor compacto", "Outro")
        c.head[PROJECTS] = c.head[PROJECTS].replace(p.sufixo, suf)
        p.sufixo = suf
    },
    "o ramo {:else} perde a re-indentacao (fica no nivel do {#if})": (c) => (c.head[PROJECTS] = c.head[PROJECTS].replace(/\n {12}<div class="agendas"/, '\n        <div class="agendas"')),
    "componente: <svelte:window>": (c) => (c.head[COMP] += "<svelte:window on:keydown={x} />\n"),
    "componente: <svelte:body>": (c) => (c.head[COMP] += "<svelte:body />\n"),
    "componente: :global(": (c) => (c.head[COMP] += "<style>\n:global(body) { color: red }\n</style>\n"),
    "componente: importa shortcuts": (c) => (c.head[COMP] = 'import { x } from "../../utils/shortcuts"\n' + c.head[COMP]),
    "componente: importa showActions": (c) => (c.head[COMP] = 'import { x } from "../helpers/showActions"\n' + c.head[COMP]),
    "componente: importa OutputHelper": (c) => (c.head[COMP] = 'import { x } from "../helpers/OutputHelper"\n' + c.head[COMP]),
    "componente: escreve em outputs": (c) => (c.head[COMP] += "outputs.set({})\n"),
    "componente: limpa o telao": (c) => (c.head[COMP] += "clearAll()\n"),
    "componente: addEventListener sem remove": (c) => (c.head[COMP] = c.head[COMP].replace('        window.removeEventListener("keydown", tecla, true)\n', "")),
    "componente: addEventListener solto no modulo": (c) => (c.head[COMP] = 'window.addEventListener("keydown", x)\n' + c.head[COMP]),
    "logica: importa stores": (c) => (c.head[LOG] = 'import { activeProject } from "../stores"\n' + c.head[LOG]),
    "logica: new Date(string)": (c) => (c.head[LOG] += 'const d = new Date("2026-11-15")\n'),
    "logica: toISOString": (c) => (c.head[LOG] += "const d = x.toISOString()\n"),
    "importado por quem nao pode": (c) => {
        c.head["src/frontend/components/output/preview/Preview.svelte"] = 'import X from "../../show/SeletorDeCulto.svelte"'
    },
    "importado pelo MainLayout": (c) => {
        c.head["src/frontend/MainLayout.svelte"] = 'import X from "./components/show/SeletorDeCulto.svelte"'
    },
    "package.json: mexe em outra linha": (c) => (c.head["package.json"] = c.head["package.json"].replace('"test:fvb": "x"', '"test:fvb": "z"')),
    "manifesto vazio": (c) => (c.manifesto.arquivos = []),
    "arquivo do manifesto revertido (nao mudou)": (c) => {
        c.head[PROJECTS] = c.base[PROJECTS]
        c.alterados = c.alterados.filter((a) => a.caminho !== PROJECTS)
    },
    "Projects removido (D)": (c) => (c.alterados.find((x) => x.caminho === PROJECTS).status = "D")
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
    c.head[PROJECTS] = c.head[PROJECTS].replace(/\n/g, "\r\n")
    c.base[PROJECTS] = c.base[PROJECTS].replace(/\n/g, "\r\n")
    assert.deepEqual(verificar(c), [])
})

test("checarComponente: o bom passa; ouvinte dentro de funcao passa", () => {
    assert.deepEqual(checarComponente(COMP, sintetico().head[COMP]), [])
})
test("checarLogica: bom passa", () => assert.deepEqual(checarLogica(LOG, "export const x = 1\n"), []))
