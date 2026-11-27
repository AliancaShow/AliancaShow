// AliancaShow (cabine 27/nov, "aprovo", Andre): com a Biblia no ar, a seta (e PageUp/PageDown/espaco, os botoes de avancar, o remoto) anda o
// versiculo e nunca cai na musica aberta. O OutputHelper (fecho) so avisa, pelo evento "alianca:biblia-seta"; quem anda e a propria Biblia
// (Scripture.svelte registra a funcao). Com a aba Biblia fechada, a biblioteca volta para ela (a regra de 26/nov: quando a seta faz algo,
// tem que aparecer na tela) e o versiculo anda assim que ela monta.
import { activeDrawerTab } from "../stores"

/** true = andou; false = a Biblia ainda nao esta pronta (selecao nao carregou) */
type Andar = (anterior: boolean) => boolean
let andar: Andar | null = null

export function registrarAndarDaBiblia(f: Andar): () => void {
    andar = f
    return () => {
        if (andar === f) andar = null
    }
}

let emCurso = false
export async function andarNaBiblia(anterior: boolean, esperarMs = 3000): Promise<boolean> {
    if (andar?.(anterior)) return true
    if (emCurso) return false
    emCurso = true
    try {
        activeDrawerTab.set("scripture")
        const fim = Date.now() + esperarMs
        while (Date.now() < fim) {
            await new Promise((r) => setTimeout(r, 60))
            if (andar?.(anterior)) return true
        }
        return false
    } finally {
        emCurso = false
    }
}

let iniciado = false
/** So a janela principal chama (AliancaTela). Idempotente. */
export function iniciarSetasDaBiblia() {
    if (iniciado) return
    iniciado = true
    window.addEventListener("alianca:biblia-seta", (e) => void andarNaBiblia(!!(e as CustomEvent).detail?.anterior))
}
