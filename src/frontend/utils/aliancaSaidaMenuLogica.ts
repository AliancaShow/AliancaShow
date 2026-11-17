// 1a, D4: a maquina do item "telao" do menu ⋯ do Preparar. Pura: o relogio e o que ela escreve sao injetados. Nenhum import de store.
// O item NUNCA presume o estado: deriva ao abrir. O que nao responde vai a `semResposta` (Q9, texto persistente), nunca volta calado.

export const INERTE_MS = 1000
export const JANELA_MS = 3000
/**
 * Quanto o menu espera o store `outputDisplay` mudar depois de pedir ligar/desligar. MEDIDO (M1, 16/nov/2026, app a frio, Electron de dev):
 * ligar levou 65 / 53 / 53 ms; desligar, ~340 / 331 / 345 ms (inclui o overhead do CDP). max(1500, ceil100(3 x 345)) = 1500.
 */
export const ESPERA_STORE_MS = 1500
export const TRAVA_MS = 800

/** ha ao menos uma saida habilitada (a mesma condicao de toggleOutputs, output.ts: `outputsList.filter(a => a.enabled)` nao vazio) */
export function temSaidaHabilitada(outputs: Record<string, { enabled?: boolean } | undefined> | null | undefined): boolean {
    return Object.values(outputs || {}).some((o) => o?.enabled === true)
}

export type EstadoSaida = "semTela" | "desligadoNoAr" | "desligadoDesenho" | "desligado" | "ligando" | "ligado" | "perguntando" | "armado" | "desligando" | "trava" | "semResposta"

export type EntradaSaida = { outputDisplay: boolean; semTelaFisica: boolean; temSaida: boolean; noAr: boolean; desenho: boolean }

/** o estado de repouso, derivado do mundo */
export function derivarEstado(e: EntradaSaida): EstadoSaida {
    if (e.semTelaFisica || !e.temSaida) return "semTela"
    if (e.outputDisplay) return "ligado"
    if (e.noAr) return "desligadoNoAr"
    if (e.desenho) return "desligadoDesenho"
    return "desligado"
}

export const ROTULOS: Record<EstadoSaida, string> = {
    semTela: "Sem tela de saída: configurar",
    desligadoNoAr: "Há conteúdo carregado. Ligue o telão pelo Culto.",
    desligadoDesenho: "Há desenho ativo. Ligue o telão pelo Culto.",
    desligado: "Ligar o telão",
    ligando: "Ligando…",
    ligado: "Desligar o telão",
    perguntando: "Desligar o telão?",
    armado: "Desligar o telão?",
    desligando: "Desligando…",
    trava: "Ligar o telão",
    semResposta: "O telão não respondeu. Use o botão do Culto."
}
export const ROTULO_DESLIGAR_MESMO = "Desligar mesmo"

const DESABILITADOS: EstadoSaida[] = ["desligadoNoAr", "desligadoDesenho", "ligando", "desligando", "trava", "semResposta"]
export const itemDesabilitado = (s: EstadoSaida) => DESABILITADOS.includes(s)

export type EfeitosSaida = {
    ligar: () => void
    desligar: () => void
    abrirConfig: () => void
    fecharMenu: () => void
    ler: () => EntradaSaida
    /** chamada a cada mudanca de estado */
    aoMudar: (s: EstadoSaida) => void
    erro?: (...a: unknown[]) => void
}

export function criarMaquinaDaSaida(ef: EfeitosSaida) {
    let estado: EstadoSaida = "desligado"
    let pedido: "ligar" | "desligar" | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let janela: ReturnType<typeof setTimeout> | undefined
    const erro = ef.erro ?? ((...a: unknown[]) => console.error(...a))

    const limpar = () => {
        clearTimeout(timer)
        clearTimeout(janela)
        timer = undefined
        janela = undefined
    }
    const ir = (s: EstadoSaida) => {
        estado = s
        ef.aoMudar(s)
    }
    const derivar = () => {
        limpar()
        pedido = null
        ir(derivarEstado(ef.ler()))
    }
    const esperarResposta = (qual: "ligar" | "desligar") => {
        pedido = qual
        timer = setTimeout(() => {
            timer = undefined
            const e = ef.ler()
            erro("[AliancaShow] menu da saida: o telao nao respondeu", { pedido: qual, outputDisplay: e.outputDisplay, esperaMs: ESPERA_STORE_MS })
            ir("semResposta")
        }, ESPERA_STORE_MS)
    }

    return {
        get estado() {
            return estado
        },
        /** abrir o menu: deriva (so ligando/desligando/trava em curso ficam como estao) */
        abrir() {
            if (estado === "ligando" || estado === "desligando" || estado === "trava") {
                ef.aoMudar(estado)
                return
            }
            derivar()
        },
        /** clique no item do telao */
        cliqueNoItem() {
            switch (estado) {
                case "semTela":
                    ef.abrirConfig()
                    ef.fecharMenu()
                    return
                case "desligado":
                    ir("ligando")
                    esperarResposta("ligar")
                    ef.ligar()
                    return
                case "ligado":
                    ir("perguntando")
                    timer = setTimeout(() => {
                        timer = undefined
                        ir("armado")
                        janela = setTimeout(() => {
                            janela = undefined
                            derivar()
                        }, JANELA_MS)
                    }, INERTE_MS)
                    return
                default:
                    return // desabilitado, perguntando, armado (o item e o titulo), etc.
            }
        },
        /** clique em "Desligar mesmo": so vale armado */
        cliqueDesligarMesmo() {
            if (estado !== "armado") return
            limpar()
            ir("desligando")
            esperarResposta("desligar")
            ef.desligar()
        },
        /** o store `outputDisplay` mudou (ou o resto do mundo, como saida habilitada e conteudo no ar) */
        mundoMudou() {
            const e = ef.ler()
            switch (estado) {
                case "ligando":
                    if (e.outputDisplay) derivar()
                    return
                case "desligando":
                    if (!e.outputDisplay) {
                        limpar()
                        pedido = null
                        ir("trava")
                        timer = setTimeout(() => {
                            timer = undefined
                            derivar()
                        }, TRAVA_MS)
                    }
                    return
                case "trava":
                    return
                case "semResposta":
                    derivar()
                    return
                case "perguntando":
                case "armado":
                    if (!e.outputDisplay) derivar()
                    return
                default:
                    derivar()
            }
        },
        /** fechar o menu, Esc, troca de modo: cancela a pergunta; o resto segue o seu curso */
        cancelar() {
            if (estado === "perguntando" || estado === "armado") derivar()
            else if (estado === "semResposta") derivar()
        },
        destruir() {
            limpar()
        }
    }
}
