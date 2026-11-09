import { uid } from "uid"
import type { ProjectShowRef } from "../../types/Projects"

// ----- AliançaShow · o roteiro do Sirvo dentro do projeto do culto (F0b) -----
//
// Cada bloco do roteiro vira um CABEÇALHO (seção do FreeShow) no projeto, e o
// que está debaixo dele pertence ao bloco: a posição na lista é a própria
// ligação. Desenho: desenho-f0b-montar-projeto.md, §2.2 e §2.4.
//
// Este arquivo só tem a conta, sem store: recebe a lista de agora e o roteiro
// mais novo e devolve a lista certa. Quem chama lê `get(projects)`, chama e
// escreve tudo na mesma passada, sem `await` no meio (§2.5).
//
// Ids fixos, para valer igual depois de um Ctrl+Z e entre dois PCs:
//   sirvo_<uuid>     cabeçalho de um bloco (trancado enquanto o projeto está ligado)
//   sirvo_x_<uuid>   lápide: o bloco sumiu do Sirvo e o cabeçalho tinha conteúdo
//   sirvo_fim        rodapé "Fora do roteiro": do Show, nunca se move
//
// A regra-mãe: nunca apagar o que o operador pôs, e nada pula debaixo da mão
// dele. Um cabeçalho só sai se estiver vazio; com conteúdo ele vira lápide.

/** o que a conta usa de um bloco do `show_roteiro` (o `Bloco` do aliancaSirvo cabe aqui) */
export type BlocoParaProjeto = {
    id: string
    titulo: string
    tipo?: string | null
    cor?: string | null
    duracao_min?: number | null
    inicio_previsto?: string | null
    responsavel?: string | null
    nota?: string | null
    link?: string | null
}

/** o que fica guardado em `data.sirvo` de cada cabeçalho (o `estado` não: mudaria a cada bloco concluído) */
export type DadosSirvoDoCabecalho = { blocoId: string; tipo: string | null; duracaoMin: number | null; responsavel: string | null; nota: string | null; link: string | null }
const CAMPOS_SIRVO: (keyof DadosSirvoDoCabecalho)[] = ["blocoId", "tipo", "duracaoMin", "responsavel", "nota", "link"]

export type OpcoesReconciliar = {
    /** posições (na lista recebida) usadas por um ponteiro vivo: item ativo, foco, saídas. Cabeçalho ativo nunca sai */
    ativos?: number[]
    /** momento protegido (culto ao vivo): a ordem só muda sozinha DEPOIS de todos os ativos */
    protegido?: boolean
    /** o operador apertou "Aplicar": passa por cima da trava de sanidade e do momento protegido */
    forcar?: boolean
    /** id da seção comum que nasce de uma duplicata (padrão: uid(5), como as seções do FreeShow) */
    novoId?: () => string
    /**
     * Início PLANEJADO do culto (`comeca_em`). A hora de cada cabeçalho é a do
     * PLANO (início + durações dos blocos de cima), não o `inicio_previsto`:
     * esse anda a cada bloco concluído, e gravar no projeto a cada bloco
     * acordaria o autosave e o Remote do Pedro a cada troca, no meio do culto.
     * Sem ele, a hora do cabeçalho não é tocada.
     */
    comecaEm?: string | null
}

/** "HH:MM" planejado de cada bloco: início do culto + soma das durações de cima */
export function horasPlanejadas(blocos: BlocoParaProjeto[], comecaEm: string | null | undefined): Map<string, string> {
    const horas = new Map<string, string>()
    let t = comecaEm ? Date.parse(comecaEm) : NaN
    if (isNaN(t)) return horas
    for (const b of blocos) {
        horas.set(b.id, horaDoBloco(new Date(t).toISOString()))
        const d = Number(b.duracao_min)
        t += (Number.isFinite(d) && d > 0 ? d : 0) * 60_000
    }
    return horas
}

export type MotivoPendente = "roteiro_vazio" | "muitos_sumiram" | "no_ar"

export type ResultadoReconciliar = {
    /** a lista nova; é a MESMA lista recebida quando a ordem não mudou */
    itens: ProjectShowRef[]
    /** algum item foi alterado no próprio objeto (nome, cor, data, id de lápide ou de duplicata) */
    mudouCampos: boolean
    /** a sequência de objetos mudou */
    mudouEstrutura: boolean
    /** havia mudança de ordem e ela NÃO foi aplicada: espera o "Aplicar" */
    pendente: boolean
    motivo: MotivoPendente | null
    /** cabeçalhos ligados cujo bloco não existe mais no roteiro */
    sumiram: number
}

export const PREFIXO_SIRVO = "sirvo_"
export const PREFIXO_LAPIDE = "sirvo_x_"
export const ID_RODAPE = "sirvo_fim"
export const NOME_RODAPE = "Fora do roteiro"
export const COR_LAPIDE = "#808080"

export const idDoCabecalho = (blocoId: string) => `${PREFIXO_SIRVO}${blocoId}`
export const idDaLapide = (blocoId: string) => `${PREFIXO_LAPIDE}${blocoId}`

/** o papel de um item no projeto ligado; null para tudo o que é do operador (inclusive as seções dele) */
export function papelDoItem(item: ProjectShowRef | null | undefined): "cabecalho" | "lapide" | "rodape" | null {
    if (!item || item.type !== "section" || typeof item.id !== "string" || !item.id.startsWith(PREFIXO_SIRVO)) return null
    if (item.id === ID_RODAPE) return "rodape"
    if (item.id.startsWith(PREFIXO_LAPIDE)) return "lapide"
    return "cabecalho"
}

/**
 * A trava POR ITEM (§2.6): o cabeçalho de um bloco, num projeto ligado a um
 * culto, não se arrasta, renomeia, recolore nem apaga à mão. Lápide e rodapé
 * ficam livres, e o resto do projeto também. Sem internet a trava continua (não
 * há com o que comparar); "Desligar do Sirvo" solta tudo.
 */
export function cabecalhoTrancado(projeto: { sirvo?: { eventId?: string } | null } | null | undefined, item: ProjectShowRef | null | undefined) {
    return !!projeto?.sirvo?.eventId && papelDoItem(item) === "cabecalho"
}

/**
 * O que não sai à mão de um projeto ligado: o cabeçalho (trancado) e o rodapé
 * "Fora do roteiro". O rodapé pode ser renomeado e recolorido, mas apagado ele
 * volta na passada seguinte, e essa volta conta como mudança de estrutura e
 * apaga o Ctrl+Z da lista (teste do André, 08/nov: Ctrl+A + Delete levava o
 * rodapé junto, ele voltava, e o Ctrl+Z não desfazia mais nada).
 */
export function naoSaiDoProjeto(projeto: { sirvo?: { eventId?: string } | null } | null | undefined, item: ProjectShowRef | null | undefined) {
    if (!projeto?.sirvo?.eventId) return false
    const papel = papelDoItem(item)
    return papel === "cabecalho" || papel === "rodape"
}

/** quantos itens são do operador: cabeçalho, lápide e rodapé do Sirvo não contam como material */
export function quantosDoOperador(itens: ProjectShowRef[] | null | undefined) {
    return (itens || []).filter((i) => i && !papelDoItem(i)).length
}

/** o link da nota do bloco, só se for https:// de verdade; "" para o resto */
export function linkSeguro(link: string | null | undefined) {
    if (typeof link !== "string") return ""
    try {
        const u = new URL(link.trim())
        return u.protocol === "https:" && !!u.hostname && !u.username && !u.password ? u.href : ""
    } catch {
        return ""
    }
}

// ---------------------------------------------------------------- campos

const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

/** "HH:MM" em São Paulo, o formato que a seção do FreeShow usa em `data.time`; "" se não for hora */
export function horaDoBloco(iso: string | null | undefined) {
    const t = iso ? Date.parse(iso) : NaN
    return isNaN(t) ? "" : fmtHora.format(new Date(t))
}

/** a cor vai para um `style` no PCL: só aceita #rgb ou #rrggbb */
function corValida(cor: string | null | undefined) {
    return typeof cor === "string" && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(cor) ? cor : null
}

// o Svelte escapa o texto; aqui só tira caractere de controle e põe um teto
const texto = (t: string | null | undefined) => (t || "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 200)
const textoOuNull = (t: string | null | undefined) => (t ? texto(t) : null)

function dadosDoBloco(b: BlocoParaProjeto): DadosSirvoDoCabecalho {
    const duracao = Number(b.duracao_min)
    return { blocoId: b.id, tipo: textoOuNull(b.tipo), duracaoMin: Number.isFinite(duracao) && b.duracao_min !== null ? duracao : null, responsavel: textoOuNull(b.responsavel), nota: b.nota ? String(b.nota).slice(0, 2000) : null, link: b.link ? String(b.link).slice(0, 2000) : null }
}

const mesmosDados = (a: any, b: DadosSirvoDoCabecalho) => !!a && typeof a === "object" && CAMPOS_SIRVO.every((k) => (a[k] ?? null) === b[k])

/**
 * Nome, cor, `data.time` e `data.sirvo` no PRÓPRIO objeto, e só o que difere:
 * uma escrita à toa acorda o autosave, o Remote e a própria reconciliação.
 * `data` é mesclado: o que o operador pôs (ex.: a ação da seção) fica.
 */
function aplicarCampos(item: ProjectShowRef, b: BlocoParaProjeto, hora: string) {
    let mudou = false

    const nome = texto(b.titulo)
    if (item.name !== nome) {
        item.name = nome
        mudou = true
    }

    const cor = corValida(b.cor)
    if ((item.color ?? null) !== cor) {
        if (cor) item.color = cor
        else delete item.color
        mudou = true
    }

    const data = item.data && typeof item.data === "object" ? item.data : {}

    const sirvo = dadosDoBloco(b)
    // sem hora válida, não apaga a que já estava
    const horaMudou = !!hora && data.time !== hora
    if (horaMudou || !mesmosDados(data.sirvo, sirvo) || item.data !== data) {
        item.data = { ...data, ...(hora ? { time: hora } : {}), sirvo }
        mudou = true
    }

    return mudou
}

function novoCabecalho(b: BlocoParaProjeto, hora: string): ProjectShowRef {
    const item: ProjectShowRef = { id: idDoCabecalho(b.id), type: "section", name: "" }
    aplicarCampos(item, b, hora)
    return item
}

const novoRodape = (): ProjectShowRef => ({ id: ID_RODAPE, type: "section", name: NOME_RODAPE })

function tirarSirvoDoData(item: ProjectShowRef) {
    if (!item.data || typeof item.data !== "object" || !("sirvo" in item.data)) return
    const { sirvo: _fora, ...resto } = item.data
    item.data = resto
}

/** o bloco sumiu do Sirvo e o cabeçalho tinha conteúdo: fica no lugar, cinza e destrancado */
function virarLapide(item: ProjectShowRef, blocoId: string) {
    item.id = idDaLapide(blocoId)
    item.name = `(removido no Sirvo) ${item.name || ""}`.trim()
    item.color = COR_LAPIDE
    tirarSirvoDoData(item)
}

// ---------------------------------------------------------------- a reconciliação

type Segmento = {
    papel: "cabeca" | "familia" | "lapide" | "rodape"
    itens: ProjectShowRef[]
    blocoId?: string
    /** estava depois do rodapé: é cauda, e a cauda não se reorganiza */
    depoisDoRodape: boolean
    removido?: boolean
}

/**
 * Põe o roteiro no projeto: `itens` é a lista do projeto agora, `blocos` o
 * roteiro mais novo, na ordem do Sirvo.
 *
 *   1. Recorta em cabeça (antes do primeiro item do Sirvo), famílias (um
 *      cabeçalho e o que vem embaixo), lápides e cauda (o rodapé e o que vem
 *      depois).
 *   2. Atualiza os campos no próprio objeto, só o que difere.
 *   3. Família sem bloco: sai se for só o cabeçalho (e não estiver ativo);
 *      senão vira lápide no mesmo lugar.
 *   4. Ordem: se as famílias já estão na ordem do Sirvo, nada se move: bloco
 *      novo entra logo depois do bloco anterior. Se não, monta cabeça,
 *      famílias na ordem do Sirvo, rodapé, as lápides (que só agora descem) e
 *      o resto da cauda como estava.
 *   5. Compara a sequência de OBJETOS: se não mudou, devolve a mesma lista.
 *   6. Trava: roteiro vazio ou mais da metade dos blocos ligados sumindo de
 *      uma vez não se aplica sozinho.
 *
 * Idempotente: rodar de novo sobre o resultado não muda nada.
 */
export function reconciliar(itens: ProjectShowRef[], blocos: BlocoParaProjeto[], opcoes: OpcoesReconciliar = {}): ResultadoReconciliar {
    const ativos = new Set(opcoes.ativos || [])
    const novoId = opcoes.novoId || (() => uid(5))
    let mudouCampos = false

    // um bloco repetido na resposta entraria duas vezes
    const vistosBloco = new Set<string>()
    const roteiro = (blocos || []).filter((b) => {
        if (!b?.id || vistosBloco.has(b.id)) return false
        vistosBloco.add(b.id)
        return true
    })
    const doRoteiro = new Map(roteiro.map((b) => [b.id, b]))
    const horas = horasPlanejadas(roteiro, opcoes.comecaEm)

    // Duplicata de um id do Sirvo (copiar e colar): a primeira é a oficial; as
    // outras viram seção comum, com id novo, e nunca são apagadas.
    const vistosId = new Set<string>()
    for (const item of itens) {
        if (!papelDoItem(item)) continue
        if (!vistosId.has(item.id)) {
            vistosId.add(item.id)
            continue
        }
        item.id = novoId()
        tirarSirvoDoData(item)
        mudouCampos = true
    }

    // 1. recortar
    const segmentos: Segmento[] = [{ papel: "cabeca", itens: [], depoisDoRodape: false }]
    let vistoRodape = false
    for (const item of itens) {
        const papel = papelDoItem(item)
        if (papel === "rodape") vistoRodape = true
        if (papel === "cabecalho") segmentos.push({ papel: "familia", itens: [item], blocoId: item.id.slice(PREFIXO_SIRVO.length), depoisDoRodape: vistoRodape })
        else if (papel) segmentos.push({ papel, itens: [item], depoisDoRodape: vistoRodape })
        else segmentos[segmentos.length - 1].itens.push(item)
    }
    const familias = segmentos.filter((s) => s.papel === "familia")

    // 2. campos (valem até com a ordem pendente: não movem nada)
    for (const f of familias) {
        const bloco = doRoteiro.get(f.blocoId!)
        if (bloco && aplicarCampos(f.itens[0], bloco, horas.get(bloco.id) || "")) mudouCampos = true
    }

    const semMudanca = (motivo: MotivoPendente | null, sumiram: number): ResultadoReconciliar => ({ itens, mudouCampos, mudouEstrutura: false, pendente: !!motivo, motivo, sumiram })

    // 6. trava de sanidade, antes de apagar ou transformar qualquer cabeçalho
    const sumidas = familias.filter((f) => !doRoteiro.has(f.blocoId!))
    if (!roteiro.length && !familias.length) return semMudanca(null, 0)
    if (!opcoes.forcar) {
        if (!roteiro.length) return semMudanca("roteiro_vazio", sumidas.length)
        if (sumidas.length * 2 > familias.length) return semMudanca("muitos_sumiram", sumidas.length)
    }

    // 3. apagados
    for (const f of sumidas) {
        const cabecalho = f.itens[0]
        if (f.itens.length === 1 && !ativos.has(itens.indexOf(cabecalho))) {
            f.removido = true
            continue
        }
        virarLapide(cabecalho, f.blocoId!)
        f.papel = "lapide"
        mudouCampos = true
    }

    // 4. ordem
    const vivas = segmentos.filter((s) => s.papel === "familia")
    const porBloco = new Map(vivas.map((f) => [f.blocoId!, f]))
    const ordemAtual = vivas.map((f) => f.blocoId)
    const ordemSirvo = roteiro.map((b) => b.id).filter((id) => porBloco.has(id))
    const reorganizar = ordemAtual.join("\n") !== ordemSirvo.join("\n") || vivas.some((f) => f.depoisDoRodape)

    let novos: ProjectShowRef[]
    if (reorganizar) {
        const rodape = segmentos.find((s) => s.papel === "rodape")
        novos = [...segmentos[0].itens]
        for (const b of roteiro) novos.push(...(porBloco.get(b.id)?.itens || [novoCabecalho(b, horas.get(b.id) || "")]))
        novos.push(rodape ? rodape.itens[0] : novoRodape())
        // as lápides de cima descem agora, com o conteúdo delas
        for (const s of segmentos) if (s.papel === "lapide" && !s.depoisDoRodape) novos.push(...s.itens)
        // o resto da cauda fica como estava (as famílias que estavam lá já subiram)
        for (const s of segmentos) {
            if (!s.depoisDoRodape || s.removido || s.papel === "familia") continue
            novos.push(...(s === rodape ? s.itens.slice(1) : s.itens))
        }
    } else {
        // nada se move: só sai o cabeçalho vazio e entra o bloco novo
        const lista = segmentos.filter((s) => !s.removido)
        const posicaoDoBloco = new Map<string, Segmento>(vivas.map((f) => [f.blocoId!, f]))
        roteiro.forEach((b, i) => {
            if (posicaoDoBloco.has(b.id)) return
            const seg: Segmento = { papel: "familia", itens: [novoCabecalho(b, horas.get(b.id) || "")], blocoId: b.id, depoisDoRodape: false }
            posicaoDoBloco.set(b.id, seg)

            // logo depois do bloco anterior que já está no projeto
            for (let j = i - 1; j >= 0; j--) {
                const anterior = posicaoDoBloco.get(roteiro[j].id)
                if (!anterior) continue
                lista.splice(lista.indexOf(anterior) + 1, 0, seg)
                return
            }
            // é o primeiro: antes da primeira família; sem família, antes do rodapé; sem rodapé, no fim
            const primeiraFamilia = lista.findIndex((s) => s.papel === "familia")
            const antesDe = primeiraFamilia >= 0 ? primeiraFamilia : lista.findIndex((s) => s.papel === "rodape")
            if (antesDe >= 0) lista.splice(antesDe, 0, seg)
            else lista.push(seg)
        })
        novos = lista.flatMap((s) => s.itens)
        if (!lista.some((s) => s.papel === "rodape")) novos.push(novoRodape())
    }

    // 5. mudou a estrutura?
    const mudouEstrutura = novos.length !== itens.length || novos.some((item, i) => item !== itens[i])
    if (!mudouEstrutura) return semMudanca(null, sumidas.length)

    // momento protegido: só se a primeira posição que muda vem depois de todo ponteiro vivo
    if (opcoes.protegido && !opcoes.forcar) {
        let primeira = 0
        while (primeira < novos.length && novos[primeira] === itens[primeira]) primeira++
        const ultimoAtivo = Math.max(-1, ...ativos)
        if (primeira <= ultimoAtivo) return semMudanca("no_ar", sumidas.length)
    }

    return { itens: novos, mudouCampos, mudouEstrutura: true, pendente: false, motivo: null, sumiram: sumidas.length }
}

// ---------------------------------------------------------------- o que está pendente

export type ResumoPendencia = { movidos: string[]; novos: string[]; sumidos: string[]; trocados?: [string, string] }

/**
 * O que o Sirvo mudou e o projeto ainda não tem, para a faixa dizer em vez de
 * só avisar (o pendente nunca é silencioso). Movidos são os blocos fora da
 * maior sequência que já está na ordem certa: mover um bloco aparece como um
 * bloco só, não como todos os que ficaram entre as duas posições.
 *
 * Dois vizinhos que trocaram de lugar não têm "o que mudou": "aviso subiu" e
 * "palavra desceu" são a mesma mudança, e a escolha da subsequência era sorte
 * (o André moveu o aviso e a faixa disse palavra). Aí vira `trocados`.
 */
export function resumirPendencia(itens: ProjectShowRef[], blocos: BlocoParaProjeto[]): ResumoPendencia {
    const vistos = new Set<string>()
    const cabecalhos: { blocoId: string; nome: string }[] = []
    for (const item of itens || []) {
        if (papelDoItem(item) !== "cabecalho" || vistos.has(item.id)) continue
        vistos.add(item.id)
        cabecalhos.push({ blocoId: item.id.slice(PREFIXO_SIRVO.length), nome: item.name || "" })
    }

    const posicaoNoSirvo = new Map<string, number>()
    const titulo = new Map<string, string>()
    ;(blocos || []).forEach((b, i) => {
        if (!b?.id || posicaoNoSirvo.has(b.id)) return
        posicaoNoSirvo.set(b.id, i)
        titulo.set(b.id, texto(b.titulo))
    })

    const noProjeto = new Set(cabecalhos.map((c) => c.blocoId))
    const sumidos = cabecalhos.filter((c) => !posicaoNoSirvo.has(c.blocoId)).map((c) => c.nome)
    const novos = [...posicaoNoSirvo.keys()].filter((id) => !noProjeto.has(id)).map((id) => titulo.get(id) || "")

    // maior subsequência crescente das posições no Sirvo, na ordem do projeto
    const comuns = cabecalhos.filter((c) => posicaoNoSirvo.has(c.blocoId))
    const seq = comuns.map((c) => posicaoNoSirvo.get(c.blocoId)!)
    const fim: number[] = [] // fim[k]: índice em seq do menor final de uma subsequência de tamanho k+1
    const anterior: number[] = seq.map(() => -1)
    seq.forEach((v, i) => {
        let lo = 0
        let hi = fim.length
        while (lo < hi) {
            const meio = (lo + hi) >> 1
            if (seq[fim[meio]] < v) lo = meio + 1
            else hi = meio
        }
        if (lo > 0) anterior[i] = fim[lo - 1]
        fim[lo] = i
    })
    const ficam = new Set<number>()
    for (let i = fim.length ? fim[fim.length - 1] : -1; i >= 0; i = anterior[i]) ficam.add(i)
    const nomeDe = (c: { blocoId: string; nome: string }) => titulo.get(c.blocoId) || c.nome
    const fora = comuns.map((_c, i) => i).filter((i) => !ficam.has(i))

    if (fora.length === 1) {
        // posição de cada um na ordem nova, contando só os que estão nos dois lados
        const rank = new Map([...seq].sort((a, b) => a - b).map((v, k) => [v, k]))
        const i = fora[0]
        const j = rank.get(seq[i])!
        if (Math.abs(i - j) === 1 && rank.get(seq[j]) === i) {
            const [primeiro, segundo] = i < j ? [comuns[j], comuns[i]] : [comuns[i], comuns[j]]
            return { movidos: [], novos, sumidos, trocados: [nomeDe(primeiro), nomeDe(segundo)] }
        }
    }

    return { movidos: fora.map((i) => nomeDe(comuns[i])), novos, sumidos }
}

const lista = (nomes: string[]) => {
    const n = nomes.map((x) => x || "sem nome")
    if (n.length === 1) return n[0]
    if (n.length === 2) return `${n[0]} e ${n[1]}`
    return `${n.length} blocos`
}

/** "Louvor mudou de lugar · bloco novo: Avisos" — curto, para caber numa linha da faixa */
export function textoDaPendencia(r: ResumoPendencia) {
    const partes: string[] = []
    if (r.trocados) partes.push(`${lista(r.trocados)} trocaram de lugar`)
    if (r.movidos.length) partes.push(`${lista(r.movidos)} ${r.movidos.length === 1 ? "mudou" : "mudaram"} de lugar`)
    if (r.novos.length) partes.push(r.novos.length <= 2 ? `${r.novos.length === 1 ? "bloco novo" : "blocos novos"}: ${lista(r.novos)}` : `${r.novos.length} blocos novos`)
    if (r.sumidos.length) partes.push(r.sumidos.length <= 2 ? `${r.sumidos.length === 1 ? "saiu do Sirvo" : "saíram do Sirvo"}: ${lista(r.sumidos)}` : `${r.sumidos.length} blocos saíram do Sirvo`)
    return partes.join(" · ")
}
