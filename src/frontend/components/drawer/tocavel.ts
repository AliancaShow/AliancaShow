// Leiaute v2, fatia 6 (correcoes da revisao): poe o ▶ (TocarAgora) DENTRO do cartao (`.card`) de uma porta cujo cartao e desenhado por um componente
// que a janela de SAIDA tambem importa (Capture, NDIStream, BMDStream, Cam): esses arquivos nao podem mudar (a ancora vigia o fecho da saida), entao
// quem desenha a lista da biblioteca envolve o componente em `<div use:tocavel style="display: contents">` e o ▶ entra no cartao por aqui.
// O cartao desses componentes ainda promete "Reproduzir" ao passar o mouse: o ▶ grande de hover e escondido (CSS de TocarAgora, classe `soSeleciona`) e a
// dica trocada (observador do `data-title`).
import TocarAgora from "./TocarAgora.svelte"

export type OpcoesTocavel = { aoTocar: () => void; titulo?: string; desligado?: boolean; ativo?: boolean }

const DICA = "Botão direito: Mostrar agora"

export function tocavel(node: HTMLElement, opcoes: OpcoesTocavel) {
    let atual = opcoes
    let comp: TocarAgora | null = null
    let cartao: HTMLElement | null = null
    let dica: MutationObserver | null = null
    let procura: MutationObserver | null = null

    function dicaCerta() {
        if (cartao && cartao.getAttribute("data-title") && cartao.getAttribute("data-title") !== DICA) cartao.setAttribute("data-title", DICA)
    }

    function montar(): boolean {
        if (!atual.ativo && atual.ativo !== undefined) return true
        const achado = node.querySelector(".card") as HTMLElement | null
        if (!achado) return false
        cartao = achado
        cartao.classList.add("soSeleciona")
        comp = new TocarAgora({ target: cartao, props: { flutuante: true, titulo: atual.titulo || "Mandar ao ar", desligado: !!atual.desligado } })
        comp.$on("tocar", () => atual.aoTocar())
        dicaCerta()
        dica = new MutationObserver(dicaCerta)
        dica.observe(cartao, { attributes: true, attributeFilter: ["data-title"] })
        return true
    }

    if (!montar()) {
        // o cartao nasce depois (carregando): espera ele aparecer
        procura = new MutationObserver(() => {
            if (montar()) {
                procura?.disconnect()
                procura = null
            }
        })
        procura.observe(node, { childList: true, subtree: true })
    }

    return {
        update(novas: OpcoesTocavel) {
            atual = novas
            comp?.$set({ titulo: atual.titulo || "Mandar ao ar", desligado: !!atual.desligado })
        },
        destroy() {
            procura?.disconnect()
            dica?.disconnect()
            comp?.$destroy()
        }
    }
}

/**
 * O mesmo ▶, para uma LISTA de cartoes desenhada por um componente do fecho da saida que nao da para envolver um a um (`Cameras` desenha todos os
 * `Cam`). Cada `.card` que aparecer dentro do no ganha o ▶; tocar = o clique no cartao (o handler da porta, com a guarda levantada por TocarAgora).
 */
export function tocavelLista(node: HTMLElement, titulo = "Mandar ao ar") {
    const feitos = new Map<HTMLElement, { comp: TocarAgora; dica: MutationObserver }>()

    function varrer() {
        for (const cartao of Array.from(node.querySelectorAll(".card")) as HTMLElement[]) {
            if (feitos.has(cartao)) continue
            cartao.classList.add("soSeleciona")
            const comp = new TocarAgora({ target: cartao, props: { flutuante: true, titulo } })
            comp.$on("tocar", () => cartao.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window, detail: 1 })))
            const acertar = () => {
                const t = cartao.getAttribute("data-title")
                if (t && t !== DICA) cartao.setAttribute("data-title", DICA)
            }
            acertar()
            const dica = new MutationObserver(acertar)
            dica.observe(cartao, { attributes: true, attributeFilter: ["data-title"] })
            feitos.set(cartao, { comp, dica })
        }
        // cartoes que saíram da tela
        for (const [cartao, f] of feitos)
            if (!cartao.isConnected) {
                f.dica.disconnect()
                f.comp.$destroy()
                feitos.delete(cartao)
            }
    }

    varrer()
    const obs = new MutationObserver(varrer)
    obs.observe(node, { childList: true, subtree: true })
    return {
        destroy() {
            obs.disconnect()
            for (const f of feitos.values()) {
                f.dica.disconnect()
                f.comp.$destroy()
            }
            feitos.clear()
        }
    }
}
