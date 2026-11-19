import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Revisao do PR #42, achado 9: cada uso de <EditValues> tem um `escopo` proprio, senao os blocos aberto/recolhido de paineis diferentes
// (midia, palco, efeitos...) dividem a mesma chave guardada.
function svelteDe(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
        const p = join(dir, n)
        return statSync(p).isDirectory() ? svelteDe(p) : p.endsWith(".svelte") ? [p] : []
    })
}

describe("EditValues: escopo explicito e distinto por uso", () => {
    const usos: { arq: string; escopo: string }[] = []
    for (const arq of svelteDe("src/frontend")) {
        const t = readFileSync(arq, "utf8").replace(/<!--[\s\S]*?-->/g, "")
        for (const m of t.matchAll(/<EditValues\s[\s\S]*?\/>/g)) usos.push({ arq, escopo: (m[0].match(/escopo=(\{[^}]*\}|"[^"]*")/) || [])[1] || "" })
    }
    it("achou os usos", () => expect(usos.length).toBeGreaterThanOrEqual(9))
    it("todo uso passa escopo", () => expect(usos.filter((u) => !u.escopo).map((u) => u.arq)).toEqual([]))
    it("nenhum escopo se repete entre arquivos", () => {
        const vistos = new Map<string, string>()
        for (const u of usos) {
            const antes = vistos.get(u.escopo)
            if (antes && antes !== u.arq) throw new Error(`escopo ${u.escopo} repetido em ${antes} e ${u.arq}`)
            vistos.set(u.escopo, u.arq)
        }
    })
})
