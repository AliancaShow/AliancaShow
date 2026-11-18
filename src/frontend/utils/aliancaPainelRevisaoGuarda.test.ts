import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Guardas da revisao de codigo da fatia 1 (revisao-fatia1-codigo.md): cada uma trava o texto do que foi corrigido.
const ler = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n")

describe("1.2/1.3: o campo de busca da biblioteca nao trata teclado sozinho", () => {
    const t = ler("components/main/AliancaBibliotecaPainel.svelte")
    it("sem on:keydown no campo e sem stopPropagation (Ctrl+Enter roda UMA vez; F1-F5, Esc e Ctrl+tecla seguem como no Drawer antigo)", () => {
        expect(t).not.toMatch(/on:keydown=\{teclaDoCampo\}/)
        expect(t).not.toMatch(/stopPropagation/)
        expect(t).not.toMatch(/function teclaDoCampo/)
    })
    it("so o ouvinte de janela chama `teclar`", () => {
        expect(t).toMatch(/<svelte:window on:keydown=\{teclar\}/)
        expect((t.match(/\bteclar\(/g) || []).length).toBe(1) // so a definicao (async function teclar); nenhuma chamada direta
    })
})

describe("1.4: limpar sobreposicao respeita as travadas", () => {
    const t = ler("components/main/AliancaCamadas.svelte")
    it("usa clearOverlays() e nao zera `overlays` na mao", () => {
        expect(t).toMatch(/clearOverlays\(\)/)
        expect(t).not.toMatch(/setOutput\("overlays"/)
        expect(t).not.toMatch(/setOutput\("effects"/)
    })
    it("a camada acende sem contar as travadas (checkLocked=false)", () => {
        expect(t).toMatch(/sobreposicaoLimpa: isOutCleared\("overlays", \$outputs, false\)/)
    })
})
