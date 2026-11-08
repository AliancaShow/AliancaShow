import { onValue, ref, runTransaction, set, type Database } from "firebase/database"
import { get } from "svelte/store"
import { uid } from "uid"
import { Main } from "../../types/IPC/Main"
import type { Item } from "../../types/Show"
import { loadJsonBible, getShortBibleName } from "../components/drawer/bible/scripture"
import { getFirstActiveOutput } from "../components/helpers/output"
import { OutputHelper } from "../components/helpers/OutputHelper"
import { _show } from "../components/helpers/shows"
import { clearAll } from "../components/output/clear"
import { requestMain } from "../IPC/main"
import { activeProject, activeShow, categories, folders, outputs, projects, scriptures, shows, showsCache } from "../stores"
import { AGENDAS, cultoDoProjeto, type Agenda } from "./agendas"

/**
 * O lado do computador na aba Remote do celular, no catalogo de louvores e no
 * indice da Biblia.
 *
 *     agendas/{agenda}/controle/dono   qual computador responde por aquele culto
 *     agendas/{agenda}/comando         proximo | anterior | limpar | abrir
 *     agendas/{agenda}/estado          o que esta no ar, e a ordem do culto
 *     catalogo                         as musicas da biblioteca
 *     biblia                           livros e capitulos de cada traducao
 *
 * A agenda deste computador e a do culto aberto no painel. Cada agenda tem um
 * dono so: e ele que executa os comandos e publica o estado. Sem isso o
 * computador de casa, aberto no mesmo culto, passaria o slide junto com o da
 * igreja. O posto e renovado a cada 45s e fica livre depois de dois minutos e
 * meio parado, entao fechar o app nao trava ninguem.
 */

const RENOVAR_MS = 45_000
const POSTO_LIVRE_MS = 150_000
// comando mais velho que isso e de antes de este computador ouvir: um
// "proximo" esquecido no banco nao pode passar slide quando o app abre
const COMANDO_VALE_MS = 30_000

let db: Database | null = null
let meuId = ""
let meuNome = ""
let agendaAtual: Agenda | null = null
let souDono = false
let parar: (() => void)[] = []
let renovacao: ReturnType<typeof setInterval> | null = null

export async function iniciarControle(database: Database) {
    if (db) return
    db = database

    meuId = String((await requestMain(Main.DEVICE_ID, undefined as any)) || uid()).slice(0, 40)
    meuNome = String((await requestMain(Main.GET_DEVICE_NAME, undefined as any)) || "AliançaShow").slice(0, 60)
    if (!db) return // saiu da conta enquanto esperava

    // comandos das tres agendas; so o da agenda aberta, e so sendo dono, executa
    for (const agenda of AGENDAS) {
        parar.push(onValue(ref(db, `agendas/${agenda.id}/comando`), (snap) => executar(agenda, snap.val())))
    }

    parar.push(activeProject.subscribe(trocarAgenda))
    for (const store of [outputs, activeShow, projects, shows]) parar.push(store.subscribe(agendarEstado))
    for (const store of [shows, categories]) parar.push(store.subscribe(agendarCatalogo))
    parar.push(scriptures.subscribe(agendarBiblia))

    renovacao = setInterval(() => {
        assumir().then(() => publicarEstado(true))
    }, RENOVAR_MS)
}

export function pararControle() {
    parar.forEach((fn) => fn())
    parar = []
    if (renovacao) clearInterval(renovacao)
    renovacao = null
    ;[tEstado, tCatalogo, tBiblia].forEach((t) => clearTimeout(t))
    db = null
    souDono = false
    agendaAtual = null
    ultimoEstado = ""
    ultimoCatalogo = ""
    ultimaBiblia = ""
}

// ---------------------------------------------------------------- dono

export function meuComputador() {
    return meuId
}

/** este computador responde pela agenda agora? So o dono publica por ela */
export function souDonoDe(agendaId: string) {
    return souDono && agendaAtual?.id === agendaId
}

function agendaDoProjetoAtivo() {
    return cultoDoProjeto(get(activeProject) || "", get(projects), get(folders))?.agenda || null
}

function trocarAgenda() {
    const nova = agendaDoProjetoAtivo()
    if (nova?.id === agendaAtual?.id) return agendarEstado()

    agendaAtual = nova
    souDono = false
    assumir().then(() => publicarEstado(true))
}

async function assumir() {
    const agenda = agendaAtual
    if (!db || !agenda) {
        souDono = false
        return
    }

    try {
        const resultado = await runTransaction(ref(db, `agendas/${agenda.id}/controle/dono`), (dono) => {
            // outro computador esta no posto e vivo: desiste sem escrever
            if (dono?.id && dono.id !== meuId && Date.now() - Number(dono.em || 0) < POSTO_LIVRE_MS) return
            return { id: meuId, nome: meuNome, em: Date.now() }
        })
        const eraDono = souDono
        souDono = resultado.committed && agendaAtual?.id === agenda.id

        // virou dono agora: o que so o dono publica sai ja, sem esperar mudanca
        if (souDono && !eraDono) {
            agendarCatalogo()
            agendarBiblia()
        }
    } catch (err) {
        console.error("AliançaShow Remote: falha ao assumir o controle:", err)
        souDono = false
    }
}

// ---------------------------------------------------------------- comandos

const executados: { [agenda: string]: number } = {}

function executar(agenda: Agenda, comando: any) {
    if (!db || !comando?.acao) return
    if (!souDono || agendaAtual?.id !== agenda.id) return

    const em = Number(comando.em || 0)
    const limpar = () => set(ref(db!, `agendas/${agenda.id}/comando`), null).catch((err) => console.error("Falha ao limpar o comando:", err))

    if (Date.now() - em > COMANDO_VALE_MS) return limpar()
    // o mesmo comando volta pelo ouvinte enquanto a limpeza nao chega
    if (executados[agenda.id] === em) return
    executados[agenda.id] = em

    if (comando.acao === "proximo") OutputHelper.advanceOutputs("next")
    else if (comando.acao === "anterior") OutputHelper.advanceOutputs("previous")
    else if (comando.acao === "limpar") clearAll()
    else if (comando.acao === "abrir" && Number.isInteger(comando.indice)) OutputHelper.playProjectItem(comando.indice)

    limpar()
}

// ---------------------------------------------------------------- estado

let tEstado: ReturnType<typeof setTimeout> | undefined
let ultimoEstado = ""

function agendarEstado() {
    clearTimeout(tEstado)
    tEstado = setTimeout(() => publicarEstado(), 250)
}

/** forcar: republica mesmo sem mudanca, para o celular saber que o computador segue ligado */
function publicarEstado(forcar = false) {
    if (!db || !souDono || !agendaAtual) return

    const estado = montarEstado()
    const comparavel = JSON.stringify(estado)
    if (!forcar && comparavel === ultimoEstado) return
    ultimoEstado = comparavel

    // Firebase recusa undefined: o JSON tira os campos vazios
    const limpo = JSON.parse(JSON.stringify({ ...estado, em: Date.now() }))
    set(ref(db, `agendas/${agendaAtual.id}/estado`), limpo).catch((err) => console.error("Falha ao publicar o estado:", err))
}

const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]

function montarEstado() {
    const out = get(outputs)[getFirstActiveOutput()?.id || ""]?.out || {}
    const slide = out.slide
    const fundo = out.background

    let show = ""
    let texto = ""
    let indice: number | undefined
    let total: number | undefined

    if (slide?.id && (slide.type || "show") === "show") {
        const cache = get(showsCache)[slide.id]
        show = cache?.name || get(shows)[slide.id]?.name || ""

        if (cache) {
            const layout = slide.layout || cache.settings?.activeLayout || ""
            const refs = _show(slide.id).layouts([layout]).ref()[0] || []
            total = refs.length || undefined
            indice = typeof slide.index === "number" ? slide.index : undefined
            const slideId = refs[slide.index ?? -1]?.id
            texto = textoDosItens(cache.slides?.[slideId]?.items)
        }
        // versiculo e outros slides temporarios trazem o texto na propria saida
        if (!texto && slide.tempItems) texto = textoDosItens(slide.tempItems)
    } else if (slide?.name) {
        show = slide.name
    }

    if (!show && fundo) show = fundo.name || nomeDoArquivo(fundo.path || fundo.id || "")

    const projetoId = get(activeProject) || ""
    const projeto = get(projects)[projetoId]
    const itens = (projeto?.shows || []).map((item) => ({ nome: nomeDoItem(item), tipo: item.type || "show" }))

    return {
        noAr: !!(slide || fundo?.path || fundo?.id),
        show,
        texto: texto.slice(0, 500),
        indice,
        total,
        culto: nomeDoCulto(projetoId),
        itens,
        itemAtual: get(activeShow)?.index
    }
}

function textoDosItens(itens: Item[] | undefined) {
    if (!Array.isArray(itens)) return ""
    return itens
        .map((item) =>
            (item.lines || [])
                .map((linha) => (linha.text || []).map((t) => t.value || "").join(""))
                .filter(Boolean)
                .join("\n")
        )
        .filter(Boolean)
        .join("\n")
        .trim()
}

function nomeDoArquivo(caminho: string) {
    return (
        caminho
            .split(/[\\/]/)
            .pop()
            ?.replace(/\.[^.]+$/, "") || ""
    )
}

function nomeDoItem(item: { id: string; type?: string; name?: string }) {
    const tipo = item.type || "show"
    if (tipo === "show") return get(shows)[item.id]?.name || "Show"
    return item.name || nomeDoArquivo(item.id) || "Item"
}

/** "Aliança · 6 de setembro" */
function nomeDoCulto(projetoId: string) {
    const culto = cultoDoProjeto(projetoId, get(projects), get(folders))
    if (!culto) return get(projects)[projetoId]?.name || ""
    const [, mes, dia] = culto.cultoId.split("-").map(Number)
    return `${culto.agenda.nome} · ${dia} de ${NOMES_MES[mes - 1]}`
}

// ---------------------------------------------------------------- catalogo

let tCatalogo: ReturnType<typeof setTimeout> | undefined
let ultimoCatalogo = ""

function agendarCatalogo() {
    clearTimeout(tCatalogo)
    tCatalogo = setTimeout(publicarCatalogo, 3000)
}

/**
 * As musicas da biblioteca: shows de categoria com icone de musica (Musicas,
 * Impulso, ProPresenter). Um catalogo so, fora das agendas -- o repertorio e o
 * mesmo nos dois cultos.
 *
 * So o dono publica: o computador de casa, com outra biblioteca, sobrescreveria
 * a lista que a igreja montou.
 */
function publicarCatalogo() {
    if (!db || !souDono) return

    const cats = get(categories)
    const lista: { [id: string]: { nome: string } } = {}
    for (const [id, show] of Object.entries(get(shows))) {
        if (!show?.name || show.private) continue
        if (cats[show.category || ""]?.icon !== "song") continue
        if (/[.#$/[\]]/.test(id)) continue // chave invalida no Firebase
        lista[id] = { nome: String(show.name).slice(0, 120) }
    }

    const json = JSON.stringify(lista)
    if (json === ultimoCatalogo || !Object.keys(lista).length) return
    ultimoCatalogo = json

    set(ref(db, "catalogo"), lista).catch((err) => console.error("Falha ao publicar o catálogo:", err))
}

// ---------------------------------------------------------------- biblia

let tBiblia: ReturnType<typeof setTimeout> | undefined
let ultimaBiblia = ""

function agendarBiblia() {
    clearTimeout(tBiblia)
    tBiblia = setTimeout(publicarBiblia, 2000)
}

/** chave da traducao no banco: o id local, que o celular devolve no item */
export function chaveDaVersao(id: string) {
    return id.replace(/[.#$/[\]]/g, "_").slice(0, 20)
}

/** do que o celular mandou de volta para a Biblia instalada aqui; sem escolha, a primeira */
export function bibliaDaVersao(chave = "") {
    const locais = Object.entries(get(scriptures)).filter(([, b]: any) => !b?.api && !b?.collection)
    return (locais.find(([id]) => chaveDaVersao(id) === chave) || locais[0])?.[0] || ""
}

/**
 * Estrutura de cada Biblia local: livros e quantos capitulos. O texto fica no
 * computador -- publicar a traducao inteira no Firebase seria outro tamanho de
 * problema, e o celular so precisa disso para os seletores.
 */
async function publicarBiblia() {
    if (!db || !souDono) return

    const versoes: { [chave: string]: { nome: string; livros: { nome: string; capitulos: number }[] } } = {}
    for (const [id, dados] of Object.entries(get(scriptures)) as [string, any][]) {
        if (dados?.api || dados?.collection) continue
        const biblia = await loadJsonBible(id)
        if (!biblia?.data?.books?.length) continue

        versoes[chaveDaVersao(id)] = {
            nome: dados.customName || dados.name || getShortBibleName(id),
            livros: biblia.data.books.map((livro) => ({ nome: livro.name, capitulos: livro.chapters.length }))
        }
    }
    if (!db || !Object.keys(versoes).length) return

    const json = JSON.stringify(versoes)
    if (json === ultimaBiblia) return
    ultimaBiblia = json

    set(ref(db, "biblia"), { versoes }).catch((err) => console.error("Falha ao publicar o índice da Bíblia:", err))
}
