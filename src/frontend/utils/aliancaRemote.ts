import { initializeApp, type FirebaseApp } from "firebase/app"
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type Auth } from "firebase/auth"
import { getDatabase, onValue, ref, type Database } from "firebase/database"
import { get } from "svelte/store"
import { uid } from "uid"
import { Main } from "../../types/IPC/Main"
import { requestMain, sendMain } from "../IPC/main"
import { folders, media, mediaFolders, projects, shows } from "../stores"
import { save } from "./save"

/**
 * Ponte com o AliancaShow Remote (o webapp).
 *
 * A equipe envia fotos, videos e musicas pelo celular; aqui esses envios viram
 * arquivos no disco e projetos prontos, com a MESMA arvore do Firebase Storage:
 *
 *     Alianca/2026/09-setembro/06     -> pastas Alianca > 2026 > 09-setembro, projeto "06"
 *     Acampa/1-sexta/1-culto-manha    -> pastas Acampa > 1-sexta, projeto "1-culto-manha"
 *
 * A ligacao e so de saida: o app abre a conexao com o Firebase, nunca recebe
 * conexao. E o que permite funcionar atras do firewall da igreja, sem porta
 * aberta e sem permissao de administrador.
 */

const firebaseConfig = {
    apiKey: "AIzaSyCQbcuXkMgJWxOF2ZdbBKumnd2nnDLbDvA",
    authDomain: "aliancashow-8fb44.firebaseapp.com",
    databaseURL: "https://aliancashow-8fb44-default-rtdb.firebaseio.com",
    projectId: "aliancashow-8fb44",
    storageBucket: "aliancashow-8fb44.firebasestorage.app",
    messagingSenderId: "609682479414",
    appId: "1:609682479414:web:3ccdafe7d59d35ac3efb97"
}

// as duas raizes, que viram pastas de projeto e tambem pastas de midia
const RAIZES = ["Alianca", "Acampa"]

export type EstadoRemote = { ligado: boolean; entrando: boolean; email: string; erro: string; ultimaSync: number; baixando: number }

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Database | null = null
let pararOuvinte: (() => void) | null = null
let aoMudarEstado: ((e: EstadoRemote) => void) | null = null

const estado: EstadoRemote = { ligado: false, entrando: false, email: "", erro: "", ultimaSync: 0, baixando: 0 }

function avisar() {
    aoMudarEstado?.({ ...estado })
}

export function observarEstado(fn: (e: EstadoRemote) => void) {
    aoMudarEstado = fn
    avisar()
}

const MENSAGENS: { [k: string]: string } = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/network-request-failed": "Sem conexão com a internet.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos."
}

function iniciar() {
    if (app) return
    app = initializeApp(firebaseConfig, "aliancaRemote")
    auth = getAuth(app)
    db = getDatabase(app)

    onAuthStateChanged(auth, (usuario) => {
        estado.ligado = !!usuario
        estado.email = usuario?.email || ""
        estado.entrando = false
        avisar()

        if (usuario) ouvirCultos()
        else {
            pararOuvinte?.()
            pararOuvinte = null
        }
    })
}

export async function entrar(email: string, senha: string) {
    iniciar()
    estado.entrando = true
    estado.erro = ""
    avisar()

    try {
        await signInWithEmailAndPassword(auth!, email.trim(), senha)
        // guarda no config LOCAL (AppData), nunca nas configuracoes sincronizadas:
        // senha nao deve viajar para a nuvem junto com o resto
        sendMain(Main.SET_STORE_VALUE, { file: "config", key: "aliancaRemote", value: { email: email.trim(), senha } })
    } catch (err: any) {
        estado.erro = MENSAGENS[err?.code] || "Não foi possível entrar."
        estado.entrando = false
        console.error("AliançaShow Remote:", err?.code, err?.message)
    }
    avisar()
}

export function sair() {
    sendMain(Main.SET_STORE_VALUE, { file: "config", key: "aliancaRemote", value: null })
    if (auth) signOut(auth)
}

/** Entra sozinho na inicializacao, se ja houver conta guardada */
export async function entrarSalvo() {
    const salvo: any = await requestMain(Main.GET_STORE_VALUE, { file: "config", key: "aliancaRemote" })
    if (!salvo?.email || !salvo?.senha) return
    entrar(salvo.email, salvo.senha)
}

// ---------------------------------------------------------------- sincronizacao

function ouvirCultos() {
    if (!db || pararOuvinte) return

    pararOuvinte = onValue(
        ref(db, "cultos"),
        (snap) => {
            sincronizar(snap.val() || {}).catch((e) => console.error("Falha ao sincronizar:", e))
        },
        (erro) => {
            console.error("Falha ao ler os cultos:", erro)
            estado.erro = "Sem acesso aos cultos. Confira a conta."
            avisar()
        }
    )
}

/** garante uma pasta pelo caminho, devolvendo o id da ultima */
function garantirPastas(caminho: string[]) {
    let pai = "/"
    let mudou = false

    for (const nome of caminho) {
        const atuais = get(folders)
        const existente = Object.entries(atuais).find(([, f]: any) => f.name === nome && f.parent === pai)

        if (existente) {
            pai = existente[0]
            continue
        }

        const id = uid()
        folders.update((a) => {
            a[id] = { name: nome, parent: pai, created: Date.now() }
            return a
        })
        pai = id
        mudou = true
    }

    return { id: pai, mudou }
}

function garantirProjeto(nome: string, pastaId: string) {
    const atuais = get(projects)
    const existente = Object.entries(atuais).find(([, p]: any) => p.name === nome && p.parent === pastaId)
    if (existente) return { id: existente[0], mudou: false }

    const id = uid()
    projects.update((a) => {
        a[id] = { name: nome, parent: pastaId, created: Date.now(), shows: [] }
        return a
    })
    return { id, mudou: true }
}

/** as duas raizes tambem viram pastas de midia, para a aba Midia mostrar a mesma arvore */
async function garantirPastasDeMidia() {
    const raizOnline: string = await requestMain(Main.ALIANCA_PASTA_ONLINE, undefined as any)
    if (!raizOnline) return false

    let mudou = false
    for (const nome of RAIZES) {
        const caminho = `${raizOnline}\\${nome}`
        const jaTem = Object.values(get(mediaFolders)).some((f: any) => f.path === caminho)
        if (jaTem) continue

        mediaFolders.update((a) => {
            a[uid()] = { name: nome, path: caminho, icon: "folder", default: false }
            return a
        })
        mudou = true
    }
    return mudou
}

/** "2026-09-06" -> pastas Alianca/2026/09-setembro + projeto "06" */
const MESES = ["01-janeiro", "02-fevereiro", "03-marco", "04-abril", "05-maio", "06-junho", "07-julho", "08-agosto", "09-setembro", "10-outubro", "11-novembro", "12-dezembro"]
const DIAS_ACAMPA: { [k: string]: string } = { sexta: "1-sexta", sabado: "2-sabado", domingo: "3-domingo", segunda: "4-segunda" }
const MOMENTOS: { [k: string]: string } = { manha: "1-culto-manha", noite: "2-culto-noite", brincadeiras: "3-brincadeiras" }

function caminhoDoculto(cultoId: string) {
    const acampa = cultoId.match(/^acampa-(\w+)-(\w+)$/)
    if (acampa) {
        const dia = DIAS_ACAMPA[acampa[1]]
        const momento = MOMENTOS[acampa[2]]
        if (!dia || !momento) return null
        return { pastas: ["Acampa", dia], projeto: momento }
    }

    const data = cultoId.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!data) return null
    return { pastas: ["Alianca", data[1], MESES[Number(data[2]) - 1]], projeto: data[3] }
}

/**
 * Cria a arvore inteira de uma vez, mesmo sem conteudo:
 *
 *     Alianca/2026/01-janeiro/04, 11, 18, 25 ... ate 12-dezembro
 *     Acampa/1-sexta/1-culto-manha, 2-culto-noite, 3-brincadeiras ... 4 dias
 *
 * Antes as pastas nasciam quando o primeiro arquivo chegava, entao o painel
 * ficava cheio de buracos: so o domingo com foto aparecia. Com a arvore pronta
 * o operador encontra qualquer culto pelo calendario, tenha conteudo ou nao.
 */
function domingosDoMes(ano: number, mes: number) {
    const dias: string[] = []
    const d = new Date(ano, mes, 1)
    d.setDate(1 + ((7 - d.getDay()) % 7))
    while (d.getMonth() === mes) {
        dias.push(String(d.getDate()).padStart(2, "0"))
        d.setDate(d.getDate() + 7)
    }
    return dias
}

let pastasNoDiscoFeitas = false

function garantirEstruturaCompleta() {
    let mudou = false
    const ano = new Date().getFullYear()
    // um caminho por projeto: e o mesmo desenho que a pasta Online precisa ter
    const caminhos: string[] = []

    for (let mes = 0; mes < 12; mes++) {
        const { id: pastaMes, mudou: m1 } = garantirPastas(["Alianca", String(ano), MESES[mes]])
        mudou = mudou || m1
        for (const dia of domingosDoMes(ano, mes)) {
            const { mudou: m2 } = garantirProjeto(dia, pastaMes)
            mudou = mudou || m2
            caminhos.push(`Alianca/${ano}/${MESES[mes]}/${dia}`)
        }
    }

    for (const dia of Object.values(DIAS_ACAMPA)) {
        const { id: pastaDia, mudou: m1 } = garantirPastas(["Acampa", dia])
        mudou = mudou || m1
        for (const momento of Object.values(MOMENTOS)) {
            const { mudou: m2 } = garantirProjeto(momento, pastaDia)
            mudou = mudou || m2
            caminhos.push(`Acampa/${dia}/${momento}`)
        }
    }

    // a aba Midia navega o disco, entao a pasta precisa existir de verdade
    if (!pastasNoDiscoFeitas) {
        pastasNoDiscoFeitas = true
        sendMain(Main.ALIANCA_CRIAR_PASTAS, caminhos)
    }

    return mudou
}

const jaBaixando = new Set<string>()

async function sincronizar(cultos: { [id: string]: any }) {
    let mudou = await garantirPastasDeMidia()
    mudou = garantirEstruturaCompleta() || mudou

    for (const [cultoId, culto] of Object.entries(cultos)) {
        const itens = Object.values((culto as any)?.itens || {}) as any[]
        if (!itens.length) continue

        const partes = caminhoDoculto(cultoId)
        if (!partes) continue

        const { id: pastaId, mudou: m1 } = garantirPastas(partes.pastas)
        const { id: projetoId, mudou: m2 } = garantirProjeto(partes.projeto, pastaId)
        mudou = mudou || m1 || m2

        // ordena pela hora de envio, para o projeto seguir a ordem em que a equipe montou
        itens.sort((a, b) => (a.enviadoEm || 0) - (b.enviadoEm || 0))

        for (const item of itens) {
            if (item.tipo === "musica") {
                if (adicionarAoProjeto(projetoId, { id: item.showId, type: "show" }, item.showId)) mudou = true
                continue
            }

            const chave = `${cultoId}/${item.arquivo}/${item.enviadoEm}`
            if (jaBaixando.has(chave)) continue

            const pasta = [...partes.pastas, partes.projeto].join("/")
            const arquivo = nomeDoArquivo(item)

            jaBaixando.add(chave)
            estado.baixando++
            avisar()

            const caminhoLocal: string | null = await requestMain(Main.ALIANCA_BAIXAR, { url: item.url, pasta, arquivo })

            estado.baixando--
            jaBaixando.delete(chave)
            avisar()

            if (!caminhoLocal) continue

            const tipoProjeto = item.tipo === "image" ? "image" : item.tipo === "video" ? "video" : "audio"
            if (adicionarAoProjeto(projetoId, { id: caminhoLocal, type: tipoProjeto, name: item.nome }, caminhoLocal)) {
                media.update((a) => {
                    if (!a[caminhoLocal]) a[caminhoLocal] = {}
                    return a
                })
                mudou = true
            }
        }
    }

    if (mudou) {
        estado.ultimaSync = Date.now()
        avisar()
        setTimeout(() => save(), 1500)
    }
}

function nomeDoArquivo(item: any) {
    const extensao = (String(item.arquivo || "").match(/\.[^.]+$/) || [""])[0].toLowerCase()
    const limpo = String(item.nome || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^A-Za-z0-9 ._-]/g, "")
        .trim()
    return limpo ? limpo + extensao : String(item.arquivo || "arquivo")
}

/** devolve true se acrescentou; nunca duplica nem mexe no que o operador reordenou */
function adicionarAoProjeto(projetoId: string, ref: any, chave: string) {
    const projeto: any = get(projects)[projetoId]
    if (!projeto) return false
    if ((projeto.shows || []).some((s: any) => s.id === chave)) return false
    if (ref.type === "show" && !get(shows)[ref.id]) return false // musica que nao existe neste computador

    projects.update((a) => {
        a[projetoId].shows = [...(a[projetoId].shows || []), ref]
        return a
    })
    return true
}
