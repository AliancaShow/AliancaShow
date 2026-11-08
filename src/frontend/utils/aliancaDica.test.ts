import { describe, expect, it } from "vitest"
import { dicaSegura } from "./aliancaDica"

describe("dicaSegura", () => {
    it("marcacao vira texto", () => {
        expect(dicaSegura('<img src=x onerror="alert(1)">')).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;")
        expect(dicaSegura("Louvor & Adoração 'ao vivo'")).toBe("Louvor &amp; Adoração &#39;ao vivo&#39;")
    })
    it("vazio", () => {
        expect(dicaSegura(null)).toBe("")
        expect(dicaSegura(undefined)).toBe("")
    })
})
