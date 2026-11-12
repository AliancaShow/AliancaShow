// ----- AliançaShow · material da semana pelo Sirvo (F5, S3): a fila de download (processo principal) -----
//
// O PC da sala de vídeo pergunta ao Sirvo "tem material pendente?" (a cada
// 60 s, junto do ciclo de cultos do renderer), pede a URL de UM arquivo por
// vez e baixa para Online/Sirvo/<dia>/<nome>__<id8>.<ext>.
//
// Regras deste arquivo (desenho F5, §2.3 e §2.6):
//   - a URL assinada vive SÓ aqui: é pedida por `sirvoChamarDoMain`, usada e
//     esquecida. Nunca entra em estado, log, mensagem de erro nem em IPC;
//   - 2 downloads em paralelo; 10 min no máximo por arquivo e 60 s sem receber
//     um byte; `redirect: "error"`; Content-Length e ETag conferem com o
//     pedido; espaço livre ≥ tamanho + 500 MB;
//   - grava em `.part`, confere tamanho (e o MD5, quando o ETag é MD5) e só
//     então renomeia: arquivo pela metade nunca tem o nome final;
//   - o Show NUNCA apaga arquivo do disco por causa do Sirvo;
//   - 3 tentativas (5 s, 30 s, 120 s), cada uma com o PRÓPRIO AbortController;
//     depois reporta `falhou` e recua por id (1, 5, 15, 60 min).
// A conversa com o projeto (pôr o item em "Fora do roteiro") é do renderer
// (aliancaSirvoMaterial.ts), que só recebe o estado sem URL.

import { createHash } from "crypto"
import { once } from "events"
import fs from "fs"
import path from "path"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import { dentroDaPastaOnline } from "../data/downloadMedia"
import { _store } from "../data/store"
import { getDataFolderPath, getMediaCodec, makeDir } from "../utils/files"
import { limparMaterial, bytesDaArvore, lerArvore } from "./limpeza"
import { cabeNoDisco, comTentativas, decidirLinha, decidirRelato, DISCO_VAZIO, ehUuid, ESTADO_VAZIO, estadoParaRenderer, etagEhMd5, etagsIguais, filtrarRegistros, limparEtag, nomeDoArquivo, PASTA_DO_SIRVO, pastaDoMaterial, resolverDestino, tipoDaExtensao, urlDoMaterialValida, validarPendente, type EstadoDisco, type EstadoMaterial, type MaterialNoDisco, type MaterialPendente } from "./materialLogica"
import { sirvoChamarDoMain, sirvoR2, sirvoSufixoDoAmbiente } from "./sirvo"

const EM_PARALELO = 2
const TEMPO_MAX_MS = 10 * 60_000
const PARADA_MS = 60_000
const ESPERAS_MS = [5_000, 30_000, 120_000]
// espera por id depois de falhar: 1, 5, 15, 60 min (o Sirvo continua listando o que falhou; zera ao reabrir o Show)
const DEPOIS_DE_FALHAR_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000]
const LIMITE_POR_HORA_MS = 10 * 60_000
const SEM_PERMISSAO_MS = 5 * 60_000
const CODEC_MAX_MS = 20_000
const PARCIAL_VELHO_MS = 86_400_000
const CACHE_DISCO_MS = 30_000

type Registro = MaterialNoDisco & {
    etag: string
    tamanho: number
    /** quando entrou no mapa (informativo: o mapa NÃO é mais podado por idade, v5) */
    em?: number
}
type ARelatar = { status: "baixado" | "falhou"; detalhe: string | null; codec: string | null }

/** erro com um código curto e SEM texto de rede: é o que vira `detalhe` */
class ErroDeMaterial extends Error {
    constructor(public codigo: string) {
        super(codigo)
    }
}

// ---------------------------------------------------------------- estado

let registros: Map<string, Registro> | null = null
const fila: MaterialPendente[] = []
const emCurso = new Map<string, AbortController>()
const falhos = new Map<string, { nome: string; detalhe: string; tentarApos: number; vezes: number }>()
const esperaPorId = new Map<string, number>() // id → só volta a tentar depois disto (url_indisponivel, 54000, descartado)
let urlsLiberadasApos = 0
const aRelatar = new Map<string, ARelatar>()
const etagRelatado = new Set<string>()
let habilitado: boolean | null = null
let perguntarApos = 0
let relatarApos = 0 // recuo dos relatos de status (rede, interruptor desligado, 54000)
let lote = { total: 0, feitos: 0 }
let sincronizando = false
let limpouParciais = false
let geracao = 0 // sobe em materialParar: o que estava em voo se descarta
let disco: EstadoDisco = DISCO_VAZIO
let limpando = false

// v2: o registro é por VERSÃO e leva arquivo_id; os registros do modelo antigo ficam ignorados
const chaveDoStore = () => "sirvo_material_v2" + sirvoSufixoDoAmbiente()

function tamanhoNoDisco(caminho: string): number {
    try {
        return fs.statSync(caminho).size
    } catch {
        return -1
    }
}

function carregar(): Map<string, Registro> {
    if (registros) return registros
    registros = new Map()
    try {
        // sem poda por idade: só sai o que não está mais no disco
        const { mantidos, podou } = filtrarRegistros<Registro>(_store.ACCESS?.get(chaveDoStore()), tamanhoNoDisco)
        registros = mantidos
        if (podou) guardar()
    } catch (erro) {
        console.error("Sirvo: não consegui ler o mapa do material", erro)
    }
    return registros
}

function guardar() {
    try {
        _store.ACCESS?.set(chaveDoStore(), Object.fromEntries(carregar()))
    } catch (erro) {
        console.error("Sirvo: não consegui guardar o mapa do material", erro)
    }
}

// o renderer pede o estado a cada 3 s: não confere o disco de tudo a cada vez
const cacheDisco = new Map<string, { ok: boolean; em: number }>()
function aindaNoDisco(r: Registro): boolean {
    const agora = Date.now()
    const c = cacheDisco.get(r.id)
    if (c && agora - c.em < CACHE_DISCO_MS) return c.ok
    const ok = tamanhoNoDisco(r.caminho) === r.tamanho
    cacheDisco.set(r.id, { ok, em: agora })
    return ok
}

/** o estado que o renderer enxerga (sem URL, ver estadoParaRenderer) */
export function materialEstado(): EstadoMaterial {
    const baixados: MaterialNoDisco[] = []
    for (const r of carregar().values()) {
        // arquivo que sumiu do disco não é oferecido ao projeto
        if (!aindaNoDisco(r)) continue
        baixados.push({ id: r.id, arquivo_id: r.arquivo_id, caminho: r.caminho, nome: r.nome, tipo: r.tipo, codec: r.codec })
    }
    return estadoParaRenderer({
        ...ESTADO_VAZIO,
        habilitado,
        baixando: emCurso.size,
        naFila: fila.length,
        lote: { total: lote.total, feitos: Math.min(lote.total, lote.feitos + emCurso.size) },
        falhas: [...falhos].map(([id, f]) => ({ id, nome: f.nome, detalhe: f.detalhe })),
        baixados,
        disco
    })
}

/** mede Online/Sirvo e o volume (a cada sincronização, 60 s; nunca no poll de 3 s) */
async function medirDisco() {
    try {
        const arvore = lerArvore()
        const s = await fs.promises.statfs(getDataFolderPath("onlineMedia")).catch(() => null)
        disco = { ...disco, usado: bytesDaArvore(arvore), livre: s ? Number(s.bavail) * Number(s.bsize) : -1 }
    } catch {}
}

/** o renderer pediu a limpeza (tela e áudio livres, fora do roteiroNoAr) — ver aliancaSirvoMaterial.ts */
export async function materialLimpar(vivos: string[]): Promise<EstadoMaterial> {
    if (limpando) return materialEstado()
    limpando = true
    try {
        const r = await limparMaterial(vivos, habilitado)
        disco = { ...disco, limpeza: { em: Date.now(), arquivos: r.arquivos, bytes: r.bytes, adiada: r.adiada } }
        await medirDisco()
    } catch (erro) {
        console.error("Sirvo: falha na limpeza do material", erro)
        disco = { ...disco, limpeza: { ...disco.limpeza, em: Date.now(), adiada: "erro na limpeza" } }
    } finally {
        limpando = false
    }
    return materialEstado()
}

/** desconectou do Sirvo (ou trocou a chave): cancela tudo; o que já está no disco continua lá */
export function materialParar() {
    geracao++
    for (const c of emCurso.values()) c.abort()
    emCurso.clear()
    fila.length = 0
    falhos.clear()
    aRelatar.clear()
    cacheDisco.clear()
    relatarApos = 0
    habilitado = null
    perguntarApos = 0
    lote = { total: 0, feitos: 0 }
}

// ---------------------------------------------------------------- a rotina de 60 s

/** Chamado pelo renderer a cada ciclo de cultos (e ao conectar). Nunca lança. */
export async function materialSincronizar(): Promise<EstadoMaterial> {
    if (sincronizando) return materialEstado()
    sincronizando = true
    const g = geracao
    try {
        if (!limpouParciais) {
            limpouParciais = true
            void limparParciais()
        }
        // os relatos pendentes seguem em segundo plano: o IPC não espera N chamadas ao Sirvo
        void relatarPendentes(g)
        void medirDisco()
        if (g === geracao && Date.now() >= perguntarApos) {
            const r = await sirvoChamarDoMain("show_material_pendente", {})
            if (g !== geracao) return materialEstado()
            if (r.ok) {
                habilitado = true
                enfileirar(Array.isArray(r.dados) ? r.dados : [])
            } else if (r.codigo === "nao_baixa") {
                // "não baixa" em silêncio: como o catálogo sem permissão, pergunta de novo em 5 min
                habilitado = false
                perguntarApos = Date.now() + SEM_PERMISSAO_MS
                fila.length = 0
            } else if (r.codigo === "chave_invalida" || r.codigo === "sem_chave") {
                materialParar()
            }
            // rede ou erro: segue com o que tem e pergunta no próximo ciclo
        }
        bombear()
    } catch (erro) {
        console.error("Sirvo: falha na rotina do material", erro)
    } finally {
        sincronizando = false
    }
    return materialEstado()
}

function enfileirar(lista: any[]) {
    const ociosa = !fila.length && !emCurso.size
    if (ociosa) lote = { total: 0, feitos: 0 }
    const agora = Date.now()
    for (const bruto of lista) {
        const m = validarPendente(bruto)
        if (!m) {
            // ETag ausente: não há o que conferir, então nunca baixa; diz ao Sirvo uma vez (o resto do lixo é só ignorado)
            if (ehUuid(bruto?.id) && tipoDaExtensao(bruto?.ext) && !limparEtag(bruto?.etag) && !etagRelatado.has(bruto.id)) {
                etagRelatado.add(bruto.id)
                aRelatar.set(bruto.id, { status: "falhou", detalhe: "etag", codec: null })
            }
            continue
        }
        if (emCurso.has(m.id) || fila.some((x) => x.id === m.id)) continue
        const falho = falhos.get(m.id)
        if (falho && agora < falho.tentarApos) continue
        if (agora < (esperaPorId.get(m.id) || 0)) continue
        // a pendente traz TODA versão atual com uso na janela: no disco e certa não baixa de novo, e só
        // relata `baixado` se o Sirvo ainda não sabe (baixa_status !== "baixado")
        const feito = carregar().get(m.id)
        const acao = decidirLinha(m, feito, tamanhoNoDisco)
        if (acao === "relatar_baixado") {
            if (!aRelatar.has(m.id)) aRelatar.set(m.id, { status: "baixado", detalhe: null, codec: feito!.codec })
            continue
        }
        if (acao === "nada") continue
        fila.push(m)
        lote.total++
    }
}

function bombear() {
    while (emCurso.size < EM_PARALELO && fila.length) {
        const m = fila.shift()!
        emCurso.set(m.id, new AbortController()) // ocupa a vaga; cada tentativa troca por um controle novo
        void processar(m, geracao)
    }
}

async function processar(m: MaterialPendente, g: number) {
    const r = await comTentativas((ctl) => baixar(m, ctl), {
        esperas: ESPERAS_MS,
        dormir,
        vivo: () => g === geracao,
        // um controle NOVO por tentativa: o que estourou o tempo na anterior não aborta a seguinte
        aoNovoControle: (ctl) => emCurso.set(m.id, ctl),
        codigoDe: (erro, ctl) => (erro instanceof ErroDeMaterial ? erro.codigo : ctl.signal.aborted ? "tempo" : "rede"),
        // sem permissão, disco cheio, destino ou URL torta não melhoram em segundos; "espera"/"descartar" nem são falha
        fatal: (c) => ["nao_baixa", "disco_cheio", "destino", "url_invalida", "espera", "descartar"].includes(c)
    })
    if ("abandonado" in r) return

    if (r.ok) {
        const v = r.valor
        carregar().set(m.id, { id: m.id, arquivo_id: m.arquivo_id, caminho: v.caminho, nome: m.nome, tipo: m.tipo, codec: v.codec, etag: m.etag, tamanho: m.tamanho, em: Date.now() })
        cacheDisco.delete(m.id)
        guardar()
        falhos.delete(m.id)
        aRelatar.set(m.id, { status: "baixado", detalhe: null, codec: v.codec })
    } else if (r.falha === "espera" || r.falha === "descartar") {
        // não é falha do arquivo: o Sirvo mandou esperar (ou descartar); nada é relatado e o lote não conta
        if (r.falha === "descartar") esperaPorId.set(m.id, Date.now() + 60 * 60_000)
        emCurso.delete(m.id)
        lote.total = Math.max(0, lote.total - 1)
        bombear()
        return
    } else {
        console.warn(`Sirvo: material ${m.id.slice(0, 8)} falhou (${r.falha})`)
        const vezes = (falhos.get(m.id)?.vezes || 0) + 1
        falhos.set(m.id, { nome: m.nome, detalhe: r.falha, tentarApos: Date.now() + DEPOIS_DE_FALHAR_MS[Math.min(vezes, DEPOIS_DE_FALHAR_MS.length) - 1], vezes })
        aRelatar.set(m.id, { status: "falhou", detalhe: r.falha, codec: null })
    }
    lote.feitos++
    emCurso.delete(m.id)
    bombear()
    void relatarPendentes(g)
}

// materialParar muda a geração; quem acorda confere
const dormir = (ms: number) =>
    new Promise<void>((resolve) => {
        setTimeout(resolve, ms).unref?.()
    })

/** diz ao Sirvo o que aconteceu (baixado / falhou); o que não chegar fica para o próximo ciclo */
let relatando = false
async function relatarPendentes(g: number) {
    if (relatando || Date.now() < relatarApos) return
    relatando = true
    try {
        for (const [id, a] of [...aRelatar]) {
            if (g !== geracao) return
            const r = await sirvoChamarDoMain("show_material_status", { p_id: id, p_status: a.status, p_detalhe: a.detalhe, p_codec: a.codec })
            if (g !== geracao) return
            const decisao = decidirRelato(r as any)
            if (decisao === "feito" || decisao === "pular") {
                // "pular": o Sirvo recusou ESTE id (55000, P0002, 22023): repetir não muda nada, e o resto da fila segue
                aRelatar.delete(id)
                continue
            }
            // problema geral: recua (interruptor desligado 5 min; rede e 54000 1 min) e deixa na fila
            relatarApos = Date.now() + (!r.ok && r.codigo === "nao_baixa" ? SEM_PERMISSAO_MS : 60_000)
            return
        }
    } finally {
        relatando = false
    }
}

/** .part de uma queda no meio do download, com mais de 1 dia: sai (só dentro de Online/Sirvo) */
async function limparParciais() {
    try {
        const raiz = path.join(getDataFolderPath("onlineMedia"), PASTA_DO_SIRVO)
        const agora = Date.now()
        for (const dia of await fs.promises.readdir(raiz, { withFileTypes: true })) {
            if (!dia.isDirectory()) continue
            for (const f of await fs.promises.readdir(path.join(raiz, dia.name))) {
                if (!f.endsWith(".part")) continue
                const alvo = path.join(raiz, dia.name, f)
                const st = await fs.promises.stat(alvo).catch(() => null)
                if (st && agora - st.mtimeMs > PARCIAL_VELHO_MS) await fs.promises.unlink(alvo).catch(() => {})
            }
        }
    } catch {
        // a pasta ainda não existe: nada a limpar
    }
}

// ---------------------------------------------------------------- um download

async function baixar(m: MaterialPendente, ctl: AbortController): Promise<{ caminho: string; codec: string | null }> {
    // 1. a URL deste arquivo, só aqui dentro
    if (Date.now() < urlsLiberadasApos) throw new ErroDeMaterial("espera")
    const r = await sirvoChamarDoMain("show_material_url", { p_id: m.id })
    if (!r.ok) {
        if (r.pg === "P0002") throw new ErroDeMaterial("descartar") // de outra igreja / não existe: sai da fila
        if (r.pg === "55000") throw new ErroDeMaterial("espera") // ainda não está pronto ou está nos 30 s de desfazer: no próximo ciclo
        if (r.pg === "54000") {
            urlsLiberadasApos = Date.now() + LIMITE_POR_HORA_MS // passou de 120/h: ninguém pede URL por 10 min
            throw new ErroDeMaterial("espera")
        }
        throw new ErroDeMaterial(r.codigo === "nao_baixa" ? "nao_baixa" : r.codigo === "rede" ? "rede" : "url")
    }
    const dados = Array.isArray(r.dados) ? r.dados[0] : r.dados
    // {ok:false, codigo:"url_indisponivel", tentar_em_s}: não é erro, é "tente depois"
    if (!dados || dados.ok === false || typeof dados.url !== "string") {
        const em = Number(dados?.tentar_em_s)
        esperaPorId.set(m.id, Date.now() + (Number.isFinite(em) && em > 0 ? Math.min(em, 3600) : 300) * 1000)
        throw new ErroDeMaterial("espera")
    }
    const url: string = dados.url
    if (!urlDoMaterialValida(url, m, sirvoR2())) throw new ErroDeMaterial("url_invalida")

    // 2. o destino, dentro de Online/Sirvo
    const arquivo = nomeDoArquivo(m.nome, m.id, m.ext)
    // a pasta do arquivo é a que já existe no disco com o sufixo __<arquivo8>
    let existentes: string[] = []
    try {
        existentes = fs.readdirSync(path.join(getDataFolderPath("onlineMedia"), PASTA_DO_SIRVO), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    } catch {}
    const alvo = arquivo && resolverDestino(getDataFolderPath("onlineMedia"), pastaDoMaterial(m, existentes), arquivo)
    if (!alvo || !dentroDaPastaOnline(alvo.pasta)) throw new ErroDeMaterial("destino")
    makeDir(alvo.pasta)

    // já está lá (outra sessão, mapa perdido): confere o conteúdo em vez de baixar
    if (tamanhoNoDisco(alvo.destino) === m.tamanho && (await conteudoConfere(alvo.destino, m))) return { caminho: alvo.destino, codec: await descobrirCodec(alvo.destino, m) }

    // 3. cabe?
    try {
        const s = await fs.promises.statfs(alvo.pasta)
        if (!cabeNoDisco(Number(s.bavail) * Number(s.bsize), m.tamanho)) throw new ErroDeMaterial("disco_cheio")
    } catch (erro) {
        if (erro instanceof ErroDeMaterial) throw erro
        // statfs indisponível: segue (o gravar falha sozinho se faltar espaço)
    }

    // 4. baixa para .part, confere, renomeia
    const parcial = alvo.destino + ".part"
    const limite = setTimeout(() => ctl.abort(), TEMPO_MAX_MS)
    let parada: ReturnType<typeof setTimeout> | null = null
    let saida: fs.WriteStream | null = null
    const armar = () => {
        if (parada) clearTimeout(parada)
        parada = setTimeout(() => ctl.abort(), PARADA_MS)
    }
    try {
        armar()
        const resposta = await fetch(url, { redirect: "error", signal: ctl.signal })
        if (!resposta.ok || !resposta.body) throw new ErroDeMaterial(`http_${resposta.status}`)
        if (Number(resposta.headers.get("content-length")) !== m.tamanho) throw new ErroDeMaterial("tamanho")
        const etagDoServidor = resposta.headers.get("etag")
        if (etagDoServidor && !etagsIguais(etagDoServidor, m.etag)) throw new ErroDeMaterial("etag")

        const md5 = etagEhMd5(m.etag) ? createHash("md5") : null
        saida = fs.createWriteStream(parcial)
        let bytes = 0
        // o pipeline liga o 'error' dos dois lados (inclusive o do arquivo, que antes ficava sem ouvinte) e destrói tudo se algo falhar
        await pipeline(
            Readable.fromWeb(resposta.body as any),
            async function* (origem: AsyncIterable<Buffer>) {
                for await (const pedaco of origem) {
                    bytes += pedaco.length
                    if (bytes > m.tamanho) throw new ErroDeMaterial("tamanho")
                    md5?.update(pedaco)
                    armar()
                    yield pedaco
                }
            },
            saida
        )

        if (bytes !== m.tamanho || tamanhoNoDisco(parcial) !== m.tamanho) throw new ErroDeMaterial("tamanho")
        if (md5 && !etagsIguais(md5.digest("hex"), m.etag)) throw new ErroDeMaterial("etag")
        await fs.promises.rename(parcial, alvo.destino)
    } catch (erro) {
        // no Windows o arquivo aberto não se apaga (EBUSY): espera o stream fechar de verdade
        try {
            if (saida && !saida.closed) {
                saida.destroy()
                await Promise.race([once(saida, "close"), new Promise((resolve) => setTimeout(resolve, 3_000))])
            }
            if (fs.existsSync(parcial)) fs.unlinkSync(parcial)
        } catch {}
        throw erro
    } finally {
        clearTimeout(limite)
        if (parada) clearTimeout(parada)
    }

    console.info(`Sirvo: material baixado (${m.tipo}, ${Math.round(m.tamanho / 1024 / 1024)} MB)`)
    return { caminho: alvo.destino, codec: await descobrirCodec(alvo.destino, m) }
}

/** o arquivo que já está no disco tem o conteúdo certo? (MD5 quando o ETag é MD5; senão só o tamanho, já conferido) */
async function conteudoConfere(caminho: string, m: MaterialPendente): Promise<boolean> {
    if (!etagEhMd5(m.etag)) return true
    const md5 = createHash("md5")
    try {
        for await (const pedaco of fs.createReadStream(caminho)) md5.update(pedaco as Buffer)
    } catch {
        return false
    }
    return etagsIguais(md5.digest("hex"), m.etag)
}

/** o codec de vídeo lido do arquivo (20 s no máximo); senão o que o Sirvo disse */
async function descobrirCodec(caminho: string, m: MaterialPendente): Promise<string | null> {
    if (!["mp4", "mov", "m4v"].includes(m.ext)) return m.codec
    try {
        const lido = await Promise.race([getMediaCodec({ path: caminho }), new Promise<null>((resolve) => setTimeout(() => resolve(null), CODEC_MAX_MS))])
        const codecs: string[] = (lido as any)?.codecs || []
        return codecs.length ? codecs.join(",").slice(0, 80) : m.codec
    } catch {
        return m.codec
    }
}
