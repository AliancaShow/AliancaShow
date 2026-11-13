import { describe, expect, it } from "vitest"
import type { ProjectShowRef } from "../../types/Projects"
import { APAGANDO_EM, BLOCO, CAMPOS_DE_MIDIA_QUE_ATRAVESSAM, conciliarMaterial, copiarMidiaDaTroca, extrairCaminhosSirvo, GRACA_APAGAR_MS, itemDoMaterial, mapaDoRoteiro, MARCA, marcaDoMaterial, normCam, podeLimparAgora, PREFIXO_APAGADO, VERSAO, type Baixado, type MaterialDoRoteiro, type OpcoesMaterial } from "./aliancaSirvoMaterialConta"
import { ID_RODAPE, NOME_RODAPE, ordemMudaAteOPonteiro } from "./aliancaSirvoProjeto"

const cab = (id: string): ProjectShowRef => ({ id: `sirvo_${id}`, type: "section", name: id })
const rodape = (): ProjectShowRef => ({ id: ID_RODAPE, type: "section", name: NOME_RODAPE })
const doOperador = (id: string): ProjectShowRef => ({ id, type: "show" })
// `id` do teste = o ARQUIVO; a versão é `<id>.v1` (ou a que o teste disser)
const baixado = (id: string, extra: Partial<Baixado> = {}): Baixado => ({ id: `${id}.v1`, arquivo_id: id, caminho: `C:\\Online\\Sirvo\\${id}.mp4`, nome: `Video ${id}`, tipo: "video", codec: null, ...extra })
type Linha = { id: string } & Partial<Omit<MaterialDoRoteiro, "id">>
const linhaDe = (r: Linha): MaterialDoRoteiro => ({ ...r, id: `uso-${r.id}`, arquivo_id: r.id, versao_id: r.versao_id ?? `${r.id}.v1` })
const projeto = () => [cab("b1"), doOperador("musica"), rodape()]

const opcoes = (baixados: Baixado[], roteiro: Linha[] | null, extra: Partial<OpcoesMaterial> = {}): OpcoesMaterial => ({
    baixados: new Map(baixados.map((b) => [b.id, b])),
    noRoteiro: roteiro && new Map(roteiro.map((r) => [r.id, linhaDe(r)])),
    jaPostos: new Set(),
    agora: 1_000_000,
    ...extra
})

describe("material entra em 'Fora do roteiro'", () => {
    it("vai para o FIM, depois do rodapé, com a marca e o tipo certo, sem mexer em nada que já existe", () => {
        const itens = projeto()
        const r = conciliarMaterial(
            itens,
            opcoes(
                [baixado("m1"), baixado("m2", { tipo: "imagem", caminho: "C:\\x\\a.png" })],
                [
                    { id: "m1", status: "pronto" },
                    { id: "m2", status: "pronto" }
                ]
            )
        )
        expect(r.itens.slice(0, 3).every((x, i) => x === itens[i])).toBe(true)
        expect(r.itens).toHaveLength(5)
        expect(r.itens[3]).toMatchObject({ id: "C:\\Online\\Sirvo\\m1.mp4", type: "video", name: "Video m1", data: { [MARCA]: "m1" } })
        expect(r.itens[4]).toMatchObject({ type: "image", data: { [MARCA]: "m2" } })
        expect(r.postos).toEqual(["m1", "m2"])
    })
    it("sem o rodapé ainda, não entra (o projeto não foi montado)", () => {
        const r = conciliarMaterial([cab("b1")], opcoes([baixado("m1")], [{ id: "m1" }]))
        expect(r.postos).toEqual([])
    })
    it("só o que o roteiro lista; sem a lista (Sirvo antigo) não põe nem tira nada", () => {
        const itens = projeto()
        expect(conciliarMaterial(itens, opcoes([baixado("m1")], [])).postos).toEqual([])
        const r = conciliarMaterial(itens, opcoes([baixado("m1")], null))
        expect(r.itens).toBe(itens)
    })
    it("idempotente: rodar sobre o resultado não muda nada", () => {
        const o = opcoes([baixado("m1")], [{ id: "m1", status: "pronto" }])
        const r1 = conciliarMaterial(projeto(), o)
        const r2 = conciliarMaterial(r1.itens, o)
        expect(r2.itens).toBe(r1.itens)
        expect(r2.postos).toEqual([])
        expect(r2.mudouCampos).toBe(false)
    })
    it("o que o operador tirou à mão não volta (jaPostos), e o arquivo dele no projeto não é duplicado", () => {
        const itens = projeto()
        expect(conciliarMaterial(itens, opcoes([baixado("m1")], [{ id: "m1" }], { jaPostos: new Set(["m1"]) })).itens).toBe(itens)
        const dele: ProjectShowRef = { id: baixado("m1").caminho, type: "video" }
        const r = conciliarMaterial([...projeto(), dele], opcoes([baixado("m1")], [{ id: "m1" }]))
        expect(r.postos).toEqual([])
        expect(marcaDoMaterial(dele)).toBeNull()
    })
    it("HEVC leva o aviso no rótulo", () => {
        const r = conciliarMaterial(projeto(), opcoes([baixado("m1", { codec: "hvc1.1.6" })], [{ id: "m1" }]))
        expect(r.itens[3].name).toBe("Video m1 (HEVC — pode não tocar)")
    })
})

describe("marca duplicada (copiar e colar)", () => {
    it("a primeira é a oficial; a cópia vira item do operador e nunca é apagada", () => {
        const a = itemDoMaterial(baixado("m1"))
        const b = itemDoMaterial(baixado("m1"))
        const r = conciliarMaterial([...projeto(), a, b], opcoes([baixado("m1")], [{ id: "m1" }]))
        expect(r.mudouCampos).toBe(true)
        expect(marcaDoMaterial(a)).toBe("m1")
        expect(marcaDoMaterial(b)).toBeNull()
        expect(r.itens).toContain(b)
        expect(r.postos).toEqual([])
    })
})

describe("apagado no Sirvo", () => {
    const comItem = () => {
        const item = itemDoMaterial(baixado("m1"))
        return { item, itens: [...projeto(), item] }
    }
    const T0 = 1_000_000

    it("fica cinza por 30 s (e pede para ser reavaliado), depois sai do projeto", () => {
        const { item, itens } = comItem()
        const r1 = conciliarMaterial(itens, opcoes([baixado("m1")], [], { agora: T0 }))
        expect(r1.itens).toBe(itens)
        expect(item.name?.startsWith(PREFIXO_APAGADO)).toBe(true)
        expect(item.data[APAGANDO_EM]).toBe(T0)
        expect(r1.mudouCampos).toBe(true)
        expect(r1.reavaliarEm).toBe(GRACA_APAGAR_MS)

        const r2 = conciliarMaterial(itens, opcoes([baixado("m1")], [], { agora: T0 + 10_000 }))
        expect(r2.itens).toBe(itens)
        expect(r2.mudouCampos).toBe(false)
        expect(r2.reavaliarEm).toBe(GRACA_APAGAR_MS - 10_000)

        const r3 = conciliarMaterial(itens, opcoes([baixado("m1")], [], { agora: T0 + GRACA_APAGAR_MS }))
        expect(r3.itens).not.toContain(item)
        expect(r3.tirados).toEqual(["m1"])
        expect(r3.itens).toHaveLength(itens.length - 1)
    })
    it("status 'apagando' vale como apagado", () => {
        const { item, itens } = comItem()
        conciliarMaterial(itens, opcoes([baixado("m1")], [{ id: "m1", status: "apagando" }]))
        expect(item.name?.startsWith(PREFIXO_APAGADO)).toBe(true)
    })
    it("item EM USO não sai (aberto, no foco ou na saída): fica cinza até soltar", () => {
        const { item, itens } = comItem()
        const idx = itens.indexOf(item)
        const velho = T0 + 5 * GRACA_APAGAR_MS
        conciliarMaterial(itens, opcoes([baixado("m1")], [], { agora: T0 }))
        const r = conciliarMaterial(itens, opcoes([baixado("m1")], [], { agora: velho, ativos: [idx] }))
        expect(r.itens).toBe(itens)
        expect(r.tirados).toEqual([])
        expect(conciliarMaterial(itens, opcoes([baixado("m1")], [], { agora: velho, ativos: [] })).tirados).toEqual(["m1"])
    })
    it("no momento protegido só sai se nenhum ponteiro vivo está depois dele", () => {
        const { item, itens } = comItem()
        const outro = itemDoMaterial(baixado("m2"))
        const dois = [...itens, outro]
        const velho = T0 + 5 * GRACA_APAGAR_MS
        const roteiro = [{ id: "m2" }]
        const bx = [baixado("m1"), baixado("m2")]
        conciliarMaterial(dois, opcoes(bx, roteiro, { agora: T0 }))
        const bloqueado = conciliarMaterial(dois, opcoes(bx, roteiro, { agora: velho, protegido: true, ativos: [dois.indexOf(outro)] }))
        expect(bloqueado.tirados).toEqual([])
        const livre = conciliarMaterial(dois, opcoes(bx, roteiro, { agora: velho, protegido: true, ativos: [0] }))
        expect(livre.tirados).toEqual(["m1"])
        expect(livre.itens).not.toContain(item)
        const congelado = conciliarMaterial(dois, opcoes(bx, roteiro, { agora: velho, congelarRemocao: true }))
        expect(congelado.tirados).toEqual([])
    })
    it("o Sirvo restaurou: sai do cinza e volta ao nome certo", () => {
        const { item, itens } = comItem()
        conciliarMaterial(itens, opcoes([baixado("m1")], [], { agora: T0 }))
        const r = conciliarMaterial(itens, opcoes([baixado("m1")], [{ id: "m1", nome: "Video m1" }], { agora: T0 + 10_000 }))
        expect(item.name).toBe("Video m1")
        expect(item.data[APAGANDO_EM]).toBeUndefined()
        expect(item.data[MARCA]).toBe("m1")
        expect(r.mudouCampos).toBe(true)
    })
    it("só tira o que tem a marca: item do operador (mesmo parecido) nunca é tocado", () => {
        const dele: ProjectShowRef = { id: "C:\\meus\\video.mp4", type: "video", name: "meu vídeo" }
        const itens = [...projeto(), dele]
        const r = conciliarMaterial(itens, opcoes([], [], { agora: T0 + 10 * GRACA_APAGAR_MS }))
        expect(r.itens).toBe(itens)
        expect(dele.name).toBe("meu vídeo")
    })
})

describe("chave sem o interruptor 'baixa material'", () => {
    it("material [] com o interruptor desligado ou desconhecido NÃO é 'apagou tudo': mapa nulo, nada é tocado", () => {
        expect(mapaDoRoteiro([], false)).toBeNull()
        expect(mapaDoRoteiro([], null)).toBeNull()
        expect(mapaDoRoteiro(undefined, true)).toBeNull()
        expect(mapaDoRoteiro([], true)?.size).toBe(0)
        const item = itemDoMaterial(baixado("m1"))
        const itens = [...projeto(), item]
        const longe = 1_000_000 + 10 * GRACA_APAGAR_MS
        const r = conciliarMaterial(itens, { ...opcoes([baixado("m1")], null), noRoteiro: mapaDoRoteiro([], false), agora: longe })
        expect(r.itens).toBe(itens)
        expect(r.mudouCampos).toBe(false)
        expect(item.name).toBe("Video m1")
    })
})

describe("projeto religado a outro culto", () => {
    it("item de outro culto não vira '(apagado no Sirvo)' nem sai", () => {
        const velho = itemDoMaterial(baixado("m1"), "", "culto-antigo")
        const itens = [...projeto(), velho]
        const r = conciliarMaterial(itens, opcoes([], [], { eventoId: "culto-novo", agora: 1_000_000 + 10 * GRACA_APAGAR_MS }))
        expect(r.itens).toBe(itens)
        expect(velho.name).toBe("Video m1")
        expect(velho.data[APAGANDO_EM]).toBeUndefined()
    })
})

describe("material dentro do bloco escolhido no Sirvo (S5)", () => {
    const musica = (id: string): ProjectShowRef => ({ id, type: "show", data: { sirvoMusica: id } })
    // b1: cabeçalho, 2 músicas, 1 item do operador; b2: cabeçalho; rodapé
    const montado = () => [cab("b1"), musica("s1"), musica("s2"), doOperador("dele"), cab("b2"), rodape()]
    const ids = (itens: ProjectShowRef[]) => itens.map((i) => i.data?.[MARCA] ?? i.id)
    const mat = (id: string, bloco: string | null, extra: Partial<MaterialDoRoteiro> = {}): Linha => ({ id, bloco_id: bloco, status: "pronto", ...extra })

    it("entra logo depois das músicas do bloco (antes do item do operador), e os seguintes depois dele, na ordem do Sirvo", () => {
        const r = conciliarMaterial(montado(), opcoes([baixado("m1"), baixado("m2")], [mat("m1", "b1"), mat("m2", "b1")]))
        expect(ids(r.itens)).toEqual(["sirvo_b1", "s1", "s2", "m1", "m2", "dele", "sirvo_b2", ID_RODAPE])
        expect(r.itens[3].data[BLOCO]).toBe("b1")
        expect(r.postos).toEqual(["m1", "m2"])
        expect(r.pendente).toBe(false)
    })
    it("bloco sem música: logo depois do cabeçalho; um novo entra depois do material que já está lá", () => {
        const itens = montado()
        const r1 = conciliarMaterial(itens, opcoes([baixado("m1")], [mat("m1", "b2")]))
        expect(ids(r1.itens)).toEqual(["sirvo_b1", "s1", "s2", "dele", "sirvo_b2", "m1", ID_RODAPE])
        const r2 = conciliarMaterial(r1.itens, opcoes([baixado("m1"), baixado("m2")], [mat("m1", "b2"), mat("m2", "b2")]))
        expect(ids(r2.itens)).toEqual(["sirvo_b1", "s1", "s2", "dele", "sirvo_b2", "m1", "m2", ID_RODAPE])
    })
    it("sem bloco ou bloco que não está no projeto: Fora do roteiro (fim)", () => {
        const r = conciliarMaterial(montado(), opcoes([baixado("m1"), baixado("m2")], [mat("m1", null), mat("m2", "b9")]))
        expect(ids(r.itens).slice(-3)).toEqual([ID_RODAPE, "m1", "m2"])
        expect(r.itens.at(-1)?.data[BLOCO]).toBe("")
    })
    it("idempotente com o item dentro do bloco", () => {
        const o = opcoes([baixado("m1")], [mat("m1", "b1")])
        const r1 = conciliarMaterial(montado(), o)
        const r2 = conciliarMaterial(r1.itens, o)
        expect(r2.itens).toBe(r1.itens)
        expect(r2.mudouCampos).toBe(false)
    })
    it("religou a outro bloco no Sirvo: o item se mexe (e o BLOCO acompanha); o que o operador arrastou, sem mudança no Sirvo, fica onde ele pôs", () => {
        const r1 = conciliarMaterial(montado(), opcoes([baixado("m1")], [mat("m1", "b1")]))
        const r2 = conciliarMaterial(r1.itens, opcoes([baixado("m1")], [mat("m1", "b2")]))
        expect(ids(r2.itens)).toEqual(["sirvo_b1", "s1", "s2", "dele", "sirvo_b2", "m1", ID_RODAPE])
        expect(r2.itens[5].data[BLOCO]).toBe("b2")
        expect(r2.itens[5]).toBe(r1.itens[3]) // o MESMO objeto (os ponteiros acompanham)
        // o operador leva para o fim; o Sirvo continua dizendo b2: não briga
        const arrastado = [...r2.itens.filter((i) => i.data?.[MARCA] !== "m1"), r2.itens[5]]
        expect(conciliarMaterial(arrastado, opcoes([baixado("m1")], [mat("m1", "b2")])).itens).toBe(arrastado)
    })
    it("momento protegido: o que alcança um ponteiro vivo fica PENDENTE; o 'Aplicar' (forcar) passa; depois do ponteiro entra sozinho", () => {
        const itens = montado()
        const o = opcoes([baixado("m1")], [mat("m1", "b1")])
        // ponteiro vivo no item do operador (posição 3), depois do ponto de entrada (3): a posição 3 muda
        const preso = conciliarMaterial(itens, { ...o, protegido: true, ativos: [3] })
        expect(preso.pendente).toBe(true)
        expect(preso.itens).toBe(itens)
        expect(preso.postos).toEqual([])
        const aplicado = conciliarMaterial(itens, { ...o, protegido: true, ativos: [3], forcar: true })
        expect(aplicado.pendente).toBe(false)
        expect(ids(aplicado.itens)[3]).toBe("m1")
        // ponteiro no cabeçalho (0): a primeira posição que muda é a 3, depois dele
        const livre = conciliarMaterial(itens, { ...o, protegido: true, ativos: [0] })
        expect(livre.pendente).toBe(false)
        expect(ids(livre.itens)[3]).toBe("m1")
        // Fora do roteiro (fim) nunca alcança ponteiro
        const fim = conciliarMaterial(itens, { ...opcoes([baixado("m1")], [mat("m1", null)]), protegido: true, ativos: [3] })
        expect(fim.pendente).toBe(false)
    })
    it("religação no momento protegido também espera; fora dele (sem ponteiro) acontece na hora", () => {
        const r1 = conciliarMaterial(montado(), opcoes([baixado("m1")], [mat("m1", "b1")]))
        const o = opcoes([baixado("m1")], [mat("m1", "b2")])
        const preso = conciliarMaterial(r1.itens, { ...o, protegido: true, ativos: [4] })
        expect(preso.pendente).toBe(true)
        expect(preso.itens).toBe(r1.itens)
        expect(preso.itens[3].data[BLOCO]).toBe("b1")
    })
    it("item em uso não é levado a outro bloco", () => {
        const r1 = conciliarMaterial(montado(), opcoes([baixado("m1")], [mat("m1", "b1")]))
        const r2 = conciliarMaterial(r1.itens, { ...opcoes([baixado("m1")], [mat("m1", "b2")]), ativos: [3] })
        expect(r2.itens).toBe(r1.itens)
    })
    it("a trava compartilhada: ordemMudaAteOPonteiro", () => {
        const a = montado()
        const b = [...a.slice(0, 3), doOperador("x"), ...a.slice(3)]
        expect(ordemMudaAteOPonteiro(a, b, [2])).toBe(false)
        expect(ordemMudaAteOPonteiro(a, b, [3])).toBe(true)
        expect(ordemMudaAteOPonteiro(a, b, [])).toBe(false)
    })

    it("a: o item já está na posição certa (só a marca muda): a lista é a MESMA, sem escrita estrutural", () => {
        const itens = montado()
        const item = itemDoMaterial(baixado("m1"), "") // veio do S3 sem bloco, mas já está no lugar do bloco b1
        itens.splice(3, 0, item)
        const r = conciliarMaterial(itens, opcoes([baixado("m1")], [mat("m1", "b1")]))
        expect(r.itens).toBe(itens)
        expect(r.mudouCampos).toBe(true)
        expect(item.data[BLOCO]).toBe("b1")
    })
    it("b: bloco removido no Sirvo (lápide): o material que estava nele fica; o novo vai para o fim", () => {
        const lapide: ProjectShowRef = { id: "sirvo_x_b1", type: "section", name: "(removido no Sirvo) b1" }
        const velho = itemDoMaterial(baixado("m1"), "b1")
        const itens = [lapide, velho, cab("b2"), rodape()]
        const r = conciliarMaterial(itens, opcoes([baixado("m1"), baixado("m2")], [mat("m1", null), mat("m2", "b1")]))
        expect(r.itens[1]).toBe(velho)
        expect(velho.data[BLOCO]).toBe("b1")
        expect(ids(r.itens)).toEqual(["sirvo_x_b1", "m1", "sirvo_b2", ID_RODAPE, "m2"])
    })
    it("c: o que vai para o fim passa na frente; o que alcança o ponteiro fica pendente sozinho", () => {
        const itens = montado()
        const r = conciliarMaterial(itens, { ...opcoes([baixado("m1"), baixado("m2")], [mat("m1", "b1"), mat("m2", null)]), protegido: true, ativos: [3] })
        expect(r.pendente).toBe(true)
        expect(r.postos).toEqual(["m2"])
        expect(ids(r.itens)).toEqual(["sirvo_b1", "s1", "s2", "dele", "sirvo_b2", ID_RODAPE, "m2"])
    })
    it("item legado do S3 (sem sirvoBloco, no fim) migra para o bloco", () => {
        const legado: ProjectShowRef = { id: baixado("m1").caminho, type: "video", name: "Video m1", data: { [MARCA]: "m1" } }
        const r = conciliarMaterial([...montado(), legado], opcoes([baixado("m1")], [mat("m1", "b1")]))
        expect(ids(r.itens)).toEqual(["sirvo_b1", "s1", "s2", "m1", "dele", "sirvo_b2", ID_RODAPE])
        expect(legado.data[BLOCO]).toBe("b1")
    })
    it("projeto fechado com slide de posição desconhecida (congelarRemocao): religar espera; só entrar no fim passa", () => {
        const r1 = conciliarMaterial(montado(), opcoes([baixado("m1")], [mat("m1", "b1")]))
        const preso = conciliarMaterial(r1.itens, { ...opcoes([baixado("m1")], [mat("m1", "b2")]), protegido: true, congelarRemocao: true })
        expect(preso.pendente).toBe(true)
        expect(preso.itens).toBe(r1.itens)
        const fim = conciliarMaterial(r1.itens, { ...opcoes([baixado("m1"), baixado("m2")], [mat("m1", "b1"), mat("m2", null)]), protegido: true, congelarRemocao: true })
        expect(fim.pendente).toBe(false)
        expect(ids(fim.itens).at(-1)).toBe("m2")
    })
})

const mat = (id: string, bloco: string | null, extra: Partial<MaterialDoRoteiro> = {}): Linha => ({ id, bloco_id: bloco, status: "pronto", ...extra })

describe("v5: versão nova do mesmo arquivo troca NO LUGAR", () => {
    const musica = (id: string): ProjectShowRef => ({ id, type: "show", data: { sirvoMusica: id } })
    const montado = () => [cab("b1"), musica("s1"), doOperador("dele"), cab("b2"), rodape()]
    const v2 = (id: string, extra: Partial<Baixado> = {}) => baixado(id, { id: `${id}.v2`, caminho: `C:\\Online\\Sirvo\\${id}-v2.mp4`, nome: `Video ${id} v2`, ...extra })
    // o projeto com m1 em v1 dentro do bloco b1
    const comV1 = () => conciliarMaterial(montado(), opcoes([baixado("m1")], [mat("m1", "b1")])).itens
    const pronto2 = (extra: Partial<OpcoesMaterial> = {}) => opcoes([baixado("m1"), v2("m1")], [mat("m1", "b1", { versao_id: "m1.v2" })], extra)

    it("livre e fora do momento protegido: mesmo índice, MESMA lista; id, versão e nome acompanham", () => {
        const itens = comV1()
        const item = itens[2]
        const r = conciliarMaterial(itens, pronto2())
        expect(r.itens).toBe(itens)
        expect(r.itens[2]).toBe(item)
        expect(item.id).toBe("C:\\Online\\Sirvo\\m1-v2.mp4")
        expect(item.data[VERSAO]).toBe("m1.v2")
        expect(item.data[MARCA]).toBe("m1")
        expect(item.name).toBe("Video m1 v2")
        expect(r.mudouCampos).toBe(true)
        expect(r.trocas).toEqual([{ arquivo: "m1", de: "C:\\Online\\Sirvo\\m1.mp4", para: "C:\\Online\\Sirvo\\m1-v2.mp4" }])
        expect(r.pendente).toBe(false)
        // idempotente
        const r2 = conciliarMaterial(itens, pronto2())
        expect(r2.trocas).toEqual([])
        expect(r2.mudouCampos).toBe(false)
    })
    it("a v2 ainda não está no disco: nada muda", () => {
        const itens = comV1()
        const r = conciliarMaterial(itens, opcoes([baixado("m1")], [mat("m1", "b1", { versao_id: "m1.v2" })]))
        expect(r.trocas).toEqual([])
        expect(itens[2].data[VERSAO]).toBe("m1.v1")
    })
    it("PROTEGIDO: a troca vira pendência (Aplicar), nada muda na lista nem no item; com 'forcar' troca", () => {
        const itens = comV1()
        const id0 = itens[2].id
        const preso = conciliarMaterial(itens, pronto2({ protegido: true, ativos: [0] }))
        expect(preso.pendente).toBe(true)
        expect(preso.trocaPendente).toEqual(["Video m1 v2"])
        expect(preso.trocas).toEqual([])
        expect(preso.itens).toBe(itens)
        expect(itens[2].id).toBe(id0)
        expect(itens[2].data[VERSAO]).toBe("m1.v1")
        // sem nenhum ponteiro vivo também espera: a regra é o momento, não a posição
        expect(conciliarMaterial(itens, pronto2({ protegido: true, ativos: [] })).pendente).toBe(true)
        // projeto fechado com slide de posição desconhecida
        expect(conciliarMaterial(itens, pronto2({ congelarRemocao: true })).pendente).toBe(true)
        const aplicado = conciliarMaterial(itens, pronto2({ protegido: true, ativos: [0], forcar: true }))
        expect(aplicado.pendente).toBe(false)
        expect(itens[2].data[VERSAO]).toBe("m1.v2")
    })
    it("só ABERTO no centro / em foco (ativos, fora do ar): troca na hora, mesmo índice", () => {
        const itens = comV1()
        const item = itens[2]
        const r = conciliarMaterial(itens, pronto2({ ativos: [2] }))
        expect(r.trocas).toHaveLength(1)
        expect(r.trocaEmUso).toEqual([])
        expect(r.itens[2]).toBe(item)
        expect(item.data[VERSAO]).toBe("m1.v2")
    })
    it("aberto no centro MAS protegido (culto no ar): continua pendência com Aplicar, como antes", () => {
        const itens = comV1()
        const r = conciliarMaterial(itens, pronto2({ ativos: [2], protegido: true }))
        expect(r.pendente).toBe(true)
        expect(r.trocaPendente).toEqual(["Video m1 v2"])
        expect(itens[2].data[VERSAO]).toBe("m1.v1")
    })
    it("EM USO nunca troca, nem com Aplicar: ponteiro de saída, saída com o caminho ou áudio tocando (caminho em emUso)", () => {
        const base = comV1()
        const idx = 2
        const casos: Partial<OpcoesMaterial>[] = [{ ativosNoAr: [idx] }, { emUso: new Set([normCam("C:\\Online\\Sirvo\\m1.mp4")]) }, { ativos: [idx], ativosNoAr: [idx], protegido: true, forcar: true }, { emUso: new Set([normCam("c:/online/sirvo/M1.mp4")]), forcar: true }]
        for (const extra of casos) {
            const r = conciliarMaterial(base, pronto2(extra))
            expect(r.trocas).toEqual([])
            expect(r.trocaEmUso).toEqual(["Video m1 v2"])
            expect(base[idx].data[VERSAO]).toBe("m1.v1")
            expect(r.pendente).toBe(false)
        }
        // soltou: troca
        expect(conciliarMaterial(base, pronto2()).trocas).toHaveLength(1)
    })
    it("a v2 já está no projeto (item do operador no mesmo caminho): não troca, e avisa", () => {
        const dele: ProjectShowRef = { id: v2("m1").caminho, type: "video" }
        const itens = [...comV1(), dele]
        const r = conciliarMaterial(itens, pronto2())
        expect(r.trocas).toEqual([])
        expect(r.trocaJaNoProjeto).toEqual(["Video m1 v2"])
        expect(itens[2].data[VERSAO]).toBe("m1.v1")
    })
    it("um uso novo (id novo) para o MESMO arquivo deixa o item intacto; v1 -> v3 direto", () => {
        const itens = comV1()
        const item = itens[2]
        const r = conciliarMaterial(
            itens,
            opcoes(
                [baixado("m1")],
                [{ id: "m1", bloco_id: "b1", status: "pronto" }].map((l) => ({ ...l }))
            )
        )
        expect(r.itens).toBe(itens)
        expect(itens[2]).toBe(item)
        const v3 = v2("m1", { id: "m1.v3", caminho: "C:\\Online\\Sirvo\\m1-v3.mp4" })
        const r3 = conciliarMaterial(itens, opcoes([baixado("m1"), v3], [mat("m1", "b1", { versao_id: "m1.v3" })]))
        expect(r3.trocas[0].para).toBe("C:\\Online\\Sirvo\\m1-v3.mp4")
        expect(itens[2].data[VERSAO]).toBe("m1.v3")
    })
    it("tirar + usar de novo no culto: o mesmo item (por arquivo) volta do cinza, sem sair do lugar", () => {
        const itens = comV1()
        const item = itens[2]
        conciliarMaterial(itens, opcoes([baixado("m1")], [], { agora: 1_000_000 }))
        expect(item.name?.startsWith(PREFIXO_APAGADO)).toBe(true)
        const r = conciliarMaterial(itens, opcoes([baixado("m1")], [{ id: "m1", bloco_id: "b1", status: "pronto" }], { agora: 1_010_000 }))
        expect(r.itens).toBe(itens)
        expect(itens[2]).toBe(item)
        expect(item.data[APAGANDO_EM]).toBeUndefined()
    })
    it("item apagado e em uso por ÁUDIO (emUso) não sai", () => {
        const itens = comV1()
        const T0 = 1_000_000
        conciliarMaterial(itens, opcoes([baixado("m1")], [], { agora: T0 }))
        const r = conciliarMaterial(itens, opcoes([baixado("m1")], [], { agora: T0 + 5 * GRACA_APAGAR_MS, emUso: new Set([normCam(itens[2].id)]) }))
        expect(r.tirados).toEqual([])
    })
    it("itemDoMaterial leva arquivo, versão e culto", () => {
        const it = itemDoMaterial(baixado("m1"), "b1", "ev")
        expect(it.data).toMatchObject({ [MARCA]: "m1", [VERSAO]: "m1.v1", [BLOCO]: "b1", sirvoMaterialEvento: "ev" })
    })
})

describe("v5: a mídia do operador atravessa a troca só pela lista branca", () => {
    it("copia fit/volume/loop… e NUNCA fromTime/toTime/info/tracks/cropping", () => {
        const media = { A: { fit: "cover", fitOptions: { x: 1 }, volume: 0.5, loop: true, videoType: "background", audioType: "music", speed: "2", filter: "blur", flipped: true, flippedY: false, fromTime: 5, toTime: 9, info: { codec: "x" }, creationTime: 1, tracks: [1], cropping: { top: 1 }, favourite: true } }
        const r = copiarMidiaDaTroca(media as any, "A", "B")
        expect(Object.keys(r.B).sort()).toEqual([...CAMPOS_DE_MIDIA_QUE_ATRAVESSAM].sort())
        expect(r.B.fromTime).toBeUndefined()
        expect(r.B.toTime).toBeUndefined()
        expect(r.B.info).toBeUndefined()
        expect(r.B.tracks).toBeUndefined()
        expect(r.B.cropping).toBeUndefined()
        expect(r.A).toBe(media.A)
    })
    it("se media[novo] já existe não sobrescreve; sem media[antigo] nada a fazer", () => {
        const media = { A: { fit: "cover" }, B: { fit: "contain", fromTime: 3 } }
        expect(copiarMidiaDaTroca(media as any, "A", "B")).toBe(media)
        expect(copiarMidiaDaTroca(media as any, "Z", "C")).toBe(media)
        expect(copiarMidiaDaTroca({ A: { info: 1 } } as any, "A", "B")).toEqual({ A: { info: 1 } })
    })
})

describe("v5: o gatilho da limpeza", () => {
    const ok = { roteiroNoAr: false, saidasComAlgo: 0, tocando: 0, ultimaEm: 0, agora: 100 * 3_600_000 }
    it("só com saída vazia, nada tocando (pausado conta), fora do roteiroNoAr e 24 h depois da última", () => {
        expect(podeLimparAgora(ok)).toBe(true)
        expect(podeLimparAgora({ ...ok, roteiroNoAr: true })).toBe(false)
        expect(podeLimparAgora({ ...ok, saidasComAlgo: 1 })).toBe(false)
        expect(podeLimparAgora({ ...ok, tocando: 1 })).toBe(false)
        expect(podeLimparAgora({ ...ok, ultimaEm: ok.agora - 3_600_000 })).toBe(false)
    })
})

describe("v5 revisão: correções", () => {
    it("extrairCaminhosSirvo acha o caminho de um JSON.stringify real do Windows (barras dobradas)", () => {
        const caminho = "C:\\Users\\igreja\\Documents\\AliancaShow\\Online\\Sirvo\\Vinheta__aaaaaaaa\\Vinheta__11111111.mp4"
        const json = JSON.stringify({ tema: { fundo: caminho } })
        expect(json).toContain("\\\\Online\\\\Sirvo")
        expect(extrairCaminhosSirvo(json)).toEqual([caminho])
        expect(extrairCaminhosSirvo(JSON.stringify({ a: "D:/x/Online/Sirvo/p/q.mp4" }))).toEqual(["D:/x/Online/Sirvo/p/q.mp4"])
        expect(extrairCaminhosSirvo(JSON.stringify({ a: "C:\\fora\\video.mp4" }))).toEqual([])
    })
    it("troca segurada (protegido ou em uso) NÃO renomeia o item para o nome da versão nova", () => {
        const musica: ProjectShowRef = { id: "s1", type: "show", data: { sirvoMusica: "s1" } }
        const itens = conciliarMaterial([cab("b1"), musica, rodape()], opcoes([baixado("m1")], [mat("m1", "b1")])).itens
        const nova = baixado("m1", { id: "m1.v2", caminho: "C:\\Online\\Sirvo\\m1-v2.mp4", nome: "Nome novo" })
        const o = opcoes([baixado("m1"), nova], [mat("m1", "b1", { versao_id: "m1.v2", nome: "Nome novo" })], { protegido: true })
        const item = itens.find((i) => i.data?.[MARCA] === "m1")!
        conciliarMaterial(itens, o)
        expect(item.name).toBe("Video m1")
        conciliarMaterial(itens, { ...o, protegido: false, ativosNoAr: [itens.indexOf(item)] })
        expect(item.name).toBe("Video m1")
    })
    it("show_roteiro sem a chave material, null ou não-array: desconhecido, nada muda (só array é autoridade)", () => {
        expect(mapaDoRoteiro(undefined, true)).toBeNull()
        expect(mapaDoRoteiro(null, true)).toBeNull()
        expect(mapaDoRoteiro({}, true)).toBeNull()
        const item = itemDoMaterial(baixado("m1"))
        const itens = [...projeto(), item]
        const r = conciliarMaterial(itens, { ...opcoes([baixado("m1")], null), noRoteiro: mapaDoRoteiro(null, true), agora: 1_000_000 + 10 * GRACA_APAGAR_MS })
        expect(r.itens).toBe(itens)
        expect(item.data[APAGANDO_EM]).toBeUndefined()
    })
})
