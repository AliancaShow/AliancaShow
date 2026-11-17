// Q11 (1a): o `<script>` do Top e o ramo do Culto do markup ficam travados contra a ancora (6d96af4). O Top e a barra do Culto: o
// operador no meio do culto nao pode ganhar um botao novo nem perder um debaixo do dedo. So entram `PrepararBarra`, `AnteparoDeModo` e
// `modoAlianca` (nos imports), e o ramo `{#if $modoAlianca === "preparar"}` ... `{:else}` <markup do Culto, so com um nivel a mais de recuo> `{/if}`.
//
// O QUE ESTA GUARDA NAO COBRE: o CSS do Top (o `<style>` pode mudar; a aparencia do Culto e do portao de aparencia) e imports que
// citam os tres nomes permitidos por engano junto de outros.
import { execFileSync } from "child_process"
import { createHash } from "crypto"
import { readFileSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"

const RAIZ = join(__dirname, "..", "..", "..")
const ARQ = "src/frontend/components/main/Top.svelte"
const ANCORA = "6d96af4"
/** SHA-256 do <script> sem as linhas `    import ` e do markup do Culto (centro e direita), calculados de `git show 6d96af4:...Top.svelte` (CRLF -> LF) antes de codar a 1a */
export const SHA_SCRIPT_SEM_IMPORTS = "c80087b839e97cd7e0e4b2888286f0ab35674db40ba3064eae7a6bc3e0f3cecb"
export const SHA_RAMO_DO_CULTO = "74b1a8782d8f315e90f41189aeea07ce950c9fda6b2c5f0424afb029e1d2d1fd"
const NOMES_PERMITIDOS = ["PrepararBarra", "AnteparoDeModo", "modoAlianca"]

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex")
const lf = (s: string) => s.replace(/\r\n/g, "\n")
const lerTop = () => lf(readFileSync(join(RAIZ, ARQ), "utf8"))

export function scriptDe(src: string): string {
    const ini = src.indexOf('<script lang="ts">') + '<script lang="ts">'.length
    return src.slice(ini, src.indexOf("</script>"))
}
export const scriptSemImports = (src: string) =>
    scriptDe(src)
        .split("\n")
        .filter((l) => !l.startsWith("    import "))
        .join("\n")
export const linhasDeImport = (src: string) =>
    scriptDe(src)
        .split("\n")
        .filter((l) => l.startsWith("    import "))

/** o texto entre `{:else}` e o `{/if}` que fecha o ramo, com um nivel de recuo a menos em cada linha */
export function ramoDoCulto(src: string): string | null {
    const ini = src.indexOf('{#if $modoAlianca === "preparar"}')
    if (ini < 0) return null
    const else_ = src.indexOf("{:else}\n", ini)
    const fim = src.indexOf("    {/if}\n    <AnteparoDeModo />", else_)
    if (else_ < 0 || fim < 0) return null
    return src
        .slice(else_ + "{:else}\n".length, fim)
        .split("\n")
        .map((l) => (l.startsWith("    ") ? l.slice(4) : l))
        .join("\n")
}

const existeAncora = () => {
    try {
        execFileSync("git", ["cat-file", "-e", `${ANCORA}^{commit}`], { cwd: RAIZ, stdio: "ignore" })
        return true
    } catch {
        return false
    }
}

describe("Top: script e ramo do Culto travados (Q11)", () => {
    it("o script sem as linhas de import tem o SHA da ancora", () => {
        expect(sha(scriptSemImports(lerTop()))).toBe(SHA_SCRIPT_SEM_IMPORTS)
    })
    it("as linhas de import novas citam so PrepararBarra, AnteparoDeModo e modoAlianca", () => {
        const ancora = existeAncora() ? new Set(linhasDeImport(lf(execFileSync("git", ["show", `${ANCORA}:${ARQ}`], { cwd: RAIZ, encoding: "utf8" })))) : null
        const novas = ancora ? linhasDeImport(lerTop()).filter((l) => !ancora.has(l)) : linhasDeImport(lerTop()).filter((l) => NOMES_PERMITIDOS.some((n) => l.includes(n)))
        expect(novas.length).toBeGreaterThan(0)
        for (const l of novas) {
            expect(
                NOMES_PERMITIDOS.some((n) => l.includes(n)),
                l
            ).toBe(true)
            // a lista de ../../stores so ganha modoAlianca: tirada ela, e a linha antiga
            if (l.includes("../../stores")) expect(l.replace("modoAlianca, ", "")).toBe(linhasDeImport(lf(execFileSync("git", ["show", `${ANCORA}:${ARQ}`], { cwd: RAIZ, encoding: "utf8" }))).find((x) => x.includes("../../stores")))
        }
    })
    it("o ramo do Culto e igual (SHA) ao markup do centro e da direita da ancora", () => {
        const r = ramoDoCulto(lerTop())
        expect(r).not.toBeNull()
        expect(sha(r!)).toBe(SHA_RAMO_DO_CULTO)
    })
    it("os SHAs conferem com o git show da ancora (quando o commit existe)", () => {
        if (!existeAncora()) return
        const t = lf(execFileSync("git", ["show", `${ANCORA}:${ARQ}`], { cwd: RAIZ, encoding: "utf8" }))
        expect(sha(scriptSemImports(t))).toBe(SHA_SCRIPT_SEM_IMPORTS)
        const ini = t.indexOf('    <span>\n        <TopButton id="show" />')
        const fim = t.indexOf("    </span>\n</div>\n\n<style>") + "    </span>\n".length
        expect(sha(t.slice(ini, fim))).toBe(SHA_RAMO_DO_CULTO)
    })
    it('um so class="top panel" em src/frontend, e o 1o elemento dentro dele e o span que contem AliancaModo', () => {
        const arquivos = execFileSync("git", ["ls-files", "src/frontend"], { cwd: RAIZ, encoding: "utf8" })
            .split("\n")
            .filter((f) => /\.svelte$/.test(f))
        const com = arquivos.filter((f) => /class="top panel"/.test(readFileSync(join(RAIZ, f), "utf8")))
        expect(com).toEqual([ARQ])
        const t = lerTop()
        const i = t.indexOf('<div class="top panel"')
        const depois = t.slice(i)
        const primeiro = depois.slice(depois.indexOf(">") + 1)
        // pula comentarios HTML e espacos, e o 1o elemento tem de ser <span>
        const semComentario = primeiro.replace(/^(\s|<!--[\s\S]*?-->)*/, "")
        expect(semComentario.startsWith("<span")).toBe(true)
        // o span da esquerda vai ate o ramo por modo (os spans internos da marca fecham antes)
        expect(semComentario.slice(0, semComentario.indexOf('{#if $modoAlianca === "preparar"}'))).toContain("<AliancaModo")
    })
    it("a guarda morde: um caractere no script, o `transition:slide` do .click_again e o import de outputs reprovam", () => {
        const t = lerTop()
        expect(sha(scriptSemImports(t.replace("let confirm = false", "let confirm = true")))).not.toBe(SHA_SCRIPT_SEM_IMPORTS)
        const r = ramoDoCulto(t)!
        expect(sha(r.replace('<div class="click_again" transition:slide>', '<div class="click_again">'))).not.toBe(SHA_RAMO_DO_CULTO)
        const novas = linhasDeImport(t.replace('import AliancaModo from "./AliancaModo.svelte"', 'import { outputs } from "../../stores"\n    import AliancaModo from "./AliancaModo.svelte"'))
        expect(novas.some((l) => l.includes("{ outputs }") && !NOMES_PERMITIDOS.some((n) => l.includes(n)))).toBe(true)
        // um <div> antes do 1o <span>
        const comDiv = t.replace('<div class="top panel" class:drag={!isWindows}>', '<div class="top panel" class:drag={!isWindows}>\n    <div />')
        const depois = comDiv.slice(comDiv.indexOf('<div class="top panel"'))
        const prim = depois.slice(depois.indexOf(">") + 1).replace(/^(\s|<!--[\s\S]*?-->)*/, "")
        expect(prim.startsWith("<span")).toBe(false)
    })
})
