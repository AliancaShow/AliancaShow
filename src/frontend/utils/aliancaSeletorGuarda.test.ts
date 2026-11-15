import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Guardas PERMANENTES da FV-S (a prova de "o Culto não muda" contra a base é o scripts/fvs-guarda.mjs, portão do PR).
//   a  o componente e a lógica não importam atalhos, showActions nem o que escreve na saída, e não escrevem em `outputs`;
//   b  nenhum arquivo da janela de saída importa o seletor; só Projects.svelte o importa;
//   c  todo token da FV-A usado no componente tem fallback;
//   d  sem `:global(` e sem `<svelte:window|body|document>` (nenhuma linha roda no Culto com o popover fechado);
//   e  a lógica não assina store nem cria Date a partir de texto (fuso);
//   f  ouvintes de captura: todo `addEventListener` tem um `removeEventListener` do mesmo evento;
//   g  o popover nunca recebe foco e fechar nunca dá blur().

const FRONT = join(__dirname, "..")
const ler = (rel: string) => readFileSync(join(FRONT, rel), "utf8").replace(/\r\n/g, "\n")
const COMPONENTE = "components/show/SeletorDeCulto.svelte"
const LOGICA = "utils/aliancaSeletorLogica.ts"

function arquivos(dir: string): string[] {
    const saida: string[] = []
    for (const nome of readdirSync(dir)) {
        const p = join(dir, nome)
        if (statSync(p).isDirectory()) saida.push(...arquivos(p))
        else if (/\.(svelte|ts)$/.test(nome)) saida.push(p)
    }
    return saida
}

describe("a: não toca na saída nem nos atalhos", () => {
    for (const f of [COMPONENTE, LOGICA]) {
        it(f, () => {
            const t = ler(f)
            expect(t).not.toMatch(/from\s+["'][^"']*(shortcuts|showActions|OutputHelper|helpers\/output|\/output\/)[^"']*["']/)
            expect(t).not.toMatch(/\boutputs\.(set|update)\b|outputSlideCache|\bclearAll\b/)
        })
    }
    it("o caminho de escolher o dia é o mesmo da faixa antiga (openProject), sem escrita própria em stores de saída", () => {
        const t = ler(COMPONENTE)
        expect(t).toMatch(/openProject\(id\)/)
        expect(t).toMatch(/projectView\.set\(false\)/)
    })
})

describe("b: quem importa o seletor", () => {
    const saida = [join(FRONT, "MainOutput.svelte"), ...arquivos(join(FRONT, "components/output"))].filter((p) => {
        try {
            return statSync(p).isFile()
        } catch {
            return false
        }
    })
    it("a janela de saída não importa", () => {
        expect(saida.length).toBeGreaterThan(3)
        for (const p of saida) expect(readFileSync(p, "utf8"), p).not.toMatch(/SeletorDeCulto|aliancaSeletor/)
    })
    it("só show/Projects.svelte importa o componente", () => {
        for (const p of arquivos(FRONT)) {
            if (p.endsWith("SeletorDeCulto.svelte")) continue
            const t = readFileSync(p, "utf8")
            if (/import[^\n]*\/SeletorDeCulto\.svelte["']/.test(t)) expect(p.replace(/\\/g, "/"), p).toMatch(/components\/show\/Projects\.svelte$/)
        }
    })
})

describe("c: tokens da FV-A com fallback", () => {
    const tokens = ["live-opacity", "live", "sel-wash", "sel-line", "conteudo-acento", "modo-culto-texto", "modo-culto", "modo-prep-texto", "modo-prep-brilho0", "modo-prep-brilho", "modo-prep", "prep-rgb", "prep", "aviso", "sobre-acento", "focus-ring", "glass-line"]
    it(COMPONENTE, () => {
        const t = ler(COMPONENTE)
        const re = new RegExp(`var\\(--(${tokens.join("|")})\\s*([,)])`, "g")
        let m
        while ((m = re.exec(t))) expect(m[2], `--${m[1]} sem fallback`).toBe(",")
    })
})

describe("d: nada ligado com o popover fechado", () => {
    it("sem :global( e sem svelte:window/body/document", () => {
        const t = ler(COMPONENTE)
        expect(t).not.toMatch(/:global\(/)
        expect(t).not.toMatch(/<svelte:(window|body|document)/)
    })
})

describe("e: a lógica é pura", () => {
    const t = ler(LOGICA)
    it("sem store e sem assinatura", () => {
        expect(t).not.toMatch(/from\s+["'][^"']*stores["']/)
        expect(t).not.toMatch(/\.subscribe\(/)
    })
    it("sem Date a partir de texto e sem ISO (fuso)", () => {
        expect(t).not.toMatch(/new Date\(\s*["'`]/)
        expect(t).not.toMatch(/toISOString\(/)
    })
})

describe("f: ouvintes em pares", () => {
    const t = ler(COMPONENTE)
    const eventos = (re: RegExp) => [...t.matchAll(re)].map((m) => m[1].trim())
    const adds = eventos(/[^e]addEventListener\(\s*([^,]+),/g)
    const rems = eventos(/removeEventListener\(\s*([^,]+),/g)
    it("todo add tem remove do mesmo evento", () => {
        expect(adds.length).toBeGreaterThan(0)
        for (const ev of new Set(adds)) expect(rems, `sem remove para ${ev}`).toContain(ev)
        expect(rems.length).toBeGreaterThanOrEqual(adds.length)
    })
    it("os de captura no window são removidos com `true`", () => {
        for (const ev of ["keydown", "keyup", "mousedown", "blur", "resize"]) {
            expect(t).toMatch(new RegExp(`window\\.addEventListener\\("${ev}", \\w+, true\\)`))
            expect(t).toMatch(new RegExp(`window\\.removeEventListener\\("${ev}", \\w+, true\\)`))
        }
    })
    it("nenhum ouvinte de ponteiro no window (a camada em tela cheia faz esse trabalho)", () => {
        expect(t).not.toMatch(/window\.addEventListener\("(pointer|mouseup|click|dblclick|auxclick|contextmenu|touch)/)
    })
})

describe("g: foco", () => {
    it("o popover não recebe foco e fechar não dá blur()", () => {
        const t = ler(COMPONENTE)
        expect(t).not.toMatch(/\.focus\(/)
        expect(t).not.toMatch(/\.blur\(/)
    })
})
