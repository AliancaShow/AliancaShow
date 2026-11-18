import { describe, expect, it } from "vitest"
import { INERTE_MS, TETO_INERTE_MS, assinaturaDasOpcoes, camadaPodeSair, dataLocalISO, dataValida, decidirTecla, dentroDaCarencia, estadoDoBotaoDia, eventoDoNome, hojeLocalISO, indiceInicial, larguraDoLayout, larguraDoPopover, moverDestaque, montarOpcoesDeDia, nomeDaAgenda, opcoesPlanas, posicaoDoPopover, removerGruposVazios, rotuloDoDia, somarDias } from "./aliancaSeletorLogica"
import type { ItemDaArvore, ResolvidoDoCulto } from "./aliancaSeletorLogica"

describe("datas locais", () => {
    it("dia da semana certo", () => {
        expect(dataValida("2026-11-15")?.semana).toBe(0) // domingo
        expect(dataValida("2026-11-07")?.semana).toBe(6) // sabado
        expect(dataValida("2028-02-29")?.semana).toBe(2) // bissexto, terca
        expect(dataValida("2027-01-01")?.semana).toBe(5) // virada de ano, sexta
    })
    it("data impossivel e recusada (ida e volta)", () => {
        expect(dataValida("2026-11-31")).toBeNull()
        expect(dataValida("2027-02-29")).toBeNull()
        expect(dataValida("2026-13-01")).toBeNull()
        expect(dataValida("abc")).toBeNull()
        expect(dataValida("")).toBeNull()
    })
    it("hoje: 15/11/2026 22:30 local e 2026-11-15 (nada de ISO/UTC)", () => {
        expect(hojeLocalISO(new Date(2026, 10, 15, 22, 30))).toBe("2026-11-15")
        expect(hojeLocalISO(new Date(2026, 10, 15, 23, 59, 59))).toBe("2026-11-15")
        expect(hojeLocalISO(new Date(2026, 10, 16, 0, 0, 1))).toBe("2026-11-16")
        expect(dataLocalISO(new Date(2026, 0, 5))).toBe("2026-01-05")
    })
    it("somarDias atravessa mes e ano", () => {
        expect(somarDias("2026-11-15", -56)).toBe("2026-09-20")
        expect(somarDias("2026-01-10", -20)).toBe("2025-12-21")
        expect(somarDias("2026-02-27", 3)).toBe("2026-03-02")
        expect(somarDias("lixo", 3)).toBe("lixo")
    })
})

describe("rotuloDoDia", () => {
    it("Dom 15/nov", () => {
        const r = rotuloDoDia({ cultoId: "2026-11-15", nomeProjeto: "15", anoAtual: 2026 })
        expect(r.curto).toBe("Dom 15/nov")
        expect(r.semSemana).toBe("15/nov")
        expect(r.longo).toBe("domingo, 15 de novembro")
        expect(r.evento).toBe("")
        expect(r.valido).toBe(true)
    })
    it("Extra: sabado e o evento", () => {
        const r = rotuloDoDia({ cultoId: "2026-11-07", nomeProjeto: "07 - Rede de Mulheres", anoAtual: 2026 })
        expect(r.curto).toBe("Sáb 07/nov")
        expect(r.evento).toBe("Rede de Mulheres")
    })
    it("ano diferente do corrente entra no rotulo", () => {
        expect(rotuloDoDia({ cultoId: "2025-11-16", nomeProjeto: "16", anoAtual: 2026 }).curto).toBe("Dom 16/nov/25")
        expect(rotuloDoDia({ cultoId: "2027-01-03", nomeProjeto: "03", anoAtual: 2026 }).curto).toBe("Dom 03/jan/27")
    })
    it("cultoId invalido, nulo ou data impossivel caem no nome", () => {
        expect(rotuloDoDia({ cultoId: null, nomeProjeto: "F3 teste", anoAtual: 2026 })).toMatchObject({ curto: "F3 teste", valido: false, evento: "" })
        expect(rotuloDoDia({ cultoId: "2026-11-31", nomeProjeto: "31", anoAtual: 2026 })).toMatchObject({ curto: "31", valido: false })
        expect(rotuloDoDia({ cultoId: "xx", nomeProjeto: "", anoAtual: 2026 }).curto).toBe("—")
        expect(rotuloDoDia({ cultoId: undefined, nomeProjeto: undefined, anoAtual: 2026 }).curto).toBe("—")
    })
    it("eventoDoNome", () => {
        expect(eventoDoNome("07 - Rede de Mulheres do Sul")).toBe("Rede de Mulheres do Sul")
        expect(eventoDoNome("15")).toBe("")
        expect(eventoDoNome("")).toBe("")
    })
})

// ---------------------------------------------------------------- opcoes

const AL = { nome: "Aliança" }
const IM = { nome: "Impulso" }
const EX = { nome: "Extra" }
const mapa: Record<string, ResolvidoDoCulto> = {
    a1: { agenda: AL, cultoId: "2026-08-02" }, // 105 dias antes de 15/11: fora das 8 semanas
    a2: { agenda: AL, cultoId: "2026-09-27" }, // 49 dias: dentro
    a3: { agenda: AL, cultoId: "2026-11-08" },
    a4: { agenda: AL, cultoId: "2026-11-15" }, // hoje
    a5: { agenda: AL, cultoId: "2026-11-22" },
    i1: { agenda: IM, cultoId: "2026-11-21" },
    e1: { agenda: EX, cultoId: "2026-11-07" },
    a6: { agenda: AL, cultoId: "2027-01-03" },
    x: null,
    t1: null
}
const itens: ItemDaArvore[] = [
    { id: "t1", name: "F3 teste" },
    { id: "grupo:ago", type: "grupo", name: "Aliança · 08-agosto" },
    { id: "a1", name: "02" },
    { id: "grupo:set", type: "grupo", name: "Aliança · 09-setembro" },
    { id: "a2", name: "27" },
    { id: "grupo:nov", type: "grupo", name: "Aliança · 11-novembro" },
    { id: "a3", name: "08" },
    { id: "a4", name: "15" },
    { id: "a5", name: "22" },
    { id: "grupo:inov", type: "grupo", name: "Impulso · 11-novembro" },
    { id: "i1", name: "21" },
    { id: "grupo:xnov", type: "grupo", name: "Extra · 11-novembro" },
    { id: "e1", name: "07 - Rede de Mulheres" },
    { id: "grupo:jan", type: "grupo", name: "Aliança · 01-janeiro" },
    { id: "a6", name: "03" },
    { id: "pasta", type: "folder", name: "pasta" }
]
const resolver = (id: string) => mapa[id] ?? null
const contar = (id: string) => (id === "a3" ? 7 : id === "a4" ? 12 : 0)
const montar = (extra: Partial<Parameters<typeof montarOpcoesDeDia>[0]> = {}) => montarOpcoesDeDia({ itens, resolver, contar, hoje: "2026-11-15", ativoId: null, emTodos: true, ...extra })

describe("montarOpcoesDeDia", () => {
    it("grupos 1:1 com os `grupo` da arvore, na ordem; projeto antes do 1o grupo fica em Outros, primeiro", () => {
        const g = montar()
        expect(g[0]).toMatchObject({ titulo: "Outros" })
        expect(g[0].opcoes.map((o) => o.id)).toEqual(["t1"])
        expect(g.map((x) => x.titulo)).toEqual(["Outros", "Aliança · Setembro 2026", "Aliança · Novembro 2026", "Impulso · Novembro 2026", "Extra · Novembro 2026", "Aliança · Janeiro 2027"])
    })
    it("so o titulo e embelezado; fora de Todos some o prefixo da agenda", () => {
        const g = montar({ emTodos: false })
        expect(g.map((x) => x.titulo)).toContain("Novembro 2026")
        expect(g.map((x) => x.titulo)).not.toContain("Aliança · Novembro 2026")
    })
    it("grupo cujo projeto nao e culto mantem o nome do grupo como veio", () => {
        const g = montarOpcoesDeDia({
            itens: [
                { id: "g", type: "grupo", name: "Meus testes" },
                { id: "t1", name: "F3 teste" }
            ],
            resolver,
            contar,
            hoje: "2026-11-15",
            ativoId: null,
            emTodos: true
        })
        expect(g[0].titulo).toBe("Meus testes")
        expect(g[0].opcoes[0]).toMatchObject({ foraDeCulto: true, curto: "F3 teste", cultoId: "" })
    })
    it("passado: so as ultimas 8 semanas; o futuro inteiro", () => {
        const ids = opcoesPlanas(montar()).map((o) => o.id)
        expect(ids).not.toContain("a1")
        expect(ids).toEqual(expect.arrayContaining(["a2", "a3", "a4", "a5", "i1", "e1", "a6"]))
    })
    it("corte exato: 56 dias entra, 57 sai", () => {
        const m = { c56: { agenda: AL, cultoId: "2026-09-20" }, c57: { agenda: AL, cultoId: "2026-09-19" } } as Record<string, ResolvidoDoCulto>
        const g = montarOpcoesDeDia({
            itens: [
                { id: "g", type: "grupo", name: "x" },
                { id: "c57", name: "19" },
                { id: "c56", name: "20" }
            ],
            resolver: (id) => m[id],
            contar,
            hoje: "2026-11-15",
            ativoId: null,
            emTodos: false
        })
        expect(opcoesPlanas(g).map((o) => o.id)).toEqual(["c56"])
    })
    it("o culto aberto mais velho que 8 semanas aparece, sozinho no grupo dele", () => {
        const g = montar({ ativoId: "a1" })
        const grupoAgo = g.find((x) => x.opcoes.some((o) => o.id === "a1"))!
        expect(grupoAgo.titulo).toBe("Aliança · Agosto 2026")
        expect(grupoAgo.opcoes).toHaveLength(1)
        expect(grupoAgo.opcoes[0]).toMatchObject({ passado: true, curto: "Dom 02/ago" })
    })
    it("grupo que fica vazio some", () => {
        expect(montar().some((x) => x.titulo === "Aliança · Agosto 2026")).toBe(false)
    })
    it("passado, hoje, contagem, vazio", () => {
        const o = Object.fromEntries(opcoesPlanas(montar()).map((x) => [x.id, x]))
        expect(o.a3).toMatchObject({ passado: true, hoje: false, itens: 7, vazio: false })
        expect(o.a4).toMatchObject({ passado: false, hoje: true, itens: 12 })
        expect(o.a5).toMatchObject({ passado: false, hoje: false, itens: 0, vazio: true })
    })
    it("virada de dia: o culto de hoje, as 22:30, continua 'hoje' e nao 'passado'", () => {
        const hoje = hojeLocalISO(new Date(2026, 10, 15, 22, 30))
        const o = opcoesPlanas(montar({ hoje })).find((x) => x.id === "a4")!
        expect(o).toMatchObject({ hoje: true, passado: false })
    })
    it("mesma data em duas agendas: titulos distintos em Todos", () => {
        const g = montar()
        const t = g.map((x) => x.titulo)
        expect(t.filter((x) => /Novembro 2026/.test(x))).toHaveLength(3)
        expect(new Set(t).size).toBe(t.length)
    })
    it("ordem da entrada preservada (nada reordenado)", () => {
        expect(opcoesPlanas(montar()).map((o) => o.id)).toEqual(["t1", "a2", "a3", "a4", "a5", "i1", "e1", "a6"])
    })
    it("arquivado e evento", () => {
        const g = montarOpcoesDeDia({
            itens: [
                { id: "g", type: "grupo", name: "x" },
                { id: "e1", name: "07 - Rede de Mulheres", archived: true }
            ],
            resolver,
            contar,
            hoje: "2026-11-15",
            ativoId: null,
            emTodos: false
        })
        expect(g[0].opcoes[0]).toMatchObject({ arquivado: true, evento: "Rede de Mulheres", nome: "07 - Rede de Mulheres" })
    })
    it("data impossivel: nao e cortado e cai no nome", () => {
        const m = { z: { agenda: AL, cultoId: "2026-02-31" } } as Record<string, ResolvidoDoCulto>
        const g = montarOpcoesDeDia({
            itens: [
                { id: "g", type: "grupo", name: "g" },
                { id: "z", name: "31" }
            ],
            resolver: (id) => m[id],
            contar,
            hoje: "2026-11-15",
            ativoId: null,
            emTodos: false
        })
        expect(g[0].opcoes[0]).toMatchObject({ curto: "31", foraDeCulto: true })
    })
    it("lista vazia", () => expect(montarOpcoesDeDia({ itens: [], resolver, contar, hoje: "2026-11-15", ativoId: null, emTodos: true })).toEqual([]))
})

describe("indiceInicial e moverDestaque", () => {
    const ops = [
        { id: "a", cultoId: "2026-11-01" },
        { id: "b", cultoId: "2026-11-08" },
        { id: "c", cultoId: "2026-11-22" },
        { id: "d", cultoId: "2026-11-29" }
    ]
    it("o ativo; senao o 1o de hoje em diante; senao o ultimo; vazio = -1", () => {
        expect(indiceInicial(ops, "b", "2026-11-15")).toBe(1)
        expect(indiceInicial(ops, null, "2026-11-15")).toBe(2)
        expect(indiceInicial(ops, "zzz", "2026-11-15")).toBe(2)
        expect(indiceInicial(ops, null, "2027-01-01")).toBe(3)
        expect(indiceInicial(ops.slice(0, 2), null, "2027-01-01")).toBe(1)
        expect(indiceInicial(ops, null, "2020-01-01")).toBe(0)
        expect(indiceInicial([], null, "2026-11-15")).toBe(-1)
        expect(indiceInicial([{ id: "x" }], null, "2026-11-15")).toBe(0)
    })
    it("bordas: nao da a volta", () => {
        expect(moverDestaque(3, 4, "ArrowDown")).toBe(3)
        expect(moverDestaque(0, 4, "ArrowUp")).toBe(0)
        expect(moverDestaque(1, 4, "ArrowDown")).toBe(2)
        expect(moverDestaque(-1, 4, "ArrowDown")).toBe(0)
        expect(moverDestaque(-1, 4, "ArrowUp")).toBe(0)
    })
    it("Home/End/PageDown/PageUp", () => {
        expect(moverDestaque(5, 30, "Home")).toBe(0)
        expect(moverDestaque(5, 30, "End")).toBe(29)
        expect(moverDestaque(5, 30, "PageDown")).toBe(13)
        expect(moverDestaque(25, 30, "PageDown")).toBe(29)
        expect(moverDestaque(5, 30, "PageUp")).toBe(0)
        expect(moverDestaque(20, 30, "PageUp")).toBe(12)
    })
    it("lista vazia = -1", () => {
        for (const t of ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"] as const) expect(moverDestaque(0, 0, t)).toBe(-1)
    })
})

describe("decidirTecla", () => {
    const todas = [..."abcdefghijklmnopqrstuvwxyz0123456789", " ", "Tab", "Delete", "Backspace", "ArrowLeft", "ArrowRight", "F1", "F2", "F3", "F4", "F5", ".", ",", "Insert", "ContextMenu", "Dead", "Unidentified"]
    it("toda tecla comum devolve algo diferente de 'passar' (nada vaza para o app)", () => {
        for (const key of todas) expect(decidirTecla({ key }).acao, key).not.toBe("passar")
    })
    it("com Ctrl/Meta tambem (Ctrl+Z, Ctrl+A, Ctrl+1...)", () => {
        for (const key of ["z", "a", "c", "v", "1", "2", "Delete", "Escape", "Enter", "ArrowDown"]) {
            expect(decidirTecla({ key, ctrlKey: true }).acao, "ctrl+" + key).toBe("fecharEngolir")
            expect(decidirTecla({ key, metaKey: true }).acao, "meta+" + key).toBe("fecharEngolir")
        }
    })
    it("so modificadora pura, Alt+F4, F11 e F12 passam", () => {
        for (const key of ["Shift", "Control", "Alt", "Meta", "AltGraph", "CapsLock"]) expect(decidirTecla({ key }).acao, key).toBe("passar")
        expect(decidirTecla({ key: "F4", altKey: true }).acao).toBe("passar")
        expect(decidirTecla({ key: "F11" }).acao).toBe("passar")
        expect(decidirTecla({ key: "F12" }).acao).toBe("passar")
        expect(decidirTecla({ key: "F4" }).acao).toBe("fecharEngolir")
    })
    it("as teclas do popover", () => {
        expect(decidirTecla({ key: "ArrowDown" })).toEqual({ acao: "mover", tecla: "ArrowDown" })
        expect(decidirTecla({ key: "PageUp" })).toEqual({ acao: "mover", tecla: "PageUp" })
        expect(decidirTecla({ key: "Home" })).toEqual({ acao: "mover", tecla: "Home" })
        expect(decidirTecla({ key: "Enter" })).toEqual({ acao: "escolher" })
        expect(decidirTecla({ key: "Escape" })).toEqual({ acao: "fechar" })
    })
    it("tecla sem funcao FECHA (o popover esquecido nao mata o avanco ao vivo)", () => {
        for (const key of ["ArrowRight", " ", "PageDown".toLowerCase(), "Tab", "Delete"]) expect(decidirTecla({ key }).acao).toBe("fecharEngolir")
    })
})

describe("camadaPodeSair", () => {
    it("so depois de INERTE_MS do ultimo evento e sem botao apertado", () => {
        expect(camadaPodeSair({ apertado: false, agora: 1000 + INERTE_MS - 1, ultimoEvento: 1000, inicioInerte: 900 })).toBe(false)
        expect(camadaPodeSair({ apertado: false, agora: 1000 + INERTE_MS, ultimoEvento: 1000, inicioInerte: 900 })).toBe(true)
    })
    it("pressao longa: apertado segura a camada, por mais de 600 ms", () => {
        expect(camadaPodeSair({ apertado: true, agora: 5000, ultimoEvento: 1000, inicioInerte: 1000 })).toBe(false)
        expect(camadaPodeSair({ apertado: true, agora: 1000 + 1500, ultimoEvento: 1000, inicioInerte: 1000 })).toBe(false)
    })
    it("teto de seguranca libera mesmo apertado", () => {
        expect(camadaPodeSair({ apertado: true, agora: 1000 + TETO_INERTE_MS, ultimoEvento: 1000, inicioInerte: 1000 })).toBe(true)
    })
    it("carencia", () => {
        expect(dentroDaCarencia(100, 150)).toBe(true)
        expect(dentroDaCarencia(150, 150)).toBe(false)
    })
    it("assinatura muda quando ids ou ordem mudam", () => {
        expect(assinaturaDasOpcoes([{ id: "a" }, { id: "b" }])).not.toBe(assinaturaDasOpcoes([{ id: "b" }, { id: "a" }]))
        expect(assinaturaDasOpcoes([{ id: "a" }])).toBe(assinaturaDasOpcoes([{ id: "a" }]))
    })
})

describe("layout", () => {
    it("abaixo de 240 o dia perde a semana e a agenda encolhe", () => {
        expect(larguraDoLayout(239)).toEqual({ semSemana: true, agendaPct: 48 })
        expect(larguraDoLayout(240)).toEqual({ semSemana: false, agendaPct: 42 })
        expect(larguraDoLayout(194).semSemana).toBe(true)
    })
    it("popover: no maximo 360", () => {
        expect(larguraDoPopover(180)).toBe(180)
        expect(larguraDoPopover(500)).toBe(360)
    })
    it("posicao: 4px abaixo e nunca passa da janela", () => {
        expect(posicaoDoPopover({ linha: { left: 10, width: 300 }, base: 100, janelaAltura: 1080 })).toEqual({ left: 10, top: 104, width: 300, maxHeight: 320 })
        expect(posicaoDoPopover({ linha: { left: 10, width: 300 }, base: 100, janelaAltura: 400 }).maxHeight).toBe(284)
        expect(posicaoDoPopover({ linha: { left: 10, width: 300 }, base: 100, janelaAltura: 150 }).maxHeight).toBe(120)
    })
    it("nomeDaAgenda", () => {
        const abas = [
            { id: "todos", nome: "Todos" },
            { id: "alianca", nome: "Aliança" }
        ]
        expect(nomeDaAgenda(abas, "alianca")).toBe("Aliança")
        expect(nomeDaAgenda(abas, "xx")).toBe("Todos")
    })
})

describe("estadoDoBotaoDia", () => {
    const base = { noFiltro: true, temCultos: true, agendaNome: "Impulso", anoAtual: 2026 }
    it("culto aberto", () => {
        const e = estadoDoBotaoDia({ ...base, ativo: { nome: "15", cultoId: "2026-11-15" }, agendaDoAtivo: "Aliança" })
        expect(e.texto).toBe("Dom 15/nov")
        expect(e.textoCurto).toBe("15/nov")
        expect(e.desabilitado).toBe(false)
        expect(e.foraDoFiltro).toBe(false)
    })
    it("fora do filtro: dica diz", () => {
        const e = estadoDoBotaoDia({ ...base, noFiltro: false, ativo: { nome: "15", cultoId: "2026-11-15" }, agendaDoAtivo: "Aliança" })
        expect(e.foraDoFiltro).toBe(true)
        expect(e.dica).toBe("Aberto: Aliança · Dom 15/nov (fora do filtro Impulso)")
    })
    it("nao e culto: mostra o nome", () => expect(estadoDoBotaoDia({ ...base, ativo: { nome: "F3 teste", cultoId: null } }).texto).toBe("F3 teste"))
    it("sem culto aberto", () => expect(estadoDoBotaoDia({ ...base, ativo: null }).texto).toBe("Escolher culto"))
    it("filtro sem cultos: Sem cultos, desabilitado (mesmo com culto aberto fora do filtro)", () => {
        expect(estadoDoBotaoDia({ ...base, temCultos: false, ativo: null })).toMatchObject({ texto: "Sem cultos", desabilitado: true })
        expect(estadoDoBotaoDia({ ...base, temCultos: false, noFiltro: false, ativo: { nome: "15", cultoId: "2026-11-15" } }).desabilitado).toBe(true)
    })
    it("evento do Extra vai na dica", () => {
        const e = estadoDoBotaoDia({ ...base, agendaNome: "Extra", ativo: { nome: "07 - Rede de Mulheres", cultoId: "2026-11-07" }, agendaDoAtivo: "Extra" })
        expect(e.texto).toBe("Sáb 07/nov")
        expect(e.dica).toContain("Rede de Mulheres")
    })
})

describe("removerGruposVazios (lista de baixo: cabecalho solto)", () => {
    type It = { id: string; type?: string; archived?: boolean; parent?: string }
    const g = (id: string): It => ({ id, type: "grupo" })
    const p = (id: string, archived = false): It => ({ id, archived })
    const linha = (a: It) => !a.archived
    const ids = (l: It[]) => l.map((x) => x.id)

    it("Todos: grupo so com projetos arquivados e escondidos some inteiro (cabecalho e itens), o resto fica", () => {
        const itens = [g("out"), p("o1", true), p("o2", true), g("nov"), p("n1"), p("n2", true)]
        expect(ids(removerGruposVazios(itens, linha))).toEqual(["nov", "n1", "n2"])
    })
    it("grupo com ao menos uma linha visivel fica com os arquivados dentro (o botao de mostrar arquivados continua)", () => {
        const itens = [g("nov"), p("n1"), p("n2", true)]
        expect(ids(removerGruposVazios(itens, linha))).toEqual(["nov", "n1", "n2"])
    })
    it("grupo vazio de fato (cabecalho seguido de outro cabecalho, ou no fim) some", () => {
        expect(ids(removerGruposVazios([g("a"), g("b"), p("b1")], linha))).toEqual(["b", "b1"])
        expect(ids(removerGruposVazios([g("a"), p("a1"), g("b")], linha))).toEqual(["a", "a1"])
        expect(removerGruposVazios([g("a")], linha)).toEqual([])
    })
    it("depois de mostrar os arquivados o grupo volta", () => {
        const itens = [g("out"), p("o1", true)]
        expect(ids(removerGruposVazios(itens, () => true))).toEqual(["out", "o1"])
    })
    it("pasta conta como linha; item antes do primeiro grupo nao e tocado; ordem mantida; nao muda a entrada", () => {
        const itens: It[] = [p("solto"), g("a"), { id: "pasta", type: "folder" }, g("b"), p("b1", true)]
        const copia = JSON.stringify(itens)
        expect(ids(removerGruposVazios(itens, linha))).toEqual(["solto", "a", "pasta"])
        expect(JSON.stringify(itens)).toBe(copia)
    })
    it("lista vazia", () => {
        expect(removerGruposVazios([], linha)).toEqual([])
    })
})

describe("marcacao do leiaute v2 (cartoes)", () => {
    it("cor e segunda linha por agenda; desconhecida cai na neutra", async () => {
        const { corDaAgenda, subDaAgenda } = await import("./aliancaSeletorLogica")
        expect(corDaAgenda("alianca")).toBe("#7ea6d8")
        expect(corDaAgenda("impulso")).toBe("#eba640")
        expect(corDaAgenda("todos")).toMatch(/^rgba/)
        expect(subDaAgenda("impulso")).toBe("Igreja Impulso")
        expect(subDaAgenda("todos")).toBe("Todas as agendas")
    })
    it("partes do dia: semana em maiuscula e dia sem zero; data invalida vira null", async () => {
        const { partesDoDia } = await import("./aliancaSeletorLogica")
        expect(partesDoDia("2026-11-15")).toEqual({ semana: "DOM", num: "15" })
        expect(partesDoDia("2026-11-07")).toEqual({ semana: "SÁB", num: "7" })
        expect(partesDoDia("2026-11-31")).toBeNull()
        expect(partesDoDia("")).toBeNull()
    })
    it("HOJE so quando o culto aberto e o de hoje", async () => {
        const { ehHoje } = await import("./aliancaSeletorLogica")
        expect(ehHoje("2026-11-15", "2026-11-15")).toBe(true)
        expect(ehHoje("2026-11-14", "2026-11-15")).toBe(false)
        expect(ehHoje(null, "2026-11-15")).toBe(false)
    })
})

describe("hora no cartao do dia (fatia 9)", () => {
    it("so aparece quando o nome do projeto leva a hora", async () => {
        const { horaDoNomeDoProjeto } = await import("./aliancaSeletorLogica")
        expect(horaDoNomeDoProjeto("08 · 10h")).toBe("10h")
        expect(horaDoNomeDoProjeto("15 · 19h30")).toBe("19h30")
        expect(horaDoNomeDoProjeto("08")).toBe("")
        expect(horaDoNomeDoProjeto("07 - Rede de Mulheres")).toBe("")
        expect(horaDoNomeDoProjeto("")).toBe("")
    })
})
