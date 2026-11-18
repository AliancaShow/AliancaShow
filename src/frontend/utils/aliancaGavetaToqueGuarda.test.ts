import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

// Fatia 6: a guarda da biblioteca vale sempre; so o ▶ e o "Mostrar agora" a levantam.
const RAIZ = join(__dirname, "..", "..", "..")
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8")

const CONVERTIDAS = [
    "src/frontend/components/drawer/audio/AudioFile.svelte",
    "src/frontend/components/drawer/navigation/ScriptureTabs.svelte",
    "src/frontend/components/drawer/bible/Scripture.svelte",
    "src/frontend/components/drawer/media/Media.svelte",
    "src/frontend/components/drawer/media/MediaCard.svelte",
    "src/frontend/components/drawer/pages/Overlays.svelte",
    "src/frontend/components/drawer/pages/Actions.svelte",
    "src/frontend/components/drawer/effects/Effects.svelte",
    "src/frontend/components/inputs/ShowButton.svelte"
]

// Paineis de controle (nao sao itens da biblioteca): o proprio botao liga/desliga e e o gesto deliberado. Revisao da fatia 6, achado 4, opcao 3: a excecao e
// declarada aqui; uma porta nova com a guarda velha reprova este teste.
const EXCECOES_PAINEL_DE_CONTROLE = ["src/frontend/components/drawer/audio/Metronome.svelte", "src/frontend/components/drawer/pages/OBS.svelte"]

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
    it("revisao da fatia 6, achado 4: NENHUM arquivo de components/drawer/** importa a guarda antiga (aliancaModo), fora das excecoes nomeadas", () => {
        const velhos = arquivos(join(RAIZ, "src", "frontend", "components", "drawer"))
            .filter((p) => !/\.test\.ts$/.test(p))
            .filter((p) => /import \{[^}]*gavetaNaoToca[^}]*\} from "[./]*\/utils\/aliancaModo"/.test(readFileSync(p, "utf8")))
            .map((p) => relative(RAIZ, p).split("\\").join("/"))
            .sort()
        expect(velhos).toEqual(EXCECOES_PAINEL_DE_CONTROLE)
    })
    it("as portas que mandam algo ao ar pelo ▶ usam o TocarAgora (o clique so seleciona)", () => {
        const comTocar = ["pages/Overlays.svelte", "effects/Effects.svelte", "player/PlayerVideos.svelte", "audio/AudioEffect.svelte", "live/AudioStreams.svelte", "live/Mic.svelte", "pages/Actions.svelte"]
        for (const f of comTocar) {
            const t = ler("src/frontend/components/drawer/" + f)
            expect(t, f).toContain("<TocarAgora")
            expect(t, f).toMatch(/on:tocar=/)
        }
    })
    it("Telas, Janelas, NDI, BlackMagic e Cameras (cartoes de componentes que a SAIDA tambem importa) ganham o ▶ por `use:tocavel`, sem tocar nos arquivos do fecho da saida", () => {
        for (const f of ["live/Screens.svelte", "live/Windows.svelte", "live/NDIStreams.svelte", "live/BMDStreams.svelte"]) {
            const t = ler("src/frontend/components/drawer/" + f)
            expect(t, f).toContain("use:tocavel=")
            expect(t, f).toContain("aoTocar")
        }
        // as cameras: Cameras/Cam estao no fecho da saida; a lista inteira e envolvida em Media.svelte
        expect(ler("src/frontend/components/drawer/media/Media.svelte")).toContain("use:tocavelLista=")
        // esses arquivos estao no fecho da janela de saida (ancora): nao podem conhecer o ▶ nem a guarda nova
        for (const f of ["Card.svelte", "live/Capture.svelte", "live/NDIStream.svelte", "live/BMDStream.svelte", "live/Cam.svelte", "live/Cameras.svelte"]) {
            const t = ler("src/frontend/components/drawer/" + f)
            expect(t, f).not.toMatch(/TocarAgora|autorizarAr|aliancaGavetaToque|on:tocar/)
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
        expect(usos).toEqual(["src/frontend/components/drawer/TocarAgora.svelte", "src/frontend/components/drawer/media/MediaCard.svelte", "src/frontend/components/drawer/pages/Overlays.svelte", "src/frontend/utils/aliancaGavetaToque.ts"])
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
    it("revisao da fatia 6, achado 14: cartao e linha nao prometem tocar ao clicar (sem ▶ de hover nem a dica Reproduzir)", () => {
        expect(ler("src/frontend/components/drawer/media/MediaCard.svelte")).toContain("showPlayOnHover={false}")
        const acoes = ler("src/frontend/components/drawer/pages/Actions.svelte")
        expect(acoes).not.toContain("translateText('media.play')")
        expect(acoes).toContain("botão direito")
    })
    it("revisao da fatia 6, achado 15: a aba de playlists nao tem mais o duplo clique morto (a guarda sempre fechada o deixava undefined)", () => {
        const t = ler("src/frontend/components/drawer/navigation/AudioTabs.svelte")
        expect(t).not.toContain("onDoubleClick")
        expect(t).not.toContain("AudioPlaylist.start")
    })
})
