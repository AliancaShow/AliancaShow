// Cabine 6, passo intermediario do video (fatia A):
//   1) F1, vigia de queda: `render-process-gone`, `unresponsive` e uma batida do processo principal nas janelas de saida. Antes, se o processo de uma saida caia, a janela
//      ficava morta e ninguem era avisado. Agora a janela principal e avisada ALTO (canal ALIANCA_QUEDA_SAIDA) e a pagina da saida e
//      recarregada na MESMA janela (mesmo lugar, mesmo tamanho, mesma fonte de captura). Trava: espera TRAVA_MS, derruba o processo e
//      recarrega. Quedas duplicadas contam uma vez; mais de MAX_RECRIAR em 60 s = "fora do ar", sem laco.
//   2) fonte de captura da janela de uma saida (canal ALIANCA_FONTE_SAIDA), pedida pelo ID da saida -> `getMediaSourceId()` da janela
//      dela. Nunca pelo titulo. Usada pelas previas da janela principal e pelo espelho "saida atual" do retorno.
import { app, ipcMain, type BrowserWindow, type IpcMainEvent } from "electron"
import { toApp } from ".."
import { ALIANCA_FONTE_SAIDA, ALIANCA_QUEDA_SAIDA, type EstadoQueda, type FonteSaida, type QuedaSaida } from "../../types/aliancaSaidaCanais"
import { BATIDA_LIMITE_MS, BATIDA_MS, concluirRecuperacao, decidirQueda, quedaDeVerdade, RECARGA_MS, TRAVA_MS, type RegistroQueda } from "./aliancaVigiaLogica"

type Janelas = { janelaDe: (outputId: string) => BrowserWindow | null | undefined }

const registros = new Map<string, RegistroQueda>()
const travas = new Map<string, NodeJS.Timeout>()
const recargas = new Map<string, NodeJS.Timeout>()
const caidas = new Set<string>()
let encerrando = false
let ligado = false

function avisar(outputId: string, nome: string, estado: EstadoQueda, motivo: string, ms?: number) {
    const aviso: QuedaSaida = { outputId, nome, estado, motivo, em: Date.now(), ...(ms === undefined ? {} : { ms }) }
    if (estado === "caiu" || estado === "travou" || estado === "fora") console.error("[AliancaShow] saida", nome, estado, motivo)
    else console.info("[AliancaShow] saida", nome, estado, motivo, ms ?? "")
    toApp(ALIANCA_QUEDA_SAIDA, aviso)
}

/** uma vez, na partida (OutputLifecycle.initListeners) */
export function ligarVigia(janelas: Janelas) {
    if (ligado) return
    ligado = true
    app.on("before-quit", () => (encerrando = true))

    ipcMain.on(ALIANCA_FONTE_SAIDA, (e: IpcMainEvent, data: { outputId?: string } | undefined, listenerId?: string) => {
        const outputId = String(data?.outputId || "")
        const janela = outputId ? janelas.janelaDe(outputId) : null
        const viva = !!janela && !janela.isDestroyed()
        let fonteId: string | null = null
        try {
            fonteId = viva ? janela!.getMediaSourceId() : null
        } catch (err) {
            console.error("[AliancaShow] getMediaSourceId falhou", outputId, err)
        }
        const resposta: FonteSaida = {
            outputId,
            fonteId,
            existe: viva,
            visivel: viva && janela!.isVisible(),
            minimizada: viva && janela!.isMinimized(),
            caida: caidas.has(outputId)
        }
        if (!e.sender.isDestroyed()) e.reply(ALIANCA_FONTE_SAIDA, resposta, listenerId)
    })
}

/** cada janela de saida criada (OutputLifecycle.setWindowListeners) */
export function vigiarSaida(janela: BrowserWindow, outputId: string, nomeInicial: string) {
    const wc = janela.webContents
    const nome = () => {
        try {
            return (!janela.isDestroyed() && janela.getTitle()) || nomeInicial || "Saída"
        } catch {
            return nomeInicial || "Saída"
        }
    }
    const soltarTrava = () => {
        const t = travas.get(outputId)
        if (t) clearTimeout(t)
        travas.delete(outputId)
    }

    const queda = (motivo: string) => {
        if (encerrando || janela.isDestroyed() || wc.isDestroyed()) return
        soltarTrava()
        const { acao, registro } = decidirQueda(registros.get(outputId), Date.now())
        registros.set(outputId, registro)
        if (acao === "ignorar") return
        caidas.add(outputId)
        if (acao === "desistir") return avisar(outputId, nome(), "fora", motivo + " (caiu de novo: não recria mais sozinho)")
        avisar(outputId, nome(), "caiu", motivo)
        recarregar(1)
    }

    // 1a tentativa: reload; sem `did-finish-load` em RECARGA_MS, 2a: loadURL da ultima pagina boa; sem resposta de novo: "fora do ar" (alto)
    let ultimaUrl = ""
    const recarregar = (tentativa: number) => {
        soltarRecarga()
        setTimeout(() => {
            if (janela.isDestroyed() || wc.isDestroyed()) return
            try {
                if (tentativa === 1 || !ultimaUrl) wc.reload()
                else wc.loadURL(ultimaUrl)
            } catch (err) {
                console.error("[AliancaShow] recarregar saida falhou", outputId, tentativa, err)
            }
            recargas.set(
                outputId,
                setTimeout(() => {
                    recargas.delete(outputId)
                    if (janela.isDestroyed() || !registros.get(outputId)?.recuperando) return
                    if (tentativa < 2) return recarregar(tentativa + 1)
                    registros.set(outputId, { ...registros.get(outputId)!, recuperando: false })
                    avisar(outputId, nome(), "fora", "a tela não voltou depois de recarregar duas vezes")
                }, RECARGA_MS)
            )
        }, 100)
    }
    const soltarRecarga = () => {
        const t = recargas.get(outputId)
        if (t) clearTimeout(t)
        recargas.delete(outputId)
    }

    wc.on("render-process-gone", (_e, detalhes) => {
        if (!quedaDeVerdade(detalhes?.reason)) return
        queda("processo da tela caiu (" + detalhes.reason + (detalhes.exitCode ? ", código " + detalhes.exitCode : "") + ")")
    })

    // trava: aviso alto ja; se nao voltar em TRAVA_MS, derruba o processo travado e o render-process-gone que vem em seguida recarrega
    const travou = (motivo: string) => {
        if (encerrando || travas.has(outputId) || janela.isDestroyed()) return
        avisar(outputId, nome(), "travou", motivo)
        travas.set(
            outputId,
            setTimeout(() => {
                travas.delete(outputId)
                if (janela.isDestroyed() || wc.isDestroyed()) return
                wc.forcefullyCrashRenderer()
            }, TRAVA_MS)
        )
    }
    const respondeu = () => {
        if (!travas.has(outputId)) return
        soltarTrava()
        avisar(outputId, nome(), "respondeu", "a tela voltou a responder sozinha")
    }

    // `unresponsive` do Electron so dispara com entrada (teclado/mouse) sem resposta, e a saida nao recebe entrada: um laco travado na
    // tela passava 2 min sem aviso (medido). Por isso o processo principal bate na pagina a cada BATIDA_MS; sem resposta em
    // BATIDA_LIMITE_MS = travou.
    janela.on("unresponsive", () => travou("a tela parou de responder"))
    janela.on("responsive", respondeu)
    let batidaDesde: number | null = null
    const batida = setInterval(() => {
        if (encerrando || janela.isDestroyed() || wc.isDestroyed()) return
        if (registros.get(outputId)?.recuperando || caidas.has(outputId) || wc.isLoading() || wc.isCrashed()) {
            batidaDesde = null
            return
        }
        if (batidaDesde !== null) {
            if (Date.now() - batidaDesde > BATIDA_LIMITE_MS) travou(`a tela não responde há ${Math.round((Date.now() - batidaDesde) / 1000)} s`)
            return
        }
        const t = Date.now()
        batidaDesde = t
        wc.executeJavaScript("1")
            .then(() => {
                if (batidaDesde !== t) return
                batidaDesde = null
                respondeu()
            })
            .catch(() => {
                if (batidaDesde === t) batidaDesde = null
            })
    }, BATIDA_MS)

    wc.on("did-finish-load", () => {
        soltarRecarga()
        try {
            ultimaUrl = wc.getURL() || ultimaUrl
        } catch (err) {
            console.error("[AliancaShow] getURL da saida falhou", outputId, err)
        }
        const { ms, registro } = concluirRecuperacao(registros.get(outputId), Date.now())
        registros.set(outputId, registro)
        caidas.delete(outputId)
        if (ms !== null) avisar(outputId, nome(), "voltou", "a tela foi recriada", ms)
    })

    janela.on("closed", () => {
        clearInterval(batida)
        soltarTrava()
        soltarRecarga()
        registros.delete(outputId)
        caidas.delete(outputId)
    })
}
