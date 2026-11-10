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
//   - Momento protegido (culto no ar ou algo na tela, ver `protegido`): os
//     campos aplicam; a ORDEM só muda sozinha se a primeira posição que muda
//     vem depois de todo ponteiro vivo (bloco novo no fim etc.). Senão fica
//     pendente, a faixa diz o que mudou, e o operador aperta Aplicar.
//   - Mudou a ordem do projeto aberto: os ponteiros por posição (item aberto,
//     foco, saídas) seguem o MESMO objeto (aliancaSirvoPonteiros.ts), na mesma
//     passada, e o "abrir" por posição do celular é recusado por 30 s.

import { get, writable } from "svelte/store"
import { uid } from "uid"
import type { ProjectShowRef } from "../../types/Projects"
import { OutputHelper } from "../components/helpers/OutputHelper"
import type { Show } from "../../types/Show"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"
import { setShow } from "../components/helpers/setShow"
import { activeFocus, activeProject, activeRename, activeShow, categories, contextActive, folders, loaded, outputs, outputSlideCache, projects, redoHistory, saved, selected, shows, special, undoHistory } from "../stores"
import { estruturaDoProjetoMudou } from "./aliancaControle"
import { garantirPastas } from "./aliancaPastas"
import { registrarPendenciaSirvo, sirvo, sirvoForcarAte, sirvoRoteiro, type Roteiro } from "./aliancaSirvo"
import { decidirProjeto, soltarDoSirvo, type MotivoPergunta } from "./aliancaSirvoMontagem"
import { desfazListaDoProjeto, remapearPonteiros, type PonteirosDoProjeto } from "./aliancaSirvoPonteiros"
import { CATEGORIA_NOVAS, NOME_CATEGORIA_NOVAS, acaoDoRascunho, hashDaLetra, idDoRascunho, ligacoesVivas, perguntasEEsta, rascunhoDaLetra, type ContextoMusicas, type MusicaDoSirvo, type PerguntaEEsta } from "./aliancaSirvoMusicas"
import { papelDoItem, reconciliar, resumirPendencia, textoDaPendencia, type MotivoPendente } from "./aliancaSirvoProjeto"
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
    /** o que está pendente, em texto curto ("Louvor mudou de lugar · bloco novo: Avisos") */
    resumo: string
    sumiram: number
    /** culto no ar ou algo na tela, com este projeto aberto: a ordem não muda agora */
    protegido: boolean
    /** F3: uma música nova do Sirvo tem o mesmo nome de uma da biblioteca — "é esta?" */
    eEsta: PerguntaEEsta | null
}

const VAZIO: EstadoMontagem = { projetoId: null, situacao: "nenhuma", motivo: null, eventId: null, titulo: "", blocos: 0, quantosNoDia: 0, outroCulto: "", pendente: null, resumo: "", sumiram: 0, protegido: false, eEsta: null }
export const sirvoMontagem = writable<EstadoMontagem>(VAZIO)
// F2: o pedido do operador não força o rev se já havia ordem alheia pendente
registrarPendenciaSirvo((eventId) => {
    const m = get(sirvoMontagem)
    return m.eventId === eventId && !!m.pendente
})

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

// ---------------------------------------------------------------- músicas (F3)
// "É esta?": a linha de música nova do Sirvo → o show que o operador disse que
// ela é. Fica no `special` (salvo com as configurações) e vai no catálogo como
// `sirvo_musicas` (aliancaCatalogo.ts): o Sirvo troca a nova pelo show_id real.

const CHAVE_LIGACOES = "aliancaSirvoNovas"
const eEstaDispensadas = new Set<string>()

export function lerLigacoesSirvo(): { [rmId: string]: string } {
    const m = get(special)?.[CHAVE_LIGACOES]
    return m && typeof m === "object" ? m : {}
}

/** o que a conta precisa da biblioteca; a ligação para um show apagado não conta (a linha volta a rascunho / pergunta) */
function contextoMusicas(): ContextoMusicas {
    const biblioteca = get(shows)
    const existe = (id: string) => !!biblioteca[id]
    return {
        existe,
        rascunho: (id) => biblioteca[id]?.category === CATEGORIA_NOVAS,
        ligacoes: ligacoesVivas(lerLigacoesSirvo(), existe)
    }
}

const todasAsMusicas = (r: Roteiro): MusicaDoSirvo[] => r.blocos.flatMap((b) => (Array.isArray(b.musicas) ? b.musicas : []))

// A memória dos rascunhos criados: linha → hash da letra com que o rascunho
// nasceu. Fica no `special`. Sem ela, um rascunho que o operador apagou
// voltaria a cada passada.
const CHAVE_RASCUNHOS = "aliancaSirvoRascunhos"

function lerRascunhosCriados(): { [rmId: string]: string } {
    const m = get(special)?.[CHAVE_RASCUNHOS]
    return m && typeof m === "object" ? m : {}
}

/**
 * Música nova com letra e sem show: o Show cria o RASCUNHO na categoria
 * "Novas do Sirvo" (id fixo `sn_<linha>`: dois passes não criam dois). Nunca
 * vai direto para a saída — no projeto aparece o aviso até o operador revisar
 * e mudar a categoria. Não fica salvo sozinho no disco: se o Show fechar sem
 * salvar, a passada seguinte cria de novo.
 *
 * Só roda quando este Show monta o culto de verdade (situação "ligado"). O
 * rascunho que o operador apagou não volta — só se a letra mudar no Sirvo. O
 * rascunho que ainda está em "Novas do Sirvo", sem ninguém mexer, é
 * reescrito quando a letra muda (aliancaSirvoMusicas.ts, `acaoDoRascunho`).
 */
function criarRascunhos(r: Roteiro) {
    if (getAccess("shows")?.global === "read") return
    const ctx = contextoMusicas()
    const biblioteca = get(shows)
    const memoria = lerRascunhosCriados()
    const lembrar: { [rmId: string]: string } = {}
    let escreveu = false
    for (const m of todasAsMusicas(r)) {
        if (m.show_id || !m.letra || ctx.ligacoes[m.id]) continue
        const id = idDoRascunho(m.id)
        const existente = biblioteca[id]
        const datas = existente?.timestamps
        const hash = hashDaLetra(m.letra)
        const acao = acaoDoRascunho({ existe: !!existente, aindaRascunho: existente?.category === CATEGORIA_NOVAS, mexido: !!datas?.modified && datas.modified !== datas.created }, memoria[m.id], hash)
        if (acao === "nada") continue
        if (acao === "criar" || acao === "reescrever") {
            if (!get(categories)[CATEGORIA_NOVAS]) {
                categories.update((c) => ({ ...c, [CATEGORIA_NOVAS]: { name: NOME_CATEGORIA_NOVAS, icon: "song" } }))
            }
            // ao reescrever, nome e data de criação ficam os da biblioteca (os dois stores do show concordam)
            const nome = acao === "reescrever" ? existente?.name || m.nome : m.nome
            setShow(id, rascunhoDaLetra(nome, m.letra, (acao === "reescrever" && datas?.created) || Date.now(), DEFAULT_ITEM_STYLE) as unknown as Show)
            console.info(`Sirvo: rascunho ${acao === "criar" ? "criado" : "reescrito (a letra mudou)"} em "${NOME_CATEGORIA_NOVAS}": ${m.nome}`)
            escreveu = true
        }
        lembrar[m.id] = hash
    }
    if (escreveu) saved.set(false)
    if (Object.keys(lembrar).length) {
        special.update((a) => {
            a[CHAVE_RASCUNHOS] = { ...(a[CHAVE_RASCUNHOS] || {}), ...lembrar }
            return a
        })
    }
}

/** a primeira pergunta "é esta?" do culto seguido (uma de cada vez) */
function primeiraEEsta(r: Roteiro): PerguntaEEsta | null {
    const cats = get(categories)
    const deMusica = new Set(
        Object.entries(cats || {})
            .filter(([, c]) => c?.icon === "song")
            .map(([id]) => id)
    )
    return perguntasEEsta(todasAsMusicas(r), get(shows) as any, deMusica, contextoMusicas().ligacoes, eEstaDispensadas)[0] || null
}

/** "É esta": liga a música nova do Sirvo a este show (vale no projeto já, e no Sirvo na próxima publicação do catálogo) */
export function ligarMusicaSirvo(rmId: string, showId: string) {
    if (!rmId || !showId || !get(shows)[showId]) return
    special.update((a) => {
        a[CHAVE_LIGACOES] = { ...(a[CHAVE_LIGACOES] || {}), [rmId]: showId }
        return a
    })
    agendar(0)
}

/** "Não é": não pergunta de novo desta linha até o Show reabrir */
export function dispensarEEstaSirvo(rmId: string) {
    eEstaDispensadas.add(rmId)
    publicar({ ...get(sirvoMontagem), eEsta: null })
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

/** há na tela um slide que guardou a posição de um item de projeto (não dá para saber de qual) */
function saidaComPosicao() {
    return saidasComAlgo().some((o) => typeof o.out?.slide?.projectIndex === "number")
}

/** posições usadas por um ponteiro vivo neste projeto: o cabeçalho ativo nunca sai */
function ativosNo(projetoId: string): number[] {
    if (get(activeProject) !== projetoId) return []
    const posicoes = [get(activeShow)?.index, get(activeFocus)?.index]
    Object.values(get(outputs) || {}).forEach((o: any) => posicoes.push(o?.out?.slide?.projectIndex))
    return posicoes.filter((i): i is number => typeof i === "number" && i >= 0)
}

/**
 * Os ponteiros por posição do projeto aberto, lidos ANTES da conta (que muda o
 * id de lápide e duplicata no próprio objeto). Só os coerentes: um ponteiro
 * cujo item não bate com o id (ex.: slide de outro projeto, ou a posição já
 * velha) não é tocado; trocar o id dele abriria outro item no centro.
 */
function lerPonteiros(projetoId: string, itens: ProjectShowRef[]): PonteirosDoProjeto | null {
    if (get(activeProject) !== projetoId) return null
    const coerente = (p: { index?: number; id?: string } | null | undefined) => (p && typeof p.index === "number" && p.index >= 0 && itens[p.index]?.id === p.id ? { index: p.index, id: p.id } : null)
    const saidas: { [id: string]: number } = {}
    Object.entries(get(outputs) || {}).forEach(([id, o]: [string, any]) => {
        const s = o?.out?.slide
        if (s && typeof s.projectIndex === "number" && s.projectIndex >= 0 && itens[s.projectIndex]?.id === s.id) saidas[id] = s.projectIndex
    })
    // o slide guardado ao limpar a tela (clear.ts): o "próximo" volta a usá-lo
    const limpos: { [id: string]: number } = {}
    Object.entries(get(outputSlideCache) || {}).forEach(([id, s]: [string, any]) => {
        if (s && typeof s.projectIndex === "number" && s.projectIndex >= 0 && itens[s.projectIndex]?.id === s.id) limpos[id] = s.projectIndex
    })
    return { ativo: coerente(get(activeShow)), foco: coerente(get(activeFocus)), saidas, limpos }
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
 * Escreve no store numa passada só, fora do history, e na mesma passada (sem
 * `await`) leva cada ponteiro por posição para onde o MESMO objeto foi parar:
 * item aberto, foco e a posição guardada em cada saída. A saída só é tocada se
 * a posição dela mudou (e trocar só a posição não reenvia o slide: ver
 * Output.svelte). Com a ordem mudada, a seleção, o menu de contexto e o
 * renomear de um item do projeto são fechados, o cache de 50 ms do item ativo
 * (OutputHelper) é esquecido e o celular é avisado.
 */
function escrever(projetoId: string, antes: ProjectShowRef[], depois: ProjectShowRef[], extra: { ligar?: { eventId: string }; ponteiros?: PonteirosDoProjeto | null } = {}) {
    const estrutura = depois !== antes

    projects.update((a) => {
        const p = a[projetoId]
        if (!p) return a
        p.shows = [...depois]
        if (extra.ligar) p.sirvo = { eventId: extra.ligar.eventId, montadoEm: Date.now() }
        p.modified = Date.now()
        return a
    })

    // A ordem mudou: o Ctrl+Z das mudanças anteriores na lista devolveria a
    // ordem velha (vale também fora do culto: o culto pode começar depois).
    if (estrutura) esquecerDesfazerDaLista(projetoId)

    // os ponteiros só existem no projeto aberto, e só se ainda são do projeto aberto
    const ponteiros = extra.ponteiros
    if (!ponteiros || get(activeProject) !== projetoId) return

    const r = remapearPonteiros(antes, depois, ponteiros)
    if (r.perdidos) console.warn("Sirvo: um ponteiro do projeto apontava para um item que saiu da lista", r.perdidos)
    const { ativo, foco } = r
    if (ativo) activeShow.update((s) => (s && s.id === ponteiros.ativo?.id ? { ...s, index: ativo.index, id: ativo.id } : s))
    if (foco) activeFocus.update((f) => (f && f.id === ponteiros.foco?.id ? { ...f, index: foco.index, id: foco.id } : f))
    const saidas = Object.entries(r.saidas)
    if (saidas.length) {
        outputs.update((a) => {
            for (const [id, i] of saidas) {
                const slide = a[id]?.out?.slide
                if (slide) a[id].out!.slide = { ...slide, projectIndex: i }
            }
            return a
        })
    }
    const limpos = Object.entries(remapearPonteiros(antes, depois, { saidas: ponteiros.limpos }).saidas)
    if (limpos.length) {
        outputSlideCache.update((a) => {
            for (const [id, i] of limpos) if (a?.[id]) a[id] = { ...a[id], projectIndex: i }
            return a
        })
    }

    if (!estrutura) return
    OutputHelper.esquecerItemAtivo()
    if (get(selected)?.id === "show") selected.set({ id: null, data: [] })
    if (get(contextActive)) contextActive.set(false)
    if (String(get(activeRename) || "").startsWith("show_")) activeRename.set(null)
    try {
        estruturaDoProjetoMudou()
    } catch (erro) {
        console.error("Sirvo: falha ao avisar o celular da ordem nova", erro)
    }
}

/**
 * O Sirvo mudou a ordem: o Ctrl+Z das mudanças anteriores na lista deste
 * projeto devolveria a ordem VELHA (a lista inteira, clonada), e com o culto
 * no ar o item aberto e o telão ficariam apontando para outro item. Essas
 * entradas saem; o resto do desfazer (slides, textos, outros projetos) fica.
 */
function esquecerDesfazerDaLista(projetoId: string) {
    const antes = get(undoHistory).length + get(redoHistory).length
    undoHistory.update((a) => a.filter((h) => !desfazListaDoProjeto(h, projetoId)))
    redoHistory.update((a) => a.filter((h) => !desfazListaDoProjeto(h, projetoId)))
    const tiradas = antes - get(undoHistory).length - get(redoHistory).length
    if (tiradas) console.info(`Sirvo: a ordem do culto mudou no ar; ${tiradas} passo(s) do Ctrl+Z da lista deste projeto foram esquecidos`)
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

/**
 * De onde a hora dos cabeçalhos conta: do Iniciar, se o culto já começou; senão
 * do horário marcado. É o que o Sirvo web mostra (teste do André, 08/nov: o
 * culto iniciado às 13h29 aparecia no Show como "TEste 18:00" contando 4h30).
 * Muda uma vez no Iniciar (e no Reiniciar), não a cada bloco concluído.
 */
const inicioDoPlano = (r: { comeca_em: string; iniciado_em?: string | null }) => r.iniciado_em || r.comeca_em

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
    const ponteiros = lerPonteiros(projetoId, itens)
    const res = reconciliar(itens, r.blocos, { ativos: ativosNo(projetoId), forcar: true, comecaEm: inicioDoPlano(r), musicas: contextoMusicas() })
    escrever(projetoId, itens, res.itens, { ligar: { eventId: r.event_id }, ponteiros })
    lembrarMontado(r.event_id, projetoId)
    dispensados.delete(chaveDispensa(r.event_id, projetoId))
    return null
}

/**
 * O projeto já ligado: campos sempre. A ordem: fora do momento protegido,
 * sempre; nele, sozinha só depois de todo ponteiro vivo (a conta decide pelos
 * `ativos`), ou com Aplicar (`forcar`). Nunca no meio de um arrasto.
 */
function atualizarLigado(projetoId: string, r: Roteiro, forcar: boolean) {
    const itens = get(projects)[projetoId]?.shows || []
    const aberto = get(activeProject) === projetoId
    const prot = protegido(projetoId)
    // daqui até o fim do `escrever` é tudo síncrono: lido, contado e escrito sem pausa
    const ponteiros = lerPonteiros(projetoId, itens)
    const res = reconciliar(itens, r.blocos, { ativos: ativosNo(projetoId), protegido: prot, forcar, comecaEm: inicioDoPlano(r), musicas: contextoMusicas() })

    let depois = res.itens
    let pendente = res.motivo
    if (depois !== itens) {
        if (aberto && arrastando) {
            // o "soltar" usa a posição de quando o arrasto começou: tenta de novo no dragend
            depois = itens
            pendente = null
        } else if (!aberto && prot && saidaComPosicao()) {
            // projeto fechado e um slide na tela que guardou uma posição: não dá
            // para saber se é deste projeto; espera o projeto ser aberto
            depois = itens
            pendente = "no_ar"
        }
    }

    // a conta já mexeu nos objetos (campos, lápide, duplicata): grava mesmo com a ordem pendente
    if ((res.mudouCampos || depois !== itens) && podeEscrever()) escrever(projetoId, itens, depois, { ponteiros })

    const resumo = pendente ? textoDaPendencia(resumirPendencia(depois, r.blocos)) : ""
    return { pendente, resumo, sumiram: res.sumiram, protegido: prot }
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

    const decisao = decidirProjeto({ eventId: r.event_id, comecaEm: r.comeca_em, blocos: r.blocos.length, cultos: e.cultos, projetos: get(projects), pastas: get(folders), montados: lerMontados() })

    // F3: os rascunhos das músicas novas existem antes da conta (aparecem como
    // aviso) — mas só quando este Show monta o culto de verdade ("ligado"):
    // o PC que só acompanha, ou que ainda está sendo perguntado, não cria nada.
    const vaiLigar = decisao.acao === "criar" || decisao.acao === "montar" || decisao.acao === "reconciliar" || (decisao.acao === "perguntar" && pedido.montar === decisao.projetoId)
    if (vaiLigar) {
        try {
            criarRascunhos(r)
        } catch (erro) {
            console.error("Sirvo: falha ao criar o rascunho de uma música nova", erro)
        }
    }
    const base: EstadoMontagem = { ...VAZIO, eventId: r.event_id, titulo: r.titulo || e.cultoTitulo || "", blocos: r.blocos.length, eEsta: primeiraEEsta(r) }

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
            const itens = reconciliar([], r.blocos, { forcar: true, comecaEm: inicioDoPlano(r), musicas: contextoMusicas() }).itens
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
            // o próprio pedido do operador (F2) entra mesmo no momento protegido
            const res = atualizarLigado(id, r, pedido.forcar === id || Number(r.rev) <= sirvoForcarAte(r.event_id))
            lembrarMontado(r.event_id, id)
            publicar({ ...base, projetoId: id, situacao: "ligado", pendente: res.pendente, resumo: res.resumo, sumiram: res.sumiram, protegido: res.protegido })
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
    const igual = (k: keyof EstadoMontagem) => (k === "eEsta" ? JSON.stringify(atual.eEsta) === JSON.stringify(novo.eEsta) : atual[k] === novo[k])
    if ((Object.keys(novo) as (keyof EstadoMontagem)[]).every(igual)) return
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
    // F3: a música apareceu (criada, importada, rascunho aprovado): o aviso vira ela
    shows.subscribe(seguro(1_000))
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

/**
 * "Aplicar": a ordem nova (ou a remoção de muitos blocos), inclusive com o culto
 * no ar. Uma passada síncrona: lê o projeto de agora e o roteiro mais novo,
 * conta, escreve e leva os ponteiros junto. O que está no telão continua no ar.
 */
export function aplicarOrdemSirvo(projetoId: string): string | null {
    if (get(activeProject) !== projetoId) return "Abra o projeto do culto para aplicar a ordem nova."
    if (arrastando) return "Termine de arrastar e aplique de novo."
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
        const lista = p.shows || []
        soltarDoSirvo(lista, () => uid(5))
        p.shows = [...lista]
        p.sirvo = null
        p.modified = Date.now()
        return a
    })

    // o cabeçalho ativo trocou de id: o destaque acompanha
    if (mostrado && idAntes !== mostrado.id && get(activeShow)?.id === idAntes) activeShow.update((s) => (s ? { ...s, id: mostrado.id } : s))
    if (eventId) dispensados.add(chaveDispensa(eventId, projetoId))
    agendar(0)
}
