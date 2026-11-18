import { describe, expect, it, vi } from "vitest"

vi.mock("./aliancaSirvo", () => ({ intervaloRev: () => 5000, sirvo: {} }))
vi.mock("./aliancaSirvoMaterial", () => ({ sirvoMaterialEstado: {} }))
import { calcular } from "./aliancaSirvoPilulaLogica"

const base: any = { status: "ok", cultos: [], cultoId: null, ultimaResposta: 1000, ultimoRoteiroOk: 1000, roteiroNoAr: false, roteiroEncerrado: false, podeConduzir: true, escolhaManual: false }
const material: any = { falhas: [], baixando: false, naFila: false, lote: { feitos: 0, total: 0 }, disco: null }

describe("calcular (pilula Sirvo)", () => {
    it("sem chave: nada aparece", () => expect(calcular({ ...base, status: "sem_chave" }, null, 2000, material)).toBeNull())
    it("chave recusada: vermelho e clicavel", () => {
        const v = calcular({ ...base, status: "chave_invalida" }, null, 2000, material)
        expect(v).toMatchObject({ tom: "vermelho", clicavel: true })
    })
    it("conectando: cinza e nao clicavel", () => expect(calcular({ ...base, status: "conectando" }, null, 2000, material)).toMatchObject({ tom: "cinza", clicavel: false }))
    it("caido: laranja e clicavel", () => expect(calcular({ ...base, status: "caido" }, null, 2000, material)).toMatchObject({ tom: "laranja", clicavel: true }))
    it("sem culto por perto: cinza", () => expect(calcular(base, null, 2000, material)?.texto).toContain("nenhum culto"))
    it("culto de hoje seguindo: verde, nao clicavel, texto diz se conduz", () => {
        const agora = Date.now()
        const culto: any = { event_id: "e", titulo: "Culto", comeca_em: new Date(agora + 3_600_000).toISOString() }
        const v = calcular({ ...base, ultimoRoteiroOk: agora, ultimaResposta: agora }, culto, agora, material)
        expect(v).toMatchObject({ tom: "verde", clicavel: false })
        expect(v?.texto).toContain("conduz")
    })
    it("arquivo que falhou deixa laranja", () => {
        const agora = Date.now()
        const culto: any = { event_id: "e", titulo: "Culto", comeca_em: new Date(agora + 3_600_000).toISOString() }
        const v = calcular({ ...base, ultimoRoteiroOk: agora, ultimaResposta: agora }, culto, agora, { ...material, falhas: [{ nome: "a.mp4" }] })
        expect(v?.tom).toBe("laranja")
    })
})
