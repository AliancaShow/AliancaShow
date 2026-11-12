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

/**
 * O que o Sirvo devolve em show_material_pendente (v5, migration 0092): UMA linha por VERSÃO atual
 * de arquivo da igreja com uso na janela. `id` é o id da VERSÃO (um objeto no R2); `arquivo_id` é o
 * arquivo da biblioteca. Sem culto nem bloco: quem diz isso é show_roteiro.material[].
 */
export type MaterialPendente = {
    id: string
    arquivo_id: string
    nome: string
    ext: string
    tipo: TipoDeMaterial
    tamanho: number
    etag: string
    codec: string | null
    /** o que o Sirvo já sabe desta versão: "baixado" não precisa ser relatado de novo */
    baixa_status: "baixado" | "falhou" | null
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
 * ignorada (nunca baixada): id (da versão) e arquivo_id são UUID, a extensão está na lista
 * fechada e combina com o tipo, o tamanho é inteiro dentro do teto.
 */
export function validarPendente(x: any): MaterialPendente | null {
    if (!x || typeof x !== "object") return null
    const ext = String(x.ext || "").toLowerCase()
    const tipo = tipoDaExtensao(ext)
    const tamanho = Number(x.tamanho)
    if (!ehUuid(x.id) || !ehUuid(x.arquivo_id) || !tipo) return null
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
        arquivo_id: x.arquivo_id.toLowerCase(),
        baixa_status: x.baixa_status === "baixado" || x.baixa_status === "falhou" ? x.baixa_status : null
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

/** `<nome-limpo>__<versao8>.<ext>`: o id8 da VERSÃO dá unicidade e a extensão vem da lista fechada */
export function nomeDoArquivo(nome: unknown, versaoId: string, ext: string): string | null {
    const e = String(ext || "").toLowerCase()
    if (!tipoDaExtensao(e) || !ehUuid(versaoId)) return null
    return `${limparNome(nome)}__${versaoId.slice(0, 8).toLowerCase()}.${e}`
}

/** `<nome-limpo>__<arquivo8>`: a pasta de UM arquivo da biblioteca (todas as versões dele ficam aqui) */
export function nomeDaPasta(nome: unknown, arquivoId: string): string | null {
    if (!ehUuid(arquivoId)) return null
    return `${limparNome(nome)}__${arquivoId.slice(0, 8).toLowerCase()}`
}

/**
 * A pasta de um arquivo é A QUE EXISTE NO DISCO com o sufixo `__<arquivo8>` (sobrevive a reinstalar, e
 * uma v2 com outro nome não abre pasta nova). Só sem nenhuma, cria com o nome da pendente. Com mais de
 * uma, a primeira em ordem alfabética (determinístico).
 */
export function pastaDoMaterial(m: Pick<MaterialPendente, "arquivo_id" | "nome">, existentes: string[] = []): string[] {
    const sufixo = `__${String(m.arquivo_id).slice(0, 8).toLowerCase()}`
    const achada = [...existentes].filter((n) => n.toLowerCase().endsWith(sufixo)).sort()[0]
    return [PASTA_DO_SIRVO, achada || nomeDaPasta(m.nome, m.arquivo_id) || String(m.arquivo_id)]
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
 * `/<balde>/igrejas/<uuid>/arquivos/<arquivo_id>/<versao>.<ext>` com `arquivo_id`, versão e
 * `ext` IGUAIS aos que o Show pediu: uma URL boa de outro arquivo não passa.
 */
export function urlDoMaterialValida(url: unknown, m: Pick<MaterialPendente, "id" | "ext" | "arquivo_id">, opcoes: { hostExato?: string; baldes?: string[] } = {}): boolean {
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
    // ["", balde, "igrejas", igreja, "arquivos", arquivo_id, "<versao>.<ext>"]
    if (partes.length !== 7 || partes[0] !== "") return false
    const [, balde, igrejas, igreja, arquivos, arquivoId, objeto] = partes
    if (!(opcoes.baldes || BALDES).includes(balde)) return false
    if (igrejas !== "igrejas" || arquivos !== "arquivos") return false
    if (!ehUuid(igreja) || !ehUuid(arquivoId) || arquivoId.toLowerCase() !== m.arquivo_id.toLowerCase()) return false
    return objeto === `${m.id}.${m.ext}`
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
export type MaterialNoDisco = { id: string; arquivo_id: string; caminho: string; nome: string; tipo: TipoDeMaterial; codec: string | null }

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
    /** o disco do material do Sirvo e a limpeza (F5 do Show) */
    disco: EstadoDisco
}

export type EstadoDisco = {
    /** bytes em Online/Sirvo; -1 = ainda não medido */
    usado: number
    /** bytes livres no volume; -1 = não sei */
    livre: number
    limpeza: { em: number; arquivos: number; bytes: number; /** por que a última limpeza não rodou (texto curto), ou null */ adiada: string | null }
}

export const DISCO_VAZIO: EstadoDisco = { usado: -1, livre: -1, limpeza: { em: 0, arquivos: 0, bytes: 0, adiada: null } }

export const ESTADO_VAZIO: EstadoMaterial = { habilitado: null, baixando: 0, naFila: 0, lote: { total: 0, feitos: 0 }, falhas: [], baixados: [], disco: DISCO_VAZIO }

/** só chaves conhecidas, só texto curto: o que sai para o renderer passa por aqui */
export function estadoParaRenderer(e: EstadoMaterial): EstadoMaterial {
    return {
        habilitado: e.habilitado,
        baixando: e.baixando,
        naFila: e.naFila,
        lote: { total: e.lote.total, feitos: e.lote.feitos },
        falhas: e.falhas.map((f) => ({ id: f.id, nome: textoSeguro(f.nome), detalhe: textoSeguro(f.detalhe, 40) })),
        baixados: e.baixados.map((b) => ({ id: b.id, arquivo_id: b.arquivo_id, caminho: b.caminho, nome: textoSeguro(b.nome), tipo: b.tipo, codec: b.codec })),
        disco: {
            usado: Number.isFinite(e.disco?.usado) ? e.disco.usado : -1,
            livre: Number.isFinite(e.disco?.livre) ? e.disco.livre : -1,
            limpeza: { em: Number(e.disco?.limpeza?.em) || 0, arquivos: Number(e.disco?.limpeza?.arquivos) || 0, bytes: Number(e.disco?.limpeza?.bytes) || 0, adiada: e.disco?.limpeza?.adiada ? textoSeguro(e.disco.limpeza.adiada, 80) : null }
        }
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

// ---------------------------------------------------------------- o mapa de registros e a pendente (v5)

/**
 * O mapa guardado no store: SEM poda por idade (v5: o guardado que volta a ser usado depois de meses
 * não pode sumir do mapa). Só sai o que não está mais no disco com o tamanho certo.
 * `tamanhoNoDisco` devolve -1 quando o arquivo não existe.
 */
export function filtrarRegistros<R extends { caminho: string; etag: string; tamanho?: number }>(salvo: unknown, tamanhoNoDisco: (caminho: string) => number): { mantidos: Map<string, R>; podou: boolean } {
    const mantidos = new Map<string, R>()
    let podou = false
    for (const [id, r] of Object.entries((salvo && typeof salvo === "object" ? salvo : {}) as { [id: string]: R })) {
        if (!r || typeof r.caminho !== "string" || typeof r.etag !== "string") continue
        if (tamanhoNoDisco(r.caminho) < 0) {
            podou = true
            continue
        }
        mantidos.set(id, r)
    }
    return { mantidos, podou }
}

/**
 * O que fazer com UMA linha de show_material_pendente (já validada). A pendente traz tudo (toda
 * versão atual com uso na janela), então:
 *   - no disco, certa: relata `baixado` SÓ se o Sirvo ainda não sabe (`baixa_status !== "baixado"`); senão nada;
 *   - fora do disco: fila (baixar() reaproveita um arquivo já no destino, depois de conferir).
 */
export function decidirLinha(m: Pick<MaterialPendente, "etag" | "tamanho" | "baixa_status">, feito: { etag: string; caminho: string } | undefined, tamanhoNoDisco: (caminho: string) => number): "nada" | "relatar_baixado" | "baixar" {
    if (feito && etagsIguais(feito.etag, m.etag) && tamanhoNoDisco(feito.caminho) === m.tamanho) return m.baixa_status === "baixado" ? "nada" : "relatar_baixado"
    return "baixar"
}

// ---------------------------------------------------------------- limpeza do disco (F5 do Show)

/** o prazo no PC: o servidor declara o arquivo/versão morto; o Show só manda para a Lixeira depois de 30 dias (decisão do André, 11/nov; o desenho dizia 90) */
export const PRAZO_LIXEIRA_MS = 30 * 86_400_000
export const PARCIAL_VELHO_MS = 86_400_000

/** uma subpasta de Online/Sirvo e os arquivos DIRETOS nela (a árvore que o main lê do disco) */
export type PastaDoSirvo = { pasta: string; arquivos: { nome: string; caminho: string; mtimeMs: number }[] }[]
export type Mortos = { arquivos: { id: string; morto_em: string }[]; versoes: { id: string; morto_em: string }[] }

/** caminho normalizado para comparar: barras para frente, minúsculas */
export const normCaminho = (p: string) =>
    String(p || "")
        .replace(/\\/g, "/")
        .toLowerCase()

/** `<x>__<arquivo8>` → arquivo8 (8 hex), ou null */
const sufixoDaPasta = (n: string) => /__([0-9a-f]{8})$/i.exec(n)?.[1].toLowerCase() || null
/** `<y>__<versao8>.<ext>[.part]` → versao8, ou null */
const sufixoDoArquivo = (n: string) => /__([0-9a-f]{8})\.[a-z0-9]{2,5}(?:\.part)?$/i.exec(n)?.[1].toLowerCase() || null

/**
 * O que pode ir para a Lixeira. Candidato = arquivo em `<x>__<arquivo8>/<y>__<versao8>.<ext>` em que
 * o `arquivo8` casa com EXATAMENTE um arquivo morto, ou o `versao8` com EXATAMENTE uma versão morta,
 * com `morto_em + 30 d < agora`, que não é `.part` de menos de 1 dia e não está referenciado.
 * Prefixo ambíguo (casa com 2+ mortos), pasta sem sufixo, id desconhecido: DEIXA.
 * `referenciados` já vem normalizado (normCaminho). Pura: sem disco.
 */
export function candidatosALimpar(arvore: PastaDoSirvo, mortos: Mortos, referenciados: Set<string>, agora: number): string[] {
    const porPrefixo = (lista: { id: string; morto_em: string }[]) => {
        const m = new Map<string, number[]>()
        for (const x of lista) {
            if (!ehUuid(x?.id)) continue
            const t = Date.parse(x.morto_em)
            if (!Number.isFinite(t)) continue
            const k = x.id.slice(0, 8).toLowerCase()
            m.set(k, [...(m.get(k) || []), t])
        }
        return m
    }
    const arquivosMortos = porPrefixo(mortos?.arquivos || [])
    const versoesMortas = porPrefixo(mortos?.versoes || [])
    const velho = (t: number) => t + PRAZO_LIXEIRA_MS < agora
    const saida: string[] = []
    for (const p of arvore) {
        const a8 = sufixoDaPasta(p.pasta)
        for (const f of p.arquivos) {
            if (f.nome.endsWith(".part") && agora - f.mtimeMs < PARCIAL_VELHO_MS) continue
            if (referenciados.has(normCaminho(f.caminho))) continue
            const v8 = sufixoDoArquivo(f.nome)
            const doArquivo = a8 ? arquivosMortos.get(a8) : undefined
            const daVersao = v8 ? versoesMortas.get(v8) : undefined
            // ambíguo em qualquer das duas pontas: deixa
            if ((doArquivo && doArquivo.length > 1) || (daVersao && daVersao.length > 1)) continue
            const vale = (doArquivo?.length === 1 && velho(doArquivo[0])) || (daVersao?.length === 1 && velho(daVersao[0]))
            if (vale) saida.push(f.caminho)
        }
    }
    return saida
}

/**
 * Quais dos `candidatos` aparecem nos textos dos stores salvos (SYNCED_SETTINGS, THEMES, STAGE,
 * OVERLAYS, TEMPLATES e cada `.show`), em JSON ou texto cru (barras e caixa normalizadas; `\` do
 * JSON vira `/`), e nos itens de PROJETO. No projeto o item MARCADO (`data.sirvoMaterial`) NÃO protege:
 * foi o Sirvo que o pôs e o Sirvo já desistiu dele há 30 dias. O item do operador (sem marca) protege.
 */
export function caminhosReferenciados(textos: string[], projetos: { [id: string]: { shows?: { id?: string; data?: any }[] } } | undefined, candidatos: string[]): Set<string> {
    const achados = new Set<string>()
    const pendentes = candidatos.map((c) => ({ c, n: normCaminho(c) }))
    const normTexto = (t: string) => t.replace(/\\\\/g, "/").replace(/\\/g, "/").toLowerCase()
    for (const bruto of textos) {
        if (typeof bruto !== "string" || !bruto) continue
        const t = normTexto(bruto)
        for (const { c, n } of pendentes) if (!achados.has(c) && t.includes(n)) achados.add(c)
    }
    const doOperador: string[] = []
    for (const proj of Object.values(projetos || {})) for (const s of proj?.shows || []) if (typeof s?.id === "string" && !s?.data?.sirvoMaterial) doOperador.push(normCaminho(s.id))
    for (const { c, n } of pendentes) if (doOperador.includes(n)) achados.add(c)
    return achados
}
