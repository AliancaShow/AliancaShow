// Cabine 6 ("aprovo monitor-desconectado", 23/nov): o vigia do MONITOR de cada saida, na janela principal. Desenho: docs/passagem/referencia/desenho-monitor-desconectado.md
//   1. manda ao processo principal o registro de cada saida (screen, aliancaMonitor, tamanho, ligada) na carga e a cada mudanca (ALIANCA_MONITOR_REGISTRO);
//   2. carimba `aliancaMonitor` SO em gesto do operador (aliancaMonitorVigiaLogica.gestosDoOperador), lendo as telas NA HORA;
//   3. leva os avisos do processo principal (monitor desconectado / de volta / escala) para a linha de avisos;
//   4. aviso laranja para a saida com janela que ainda nao diz em que monitor fica (config antiga).
// Ligado uma vez por AliancaTela (so a janela principal).
import { get } from "svelte/store"
import { ALIANCA_MONITOR_AVISO, ALIANCA_MONITOR_REGISTRO, type AvisoMonitor } from "../../types/aliancaMonitorCanais"
import { Main } from "../../types/IPC/Main"
import { carimboDoMonitorInteiro, monitorDaJanela, type Monitor } from "../../electron/output/aliancaMonitorLogica"
import { requestMain } from "../IPC/main"
import { loaded, outputs } from "../stores"
import { avisar, resolverAviso } from "./aliancaAvisos"
import { falhaAlta } from "./aliancaFalha"
import { gestosDoOperador, precisaEscolherMonitor, registroDaSaida, registrosMudados, textoDoMonitor, trocaDoStoreInteiro, type SaidaVista } from "./aliancaMonitorVigiaLogica"

const ESCUTA = "alianca-monitor-saida"
const ESPERA_MS = 600
const chave = (id: string) => "monitor-saida:" + id
const chaveSemMonitor = (id: string) => "monitor-escolher:" + id

function foto(s: { [id: string]: any }): { [id: string]: SaidaVista } {
    const r: { [id: string]: SaidaVista } = {}
    for (const [id, o] of Object.entries(s || {})) r[id] = JSON.parse(JSON.stringify({ name: o?.name, enabled: o?.enabled, invisible: o?.invisible, alwaysOnTop: o?.alwaysOnTop, screen: o?.screen, bounds: o?.bounds, aliancaMonitor: o?.aliancaMonitor }))
    return r
}

export function ligarMonitoresDasSaidas(): () => void {
    const api = (window as any).api
    if (!api?.send || !api?.receive) {
        falhaAlta("monitor-vigia-sem-api", "window.api ausente: o monitor das saídas não é vigiado")
        return () => {}
    }

    const enviar = (ids: string[], s: { [id: string]: SaidaVista }) => {
        const lote = ids.filter((id) => s[id]).map((id) => registroDaSaida(id, s[id]))
        if (lote.length) api.send(ALIANCA_MONITOR_REGISTRO, lote)
    }

    // 3. avisos do processo principal
    api.receive(
        ALIANCA_MONITOR_AVISO,
        (a: AvisoMonitor) => {
            const nome = get(outputs)[a?.outputId]?.name || a?.nome || "Saída"
            const t = textoDoMonitor(a?.estado, nome, a?.monitor)
            if (!t) return falhaAlta("monitor-aviso-torto", JSON.stringify(a))
            if (a.estado === "voltou") resolverAviso(chave(a.outputId))
            avisar(t.texto, t.nivel, a.estado === "voltou" ? chave(a.outputId) + ":voltou" : chave(a.outputId), { fixo: t.fixo, soma: false })
        },
        ESCUTA
    )

    // 2. carimbo: espera o operador parar de digitar (o popup grava a cada tecla) e le as telas na hora
    const relogios = new Map<string, ReturnType<typeof setTimeout>>()
    function carimbar(id: string, como: "screen" | "janela") {
        const t = relogios.get(id)
        if (t) clearTimeout(t)
        relogios.set(
            id,
            setTimeout(async () => {
                relogios.delete(id)
                const telas = ((await requestMain(Main.GET_DISPLAYS)) || []) as unknown as Monitor[]
                const s: any = get(outputs)[id]
                if (!s || s.invisible) return
                let c = null
                if (como === "screen") {
                    const m = telas.find((d) => String(d.id) === String(s.screen))
                    if (!m) return // a tela escolhida sumiu no meio: o processo principal ja marca DESCONECTADO
                    c = carimboDoMonitorInteiro(m)
                } else {
                    c = s.bounds ? monitorDaJanela({ x: Number(s.bounds.x) || 0, y: Number(s.bounds.y) || 0, width: Number(s.bounds.width) || 0, height: Number(s.bounds.height) || 0 }, telas) : null
                    if (!c) {
                        const tx = textoDoMonitor("fora-das-telas", s.name || "Saída", "")!
                        avisar(tx.texto, tx.nivel, chave(id) + ":fora")
                        return
                    }
                }
                if (JSON.stringify(s.aliancaMonitor || null) === JSON.stringify(c)) return
                outputs.update((a: any) => {
                    if (a[id]) a[id].aliancaMonitor = c
                    return a
                })
            }, ESPERA_MS)
        )
    }

    // 1 + 4. registro e carimbo a cada mudanca das saidas
    let antes: { [id: string]: SaidaVista } | null = null
    function olhar() {
        if (!get(loaded)) return
        const agora = foto(get(outputs))
        if (antes && trocaDoStoreInteiro(antes, agora)) antes = null // outro perfil: nova carga inicial, sem carimbo
        const g = gestosDoOperador(antes, agora)
        g.peloScreen.forEach((id) => carimbar(id, "screen"))
        g.pelaJanela.forEach((id) => carimbar(id, "janela"))
        enviar(registrosMudados(antes, agora), agora)
        for (const [id, s] of Object.entries(agora)) {
            if (precisaEscolherMonitor(s)) {
                const tx = textoDoMonitor("sem-monitor", s.name || "Saída", "")!
                if (!antes || !antes[id] || !precisaEscolherMonitor(antes[id])) avisar(tx.texto, tx.nivel, chaveSemMonitor(id), { soma: false })
            } else if (antes?.[id] && precisaEscolherMonitor(antes[id])) resolverAviso(chaveSemMonitor(id))
        }
        antes = agora
    }
    const soltarSaidas = outputs.subscribe(olhar)
    const soltarCarga = loaded.subscribe(olhar)

    return () => {
        api?.removeListener?.(ALIANCA_MONITOR_AVISO, ESCUTA)
        soltarSaidas()
        soltarCarga()
        relogios.forEach((t) => clearTimeout(t))
        relogios.clear()
    }
}
