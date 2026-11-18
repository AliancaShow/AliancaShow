// Fatia 2: duas travas de gesto, em funcao PURA (testadas em aliancaToqueLogica.test.ts; sem store, sem DOM).
//
// 1. O Esc que FECHOU ou DESSELECIONOU algo segura por 700 ms o Esc seguinte. O Esc limpa o telao; quem aperta Esc para sair de uma caixa de
//    texto ou fechar um popover nao pode, no segundo Esc, limpar o telao sem querer (mesmo desenho do incidente de 09/ago do Sirvo: dois toques
//    na mesma coordenada).
// 2. Clique repetido no MESMO item em menos de 400 ms e engolido: o duplo clique nunca dispara a acao duas vezes (video nao comeca 2x). A conta
//    e feita contra o ultimo clique ACEITO naquele item (clicar de 300 em 300 ms nao silencia o item para sempre).

export const ESC_SEGURA_MS = 700
export const CLIQUE_REPETIDO_MS = 400

export function criarEscSeguro(ms = ESC_SEGURA_MS) {
    let ate = 0
    return {
        /** algo foi fechado/desselecionado por um Esc: o proximo Esc espera */
        fechou(agora: number) {
            ate = agora + ms
        },
        /** true: este Esc esta dentro da espera e deve ser engolido */
        segura(agora: number): boolean {
            return agora < ate
        },
        _ate: () => ate
    }
}

export function criarRepeticao<K>(ms = CLIQUE_REPETIDO_MS) {
    const ultimo = new Map<K, number>()
    return {
        /** true: e repeticao dentro da janela (engolir). Aceita (false) atualiza o ultimo clique daquele item. */
        engole(item: K, agora: number): boolean {
            const antes = ultimo.get(item)
            if (antes !== undefined && agora - antes < ms) return true
            ultimo.set(item, agora)
            // o mapa nao cresce sem fim: esquece o que ja passou da janela
            if (ultimo.size > 64) for (const [k, t] of ultimo) if (agora - t >= ms) ultimo.delete(k)
            return false
        }
    }
}
