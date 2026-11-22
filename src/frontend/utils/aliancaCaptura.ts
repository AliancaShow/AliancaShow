// Cabine 6 (fatia A): o encanamento da captura da janela de uma saida. Pede ao processo principal a fonte PELO ID DA SAIDA
// (ALIANCA_FONTE_SAIDA -> BrowserWindow.getMediaSourceId da janela dela; nunca pelo titulo) e abre a captura com getUserMedia "desktop".
// Serve as duas janelas: a principal (previas) e a de saida (espelho "saida atual" do retorno).
import { uid } from "uid"
import { ALIANCA_FONTE_SAIDA, type FonteSaida } from "../../types/aliancaSaidaCanais"
import { PRAZO_FONTE_MS, limitesDaCaptura } from "./aliancaCapturaLogica"

/** null = o processo principal nao respondeu no prazo */
export function pedirFonte(outputId: string, prazo = PRAZO_FONTE_MS): Promise<FonteSaida | null> {
    const api = (window as any).api
    if (!api) return Promise.resolve(null)
    const escuta = ALIANCA_FONTE_SAIDA + uid(6)
    return new Promise((resolve) => {
        let feito = false
        const fim = (v: FonteSaida | null) => {
            if (feito) return
            feito = true
            clearTimeout(relogio)
            api.removeListener(ALIANCA_FONTE_SAIDA, escuta)
            resolve(v)
        }
        const relogio = setTimeout(() => fim(null), prazo)
        api.receive(
            ALIANCA_FONTE_SAIDA,
            (resposta: FonteSaida, id?: string) => {
                if (id === escuta) fim(resposta)
            },
            escuta
        )
        api.send(ALIANCA_FONTE_SAIDA, { outputId }, escuta)
    })
}

export async function abrirCaptura(fonteId: string, uso: "previa" | "espelho"): Promise<MediaStream> {
    const lim = limitesDaCaptura(uso)
    return navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: fonteId, ...lim } } as any
    })
}

export function fecharCaptura(fluxo: MediaStream | null | undefined) {
    fluxo?.getTracks().forEach((t) => t.stop())
}
