import { get } from "svelte/store"
import { uid } from "uid"
import type { Show, Slide } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { createCategory } from "../converters/importHelpers"
import { loadJsonBible } from "../components/drawer/bible/scripture"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"
import { setShow } from "../components/helpers/setShow"
import { categories, scriptures, scriptureSettings, shows } from "../stores"
import { bibliaDaVersao } from "./aliancaControle"

/**
 * Versiculo mandado pelo celular vira show, um slide por versiculo -- a regra
 * combinada com o Remote.
 *
 * O celular manda so a coordenada (traducao, livro, capitulo, versiculos); o
 * texto vem da Biblia instalada aqui. O id do show deriva da chave do item,
 * que por sua vez deriva da referencia: repetir o toque no celular sobrescreve
 * o item la, e aqui cai no mesmo show em vez de criar outro.
 *
 * Monta direto, sem passar pela gaveta de Biblia: aquele caminho usa a
 * selecao aberta na tela do operador, e mexer nela no meio do culto
 * atrapalharia quem esta projetando.
 */
export async function showDoVersiculo(item: { chave: string; nome?: string; versao?: string; livro: number; capitulo: number; versiculos: number[] }) {
    const showId = `remote_${item.chave}`.replace(/[^A-Za-z0-9_-]/g, "_")
    if (get(shows)[showId]) return showId

    const bibliaId = bibliaDaVersao(item.versao)
    if (!bibliaId) return null

    const biblia = await loadJsonBible(bibliaId)
    const livro = biblia?.data?.books?.[item.livro]
    if (!biblia || !livro) return null

    // A biblioteca nao avisa quando falta: capitulo ou versiculo inexistente
    // vira o PRIMEIRO, em silencio. A ARA nao tem Apocalipse 12:18 (numera
    // diferente da NVI) -- sem esta conferencia, projetaria o 12:1 no lugar.
    const dadosCapitulo = livro.chapters.find((c) => Number(c.number) === Number(item.capitulo))
    if (!dadosCapitulo) return null
    const existe = (n: number) => dadosCapitulo.verses.some((v) => Number(v.number) === n || (v.endNumber && n > Number(v.number) && n <= Number(v.endNumber)))
    const capitulo = biblia.getBook(livro.number).getChapter(Number(dadosCapitulo.number))

    const traducao = (get(scriptures)[bibliaId] as any)?.customName || get(scriptures)[bibliaId]?.name || ""
    const slides: { [id: string]: Slide } = {}
    const ordem: { id: string }[] = []

    for (const numero of (item.versiculos || []).map(Number)) {
        if (!existe(numero)) continue // versiculo que esta traducao nao tem
        const texto = capitulo.getVerse(numero).getText()
        if (!texto) continue

        const referencia = `${livro.name} ${capitulo.number}:${numero}${traducao ? ` ${traducao}` : ""}`
        const id = uid()
        slides[id] = {
            group: referencia,
            color: null,
            settings: {},
            notes: "",
            items: [
                { style: DEFAULT_ITEM_STYLE, align: "", lines: [{ align: "", text: [{ value: texto, style: "" }] }] },
                { style: DEFAULT_ITEM_STYLE, align: "", lines: [{ align: "", text: [{ value: referencia, style: "" }] }] }
            ]
        } as Slide
        ordem.push({ id })
    }
    if (!ordem.length) return null

    // mesma categoria dos versiculos montados pela gaveta de Biblia
    const categoria = get(categories).scripture ? "scripture" : createCategory("scripture", "scripture", { isDefault: true, isArchive: true })
    const layoutId = uid()
    const show: Show = new ShowObj(false, categoria, layoutId, Date.now(), get(scriptureSettings)?.template || "scripture")
    show.name = item.nome || ordem.map((s) => slides[s.id].group).join(", ")
    show.slides = slides
    show.layouts = { [layoutId]: { name: traducao, notes: "", slides: ordem } }
    show.reference = { type: "scripture", data: { collection: bibliaId, version: traducao, book: livro.number, chapter: capitulo.number, verses: [item.versiculos] } }

    await setShow(showId, show)
    return showId
}
