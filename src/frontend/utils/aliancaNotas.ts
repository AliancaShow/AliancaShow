// Leiaute v2, fatia 3: gravar as notas pelas propriedades de Editar (a nota do SLIDE e a nota do SHOW, a do layout ativo). A mesma escrita que o painel de
// notas do Culto (`SlideEditor.svelte` / `ShowNotes.svelte`) faz; so muda onde se escreve. Nada aqui toca `outputs`.
import { _show } from "../components/helpers/shows"
import { falhaAlta } from "./aliancaFalha"

/** devolve true se gravou; slide inexistente e falha alta (nunca "grava em lugar nenhum" calado) */
export function gravarNotaDoSlide(showId: string, slideId: string, atual: string, texto: string): boolean {
    try {
        if (!showId || !slideId) {
            falhaAlta("nota-slide", `sem show (${showId}) ou slide (${slideId}) para gravar a nota`)
            return false
        }
        if (atual === texto) return true
        _show(showId).slides([slideId]).set({ key: "notes", value: texto })
        return true
    } catch (erro) {
        falhaAlta("nota-slide", erro)
        return false
    }
}

export function gravarNotaDoShow(showId: string, atual: string, texto: string): boolean {
    try {
        if (!showId) {
            falhaAlta("nota-show", "sem show para gravar a nota")
            return false
        }
        if (atual === texto) return true
        _show(showId).layouts("active").set({ key: "notes", value: texto })
        return true
    } catch (erro) {
        falhaAlta("nota-show", erro)
        return false
    }
}
