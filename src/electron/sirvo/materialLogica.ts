// ----- AliançaShow · material da semana pelo Sirvo (F5, S3): as contas puras -----
//
// Sem electron, sem disco, sem rede: só as regras que decidem o que pode ser
// baixado e onde cai. Quem usa é material.ts (a fila, no processo principal).
// Desenho: docs/INTEGRACAO-SIRVO-MATERIAL.md.
//
// O que o Sirvo manda é TEXTO HOSTIL: o nome é de quem enviou, a URL vem de
// uma tabela. Nada daqui vira caminho ou pedido sem passar por estas funções.

import path from "path"

export type TipoDeMaterial = "video" | "imagem" | "audio"

/** a lista FECHADA de extensões, por tipo (a mesma do servidor: migration 0090 do Sirvo) */
export const EXTENSOES: { [tipo in TipoDeMaterial]: string[] } = {
    video: ["mp4", "mov", "m4v", "webm"],
    imagem: ["jpg", "jpeg", "png", "webp", "gif"],
    audio: ["mp3", "m4a", "wav"]
}

/** os dois baldes privados do R2 (produção e staging) */
export const BALDES = ["sirvo-material", "sirvo-material-staging"]

export const TAMANHO_MAX = 1_073_741_824 // 1 GB, o teto do servidor
export const FOLGA_DE_DISCO = 500 * 1024 * 1024 // livre = tamanho + 500 MB
/** pasta dentro de Online/ onde cai o material do Sirvo */
export const PASTA_DO_SIRVO = "Sirvo"

/** o que o Sirvo devolve em show_material_pendente (os campos que importam) */
export type MaterialPendente = {
    id: string
    nome: string
    ext: string
    tipo: TipoDeMaterial
    tamanho: number
    etag: string
    codec: string | null
    event_id: string
    bloco_id: string | null
    /** "AAAA-MM-DD" do culto, se o Sirvo mandar; senão a pasta usa o event_id */
    dia: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const ehUuid = (x: unknown): x is string => typeof x === "string" && UUID.test(x)

/** o tipo que a extensão diz, ou null se a extensão não está na lista fechada */
export function tipoDaExtensao(ext: string): TipoDeMaterial | null {
    const e = String(ext || "").toLowerCase()
    for (const tipo of Object.keys(EXTENSOES) as TipoDeMaterial[]) if (EXTENSOES[tipo].includes(e)) return tipo
    return null
}

/** texto externo → texto seguro para mostrar (sem controle, sem HTML, com teto) */
export function textoSeguro(t: unknown, max = 120): string {
    return String(t ?? "")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/</g, "‹")
        .replace(/>/g, "›")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
}

/**
 * Valida uma linha de show_material_pendente. null = a linha é lixo e é
 * ignorada (nunca baixada): id e evento são UUID, a extensão está na lista
 * fechada e combina com o tipo, o tamanho é inteiro dentro do teto.
 */
export function validarPendente(x: any): MaterialPendente | null {
    if (!x || typeof x !== "object") return null
    const ext = String(x.ext || "").toLowerCase()
    const tipo = tipoDaExtensao(ext)
    const tamanho = Number(x.tamanho)
    if (!ehUuid(x.id) || !ehUuid(x.event_id) || !tipo) return null
    if (x.tipo !== undefined && x.tipo !== null && x.tipo !== tipo) return null
    if (!Number.isInteger(tamanho) || tamanho < 1 || tamanho > TAMANHO_MAX) return null
    const etag = limparEtag(x.etag)
    if (!etag) return null
    return {
        id: x.id.toLowerCase(),
        nome: textoSeguro(x.nome) || "arquivo",
        ext,
        tipo,
        tamanho,
        etag,
        codec: typeof x.codec === "string" && x.codec ? textoSeguro(x.codec, 40) : null,
        event_id: x.event_id.toLowerCase(),
        bloco_id: ehUuid(x.bloco_id) ? x.bloco_id : null,
        dia: typeof x.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x.dia) ? x.dia : null
    }
}

// ---------------------------------------------------------------- nome no disco

/** CON, NUL, COM1… o Windows não cria arquivo com esses nomes */
const RESERVADO = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i

/** só letras, números, espaço, ponto, hífen e sublinhado; sem ponto no começo; no máximo 40 */
export function limparNome(nome: unknown): string {
    let base = String(nome ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        // a extensão que veio no nome não conta: a do servidor é que vale
        .replace(/\.[A-Za-z0-9]{1,5}$/, "")
        .replace(/[^A-Za-z0-9 ._-]/g, "")
        .replace(/\.{2,}/g, ".")
        .replace(/^[.\s_-]+/, "")
        .replace(/[.\s]+$/, "")
        .trim()
        .slice(0, 40)
        .replace(/[.\s]+$/, "")
    if (!base) base = "arquivo"
    if (RESERVADO.test(base)) base = "_" + base
    return base
}

/** `<nome-limpo>__<id8>.<ext>`: o id8 dá unicidade e a extensão vem da lista fechada */
export function nomeDoArquivo(nome: unknown, id: string, ext: string): string | null {
    const e = String(ext || "").toLowerCase()
    if (!tipoDaExtensao(e) || !ehUuid(id)) return null
    return `${limparNome(nome)}__${id.slice(0, 8).toLowerCase()}.${e}`
}

/** a pasta dentro de Online/: Sirvo/<dia> (ou Sirvo/<event_id>) */
export function pastaDoMaterial(m: Pick<MaterialPendente, "event_id" | "dia">): string[] {
    return [PASTA_DO_SIRVO, m.dia || m.event_id]
}

/**
 * O destino, ou null: o arquivo tem que cair DIRETO na pasta do culto, e a
 * pasta tem que estar dentro de `raiz` (a pasta Online). Mesma trava do Remote
 * (downloadMedia.ts), sem depender do electron para poder ser testada.
 */
export function resolverDestino(raiz: string, pasta: string[], arquivo: string): { pasta: string; destino: string } | null {
    const r = path.resolve(raiz)
    const destinoPasta = path.resolve(r, ...pasta)
    const destino = path.resolve(destinoPasta, String(arquivo || ""))
    const dentro = destinoPasta.startsWith(r + path.sep)
    if (!dentro || path.dirname(destino) !== destinoPasta || !path.basename(destino)) return null
    if (RESERVADO.test(path.parse(destino).name.trim())) return null
    return { pasta: destinoPasta, destino }
}

// ---------------------------------------------------------------- a URL do R2

const HOST_R2 = /^[0-9a-f]{32}\.r2\.cloudflarestorage\.com$/

/**
 * A URL que o Sirvo devolveu serve para ESTE arquivo? Host exato do R2 (o da
 * conta: `hostExato`, quando conhecido; senão 32 hex + o domínio), https sem
 * login nem porta, sem query além da assinatura, e o caminho
 * `/<balde>/igrejas/<uuid>/eventos/<event_id>/<id>.<ext>` com `event_id`, `id` e
 * `ext` IGUAIS aos que o Show pediu: uma URL boa de outro arquivo não passa.
 */
export function urlDoMaterialValida(url: unknown, m: Pick<MaterialPendente, "id" | "ext" | "event_id">, opcoes: { hostExato?: string; baldes?: string[] } = {}): boolean {
    if (typeof url !== "string" || url.length > 4000) return false
    let u: URL
    try {
        u = new URL(url)
    } catch {
        return false
    }
    if (u.protocol !== "https:" || u.username || u.password || u.port || u.hash) return false
    const host = u.hostname.toLowerCase()
    if (opcoes.hostExato ? host !== opcoes.hostExato.toLowerCase() : !HOST_R2.test(host)) return false
    // sem codificação no caminho: "%2e%2e" ou "%2f" não entram
    if (/%/.test(u.pathname)) return false
    const partes = u.pathname.split("/")
    // ["", balde, "igrejas", igreja, "eventos", evento, "<id>.<ext>"]
    if (partes.length !== 7 || partes[0] !== "") return false
    const [, balde, igrejas, igreja, eventos, evento, arquivo] = partes
    if (!(opcoes.baldes || BALDES).includes(balde)) return false
    if (igrejas !== "igrejas" || eventos !== "eventos") return false
    if (!ehUuid(igreja) || !ehUuid(evento) || evento.toLowerCase() !== m.event_id.toLowerCase()) return false
    return arquivo === `${m.id}.${m.ext}`
}

// ---------------------------------------------------------------- conferências do arquivo

/** o ETag sem aspas nem o prefixo W/ ("\"abc\"" → "abc"); "" se não for um texto razoável */
export function limparEtag(e: unknown): string {
    const t = String(e ?? "")
        .trim()
        .replace(/^W\//, "")
        .replace(/^"+|"+$/g, "")
        .toLowerCase()
    return /^[0-9a-z-]{8,100}$/.test(t) ? t : ""
}

export const etagsIguais = (a: unknown, b: unknown) => !!limparEtag(a) && limparEtag(a) === limparEtag(b)

/** o ETag de um PUT simples é o MD5 em hex: dá para conferir o conteúdo, não só o tamanho */
export const etagEhMd5 = (e: unknown) => /^[0-9a-f]{32}$/.test(limparEtag(e))

/** cabe no disco? livre ≥ tamanho + 500 MB */
export const cabeNoDisco = (livre: number, tamanho: number) => Number.isFinite(livre) && livre >= tamanho + FOLGA_DE_DISCO

/** HEVC (H.265) pode não tocar em todo PC: "hvc1", "hev1", "hevc", "h265" */
export const ehHevc = (codec: unknown) => /hvc1|hev1|hevc|h\.?265/i.test(String(codec ?? ""))

/** o rótulo do item no projeto (sem URL, sem caminho): nome + aviso de HEVC */
export function rotuloDoMaterial(nome: unknown, codec?: unknown): string {
    return textoSeguro(nome, 100) + (ehHevc(codec) ? " (HEVC — pode não tocar)" : "")
}

// ---------------------------------------------------------------- o que o renderer enxerga

/** um arquivo que já está no disco (o caminho local é do PC, não é segredo) */
export type MaterialNoDisco = { id: string; caminho: string; nome: string; tipo: TipoDeMaterial; codec: string | null; event_id: string }

/**
 * O estado da fila que atravessa para o renderer. NUNCA tem URL (nem a assinada,
 * nem pedaço dela): o main pede, baixa e esquece. `falhas.detalhe` é um código
 * curto ("tamanho", "disco_cheio"…), nunca texto de erro vindo da rede.
 */
export type EstadoMaterial = {
    /** null = ainda não perguntou; false = a chave não baixa material (42501) */
    habilitado: boolean | null
    baixando: number
    naFila: number
    /** o lote em andamento: quantos arquivos, quantos já começaram ou terminaram */
    lote: { total: number; feitos: number }
    falhas: { id: string; nome: string; detalhe: string }[]
    baixados: MaterialNoDisco[]
}

export const ESTADO_VAZIO: EstadoMaterial = { habilitado: null, baixando: 0, naFila: 0, lote: { total: 0, feitos: 0 }, falhas: [], baixados: [] }

/** só chaves conhecidas, só texto curto: o que sai para o renderer passa por aqui */
export function estadoParaRenderer(e: EstadoMaterial): EstadoMaterial {
    return {
        habilitado: e.habilitado,
        baixando: e.baixando,
        naFila: e.naFila,
        lote: { total: e.lote.total, feitos: e.lote.feitos },
        falhas: e.falhas.map((f) => ({ id: f.id, nome: textoSeguro(f.nome), detalhe: textoSeguro(f.detalhe, 40) })),
        baixados: e.baixados.map((b) => ({ id: b.id, caminho: b.caminho, nome: textoSeguro(b.nome), tipo: b.tipo, codec: b.codec, event_id: b.event_id }))
    }
}

// ---------------------------------------------------------------- a fila (sem rede, para poder ser testada)

/**
 * O que fazer com a resposta do Sirvo a um relato de status:
 *   - "feito": entregue, sai da fila;
 *   - "pular": o Sirvo recusou ESTE id (55000 não está pronto, P0002 não existe, 22023 inválido…):
 *     sai da fila e o relato SEGUE com o próximo id (não pode travar a fila inteira);
 *   - "parar": problema geral (chave, rede, interruptor desligado, 54000 mais de 60/min): para e tenta no próximo ciclo.
 */
export function decidirRelato(r: { ok: boolean; codigo?: string; pg?: string }): "feito" | "pular" | "parar" {
    if (r.ok) return "feito"
    if (r.codigo === "chave_invalida" || r.codigo === "sem_chave" || r.codigo === "nao_baixa" || r.codigo === "rede" || r.codigo === "ocupado" || r.pg === "54000") return "parar"
    return "pular"
}

export type OpcoesTentativas = {
    /** esperas entre as tentativas (n esperas = n + 1 tentativas) */
    esperas: number[]
    dormir: (ms: number) => Promise<void>
    /** a fila ainda é desta geração? (materialParar muda) */
    vivo: () => boolean
    /** cada tentativa nasce com o PRÓPRIO AbortController: o abortado por tempo não envenena a seguinte */
    aoNovoControle: (ctl: AbortController) => void
    /** o código curto da falha */
    codigoDe: (erro: unknown, ctl: AbortController) => string
    /** esses códigos não melhoram em segundos: não insiste */
    fatal: (codigo: string) => boolean
}

export type ResultadoTentativas<T> = { ok: true; valor: T } | { ok: false; falha: string } | { abandonado: true }

export async function comTentativas<T>(fazer: (ctl: AbortController) => Promise<T>, o: OpcoesTentativas): Promise<ResultadoTentativas<T>> {
    let falha = ""
    for (let tentativa = 0; tentativa <= o.esperas.length; tentativa++) {
        const ctl = new AbortController()
        o.aoNovoControle(ctl)
        try {
            const valor = await fazer(ctl)
            return o.vivo() ? { ok: true, valor } : { abandonado: true }
        } catch (erro) {
            if (!o.vivo()) return { abandonado: true }
            falha = o.codigoDe(erro, ctl)
            if (o.fatal(falha)) break
            if (tentativa < o.esperas.length) {
                await o.dormir(o.esperas[tentativa])
                if (!o.vivo()) return { abandonado: true }
            }
        }
    }
    return { ok: false, falha }
}
