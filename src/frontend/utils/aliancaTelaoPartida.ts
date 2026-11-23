// Cabine 6 (pedido do Andre, 23/nov): "o programa tem que iniciar com o telao ligado; e dai escolhemos congelar ou desligar".
// Nao ha motor novo: o FreeShow ja liga as saidas na partida quando `autoOutput` ("Mostrar tela de saida ao iniciar", Configuracoes >
// Telas e saidas > mais opcoes) e verdadeiro (updateSettings.ts: 2,5 s depois das configuracoes, toggleOutputs com autoStartup). Aqui so
// se muda o PADRAO deste app: uma vez por perfil, `autoOutput` passa a verdadeiro e `special.aliancaTelaoNaPartida` marca que isso ja foi
// feito. Depois disso quem manda e o operador: se ele desligar a opcao, ela fica desligada (nunca e religada).
// Regra "nada volta sozinho": `autoOutput` so age na partida. O telao desligado pelo operador durante o culto NUNCA e religado.
// Roda quando AliancaTela monta (logo depois de `loaded`, que e o fim de updateSettings), bem antes dos 2,5 s: a partida desta mesma
// abertura ja liga. Arquivo livre: nada do fecho da janela de saida o importa.
import { get } from "svelte/store"
import { autoOutput, special } from "../stores"
import { aceitarCaminhosNaFoto } from "./aliancaConfigRascunho"

export const MARCA_PARTIDA = "aliancaTelaoNaPartida"

/** o perfil ainda nao recebeu o padrao "telao ligado na partida"? */
export const precisaPadraoDaPartida = (sp: any): boolean => !sp?.[MARCA_PARTIDA]

/** uma vez por perfil: liga "Mostrar tela de saida ao iniciar" e marca. Devolve true se mudou algo. */
export function aplicarPadraoDaPartida(): boolean {
    if (!precisaPadraoDaPartida(get(special))) return false
    autoOutput.set(true)
    special.update((s) => ({ ...s, [MARCA_PARTIDA]: true }))
    // nao conta como "alteracao nao salva" em Configuracoes
    aceitarCaminhosNaFoto([["autoOutput"], ["special", MARCA_PARTIDA]])
    return true
}
