import { derived, writable } from "svelte/store"
import { chaveDe, type Marcado } from "./aliancaGavetaLogica"

// Os stores da gaveta do Preparar (fatia 6), num módulo leve: o atalho do Esc, a gaveta e o contador importam daqui
// sem puxar a Bíblia, o histórico etc. As ações estão em aliancaGaveta.ts.

/** o que o operador marcou para levar ao culto (memória: não persiste, fica escondido no Culto) */
export const marcados = writable<Marcado[]>([])
/** a lista curta das marcações (o contador abre) */
export const listaAberta = writable(false)
/** as chaves únicas marcadas, para o selo ✓ dos cards */
export const chavesMarcadas = derived(marcados, ($m) => new Set($m.map(chaveDe)))
/** o último item que o operador selecionou na lista do culto ("Pôr no culto" entra depois dele) */
export const ultimoDoCulto = writable<{ projetoId: string; index: number; id: string } | null>(null)
