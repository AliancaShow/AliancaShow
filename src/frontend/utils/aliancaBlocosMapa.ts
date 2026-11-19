// Cabine 4, pedido 2: o MAPA dos blocos das propriedades do Editar (qual bloco fica a vista, qual vai em Mais/Avancado, e o rotulo de cada um).
// Parte do mapa aprovado (`mapaDeGrupos`, no fecho da janela de saida: nao pode mudar) e o reorganiza para a prancha C4. So reorganiza: nenhum input some.
import { mapaDeGrupos, type Grupo, type MapaGrupos } from "./aliancaEditorLogica"

type SecoesBrutas = Parameters<typeof mapaDeGrupos>[2]

/** rotulos dos blocos da prancha C4 (caixa alta no painel): FONTE, ALINHAMENTO, TEXTO, LINHAS abertos; o raro recolhido */
const ROTULOS_TEXTO: Record<string, string> = {
    "vista:default": "Fonte",
    "vista:align": "Alinhamento",
    "vista:text": "Texto",
    "vista:lines": "Linhas",
    "mais:outline": "Contorno",
    "mais:shadow": "Sombra do texto",
    "mais:list": "Lista",
    "mais:chords": "Acordes",
    "avancado:scrolling": "Rolagem",
    "avancado:special": "Especiais"
}

export function mapaDeBlocos(origem: "box" | "item", tipo: string, secoes: SecoesBrutas): MapaGrupos | null {
    const m = mapaDeGrupos(origem, tipo, secoes)
    if (!m) return null
    if (origem === "item") return { ...m, rotulos: { ...m.rotulos, "vista:position": "Posição" } }
    if (tipo === "media") return { ...m, rotulos: { ...m.rotulos, "vista:default": "Mídia" } }
    if (tipo !== "text") return m
    // o texto: Texto e Linhas sobem de Mais para a vista (o operador mexe toda hora); o resto raro continua recolhido
    const mais = { ...m.mais }
    const vista = { ...m.vista }
    for (const id of ["text", "lines"]) {
        if (mais[id]) {
            vista[id] = mais[id]
            delete mais[id]
        }
    }
    return { vista, mais, avancado: m.avancado, rotulos: { ...m.rotulos, ...ROTULOS_TEXTO } }
}

/** os grupos que um bloco pode estar */
export const GRUPOS: Grupo[] = ["vista", "mais", "avancado"]
