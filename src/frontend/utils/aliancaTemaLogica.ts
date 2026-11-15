// ----- AliançaShow · FV-A: quando o laranja e as fontes do Preparar entram -----
//
// Lógica pura (testada em aliancaTemaLogica.test.ts). Quem escreve os atributos no <body> é utils/aliancaTema.ts.
// O CSS (public/global.css, bloco FV) só casa sob `body[data-tema="padrao"]` e `body[data-fonte="prep"]`.

export const ACENTO_DE_FABRICA = "#f21a27"
export const FAMILIA_TEXTO = "AliancaUI Texto"
export const FAMILIA_TITULO = "AliancaUI Titulo"

export type TemaParaAtributo = { colors?: { secondary?: string }; font?: { family?: string } } | null | undefined

export type AtributosDoTema = { tema: "padrao" | null; fonte: "prep" | null }

/** Mesma condição de `updateThemeValues` (utils/updateSettings.ts): família vazia ou `sans-serif` = o tema não fixou fonte. */
export function fonteDoTemaEhLivre(family: string | undefined | null): boolean {
    return !family || family === "sans-serif"
}

/**
 * `tema = "padrao"` só no tema de fábrica (`id === "default"`) com o acento original. Quem editou o acento, trocou de tema
 * ou usa tema próprio não recebe o atributo e o app fica exatamente como era.
 * `fonte = "prep"` só no modo Preparar e só se o tema não fixou uma fonte (independe de `tema`).
 * `desligado` (special.aliancaVisual === false) é a chave técnica sem tela: tudo volta ao visual de antes.
 */
export function atributosDoTema(e: { id: string; tema: TemaParaAtributo; modo: string; desligado?: boolean }): AtributosDoTema {
    const nenhum: AtributosDoTema = { tema: null, fonte: null }
    if (e.desligado || !e.tema) return nenhum
    const acento = e.tema.colors?.secondary
    const tema = e.id === "default" && typeof acento === "string" && acento.toLowerCase() === ACENTO_DE_FABRICA ? "padrao" : null
    const fonte = e.modo === "preparar" && fonteDoTemaEhLivre(e.tema.font?.family) ? "prep" : null
    return { tema, fonte }
}
