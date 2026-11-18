// 1b, secao 9: a guarda de ESCRITORES de `activePage`. `aliancaMolduraEscritores.json` guarda, por arquivo, a lista ordenada de argumentos de
// cada `activePage.set(`; este teste extrai a mesma lista de todo `.ts` e `.svelte` de src/frontend (sem `.test.ts`) e compara arquivo a arquivo.
// Escritor novo (ou argumento mudado) reprova ate o JSON ser regravado de proposito:
//     REGRAVAR_ESCRITORES=1 npx vitest run --config config/testing/vitest.config.ts src/frontend/utils/aliancaMolduraEscritores.test.ts
// e o diff do JSON aparece no PR. Alem da comparacao, reprova: argumento que nao seja literal de "show"|"edit"|"stage"|"settings" fora da
// lista nomeada de dinamicos; literal "draw" ou "scripture"; `activePage.update(`; `$activePage =` (atribuicao); `bind:` com `$activePage`;
// `$[` com chave variavel fora dos arquivos de DOLAR_COLCHETE.
//
// O QUE ESTA GUARDA NAO COBRE: escrita por outro nome (um alias de `activePage`), `activePage.set` montado por texto, e parenteses dentro
// de texto no argumento (a contagem de parenteses leria errado). Linhas que comecam por // ou * ou /* sao ignoradas.
import { readdirSync, readFileSync, statSync, writeFileSync } from "fs"
import { join, relative } from "path"
import { describe, expect, it } from "vitest"

const SRC = join(__dirname, "..")
const JSON_PATH = join(__dirname, "aliancaMolduraEscritores.json")
const LITERAIS = ['"show"', '"edit"', '"stage"', '"settings"']

/** argumentos nao literais permitidos, por arquivo (relativo a src/frontend): o valor vem de fora e a D8 protege o destino */
export const DINAMICOS: Record<string, string[]> = {
    "components/inputs/TopButton.svelte": ["id"],
    "components/quicksearch/quicksearch.ts": ["id as any"],
    "components/helpers/history.ts": ["obj.location!.page"],
    "components/main/Top.svelte": ["user.activePage as any"],
    "components/main/AliancaMenuApp.svelte": ["p"],
    "utils/aliancaMoldura.ts": ["alvoSeguro()", "alvo"]
}

/**
 * arquivos que usam `$[chave]` (o mapa generico de stores de stores.ts). So `historyStores.ts`, `menuClick.ts` e `update.ts` escrevem (e
 * `update.ts` so e chamado com "media"); `listeners.ts` so le (`get($[...])`). Conferido por leitura na 1b: nenhum desses passa `activePage`.
 */
export const DOLAR_COLCHETE = ["components/helpers/historyStores.ts", "components/context/menuClick.ts", "components/helpers/update.ts", "utils/listeners.ts"]

function arquivos(dir: string, saida: string[] = []): string[] {
    for (const nome of readdirSync(dir)) {
        const p = join(dir, nome)
        if (statSync(p).isDirectory()) arquivos(p, saida)
        else if (/\.(ts|svelte)$/.test(nome) && !/\.test\.ts$/.test(nome)) saida.push(p)
    }
    return saida
}

export function lerTudo(): Record<string, string> {
    const o: Record<string, string> = {}
    for (const p of arquivos(SRC)) o[relative(SRC, p).replace(/\\/g, "/")] = readFileSync(p, "utf8").replace(/\r\n/g, "\n")
    return o
}

/** troca por linha vazia o que e comentario de linha inteira (a contagem nao enxerga comentario) */
const semComentarios = (src: string) =>
    src
        .split("\n")
        .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l))
        .join("\n")

/** o texto entre os parenteses que abrem em `abre` (indice do `(`) e o fecho correspondente, sem espacos nas pontas */
function argumento(src: string, abre: number): string {
    let n = 0
    for (let i = abre; i < src.length; i++) {
        if (src[i] === "(") n++
        else if (src[i] === ")" && --n === 0) return src.slice(abre + 1, i).trim()
    }
    return src.slice(abre + 1).trim()
}

export function extrairEscritores(textos: Record<string, string>): Record<string, string[]> {
    const saida: Record<string, string[]> = {}
    for (const [arq, bruto] of Object.entries(textos).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
        const src = semComentarios(bruto)
        const args: string[] = []
        for (const m of src.matchAll(/activePage\.set\(/g)) args.push(argumento(src, m.index! + m[0].length - 1))
        if (args.length) saida[arq] = args
    }
    return saida
}

export function problemasDosEscritores(textos: Record<string, string>, esperado: Record<string, string[]>): string[] {
    const erros: string[] = []
    const real = extrairEscritores(textos)
    for (const arq of new Set([...Object.keys(real), ...Object.keys(esperado)])) {
        if (JSON.stringify(real[arq] || []) !== JSON.stringify(esperado[arq] || [])) erros.push(`${arq}: escritores de activePage mudaram (esperado ${JSON.stringify(esperado[arq] || [])}, achei ${JSON.stringify(real[arq] || [])})`)
    }
    for (const [arq, args] of Object.entries(real)) {
        for (const a of args) {
            if (a === '"draw"' || a === '"scripture"') erros.push(`${arq}: activePage.set(${a}) (Desenhar e Biblia em tela cheia nao abrem no Preparar)`)
            else if (!LITERAIS.includes(a) && !(DINAMICOS[arq] || []).includes(a)) erros.push(`${arq}: argumento fora da lista nomeada de dinamicos: activePage.set(${a})`)
        }
    }
    for (const [arq, bruto] of Object.entries(textos)) {
        const src = semComentarios(bruto)
        if (/activePage\.update\(/.test(src)) erros.push(`${arq}: activePage.update(`)
        if (/\$activePage\s*=(?!=)/.test(src)) erros.push(`${arq}: $activePage = (atribuicao)`)
        if (/bind:[A-Za-z:]*=\{\s*\$activePage/.test(src)) erros.push(`${arq}: bind: com $activePage`)
        if (/\$\[/.test(src) && !DOLAR_COLCHETE.includes(arq)) erros.push(`${arq}: $[ com chave variavel fora de ${DOLAR_COLCHETE.join(", ")}`)
    }
    return erros
}

const REAL = lerTudo()
if (process.env.REGRAVAR_ESCRITORES) writeFileSync(JSON_PATH, JSON.stringify(extrairEscritores(REAL), null, 4) + "\n")
const ESPERADO: Record<string, string[]> = JSON.parse(readFileSync(JSON_PATH, "utf8"))

describe("escritores de activePage (secao 9)", () => {
    it("o JSON bate com o codigo, arquivo a arquivo, e nada foge das regras", () => {
        expect(problemasDosEscritores(REAL, ESPERADO)).toEqual([])
    })
    it("o JSON esta em ordem de arquivo (diff estavel)", () => {
        const chaves = Object.keys(ESPERADO)
        expect(chaves).toEqual([...chaves].sort())
    })
    it("depois da 1b `shortcuts.ts` nao tem escritor dinamico", () => {
        for (const a of ESPERADO["utils/shortcuts.ts"] || []) expect(LITERAIS).toContain(a)
    })
    it("os dinamicos nomeados existem de verdade (lista sem entrada morta)", () => {
        for (const [arq, args] of Object.entries(DINAMICOS)) for (const a of args) if (REAL[arq] !== undefined) expect(ESPERADO[arq] || [], arq).toContain(a)
    })

    describe("mutacoes (texto injetado)", () => {
        const com = (arq: string, texto: string) => ({ ...REAL, [arq]: (REAL[arq] || "") + "\n" + texto })
        it('activePage.set("draw") em um .svelte reprova', () => {
            expect(problemasDosEscritores(com("components/main/Top.svelte", 'function x() { activePage.set("draw") }'), ESPERADO).length).toBeGreaterThan(0)
        })
        it('activePage.set("scripture") reprova', () => {
            expect(problemasDosEscritores(com("components/main/Top.svelte", 'activePage.set("scripture")'), ESPERADO).join()).toContain("scripture")
        })
        it("escritor novo literal valido tambem reprova ate regravar o JSON", () => {
            expect(problemasDosEscritores(com("components/main/Top.svelte", 'activePage.set("show")'), ESPERADO).join()).toContain("mudaram")
        })
        it("argumento variavel fora da lista reprova", () => {
            expect(problemasDosEscritores(com("components/main/Top.svelte", "activePage.set(qualquer)"), ESPERADO).join()).toContain("fora da lista nomeada")
        })
        it("activePage.update(, $activePage = e bind: reprovam", () => {
            expect(problemasDosEscritores(com("components/main/Top.svelte", "activePage.update((a) => a)"), ESPERADO).join()).toContain("update")
            expect(problemasDosEscritores(com("components/main/Top.svelte", '$activePage = "draw"'), ESPERADO).join()).toContain("atribuicao")
            expect(problemasDosEscritores(com("components/main/Top.svelte", "<input bind:value={$activePage} />"), ESPERADO).join()).toContain("bind")
        })
        it("$activePage === nao e atribuicao", () => {
            expect(problemasDosEscritores(com("components/main/Top.svelte", '{#if $activePage === "show"}x{/if}'), ESPERADO).join()).not.toContain("atribuicao")
        })
        it("$[chave] fora dos arquivos permitidos reprova", () => {
            expect(problemasDosEscritores(com("components/main/Top.svelte", "$[id].set(1)"), ESPERADO).join()).toContain("$[")
        })
        it("comentario nao conta", () => {
            expect(problemasDosEscritores(com("components/main/Top.svelte", '// activePage.set("draw")'), ESPERADO)).toEqual([])
        })
    })
})
