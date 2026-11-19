import { writable } from "svelte/store"
import { CHAVE_BLOCOS, comBloco, lerBlocos, serializarBlocos, type EstadoBlocos } from "./aliancaBlocosLogica"

// O que o operador deixou aberto ou recolhido nas propriedades do Editar, guardado no armazenamento do app (sobrevive a fechar e abrir).
// Janela principal so: a janela de saida nao importa este modulo. Sem armazenamento (ou cheio) o painel segue com os padroes.

function ler(): EstadoBlocos {
    try {
        return lerBlocos(localStorage.getItem(CHAVE_BLOCOS))
    } catch {
        return {}
    }
}

export const blocos = writable<EstadoBlocos>(ler())

blocos.subscribe((estado) => {
    try {
        localStorage.setItem(CHAVE_BLOCOS, serializarBlocos(estado))
    } catch {
        // sem armazenamento: a escolha vale so ate fechar
    }
})

export function definirBloco(chave: string, aberto: boolean) {
    blocos.update((e) => comBloco(e, chave, aberto))
}
