import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

// Fatia 6: a guarda da biblioteca vale sempre; so o ▶ e o "Mostrar agora" a levantam.
const RAIZ = join(__dirname, "..", "..", "..")
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8")

const CONVERTIDAS = [
    "src/frontend/components/drawer/audio/AudioFile.svelte",
    "src/frontend/components/drawer/navigation/AudioTabs.svelte",
    "src/frontend/components/drawer/navigation/ScriptureTabs.svelte",
    "src/frontend/components/drawer/bible/Scripture.svelte",
    "src/frontend/components/drawer/media/Media.svelte",
    "src/frontend/components/drawer/media/MediaCard.svelte",
    "src/frontend/components/drawer/pages/Overlays.svelte",
    "src/frontend/components/drawer/pages/Actions.svelte",
    "src/frontend/components/drawer/effects/Effects.svelte",
    "src/frontend/components/inputs/ShowButton.svelte"
]

function arquivos(dir: string, saida: string[] = []): string[] {
    for (const n of readdirSync(dir)) {
        const p = join(dir, n)
        if (statSync(p).isDirectory()) arquivos(p, saida)
        else if (/\.(ts|svelte)$/.test(n)) saida.push(p)
    }
    return saida
}

describe("a guarda da biblioteca (fatia 6)", () => {
    it("as portas da biblioteca importam `gavetaNaoToca` da regra nova, nunca de aliancaModo (que e `tela != mostrar`)", () => {
        for (const f of CONVERTIDAS) {
            const t = ler(f)
            expect(t, f).toMatch(/import \{[^}]*gavetaNaoToca[^}]*\} from "[./]*\/utils\/aliancaGavetaToque"/)
            expect(t, f).not.toMatch(/import \{[^}]*gavetaNaoToca[^}]*\} from "[./]*\/utils\/aliancaModo"/)
        }
    })
    it("marcar para levar ao culto so fora de Mostrar (`podeMarcar`): em Mostrar o clique so seleciona", () => {
        for (const f of CONVERTIDAS.filter((c) => /AudioFile|MediaCard/.test(c))) {
            const t = ler(f)
            for (const m of t.matchAll(/cliqueDeMarcar\(m\)|duploCliqueDeMarcar\(m\)/g)) {
                expect(t.slice(Math.max(0, m.index! - 160), m.index!), `${f} @${m.index}`).toContain("podeMarcar()")
            }
        }
        const sb = ler(CONVERTIDAS.find((c) => c.endsWith("ShowButton.svelte"))!)
        expect(sb).toContain("podeMarcar()) cliqueDeMarcar(")
        expect(sb).toContain("marcavel && podeMarcar()")
    })
    it("so o ▶, o Ctrl+Enter da busca de Sobreposicoes e o \"Mostrar agora\" levantam a guarda (autorizarAr)", () => {
        const usos = arquivos(join(RAIZ, "src", "frontend"))
            .filter((p) => !/\.test\.ts$/.test(p))
            .filter((p) => /autorizarAr\(/.test(readFileSync(p, "utf8")))
            .map((p) => relative(RAIZ, p).split("\\").join("/"))
            .sort()
        expect(usos).toEqual(["src/frontend/components/drawer/media/MediaCard.svelte", "src/frontend/components/drawer/pages/Overlays.svelte", "src/frontend/utils/aliancaGavetaToque.ts"])
    })
    it("o duplo clique na biblioteca e no roteiro e engolido em Mostrar (aliancaToque)", () => {
        const t = ler("src/frontend/utils/aliancaToque.ts")
        expect(t).toMatch(/ITEM_DO_CENTRO = '[^']*biblioteca[^']*roteiro[^']*'|ITEM_DO_CENTRO = '[^']*roteiro[^']*biblioteca[^']*'/)
    })
    it("revisao da fatia 6, achado 7: anterior/proximo da Biblia no ar sao transporte, nao item da biblioteca: seguem a regra do teclado (naoEMostrar), nao a guarda do item", () => {
        const t = ler("src/frontend/components/drawer/bible/Scripture.svelte")
        expect(t).toContain("_moveSelection(true, naoEMostrar())")
        expect(t).toContain("_moveSelection(false, naoEMostrar())")
        expect(t).not.toMatch(/_moveSelection\((true|false), gavetaNaoToca\(\)\)/)
    })
})
