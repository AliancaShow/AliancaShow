import path from "path"
import { describe, expect, it } from "vitest"
import { cabeNoDisco, candidatosALimpar, caminhosReferenciados, comTentativas, decidirLinha, decidirRelato, ehHevc, estadoParaRenderer, etagEhMd5, etagsIguais, filtrarRegistros, limparEtag, limparNome, nomeDaPasta, nomeDoArquivo, pastaDoMaterial, PRAZO_LIXEIRA_MS, resolverDestino, rotuloDoMaterial, tipoDaExtensao, urlDoMaterialValida, validarPendente, type EstadoMaterial } from "./materialLogica"

const ID = "0f8a1c2e-1111-4222-8333-444455556666"
const AR = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const IGREJA = "11111111-2222-4333-8444-555555555555"
const CONTA = "0123456789abcdef0123456789abcdef"
const url = (caminho: string, host = `${CONTA}.r2.cloudflarestorage.com`) => `https://${host}${caminho}?X-Amz-Signature=abc&X-Amz-Expires=604800`
const m = { id: ID, ext: "mp4", arquivo_id: AR }
const boa = `/sirvo-material/igrejas/${IGREJA}/arquivos/${AR}/${ID}.mp4`

describe("nome do arquivo no disco", () => {
    it("limpa acento, símbolo, extensão repetida e ponto no começo", () => {
        expect(limparNome("Abertura Vídeo (final).MP4")).toBe("Abertura Video final")
        expect(limparNome("../../Startup/virus")).toBe("Startupvirus")
        expect(limparNome("..\\..\\x.exe")).toBe("x")
        expect(limparNome(".oculto")).toBe("oculto")
        expect(limparNome("   ")).toBe("arquivo")
        expect(limparNome("ação 日本語")).toBe("acao")
    })
    it("tem no máximo 40 caracteres e nome reservado do Windows ganha sublinhado", () => {
        expect(limparNome("a".repeat(100)).length).toBe(40)
        expect(limparNome("CON")).toBe("_CON")
        expect(limparNome("nul.mp4")).toBe("_nul")
    })
    it("<nome-limpo>__<id8>.<ext>, com a extensão da lista fechada", () => {
        expect(nomeDoArquivo("Abertura", ID, "MP4")).toBe("Abertura__0f8a1c2e.mp4")
        expect(nomeDoArquivo("x", ID, "exe")).toBeNull()
        expect(nomeDoArquivo("x", ID, "mp4.exe")).toBeNull()
        expect(nomeDoArquivo("x", "nao-e-uuid", "mp4")).toBeNull()
    })
})

describe("extensões", () => {
    it("lista fechada por tipo", () => {
        expect(tipoDaExtensao("mp4")).toBe("video")
        expect(tipoDaExtensao("JPG")).toBe("imagem")
        expect(tipoDaExtensao("m4a")).toBe("audio")
        for (const ruim of ["exe", "pdf", "heic", "html", "svg", "", "mp4 ", "../mp4"]) expect(tipoDaExtensao(ruim)).toBeNull()
    })
    it("validarPendente descarta o que foge da lista, do teto ou do formato", () => {
        const ok = { id: ID, nome: "A<b>", ext: "mp4", tipo: "video", tamanho: 1000, etag: '"d41d8cd98f00b204e9800998ecf8427e"', codec: "hvc1", arquivo_id: AR, baixa_status: "baixado" }
        expect(validarPendente(ok)).toMatchObject({ id: ID, arquivo_id: AR, nome: "A‹b›", tipo: "video", etag: "d41d8cd98f00b204e9800998ecf8427e", codec: "hvc1", baixa_status: "baixado" })
        expect(validarPendente({ ...ok, arquivo_id: undefined })).toBeNull()
        expect(validarPendente({ ...ok, baixa_status: "x" })?.baixa_status).toBeNull()
        expect(validarPendente({ ...ok, ext: "exe" })).toBeNull()
        expect(validarPendente({ ...ok, tipo: "imagem" })).toBeNull()
        expect(validarPendente({ ...ok, tamanho: 0 })).toBeNull()
        expect(validarPendente({ ...ok, tamanho: 2 * 1024 ** 3 })).toBeNull()
        expect(validarPendente({ ...ok, id: "../x" })).toBeNull()
        expect(validarPendente({ ...ok, etag: "" })).toBeNull()
        expect(validarPendente(null)).toBeNull()
    })
})

describe("onde o arquivo cai", () => {
    const raiz = path.resolve("/tmp/Online")
    it("a pasta é a que JÁ EXISTE no disco com o sufixo __<arquivo8>; só sem nenhuma cria com o nome da pendente", () => {
        const m = { arquivo_id: AR, nome: "Vinheta Nova" }
        expect(nomeDaPasta("Vinheta", AR)).toBe("Vinheta__aaaaaaaa")
        expect(pastaDoMaterial(m)).toEqual(["Sirvo", "Vinheta Nova__aaaaaaaa"])
        expect(pastaDoMaterial(m, ["Outra__bbbbbbbb", "Vinheta antiga__aaaaaaaa"])).toEqual(["Sirvo", "Vinheta antiga__aaaaaaaa"])
        expect(pastaDoMaterial(m, ["2026-11-15"])).toEqual(["Sirvo", "Vinheta Nova__aaaaaaaa"])
    })
    it("direto na pasta do arquivo, dentro da pasta Online", () => {
        const r = resolverDestino(raiz, ["Sirvo", "Abertura__aaaaaaaa"], "Abertura__0f8a1c2e.mp4")!
        expect(r.pasta).toBe(path.join(raiz, "Sirvo", "Abertura__aaaaaaaa"))
        expect(r.destino).toBe(path.join(raiz, "Sirvo", "Abertura__aaaaaaaa", "Abertura__0f8a1c2e.mp4"))
    })
    it("recusa caminho que sai da pasta, subpasta no nome e nome reservado", () => {
        expect(resolverDestino(raiz, ["Sirvo", ".."], "a.mp4")).toBeNull()
        expect(resolverDestino(raiz, ["..", ".."], "a.mp4")).toBeNull()
        expect(resolverDestino(raiz, ["Sirvo", "x"], "../a.mp4")).toBeNull()
        expect(resolverDestino(raiz, ["Sirvo", "x"], "sub/a.mp4")).toBeNull()
        expect(resolverDestino(raiz, ["Sirvo", "x"], "nul.mp4")).toBeNull()
        expect(resolverDestino(raiz, ["Sirvo", "x"], "")).toBeNull()
    })
})

describe("a URL do R2 serve para este arquivo?", () => {
    it("aceita host da conta, balde conhecido e caminho igual ao pedido", () => {
        expect(urlDoMaterialValida(url(boa), m)).toBe(true)
        expect(urlDoMaterialValida(url(boa.replace("sirvo-material", "sirvo-material-staging")), m)).toBe(true)
        expect(urlDoMaterialValida(url(boa), m, { hostExato: `${CONTA}.r2.cloudflarestorage.com`, baldes: ["sirvo-material"] })).toBe(true)
    })
    it("recusa host fora do R2, host de outra conta quando fixado, balde fora da lista e porta/login", () => {
        expect(urlDoMaterialValida(url(boa, "evil.example.com"), m)).toBe(false)
        expect(urlDoMaterialValida(url(boa, `${CONTA}.r2.cloudflarestorage.com.evil.com`), m)).toBe(false)
        expect(urlDoMaterialValida(url(boa, "abc.r2.cloudflarestorage.com"), m)).toBe(false)
        expect(urlDoMaterialValida(url(boa, "ffffffffffffffffffffffffffffffff.r2.cloudflarestorage.com"), m, { hostExato: `${CONTA}.r2.cloudflarestorage.com` })).toBe(false)
        expect(urlDoMaterialValida(url(boa.replace("sirvo-material", "outro-balde")), m)).toBe(false)
        expect(urlDoMaterialValida(url(boa.replace("sirvo-material", "sirvo-material-staging")), m, { baldes: ["sirvo-material"] })).toBe(false)
        expect(urlDoMaterialValida(url(boa).replace("https://", "https://u:p@"), m)).toBe(false)
        expect(urlDoMaterialValida(url(boa).replace(".com/", ".com:8443/"), m)).toBe(false)
        expect(urlDoMaterialValida(url(boa).replace("https:", "http:"), m)).toBe(false)
    })
    it("recusa a URL boa de OUTRO arquivo, outro evento, outra extensão e caminho torto", () => {
        expect(urlDoMaterialValida(url(boa.replace(ID, "0f8a1c2e-1111-4222-8333-444455556667")), m)).toBe(false)
        expect(urlDoMaterialValida(url(boa.replace(AR, "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee")), m)).toBe(false)
        expect(urlDoMaterialValida(url(boa.replace(".mp4", ".mov")), m)).toBe(false)
        // o caminho antigo (por evento) não vale mais
        expect(urlDoMaterialValida(url(boa.replace("/arquivos/", "/eventos/")), m)).toBe(false)
        expect(urlDoMaterialValida(url(boa.replace("igrejas/", "igrejas/../")), m)).toBe(false)
        expect(urlDoMaterialValida(url(boa.replace(`${AR}/`, `${AR}/upload/`)), m)).toBe(false)
        expect(urlDoMaterialValida(url(boa.replace("/igrejas/", "/%69grejas/")), m)).toBe(false)
        expect(urlDoMaterialValida("", m)).toBe(false)
        expect(urlDoMaterialValida(null, m)).toBe(false)
        expect(urlDoMaterialValida("not a url", m)).toBe(false)
    })
})

describe("conferências do arquivo", () => {
    it("ETag sem aspas e sem W/, comparado em minúsculas", () => {
        expect(limparEtag('"ABCDEF0123456789"')).toBe("abcdef0123456789")
        expect(limparEtag('W/"abcdef0123456789"')).toBe("abcdef0123456789")
        expect(limparEtag("x")).toBe("")
        expect(etagsIguais('"d41d8cd98f00b204e9800998ecf8427e"', "D41D8CD98F00B204E9800998ECF8427E")).toBe(true)
        expect(etagsIguais("", "")).toBe(false)
        expect(etagEhMd5("d41d8cd98f00b204e9800998ecf8427e")).toBe(true)
        expect(etagEhMd5("d41d8cd98f00b204e9800998ecf8427e-3")).toBe(false)
    })
    it("espaço livre: tamanho + 500 MB", () => {
        const MB = 1024 * 1024
        expect(cabeNoDisco(600 * MB, 100 * MB)).toBe(true)
        expect(cabeNoDisco(599 * MB, 100 * MB)).toBe(false)
        expect(cabeNoDisco(NaN, 1)).toBe(false)
    })
    it("HEVC no rótulo", () => {
        expect(ehHevc("hvc1.1.6.L93.B0")).toBe(true)
        expect(ehHevc("avc1.64001f")).toBe(false)
        expect(rotuloDoMaterial("Abertura", "hev1")).toBe("Abertura (HEVC — pode não tocar)")
        expect(rotuloDoMaterial("Abertura", "avc1")).toBe("Abertura")
    })
})

describe("a URL nunca vai para o renderer", () => {
    const sujo = {
        habilitado: true,
        baixando: 1,
        naFila: 2,
        lote: { total: 3, feitos: 1, url: "https://x.r2.cloudflarestorage.com/a?X-Amz-Signature=s" },
        falhas: [{ id: ID, nome: "Falha", detalhe: "tamanho", url: "https://x.r2.cloudflarestorage.com/a" }],
        disco: { usado: 5, livre: 6, limpeza: { em: 1, arquivos: 0, bytes: 0, adiada: null, url: "https://x.r2.cloudflarestorage.com/z?X-Amz-Signature=s" }, url: "X-Amz-Signature=s" },
        baixados: [{ id: ID, arquivo_id: AR, caminho: "C:\\Online\\Sirvo\\a__0f8a1c2e.mp4", nome: "A", tipo: "video", codec: null, url: "https://x.r2.cloudflarestorage.com/a?X-Amz-Signature=s", urlAssinada: "X-Amz-Signature=s" }]
    } as unknown as EstadoMaterial
    it("o estado que atravessa só tem as chaves conhecidas", () => {
        const fora = estadoParaRenderer(sujo)
        expect(JSON.stringify(fora)).not.toMatch(/X-Amz|r2\.cloudflarestorage/i)
        expect(Object.keys(fora.baixados[0]).sort()).toEqual(["arquivo_id", "caminho", "codec", "id", "nome", "tipo"])
        expect(Object.keys(fora.disco).sort()).toEqual(["limpeza", "livre", "usado"])
        expect(Object.keys(fora.disco.limpeza).sort()).toEqual(["adiada", "arquivos", "bytes", "em"])
        expect(Object.keys(fora.falhas[0]).sort()).toEqual(["detalhe", "id", "nome"])
        expect(Object.keys(fora.lote).sort()).toEqual(["feitos", "total"])
    })
})

describe("fila de relatos de status", () => {
    it("recusa de UM id (55000, P0002, 22023) pula e a fila segue; problema geral para", () => {
        expect(decidirRelato({ ok: true })).toBe("feito")
        expect(decidirRelato({ ok: false, codigo: "erro", pg: "55000" })).toBe("pular")
        expect(decidirRelato({ ok: false, codigo: "culto_inexistente", pg: "P0002" })).toBe("pular")
        expect(decidirRelato({ ok: false, codigo: "erro", pg: "22023" })).toBe("pular")
        expect(decidirRelato({ ok: false, codigo: "erro", pg: "54000" })).toBe("parar")
        for (const codigo of ["rede", "nao_baixa", "chave_invalida", "sem_chave", "ocupado"]) expect(decidirRelato({ ok: false, codigo })).toBe("parar")
    })
})

describe("tentativas do download", () => {
    const base = { esperas: [1, 1], dormir: async () => {}, vivo: () => true, codigoDe: (e: unknown) => String(e), fatal: (c: string) => c === "fatal" }
    it("cada tentativa nasce com um AbortController NOVO (o que estourou o tempo não envenena a seguinte)", async () => {
        const vistos: AbortController[] = []
        const r = await comTentativas(
            async (ctl) => {
                vistos.push(ctl)
                if (vistos.length < 3) {
                    ctl.abort()
                    throw "tempo"
                }
                expect(ctl.signal.aborted).toBe(false)
                return "ok"
            },
            { ...base, aoNovoControle: () => {} }
        )
        expect(r).toEqual({ ok: true, valor: "ok" })
        expect(new Set(vistos).size).toBe(3)
    })
    it("avisa quem guarda o controle a cada tentativa", async () => {
        const guardados: AbortController[] = []
        await comTentativas(async () => Promise.reject("x"), { ...base, aoNovoControle: (c) => guardados.push(c) })
        expect(guardados).toHaveLength(3)
    })
    it("falha fatal não insiste; esgotadas as tentativas devolve o código; geração velha abandona", async () => {
        let n = 0
        expect(await comTentativas(async () => (n++, Promise.reject("fatal")), { ...base, aoNovoControle: () => {} })).toEqual({ ok: false, falha: "fatal" })
        expect(n).toBe(1)
        expect(await comTentativas(async () => Promise.reject("rede"), { ...base, aoNovoControle: () => {} })).toEqual({ ok: false, falha: "rede" })
        expect(await comTentativas(async () => "x", { ...base, vivo: () => false, aoNovoControle: () => {} })).toEqual({ abandonado: true })
    })
})

// ---------------------------------------------------------------- v5: mapa, pendente e limpeza

const DIA = 86_400_000
const AGORA = Date.UTC(2026, 10, 11)

describe("o mapa de registros não é mais podado por idade", () => {
    it("registro de 200 dias com o arquivo no disco SOBREVIVE; sem o arquivo, sai", () => {
        const velho = AGORA - 200 * DIA
        const salvo = { a: { caminho: "C:/a.mp4", etag: "x", tamanho: 10, em: velho }, b: { caminho: "C:/sumiu.mp4", etag: "x", tamanho: 10, em: velho }, c: { lixo: true } }
        const { mantidos, podou } = filtrarRegistros(salvo, (c) => (c.endsWith("sumiu.mp4") ? -1 : 10))
        expect([...mantidos.keys()]).toEqual(["a"])
        expect(podou).toBe(true)
        expect(filtrarRegistros(undefined, () => 1).mantidos.size).toBe(0)
    })
})

describe("a pendente traz tudo: o que fazer com cada linha", () => {
    const linha = { etag: "d41d8cd98f00b204e9800998ecf8427e", tamanho: 10 }
    const feito = { etag: '"D41D8CD98F00B204E9800998ECF8427E"', caminho: "C:/a.mp4" }
    it("no disco e o Sirvo já sabe (baixado): nenhum relato; no disco e não sabe: relata; fora do disco: baixa", () => {
        expect(decidirLinha({ ...linha, baixa_status: "baixado" }, feito, () => 10)).toBe("nada")
        expect(decidirLinha({ ...linha, baixa_status: null }, feito, () => 10)).toBe("relatar_baixado")
        expect(decidirLinha({ ...linha, baixa_status: "falhou" }, feito, () => 10)).toBe("relatar_baixado")
        expect(decidirLinha({ ...linha, baixa_status: "baixado" }, feito, () => -1)).toBe("baixar")
        expect(decidirLinha({ ...linha, baixa_status: null }, undefined, () => 10)).toBe("baixar")
        expect(decidirLinha({ ...linha, etag: "ffffffffffffffffffffffffffffffff", baixa_status: "baixado" }, feito, () => 10)).toBe("baixar")
    })
})

describe("limpeza: o que vai para a Lixeira (morto_em + 30 d)", () => {
    const AM = "aaaaaaaa-0000-4000-8000-000000000001" // arquivo morto
    const VM = "bbbbbbbb-0000-4000-8000-000000000002" // versão morta (arquivo vivo)
    const arq = (pasta: string, nome: string, extra: object = {}) => ({ pasta, arquivos: [{ nome, caminho: `C:/Online/Sirvo/${pasta}/${nome}`, mtimeMs: AGORA - 50 * DIA, ...extra }] })
    const morto = (dias: number) => new Date(AGORA - dias * DIA).toISOString()
    const mortos = { arquivos: [{ id: AM, morto_em: morto(40) }], versoes: [{ id: VM, morto_em: morto(40) }] }

    it("o prazo é 30 dias", () => {
        expect(PRAZO_LIXEIRA_MS).toBe(30 * DIA)
    })
    it("arquivo morto há 40 d e versão morta há 40 d vão; morto há 10 d, vivo e id desconhecido ficam", () => {
        const arvore = [
            arq("Vinheta__aaaaaaaa", "Vinheta__cccccccc.mp4"), // arquivo morto
            arq("Outro__dddddddd", "Outro__bbbbbbbb.mp4"), // versão morta em arquivo vivo
            arq("Novo__eeeeeeee", "Novo__ffffffff.mp4"), // desconhecido
            arq("Semsufixo", "Semsufixo.mp4")
        ]
        expect(candidatosALimpar(arvore, mortos, new Set(), AGORA)).toEqual(["C:/Online/Sirvo/Vinheta__aaaaaaaa/Vinheta__cccccccc.mp4", "C:/Online/Sirvo/Outro__dddddddd/Outro__bbbbbbbb.mp4"])
        // exatamente 30 d ainda não (morto_em + 30 d < agora)
        const limite = { arquivos: [{ id: AM, morto_em: morto(30) }], versoes: [] }
        expect(candidatosALimpar([arvore[0]], limite, new Set(), AGORA)).toEqual([])
        expect(candidatosALimpar([arvore[0]], { arquivos: [{ id: AM, morto_em: morto(31) }], versoes: [] }, new Set(), AGORA)).toHaveLength(1)
        // morto há 10 d: fica
        expect(candidatosALimpar([arvore[0]], { arquivos: [{ id: AM, morto_em: morto(10) }], versoes: [] }, new Set(), AGORA)).toEqual([])
    })
    it("referenciado fica; .part novo fica e .part velho vai; prefixo ambíguo fica", () => {
        const f = arq("Vinheta__aaaaaaaa", "Vinheta__cccccccc.mp4")
        expect(candidatosALimpar([f], mortos, new Set(["c:/online/sirvo/vinheta__aaaaaaaa/vinheta__cccccccc.mp4"]), AGORA)).toEqual([])
        const parte = arq("Vinheta__aaaaaaaa", "Vinheta__cccccccc.mp4.part", { mtimeMs: AGORA - 3_600_000 })
        expect(candidatosALimpar([parte], mortos, new Set(), AGORA)).toEqual([])
        expect(candidatosALimpar([arq("Vinheta__aaaaaaaa", "Vinheta__cccccccc.mp4.part")], mortos, new Set(), AGORA)).toHaveLength(1)
        const ambiguo = { arquivos: [...mortos.arquivos, { id: "aaaaaaaa-1111-4000-8000-000000000009", morto_em: morto(60) }], versoes: [] }
        expect(candidatosALimpar([f], ambiguo, new Set(), AGORA)).toEqual([])
    })
})

describe("limpeza: o que referencia um arquivo", () => {
    const c1 = "C:\\Online\\Sirvo\\A__aaaaaaaa\\A__11111111.mp4"
    const c2 = "C:\\Online\\Sirvo\\B__bbbbbbbb\\B__22222222.mp4"
    const c3 = "C:\\Online\\Sirvo\\C__cccccccc\\C__33333333.mp4"
    const c4 = "C:\\Online\\Sirvo\\D__dddddddd\\D__44444444.mp4"
    it("texto de STAGE/tema/.show (JSON com \\\\) e item do operador protegem; item MARCADO do projeto não", () => {
        const textos = [JSON.stringify({ tema: { fundo: c1 } }), `<show> ${c2.replace(/\\/g, "/").toUpperCase()} </show>`]
        const projetos = { p: { shows: [{ id: c3 }, { id: c4, data: { sirvoMaterial: "arq" } }] } }
        const r = caminhosReferenciados(textos, projetos, [c1, c2, c3, c4])
        expect([...r].sort()).toEqual([c1, c2, c3].sort())
    })
})
