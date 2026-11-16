import { get, writable } from "svelte/store"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { comunsDrawerTabs } from "./aliancaDrawerTabsLogica"
import { criarPorModo } from "./aliancaPorModoLogica"
import type { Modo } from "./aliancaPorModoLogica"

type D = { height: number; stored: number | null; fundo?: { a: { b: number } } }
const inicial = (): D => ({ height: 300, stored: null, fundo: { a: { b: 1 } } })
const copiar = <T>(v: T): T => JSON.parse(JSON.stringify(v))

function montar() {
    const modo = writable<Modo>("culto")
    const culto = writable<D>(inicial())
    const f = criarPorModo<D>({ culto, modo: () => modo, copiar })
    // conta assinantes de `modo` (vazamento): o writable nao expoe, entao embrulha o subscribe
    let n = 0
    const sub0 = modo.subscribe.bind(modo)
    ;(modo as any).subscribe = (run: any, inv?: any) => {
        n++
        const un = sub0(run, inv)
        return () => {
            n--
            un()
        }
    }
    return { f, modo, culto, assinantesDoModo: () => n }
}
const coletar = <T>(s: { subscribe: (r: (v: T) => void) => () => void }) => {
    const vistos: T[] = []
    const un = s.subscribe((v) => vistos.push(copiar(v)))
    return { vistos, un }
}

describe("criarPorModo: no lado do Culto e igual a um writable", () => {
    it("teste diferencial: mesma sequencia de valores para set, update e mutacao no lugar", () => {
        const { f } = montar()
        const controle = writable<D>(inicial())
        const a = coletar(f)
        const b = coletar(controle)
        const ops: ((s: any) => void)[] = [
            (s) => s.set({ height: 120, stored: 300 }),
            (s) => s.update((v: D) => ({ ...v, height: 40 })),
            (s) =>
                s.update((v: D) => {
                    v.height = 77
                    return v
                }),
            (s) => s.set({ height: 5, stored: null })
        ]
        for (const op of ops) {
            op(f)
            op(controle)
        }
        expect(a.vistos).toEqual(b.vistos)
        a.un()
        b.un()
    })
    it("assinar entrega exatamente 1 chamada", () => {
        const { f } = montar()
        const { vistos, un } = coletar(f)
        expect(vistos).toHaveLength(1)
        un()
    })
})

describe("criarPorModo: lados independentes", () => {
    it("o Preparar nasce como COPIA PROFUNDA do Culto; mexer num objeto aninhado nao move o outro (e vice-versa)", () => {
        const { f, modo, culto } = montar()
        modo.set("preparar")
        f.update((v) => {
            v.fundo!.a.b = 99
            return v
        })
        expect(get(culto).fundo!.a.b).toBe(1)
        modo.set("culto")
        culto.update((v) => {
            v.fundo!.a.b = 5
            return v
        })
        modo.set("preparar")
        expect(get(f).fundo!.a.b).toBe(99)
    })
    it("set no Preparar nao emite para quem assina .culto", () => {
        const { f, modo, culto } = montar()
        modo.set("preparar")
        const c = coletar(culto)
        f.set({ height: 1, stored: null })
        expect(c.vistos).toHaveLength(1) // so a assinatura inicial
        c.un()
    })
    it("voltar ao Culto emite UMA vez para o assinante da fachada, com o valor do Culto", () => {
        const { f, modo } = montar()
        const a = coletar(f)
        modo.set("preparar")
        f.set({ height: 40, stored: 300 })
        const antes = a.vistos.length
        modo.set("culto")
        expect(a.vistos).toHaveLength(antes + 1)
        expect(a.vistos.at(-1)).toEqual(inicial())
        a.un()
    })
    it("nao ressemeia ao voltar e entrar de novo", () => {
        const { f, modo } = montar()
        modo.set("preparar")
        f.set({ height: 40, stored: 1 })
        modo.set("culto")
        modo.set("preparar")
        expect(get(f).height).toBe(40)
    })
    it(".culto.set com o modo em Preparar muda so o Culto (carga de disco)", () => {
        const { f, modo, culto } = montar()
        modo.set("preparar")
        expect(get(f).height).toBe(300) // 1a entrada no Preparar: a semente
        f.culto.set({ height: 11, stored: null })
        expect(get(culto).height).toBe(11)
        expect(get(f).height).toBe(300)
    })
    it("doModo escreve no lado pedido, nao no do instante (escrita atrasada)", () => {
        const { f, modo, culto } = montar()
        modo.set("preparar")
        expect(get(f).height).toBe(300) // 1a entrada no Preparar: a semente
        f.doModo("culto").set({ height: 2, stored: null })
        expect(get(culto).height).toBe(2)
        expect(get(f).height).toBe(300)
    })
})

describe("criarPorModo: excecao na escolha do lado", () => {
    it("excecao na escolha do lado cai no Culto e avisa uma vez", () => {
        const erro = vi.spyOn(console, "error").mockImplementation(() => {})
        const culto = writable<D>(inicial())
        const f = criarPorModo<D>({
            culto,
            modo: () => {
                throw new Error("boom")
            },
            copiar
        })
        f.set({ height: 9, stored: null })
        f.set({ height: 10, stored: null })
        expect(get(culto).height).toBe(10)
        expect(erro).toHaveBeenCalledTimes(1)
        erro.mockRestore()
    })
})

describe("criarPorModo: assinaturas e entrega atrasada (C11)", () => {
    it("UMA assinatura de modo por store, solta no ultimo assinante; 20 trocas de modo nao a aumentam", () => {
        const { f, modo, assinantesDoModo } = montar()
        expect(assinantesDoModo()).toBe(0)
        const a = coletar(f)
        const b = coletar(f)
        expect(assinantesDoModo()).toBe(1)
        for (let i = 0; i < 20; i++) modo.set(i % 2 ? "culto" : "preparar")
        expect(assinantesDoModo()).toBe(1)
        a.un()
        expect(assinantesDoModo()).toBe(1)
        b.un()
        expect(assinantesDoModo()).toBe(0)
    })
    it("dentro de um assinante: escrever no lado A e trocar o modo termina com o valor do lado B", () => {
        const { f, modo } = montar()
        let ultimo: D | null = null
        let disparou = false
        const un = f.subscribe((v) => {
            ultimo = copiar(v)
            if (!disparou && v.height === 300) {
                disparou = true
                f.set({ height: 123, stored: null }) // lado A (Culto)
                modo.set("preparar")
            }
        })
        // o Preparar e a semente do Culto no instante da troca (a escrita 123 ja tinha ido)
        expect(ultimo!.height).toBe(123)
        modo.set("culto")
        expect(ultimo!.height).toBe(123)
        un()
    })
    it("depois de desassinar, nada mais chega ao assinante", () => {
        const { f, modo } = montar()
        const a = coletar(f)
        a.un()
        const n = a.vistos.length
        modo.set("preparar")
        f.set({ height: 8, stored: null })
        expect(a.vistos).toHaveLength(n)
    })
})

describe("criarPorModo com comuns (drawerTabsData)", () => {
    const abas = (sub: string, filtro: string[], enabled = true) => ({ media: { enabled, activeSubTab: sub, aliancaFiltro: filtro }, shows: { enabled: true, activeSubTab: "all" } })
    function montarAbas() {
        const modo = writable<Modo>("culto")
        const culto = writable<any>(abas("pasta:a", ["video"]))
        const f = criarPorModo<any>({ culto, modo: () => modo, copiar, comuns: comunsDrawerTabs })
        return { f, modo, culto }
    }
    it("pasta e filtro da F7 sao por modo; as demais correcoes sao compartilhadas", () => {
        const { f, modo, culto } = montarAbas()
        modo.set("preparar")
        expect(get(f).media.activeSubTab).toBe("pasta:a") // semente
        f.update((a) => {
            a.media.activeSubTab = "pasta:b"
            a.media.aliancaFiltro = ["audio"]
            a.shows.activeSubTab = "cat1"
            return a
        })
        expect(get(culto).media.activeSubTab).toBe("pasta:a") // por modo
        expect(get(culto).media.aliancaFiltro).toEqual(["video"])
        expect(get(culto).shows.activeSubTab).toBe("cat1") // compartilhado
        modo.set("culto")
        culto.update((a) => {
            a.shows.activeSubTab = "cat2"
            a.media.enabled = false
            return a
        })
        f.update((a) => a) // uma escrita pelo lado do Culto repassa os comuns
        modo.set("preparar")
        expect(get(f).shows.activeSubTab).toBe("cat2")
        expect(get(f).media.activeSubTab).toBe("pasta:b")
    })
    it("desligar uma aba (enabled) no Preparar vale no Culto", () => {
        const { f, modo, culto } = montarAbas()
        modo.set("preparar")
        f.update((a) => {
            a.media.enabled = false
            return a
        })
        expect(get(culto).media.enabled).toBe(false)
    })
})
