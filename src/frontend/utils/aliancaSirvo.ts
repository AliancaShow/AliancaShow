// ----- AliançaShow · ponte com o Sirvo (renderer) -----
//
// Fase F0a: o Show SÓ LÊ o roteiro do culto no Sirvo e publica, com nome fixo:
//   - o timer "sirvo_live" (tempo do bloco no ar, regressivo, com overflow);
//   - as variáveis sirvo_bloco, sirvo_proximo, sirvo_mensagem e sirvo_fim.
// Nunca cria nem edita layout de palco: qualquer layout mostra o que quiser.
// Desenho: docs/INTEGRACAO-SIRVO.md (§4, §5.1, §5.3, §7, §10, §11).
//
// A chave do Sirvo NÃO passa por aqui: mora no processo principal
// (src/electron/sirvo/sirvo.ts), que acrescenta a chave em cada chamada.
//
// Três regras que este arquivo segue de propósito:
//   1. Texto do Sirvo é HIGIENIZADO antes de virar variável (ver `limpo`): o
//      FreeShow mostra variáveis em lugares que usam {@html} (prévia de valores
//      dinâmicos), interpreta {…} como valor dinâmico e põe variáveis em CSS.
//   2. Toda resposta assíncrona confere a GERAÇÃO: desligar/religar invalida o
//      que estava em voo, e trocar de culto invalida o roteiro do culto antigo.
//   3. O timer do Sirvo só fica em `activeTimers` com o culto no ar, e sempre
//      no FIM da lista: o FreeShow usa `activeTimers[0]` como "primeiro timer
//      ativo", que deve continuar sendo o do operador.

import { get, readonly, writable } from "svelte/store"
import { STAGE } from "../../types/Channels"
import { Main } from "../../types/IPC/Main"
import type { Timer } from "../../types/Show"
import type { Variable } from "../../types/Main"
import { requestMain } from "../IPC/main"
import { activeTimers, timers, variables } from "../stores"
import { send } from "./request"
import { newToast } from "./common"
import { juntarAvisos, mereceAviso, type LinhaDeAviso, type Mudanca } from "./aliancaSirvoAvisos"

// ---------------------------------------------------------------- tipos

type Culto = { event_id: string; titulo: string; comeca_em: string; no_ar: boolean; encerrado: boolean; rev: number }
// os campos que o show_roteiro manda (servir: supabase/migrations/0079_ponte_show_leitura.sql)
export type Bloco = {
    id: string
    ordem: number
    titulo: string
    /** o tipo do bloco no Sirvo ("louvor", "palavra"...) */
    tipo: string
    /** a cor final (a do bloco, senão a do tipo), "#rrggbb" */
    cor: string
    estado: "concluido" | "no_ar" | "a_seguir" | "planejado"
    duracao_min: number
    inicio_previsto: string
    fim_previsto: string
    concluido_em: string | null
    responsavel: string | null
    nota: string | null
    link: string | null
}
export type Roteiro = {
    event_id: string
    titulo: string
    rev: number
    agora_servidor: string
    comeca_em: string
    iniciado_em: string | null
    encerrado_em: string | null
    bloco_no_ar: string | null
    fim_previsto: string
    /** começo + soma das durações, sem os atrasos */
    fim_planejado: string
    blocos: Bloco[]
    mensagem_palco: { id: string; texto: string; ate: string } | null
    mudancas?: Mudanca[]
    /** a chave deste Show pode conduzir (F2, migration 0081 do Sirvo) */
    pode_conduzir?: boolean
}
// os dois lados declaram todos os campos: o tsconfig do Show não é strict e não estreita a união por `ok`
type Resposta = { ok: true; dados: any; codigo?: undefined } | { ok: false; codigo: string; mensagem: string; dados?: undefined }

export type EstadoSirvo = {
    status: "sem_chave" | "conectando" | "conectado" | "caido" | "chave_invalida"
    cultos: Culto[]
    cultoId: string | null
    cultoTitulo: string
    escolhaManual: string | null
    ultimaResposta: number
    /** última resposta boa de show_rev/show_roteiro (não da lista de cultos): é a idade DELA que diz se o roteiro está vivo */
    ultimoRoteiroOk: number
    /** o culto seguido já começou e não terminou, segundo o roteiro */
    roteiroNoAr: boolean
    roteiroEncerrado: boolean
    /** F2: a chave conduz (lido a cada show_rev — o admin pode desligar no meio do culto) */
    podeConduzir: boolean
    /** F2: um pedido ao Sirvo está em voo (os botões ficam parados até o rev voltar) */
    enviando: boolean
}

// ---------------------------------------------------------------- nomes fixos
// O FreeShow acha variável e timer pelo NOME (getVariableNameId: minúsculas,
// espaço vira "_"). Por isso o nome é o próprio identificador.

export const TIMER_SIRVO = "sirvo_live"
const VARIAVEIS = ["sirvo_bloco", "sirvo_proximo", "sirvo_mensagem", "sirvo_fim"]

// ---------------------------------------------------------------- estado

export const sirvo = writable<EstadoSirvo>({ status: "sem_chave", cultos: [], cultoId: null, cultoTitulo: "", escolhaManual: null, ultimaResposta: 0, ultimoRoteiroOk: 0, roteiroNoAr: false, roteiroEncerrado: false, podeConduzir: false, enviando: false })
// nome do bloco no ar, para o controle do timer ao lado da prévia ("" fora do culto)
export const sirvoBlocoNoAr = writable("")

let roteiro: Roteiro | null = null
// O roteiro aceito, para quem monta o projeto do culto (F0b): o mesmo objeto de
// `roteiro`, depois das mesmas conferências de geração e de rev; null sem
// roteiro. Só leitura para fora. É anunciado no FIM de cada passada (`anunciar`),
// depois do palco e do aviso: quem assina vê o estado já coerente e não atrasa o
// palco. Quem assina não pode lançar erro: o `set` do Svelte roda os assinantes
// ali mesmo, e um erro no meio deixa a fila de stores do app inteiro travada.
const roteiroAceito = writable<Roteiro | null>(null)
export const sirvoRoteiro = readonly(roteiroAceito)
let revVisto = -1
let msgVista: string | null = null
let desvioMs: number | null = null // relógio do Sirvo − relógio deste PC
let geracao = 0 // sobe a cada ligar/parar; resposta de geração velha é descartada
let timerRev: ReturnType<typeof setTimeout> | null = null
let timerCultos: ReturnType<typeof setInterval> | null = null
let timerTick: ReturnType<typeof setInterval> | null = null
let cultosEmVoo: { g: number; p: Promise<void> } | null = null

const agora = () => Date.now() + (desvioMs || 0)
/** o relógio do Sirvo (o do PC corrigido pelo desvio medido) */
export const sirvoAgora = agora
const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN)

function anunciar() {
    if (get(roteiroAceito) !== roteiro) roteiroAceito.set(roteiro)
}

/** Texto externo → texto seguro para variável do FreeShow (sem HTML, sem {…}). */
function limpo(t: string | null | undefined): string {
    return (t || "")
        .replace(/</g, "‹")
        .replace(/>/g, "›")
        .replace(/\{/g, "(")
        .replace(/\}/g, ")")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .slice(0, 200)
}

function atualizar(parcial: Partial<EstadoSirvo>) {
    sirvo.update((e) => ({ ...e, ...parcial }))
}

/** Chama o Sirvo pelo main. Devolve null se a ponte foi desligada/religada no meio. */
async function chamar(funcao: "show_cultos" | "show_rev" | "show_roteiro", args: { [key: string]: any } = {}): Promise<Resposta | null> {
    const g = geracao
    const antes = Date.now()
    const r = ((await requestMain(Main.SIRVO_CHAMAR, { funcao, args })) as Resposta | undefined) || { ok: false, codigo: "rede", mensagem: "" }
    const depois = Date.now()
    if (g !== geracao) return null

    if (r.ok) {
        // Desvio pelo ponto médio da viagem, suavizado: o jitter de cada
        // resposta não pode fazer o número do palco pular ou voltar 1 s.
        const servidor = ms(r.dados?.agora_servidor)
        if (!isNaN(servidor) && depois - antes < 2_000) {
            const novo = servidor - (antes + depois) / 2
            desvioMs = desvioMs === null || Math.abs(novo - desvioMs) > 5_000 ? novo : desvioMs * 0.8 + novo * 0.2
        }
        atualizar(funcao === "show_cultos" ? { status: "conectado", ultimaResposta: depois } : { status: "conectado", ultimaResposta: depois, ultimoRoteiroOk: depois })
    } else if (r.codigo === "chave_invalida" || r.codigo === "sem_chave") {
        // Chave revogada no meio do culto: o palco não pode ficar com dado velho.
        parar()
        zerar()
        atualizar({ status: r.codigo === "sem_chave" ? "sem_chave" : "chave_invalida" })
        return null
    } else if (r.codigo !== "culto_inexistente") {
        // sem internet: o timer segue pelo último estado conhecido (§10)
        atualizar({ status: "caido" })
    }
    return r
}

// ---------------------------------------------------------------- ciclos

/** Qual culto seguir: o escolhido à mão; senão o que está no ar; senão o mais perto de agora. */
function escolherCulto(cultos: Culto[], manual: string | null): Culto | null {
    if (manual) {
        const m = cultos.find((c) => c.event_id === manual)
        if (m) return m
    }
    const noAr = cultos.find((c) => c.no_ar)
    if (noAr) return noAr
    const t = agora()
    return [...cultos].sort((a, b) => Math.abs(ms(a.comeca_em) - t) - Math.abs(ms(b.comeca_em) - t))[0] || null
}

/**
 * Uma busca da lista por vez: quem chamar durante uma em voo espera a mesma.
 * A busca é da GERAÇÃO em que nasceu: depois de religar, a velha (que vai
 * voltar vazia) não serve, e nasce outra.
 */
function cicloCultos(): Promise<void> {
    if (!cultosEmVoo || cultosEmVoo.g !== geracao) {
        const g = geracao
        const p = buscarCultos().finally(() => {
            if (cultosEmVoo?.p === p) cultosEmVoo = null
        })
        cultosEmVoo = { g, p }
    }
    return cultosEmVoo.p
}

async function buscarCultos() {
    const r = await chamar("show_cultos")
    if (!r?.ok) return
    const cultos: Culto[] = Array.isArray(r.dados) ? r.dados : []
    const alvo = escolherCulto(cultos, get(sirvo).escolhaManual)
    const novoId = alvo?.event_id || null
    atualizar({ cultos, cultoId: novoId, cultoTitulo: alvo?.titulo || "" })
    if (novoId !== (roteiro?.event_id || null)) {
        roteiro = null
        revVisto = -1
        msgVista = null
        publicar()
        limparAvisos()
        atualizar({ roteiroNoAr: false, roteiroEncerrado: false })
        anunciar()
        if (novoId) {
            // o culto novo decide pelo que ficou guardado (com prazo), não por uma memória de dias atrás
            vistoEmMemoria.delete(novoId)
            await buscarRoteiro(novoId)
        }
    }
}

async function buscarRoteiro(eventId: string) {
    const r = await chamar("show_roteiro", { p_event: eventId })
    if (!r) return
    // trocaram de culto enquanto esta resposta viajava: ela não vale mais
    if (get(sirvo).cultoId !== eventId) return
    if (r.ok) {
        const novo = r.dados as Roteiro
        // duas buscas do mesmo culto podem cruzar (troca de culto + ciclo do rev):
        // a mais velha chegando depois voltaria o palco para trás. O rev só sobe.
        if (roteiro && roteiro.event_id === novo.event_id && Number(novo.rev) < Number(roteiro.rev)) return
        roteiro = novo
        revVisto = roteiro.rev
        msgVista = roteiro.mensagem_palco?.id || null
        publicar()
        atualizar({ roteiroNoAr: !!roteiro.iniciado_em && !roteiro.encerrado_em, roteiroEncerrado: !!roteiro.encerrado_em, podeConduzir: roteiro.pode_conduzir === true })
        // depois do palco, e isolado: um erro no aviso não pode parar o roteiro
        try {
            processarAvisos(roteiro)
        } catch (erro) {
            console.error("Sirvo: falha ao montar o aviso de mudança", erro)
        }
        anunciar()
    } else if (r.codigo === "culto_inexistente") {
        roteiro = null
        publicar()
        atualizar({ roteiroNoAr: false, roteiroEncerrado: false })
        anunciar()
        await cicloCultos()
    }
}

/**
 * 2 s com o culto no ar e na janela em volta do horário (1 h antes até 2 h
 * depois — culto que começa atrasado ainda não está "no ar"); 30 s fora (§5.3).
 */
export function intervaloRev(): number {
    const e = get(sirvo)
    const culto = e.cultos.find((c) => c.event_id === e.cultoId)
    if (!culto) return 30_000
    if (culto.no_ar || (roteiro?.iniciado_em && !roteiro?.encerrado_em)) return 2_000
    const falta = ms(culto.comeca_em) - agora()
    return falta <= 3_600_000 && falta >= -7_200_000 ? 2_000 : 30_000
}

async function cicloRev(g: number) {
    if (g !== geracao) return
    try {
        const e = get(sirvo)
        if (e.cultoId) {
            const caidoAntes = e.status === "caido"
            const r = await chamar("show_rev", { p_event: e.cultoId })
            if (g !== geracao) return
            if (r?.ok) {
                const msgId = r.dados?.msg_id || null
                const pode = r.dados?.pode_conduzir === true
                if (pode !== get(sirvo).podeConduzir) atualizar({ podeConduzir: pode })
                // na volta da conexão, busca o roteiro inteiro de qualquer jeito (§5.3)
                if (caidoAntes || r.dados?.rev !== revVisto || msgId !== msgVista) await buscarRoteiro(e.cultoId)
            } else if (r?.codigo === "culto_inexistente") {
                await cicloCultos()
            }
        }
    } catch (erro) {
        console.error("Sirvo: falha no ciclo do roteiro", erro)
    } finally {
        // SEMPRE reagenda: sem isto, um erro qualquer congelava o roteiro até o fim do culto
        if (g === geracao) timerRev = setTimeout(() => cicloRev(g), intervaloRev())
    }
}

// ---------------------------------------------------------------- relógio e publicação

const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
const hora = (t: number) => (isNaN(t) ? "" : fmtHora.format(new Date(t)))

type Palco = { noAr: boolean; segundos: number; bloco: string; proximo: string; mensagem: string; fim: string }

/** O que vai para o palco agora. Só o estouro do bloco no ar anda com o relógio (§5.1). */
function calcular(): Palco {
    const t = agora()
    const msg = roteiro?.mensagem_palco
    const mensagem = msg && ms(msg.ate) > t ? limpo(msg.texto) : ""
    const vazio: Palco = { noAr: false, segundos: 0, bloco: "", proximo: "", mensagem, fim: "" }
    if (!roteiro || roteiro.encerrado_em) return vazio

    // Antes de iniciar: o que vem primeiro e a hora prevista de terminar.
    if (!roteiro.iniciado_em) {
        const primeiro = roteiro.blocos.find((b) => b.estado !== "concluido")
        return { ...vazio, proximo: limpo(primeiro?.titulo), fim: hora(ms(roteiro.fim_previsto)) }
    }

    const i = roteiro.blocos.findIndex((b) => b.id === roteiro!.bloco_no_ar)
    const bloco = roteiro.blocos[i]
    if (!bloco) return { ...vazio, fim: hora(ms(roteiro.fim_previsto)) } // todos concluídos

    const fimBloco = ms(bloco.fim_previsto)
    if (isNaN(fimBloco)) return vazio
    const estouro = Math.max(0, t - fimBloco)
    const proximo = roteiro.blocos.slice(i + 1).find((b) => b.estado !== "concluido")
    const restante = fimBloco - t
    return {
        noAr: true,
        // como o contador do Sirvo web: trunca em direção ao zero; negativo = estourou
        segundos: Math.trunc(restante / 1000),
        bloco: limpo(bloco.titulo),
        proximo: limpo(proximo?.titulo),
        mensagem,
        fim: hora(ms(roteiro.fim_previsto) + estouro)
    }
}

function garantirTimerEVariaveis() {
    const existe = Object.values(get(timers)).some((t) => t.type === "sirvo_live")
    if (!existe && !get(timers)[TIMER_SIRVO]) {
        timers.update((a) => {
            a[TIMER_SIRVO] = { name: "sirvo_live", type: "sirvo_live", overflow: true, overflowColor: "#FF4136" } as Timer
            return a
        })
    }
    const atuais = get(variables)
    const faltando = VARIAVEIS.filter((id) => !atuais[id])
    if (faltando.length) {
        variables.update((a) => {
            faltando.forEach((id) => (a[id] = { name: id, type: "text", text: "", enabled: true } as Variable))
            return a
        })
    }
}

/** Escreve só o que mudou: variável vai para disco e para palco/saída/remote a cada escrita. */
function escreverVariaveis(valores: { [id: string]: string }) {
    const atuais = get(variables)
    const mudou = Object.entries(valores).filter(([id, v]) => atuais[id] && (atuais[id].text || "") !== v)
    if (!mudou.length) return
    variables.update((a) => {
        mudou.forEach(([id, v]) => (a[id] = { ...a[id], text: v }))
        return a
    })
}

function publicar() {
    const c = calcular()
    const timer = get(timers)[TIMER_SIRVO]
    const antes = get(activeTimers)
    const tinha = antes.some((x) => x.sirvoLive)

    if (c.noAr) {
        const valor = c.segundos < 0 && !timer?.overflow ? 0 : c.segundos
        activeTimers.update((a) => [...a.filter((x) => !x.sirvoLive), { id: TIMER_SIRVO, currentTime: valor, start: 0, end: 0, paused: false, sirvoLive: true }])
        send(STAGE, ["ACTIVE_TIMERS"], get(activeTimers))
    } else if (tinha) {
        activeTimers.update((a) => a.filter((x) => !x.sirvoLive))
        send(STAGE, ["ACTIVE_TIMERS"], get(activeTimers))
    }

    escreverVariaveis({ sirvo_bloco: c.bloco, sirvo_proximo: c.proximo, sirvo_mensagem: c.mensagem, sirvo_fim: c.fim })
    const bloco = c.noAr ? c.bloco : ""
    if (get(sirvoBlocoNoAr) !== bloco) sirvoBlocoNoAr.set(bloco)
}

/** Tira o Sirvo do palco (timer fora, variáveis vazias). */
function zerar() {
    roteiro = null
    revVisto = -1
    msgVista = null
    publicar()
    limparAvisos()
    atualizar({ roteiroNoAr: false, roteiroEncerrado: false })
    anunciar()
}

// ---------------------------------------------------------------- aviso "o roteiro mudou"
//
// O que já existia quando o Show viu o culto pela primeira vez conta como
// visto: o aviso é sobre o que muda daqui pra frente. A rev vista é por culto,
// só SOBE, e fica guardada com prazo: reabrir o Show minutos depois (no meio do
// culto) mostra o que mudou enquanto ele estava fechado; reabrir dias depois
// não acorda com o ensaio de sábado.

export type AvisosSirvo = { linhas: LinhaDeAviso[]; anteriores: boolean; desde: number }
export const sirvoAvisos = writable<AvisosSirvo>({ linhas: [], anteriores: false, desde: 0 })

const CHAVE_VISTAS = "aliancashow:sirvo-mudancas-vistas"
const PRAZO_VISTA_MS = 6 * 3_600_000
const DESCARTE_VISTA_MS = 30 * 86_400_000
const LISTA_CHEIA = 20 // o Sirvo manda as últimas 20

const vistoEmMemoria = new Map<string, number>()
let pendentes: Mudanca[] = []
let anterioresPendentes = false

function lerVistas(): { [ev: string]: { rev: number; em: number } } {
    try {
        const v = JSON.parse(localStorage.getItem(CHAVE_VISTAS) || "{}")
        return v && typeof v === "object" ? v : {}
    } catch {
        return {}
    }
}

function vistoGuardado(ev: string): number | null {
    const v = lerVistas()[ev]
    if (!v || !Number.isFinite(v.rev) || Date.now() - v.em > PRAZO_VISTA_MS) return null
    return v.rev
}

function guardarVisto(ev: string, rev: number) {
    try {
        const todas = lerVistas()
        const agoraMs = Date.now()
        for (const k of Object.keys(todas)) if (agoraMs - (todas[k]?.em || 0) > DESCARTE_VISTA_MS) delete todas[k]
        todas[ev] = { rev, em: agoraMs }
        localStorage.setItem(CHAVE_VISTAS, JSON.stringify(todas))
    } catch {
        // sem localStorage o aviso só não sobrevive a reabrir o Show
    }
}

function limparAvisos() {
    pendentes = []
    anterioresPendentes = false
    const a = get(sirvoAvisos)
    if (a.linhas.length || a.anteriores) sirvoAvisos.set({ linhas: [], anteriores: false, desde: 0 })
}

/** "Ok, vi". */
export function dispensarAvisosSirvo() {
    limparAvisos()
}

function processarAvisos(r: Roteiro) {
    const ev = r.event_id
    const lista = (Array.isArray(r.mudancas) ? r.mudancas : []).filter((m) => Number.isFinite(Number(m?.rev)))
    const topo = lista.reduce((mx, m) => Math.max(mx, Number(m.rev)), 0)

    let visto = vistoEmMemoria.get(ev)
    if (visto === undefined) {
        const guardado = vistoGuardado(ev)
        // nunca viu (ou faz tempo): tudo que existe conta como visto.
        // Guardado acima do topo só com dado corrompido: recomeça do topo.
        visto = guardado === null || guardado > topo ? topo : guardado
    }
    const desde = visto
    // a rev vista só sobe
    const novoVisto = Math.max(desde, topo)
    vistoEmMemoria.set(ev, novoVisto)
    guardarVisto(ev, novoVisto)
    if (topo <= desde) return

    const novas = lista
        .filter((m) => Number(m.rev) > desde)
        .sort((a, b) => Number(a.rev) - Number(b.rev))
        .filter((m) => mereceAviso(m, r.blocos, r.iniciado_em, r.encerrado_em))
    // lista cheia e a rev vista ficou antes do começo dela: teve mudança que não chegou até aqui
    const menor = lista.reduce((mn, m) => Math.min(mn, Number(m.rev)), Infinity)
    const anteriores = lista.length >= LISTA_CHEIA && desde < menor - 1
    if (!novas.length && !anteriores) return

    pendentes = [...pendentes, ...novas]
    anterioresPendentes = anterioresPendentes || anteriores
    sirvoAvisos.set({ linhas: juntarAvisos(pendentes, r.blocos), anteriores: anterioresPendentes, desde: Date.now() })
}

// ---------------------------------------------------------------- liga / desliga

function parar() {
    geracao++
    if (timerRev) clearTimeout(timerRev)
    if (timerCultos) clearInterval(timerCultos)
    if (timerTick) clearInterval(timerTick)
    timerRev = timerCultos = timerTick = null
}

async function ligar() {
    parar()
    const g = geracao
    atualizar({ status: "conectando" })
    garantirTimerEVariaveis()
    await cicloCultos()
    if (g !== geracao) return // desligado, religado ou chave recusada no meio
    timerCultos = setInterval(cicloCultos, 60_000)
    timerTick = setInterval(publicar, 1_000)
    timerRev = setTimeout(() => cicloRev(g), intervaloRev())
}

/** Na inicialização: liga sozinho se já houver chave guardada. */
export async function iniciarSirvo() {
    const tem = await requestMain(Main.SIRVO_TEM_CHAVE)
    if (tem) ligar()
}

export async function salvarChaveSirvo(chave: string): Promise<string | null> {
    const r = await requestMain(Main.SIRVO_SALVAR_CHAVE, { chave })
    if (!r?.ok) return r?.erro || "Não consegui guardar a chave."
    await ligar()
    return null
}

export async function desconectarSirvo() {
    parar()
    zerar()
    atualizar({ status: "sem_chave", cultos: [], cultoId: null, cultoTitulo: "", escolhaManual: null, ultimaResposta: 0, ultimoRoteiroOk: 0, podeConduzir: false, enviando: false })
    await requestMain(Main.SIRVO_APAGAR_CHAVE)
}

/** O operador escolhe o culto à mão (null = volta ao automático). */
export function escolherCultoSirvo(eventId: string | null) {
    atualizar({ escolhaManual: eventId })
    // se houver uma busca em voo, ela leu a escolha antiga: busca de novo depois dela
    if (timerTick) (cultosEmVoo?.p || Promise.resolve()).then(() => cicloCultos())
}

// ---------------------------------------------------------------- F2: o Show pede
//
// O Show PEDE; o Sirvo decide; o resultado chega pela mesma busca do roteiro
// (SHOW-DESIGN.md §13 no repo do Sirvo). Nada é aplicado aqui antes da resposta.
// Depois do pedido, o roteiro é buscado NA HORA (não espera o ciclo de 2 s), e
// a montagem aplica o próprio pedido até o rev que o Sirvo devolveu mesmo com
// o culto no ar (`sirvoForcarAte`): a pendência existe para a mudança ALHEIA.

export type FuncaoDeEscrita = "show_iniciar" | "show_encerrar" | "show_reabrir" | "show_avancar" | "show_desfazer_bloco" | "show_ajustar_duracao" | "show_mover_bloco" | "show_criar_bloco" | "show_apagar_bloco" | "show_editar_bloco"
export type RespostaPedido = { ok: true; dados: any } | { ok: false; mensagem: string }

const forcarAte = new Map<string, number>()
// A montagem diz se há uma ordem ALHEIA esperando "Aplicar" (registrada por
// aliancaSirvoMontar, que importa este módulo: assim não há import circular).
let haPendencia: (eventId: string) => boolean = () => false
export function registrarPendenciaSirvo(fn: (eventId: string) => boolean) {
    haPendencia = fn
}
const MUDA_ORDEM = new Set<FuncaoDeEscrita>(["show_mover_bloco", "show_criar_bloco", "show_apagar_bloco"])
/** Até que rev a montagem deste culto aplica a ordem mesmo no momento protegido. */
export function sirvoForcarAte(eventId: string): number {
    return forcarAte.get(eventId) ?? -1
}

/** Por que o Show não pode pedir agora ("" = pode). */
export function porQueNaoConduz(e: EstadoSirvo = get(sirvo)): string {
    if (e.status === "sem_chave" || e.status === "chave_invalida") return "Sem chave do Sirvo."
    if (!e.cultoId) return "Nenhum culto do Sirvo sendo seguido."
    if (e.status !== "conectado") return "Sem Sirvo agora — mexa no roteiro pela régia."
    if (!e.podeConduzir) return "Esta chave só lê o roteiro. Um admin liga “conduz” no Sirvo (Perfil → chaves do AliançaShow)."
    if (e.enviando) return "Esperando o Sirvo responder…"
    return ""
}

export async function pedirAoSirvo(funcao: FuncaoDeEscrita, args: { [key: string]: any }): Promise<RespostaPedido> {
    const e = get(sirvo)
    const motivo = porQueNaoConduz(e)
    if (motivo) return { ok: false, mensagem: motivo }
    const eventId = e.cultoId!
    const g = geracao
    // Com uma ordem alheia já esperando "Aplicar", forçar o rev do pedido
    // aplicaria a alheia junto, sem ninguém aplicar. Aí o pedido vale no Sirvo
    // e entra no projeto com o próximo "Aplicar", como a outra.
    const pendiaAntes = haPendencia(eventId)
    atualizar({ enviando: true })
    try {
        const r = ((await requestMain(Main.SIRVO_CHAMAR, { funcao, args })) as Resposta | undefined) || { ok: false, codigo: "rede", mensagem: "Sem conexão com o Sirvo." }
        if (g !== geracao) return { ok: false, mensagem: "A conexão com o Sirvo foi refeita. Confira e tente de novo." }
        const rev = Number(r.ok ? r.dados?.rev : NaN)
        if (Number.isFinite(rev) && !pendiaAntes) forcarAte.set(eventId, Math.max(sirvoForcarAte(eventId), rev))
        // sucesso, recusa ou dúvida: quem diz o estado de verdade é o roteiro
        if (get(sirvo).cultoId === eventId) await buscarRoteiro(eventId)
        if (r.ok) {
            if (pendiaAntes && MUDA_ORDEM.has(funcao)) newToast("Feito no Sirvo. A ordem nova entra no projeto quando você aplicar.")
            return { ok: true, dados: r.dados }
        }
        if (r.codigo === "chave_invalida") return { ok: false, mensagem: "A chave do Sirvo foi recusada." }
        return { ok: false, mensagem: r.mensagem || "O Sirvo não aceitou." }
    } finally {
        // sempre: se a conexão foi refeita no meio, ninguém mais zeraria e os
        // botões ficariam presos em "Esperando o Sirvo responder…"
        atualizar({ enviando: false })
    }
}
