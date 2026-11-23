// Cabine 6, passo intermediario do video (fatia A, D3/D28): as previas da janela principal ("No ar", "Outras telas") e o espelho
// "saida atual" do retorno mostram a CAPTURA AO VIVO da janela da saida, em vez de montar outro <Video> que decodifica o arquivo de novo.
// Aqui so a decisao pura (testavel): com o estado da janela vindo do processo principal, capturar ou mostrar o quadro parado, e o que dizer.
//
// Regra do dono: sem caminho de reserva calado. Opcao (b) do Andre (22/nov): saida DESLIGADA (sem janela visivel de proposito) = previa
// DESENHADA como antes, com o video como miniatura parada (nunca decodifica). Problema (minimizada sem querer, caida, sem resposta) = ultimo
// quadro + selo laranja/vermelho.
import type { FonteSaida } from "../../types/aliancaSaidaCanais"

export type MotivoParada = "carregando" | "sem-janela" | "desligada" | "minimizada" | "caida" | "erro"

export type EstadoPrevia = { aoVivo: true; fonteId: string } | { aoVivo: false; motivo: MotivoParada }

/** `fonte` = resposta do processo principal (null = nao respondeu no prazo) */
export function estadoDaFonte(fonte: FonteSaida | null | undefined): EstadoPrevia {
    if (!fonte) return { aoVivo: false, motivo: "erro" }
    if (fonte.caida) return { aoVivo: false, motivo: "caida" }
    if (!fonte.existe || !fonte.fonteId) return { aoVivo: false, motivo: "sem-janela" }
    if (fonte.minimizada) return { aoVivo: false, motivo: "minimizada" }
    if (!fonte.visivel) return { aoVivo: false, motivo: "desligada" }
    return { aoVivo: true, fonteId: fonte.fonteId }
}

/** a captura aberta continua servindo? (mesma janela e trilha viva) */
export function capturaContinua(fonteAtual: string | null, trilhaViva: boolean, novo: EstadoPrevia): boolean {
    return novo.aoVivo && trilhaViva && fonteAtual === novo.fonteId
}

/** neutro = estado normal (D14: laranja so para problema); alerta = algo errado; queda = vermelho */
export type TomParada = "neutro" | "alerta" | "queda"

export function textoParado(motivo: MotivoParada, nome: string, invisivel = false): { texto: string; tom: TomParada } {
    const n = nome || "Saída"
    switch (motivo) {
        case "carregando":
            return { texto: `Abrindo a imagem de ${n}…`, tom: "neutro" }
        case "sem-janela":
            return { texto: `${n}: janela não aberta · sem imagem ao vivo`, tom: "neutro" }
        case "desligada":
            return invisivel ? { texto: `${n} só captura (sem janela visível) · sem imagem ao vivo`, tom: "neutro" } : { texto: `${n} desligado · sem imagem ao vivo`, tom: "neutro" }
        case "minimizada":
            return { texto: `${n} minimizado · sem imagem ao vivo`, tom: "alerta" }
        case "caida":
            return { texto: `${n} caiu · recriando`, tom: "queda" }
        case "erro":
            return { texto: `Sem imagem de ${n} · tentando de novo`, tom: "alerta" }
    }
}

/** limites pedidos ao capturador: a previa e pequena (corta copia de quadro); o espelho do retorno pode ir a 1080p */
export function limitesDaCaptura(uso: "previa" | "espelho"): { maxWidth: number; maxHeight: number; maxFrameRate: number } {
    return uso === "previa" ? { maxWidth: 960, maxHeight: 540, maxFrameRate: 30 } : { maxWidth: 1920, maxHeight: 1080, maxFrameRate: 30 }
}

/** o espelho "saida atual" mirando a PROPRIA janela (modo so retorno sem fonte explicita) nao pode capturar a si mesmo: desenha o conteudo */
export function espelhoDeSiMesmo(alvo: string, propria: string | null | undefined): boolean {
    return !!alvo && !!propria && alvo === propria
}

/** saida desligada ou sem janela visivel de proposito (inclui as so de captura): a previa desenha o slide */
export function motivoDesenhavel(motivo: MotivoParada | null): boolean {
    return motivo === "desligada" || motivo === "sem-janela" || motivo === "carregando"
}

/**
 * O que a previa mostra agora. `desenhando` e o estado anterior: a troca para a captura so acontece no 1o quadro capturado (sem piscar),
 * e problema (erro/minimizada/caida) nao troca a camada de baixo, so poe o selo.
 */
export function proximoDesenho(desenhando: boolean, motivo: MotivoParada | null, podeDesenhar: boolean, primeiroQuadro: boolean): boolean {
    if (!podeDesenhar) return false
    if (motivo === null) return primeiroQuadro ? false : desenhando
    if (motivoDesenhavel(motivo)) return true
    return desenhando
}

/** selo por cima: na previa desenhada o estado normal (desligada) nao leva selo, como antes; problema sempre leva */
export function mostraSelo(tom: TomParada, desenhando: boolean): boolean {
    return !(desenhando && tom === "neutro")
}

export const CONFERIR_MS = 1500
export const PRAZO_FONTE_MS = 3000
