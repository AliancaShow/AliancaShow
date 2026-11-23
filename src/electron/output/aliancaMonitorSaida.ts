// Cabine 6 ("aprovo monitor-desconectado", 23/nov): a saida presa ao MONITOR. Desenho: docs/passagem/referencia/desenho-monitor-desconectado.md
//   - registro por saida (screen, aliancaMonitor, tamanho, ligada): o processo principal guarda so uma copia feita na CRIACAO da janela e o
//     UPDATE_BOUNDS nao traz screen/aliancaMonitor (revisao cetica, achado 1). A janela principal manda cada mudanca por ALIANCA_MONITOR_REGISTRO.
//   - DESCONECTADO: o monitor da saida nao esta ligado. A janela fica ESCONDIDA, nada da configuracao muda, a saida continua ligada e o aviso
//     vermelho fica na linha de avisos. Quando o monitor volta (mesmo Display.id), ela volta sozinha. Nunca vai para o monitor que ficou no lugar.
// Ligado por OutputVisibility (a unica mudanca no fecho). As funcoes de janela entram por `ligarMonitores` para nao criar ciclo de import.
import { ipcMain, screen, type BrowserWindow, type Rectangle } from "electron"
import { toApp } from ".."
import { ALIANCA_MONITOR_AVISO, ALIANCA_MONITOR_REGISTRO, type AliancaMonitor, type AvisoMonitor, type EstadoMonitor, type RegistroMonitor } from "../../types/aliancaMonitorCanais"
import { destinoDaSaida, type Destino, type Monitor } from "./aliancaMonitorLogica"

type Registro = {
    nome: string
    screen: string | null
    aliancaMonitor: AliancaMonitor | null
    bounds: Rectangle | null
    invisible: boolean
    alwaysOnTop: boolean
    /** o operador quer a janela no ar (TOGGLE_OUTPUTS com state true); desligar limpa, para nao voltar sozinha uma saida desligada */
    ligada: boolean
}

type Janelas = {
    janelaDe: (id: string) => BrowserWindow | null | undefined
    mostrar: (janela: BrowserWindow, acimaDasOutras: boolean) => void
    esconder: (janela: BrowserWindow) => void
    posicionar: (id: string, bounds: Rectangle) => void
}

const registros = new Map<string, Registro>()
/** saida -> nome do monitor que sumiu */
const desconectadas = new Map<string, string>()
let janelas: Janelas | null = null

export function monitoresDoSistema(): Monitor[] {
    return screen.getAllDisplays().map((d) => ({ id: d.id, label: d.label, bounds: { ...d.bounds }, scaleFactor: d.scaleFactor }))
}

function avisar(outputId: string, estado: EstadoMonitor, monitor: string) {
    const nome = registros.get(outputId)?.nome || outputId
    const aviso: AvisoMonitor = { outputId, nome, estado, monitor, em: Date.now() }
    if (estado === "desconectado") console.error("[AliancaShow] saida", nome, "monitor desconectado:", monitor)
    else console.info("[AliancaShow] saida", nome, estado, monitor)
    toApp(ALIANCA_MONITOR_AVISO, aviso)
}

function registro(id: string): Registro {
    let r = registros.get(id)
    if (!r) {
        r = { nome: "", screen: null, aliancaMonitor: null, bounds: null, invisible: false, alwaysOnTop: true, ligada: false }
        registros.set(id, r)
    }
    return r
}

function aplicarDados(id: string, d: Partial<RegistroMonitor> & { name?: string }) {
    const r = registro(id)
    if (d.nome !== undefined || d.name !== undefined) r.nome = String(d.nome ?? d.name ?? "")
    if ("screen" in d) r.screen = d.screen === undefined || d.screen === "" ? null : (d.screen ?? null)
    if ("aliancaMonitor" in d) r.aliancaMonitor = d.aliancaMonitor || null
    if (d.bounds) r.bounds = { x: Number(d.bounds.x) || 0, y: Number(d.bounds.y) || 0, width: Number(d.bounds.width) || 0, height: Number(d.bounds.height) || 0 }
    if (d.invisible !== undefined) r.invisible = !!d.invisible
    if (d.alwaysOnTop !== undefined) r.alwaysOnTop = d.alwaysOnTop !== false
}

/** o destino da saida pelo registro (o mais novo) */
export function destinoRegistrado(id: string, saida?: { screen?: string | null; aliancaMonitor?: AliancaMonitor | null; bounds?: Partial<Rectangle> | null }): Destino {
    const r = registros.get(id)
    const s = r ? { screen: r.screen, aliancaMonitor: r.aliancaMonitor, bounds: r.bounds || saida?.bounds } : saida || {}
    return destinoDaSaida(s, monitoresDoSistema())
}

/** TOGGLE_OUTPUTS de uma saida com janela: guarda o que o operador mandou */
export function aoAlternar(output: RegistroMonitor & { id?: string; name?: string; aliancaMonitor?: AliancaMonitor | null }, ligar: boolean): Destino {
    const id = String(output.id || output.outputId || "")
    aplicarDados(id, { ...output, screen: output.screen ?? null, aliancaMonitor: output.aliancaMonitor ?? null })
    const r = registro(id)
    r.ligada = ligar && !r.invisible
    if (!r.ligada) {
        if (desconectadas.delete(id)) avisar(id, "voltou", "desligada pelo operador")
        return destinoRegistrado(id)
    }
    const d = destinoRegistrado(id)
    marcar(id, d)
    return d
}

/** liga/desliga o estado DESCONECTADO de uma saida e avisa so na mudanca */
function marcar(id: string, d: Destino) {
    if (d.tipo === "desconectado") {
        if (desconectadas.get(id) !== d.monitor) avisar(id, "desconectado", d.monitor)
        desconectadas.set(id, d.monitor)
        return
    }
    const sumido = desconectadas.get(id)
    if (sumido !== undefined) {
        desconectadas.delete(id)
        avisar(id, "voltou", d.tipo === "antigo" ? sumido : d.monitor.label || String(d.monitor.id))
    }
    if (d.tipo === "dentro-do-monitor" && d.escalaMudou) avisar(id, "escala", d.monitor.label || String(d.monitor.id))
}

export const estaDesconectada = (id: string) => desconectadas.has(id)

/** reavalia uma saida ligada: esconde se o monitor sumiu; traz de volta (no lugar certo) se voltou */
function reavaliar(id: string) {
    const r = registros.get(id)
    if (!r || !r.ligada || r.invisible || !janelas) return
    const janela = janelas.janelaDe(id)
    if (!janela || janela.isDestroyed()) return
    const estava = desconectadas.has(id)
    const d = destinoRegistrado(id)
    marcar(id, d)
    if (d.tipo === "desconectado") {
        if (janela.isVisible()) janelas.esconder(janela)
        return
    }
    if (d.tipo === "antigo") {
        if (estava && r.bounds) {
            janelas.posicionar(id, r.bounds)
            janelas.mostrar(janela, r.alwaysOnTop)
        }
        return
    }
    const atual = janela.getBounds()
    if (JSON.stringify(atual) !== JSON.stringify(d.bounds)) janelas.posicionar(id, d.bounds)
    if (estava || !janela.isVisible()) janelas.mostrar(janela, r.alwaysOnTop)
}

function reavaliarTodas() {
    registros.forEach((_r, id) => reavaliar(id))
}

// canal da janela principal: registrado no CARREGAMENTO do modulo (antes do primeiro TOGGLE_OUTPUTS), para a primeira escolha nao se perder
ipcMain.on(ALIANCA_MONITOR_REGISTRO, (_e, dados: RegistroMonitor | RegistroMonitor[]) => {
    for (const d of Array.isArray(dados) ? dados : [dados]) {
        const id = String(d?.outputId || "")
        if (!id) continue
        aplicarDados(id, d)
        if (d.enabled === false) {
            const r = registro(id)
            r.ligada = false
            if (desconectadas.delete(id)) avisar(id, "voltou", "saída desabilitada")
            continue
        }
        // escolha nova do operador: vale na hora (revisao cetica, achado 2)
        reavaliar(id)
    }
})

let escutando = false
/** primeiro TOGGLE_OUTPUTS (o app ja esta pronto: `screen` so funciona depois do ready): funcoes de janela + escutadores de monitor proprios */
export function ligarMonitores(j: Janelas) {
    janelas = j
    if (escutando) return
    escutando = true
    // display-removed: esconde NA HORA (o Windows ja puxou o vizinho para o lugar do que sumiu)
    screen.on("display-removed", () => reavaliarTodas())
    // added/metrics: depois da reposicao do OutputLifecycle (500/1000 ms), para nao brigar com ela
    screen.on("display-added", () => setTimeout(reavaliarTodas, 1200))
    screen.on("display-metrics-changed", () => setTimeout(reavaliarTodas, 700))
}
