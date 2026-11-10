// AliançaShow: modo "Só no Retorno" (pacote Saídas, fatia 1) — aplica nos stores.
// A lógica (o que muda e como desfazer) está em `aliancaRetornoLogica.ts`.

import { get } from "svelte/store"
import { uid } from "uid"
import { outputs, stageShows } from "../stores"
import { newToast, waitUntilValueIsDefined } from "./common"
import { desligarSoRetorno, idDaFonte, ligarSoRetorno, modoSoRetornoLigado } from "./aliancaRetornoLogica"

const LEMBRETE_MS = 5 * 60 * 1000
let lembrete: ReturnType<typeof setTimeout> | null = null

function pararLembrete() {
    if (lembrete) clearTimeout(lembrete)
    lembrete = null
}
function agendarLembrete() {
    pararLembrete()
    lembrete = setTimeout(function avisar() {
        if (!modoSoRetornoLigado(get(outputs))) return pararLembrete()
        newToast("O modo Só no Retorno continua ligado: o público não vê o que você clica.")
        lembrete = setTimeout(avisar, LEMBRETE_MS)
    }, LEMBRETE_MS)
}

export function ligarModoSoRetorno(): boolean {
    const r = ligarSoRetorno(get(outputs), get(stageShows), { novoId: uid(), agora: Date.now() })
    if (!r.ok) {
        newToast(r.motivo)
        return false
    }

    // saídas primeiro: o palco ainda lê a de antes, que tem o mesmo conteúdo da cópia (sem piscar)
    outputs.set(r.outputs)
    stageShows.set(r.stageShows)
    agendarLembrete()
    return true
}

export function desligarModoSoRetorno(aviso = ""): boolean {
    const r = desligarSoRetorno(get(outputs), get(stageShows))
    if (!r) return false

    // palco primeiro: volta a ler o projetor antes de a Fonte deixar de existir
    stageShows.set(r.stageShows)
    outputs.set(r.outputs)
    pararLembrete()
    if (aviso) newToast(aviso)
    return true
}

export function alternarModoSoRetorno() {
    if (modoSoRetornoLigado(get(outputs))) desligarModoSoRetorno()
    else ligarModoSoRetorno()
}

/** o app fechou com o modo ligado: ao abrir, desfaz tudo */
export async function desfazerSoRetornoQueFicouLigado() {
    await waitUntilValueIsDefined(() => Object.keys(get(outputs) || {}).length, 100, 10000)
    const fonteId = idDaFonte(get(outputs))
    if (!fonteId) return
    const fonte = get(outputs)[fonteId]
    if (!fonte.enabled && !fonte.retornoModo) return

    // os layouts de palco vêm em outro arquivo: espera eles chegarem para devolver a fonte de cada um
    await waitUntilValueIsDefined(() => Object.keys(get(stageShows) || {}).length, 100, 10000)
    desligarModoSoRetorno("O app fechou com o modo Só no Retorno ligado. Ele foi desligado e as saídas voltaram ao normal.")
}
