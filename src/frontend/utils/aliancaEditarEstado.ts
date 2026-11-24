import { writable } from "svelte/store"
import type { ItemEditavel } from "./aliancaEditarLogica"

// Leiaute v2, fatia 3: estado de Editar que vive so na memoria (nao vai para o disco). Sem `.subscribe` no nivel do modulo.

/** os itens "Aberto da biblioteca" (ate 5): o que se abriu em Editar e nao e do roteiro. `edit` guarda o `activeEdit` de quando se abriu (midia, camera, modelo...). */
export type Avulso = ItemEditavel & { edit?: any }
export const avulsosEditando = writable<Avulso[]>([])

/** zoom do slide no centro de Editar (1 = encaixa). O cabecalho do centro escreve; `SlideEditor` le. */
export const zoomDoEditor = writable<number>(1)

/** Modelos dentro do Editar (desenho C, 24/nov): a coluna da esquerda mostra os slides do item ou a lista de modelos */
export const modoDoEditar = writable<"slides" | "modelos">("slides")
/** categoria escolhida na lista de modelos (aliancaModelosLogica: "todos", "sem_categoria" ou o id da categoria) */
export const categoriaDosModelos = writable<string>("todos")
/** o ultimo modelo aberto em Editar: voltar para MODELOS reabre ele */
export const ultimoModelo = writable<string>("")
