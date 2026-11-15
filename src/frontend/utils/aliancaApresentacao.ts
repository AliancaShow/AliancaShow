import { uid } from "uid"
import type { Show, SlideData } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { removeExtension, splitPath } from "../components/helpers/media"
import { checkName } from "../components/helpers/show"
import { translateText } from "./language"

// ----- AliançaShow · Preparar, fatia 6: "Juntar fotos numa apresentação" -----
//
// O "Criar apresentação" do FreeShow (menuClick.createSlideshow) avança sozinho a cada 6 s, com zoom, põe
// `end: true` no último slide (o laço volta ao primeiro) e abre o show. No Preparar o avanço é MANUAL: sem
// `nextTimer`, sem zoom e sem `end` (com `end` a última foto voltaria para a primeira e prenderia o operador num laço).
// O show não é aberto: quem chama põe no culto.

export type MidiaDaApresentacao = { name?: string; path?: string; id?: string; type?: string; [chave: string]: any }

/** "Fotos 14-11-2026": sem barra, que o nome vira nome de arquivo */
export function nomeDaApresentacao(agora: Date = new Date()): string {
    const d = String(agora.getDate()).padStart(2, "0")
    const m = String(agora.getMonth() + 1).padStart(2, "0")
    return `Fotos ${d}-${m}-${agora.getFullYear()}`
}

/**
 * Monta o show (sem gravar nem pôr no histórico). `automatico: true` é o jeito do FreeShow (6 s, zoom, laço no fim).
 * Devolve o id novo e o show; a pasta de onde vieram as fotos só dá nome no modo automático (que é o do Culto).
 */
export function montarApresentacaoDeMidias(dados: MidiaDaApresentacao[], opcoes: { automatico: boolean; nome?: string } = { automatico: false }): { id: string; show: Show } {
    const slides = dados.map((a) => ({ group: removeExtension(a.name || a.path || ""), color: null, settings: {}, notes: "", items: [] }))

    const layoutId = uid()
    const show = new ShowObj(false, "presentation", layoutId, Date.now(), false) as unknown as Show
    const pasta = splitPath(dados[0]?.path || "").at(-2) || ""
    show.name = checkName(opcoes.nome || (opcoes.automatico ? translateText("create_show.slideshow") + (pasta ? `" "${pasta}` : "") : nomeDaApresentacao()))

    const videoData = { muted: false, loop: false }
    const duracao = 6

    const layoutSlides: SlideData[] = []
    slides.forEach((slide, i) => {
        const slideId = uid()
        show.slides[slideId] = slide as any

        const mediaId = uid(5)
        const midia = dados[i]
        if (!midia) return

        show.media[mediaId] = { ...midia, path: midia.path || midia.id, ...(midia.type === "video" ? videoData : {}) } as any

        const layoutData: SlideData = { id: slideId, background: mediaId }
        if (opcoes.automatico) {
            if (midia.type === "video") layoutData.actions = { nextAfterMedia: true }
            else if (midia.type === "image") {
                layoutData.nextTimer = duracao
                layoutData.actions = { animate: { actions: [{ type: "change", duration: duracao + 2, id: "background", key: "zoom" }] } }
            }
            if (i === slides.length - 1) layoutData.end = true
        }
        layoutSlides.push(layoutData)
    })

    show.layouts[layoutId].slides = layoutSlides
    return { id: uid(), show }
}
