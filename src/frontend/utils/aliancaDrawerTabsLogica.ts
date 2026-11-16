// `drawerTabsData` por modo (fatia 0b): so a pasta e o filtro da F7 (media.activeSubTab e media.aliancaFiltro) sao de cada modo.
// Todo o resto do store segue compartilhado como hoje (enabled, correcoes guiadas por dado, openedSubSubTab...), ver aliancaPorModoLogica.ts.
// Logica pura (sem stores).
import { idDaAba } from "./aliancaPastasMidiaLogica"

type Aba = { enabled?: boolean; activeSubTab?: string | null; aliancaFiltro?: string[]; [k: string]: any }
export type DadosDasAbas = { [aba: string]: Aba }

/** campos da aba de midia que cada modo guarda por si */
export const CAMPOS_POR_MODO_NA_MIDIA = ["activeSubTab", "aliancaFiltro"] as const

const copia = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))

/**
 * O valor que o OUTRO lado passa a ter depois de uma escrita no lado `escrito`: tudo o que o lado escrito tem (copiado, nunca
 * a mesma referencia), menos os campos por modo da midia, que o outro lado mantem os dele.
 */
export function comunsDrawerTabs(escrito: DadosDasAbas, outro: DadosDasAbas): DadosDasAbas {
    const novo = copia(escrito) || {}
    const doOutro = outro?.media
    if (novo.media) {
        for (const c of CAMPOS_POR_MODO_NA_MIDIA) {
            if (doOutro && c in doOutro) (novo.media as any)[c] = copia((doOutro as any)[c])
            else delete (novo.media as any)[c]
        }
    } else if (doOutro) {
        novo.media = copia(doOutro)
    }
    return novo
}

/**
 * Pasta de midia que nao existe mais: se a aba ativa da midia e `pasta:<id>` (nao a raiz nem o Sirvo) e o id nao esta entre as pastas
 * vivas, volta para "all". Devolve o MESMO objeto quando nao ha o que corrigir (quem chama nao regrava a toa).
 * Limite declarado: ids de provedor e abas embutidas ("all", "favourites", "inputs", "online") nao sao tocados.
 */
export function sanearAbaMidia(dados: DadosDasAbas, idsDePastasVivas: string[]): DadosDasAbas {
    const ativa = dados?.media?.activeSubTab
    const id = idDaAba(ativa)
    if (!id || idsDePastasVivas.includes(id)) return dados
    return { ...dados, media: { ...dados.media, activeSubTab: "all" } }
}
