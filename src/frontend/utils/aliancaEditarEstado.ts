import { writable } from "svelte/store"
import type { ItemEditavel } from "./aliancaEditarLogica"

// Leiaute v2, fatia 3: estado de Editar que vive so na memoria (nao vai para o disco). Sem `.subscribe` no nivel do modulo.

/** os itens "Aberto da biblioteca" (ate 5): o que se abriu em Editar e nao e do roteiro. `edit` guarda o `activeEdit` de quando se abriu (midia, camera, modelo...). */
export type Avulso = ItemEditavel & { edit?: any }
export const avulsosEditando = writable<Avulso[]>([])

/** zoom do slide no centro de Editar (1 = encaixa). O cabecalho do centro escreve; `SlideEditor` le. */
export const zoomDoEditor = writable<number>(1)
