// Leiaute v2, fatia 6: o botao direito da biblioteca (Shows, Midia, Audio, Biblia, Sobreposicoes), dos itens do roteiro e dos blocos do roteiro.
// Registrado AQUI e nao em `contextMenus.ts`/`menuClick.ts`: os dois fazem parte do fecho de imports da janela de SAIDA (a ancora os vigia) e o operador
// so abre menu de contexto na janela principal. O registro e o mesmo de `aliancaMenusEditar.ts`: acrescenta itens e troca layouts nos mapas de
// `contextMenus.ts`; `ContextItem.svelte` chama `acaoDaBiblioteca` antes de `menuClick`.
//
// Cada layout trocado tem a lista do que SAIU do menu antigo e para onde foi (REMOVIDOS). Um item do layout antigo que nao esta no novo nem na lista
// acende a faixa de falha na hora (`falhaAlta`): nada some calado quando o upstream do FreeShow acrescenta um item.
import { get } from "svelte/store"
import { addProjectItem } from "../../converters/project"
import { AudioPlayer } from "../../audio/audioPlayer"
import { playScripture } from "../drawer/bible/scripture"
import { activeProject, contextActive, editingProjectTemplate, outLocked, overlays, projects } from "../../stores"
import { newToast } from "../../utils/common"
import { falhaAlta } from "../../utils/aliancaFalha"
import { porShowNoFim } from "../../utils/aliancaBiblioteca"
import { motivoSemCulto } from "../../utils/aliancaGaveta"
import { dispararNoAlvo } from "../../utils/aliancaGavetaToque"
import { blocosDe, criarAnteparo, criarEngolidor, itemContinuaLa, moverBloco, moverItem } from "../../utils/aliancaMenusBibliotecaLogica"
import { abrirItemDoRoteiro } from "../../utils/aliancaRoteiroClique"
import { cabecalhoTrancado } from "../../utils/aliancaSirvoProjeto"
import { MOTIVO_TRAVADA, tocarShowNoAr } from "../../utils/aliancaTocarNoAr"
import { deleteAction } from "../helpers/clipboard"
import { history } from "../helpers/history"
import { getExtension, getMediaType } from "../helpers/media"
import { contextMenuItems, contextMenuLayouts, type ContextMenuItem } from "./contextMenus"
import { menuClick } from "./menuClick"

const VERMELHO = "#f21a27"

const ITENS: { [id: string]: ContextMenuItem } = {
    alianca_roteiro: { label: "＋ Adicionar ao roteiro", translate: false },
    alianca_agora: { label: "Mostrar agora (sem pôr no roteiro)", icon: "play", iconColor: VERMELHO, color: VERMELHO, translate: false },
    alianca_agora_item: { label: "Mostrar agora", icon: "play", iconColor: VERMELHO, color: VERMELHO, translate: false },
    alianca_subir: { label: "Mover para cima", icon: "up", iconColor: "#93f190", translate: false },
    alianca_descer: { label: "Mover para baixo", icon: "down", iconColor: "#93f190", translate: false },
    alianca_tirar: { label: "Tirar do roteiro", icon: "delete", iconColor: "#ff6b54", translate: false },
    alianca_titulo: { label: "Editar título", icon: "rename", iconColor: "#6effbe", translate: false },
    alianca_novo_bloco: { label: "Novo bloco", icon: "section", iconColor: "var(--secondary)", translate: false }
}

import { NOVOS, REMOVIDOS, semDestinoPorLayout, type Layout } from "./aliancaMenusBibliotecaLayouts"
export { NOVOS, REMOVIDOS, semDestinoPorLayout }

const antigos: Layout = {}
for (const k of Object.keys(NOVOS)) if (contextMenuLayouts[k]) antigos[k] = [...contextMenuLayouts[k]]
Object.assign(contextMenuItems, ITENS)
Object.assign(contextMenuLayouts, NOVOS)
const sobras = semDestinoPorLayout(antigos)
for (const [layout, itens] of Object.entries(sobras)) falhaAlta("menu-biblioteca", `o menu "${layout}" tinha ${itens.join(", ")}, que o menu novo nao tem nem declarou (REMOVIDOS)`)

// ---------------------------------------------------------------- o alvo do botao direito

let ultimoAlvo: Element | null = null
if (typeof window !== "undefined") {
    // captura: roda antes do `contextmenu` do ContextMenu.svelte. O alvo e o elemento mais interno (o que o clique do "Mostrar agora" refaz).
    window.addEventListener(
        "contextmenu",
        (e) => {
            const t = e.target instanceof Element ? e.target : null
            if (t && !t.closest(".contextMenu")) ultimoAlvo = t
        },
        true
    )
}

// ---------------------------------------------------------------- o anteparo (revisao da fatia 6, achado 2)

// O 1o toque num item fecha o menu; o 2o toque de um duplo clique cairia no que estava embaixo (um slide, o ▶ de outra linha: o mesmo desenho do
// incidente de 09/ago). Por ~250 ms, so sobre o retangulo que o menu ocupava, o toque e engolido. Transparente: nao desenha nada, nao fica no caminho
// de um clique fora do retangulo nem depois do prazo. Os toques que ainda caem no menu em fade tambem sao engolidos (a acao nao roda 2x).
const anteparo = criarAnteparo(250)
const GESTOS_DE_TOQUE = ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick"]
if (typeof window !== "undefined") {
    window.addEventListener(
        "click",
        (e) => {
            const menu = e.target instanceof Element ? e.target.closest(".contextMenu") : null
            if (menu) anteparo.armar(menu.getBoundingClientRect(), performance.now())
        },
        true
    )
    for (const tipo of GESTOS_DE_TOQUE)
        window.addEventListener(
            tipo,
            (e) => {
                const me = e as MouseEvent
                if (me.button !== 0 || !anteparo.engole({ x: me.clientX, y: me.clientY }, performance.now())) return
                const noMenu = e.target instanceof Element && !!e.target.closest(".contextMenu")
                if (noMenu && get(contextActive)) return // o menu segue aberto: o toque e dele
                e.preventDefault()
                e.stopImmediatePropagation()
                e.stopPropagation()
            },
            true
        )
}

// ---------------------------------------------------------------- as acoes

type Sel = { id?: string | null; data: any[] } | null
type Chamada = { id: string; menu: ContextMenuItem; contextElem: HTMLElement | null; sel: Sel }

const engolir = criarEngolidor(400)
const classeDoMenu = (el: HTMLElement | null): string => [...(el?.classList || [])].find((c) => c.startsWith("#")) || ""
const marca = (el: HTMLElement | null, nome: string) => (el as any)?.closest?.(`[${nome}]`)?.getAttribute?.(nome) ?? null

/**
 * o item de roteiro em que o botao direito foi dado: pela marca `data-indice` do botao, nunca pela selecao (com varios selecionados age no clicado).
 * Confere tambem o `data-id`: se o roteiro mudou com o menu aberto (Sirvo, outro PC, Ctrl+Z) a posicao pode ser de OUTRO item; entao recusa com um aviso.
 */
function itemDoRoteiro(contextElem: HTMLElement | null) {
    const bruto = marca(contextElem, "data-indice")
    const indice = bruto === null || bruto === "" ? NaN : Number(bruto)
    const idMarcado = marca(contextElem, "data-id")
    const projetoId = get(activeProject)
    const lista: any[] = (projetoId && get(projects)[projetoId]?.shows) || []
    if (!idMarcado || !Number.isInteger(indice)) {
        falhaAlta("menu-roteiro", `o botao do item do roteiro nao traz data-indice/data-id (${bruto}/${idMarcado})`)
        return null
    }
    if (!itemContinuaLa(lista, indice, idMarcado)) {
        newToast("O roteiro mudou. Abra o menu de novo.")
        return null
    }
    return { projetoId: projetoId!, lista, indice, item: lista[indice] }
}

function roteiroTravado(projetoId: string, item: any): string {
    const projeto: any = get(projects)[projetoId]
    if (get(editingProjectTemplate)) return "edite o modelo de culto pela tela de modelos"
    if (projeto?.sectionsLocked) return "o roteiro esta travado"
    if (item?.type === "section" && cabecalhoTrancado(projeto, item)) return "esse bloco vem do Sirvo e esta trancado"
    return ""
}

function gravarLista(projetoId: string, nova: any[]) {
    history({ id: "UPDATE", newData: { key: "shows", data: nova }, oldData: { id: projetoId }, location: { page: "show", id: "project_key" } })
}

/** o item da biblioteca para o roteiro (o mesmo `addProjectItem` do ＋ de cada cartao) */
function paraORoteiro(classe: string, contextElem: HTMLElement | null, sel: Sel) {
    const motivo = motivoSemCulto()
    if (motivo) return newToast(`Não entrou no roteiro: ${motivo}`)
    if (classe === "#show_drawer") {
        const id = marca(contextElem, "data-show")
        if (!id) return falhaAlta("menu-biblioteca", "a linha de show nao tem data-show")
        const r = porShowNoFim(id)
        if (!r.entrou && r.motivo) newToast(`Não entrou no roteiro: ${r.motivo}`)
        return
    }
    const dados = (sel?.data || []).filter((d) => d !== null && d !== undefined)
    // a selecao e lida na hora do clique no item do menu: se a lista se refez nesse meio tempo nao ha nada selecionado, e isso e normal (achado 10)
    if (!dados.length) return void newToast("A seleção mudou. Abra o menu de novo.")
    for (const d of dados) {
        if (classe === "#media_card") {
            const path: string = d.path || ""
            if (path) addProjectItem({ id: path, name: d.name, type: getMediaType(getExtension(path)) } as any)
        } else if (classe.startsWith("#audio_button")) {
            if (d.path) addProjectItem({ id: d.path, name: d.name, type: "audio" } as any)
        } else if (classe.startsWith("#overlay_card")) {
            addProjectItem({ id: d, name: get(overlays)[d]?.name || "", type: "overlay" } as any)
        } else return falhaAlta("menu-biblioteca", `${classe}: sem destino para ＋ roteiro`)
    }
    newToast(dados.length === 1 ? "entrou no fim do roteiro" : `${dados.length} itens entraram no fim do roteiro`)
}

/**
 * O elemento do ITEM da biblioteca que recebe o clique de "Mostrar agora": o proprio `.context` quando ele e o cartao (`.card`) ou o botao da linha;
 * quando o `.context` e um envoltorio (sobreposicao, acao) o cartao/botao de dentro. Nunca um icone interno.
 */
const TOCAR = '[data-acao="tocar-ao-ar"]'
function alvoDoItem(contextElem: HTMLElement | null): HTMLElement | null {
    if (!contextElem) return null
    // as portas com ▶ (`TocarAgora`) tocam pelo ▶: e o caminho unico do gesto deliberado, dentro do item ou na linha que o envolve
    const tocar = (contextElem.querySelector(TOCAR) || contextElem.closest("[data-tocavel]")?.querySelector(TOCAR)) as HTMLElement | null
    if (tocar) return tocar
    if (contextElem.matches(".card, button")) return contextElem
    return (contextElem.querySelector(".card") as HTMLElement | null) || (contextElem.querySelector("button") as HTMLElement | null) || contextElem
}

/** "Mostrar agora (sem pôr no roteiro)": o que o clique da biblioteca fazia antes da fatia 6, sem tocar no roteiro */
function mostrarAgora(classe: string, contextElem: HTMLElement | null) {
    if (get(outLocked)) return void newToast(MOTIVO_TRAVADA)
    if (classe === "#show_drawer") {
        const id = marca(contextElem, "data-show")
        if (!id) return falhaAlta("menu-biblioteca", "a linha de show nao tem data-show")
        if (engolir("agora:" + id, performance.now())) return
        void tocarShowNoAr(id, { entrarNoRoteiro: false })
        return
    }
    const alvo = ultimoAlvo
    const item = alvoDoItem(contextElem)
    if (item && engolir("agora:" + classe + ":" + ((item.closest(".main, .action") || item).textContent || "").trim().slice(0, 80), performance.now())) return
    // versiculo: nao se refaz gesto (com a Biblia ja no ar o duplo clique devolve false e nada ia ao ar: revisao da fatia 6, achado 1). A selecao ja
    // andou para o versiculo do botao direito; `playScripture` poe a selecao no telao, no ar ou nao.
    if (classe.startsWith("#scripture")) {
        if (!alvo?.closest?.(".verse")) return void newToast("Clique com o botão direito em cima de um versículo")
        void playScripture()
        return
    }
    // idempotente (revisao da fatia 6, achado 9): o clique do cartao ALTERNA (no ar -> tira); "Mostrar agora" repetido nao pode tirar do ar o que
    // o operador acabou de mandar. O cartao (Card.svelte) marca `.main.active` quando o item esta numa saida.
    if (item?.closest(".main.active")) return void newToast("Já está no ar")
    // o clique vai no ITEM (o cartao, a linha), nunca no elemento mais interno sob o ponteiro: um botao direito em cima da estrela/tag/filtro do
    // cartao refazia o clique do ICONE (tirava o favorito) e nada ia ao ar (revisao da fatia 6, achado 6)
    dispararNoAlvo(item, "click")
}

/** "Mostrar agora" de um item que JA esta no roteiro (nao mexe no roteiro) */
function mostrarAgoraDoItem(contextElem: HTMLElement | null, sel: Sel) {
    const r = itemDoRoteiro(contextElem)
    if (!r) return
    if (get(outLocked)) return void newToast(MOTIVO_TRAVADA)
    if (engolir("agora-item:" + r.projetoId + ":" + r.indice, performance.now())) return
    const tipo = (r.item.type || "show") as string
    if (tipo === "show") return void tocarShowNoAr(r.item.id, { entrarNoRoteiro: false })
    if (tipo === "audio") return void AudioPlayer.start(r.item.id, { name: r.item.name })
    if (tipo === "video" || tipo === "image") return menuClick("play", false, contextMenuItems.play, contextElem as any, null, { id: "show", data: [{ id: r.item.id, type: tipo, index: r.indice }] } as any)
    falhaAlta("menu-roteiro", `"Mostrar agora" nao existe para itens do tipo ${tipo}`)
    void sel
}

function mover(contextElem: HTMLElement | null, delta: -1 | 1) {
    const r = itemDoRoteiro(contextElem)
    if (!r) return
    const trava = roteiroTravado(r.projetoId, r.item)
    if (trava) return void newToast(trava)
    const nova = r.item.type === "section" ? moverBloco(r.lista, r.indice, delta) : moverItem(r.lista, r.indice, delta)
    if (!nova) return void newToast(delta < 0 ? "já está no começo" : "já está no fim")
    gravarLista(r.projetoId, nova)
}

function tirar(contextElem: HTMLElement | null) {
    const r = itemDoRoteiro(contextElem)
    if (!r) return
    const trava = roteiroTravado(r.projetoId, r.item)
    if (trava) return void newToast(trava)
    // a MESMA porta do Delete e do x da lista (revisao da fatia 6, achado 3): mantem o rodape "Fora do roteiro", avisa o Sirvo da musica tirada,
    // deixa o rastro "tirado · Desfazer" e nao tira show privado. De bloco sai so o cabecalho; os itens ficam e passam ao bloco de cima.
    deleteAction({ id: "show", data: [{ index: r.indice }] })
}

const ACOES: { [id: string]: (c: Chamada) => void } = {
    alianca_roteiro: ({ contextElem, sel }) => paraORoteiro(classeDoMenu(contextElem), contextElem, sel),
    alianca_agora: ({ contextElem }) => mostrarAgora(classeDoMenu(contextElem), contextElem),
    alianca_agora_item: ({ contextElem, sel }) => mostrarAgoraDoItem(contextElem, sel),
    alianca_subir: ({ contextElem }) => mover(contextElem, -1),
    alianca_descer: ({ contextElem }) => mover(contextElem, 1),
    alianca_tirar: ({ contextElem }) => tirar(contextElem),
    alianca_titulo: ({ contextElem }) => {
        const r = itemDoRoteiro(contextElem)
        if (!r) return
        const trava = roteiroTravado(r.projetoId, r.item)
        if (trava) return void newToast(trava)
        // o editor do bloco e o do centro (Section.svelte): abre o bloco e poe o cursor no titulo
        abrirItemDoRoteiro(r.item, r.indice)
        let tentativas = 0
        const focar = () => {
            const campo = document.getElementById("sectionTitle")?.querySelector("input") as HTMLInputElement | null
            if (campo) return void (campo.focus(), campo.select())
            if (++tentativas < 10) return void setTimeout(focar, 60)
            falhaAlta("menu-roteiro", "o editor do bloco nao abriu no centro (sem campo de titulo)")
        }
        setTimeout(focar, 60)
    },
    alianca_novo_bloco: ({ contextElem }) => {
        const r = itemDoRoteiro(contextElem)
        if (!r) return
        const trava = roteiroTravado(r.projetoId, r.item)
        if (trava) return void newToast(trava)
        // o novo bloco entra logo DEPOIS do bloco clicado (depois do ultimo item dele), nao no meio dele
        const { lead, blocos } = blocosDe(r.lista)
        let fim = lead.length
        for (const b of blocos) {
            fim += b.length
            if (b[0] === r.item) break
        }
        // a mesma entrada de historico do "nova secao" do FreeShow; o `select` dela abre o bloco novo no centro e poe o cursor no titulo
        history({ id: "UPDATE", newData: { key: "shows", index: fim }, oldData: { id: r.projetoId }, location: { page: "show", id: "section" } })
    }
}

/** true = o clique era de um item daqui e foi tratado; false = segue para `menuClick` (ou para o `aliancaMenusEditar`) */
export function acaoDaBiblioteca(chamada: Chamada): boolean {
    const acao = ACOES[chamada.id]
    if (!acao) return false
    try {
        acao(chamada)
    } catch (erro) {
        falhaAlta("menu-biblioteca", erro)
    }
    return true
}

