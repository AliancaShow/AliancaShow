// Cabine 6 (F1, vigia de queda): liga o canal ALIANCA_QUEDA_SAIDA (processo principal) a LINHA DE AVISOS da janela principal.
// Substitui a faixa fixa AliancaQuedaSaida.svelte (Andre, 23/nov: nada flutua por cima do conteudo). O texto e o nivel: aliancaQuedaLogica.ts.
// Cada queda tambem vai para falhaAlta (erro interno na mesma linha + rastro em disco), como antes. Ligado uma vez por AliancaTela (so a janela principal).
import { get } from "svelte/store"
import { ALIANCA_QUEDA_SAIDA, type QuedaSaida } from "../../types/aliancaSaidaCanais"
import { outputs } from "../stores"
import { avisar, resolverAviso } from "./aliancaAvisos"
import { falhaAlta } from "./aliancaFalha"
import { aindaFora, avisoDaQueda, chaveDaQueda, quedasSemSaida } from "./aliancaQuedaLogica"

const ESCUTA = "alianca-queda-saida"

export function ligarQuedasNosAvisos(): () => void {
    /** o ultimo evento de cada saida com aviso na linha */
    const ultimo = new Map<string, QuedaSaida>()
    const relogios = new Map<string, ReturnType<typeof setTimeout>>()
    const soltarRelogio = (id: string) => {
        const t = relogios.get(id)
        if (t) clearTimeout(t)
        relogios.delete(id)
    }
    const resolver = (id: string) => {
        soltarRelogio(id)
        ultimo.delete(id)
        resolverAviso(chaveDaQueda(id))
    }

    function receber(aviso: QuedaSaida) {
        const nome = get(outputs)[aviso?.outputId]?.name
        const r = avisoDaQueda(aviso, nome, ultimo.get(aviso?.outputId)?.estado)
        if (!r) return falhaAlta("saida-aviso-torto", JSON.stringify(aviso))
        if (aindaFora(aviso.estado)) falhaAlta("saida-" + aviso.estado + ":" + (nome || aviso.nome || aviso.outputId), aviso.motivo)
        soltarRelogio(aviso.outputId)
        ultimo.set(aviso.outputId, aviso)
        avisar(r.novo.texto, r.novo.nivel, r.novo.chave, { fixo: r.novo.fixo, soma: r.novo.soma })
        if (r.someEm !== null) {
            relogios.set(
                aviso.outputId,
                setTimeout(() => {
                    if (ultimo.get(aviso.outputId) === aviso) resolver(aviso.outputId)
                }, r.someEm)
            )
        }
    }

    const api = (window as any).api
    if (!api?.receive) falhaAlta("saida-vigia-sem-api", "window.api.receive ausente: as quedas da saida nao chegam a linha de avisos")
    else api.receive(ALIANCA_QUEDA_SAIDA, receber, ESCUTA)

    // a saida apagada (ou desabilitada) leva o aviso dela junto: sem janela, nao ha mais o que vigiar
    const soltarSaidas = outputs.subscribe((s) => quedasSemSaida(ultimo.keys(), s || {}).forEach(resolver))

    return () => {
        api?.removeListener?.(ALIANCA_QUEDA_SAIDA, ESCUTA)
        soltarSaidas()
        relogios.forEach((t) => clearTimeout(t))
        relogios.clear()
    }
}
