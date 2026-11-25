// Chamadas (André, 24/nov; desenho chamadas_kids_estacionamento_v1 aprovado com "aprovo os dois"). Painel no Mostrar (AliancaChamadas.svelte).
// Uma chamada e uma SOBREPOSICAO do FreeShow com `aliancaChamada` = { modelo, posicao, saidas }. Chamar = escrever o texto com os campos
// preenchidos na caixa da sobreposicao e por ela nas saidas escolhidas (setOutput "overlays", somando as que ja estao); o tempo usa o
// `displayDuration` do FreeShow (a propria saida tira no fim). Nada daqui e importado pela saida (fora do fecho).
import { get, writable } from "svelte/store"
import { uid } from "uid"
import { activeEdit, outputs, overlays, special } from "../stores"
import { setOutput } from "../components/helpers/output"
import { aceitarCaminhosNaFoto } from "./aliancaConfigRascunho"
import { falhaAlta } from "./aliancaFalha"
import { trocarTela } from "./aliancaTela"
import { CHAMADAS_PADRAO, corDaCaixa, itensDaChamada, montarTexto, saidasDaChamada, type DadosDaChamada, type Posicao } from "./aliancaChamadasLogica"

export interface Chamada extends DadosDaChamada {
    id: string
    nome: string
}

/** o operador apagou a ultima chamada de proposito: nao recriar Kids e Estacionamento */
const MARCA_VAZIA = "aliancaChamadasSemPadrao"

/** a chamada no ar (a ultima chamada); `ateMs` null = ate tirar */
export const chamadaNoAr = writable<{ id: string; texto: string; ateMs: number | null } | null>(null)

export function listaDeChamadas(todas: Record<string, any>): Chamada[] {
    return Object.entries(todas || {})
        .filter(([, o]) => o?.aliancaChamada)
        .map(([id, o]) => ({ id, nome: o.name || "Chamada", modelo: o.aliancaChamada.modelo || "", posicao: o.aliancaChamada.posicao || "faixa", saidas: o.aliancaChamada.saidas || [] }))
        .sort((a, b) => (get(overlays)[a.id]?.aliancaOrdem ?? 0) - (get(overlays)[b.id]?.aliancaOrdem ?? 0) || a.nome.localeCompare(b.nome))
}

/**
 * Kids e Estacionamento nascem sempre que NAO ha nenhuma chamada, menos quando o operador apagou a ultima de proposito (marca `MARCA_VAZIA`).
 * Nao ha marca de "ja criei": as sobreposicoes so vao ao disco no Salvar, a configuracao vai na hora; uma marca sobreviveria a um app que
 * fechou/recarregou sem salvar e as duas sumiriam de vez (fumaca t17, 25/nov). A carga do disco pode chegar DEPOIS do painel (o IPC
 * sobrescreve a loja inteira): por 20 s um vigia recoloca as duas se a carga as levou.
 */
let apagouNestaSessao = false
export function garantirChamadasPadrao(): void {
    try {
        if ((get(special) as any)?.[MARCA_VAZIA]) return
        semear()
        const parar = overlays.subscribe(() => queueMicrotask(semear))
        setTimeout(parar, 20000)
    } catch (erro) {
        falhaAlta("chamadas-padrao", erro)
    }
}
function semear() {
    if (apagouNestaSessao || (get(special) as any)?.[MARCA_VAZIA] || listaDeChamadas(get(overlays) as any).length) return
    overlays.update((a: any) => {
        CHAMADAS_PADRAO.forEach((c, i) => {
            a[uid()] = novaSobreposicao(c.nome, { modelo: c.modelo, posicao: "faixa", saidas: [] }, i, c.cor)
        })
        return a
    })
}

function novaSobreposicao(nome: string, dados: DadosDaChamada, ordem: number, cor = "#e63946") {
    return { name: nome, color: cor, category: null, items: itensDaChamada(undefined, dados.posicao, cor, dados.modelo), aliancaChamada: dados, aliancaOrdem: ordem }
}

/** cria (id null) ou atualiza uma chamada. Devolve o id */
export function salvarChamada(id: string | null, nome: string, dados: DadosDaChamada): string {
    const novoId = id || uid()
    overlays.update((a: any) => {
        const velho = id ? a[id] : null
        if (!velho) {
            a[novoId] = novaSobreposicao(nome, dados, Object.keys(a).length)
            return a
        }
        const cor = corDaCaixa(velho.items)
        a[novoId] = { ...velho, name: nome, aliancaChamada: dados, items: itensDaChamada(velho.items, dados.posicao, cor, dados.modelo) }
        return a
    })
    return novoId
}

export function apagarChamada(id: string): void {
    apagouNestaSessao = true
    tirarChamada(id)
    overlays.update((a: any) => {
        delete a[id]
        return a
    })
    if (!listaDeChamadas(get(overlays) as any).length) {
        special.update((s: any) => ({ ...s, [MARCA_VAZIA]: true }))
        aceitarCaminhosNaFoto([["special", MARCA_VAZIA]])
    }
}

/** "Livre…": abre a sobreposicao no Editar (cor, fonte, tamanho e lugar como qualquer sobreposicao) */
export function abrirChamadaNoEditar(id: string): void {
    activeEdit.set({ type: "overlay", id, items: [] } as any)
    trocarTela("edit", "biblioteca-editar")
}

/** chama no telao. Devolve as saidas onde entrou (vazio = nada foi) */
export function chamar(c: Chamada, valores: Record<string, string>, segundos: number): string[] {
    try {
        const texto = montarTexto(c.modelo, valores)
        const alvos = saidasDaChamada(c.saidas, get(outputs) as any).filter((id) => (get(outputs) as any)[id]?.enabled)
        if (!alvos.length) return []
        overlays.update((a: any) => {
            const o = a[c.id]
            if (!o) return a
            o.items = itensDaChamada(o.items, c.posicao as Posicao, corDaCaixa(o.items), texto)
            o.displayDuration = segundos > 0 ? segundos : 0
            return a
        })
        // a chamada anterior sai (uma de cada vez no telao)
        const anterior = get(chamadaNoAr)
        if (anterior && anterior.id !== c.id) tirarChamada(anterior.id)
        for (const saida of alvos) setOutput("overlays", c.id, false, saida, true)
        const foi = alvos.filter((s) => (get(outputs) as any)[s]?.out?.overlays?.includes(c.id))
        if (foi.length) chamadaNoAr.set({ id: c.id, texto, ateMs: segundos > 0 ? Date.now() + segundos * 1000 : null })
        return foi
    } catch (erro) {
        falhaAlta("chamar", erro)
        return []
    }
}

/** tira a chamada de todas as saidas onde estiver */
export function tirarChamada(id: string): void {
    try {
        const todas = get(outputs) as any
        for (const [saida, o] of Object.entries<any>(todas)) {
            if (o?.out?.overlays?.includes(id)) setOutput("overlays", id, true, saida)
        }
        if (get(chamadaNoAr)?.id === id) chamadaNoAr.set(null)
    } catch (erro) {
        falhaAlta("tirar-chamada", erro)
    }
}

/** a chamada ainda esta em alguma saida? (saiu sozinha no tempo, foi limpa pelo F-tecla ou tirada por outro caminho) */
export function chamadaEstaNoAr(id: string, todas: Record<string, any>): boolean {
    return Object.values(todas || {}).some((o: any) => o?.out?.overlays?.includes(id))
}
