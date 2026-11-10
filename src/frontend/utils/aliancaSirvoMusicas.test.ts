import { describe, expect, it } from "vitest"
import type { ProjectShowRef } from "../../types/Projects"
import { acaoDoRascunho, hashDaLetra, idDoAviso, idDoRascunho, ligacoesVivas, perguntasEEsta, rascunhoDaLetra, slidesDaLetra, CATEGORIA_NOVAS, type ContextoMusicas, type MusicaDoSirvo } from "./aliancaSirvoMusicas"
import { papelDoItem, reconciliar, resumirPendencia, textoDaPendencia, type BlocoParaProjeto } from "./aliancaSirvoProjeto"

const bloco = (id: string, musicas: MusicaDoSirvo[] = []): BlocoParaProjeto => ({ id, titulo: id.toUpperCase(), tipo: "louvor", cor: "#3366ff", duracao_min: 15, musicas })
const mus = (id: string, show_id: string | null, ordem: number, nome = show_id || id): MusicaDoSirvo => ({ id, show_id, nome, ordem })

// biblioteca deste PC: oceanos, terra, sangue; "sn_r9" é um rascunho em "Novas do Sirvo"
const biblioteca: { [id: string]: { category: string } } = { oceanos: { category: "musicas" }, terra: { category: "musicas" }, sangue: { category: "musicas" }, sn_r9: { category: CATEGORIA_NOVAS } }
const ctx = (ligacoes: { [rm: string]: string } = {}): ContextoMusicas => ({
    existe: (id) => !!biblioteca[id],
    rascunho: (id) => biblioteca[id]?.category === CATEGORIA_NOVAS,
    ligacoes
})

/** a lista em texto curto: cabeçalho "[A]", lápide "[x:A]", rodapé "[fim]", aviso "!rm", música do Sirvo "♪show", o resto pelo id */
const desenho = (itens: ProjectShowRef[]) =>
    itens.map((i) => {
        const papel = papelDoItem(i)
        if (papel === "cabecalho") return `[${i.id.slice(6)}]`
        if (papel === "lapide") return `[x:${i.id.slice(8)}]`
        if (papel === "rodape") return "[fim]"
        if (i.data?.sirvoFalta) return `!${i.data.sirvoMusica}`
        if (i.data?.sirvoMusica) return `♪${i.id}`
        return i.id
    })

const passar = (itens: ProjectShowRef[], blocos: BlocoParaProjeto[], extra: Parameters<typeof reconciliar>[2] = {}) => reconciliar(itens, blocos, { musicas: ctx(), ...extra })

describe("músicas do Sirvo no projeto", () => {
    it("entrar: na ordem do Sirvo, logo depois do cabeçalho; aviso para a que falta", () => {
        const r = passar([], [bloco("louvor", [mus("r2", "terra", 1), mus("r1", "oceanos", 0), mus("r3", "nao_tem", 2)]), bloco("palavra")])
        expect(desenho(r.itens)).toEqual(["[louvor]", "♪oceanos", "♪terra", "!r3", "[palavra]", "[fim]"])
        const aviso = r.itens[3]
        expect(aviso).toMatchObject({ id: idDoAviso("r3"), type: "section", name: "⚠ Falta no PC: nao_tem", data: { sirvoMusica: "r3", sirvoFalta: true } })
        expect(papelDoItem(aviso)).toBeNull() // fora do prefixo sirvo_ (B2)
    })

    it("idempotente: passar de novo não muda nada", () => {
        const blocos = [bloco("louvor", [mus("r1", "oceanos", 0), mus("r3", null, 1, "Canção Nova")])]
        const a = passar([], blocos)
        const b = passar(a.itens, blocos)
        expect(b.itens).toBe(a.itens)
        expect(b.mudouEstrutura).toBe(false)
        expect(b.mudouCampos).toBe(false)
    })

    it("entrou depois da última marcada; item do operador não se move", () => {
        const um = passar([], [bloco("louvor", [mus("r1", "oceanos", 0)])]).itens
        um.splice(2, 0, { id: "video_do_operador", type: "video" })
        const r = passar(um, [bloco("louvor", [mus("r1", "oceanos", 0), mus("r2", "terra", 1)])])
        expect(desenho(r.itens)).toEqual(["[louvor]", "♪oceanos", "♪terra", "video_do_operador", "[fim]"])
    })

    it("ordem: as marcadas trocam entre si nas posições que já ocupam", () => {
        const base = passar([], [bloco("louvor", [mus("r1", "oceanos", 0), mus("r2", "terra", 1)])]).itens
        base.splice(2, 0, { id: "fala", type: "section", name: "fala" })
        expect(desenho(base)).toEqual(["[louvor]", "♪oceanos", "fala", "♪terra", "[fim]"])
        const r = passar(base, [bloco("louvor", [mus("r2", "terra", 0), mus("r1", "oceanos", 1)])])
        expect(desenho(r.itens)).toEqual(["[louvor]", "♪terra", "fala", "♪oceanos", "[fim]"])
        // os MESMOS objetos (os ponteiros seguem o objeto)
        expect(r.itens[1]).toBe(base[3])
    })

    it("sair: só sai o item com a marca; o mesmo show solto (do Remote) fica", () => {
        const base = passar([], [bloco("louvor", [mus("r1", "oceanos", 0)])]).itens
        base.push({ id: "oceanos", type: "show" }) // o Remote pôs no fim, sem marca
        const r = passar(base, [bloco("louvor", [])])
        expect(desenho(r.itens)).toEqual(["[louvor]", "[fim]", "oceanos"])
    })

    it("sair: em uso (ponteiro) fica até soltar", () => {
        const base = passar([], [bloco("louvor", [mus("r1", "oceanos", 0)])]).itens
        const r = passar(base, [bloco("louvor", [])], { ativos: [1] })
        expect(desenho(r.itens)).toEqual(["[louvor]", "♪oceanos", "[fim]"])
    })

    it("mudou de bloco: sai de um e entra no outro", () => {
        const base = passar([], [bloco("a", [mus("r1", "oceanos", 0)]), bloco("b")]).itens
        const r = passar(base, [bloco("a"), bloco("b", [mus("r7", "oceanos", 0)])])
        expect(desenho(r.itens)).toEqual(["[a]", "[b]", "♪oceanos", "[fim]"])
        expect(r.itens[2].data.sirvoMusica).toBe("r7")
    })

    it("aviso no meio do Louvor não quebra a família nem a trava", () => {
        const blocos = [bloco("louvor", [mus("r1", "oceanos", 0), mus("r2", null, 1, "Nova A"), mus("r3", null, 2, "Nova B"), mus("r4", "terra", 3)]), bloco("palavra")]
        const a = passar([], blocos)
        expect(desenho(a.itens)).toEqual(["[louvor]", "♪oceanos", "!r2", "!r3", "♪terra", "[palavra]", "[fim]"])
        expect(a.itens[2].name).toBe("⚠ Falta criar: Nova A")
        // trocar a ordem dos blocos leva as músicas e os avisos junto, sem lápide nem trava
        const b = passar(a.itens, [blocos[1], blocos[0]])
        expect(b.motivo).toBeNull()
        expect(b.sumiram).toBe(0)
        expect(desenho(b.itens)).toEqual(["[palavra]", "[louvor]", "♪oceanos", "!r2", "!r3", "♪terra", "[fim]"])
    })

    it("o aviso vira a música no mesmo lugar quando ela aparece (ligada pelo 'é esta?')", () => {
        const blocos = [bloco("louvor", [mus("r1", "oceanos", 0), mus("r2", null, 1, "Sangue"), mus("r3", "terra", 2)])]
        const a = passar([], blocos)
        expect(desenho(a.itens)).toEqual(["[louvor]", "♪oceanos", "!r2", "♪terra", "[fim]"])
        const b = reconciliar(a.itens, blocos, { musicas: ctx({ r2: "sangue" }) })
        expect(desenho(b.itens)).toEqual(["[louvor]", "♪oceanos", "♪sangue", "♪terra", "[fim]"])
    })

    it("rascunho: aparece como aviso, nunca como a música", () => {
        const r = passar([], [bloco("louvor", [mus("r9", null, 0, "Canção Nova")])])
        // o rascunho do r9 existe (sn_r9), mas está em "Novas do Sirvo"
        expect(idDoRascunho("r9")).toBe("sn_r9")
        expect(desenho(r.itens)).toEqual(["[louvor]", "!r9", "[fim]"])
        expect(r.itens[1].name).toContain("Rascunho")
    })

    it("marca duplicada por copiar e colar: a primeira é a oficial, a cópia vira do operador", () => {
        const base = passar([], [bloco("louvor", [mus("r1", "oceanos", 0), mus("r2", null, 1, "Nova")])]).itens
        base.push(JSON.parse(JSON.stringify(base[1])), JSON.parse(JSON.stringify(base[2])))
        let n = 0
        const r = reconciliar(base, [bloco("louvor", [mus("r1", "oceanos", 0), mus("r2", null, 1, "Nova")])], { musicas: ctx(), novoId: () => `novo${++n}` })
        expect(desenho(r.itens)).toEqual(["[louvor]", "♪oceanos", "!r2", "[fim]", "oceanos", "novo1"])
        expect(r.mudouCampos).toBe(true)
    })

    describe("onde o operador põe um item marcado, ele fica", () => {
        const umaMusica = [bloco("louvor", [mus("r1", "oceanos", 0)]), bloco("palavra")]
        const clonar = (item: ProjectShowRef): ProjectShowRef => JSON.parse(JSON.stringify(item))

        it("arrastou para fora da família (sem ponteiro): fica lá, sem cópia; a segunda passada não muda nada", () => {
            const base = passar([], umaMusica).itens
            base.push(base.splice(1, 1)[0]) // para a cauda
            expect(desenho(base)).toEqual(["[louvor]", "[palavra]", "[fim]", "♪oceanos"])
            const r = passar(base, umaMusica)
            expect(r.itens).toBe(base)
            expect(r.mudouEstrutura).toBe(false)
            expect(r.mudouCampos).toBe(false)
            expect(passar(r.itens, umaMusica).itens).toBe(base)
        })

        it("arrastou para outro bloco: fica lá, como item do operador, sem cópia", () => {
            const base = passar([], umaMusica).itens
            base.splice(2, 0, base.splice(1, 1)[0]) // debaixo de [palavra]
            expect(desenho(base)).toEqual(["[louvor]", "[palavra]", "♪oceanos", "[fim]"])
            const r = passar(base, umaMusica)
            expect(r.itens).toBe(base)
            // a ordem do Louvor não se intromete: o item não volta nem com mais músicas no bloco
            const mais = [bloco("louvor", [mus("r2", "terra", 0), mus("r1", "oceanos", 1)]), bloco("palavra")]
            expect(desenho(passar(base, mais).itens)).toEqual(["[louvor]", "♪terra", "[palavra]", "♪oceanos", "[fim]"])
        })

        it("arrastou para fora com a música no ar: fica lá, sem cópia", () => {
            const base = passar([], umaMusica).itens
            base.push(base.splice(1, 1)[0])
            const r = passar(base, umaMusica, { ativos: [3], protegido: true })
            expect(r.itens).toBe(base)
            expect(r.pendente).toBe(false)
            expect(passar(r.itens, umaMusica, { ativos: [3], protegido: true }).itens).toBe(base)
        })

        it("colou uma cópia ANTES da original: a original (na família) continua oficial, a cópia vira do operador, sem terceiro item", () => {
            const base = passar([], umaMusica).itens
            const original = base[1]
            base.unshift(clonar(original))
            let n = 0
            const r = reconciliar(base, umaMusica, { musicas: ctx(), novoId: () => `novo${++n}` })
            expect(desenho(r.itens)).toEqual(["oceanos", "[louvor]", "♪oceanos", "[palavra]", "[fim]"])
            expect(r.itens[2]).toBe(original)
            expect(r.itens[0].data?.sirvoMusica).toBeUndefined()
            expect(r.mudouCampos).toBe(true)
            // a segunda passada não muda nada
            const deNovo = reconciliar(r.itens, umaMusica, { musicas: ctx(), novoId: () => `novo${++n}` })
            expect(deNovo.itens).toBe(r.itens)
            expect(deNovo.mudouCampos).toBe(false)
            // o aviso colado ganha id de seção comum, onde está
            const comAviso = [bloco("louvor", [mus("r2", null, 0, "Nova")])]
            const b = passar([], comAviso).itens
            b.unshift(clonar(b[1]))
            const ra = reconciliar(b, comAviso, { musicas: ctx(), novoId: () => `novo${++n}` })
            expect(desenho(ra.itens)).toEqual(["novo1", "[louvor]", "!r2", "[fim]"])
        })

        it("a linha saiu do Sirvo: o item marcado sai de onde estiver, salvo em uso", () => {
            const base = passar([], umaMusica).itens
            base.push(base.splice(1, 1)[0])
            const semMusica = [bloco("louvor"), bloco("palavra")]
            expect(desenho(passar(base, semMusica).itens)).toEqual(["[louvor]", "[palavra]", "[fim]"])
            expect(desenho(passar(base, semMusica, { ativos: [3] }).itens)).toEqual(["[louvor]", "[palavra]", "[fim]", "♪oceanos"])
        })

        it("fora da família o objeto ainda ajusta no lugar: o aviso vira a música quando ela aparece", () => {
            const blocos = [bloco("louvor", [mus("r2", null, 0, "Sangue")])]
            const base = passar([], blocos).itens
            base.push(base.splice(1, 1)[0])
            expect(desenho(base)).toEqual(["[louvor]", "[fim]", "!r2"])
            const r = reconciliar(base, blocos, { musicas: ctx({ r2: "sangue" }) })
            expect(desenho(r.itens)).toEqual(["[louvor]", "[fim]", "♪sangue"])
        })

        it("a ordem do Sirvo só vale entre as marcadas que estão dentro da família", () => {
            const blocos = [bloco("louvor", [mus("r1", "oceanos", 0), mus("r2", "terra", 1), mus("r3", "sangue", 2)])]
            const base = passar([], blocos).itens
            base.push(base.splice(1, 1)[0]) // oceanos para a cauda
            expect(desenho(base)).toEqual(["[louvor]", "♪terra", "♪sangue", "[fim]", "♪oceanos"])
            const invertido = [bloco("louvor", [mus("r3", "sangue", 0), mus("r2", "terra", 1), mus("r1", "oceanos", 2)])]
            expect(desenho(passar(base, invertido).itens)).toEqual(["[louvor]", "♪sangue", "♪terra", "[fim]", "♪oceanos"])
            // e a faixa não acusa o que o operador levou para fora
            expect(resumirPendencia(base, blocos).musicas).toBeUndefined()
            expect(resumirPendencia(base, invertido).musicas).toEqual(["LOUVOR"])
        })
    })

    it("lápide com músicas sobrevive (nada sai) e revive com elas quando o bloco volta", () => {
        const blocos = [bloco("louvor", [mus("r1", "oceanos", 0), mus("r2", "terra", 1)]), bloco("palavra"), bloco("avisos")]
        const a = passar([], blocos)
        // a régia apagou o Louvor no Sirvo: as músicas ficam debaixo da lápide, no lugar
        const b = passar(a.itens, [blocos[1], blocos[2]])
        expect(desenho(b.itens)).toEqual(["[x:louvor]", "♪oceanos", "♪terra", "[palavra]", "[avisos]", "[fim]"])
        // restaurou (mesmo id, as músicas voltam no Sirvo sem FK): a lápide revive com elas
        const c = passar(b.itens, blocos)
        expect(desenho(c.itens)).toEqual(["[louvor]", "♪oceanos", "♪terra", "[palavra]", "[avisos]", "[fim]"])
        expect(c.itens[1]).toBe(a.itens[1])
    })

    it("momento protegido: acrescentar depois da música no ar entra sozinho; antes dela espera o Aplicar", () => {
        const um = [bloco("louvor", [mus("r1", "oceanos", 0), mus("r2", "terra", 1)]), bloco("palavra")]
        const base = passar([], um).itens
        // no ar: a primeira música (posição 1)
        const fim = passar(base, [bloco("louvor", [mus("r1", "oceanos", 0), mus("r2", "terra", 1), mus("r3", "sangue", 2)]), bloco("palavra")], { protegido: true, ativos: [1] })
        expect(fim.pendente).toBe(false)
        expect(desenho(fim.itens)).toEqual(["[louvor]", "♪oceanos", "♪terra", "♪sangue", "[palavra]", "[fim]"])

        // tirar a música no ar não tira; trocar a ordem antes dela espera
        const trocaAntes = [bloco("louvor", [mus("r2", "terra", 0), mus("r1", "oceanos", 1)]), bloco("palavra")]
        const espera = passar(base, trocaAntes, { protegido: true, ativos: [2] })
        expect(espera.pendente).toBe(true)
        expect(espera.motivo).toBe("no_ar")
        expect(espera.itens).toBe(base)
        expect(textoDaPendencia(resumirPendencia(base, trocaAntes))).toBe("músicas de LOUVOR mudaram")
        // Aplicar
        const aplicado = passar(base, trocaAntes, { protegido: true, ativos: [2], forcar: true })
        expect(desenho(aplicado.itens)).toEqual(["[louvor]", "♪terra", "♪oceanos", "[palavra]", "[fim]"])
    })

    it("sem contexto de músicas a conta é a de antes (nada de música entra)", () => {
        const r = reconciliar([], [bloco("louvor", [mus("r1", "oceanos", 0)])])
        expect(desenho(r.itens)).toEqual(["[louvor]", "[fim]"])
    })
})

describe("música nova: letra e rascunho", () => {
    it("linha em branco separa slides; [Refrão] e Refrão: dão o grupo; dois-pontos na letra não", () => {
        const letra = "Tu me chamas\nsobre as águas\n\n[Refrão]\nE ao Teu nome\n\nRefrão 2: Minha alma\ndescansa\n\nSenhor: tu és bom"
        expect(slidesDaLetra(letra)).toEqual([
            { grupo: null, linhas: ["Tu me chamas", "sobre as águas"] },
            { grupo: "Refrão", linhas: ["E ao Teu nome"] },
            { grupo: "Refrão 2", linhas: ["Minha alma", "descansa"] },
            { grupo: null, linhas: ["Senhor: tu és bom"] }
        ])
        expect(slidesDaLetra("")).toEqual([])
    })

    it("estrofe longa (ou letra sem linha em branco) quebra de 2 em 2; estrofe de até 4 fica", () => {
        expect(slidesDaLetra("a\nb\nc\nd\ne")).toEqual([
            { grupo: null, linhas: ["a", "b"] },
            { grupo: null, linhas: ["c", "d"] },
            { grupo: null, linhas: ["e"] }
        ])
        expect(slidesDaLetra("[Refrão]\n1\n2\n3\n4\n5")).toEqual([
            { grupo: "Refrão", linhas: ["1", "2"] },
            { grupo: null, linhas: ["3", "4"] },
            { grupo: null, linhas: ["5"] }
        ])
        expect(slidesDaLetra("a\nb\nc\nd\n\ne")).toEqual([
            { grupo: null, linhas: ["a", "b", "c", "d"] },
            { grupo: null, linhas: ["e"] }
        ])
    })

    it("tag no MEIO do bloco abre um slide novo, nunca vira letra", () => {
        expect(slidesDaLetra("a\n[Refrão]\nb")).toEqual([
            { grupo: null, linhas: ["a"] },
            { grupo: "Refrão", linhas: ["b"] }
        ])
        expect(slidesDaLetra("a\nRefrão: b\nc\nPonte 2:\nd\nSenhor: tu és")).toEqual([
            { grupo: null, linhas: ["a"] },
            { grupo: "Refrão", linhas: ["b", "c"] },
            { grupo: "Ponte 2", linhas: ["d", "Senhor: tu és"] }
        ])
        // a forma de saída é a espelhada no Sirvo: só grupo e linhas
        expect(Object.keys(slidesDaLetra("a")[0])).toEqual(["grupo", "linhas"])
    })

    it("o rascunho é um show na categoria Novas do Sirvo, um slide por bloco, com grupo global", () => {
        const show = rascunhoDaLetra("Canção Nova", "a\nb\n\n[Refrão]\nc", 1, "estilo")
        expect(show.category).toBe(CATEGORIA_NOVAS)
        expect(show.layouts.default.slides).toEqual([{ id: "s1" }, { id: "s2" }])
        expect(show.slides.s1).toMatchObject({ group: "Verso", globalGroup: "verse" })
        expect(show.slides.s1.children).toBeUndefined()
        expect(show.slides.s2).toMatchObject({ group: "Refrão", globalGroup: "chorus" })
        expect(show.slides.s2.items[0].lines[0].text[0].value).toBe("c")
    })

    it("estrofe partida pela quebra automática vira um grupo: pai no layout, pedaços como filhos", () => {
        const show = rascunhoDaLetra("Canção Nova", "[Refrão]\n1\n2\n3\n4\n5\n\nx", 1, "estilo")
        expect(show.layouts.default.slides).toEqual([{ id: "s1" }, { id: "s4" }])
        expect(show.slides.s1).toMatchObject({ group: "Refrão", globalGroup: "chorus", children: ["s2", "s3"] })
        expect(show.slides.s2).toEqual({
            group: null,
            color: null,
            settings: {},
            notes: "",
            items: [
                {
                    style: "estilo",
                    align: "",
                    lines: [
                        { align: "", text: [{ value: "3", style: "" }] },
                        { align: "", text: [{ value: "4", style: "" }] }
                    ]
                }
            ]
        })
        expect(show.slides.s3.items[0].lines.map((l: any) => l.text[0].value)).toEqual(["5"])
        expect(show.slides.s4.group).toBe("")
        expect(show.slides.s4.children).toBeUndefined()
        expect(show.slides.s4.items[0].lines[0].text[0].value).toBe("x")
    })

    it("'é esta?': mesmo nome normalizado, fora do rascunho, só para quem ainda não tem show", () => {
        const shows = { a1: { name: "Nada Além do Sangue", category: "musicas" }, sn_x: { name: "Nada alem do sangue", category: CATEGORIA_NOVAS }, p1: { name: "Oceanos", category: "musicas", private: true } }
        const musicas = [mus("r1", null, 0, "nada além do SANGUE!"), mus("r2", null, 1, "Oceanos"), mus("r3", "a1", 2, "Nada Além do Sangue")]
        expect(perguntasEEsta(musicas, shows, new Set(["musicas"]), {})).toEqual([{ rmId: "r1", nome: "nada além do SANGUE!", showId: "a1", showNome: "Nada Além do Sangue" }])
        expect(perguntasEEsta(musicas, shows, new Set(["musicas"]), { r1: "a1" })).toEqual([])
    })
})

describe("o rascunho não ressuscita", () => {
    const intacto = { existe: true, aindaRascunho: true, mexido: false }

    it("hash da letra: estável, sensível ao texto, e vazio tem hash", () => {
        expect(hashDaLetra("a\nb")).toBe(hashDaLetra("a\nb"))
        expect(hashDaLetra("a\nb")).not.toBe(hashDaLetra("a\nc"))
        expect(hashDaLetra(null)).toBe(hashDaLetra(""))
    })

    it("não existe: cria uma vez; apagado pelo operador, só volta se a letra mudar", () => {
        const h = hashDaLetra("letra")
        expect(acaoDoRascunho({ existe: false, aindaRascunho: false, mexido: false }, undefined, h)).toBe("criar")
        expect(acaoDoRascunho({ existe: false, aindaRascunho: false, mexido: false }, h, h)).toBe("nada")
        expect(acaoDoRascunho({ existe: false, aindaRascunho: false, mexido: false }, h, hashDaLetra("letra nova"))).toBe("criar")
    })

    it("existe: a letra mudou e ninguém mexeu, reescreve; mexido ou aprovado, adota; sem memória, adota", () => {
        const velho = hashDaLetra("letra")
        const novo = hashDaLetra("letra nova")
        expect(acaoDoRascunho(intacto, velho, velho)).toBe("nada")
        expect(acaoDoRascunho(intacto, velho, novo)).toBe("reescrever")
        expect(acaoDoRascunho({ ...intacto, mexido: true }, velho, novo)).toBe("adotar")
        expect(acaoDoRascunho({ ...intacto, aindaRascunho: false }, velho, novo)).toBe("adotar")
        // criado por um Show antigo, sem memória: não reescreve à toa
        expect(acaoDoRascunho(intacto, undefined, novo)).toBe("adotar")
    })
})

describe("'é esta?': ligação para show apagado não conta", () => {
    it("só as ligações cujo show ainda existe", () => {
        const existe = (id: string) => id === "a1"
        expect(ligacoesVivas({ r1: "a1", r2: "apagado", r3: "" }, existe)).toEqual({ r1: "a1" })
        expect(ligacoesVivas(null, existe)).toEqual({})
        // sem a ligação viva, a linha volta a ser perguntada
        const shows = { a1: { name: "Oceanos", category: "musicas" } }
        const vivas = ligacoesVivas({ r1: "apagado" }, (id) => !!shows[id as keyof typeof shows])
        expect(perguntasEEsta([mus("r1", null, 0, "Oceanos")], shows, new Set(["musicas"]), vivas)).toHaveLength(1)
    })
})

describe("o operador tirou a música do projeto (dispensadas)", () => {
    const blocos = [bloco("louvor", [mus("r1", "oceanos", 0), mus("r2", "terra", 1)]), bloco("palavra")]
    const semOceanos = () => {
        const itens = passar([], blocos).itens
        return itens.filter((i) => i.data?.sirvoMusica !== "r1")
    }

    it("a linha dispensada não entra de novo, e nada muda na lista (a mesma)", () => {
        const itens = semOceanos()
        const r = passar(itens, blocos, { dispensadas: new Set(["r1"]) })
        expect(r.itens).toBe(itens)
        expect(r).toMatchObject({ mudouEstrutura: false, mudouCampos: false })
        // sem a dispensa ela voltaria
        expect(desenho(passar(itens, blocos).itens)).toEqual(["[louvor]", "♪oceanos", "♪terra", "[palavra]", "[fim]"])
    })

    it("não conta como 'músicas mudaram' na faixa", () => {
        const itens = semOceanos()
        expect(resumirPendencia(itens, blocos).musicas).toEqual(["LOUVOR"])
        expect(resumirPendencia(itens, blocos, { dispensadas: new Set(["r1"]) }).musicas).toBeUndefined()
    })

    it("a marca dispensada voltou (Ctrl+Z) com a linha viva: fica onde está, sem mover nem duplicar", () => {
        const itens = semOceanos()
        const volta = { id: "oceanos", type: "show", data: { sirvoMusica: "r1" } } as ProjectShowRef
        const lista = [...itens.slice(0, 2), volta, ...itens.slice(2)] // depois de ♪terra, antes de [palavra]
        const r = passar(lista, blocos, { dispensadas: new Set(["r1"]) })
        expect(r.itens).toBe(lista)
        expect(desenho(r.itens)).toEqual(["[louvor]", "♪terra", "♪oceanos", "[palavra]", "[fim]"])
        expect(resumirPendencia(r.itens, blocos, { dispensadas: new Set(["r1"]) }).musicas).toBeUndefined()
    })

    it("a marca dispensada voltou (Ctrl+Z) depois de enviada, com a linha já fora do Sirvo: não é apagada", () => {
        const depois = [bloco("louvor", [mus("r2", "terra", 1)]), bloco("palavra")]
        const itens = passar([], blocos).itens // tem ♪oceanos (r1)
        expect(desenho(passar(itens, depois).itens)).toEqual(["[louvor]", "♪terra", "[palavra]", "[fim]"]) // sem a dispensa: saiu do Sirvo
        const r = passar(itens, depois, { dispensadas: new Set(["r1"]) })
        expect(r.itens).toBe(itens)
        expect(desenho(r.itens)).toEqual(["[louvor]", "♪oceanos", "♪terra", "[palavra]", "[fim]"])
    })

    it("a marca dispensada fora da família (na cauda) também fica, com a linha viva ou não", () => {
        const itens = passar([], blocos).itens
        const oceanos = itens[1]
        const lista = [...itens.filter((i) => i !== oceanos), oceanos] // depois do rodapé
        const viva = passar(lista, blocos, { dispensadas: new Set(["r1"]) })
        expect(viva.itens).toBe(lista)
        const morta = passar(lista, [bloco("louvor", [mus("r2", "terra", 1)]), bloco("palavra")], { dispensadas: new Set(["r1"]) })
        expect(morta.itens).toBe(lista)
    })

    it("bloco novo no roteiro nasce sem a linha dispensada", () => {
        const itens = passar([], [bloco("palavra")]).itens
        const r = passar(itens, [bloco("palavra"), bloco("louvor", [mus("r1", "oceanos", 0), mus("r2", "terra", 1)])], { dispensadas: new Set(["r1"]) })
        expect(desenho(r.itens)).toEqual(["[palavra]", "[louvor]", "♪terra", "[fim]"])
    })

    it("o projeto montado do zero respeita a dispensa (Montar de novo)", () => {
        expect(desenho(passar([], blocos, { dispensadas: new Set(["r2"]) }).itens)).toEqual(["[louvor]", "♪oceanos", "[palavra]", "[fim]"])
    })

    it("'é esta?' não pergunta da linha dispensada", () => {
        const shows = { oceanos: { name: "Oceanos", category: "musicas" } }
        const nova = [mus("r9", null, 0, "Oceanos")]
        expect(perguntasEEsta(nova, shows, new Set(["musicas"]), {})).toHaveLength(1)
        expect(perguntasEEsta(nova, shows, new Set(["musicas"]), {}, new Set(["r9"]))).toEqual([])
    })
})
