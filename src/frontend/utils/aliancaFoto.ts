import type { LayoutRef } from "../../types/Show"
import { clone } from "../components/helpers/array"
import { _show } from "../components/helpers/shows"
import type { FotoDoSlide } from "./aliancaFotoLogica"

export * from "./aliancaFotoLogica"

// "Foto" do slide que foi pro ar (AliancaShow, Preparar fatia 2).
//
// O que vai pro telao e uma FOTO do slide no momento do envio (texto, itens, ajustes
// do slide e os dados do slide no layout). Editar o show depois NAO mexe no telao:
// so muda quando mandar de novo (clicar no slide, Ctrl+R no Culto, botao de atualizar).
// O fundo continua tocando por fora da foto.
//
// A foto vive em `out.slide.foto`, vai junto pra janela de saida e NAO e salva em disco
// nem mandada pro Remote/Stage web.

/** Sem layout/slide (C15): devolve null e a saida le ao vivo como antes. */
export function tirarFoto(id: string, layout: string | undefined, index: number | undefined): FotoDoSlide | null {
    if (!layout || typeof index !== "number" || index < 0) return null
    const ref: LayoutRef[] = _show(id).layouts([layout]).ref()[0] || []
    const item = ref[index]
    if (!item) return null
    const slide = _show(id).get("slides")?.[item.id]
    if (!slide) return null
    return { slideId: item.id, index, slide: clone(slide), slideData: clone(item.data || {}) }
}
