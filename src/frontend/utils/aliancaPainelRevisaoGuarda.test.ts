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

describe("2.1: Ferramentas da saida nao abrem em Editar (nada de pagina inerte calada)", () => {
    it("o menu do app recusa a pagina draw via desenhoBloqueado() (faixa de falha) e fica onde esta", () => {
        const t = ler("components/main/AliancaMenuApp.svelte")
        expect(t).toMatch(/if \(p === "draw" && desenhoBloqueado\(\)\) return/)
    })
    it("desenhoBloqueado acende a falha `desenho-no-preparar` quando o modo e Preparar", () => {
        const t = ler("utils/aliancaDesenho.ts")
        expect(t).toMatch(/emEditar\(\)/)
        expect(t).toMatch(/falhaAlta\("desenho-no-preparar"/)
    })
})

describe("2.2: o tema salvo do FreeShow nao vaza para as pecas antigas", () => {
    it("a carga aplica SEMPRE o tema padrao (nao le `themes[data.theme]`)", () => {
        const t = ler("utils/updateSettings.ts")
        expect(t).toMatch(/let currentTheme = get\(themes\)\.default/)
        expect(t).not.toMatch(/get\(themes\)\[data\.theme\]/)
    })
})

describe("2.3/1.7/5.1: sobras declaradas na revisao", () => {
    it("o rotulo da biblioteca nao promete Ctrl+K (so a fatia 5 cria o atalho) e Shortcuts.svelte nao anuncia Ctrl+T", () => {
        expect(ler("components/main/AliancaRoteiro.svelte")).not.toMatch(/<span class="atalho">/)
        expect(ler("components/main/popups/Shortcuts.svelte")).not.toMatch(/toggle_panels/)
    })
    it("a flag salva projectTimelineActive e apagada na carga (special)", () => {
        expect(ler("utils/updateSettings.ts")).toMatch(/if \(v\.projectTimelineActive\) delete v\.projectTimelineActive/)
    })
    it("o aviso de desenho ativo mora na pilula do telao", () => {
        expect(ler("components/main/AliancaTelaoPilula.svelte")).toMatch(/data-acao="desenho-ativo"/)
    })
})
