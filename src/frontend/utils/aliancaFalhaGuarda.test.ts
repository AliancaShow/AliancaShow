// Q7 (fatia R2): quebrar ALTO. Todo `catch` e todo `.catch(` dos arquivos da pilha chama `falhaAlta(` ou relanca; a faixa de falha nao
// intercepta clique e nao empurra nada; `aliancaFalha.ts` so importa `svelte/store`.
//
// O QUE ESTA GUARDA NAO COBRE: chaves e parenteses dentro de TEXTO ou modelo de texto podem confundir a contagem do corpo do catch;
// `throw` dentro de texto conta como relancar; so os arquivos de ARQUIVOS_DA_PILHA sao varridos (a 1a e a 1b acrescentam os seus no
// mesmo commit que os cria).
import { readFileSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"

const RAIZ = join(__dirname, "..", "..", "..")
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n")

export const ARQUIVOS_DA_PILHA = [
    "src/frontend/utils/aliancaPorModoLogica.ts",
    "src/frontend/utils/aliancaLayoutEstado.ts",
    "src/frontend/utils/aliancaDrawerTabsLogica.ts",
    "src/frontend/utils/aliancaAbasEditor.ts",
    "src/frontend/utils/aliancaFalha.ts",
    "src/frontend/utils/aliancaQuickSearchLogica.ts",
    "src/frontend/utils/aliancaPilulaLogica.ts",
    "src/frontend/utils/aliancaSaidaMenuLogica.ts",
    "src/frontend/utils/aliancaPilula.ts",
    "src/frontend/components/main/AnteparoDeModo.svelte",
    "src/frontend/components/main/AliancaTela.svelte",
    "src/frontend/components/main/AliancaTopo.svelte",
    "src/frontend/components/main/AliancaTelaoPilula.svelte",
    "src/frontend/components/main/AliancaBibliotecaPainel.svelte"
]

/** os `catch` de aliancaFalha.ts que nao podem chamar falhaAlta (seria ela mesma), marcados na linha do `catch` ou na 1a linha do corpo (o prettier empurra o comentario para la) */
const MARCADOR = "// catch interno de falhaAlta: nao pode lancar"
export const CATCHES_INTERNOS = 6

/** troca por espaco o que e comentario de linha ou de bloco (a contagem de chaves nao enxerga comentario); mantem o resto e as quebras de linha */
function semComentarios(src: string): string {
    return src
        .split("\n")
        .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l))
        .join("\n")
}

/** o trecho que abre em `abre` (indice do caractere de abertura) ate o fecho correspondente */
function ate(src: string, abre: number, a: string, f: string): string {
    let n = 0
    for (let i = abre; i < src.length; i++) {
        if (src[i] === a) n++
        else if (src[i] === f && --n === 0) return src.slice(abre, i + 1)
    }
    return src.slice(abre)
}

type Achado = { arquivo: string; linha: number; tipo: "catch" | ".catch(" }

export function catchesSemFalha(arquivo: string, src: string, ignorarMarcados: boolean): { sem: Achado[]; internos: number } {
    const limpo = semComentarios(src)
    const sem: Achado[] = []
    let internos = 0
    const linhaDe = (i: number) => limpo.slice(0, i).split("\n").length
    const textoDaLinha = (n: number) => src.split("\n")[n - 1] ?? ""
    const ok = (corpo: string) => /\bfalhaAlta\(/.test(corpo) || /\bthrow\b/.test(corpo)
    for (const m of limpo.matchAll(/catch\s*(\([^)]*\))?\s*\{/g)) {
        const abre = m.index! + m[0].length - 1
        const corpo = ate(limpo, abre, "{", "}")
        const linha = linhaDe(m.index!)
        if (ok(corpo)) continue
        if (ignorarMarcados && (textoDaLinha(linha).includes(MARCADOR) || textoDaLinha(linha + 1).trim() === MARCADOR)) {
            internos++
            continue
        }
        sem.push({ arquivo, linha, tipo: "catch" })
    }
    for (const m of limpo.matchAll(/\.catch\(/g)) {
        const abre = m.index! + m[0].length - 1
        const corpo = ate(limpo, abre, "(", ")")
        if (!ok(corpo)) sem.push({ arquivo, linha: linhaDe(m.index!), tipo: ".catch(" })
    }
    return { sem, internos }
}

describe("falha alta (Q7): nenhum catch da pilha engole o erro", () => {
    it("todo catch e .catch( chama falhaAlta( ou relanca", () => {
        const achados: Achado[] = []
        for (const rel of ARQUIVOS_DA_PILHA) achados.push(...catchesSemFalha(rel, ler(rel), rel.endsWith("aliancaFalha.ts")).sem)
        expect(achados).toEqual([])
    })
    it("aliancaFalha.ts: os catches internos marcados sao exatamente CATCHES_INTERNOS", () => {
        const r = catchesSemFalha("aliancaFalha.ts", ler("src/frontend/utils/aliancaFalha.ts"), true)
        expect(r.internos).toBe(CATCHES_INTERNOS)
    })
    it("aliancaFalha.ts: todo import vem de svelte/store e nada assina store fora de funcao", () => {
        const src = ler("src/frontend/utils/aliancaFalha.ts")
        const imports = src.split("\n").filter((l) => /^import\b/.test(l))
        expect(imports.length).toBeGreaterThan(0)
        for (const l of imports) expect(l, l).toMatch(/from\s+["']svelte\/store["']/)
        expect(src.split("\n").filter((l) => /^\S.*\.subscribe\(/.test(l) && !l.startsWith("//"))).toEqual([])
    })
    it("a faixa: fixa, sem clique, sem filho interativo", () => {
        const src = ler("src/frontend/components/main/FaixaDeFalha.svelte")
        const estilo = src.slice(src.indexOf("<style>"))
        const regra = estilo.slice(estilo.indexOf(".faixaFalha"))
        const bloco = regra.slice(0, regra.indexOf("}"))
        expect(bloco).toMatch(/position:\s*fixed/)
        expect(bloco).toMatch(/pointer-events:\s*none/)
        const marcacao = src.slice(src.indexOf("</script>"), src.indexOf("<style>"))
        for (const proibido of [/<button/, /\bon:/, /tabindex/, /\{@html/]) expect(marcacao).not.toMatch(proibido)
    })
    it("a guarda morde: catch vazio, .catch(() => {}) e catch que so loga reprovam", () => {
        expect(catchesSemFalha("x.ts", "try { a() } catch {}", false).sem).toHaveLength(1)
        expect(catchesSemFalha("x.ts", "try { a() } catch (e) { return 1 }", false).sem).toHaveLength(1)
        expect(catchesSemFalha("x.ts", "p.catch(() => {})", false).sem).toHaveLength(1)
        expect(catchesSemFalha("x.ts", "try { a() } catch (e) { console.error(e) }", false).sem).toHaveLength(1)
        expect(catchesSemFalha("x.ts", "try { a() } catch (e) { falhaAlta('o', e) }", false).sem).toHaveLength(0)
        expect(catchesSemFalha("x.ts", "try { a() } catch (e) { throw e }", false).sem).toHaveLength(0)
        expect(catchesSemFalha("x.ts", "p.catch((e) => falhaAlta('o', e))", false).sem).toHaveLength(0)
        expect(catchesSemFalha("x.ts", "// catch { }\ntry { a() } catch (e) { falhaAlta('o', e) }", false).sem).toHaveLength(0)
    })
})
