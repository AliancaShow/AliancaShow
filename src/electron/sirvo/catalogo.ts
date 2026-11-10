// ----- AliançaShow · catálogo para o Sirvo (processo principal) -----
//
// Antes de mandar `show_publicar_catalogo`, o main acrescenta a cada música o
// que só o arquivo tem (primeira linha, artista, CCLI, trecho). Lê a
// pasta de shows com cache por data de modificação do arquivo: depois da
// primeira vez, só relê o que mudou. Tudo assíncrono — o main não trava.

import fs from "fs"
import path from "path"
import { getDataFolderPath } from "../utils/files"
import { detalhesDoShow, type DetalhesDaMusica } from "./catalogoDetalhes"

type Cacheado = { mtimeMs: number; id: string | null; detalhes: DetalhesDaMusica | null }
const cache = new Map<string, Cacheado>()

async function lerDetalhesDaPasta(): Promise<Map<string, DetalhesDaMusica>> {
    const pasta = getDataFolderPath("shows")
    const porId = new Map<string, DetalhesDaMusica>()
    let nomes: string[] = []
    try {
        nomes = await fs.promises.readdir(pasta)
    } catch {
        return porId
    }

    const vistos = new Set<string>()
    for (const nome of nomes) {
        if (!nome.toLowerCase().endsWith(".show")) continue
        const caminho = path.join(pasta, nome)
        vistos.add(caminho)
        try {
            const st = await fs.promises.stat(caminho)
            let c = cache.get(caminho)
            if (!c || c.mtimeMs !== st.mtimeMs) {
                const conteudo = await fs.promises.readFile(caminho, "utf8")
                let id: string | null = null
                let detalhes: DetalhesDaMusica | null = null
                try {
                    const show = JSON.parse(conteudo)
                    if (Array.isArray(show) && typeof show[0] === "string") {
                        id = show[0]
                        detalhes = detalhesDoShow(show[1])
                    }
                } catch {
                    // arquivo quebrado: a música vai sem detalhes
                }
                c = { mtimeMs: st.mtimeMs, id, detalhes }
                cache.set(caminho, c)
            }
            if (c.id && c.detalhes) porId.set(c.id, c.detalhes)
        } catch {
            // sumiu no meio da leitura: segue
        }
    }
    for (const k of [...cache.keys()]) if (!vistos.has(k)) cache.delete(k)
    return porId
}

/** Acrescenta os detalhes do arquivo a cada item `{show_id, …}`. Falhou a leitura: manda sem. */
export async function enriquecerCatalogo(itens: any[]): Promise<any[]> {
    let porId: Map<string, DetalhesDaMusica>
    try {
        porId = await lerDetalhesDaPasta()
    } catch {
        return itens
    }
    return itens.map((item) => {
        const d = porId.get(item?.show_id)
        return d ? { ...item, ...d } : item
    })
}
