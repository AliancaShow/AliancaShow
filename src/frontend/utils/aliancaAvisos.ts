// Cabine 6: a fila dos avisos da janela principal (a conta mora em aliancaAvisosLogica.ts; quem desenha e AliancaAvisos.svelte, no pe do leiaute).
// Entra por dois caminhos: `avisar` (codigo novo, com chave e nivel) e `receberToast` (o `newToast` antigo, que Toast.svelte repassa).
// E um terceiro: `ligarFalhasNosAvisos` (as falhas altas de aliancaFalha.ts, que tambem so importa svelte/store).
// So a janela principal monta a linha; a janela de saida nunca importa este arquivo. Importa SO svelte/store e a logica: aliancaToque e a
// midia sumida o usam sem arrastar language/stores (e os testes deles nao carregam o app inteiro).
import { get, writable } from "svelte/store"
import { acrescentar, alturaSalvaDaLista, CHAVE_ALTURA_LISTA, chaveDaFalha, falhasNovas, noHistorico, textoDaFalha, textoDaMensagem, tirarChave, tirarId, vencer, type Aviso, type Nivel } from "./aliancaAvisosLogica"
import { falhas } from "./aliancaFalha"

export const avisos = writable<Aviso[]>([])
export const historicoDeAvisos = writable<Aviso[]>([])

// a altura da lista "Ultimos avisos" (px), como as outras divisorias: sobrevive a fechar e abrir. Fica no armazenamento do app (como os blocos
// do Editar, aliancaBlocosEstado): as divisorias da tela moram em `aliancaTela` (settings), que e do fecho da saida e nao muda por isto.
function lerAlturaDaLista(): number {
    if (typeof localStorage === "undefined") return alturaSalvaDaLista(null) // testes (node): sem armazenamento
    try {
        return alturaSalvaDaLista(localStorage.getItem(CHAVE_ALTURA_LISTA))
    } catch (e) {
        console.error("[AliancaShow] altura da lista de avisos: armazenamento ilegivel, vale o padrao", e)
        return alturaSalvaDaLista(null)
    }
}
export const alturaDaListaDeAvisos = writable<number>(lerAlturaDaLista())

/** grava ao SOLTAR a divisoria. Sem armazenamento: devolve o erro (quem chama acende a falha alta) e a altura vale so ate fechar */
export function gravarAlturaDaLista(px: number): unknown {
    alturaDaListaDeAvisos.set(px)
    try {
        localStorage.setItem(CHAVE_ALTURA_LISTA, String(px))
        return null
    } catch (e) {
        return e
    }
}

let proximoId = 1
let relogio: ReturnType<typeof setInterval> | null = null

function armarRelogio() {
    if (relogio) return
    relogio = setInterval(() => {
        const lista = get(avisos)
        const nova = vencer(lista, Date.now())
        if (nova !== lista) avisos.set(nova)
        if (!nova.some((a) => a.nivel === "info") && relogio) {
            clearInterval(relogio)
            relogio = null
        }
    }, 500)
}

/**
 * poe (ou atualiza) um aviso. `chave` identifica o assunto: a mesma chave substitui, `resolverAviso(chave)` tira.
 * `fixo`: sem x enquanto o assunto dura (saida fora do ar). `soma: false`: troca de estado da mesma chave sem contar outra vez
 */
export function avisar(texto: string, nivel: Nivel, chave: string = texto, opcoes: { fixo?: boolean; soma?: boolean; unicoNoHistorico?: boolean } = {}): void {
    const id = proximoId++
    const agora = Date.now()
    const { unicoNoHistorico, ...fila } = opcoes
    avisos.update((l) => acrescentar(l, { chave, texto, nivel, ...fila }, id, agora))
    const entrou = get(avisos).find((a) => a.chave === chave)
    // no historico cada entrada tem id PROPRIO (a chave do {#each}): a mesma chave muda de texto (caiu -> voltou) e as duas linhas ficam
    if (entrou) historicoDeAvisos.update((h) => noHistorico(h, { ...entrou, id }, !!unicoNoHistorico))
    if (nivel === "info") armarRelogio()
}

/** o assunto se resolveu (o arquivo voltou, o telao respondeu): sai da linha */
export function resolverAviso(chave: string): void {
    avisos.update((l) => tirarChave(l, chave))
}

/** o x da linha (um aviso `fixo` nao sai: tirarId recusa) */
export function dispensarAviso(id: number): void {
    avisos.update((l) => tirarId(l, id))
}

/** uma mensagem do `newToast` antigo (chave de traducao ou texto pronto). Toast.svelte da o tradutor e o dicionario */
export function receberToast(msg: string, traduzir: (s: string) => string, tem: (grupo: string, chave: string) => boolean): void {
    if (!msg) return
    const { texto, nivel } = textoDaMensagem(msg, traduzir, tem)
    avisar(texto, nivel, msg)
}

/**
 * cada falha alta (aliancaFalha.ts) vira ERRO na linha, com o texto da antiga faixa vermelha e as vezes. Nada se perde antes da linha existir:
 * `falhas` guarda tudo desde a partida e a assinatura entrega a lista inteira na hora. Depois do x, a mesma origem so volta se acontecer de novo.
 * Ligado uma vez por AliancaTela (so a janela principal); devolve o desligar.
 */
export function ligarFalhasNosAvisos(): () => void {
    const vistas = new Map<string, number>()
    return falhas.subscribe((lista) => {
        for (const f of falhasNovas(lista, vistas)) {
            vistas.set(f.origem, f.vezes)
            // a queda de saida ja tem aviso proprio (aliancaQuedaAvisos): nao repetir como "falha interna"
            if (f.origem.startsWith("saida-caiu:")) continue
            avisar(textoDaFalha(f.origem, f.vezes), "erro", chaveDaFalha(f.origem), { soma: false, unicoNoHistorico: true })
        }
    })
}

/** so testes */
export function _zerarAvisos(): void {
    avisos.set([])
    historicoDeAvisos.set([])
    if (relogio) clearInterval(relogio)
    relogio = null
}
