import { describe, expect, it } from "vitest"
import { separarUnidade, fracaoNaRegua, linhaSoDeNumeros, lerNumero, mostrarNumero, mudouDoPadrao, prender, temRegua } from "./aliancaCampoNumeroLogica"

describe("lerNumero", () => {
    it.each([
        ["12", 12],
        ["1,5", 1.5],
        ["10+5", 15],
        ["(2+3)*4", 20],
        ["-300", -300],
        [" 7 ", 7]
    ])("%s -> %s", (t, v) => expect(lerNumero(t as string)).toBe(v))
    it("lixo e codigo nao passam", () => {
        for (const t of ["", "abc", "alert(1)", "1;2", "process.exit()", "1/0", "NaN"]) expect(lerNumero(t), t).toBeNull()
    })
})

describe("prender e mostrar", () => {
    it("limites e casas", () => {
        expect(prender(150, 0, 100)).toBe(100)
        expect(prender(-5, 0, null)).toBe(0)
        expect(prender(-500, -300, 100)).toBe(-300)
        expect(prender(1.23456, null, null, 2)).toBe(1.23)
        expect(prender(9999, 0, null)).toBe(9999)
    })
    it("mostrar sem zeros sobrando", () => {
        expect(mostrarNumero(1.1)).toBe("1.1")
        expect(mostrarNumero(100)).toBe("100")
        expect(mostrarNumero(NaN)).toBe("0")
    })
})

describe("regua", () => {
    it("fracao presa nas pontas; regua sem extensao = 0", () => {
        expect(fracaoNaRegua(0, -300, 100)).toBe(0.75)
        expect(fracaoNaRegua(500, 0, 100)).toBe(1)
        expect(fracaoNaRegua(-5, 0, 100)).toBe(0)
        expect(fracaoNaRegua(3, 5, 5)).toBe(0)
    })
    it("so tem regua com os dois extremos; showSlider false desliga", () => {
        expect(temRegua(undefined, 0, 100)).toBe(true)
        expect(temRegua(undefined, 0, null)).toBe(false)
        expect(temRegua(false, 0, 100)).toBe(false)
        expect(temRegua(true, 0, null, 0, 50)).toBe(true)
        expect(temRegua(undefined, 5, 5)).toBe(false)
    })
    it("linha so de numeros", () => {
        expect(linhaSoDeNumeros(["number", "number"])).toBe(true)
        expect(linhaSoDeNumeros(["number", "dropdown"])).toBe(false)
        expect(linhaSoDeNumeros([])).toBe(false)
    })
    it("mudou do padrao", () => {
        expect(mudouDoPadrao(5, 0)).toBe(true)
        expect(mudouDoPadrao(0, 0)).toBe(false)
        expect(mudouDoPadrao(5, null)).toBe(false)
    })
})

describe("separarUnidade", () => {
    it("a unidade do rotulo vale mais que a extensao", () => {
        expect(separarUnidade("X (%)", "px")).toEqual({ rotulo: "X", unidade: "%" })
        expect(separarUnidade("Velocidade (s)", "")).toEqual({ rotulo: "Velocidade", unidade: "s" })
    })
    it("sem parenteses usa a extensao; rotulo vazio nao quebra", () => {
        expect(separarUnidade("Tamanho", "px")).toEqual({ rotulo: "Tamanho", unidade: "px" })
        expect(separarUnidade("", "")).toEqual({ rotulo: "", unidade: "" })
        expect(separarUnidade("(%)", "px")).toEqual({ rotulo: "(%)", unidade: "px" })
    })
})
