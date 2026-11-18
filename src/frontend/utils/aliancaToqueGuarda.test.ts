// Revisao da fatia 2, achados 3 e 4: guarda de TEXTO (o DOM so existe no app). O que a guarda NAO cobre: o comportamento em tempo de execucao
// (so a Prova do Culto e o aparelho cobrem); ela so impede que a marcacao e a ligacao sumam sem ninguem ver.
import { readFileSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"

const RAIZ = join(__dirname, "..")
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n")

describe("controles de transporte ficam fora da trava de clique repetido", () => {
    it.each([
        ["components/show/AudioPreview.svelte", /class="main media context #media_preview" data-sem-trava/],
        ["components/drawer/pages/Variables.svelte", /class="variable numberBox context [^"]*" data-sem-trava/],
        ["components/drawer/timers/Timers.svelte", /<div data-sem-trava class:outline/],
        ["components/show/VideoShow.svelte", /<div data-sem-trava style="display: contents;">\s*<MediaControls/],
        ["components/show/VideoShow.svelte", /<div slot="menu" data-sem-trava/]
    ])("%s", (arq, re) => expect(ler(arq)).toMatch(re))
})

describe("versiculo e capitulo", () => {
    const t = ler("components/drawer/bible/Scripture.svelte")
    it("o capitulo e um clicavel proprio (data-item)", () => expect(t).toMatch(/\{id\}\s+data-item/))
    it("o mousedown do versiculo so seleciona se o clique seguinte NAO vai ser engolido", () => {
        expect(t).toMatch(/on:mousedown=\{\(e\) => \(cliqueVaiSerEngolido\(e\) \? null : openVerse\(updateVersesSelection\(e, content\.id\)\)\)\}/)
    })
})

describe("aliancaToque usa a chave do clicavel mais interno com o ponto do ponteiro", () => {
    const t = ler("utils/aliancaToque.ts")
    it("chaveDoClique + ponto", () => {
        expect(t).toMatch(/chaveDoClique\(alvo\)/)
        expect(t).toMatch(/repeticao\.engole\(chave, performance\.now\(\), ponto\(e\)\)/)
        expect(t).not.toMatch(/closest\(ITEM\)/)
    })
})

describe("AO VIVO deriva de outputState por saida, nao de outputDisplay (achado 5)", () => {
    for (const arq of ["components/main/AliancaRoteiro.svelte", "components/main/AliancaCentroCabecalho.svelte"]) {
        it(arq, () => {
            const t = ler(arq)
            expect(t).not.toMatch(/outputDisplay/)
            expect(t).toMatch(/telaoLigadoEm\(\$outputs, \$outputState\)/)
        })
    }
})

describe("o aviso de notas do slide em Mostrar nao e controle morto (achado 2.2)", () => {
    const t = ler("components/slide/Slide.svelte")
    it("nao e botao e nao ha mais openNotes", () => {
        expect(t).toMatch(/<div class="notes" data-title=\{slide\.notes\}>/)
        expect(t).not.toMatch(/openNotes/)
        expect(t).not.toMatch(/<button class="notes"/)
    })
})
