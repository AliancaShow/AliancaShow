// A TELA PRINCIPAL (Andre, 25/nov, "aprovo papeis-saida"): uma regra so para a coluna No ar (a tela grande), a faixa de transporte e o editor
// (proporcao). Antes o editor seguia a "primeira saida ativa" do FreeShow (ORDEM ALFABETICA: NDI-Alpha 1920x1080 antes de Painel LED 896x320) e a
// coluna No ar pegava a primeira com janela contando o RETORNO (com o Retorno antes do Painel LED na lista, o retorno virava a tela grande).
// Agora: a escolhida em Telas ("Saida principal", special.aliancaSaidaPrincipal) quando ligada e de slides; senao a primeira de slides com janela;
// senao a primeira de slides (so NDI). Retorno nunca e a principal. Pura, sem imports (o fecho da janela de saida importa este arquivo).

type SaidaMinima = {
    enabled?: boolean
    invisible?: boolean
    stageOutput?: string | boolean
}
type Saidas = Record<string, SaidaMinima | undefined> | null | undefined

const deSlides = (o: SaidaMinima | undefined) => !!o?.enabled && !o?.stageOutput

/** id da tela principal; "" = nenhuma saida de slides ligada */
export function telaPrincipal(outputs: Saidas, escolhida?: string | null): string {
    const lista = outputs || {}
    if (escolhida && deSlides(lista[escolhida])) return escolhida
    const slides = Object.entries(lista).filter(([, o]) => deSlides(o))
    return (slides.find(([, o]) => !o?.invisible) || slides[0])?.[0] || ""
}

/** id da saida cuja proporcao o editor mostra (a principal); "" = o getResolution volta ao comportamento do FreeShow */
export function saidaDoEditor(outputs: Saidas, escolhida?: string | null): string {
    return telaPrincipal(outputs, escolhida)
}
