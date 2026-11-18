// A mensagem que a caixa "Mensagem pro palco" enxerga: a do roteiro do Sirvo (`mensagem_palco`). `mensagemSubstituta` e um parafuso SO da
// prova (t9-palco.mjs): o Sirvo real nao e tocado pela fumaca, entao ela injeta aqui a mensagem viva para provar o que a caixa faz com
// ela (erro nao esconde o Limpar etc.). Em producao fica em `undefined` e nada muda.
import { derived, writable } from "svelte/store"
import { sirvoRoteiro } from "./aliancaSirvo"

type Msg = { id: string; texto: string; ate: string } | null | undefined

export const mensagemSubstituta = writable<Msg>(undefined)
export const mensagemDaCaixa = derived([sirvoRoteiro, mensagemSubstituta], ([r, s]): Msg => (s !== undefined ? s : r?.mensagem_palco))
