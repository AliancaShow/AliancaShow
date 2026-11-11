// ----- AliançaShow · quais shows estão editados e ainda não gravados no disco (puro) -----
//
// O catálogo do Sirvo tira trecho e letra do arquivo .show, que só é gravado ao
// salvar (autosave a cada 15 min), enquanto `timestamps.modified` sobe NA HORA
// da edição. Sem este controle o Sirvo recebia o conteúdo velho carimbado com o
// hash novo. Aqui cada show tem o "modified" que já está no arquivo:
//   - show visto pela primeira vez, vindo do disco: o modified dele É o do disco;
//   - show criado/importado nesta sessão (não veio do disco): 0 — nada no arquivo;
//   - ao salvar: o que estava no cache no instante do envio ao main vira "gravado"
//     (só depois de o main confirmar — `confirmarSalvo`).
// Show não salvo = modified em memória maior que o gravado.

type CacheLike = { [id: string]: { timestamps?: { modified?: number | null } } | undefined }

export class RastreioDeSalvos {
    private gravado = new Map<string, number>()
    private enviando: Map<string, number> | null = null

    private modificado(cache: CacheLike, id: string): number {
        const m = Number(cache[id]?.timestamps?.modified)
        return Number.isFinite(m) && m > 0 ? m : 0
    }

    /** Chamar a cada mudança do cache. `doDisco(id)`: o show já existia no disco quando o app abriu. */
    observar(cache: CacheLike, doDisco: (id: string) => boolean) {
        for (const id of Object.keys(cache || {})) {
            if (this.gravado.has(id) || !cache[id]) continue
            this.gravado.set(id, doDisco(id) ? this.modificado(cache, id) : 0)
        }
        // cache esvaziado (show apagado): esquece
        for (const id of [...this.gravado.keys()]) if (!cache?.[id]) this.gravado.delete(id)
    }

    /** O app vai mandar o cache ao main para gravar: guarda o que está indo. */
    salvando(cache: CacheLike) {
        const m = new Map<string, number>()
        for (const id of Object.keys(cache || {})) if (cache[id]) m.set(id, this.modificado(cache, id))
        this.enviando = m
    }

    /** O main gravou. O que foi enviado agora está no arquivo. */
    salvo() {
        if (!this.enviando) return
        for (const [id, m] of this.enviando) this.gravado.set(id, m)
        this.enviando = null
    }

    /** Editado em memória e ainda não gravado? */
    naoSalvo(id: string, cache: CacheLike): boolean {
        if (!cache?.[id]) return false
        const g = this.gravado.get(id)
        if (g === undefined) return false
        return this.modificado(cache, id) > g
    }
}

export const rastreioDeSalvos = new RastreioDeSalvos()
