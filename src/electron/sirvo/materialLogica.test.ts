import path from "path"
import { describe, expect, it } from "vitest"
import { cabeNoDisco, comTentativas, decidirRelato, ehHevc, estadoParaRenderer, etagEhMd5, etagsIguais, limparEtag, limparNome, nomeDoArquivo, pastaDoMaterial, resolverDestino, rotuloDoMaterial, tipoDaExtensao, urlDoMaterialValida, validarPendente, type EstadoMaterial } from "./materialLogica"

const ID = "0f8a1c2e-1111-4222-8333-444455556666"
const EV = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const IGREJA = "11111111-2222-4333-8444-555555555555"
const CONTA = "0123456789abcdef0123456789abcdef"
const url = (caminho: string, host = `${CONTA}.r2.cloudflarestorage.com`) => `https://${host}${caminho}?X-Amz-Signature=abc&X-Amz-Expires=604800`
const m = { id: ID, ext: "mp4", event_id: EV }
const boa = `/sirvo-material/igrejas/${IGREJA}/eventos/${EV}/${ID}.mp4`

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
        const ok = { id: ID, nome: "A<b>", ext: "mp4", tipo: "video", tamanho: 1000, etag: '"d41d8cd98f00b204e9800998ecf8427e"', codec: "hvc1", event_id: EV, bloco_id: null }
        expect(validarPendente(ok)).toMatchObject({ id: ID, nome: "A‹b›", tipo: "video", etag: "d41d8cd98f00b204e9800998ecf8427e", codec: "hvc1" })
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
    it("direto na pasta do culto, dentro da pasta Online", () => {
        const r = resolverDestino(raiz, pastaDoMaterial({ event_id: EV, dia: "2026-11-15" }), "Abertura__0f8a1c2e.mp4")!
        expect(r.pasta).toBe(path.join(raiz, "Sirvo", "2026-11-15"))
        expect(r.destino).toBe(path.join(raiz, "Sirvo", "2026-11-15", "Abertura__0f8a1c2e.mp4"))
        expect(pastaDoMaterial({ event_id: EV, dia: null })).toEqual(["Sirvo", EV])
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
        expect(urlDoMaterialValida(url(boa.replace(EV, "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee")), m)).toBe(false)
        expect(urlDoMaterialValida(url(boa.replace(".mp4", ".mov")), m)).toBe(false)
        expect(urlDoMaterialValida(url(boa.replace("igrejas/", "igrejas/../")), m)).toBe(false)
        expect(urlDoMaterialValida(url(boa.replace(`${EV}/`, `${EV}/upload/`)), m)).toBe(false)
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
        baixados: [{ id: ID, caminho: "C:\\Online\\Sirvo\\a__0f8a1c2e.mp4", nome: "A", tipo: "video", codec: null, event_id: EV, url: "https://x.r2.cloudflarestorage.com/a?X-Amz-Signature=s", urlAssinada: "X-Amz-Signature=s" }]
    } as unknown as EstadoMaterial
    it("o estado que atravessa só tem as chaves conhecidas", () => {
        const fora = estadoParaRenderer(sujo)
        expect(JSON.stringify(fora)).not.toMatch(/X-Amz|r2\.cloudflarestorage/i)
        expect(Object.keys(fora.baixados[0]).sort()).toEqual(["caminho", "codec", "event_id", "id", "nome", "tipo"])
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
