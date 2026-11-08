// ----- AliançaShow · o projeto do culto recebe o roteiro do Sirvo (F0b, passo 4) -----
//
// Liga a decisão (aliancaSirvoMontagem.ts) e a conta (aliancaSirvoProjeto.ts)
// aos stores: acha, cria e liga o projeto do culto seguido, monta os blocos e
// mantém o projeto ligado em dia. Desenho: desenho-f0b-montar-projeto.md,
// §2.3, §2.5, §2.6 e as "Decisões do André".
//
// Regras deste arquivo:
//   - Cada passada é SÍNCRONA: lê `get(projects)`, decide, reconcilia e
//     escreve sem nenhum `await` no meio. Nada de guardar lista ou objeto para
//     aplicar depois: a nuvem troca todos os objetos.
//   - A escrita NÃO passa pelo `history`: não entra no Ctrl+Z do operador. Um
//     Ctrl+Z que desfaz o que o Sirvo pôs é curado na passada seguinte.
//   - Só escreve quando algo mudou (a conta é idempotente): a própria escrita
//     volta como "nada a fazer" e não forma laço.
//   - Nunca roda sem roteiro aceito do culto seguido.
//   - Até existir o passo 6 (remapear a saída), a ORDEM do projeto não muda
//     com o culto no ar ou com algo na tela (ver `protegido`): só os campos. A ordem nova
//     fica pendente e a faixa avisa. Nada pula debaixo da mão do operador.

import { get, writable } from "svelte/store"
import { uid } from "uid"
import type { ProjectShowRef } from "../../types/Projects"
import { activeFocus, activeProject, activeShow, contextActive, folders, loaded, outputs, projects, selected, special } from "../stores"
import { garantirPastas } from "./aliancaPastas"
import { sirvo, sirvoRoteiro, type Roteiro } from "./aliancaSirvo"
import { decidirProjeto, soltarDoSirvo, type MotivoPergunta } from "./aliancaSirvoMontagem"
import { papelDoItem, reconciliar, type MotivoPendente } from "./aliancaSirvoProjeto"
import { getAccess } from "./profile"

export type EstadoMontagem = {
    /** o projeto em que a faixa aparece (só quando ele está aberto) */
    projetoId: string | null
    situacao: "nenhuma" | "perguntar" | "varios_no_dia" | "ligado"
    motivo: MotivoPergunta | null
    eventId: string | null
    titulo: string
    blocos: number
    quantosNoDia: number
    /** o culto ao qual o projeto já está ligado (motivo "outro_culto"), se o Show o conhece */
    outroCulto: string
    /** a ordem nova não foi aplicada (só com situacao "ligado") */
    pendente: MotivoPendente | null
    sumiram: number
    /** culto no ar ou algo na tela, com este projeto aberto: a ordem não muda agora */
    protegido: boolean
}

const VAZIO: EstadoMontagem = { projetoId: null, situacao: "nenhuma", motivo: null, eventId: null, titulo: "", blocos: 0, quantosNoDia: 0, outroCulto: "", pendente: null, sumiram: 0, protegido: false }
export const sirvoMontagem = writable<EstadoMontagem>(VAZIO)

const CHAVE_MEMORIA = "aliancaSirvoMontados"

// "Agora não" / "Entendi" / Desligar: a faixa some até o Show reabrir (culto + projeto)
const dispensados = new Set<string>()
const chaveDispensa = (eventId: string, projetoId: string) => `${eventId}|${projetoId}`

// ---------------------------------------------------------------- memória "já montei este culto"
// Fica no `special`, que o FreeShow salva junto com as configurações.

function lerMontados(): { [eventId: string]: string } {
    const m = get(special)?.[CHAVE_MEMORIA]
    return m && typeof m === "object" ? m : {}
}

function lembrarMontado(eventId: string, projetoId: string) {
    if (lerMontados()[eventId] === projetoId) return
    special.update((a) => {
        a[CHAVE_MEMORIA] = { ...(a[CHAVE_MEMORIA] || {}), [eventId]: projetoId }
        return a
    })
}

// ---------------------------------------------------------------- o que está no ar

/** as saídas que mostram slide ou fundo (a de palco não conta) */
function saidasComAlgo(): any[] {
    return Object.values(get(outputs) || {}).filter((o: any) => o && o.enabled && !o.stageOutput && (o.out?.slide || o.out?.background))
}

/**
 * Momento protegido: a ORDEM deste projeto não muda agora.
 *   - o culto seguido está no ar no Sirvo (aberto ou não: é o projeto dele); ou
 *   - há algo na tela e este projeto está aberto; ou
 *   - há na tela um slide que guardou a posição de um item de projeto
 *     (`projectIndex`): não dá para saber de qual projeto ele veio, e o
 *     "próximo" usa essa posição sem conferir o id (OutputHelper).
 */
function protegido(projetoId: string) {
    if (get(sirvo).roteiroNoAr) return true
    const naTela = saidasComAlgo()
    if (!naTela.length) return false
    return get(activeProject) === projetoId || naTela.some((o) => typeof o.out?.slide?.projectIndex === "number")
}

/** posições usadas por um ponteiro vivo neste projeto: o cabeçalho ativo nunca sai */
function ativosNo(projetoId: string): number[] {
    if (get(activeProject) !== projetoId) return []
    const posicoes = [get(activeShow)?.index, get(activeFocus)?.index]
    Object.values(get(outputs) || {}).forEach((o: any) => posicoes.push(o?.out?.slide?.projectIndex))
    return posicoes.filter((i): i is number => typeof i === "number" && i >= 0)
}

// Durante um arrasto a ordem espera: o "soltar" usa a posição de quando começou.
// O arrasto é HTML5, e o Chromium não manda mouseup depois do drop (§2.5).
let arrastando = false
let arrastoTimer: ReturnType<typeof setTimeout> | null = null
function fimDoArrasto() {
    if (!arrastando) return
    arrastando = false
    if (arrastoTimer) clearTimeout(arrastoTimer)
    agendar(300)
}

// ---------------------------------------------------------------- escrita

/**
 * Escreve no store numa passada só, fora do history. Com a ordem mudada (só
 * fora do momento protegido), o item ativo e o foco seguem o MESMO objeto, e a
 * seleção e o menu de contexto do projeto são fechados.
 */
function escrever(projetoId: string, antes: ProjectShowRef[], depois: ProjectShowRef[], extra: { ligar?: { eventId: string } } = {}) {
    const estrutura = depois !== antes
    const aberto = get(activeProject) === projetoId
    const mostrado = aberto ? antes[get(activeShow)?.index ?? -1] : undefined
    const focado = aberto ? antes[get(activeFocus)?.index ?? -1] : undefined

    projects.update((a) => {
        const p = a[projetoId]
        if (!p) return a
        p.shows = [...depois]
        if (extra.ligar) p.sirvo = { eventId: extra.ligar.eventId, montadoEm: Date.now() }
        p.modified = Date.now()
        return a
    })

    if (!estrutura || !aberto) return
    const novoMostrado = mostrado ? depois.indexOf(mostrado) : -1
    if (novoMostrado >= 0 && novoMostrado !== get(activeShow)?.index) activeShow.update((s) => (s ? { ...s, index: novoMostrado } : s))
    const novoFocado = focado ? depois.indexOf(focado) : -1
    if (novoFocado >= 0 && novoFocado !== get(activeFocus)?.index) activeFocus.update((f) => ({ ...f, index: novoFocado }))
    if (get(selected)?.id === "show") selected.set({ id: null, data: [] })
    if (get(contextActive)) contextActive.set(false)
}

// trava contra laço: se a conta deixar de ser idempotente, o Show não reescreve o projeto a cada segundo
let escritasSeguidas = 0
let ultimaEscrita = 0
function podeEscrever() {
    const agora = Date.now()
    escritasSeguidas = agora - ultimaEscrita < 3_000 ? escritasSeguidas + 1 : 1
    ultimaEscrita = agora
    if (escritasSeguidas <= 5) return true
    if (escritasSeguidas === 6) console.error("Sirvo: o projeto do culto mudou a cada passada; paro de escrever até ele ficar quieto")
    return false
}

// ---------------------------------------------------------------- a passada

type Pedido = { montar?: string; forcar?: string }

/** liga o projeto a este culto e monta os blocos (projeto vazio, ou o operador apertou Montar) */
function ligarEMontar(projetoId: string, r: Roteiro): string | null {
    const projeto = get(projects)[projetoId]
    if (!projeto) return "O projeto não existe mais."
    const itens = projeto.shows || []
    // Sem cabeçalho do Sirvo no projeto, a montagem só ACRESCENTA no fim (o que
    // era do operador fica todo no topo): nenhuma posição muda, nem no ar. Com
    // cabeçalhos de outro culto, ela mexeria na ordem: só fora do culto.
    if (protegido(projetoId) && itens.some((i) => papelDoItem(i))) return "Com o culto no ar ou algo na tela, este projeto não pode ser remontado agora. Limpe a tela e tente de novo."
    const res = reconciliar(itens, r.blocos, { ativos: ativosNo(projetoId), forcar: true, comecaEm: r.comeca_em })
    escrever(projetoId, itens, res.itens, { ligar: { eventId: r.event_id } })
    lembrarMontado(r.event_id, projetoId)
    dispensados.delete(chaveDispensa(r.event_id, projetoId))
    return null
}

/** o projeto já ligado: campos sempre; ordem só fora do momento protegido e fora de um arrasto */
function atualizarLigado(projetoId: string, r: Roteiro, forcar: boolean) {
    const itens = get(projects)[projetoId]?.shows || []
    const prot = protegido(projetoId)
    const res = reconciliar(itens, r.blocos, { ativos: ativosNo(projetoId), protegido: prot, forcar, comecaEm: r.comeca_em })

    let depois = res.itens
    let pendente = res.motivo
    if (res.mudouEstrutura && (prot || (arrastando && get(activeProject) === projetoId))) {
        // passo 6 (remapear saída e próximo) ainda não existe: nem "depois do que está no ar" muda sozinho
        depois = itens
        pendente = prot ? "no_ar" : null // no arrasto, tenta de novo no dragend
    }

    // a conta já mexeu nos objetos (campos, lápide, duplicata): grava mesmo com a ordem pendente
    if ((res.mudouCampos || depois !== itens) && podeEscrever()) escrever(projetoId, itens, depois)

    return { pendente, sumiram: res.sumiram, protegido: prot }
}

function passada(pedido: Pedido = {}): string | null {
    if (!get(loaded)) return null
    const e = get(sirvo)
    const r = get(sirvoRoteiro)
    if (!r || !e.cultoId || r.event_id !== e.cultoId || !Array.isArray(r.blocos)) {
        publicar(VAZIO)
        return null
    }
    // perfil sem permissão de editar projetos: o Show não escreve nada
    if (getAccess("projects")?.global === "read") {
        publicar(VAZIO)
        return null
    }

    const base: EstadoMontagem = { ...VAZIO, eventId: r.event_id, titulo: r.titulo || e.cultoTitulo || "", blocos: r.blocos.length }
    const decisao = decidirProjeto({ eventId: r.event_id, comecaEm: r.comeca_em, blocos: r.blocos.length, cultos: e.cultos, projetos: get(projects), pastas: get(folders), montados: lerMontados() })

    switch (decisao.acao) {
        case "nada":
            publicar(base)
            return null

        case "varios_no_dia": {
            const visivel = decisao.projetoId && !dispensados.has(chaveDispensa(r.event_id, decisao.projetoId))
            publicar(visivel ? { ...base, projetoId: decisao.projetoId, situacao: "varios_no_dia", quantosNoDia: decisao.quantos } : base)
            return pedido.montar ? "Há mais de um culto neste dia: a montagem automática ainda não cobre esse caso." : null
        }

        case "criar": {
            // a lista vem pronta da conta: o projeto nasce montado, numa escrita só
            const pasta = garantirPastas(decisao.pastas).id
            const id = uid()
            const itens = reconciliar([], r.blocos, { forcar: true, comecaEm: r.comeca_em }).itens
            projects.update((a) => {
                a[id] = { name: decisao.nome, parent: pasta, created: Date.now(), modified: Date.now(), shows: itens, sirvo: { eventId: r.event_id, montadoEm: Date.now() } }
                return a
            })
            lembrarMontado(r.event_id, id)
            publicar({ ...base, projetoId: id, situacao: "ligado" })
            return null
        }

        case "montar": {
            const erro = ligarEMontar(decisao.projetoId, r)
            publicar({ ...base, projetoId: decisao.projetoId, situacao: erro ? "nenhuma" : "ligado" })
            return erro
        }

        case "perguntar": {
            const id = decisao.projetoId
            if (pedido.montar === id) {
                const erro = ligarEMontar(id, r)
                if (!erro) {
                    publicar({ ...base, projetoId: id, situacao: "ligado" })
                    return null
                }
                publicarPergunta(base, id, decisao.motivo)
                return erro
            }
            publicarPergunta(base, id, decisao.motivo)
            return null
        }

        case "reconciliar": {
            const id = decisao.projetoId
            const res = atualizarLigado(id, r, pedido.forcar === id)
            lembrarMontado(r.event_id, id)
            publicar({ ...base, projetoId: id, situacao: "ligado", pendente: res.pendente, sumiram: res.sumiram, protegido: res.protegido })
            return null
        }
    }
}

function publicarPergunta(base: EstadoMontagem, projetoId: string, motivo: MotivoPergunta) {
    if (dispensados.has(chaveDispensa(base.eventId!, projetoId))) return publicar(base)
    let outroCulto = ""
    if (motivo === "outro_culto") {
        const outro = get(projects)[projetoId]?.sirvo?.eventId
        outroCulto = get(sirvo).cultos.find((c) => c.event_id === outro)?.titulo || ""
    }
    publicar({ ...base, projetoId, situacao: "perguntar", motivo, outroCulto, protegido: protegido(projetoId) })
}

function publicar(novo: EstadoMontagem) {
    const atual = get(sirvoMontagem)
    if ((Object.keys(novo) as (keyof EstadoMontagem)[]).every((k) => atual[k] === novo[k])) return
    sirvoMontagem.set(novo)
}

// Uma passada por vez, no máximo uma por segundo para mudanças do projeto e da
// tela; o roteiro novo passa na frente.
let timer: ReturnType<typeof setTimeout> | null = null
let vencimento = 0
function agendar(atraso: number) {
    const quando = Date.now() + atraso
    if (timer && vencimento <= quando) return
    if (timer) clearTimeout(timer)
    vencimento = quando
    timer = setTimeout(() => {
        timer = null
        try {
            passada()
        } catch (erro) {
            console.error("Sirvo: falha ao montar o projeto do culto", erro)
        }
    }, atraso)
}

/** Chamado uma vez na inicialização (startup.ts). */
let iniciado = false
export function iniciarMontagemSirvo() {
    if (iniciado) return
    iniciado = true
    // Quem assina não pode lançar erro: o `set` roda os assinantes na hora, e um
    // erro ali trava a fila de stores do app inteiro. `agendar` só arma um timer.
    const seguro = (atraso: number) => () => {
        try {
            agendar(atraso)
        } catch (erro) {
            console.error("Sirvo: falha ao agendar a montagem", erro)
        }
    }
    sirvoRoteiro.subscribe(seguro(0))
    projects.subscribe(seguro(1_000))
    activeProject.subscribe(seguro(1_000))
    // a tela limpou ou o culto encerrou: a ordem pendente pode entrar
    outputs.subscribe(() => {
        try {
            if (get(sirvoMontagem).pendente === "no_ar") agendar(1_000)
        } catch (erro) {
            console.error("Sirvo: falha ao agendar a montagem", erro)
        }
    })

    window.addEventListener(
        "dragstart",
        () => {
            arrastando = true
            if (arrastoTimer) clearTimeout(arrastoTimer)
            // rede de segurança: um dragend perdido não pode travar a ordem para sempre
            arrastoTimer = setTimeout(fimDoArrasto, 30_000)
        },
        true
    )
    window.addEventListener("dragend", fimDoArrasto, true)
    window.addEventListener("drop", () => setTimeout(fimDoArrasto, 0), true)
}

// ---------------------------------------------------------------- botões da faixa

/** "Montar": liga este projeto ao culto seguido e monta os blocos. Devolve o erro, se houver. */
export function montarSirvoAqui(projetoId: string): string | null {
    try {
        return passada({ montar: projetoId })
    } catch (erro) {
        console.error("Sirvo: falha ao montar", erro)
        return "Não consegui montar os blocos."
    }
}

/** "Aplicar": a ordem nova (ou a remoção de muitos blocos), fora do momento protegido */
export function aplicarOrdemSirvo(projetoId: string): string | null {
    if (protegido(projetoId)) return "Com o culto no ar ou algo na tela, a ordem nova espera."
    try {
        return passada({ forcar: projetoId })
    } catch (erro) {
        console.error("Sirvo: falha ao aplicar a ordem", erro)
        return "Não consegui aplicar a ordem nova."
    }
}

/** "Agora não" / "Entendi": a faixa deste culto some neste projeto até o Show reabrir */
export function dispensarFaixaSirvo(eventId: string | null, projetoId: string) {
    if (!eventId) return
    dispensados.add(chaveDispensa(eventId, projetoId))
    publicar({ ...get(sirvoMontagem), situacao: "nenhuma", motivo: null })
}

/**
 * "Desligar do Sirvo": os cabeçalhos viram seções comuns, destrancadas, e nada
 * sai do lugar. A memória de "já montado" fica: o Show não remonta sozinho.
 */
export function desligarDoSirvo(projetoId: string) {
    const projeto = get(projects)[projetoId]
    if (!projeto?.sirvo) return
    const eventId = projeto.sirvo.eventId

    const aberto = get(activeProject) === projetoId
    const mostrado = aberto ? (projeto.shows || [])[get(activeShow)?.index ?? -1] : undefined
    const idAntes = mostrado?.id

    projects.update((a) => {
        const p = a[projetoId]
        if (!p) return a
        const shows = p.shows || []
        soltarDoSirvo(shows, () => uid(5))
        p.shows = [...shows]
        p.sirvo = null
        p.modified = Date.now()
        return a
    })

    // o cabeçalho ativo trocou de id: o destaque acompanha
    if (mostrado && idAntes !== mostrado.id && get(activeShow)?.id === idAntes) activeShow.update((s) => (s ? { ...s, id: mostrado.id } : s))
    if (eventId) dispensados.add(chaveDispensa(eventId, projetoId))
    agendar(0)
}
