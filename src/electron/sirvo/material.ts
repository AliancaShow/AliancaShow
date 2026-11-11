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
//   - 3 tentativas (5 s, 30 s, 120 s); depois reporta `falhou` e só tenta de
//     novo 10 min depois.
// A conversa com o projeto (pôr o item em "Fora do roteiro") é do renderer
// (aliancaSirvoMaterial.ts), que só recebe o estado sem URL.

import { once } from "events"
import { createHash } from "crypto"
import fs from "fs"
import { Readable } from "stream"
import { _store } from "../data/store"
import { dentroDaPastaOnline } from "../data/downloadMedia"
import { getDataFolderPath, getMediaCodec, makeDir } from "../utils/files"
import { cabeNoDisco, ESTADO_VAZIO, estadoParaRenderer, etagEhMd5, etagsIguais, nomeDoArquivo, pastaDoMaterial, resolverDestino, urlDoMaterialValida, validarPendente, type EstadoMaterial, type MaterialNoDisco, type MaterialPendente } from "./materialLogica"
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

type Registro = MaterialNoDisco & { etag: string; tamanho: number }
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
const esperaPorId = new Map<string, number>() // id → só volta a tentar depois disto (url_indisponivel, 55000, 54000)
let urlsLiberadasApos = 0
const aRelatar = new Map<string, ARelatar>()
let habilitado: boolean | null = null
let perguntarApos = 0
let lote = { total: 0, feitos: 0 }
let sincronizando = false
let geracao = 0 // sobe em materialParar: o que estava em voo se descarta

const chaveDoStore = () => "sirvo_material" + sirvoSufixoDoAmbiente()

function carregar(): Map<string, Registro> {
    if (registros) return registros
    registros = new Map()
    try {
        const salvo = _store.ACCESS?.get(chaveDoStore()) as { [id: string]: Registro } | undefined
        for (const [id, r] of Object.entries(salvo || {})) if (r && typeof r.caminho === "string" && typeof r.etag === "string") registros.set(id, r)
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

const tamanhoNoDisco = (caminho: string): number => {
    try {
        return fs.statSync(caminho).size
    } catch {
        return -1
    }
}

/** o estado que o renderer enxerga (sem URL, ver estadoParaRenderer) */
export function materialEstado(): EstadoMaterial {
    const baixados: MaterialNoDisco[] = []
    for (const r of carregar().values()) {
        // arquivo que sumiu do disco não é oferecido ao projeto
        if (tamanhoNoDisco(r.caminho) !== r.tamanho) continue
        baixados.push({ id: r.id, caminho: r.caminho, nome: r.nome, tipo: r.tipo, codec: r.codec, event_id: r.event_id })
    }
    return estadoParaRenderer({
        ...ESTADO_VAZIO,
        habilitado,
        baixando: emCurso.size,
        naFila: fila.length,
        lote: { total: lote.total, feitos: Math.min(lote.total, lote.feitos + emCurso.size) },
        falhas: [...falhos].map(([id, f]) => ({ id, nome: f.nome, detalhe: f.detalhe })),
        baixados
    })
}

/** desconectou do Sirvo (ou trocou a chave): cancela tudo; o que já está no disco continua lá */
export function materialParar() {
    geracao++
    for (const c of emCurso.values()) c.abort()
    emCurso.clear()
    fila.length = 0
    falhos.clear()
    aRelatar.clear()
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
        // os relatos pendentes seguem em segundo plano: o IPC não espera N chamadas ao Sirvo
        void relatarPendentes(g)
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
        if (!m) continue
        if (emCurso.has(m.id) || fila.some((x) => x.id === m.id)) continue
        const falho = falhos.get(m.id)
        if (falho && agora < falho.tentarApos) continue
        if (agora < (esperaPorId.get(m.id) || 0)) continue
        // mesmo id + mesmo ETag e o arquivo está lá com o tamanho certo: não baixa de novo,
        // só diz ao Sirvo que está no PC (o relato anterior pode ter se perdido)
        const feito = carregar().get(m.id)
        if (feito && etagsIguais(feito.etag, m.etag) && tamanhoNoDisco(feito.caminho) === m.tamanho) {
            if (!aRelatar.has(m.id)) aRelatar.set(m.id, { status: "baixado", detalhe: null, codec: feito.codec })
            continue
        }
        fila.push(m)
        lote.total++
    }
}

function bombear() {
    while (emCurso.size < EM_PARALELO && fila.length) {
        const m = fila.shift()!
        const ctl = new AbortController()
        emCurso.set(m.id, ctl)
        void processar(m, ctl, geracao)
    }
}

async function processar(m: MaterialPendente, ctl: AbortController, g: number) {
    let falha = ""
    for (let tentativa = 0; tentativa < ESPERAS_MS.length + 1; tentativa++) {
        try {
            const r = await baixar(m, ctl)
            if (g !== geracao) return
            carregar().set(m.id, { id: m.id, caminho: r.caminho, nome: m.nome, tipo: m.tipo, codec: r.codec, event_id: m.event_id, etag: m.etag, tamanho: m.tamanho })
            guardar()
            falhos.delete(m.id)
            aRelatar.set(m.id, { status: "baixado", detalhe: null, codec: r.codec })
            falha = ""
            break
        } catch (erro) {
            if (g !== geracao) return
            falha = erro instanceof ErroDeMaterial ? erro.codigo : ctl.signal.aborted ? "tempo" : "rede"
            // não é falha do arquivo: o Sirvo mandou esperar (ou descartar); nada é relatado
            if (falha === "espera" || falha === "descartar") {
                if (falha === "descartar") esperaPorId.set(m.id, Date.now() + 60 * 60_000)
                emCurso.delete(m.id)
                lote.total = Math.max(0, lote.total - 1)
                bombear()
                return
            }
            // sem permissão ou disco cheio não melhoram em segundos: não insiste
            if (falha === "nao_baixa" || falha === "disco_cheio" || falha === "destino" || falha === "url_invalida") break
            if (tentativa < ESPERAS_MS.length) await dormir(ESPERAS_MS[tentativa])
            if (g !== geracao) return
        }
    }

    if (g !== geracao) return
    if (falha) {
        console.warn(`Sirvo: material ${m.id.slice(0, 8)} falhou (${falha})`)
        const vezes = (falhos.get(m.id)?.vezes || 0) + 1
        falhos.set(m.id, { nome: m.nome, detalhe: falha, tentarApos: Date.now() + DEPOIS_DE_FALHAR_MS[Math.min(vezes, DEPOIS_DE_FALHAR_MS.length) - 1], vezes })
        aRelatar.set(m.id, { status: "falhou", detalhe: falha, codec: null })
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
    if (relatando) return
    relatando = true
    try {
        for (const [id, a] of [...aRelatar]) {
            if (g !== geracao) return
            const r = await sirvoChamarDoMain("show_material_status", { p_id: id, p_status: a.status, p_detalhe: a.detalhe, p_codec: a.codec })
            if (g !== geracao) return
            if (r.ok) aRelatar.delete(id)
            else if (r.codigo === "chave_invalida" || r.codigo === "sem_chave" || r.codigo === "nao_baixa" || r.codigo === "rede" || r.pg === "54000" || r.pg === "55000")
                return // 54000: passou de 60/min, fica na fila
            else aRelatar.delete(id) // o Sirvo recusou este id (apagado, status inválido): repetir não muda nada
        }
    } finally {
        relatando = false
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
    const alvo = arquivo && resolverDestino(getDataFolderPath("onlineMedia"), pastaDoMaterial(m), arquivo)
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
        const saida = fs.createWriteStream(parcial)
        let bytes = 0
        try {
            for await (const pedaco of Readable.fromWeb(resposta.body as any)) {
                bytes += (pedaco as Buffer).length
                if (bytes > m.tamanho) throw new ErroDeMaterial("tamanho")
                md5?.update(pedaco as Buffer)
                armar()
                if (!saida.write(pedaco)) await once(saida, "drain")
            }
            await new Promise<void>((resolve, reject) => {
                saida.once("error", reject)
                saida.end(resolve)
            })
        } catch (erro) {
            saida.destroy()
            throw erro
        }

        if (bytes !== m.tamanho || tamanhoNoDisco(parcial) !== m.tamanho) throw new ErroDeMaterial("tamanho")
        if (md5 && !etagsIguais(md5.digest("hex"), m.etag)) throw new ErroDeMaterial("etag")
        await fs.promises.rename(parcial, alvo.destino)
    } catch (erro) {
        try {
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
