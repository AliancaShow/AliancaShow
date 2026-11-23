// Cabine 6: a fila dos avisos da janela principal (a conta mora em aliancaAvisosLogica.ts; quem desenha e AliancaAvisos.svelte, no pe do leiaute).
// Entra por dois caminhos: `avisar` (codigo novo, com chave e nivel) e `receberToast` (o `newToast` antigo, que Toast.svelte repassa).
// So a janela principal monta a linha; a janela de saida nunca importa este arquivo. Importa SO svelte/store e a logica: aliancaToque e a
// midia sumida o usam sem arrastar language/stores (e os testes deles nao carregam o app inteiro).
import { get, writable } from "svelte/store"
import { acrescentar, noHistorico, textoDaMensagem, tirarChave, tirarId, vencer, type Aviso, type Nivel } from "./aliancaAvisosLogica"

export const avisos = writable<Aviso[]>([])
export const historicoDeAvisos = writable<Aviso[]>([])

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

/** poe (ou atualiza) um aviso. `chave` identifica o assunto: a mesma chave substitui, `resolverAviso(chave)` tira */
export function avisar(texto: string, nivel: Nivel, chave: string = texto): void {
    const id = proximoId++
    const agora = Date.now()
    avisos.update((l) => acrescentar(l, { chave, texto, nivel }, id, agora))
    const entrou = get(avisos).find((a) => a.chave === chave)
    if (entrou) historicoDeAvisos.update((h) => noHistorico(h, entrou))
    if (nivel === "info") armarRelogio()
}

/** o assunto se resolveu (o arquivo voltou, o telao respondeu): sai da linha */
export function resolverAviso(chave: string): void {
    avisos.update((l) => tirarChave(l, chave))
}

/** o x da linha */
export function dispensarAviso(id: number): void {
    avisos.update((l) => tirarId(l, id))
}

/** uma mensagem do `newToast` antigo (chave de traducao ou texto pronto). Toast.svelte da o tradutor e o dicionario */
export function receberToast(msg: string, traduzir: (s: string) => string, tem: (grupo: string, chave: string) => boolean): void {
    if (!msg) return
    const { texto, nivel } = textoDaMensagem(msg, traduzir, tem)
    avisar(texto, nivel, msg)
}

/** so testes */
export function _zerarAvisos(): void {
    avisos.set([])
    historicoDeAvisos.set([])
    if (relogio) clearInterval(relogio)
    relogio = null
}
