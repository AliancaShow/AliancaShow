// "Modelo da categoria" virou "aplicar uma vez" (André, 24/nov). No FreeShow a categoria guardava um modelo FIXO que era recolado em toda musica
// dela a cada abertura e recusava qualquer outro (foi o "saiu aplicando em tudo": Cancoes e Novas do Sirvo com o modelo "teste").
// Agora: (1) na partida, as categorias perdem o modelo fixo (uma vez; nada da saida le isso); (2) o clique direito na categoria escolhe um modelo
// e o COLA em todas as musicas dela: cada musica guarda o modelo e recebe na proxima abertura (show/Slides.svelte, deveColarModelo); editar
// o modelo depois nao muda mais as musicas. Arquivo livre (fora do fecho).
// O clique direito continua o do FreeShow (menuClick.ts e do fecho e nao muda): ele grava `categories[id].template`; `vigiarModeloDasCategorias`
// (so a janela principal, AliancaTela) percebe, tira o modelo da categoria e, se veio da escolha do operador, cola nas musicas.
import { get } from "svelte/store"
import { activePopup, categories, shows, showsCache, templates } from "../stores"
import { loadShows } from "../components/helpers/setShow"
import { _show } from "../components/helpers/shows"
import { newToast } from "./common"
import { aceitarCaminhosNaFoto } from "./aliancaConfigRascunho"
import { falhaAlta } from "./aliancaFalha"
import { translateText } from "./language"
import { categoriasComModeloFixo, musicasDaCategoria } from "./aliancaModelosLogica"

/** partida: tira o modelo fixo das categorias (o FreeShow recolava ele em toda abertura). Devolve quantas mudaram. */
export function soltarModelosDasCategorias(): number {
    const ids = categoriasComModeloFixo(get(categories) as any)
    if (!ids.length) return 0
    categories.update((a: any) => {
        for (const id of ids) if (a[id]) delete a[id].template
        return a
    })
    // nao conta como "alteracao nao salva" em Configuracoes
    aceitarCaminhosNaFoto([["categories"]])
    return ids.length
}

/** clique direito na categoria > modelo escolhido: cola em todas as musicas dela (cada uma recebe na proxima abertura) */
export async function colarModeloNaCategoria(categoria: string, modeloId: string): Promise<number> {
    try {
        const nomeModelo = (get(templates) as any)[modeloId]?.name || "o modelo"
        const bruto = String((get(categories) as any)[categoria]?.name || "")
        const nomeCategoria = (bruto.startsWith("category.") ? translateText(bruto) : bruto) || "esta categoria"
        const ids = musicasDaCategoria(get(shows) as any, categoria)
        if (!ids.length) {
            newToast(`Nenhuma música em ${nomeCategoria}.`)
            return 0
        }
        const ok = window.confirm(`Aplicar "${nomeModelo}" nas ${ids.length} músicas de ${nomeCategoria}?\n\nCada música recebe o modelo uma vez (na próxima vez que abrir). Depois, mudar o modelo não muda as músicas.`)
        if (!ok) return 0
        for (let i = 0; i < ids.length; i += 25) {
            const lote = ids.slice(i, i + 25)
            await loadShows(lote)
            for (const id of lote) {
                if (!(get(showsCache) as any)[id] || (get(showsCache) as any)[id].locked) continue
                _show(id).set({ key: "settings.template", value: modeloId })
                // sem "ja colado": a proxima abertura cola (deveColarModelo)
                _show(id).set({ key: "settings.aliancaModeloColado", value: "" })
            }
        }
        newToast(`"${nomeModelo}" aplicado em ${ids.length} músicas de ${nomeCategoria}.`)
        return ids.length
    } catch (erro) {
        falhaAlta("modelo-categoria", erro)
        return 0
    }
}

/** janela principal, depois de soltarModelosDasCategorias: a categoria nunca fica com modelo fixo. Escolha no popup cola nas musicas. */
export function vigiarModeloDasCategorias(): () => void {
    return categories.subscribe((a: any) => {
        const ids = categoriasComModeloFixo(a)
        if (!ids.length) return
        // o FreeShow grava pelo popup de modelo (trigger sincrono, popup ainda aberto); outra origem (backup, sincronia) so e solta
        const doOperador = get(activePopup) === "select_template"
        const pares = ids.map((id) => [id, String(a[id].template)] as const)
        setTimeout(() => {
            soltarModelosDasCategorias()
            if (doOperador) for (const [id, modelo] of pares) colarModeloNaCategoria(id, modelo)
        })
    })
}
