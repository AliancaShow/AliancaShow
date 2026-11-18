// Fatia 2: duas travas de gesto, em funcao PURA (testadas em aliancaToqueLogica.test.ts; sem store, sem DOM).
//
// 1. O Esc que FECHOU ou DESSELECIONOU algo segura por 700 ms o Esc seguinte. O Esc limpa o telao; quem aperta Esc para sair de uma caixa de
//    texto ou fechar um popover nao pode, no segundo Esc, limpar o telao sem querer (mesmo desenho do incidente de 09/ago do Sirvo: dois toques
//    na mesma coordenada).
// 2. Clique repetido no MESMO item em menos de 700 ms e engolido (cabine 18/nov: era 400): o duplo clique nunca dispara a acao duas vezes (video nao comeca 2x). A conta
//    e feita contra o ultimo clique ACEITO naquele item (clicar de 300 em 300 ms nao silencia o item para sempre).

export const ESC_SEGURA_MS = 700
export const CLIQUE_REPETIDO_MS = 700

/** tecla segurada (auto-repeticao): nunca encadeia, e engolida sempre (segurar Esc para sair de um campo nao limpa o telao quando a espera vence) */
export function escEngolidoPorRepeticao(e: { repeat?: boolean }): boolean {
    return !!e.repeat
}

export function criarEscSeguro(ms = ESC_SEGURA_MS) {
    let ate = 0
    return {
        /** algo foi fechado/desselecionado por um Esc: o proximo Esc espera */
        fechou(agora: number) {
            // uma espera por RAJADA: um Esc que passa logo depois de a espera acabar (menu de contexto fechado, depois a selecao desfeita) nao arma
            // outra, ou o telao levaria 3 toques e mais de 1,4 s para limpar (revisao da fatia 2, achado 6)
            if (ate > 0 && agora >= ate && agora - ate < ms) return
            ate = agora + ms
        },
        /** true: este Esc esta dentro da espera e deve ser engolido */
        segura(agora: number): boolean {
            return agora < ate
        },
        _ate: () => ate
    }
}

/** quanto o ponteiro pode andar entre dois cliques e ainda ser "o mesmo toque repetido" */
export const CLIQUE_REPETIDO_PX = 6

export type Ponto = { x: number; y: number }

/**
 * `K` e o elemento clicavel MAIS INTERNO (chaveDoClique): dois botoes irmaos, dois versiculos, dois slides sao chaves diferentes e nunca se engolem.
 * `ponto` (onde o ponteiro estava): se andou mais de CLIQUE_REPETIDO_PX desde o ultimo clique aceito naquela chave, nao e o mesmo toque.
 */
export function criarRepeticao<K>(ms = CLIQUE_REPETIDO_MS) {
    const ultimo = new Map<K, { t: number; p?: Ponto }>()
    const repete = (item: K, agora: number, ponto?: Ponto): boolean => {
        const antes = ultimo.get(item)
        if (!antes || agora - antes.t >= ms) return false
        if (ponto && antes.p && Math.hypot(ponto.x - antes.p.x, ponto.y - antes.p.y) > CLIQUE_REPETIDO_PX) return false
        return true
    }
    return {
        /** true: e repeticao dentro da janela (engolir). Aceita (false) atualiza o ultimo clique daquela chave. */
        engole(item: K, agora: number, ponto?: Ponto): boolean {
            if (repete(item, agora, ponto)) return true
            ultimo.set(item, { t: agora, p: ponto })
            // o mapa nao cresce sem fim: esquece o que ja passou da janela
            if (ultimo.size > 64) for (const [k, v] of ultimo) if (agora - v.t >= ms) ultimo.delete(k)
            return false
        },
        /** igual a `engole`, mas SEM registrar nada: o mousedown pergunta se o clique que vem em seguida sera engolido */
        vaiEngolir: repete
    }
}

// ---------------------------------------------------------------- qual e "o mesmo item"

/** onde a trava vale: as tres regioes de Mostrar em que um clique leva algo ao ar */
export const REGIOES_DA_TRAVA = '[data-regiao="centro"], [data-regiao="roteiro"], [data-regiao="biblioteca"]'
/** o elemento clicavel mais interno (o PRIMEIRO ancestral que casa). `[data-item]` marca o que nao e botao nem .slide/.verse (capitulo da Biblia). */
export const CLICAVEL = 'button, [role="button"], a, [data-item], .slide, .verse, .context'
/** Controles que o operador aperta varias vezes de proposito (play/pausa/parar de audio e video, +/- de variavel, timers): fora da trava. */
export const SEM_TRAVA = "[data-sem-trava]"

export type AlvoComClosest = { closest(seletor: string): AlvoComClosest | null }

/** a chave do clique, ou null quando o clique esta fora da trava (fora das regioes, sem `.context`, ou num controle de transporte) */
export function chaveDoClique<T extends AlvoComClosest>(alvo: T): T | null {
    if (alvo.closest(SEM_TRAVA)) return null
    if (!alvo.closest(REGIOES_DA_TRAVA) || !alvo.closest(".context")) return null
    return (alvo.closest(CLICAVEL) as T | null) ?? null
}
