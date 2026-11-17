// 1b, D8: a guarda de paginas e a volta ao show, com os stores trocados por stores de teste (vi.mock de ../stores e ./common).
import { get, writable } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const toast = vi.fn()
vi.mock("./common", () => ({ newToast: (m: string) => toast(m) }))

// os stores de teste: o `set` que o CODIGO usa e um espiao; a prova mexe pelo `set` de verdade (`base`), que nao conta
const H = vi.hoisted(() => {
    const noop = () => {}
    return { noop }
})
const estado = vi.hoisted(() => ({
    assinantesDePagina: 0,
    escritasDaGuarda: [] as string[],
    ignorarSet: false,
    quebrarModo: false
}))
vi.mock("../stores", async () => {
    const { writable } = await import("svelte/store")
    const basePagina = writable<string>("show")
    const baseModo = writable<string>("culto")
    return {
        __basePagina: basePagina,
        __baseModo: baseModo,
        activePage: {
            subscribe: (fn: any) => {
                estado.assinantesDePagina++
                const off = basePagina.subscribe(fn)
                return () => {
                    estado.assinantesDePagina--
                    off()
                }
            },
            set: (v: string) => {
                estado.escritasDaGuarda.push(v)
                if (!estado.ignorarSet) basePagina.set(v)
            },
            update: basePagina.update
        },
        modoAlianca: {
            subscribe: (fn: any, inv?: any) => {
                if (estado.quebrarModo) throw new Error("modo quebrado")
                return baseModo.subscribe(fn, inv)
            },
            set: baseModo.set
        },
        currentWindow: writable<string | null>(null)
    }
})

import { _zerarFalhas, falhas } from "./aliancaFalha"
import { _pararMolduraAlianca, iniciarMolduraAlianca, paginaAnterior, voltarDaPagina } from "./aliancaMoldura"
import { PAGINAS_DO_PREPARAR } from "./aliancaMolduraLogica"
import * as stores from "../stores"

const basePagina = (stores as any).__basePagina as ReturnType<typeof writable<string>>
const baseModo = (stores as any).__baseModo as ReturnType<typeof writable<string>>
const livre = () => new Promise<void>((r) => setTimeout(r, 0))

let erro: ReturnType<typeof vi.spyOn>
beforeEach(() => {
    _zerarFalhas()
    toast.mockClear()
    estado.escritasDaGuarda.length = 0
    estado.ignorarSet = false
    estado.quebrarModo = false
    erro = vi.spyOn(console, "error").mockImplementation(H.noop)
    baseModo.set("culto")
    basePagina.set("show")
})
afterEach(() => {
    estado.quebrarModo = false
    _pararMolduraAlianca()
    erro.mockRestore()
    _zerarFalhas()
})

// um gerador deterministico (a prova tem de repetir)
function aleatorio(semente: number) {
    let s = semente
    return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296
}
const TODAS = ["show", "edit", "stage", "settings", "reflow", "draw", "scripture", "calendar", "pagina-que-nao-existe"]

describe("guarda de pagina: Culto", () => {
    it("1.000 sequencias aleatorias de pagina: a guarda nao escreve nada, nem avisa", async () => {
        iniciarMolduraAlianca()
        const r = aleatorio(7)
        for (let i = 0; i < 1000; i++) {
            basePagina.set(TODAS[Math.floor(r() * TODAS.length)])
            if (i % 50 === 0) await livre()
        }
        await livre()
        expect(estado.escritasDaGuarda).toEqual([])
        expect(toast).not.toHaveBeenCalled()
        expect(get(falhas)).toEqual([])
    })
})

describe("guarda de pagina: Preparar", () => {
    it("toda sequencia (inclusive reflow, calendar e valor inventado) termina em pagina permitida, com toast", async () => {
        iniciarMolduraAlianca()
        baseModo.set("preparar")
        await livre()
        const r = aleatorio(11)
        for (let i = 0; i < 120; i++) {
            const alvo = TODAS[Math.floor(r() * TODAS.length)]
            basePagina.set(alvo)
            await livre()
            expect(PAGINAS_DO_PREPARAR as readonly string[], `depois de ${alvo}`).toContain(get(basePagina))
            if (!(PAGINAS_DO_PREPARAR as readonly string[]).includes(alvo)) expect(toast).toHaveBeenCalled()
            toast.mockClear()
        }
        expect(get(falhas)).toEqual([])
    })
    it("draw e scripture: toast de Desenhar e Biblia; calendar/reflow: o generico; volta a pagina anterior valida", async () => {
        iniciarMolduraAlianca()
        baseModo.set("preparar")
        basePagina.set("settings")
        await livre()
        basePagina.set("draw")
        await livre()
        expect(get(basePagina)).toBe("settings")
        expect(toast).toHaveBeenLastCalledWith("Desenhar e Bíblia em tela cheia ficam no Culto.")
        basePagina.set("scripture")
        await livre()
        expect(toast).toHaveBeenLastCalledWith("Desenhar e Bíblia em tela cheia ficam no Culto.")
        basePagina.set("reflow")
        await livre()
        expect(toast).toHaveBeenLastCalledWith("Essa página não abre no Preparar.")
        basePagina.set("calendar")
        await livre()
        expect(toast).toHaveBeenLastCalledWith("Essa página não abre no Preparar.")
    })
    it("entrar no Preparar estando em draw volta a show", async () => {
        iniciarMolduraAlianca()
        basePagina.set("draw")
        await livre()
        expect(get(basePagina)).toBe("draw")
        baseModo.set("preparar")
        await livre()
        expect(get(basePagina)).toBe("show")
        expect(toast).toHaveBeenCalledTimes(1)
    })
    it("um toast por pedido recusado (a pagina nao fica em laco)", async () => {
        iniciarMolduraAlianca()
        baseModo.set("preparar")
        basePagina.set("draw")
        await livre()
        expect(toast).toHaveBeenCalledTimes(1)
        expect(estado.escritasDaGuarda).toEqual(["show"])
    })
})

describe("decisao 9: Preparar -> Culto", () => {
    it("em stage ou settings vai a show; em edit fica", async () => {
        iniciarMolduraAlianca()
        for (const [de, vai] of [
            ["settings", "show"],
            ["stage", "show"],
            ["edit", "edit"],
            ["show", "show"]
        ]) {
            baseModo.set("preparar")
            await livre()
            basePagina.set(de)
            await livre()
            baseModo.set("culto")
            await livre()
            expect(get(basePagina), `saindo de ${de}`).toBe(vai)
            basePagina.set("show")
        }
        expect(get(falhas)).toEqual([])
    })
    it("no Culto, settings e stage continuam alcancaveis (so a troca de modo manda a show)", async () => {
        iniciarMolduraAlianca()
        basePagina.set("settings")
        await livre()
        expect(get(basePagina)).toBe("settings")
        basePagina.set("stage")
        await livre()
        expect(get(basePagina)).toBe("stage")
    })
    it("o primeiro valor do modo (assinatura) nao e uma saida do Preparar", async () => {
        basePagina.set("settings")
        iniciarMolduraAlianca()
        await livre()
        expect(get(basePagina)).toBe("settings")
    })
})

describe("paginaAnterior e voltarDaPagina", () => {
    it("settings -> stage -> Voltar -> settings -> Voltar -> show", async () => {
        iniciarMolduraAlianca()
        baseModo.set("preparar")
        await livre()
        basePagina.set("settings")
        expect(get(paginaAnterior)).toBe("show")
        basePagina.set("stage")
        expect(get(paginaAnterior)).toBe("settings")
        voltarDaPagina()
        expect(get(basePagina)).toBe("settings")
        expect(get(paginaAnterior)).toBeNull()
        voltarDaPagina()
        expect(get(basePagina)).toBe("show")
    })
    it("de edit o alvo e sempre show", async () => {
        iniciarMolduraAlianca()
        baseModo.set("preparar")
        basePagina.set("settings")
        basePagina.set("edit")
        voltarDaPagina()
        expect(get(basePagina)).toBe("show")
    })
    it("sem origem cai em show; Pronto e Voltar sao a mesma funcao", async () => {
        iniciarMolduraAlianca()
        baseModo.set("preparar")
        basePagina.set("stage")
        anteriorZerado()
        voltarDaPagina()
        expect(get(basePagina)).toBe("show")
    })
    it("undo que pula para stage lembra a pagina de onde saiu", async () => {
        iniciarMolduraAlianca()
        baseModo.set("preparar")
        basePagina.set("edit")
        basePagina.set("stage")
        expect(get(paginaAnterior)).toBe("edit")
    })
    it("Voltar que nao pega acende a faixa (voltar-da-pagina)", async () => {
        iniciarMolduraAlianca()
        baseModo.set("preparar")
        basePagina.set("settings")
        estado.ignorarSet = true
        voltarDaPagina()
        expect(get(falhas).map((f) => f.origem)).toContain("voltar-da-pagina: nao voltou")
    })
})

function anteriorZerado() {
    // `paginaAnterior` so e zerado pela propria guarda; aqui a origem some porque a pagina anterior era a mesma
    basePagina.set("stage")
}

describe("falha da guarda e visivel (Q13, Q15, Q16)", () => {
    it("excecao no assinante: nenhuma escrita e guarda-de-pagina a cada vez (3 excecoes, vezes 3)", async () => {
        iniciarMolduraAlianca()
        baseModo.set("preparar")
        await livre()
        estado.escritasDaGuarda.length = 0
        estado.quebrarModo = true
        for (const p of ["draw", "scripture", "calendar"]) basePagina.set(p)
        await livre()
        expect(estado.escritasDaGuarda).toEqual([])
        expect(get(falhas)).toHaveLength(1)
        expect(get(falhas)[0]).toMatchObject({ origem: "guarda-de-pagina", vezes: 3 })
    })
    it("excecao no toast: a pagina ja voltou e a falha fica alta", async () => {
        iniciarMolduraAlianca()
        baseModo.set("preparar")
        toast.mockImplementationOnce(() => {
            throw new Error("toast quebrado")
        })
        basePagina.set("draw")
        await livre()
        expect(get(basePagina)).toBe("show")
        expect(get(falhas).map((f) => f.origem)).toContain("guarda-de-pagina")
    })
    it("redirecionamento que nao pega (store ignora o set) registra Q15", async () => {
        iniciarMolduraAlianca()
        baseModo.set("preparar")
        await livre()
        estado.ignorarSet = true
        basePagina.set("draw")
        await livre()
        expect(get(basePagina)).toBe("draw")
        expect(get(falhas).map((f) => f.origem)).toContain("guarda-de-pagina: redirecionamento nao pegou")
    })
    it("decisao 9 que nao pega registra decisao-4", async () => {
        iniciarMolduraAlianca()
        baseModo.set("preparar")
        basePagina.set("settings")
        await livre()
        estado.ignorarSet = true
        baseModo.set("culto")
        await livre()
        expect(get(falhas).map((f) => f.origem)).toContain("decisao-4: nao voltou para show")
    })
    it("_pararMolduraAlianca fora de dev nao desliga e registra Q16", async () => {
        iniciarMolduraAlianca()
        baseModo.set("preparar")
        vi.stubEnv("DEV", false)
        try {
            _pararMolduraAlianca()
        } finally {
            vi.unstubAllEnvs()
        }
        expect(get(falhas).map((f) => f.origem)).toContain("parar-moldura-fora-de-dev")
        basePagina.set("draw")
        await livre()
        expect(get(basePagina)).toBe("show")
    })
    it("em dev _pararMolduraAlianca desliga e da para religar", async () => {
        iniciarMolduraAlianca()
        baseModo.set("preparar")
        await livre()
        _pararMolduraAlianca()
        basePagina.set("draw")
        await livre()
        expect(get(basePagina)).toBe("draw")
        iniciarMolduraAlianca()
        await livre()
        expect(get(basePagina)).toBe("show")
    })
})

describe("assinantes", () => {
    it("20 trocas de modo nao aumentam os assinantes de activePage", async () => {
        iniciarMolduraAlianca()
        const antes = estado.assinantesDePagina
        for (let i = 0; i < 20; i++) {
            baseModo.set(i % 2 ? "culto" : "preparar")
            await livre()
        }
        expect(estado.assinantesDePagina).toBe(antes)
    })
    it("iniciar duas vezes assina uma vez so", () => {
        iniciarMolduraAlianca()
        const n = estado.assinantesDePagina
        iniciarMolduraAlianca()
        expect(estado.assinantesDePagina).toBe(n)
    })
    it("na janela de saida (currentWindow) nao assina nada", () => {
        ;(stores as any).currentWindow.set("output")
        try {
            iniciarMolduraAlianca()
            expect(estado.assinantesDePagina).toBe(0)
        } finally {
            ;(stores as any).currentWindow.set(null)
        }
    })
})
