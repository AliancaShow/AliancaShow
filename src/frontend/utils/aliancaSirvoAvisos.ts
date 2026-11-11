// ----- AliançaShow · o que conta como "o roteiro mudou" (puro, sem Svelte) -----
//
// Porte da regra do app do Sirvo (servir: src/lib/roteiro-mudancas.ts), com os
// MESMOS textos: o operador do Show e a Produção no celular leem a mesma frase.
// Se a regra mudar lá, mude aqui também.
//
// Diferenças de propósito em relação ao app web:
//   - Sem "fui eu": na F0a o Show não escreve no roteiro, então não há eco. Entra na F2.
//   - Mudança de bloco só avisa se aconteceu com o culto JÁ no ar (`em >= iniciado_em`).
//     Sem isso, abrir o Show com o culto no ar despejaria as edições da semana.

export type Mudanca = { rev: number; tipo: string; bloco_id: string | null; bloco_titulo: string | null; antes: unknown; depois: unknown; autor: string | null; em: string; /** feita por ESTA chave (F2): quem fez não recebe o aviso */ minha?: boolean }

/** O mínimo do roteiro que a regra precisa: ordem atual e o que já foi concluído. */
export type BlocoParaAviso = { id: string; titulo: string; concluido_em: string | null }

export type LinhaDeAviso = { chave: string; texto: string }

const DO_CULTO = new Set(["encerrar", "reabrir", "reiniciar"])
// "musica_tirada" (F3): um Show tirou do projeto uma música que o Sirvo pôs — vale como mudança das músicas do bloco
const DO_BLOCO = new Set(["duracao", "mover", "criar", "apagar", "musicas", "musica_tirada"])

/**
 * Encerrar/reabrir/reiniciar avisam sempre (já derrubaram culto, 09/ago).
 * Bloco: só com o culto no ar, e só o que ainda não passou — mudar a duração do
 * que já foi não muda nada do que vem. Feito/desfeito/iniciar/título: nunca,
 * são o fluxo normal e todo mundo vê acontecer.
 */
export function mereceAviso(m: Mudanca, blocos: BlocoParaAviso[], iniciadoEm: string | null, encerradoEm: string | null): boolean {
    if (m.minha) return false
    if (DO_CULTO.has(m.tipo)) return true
    if (!DO_BLOCO.has(m.tipo)) return false
    if (!iniciadoEm || encerradoEm) return false
    const em = Date.parse(m.em)
    const inicio = Date.parse(iniciadoEm)
    if (isNaN(em) || isNaN(inicio) || em < inicio) return false
    if (m.tipo === "criar" || m.tipo === "apagar") return true
    const b = blocos.find((x) => x.id === m.bloco_id)
    return !!b && !b.concluido_em
}

const aspas = (t: string | null) => `“${t || "um bloco"}”`
// o banco devolve "" quando o apelido está vazio: `||`, não `??`
const quemFez = (m: Mudanca) => m.autor || "Alguém"

function textoDe(m: Mudanca, antes: unknown, depois: unknown): string {
    const quem = quemFez(m)
    switch (m.tipo) {
        case "duracao": {
            const a = Number(antes)
            const d = Number(depois)
            if (isNaN(a) || isNaN(d)) return `${quem} mudou o tempo de ${aspas(m.bloco_titulo)}`
            const sinal = d > a ? `+${d - a}` : `${d - a}`
            return `${quem} mudou ${aspas(m.bloco_titulo)}: ${a} → ${d} min (${sinal})`
        }
        case "mover": {
            const ref = depois && typeof depois === "object" ? (depois as { depois_de?: string | null }).depois_de : null
            return ref ? `${quem} moveu ${aspas(m.bloco_titulo)} pra depois de ${aspas(ref)}` : `${quem} moveu ${aspas(m.bloco_titulo)} pro começo`
        }
        case "criar":
            return `${quem} pôs ${aspas(m.bloco_titulo)} no roteiro`
        case "apagar":
            return `${quem} tirou ${aspas(m.bloco_titulo)} do roteiro`
        case "musicas":
            return textoMusicas(quem, m.bloco_titulo || "um bloco", antes, depois)
        case "musica_tirada":
            return `${quem} tirou ${aspas(nomeDaMusica(antes, depois))} de ${aspas(m.bloco_titulo)}`
        case "encerrar":
            return `${quem} encerrou o culto`
        case "reabrir":
            return `${quem} reabriu o culto`
        case "reiniciar":
            return `${quem} reiniciou o roteiro — o relógio voltou pro começo`
        default:
            return `${quem} mudou o roteiro`
    }
}

/** F3 (migration 0086): `antes`/`depois` são as listas de nomes. Mesmo texto de servir: src/lib/musicas.ts. */
function textoMusicas(quem: string, bloco: string, antes: unknown, depois: unknown): string {
    const a = Array.isArray(antes) ? antes.filter((x): x is string => typeof x === "string") : []
    const d = Array.isArray(depois) ? depois.filter((x): x is string => typeof x === "string") : []
    const entrou = d.filter((x) => !a.includes(x))
    const saiu = a.filter((x) => !d.includes(x))
    const partes: string[] = []
    if (entrou.length) partes.push(`entrou ${entrou.join(", ")}`)
    if (saiu.length) partes.push(`saiu ${saiu.join(", ")}`)
    if (!partes.length) partes.push(a.join() === d.join() ? "letra mudou" : "a ordem mudou")
    return `${quem} mudou as músicas de “${bloco}”: ${partes.join(" · ")}`
}

/**
 * F3 ("musica_tirada"): o nome da música, onde o Sirvo o puser — texto, ou
 * objeto com `nome`, em `depois` ou em `antes`. Tolerante: a forma é do Sirvo.
 */
function nomeDaMusica(antes: unknown, depois: unknown): string | null {
    for (const x of [depois, antes]) {
        if (typeof x === "string" && x.trim()) return x.trim()
        if (x && typeof x === "object") {
            const nome = (x as { nome?: unknown; name?: unknown }).nome ?? (x as { name?: unknown }).name
            if (typeof nome === "string" && nome.trim()) return nome.trim()
        }
    }
    return null
}

/** Quantos blocos a linha "mudou a ordem" lista antes de cortar com "…". */
const ORDEM_MAX = 8

/**
 * Junta o que é a mesma mudança picada em pedaços (cinco toques no "+" viram
 * "10 → 15 min"): chave = quem + o quê + qual bloco; vale o `antes` da primeira
 * e o `depois` da última. ENTRADA EM ORDEM CRESCENTE DE REV.
 * Dois ou mais "mover" viram UMA linha com a ordem que vale agora, do primeiro
 * bloco não concluído em diante (`blocos` é a ordem atual).
 */
export function juntarAvisos(ms: Mudanca[], blocos: BlocoParaAviso[] = []): LinhaDeAviso[] {
    const grupos = new Map<string, { m: Mudanca; antes: unknown; depois: unknown }>()
    for (const m of ms) {
        // duas músicas tiradas do mesmo bloco são duas notícias, não uma "antes → depois"
        const chave = `${m.autor || ""}|${m.tipo}|${m.tipo === "musica_tirada" ? m.rev : (m.bloco_id ?? m.rev)}`
        const g = grupos.get(chave)
        if (g) {
            g.m = m
            g.depois = m.depois
        } else {
            grupos.set(chave, { m, antes: m.antes, depois: m.depois })
        }
    }
    // ida e volta (10 → 12 → 10) não é notícia
    const lista = [...grupos.entries()].filter(([, g]) => !(g.m.tipo === "duracao" && Number(g.antes) === Number(g.depois)))

    const movimentos = lista.filter(([, g]) => g.m.tipo === "mover")
    const pela = blocos.filter((b) => !b.concluido_em)
    if (movimentos.length < 2 || pela.length === 0) {
        return lista.map(([chave, g]) => ({ chave, texto: textoDe(g.m, g.antes, g.depois) }))
    }

    const autores = new Set(movimentos.map(([, g]) => quemFez(g.m)))
    const quem = autores.size === 1 ? `${[...autores][0]} mudou a ordem` : "A ordem mudou"
    const nomes = pela.slice(0, ORDEM_MAX).map((b) => b.titulo)
    const ordem = nomes.join(" → ") + (pela.length > ORDEM_MAX ? " → …" : "")

    // a linha da ordem entra onde estava o PRIMEIRO movimento; os outros somem
    const linhas: LinhaDeAviso[] = []
    let pus = false
    for (const [chave, g] of lista) {
        if (g.m.tipo !== "mover") {
            linhas.push({ chave, texto: textoDe(g.m, g.antes, g.depois) })
        } else if (!pus) {
            linhas.push({ chave: "ordem", texto: `${quem}: ${ordem}` })
            pus = true
        }
    }
    return linhas
}
