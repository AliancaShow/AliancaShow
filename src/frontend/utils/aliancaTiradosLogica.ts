import type { ProjectShowRef } from "../../types/Projects"
import { papelDoItem, ID_RODAPE, idDoCabecalho } from "./aliancaSirvoProjeto"

// ----- AliançaShow · Preparar, fatia 3: o item que o operador tirou fica riscado, com Desfazer -----
//
// Só a conta, sem store (quem liga aos stores é aliancaTirados.ts).
//
// O "rastro" é uma linha que mora SÓ na tela (memória da janela principal): nunca entra em
// `projects`, então salvar, nuvem, celular, Remote, "próximo item" e a reconciliação do Sirvo
// nunca o veem. Nasce em `deleteActions.show` (a única porta do "operador tirou") e some quando
// o item volta ao projeto.
//
//   visível    o item está fora do projeto: linha riscada "tirado" + Desfazer
//   dormindo   o item voltou (Ctrl+Z, colar, Desfazer): a linha some, mas o rastro fica guardado;
//              só acorda se o item sair de novo por um Ctrl+Z/Ctrl+Shift+Z (que não passa pelo
//              `deleteActions.show`, então não nasceria rastro novo). Qualquer outra saída
//              com o rastro dormindo descarta: o operador que tirou de novo ganha um rastro novo.

export type ApoioDoRastro = { id: string; type: string; /** a enésima ocorrência (1-based) de id+type entre os itens que ficaram */ ocorrencia: number }

export type Tirado = {
    chave: string
    projetoId: string
    /** cópia do item, sem `index`/`played` */
    item: ProjectShowRef
    /** o item vivo imediatamente antes (que não saiu na mesma ação); null = era o primeiro */
    depoisDe: ApoioDoRastro | null
    /** a posição que tinha na lista de antes */
    indice: number
    /** quantas vezes id+type estava no projeto antes da ação (menos os iguais, de índice menor, que saíram junto) */
    contagemAntes: number
    /** a marca do Sirvo (`data.sirvoMusica`) */
    rmId: string | null
    em: number
    /** estava no ar (nesta posição) quando saiu */
    noAr: boolean
    dormindo: boolean
    /** já vimos o projeto SEM o item (antes disso um "voltou" não vale: o rastro nasce antes da escrita) */
    armado: boolean
}

export const MAX_RASTROS = 20
/** só passa daqui se todos forem visíveis e ainda assim o operador não parou de tirar */
export const MAX_RASTROS_DURO = 60

export const tipoDe = (item: ProjectShowRef | null | undefined) => (item?.type || "show") as string

const marcaDoItem = (item: ProjectShowRef | null | undefined): string | null => {
    const m = item?.data?.sirvoMusica
    return typeof m === "string" && m ? m : null
}

/** um item sem as marcas de posição que o FreeShow escreve no objeto da lista */
export function semPosicao(item: ProjectShowRef): ProjectShowRef {
    const copia: any = JSON.parse(JSON.stringify(item))
    delete copia.index
    delete copia.played
    return copia
}

// ---------------------------------------------------------------- nascer

/**
 * Um rastro por item tirado. `itens` é a lista de ANTES; `indexes` o que saiu na ação.
 * O vizinho (`depoisDe`) é o item vivo mais perto antes, pulando os que saíram junto.
 */
export function novosRastros(projetoId: string, itens: ProjectShowRef[], indexes: number[], extra: { agora: number; chaves: () => string; noAr?: (item: ProjectShowRef, indice: number) => boolean }): Tirado[] {
    const saem = new Set(indexes)
    const ordem = [...new Set(indexes)].filter((i) => itens[i]).sort((a, b) => a - b)
    const contaAntes = new Map<string, number>()
    for (const item of itens) {
        const k = `${tipoDe(item)}|${item?.id}`
        contaAntes.set(k, (contaAntes.get(k) || 0) + 1)
    }
    const jaSairam = new Map<string, number>()
    return ordem.map((i) => {
        const item = itens[i]
        const k = `${tipoDe(item)}|${item.id}`
        const antes = (contaAntes.get(k) || 1) - (jaSairam.get(k) || 0)
        jaSairam.set(k, (jaSairam.get(k) || 0) + 1)

        let depoisDe: ApoioDoRastro | null = null
        for (let j = i - 1; j >= 0; j--) {
            if (saem.has(j) || !itens[j]) continue
            const viz = itens[j]
            let ocorrencia = 0
            for (let m = 0; m <= j; m++) if (!saem.has(m) && itens[m] && itens[m].id === viz.id && tipoDe(itens[m]) === tipoDe(viz)) ocorrencia++
            depoisDe = { id: viz.id, type: tipoDe(viz), ocorrencia }
            break
        }

        return { chave: extra.chaves(), projetoId, item: semPosicao(item), depoisDe, indice: i, contagemAntes: antes, rmId: marcaDoItem(item), em: extra.agora, noAr: extra.noAr ? extra.noAr(item, i) : false, dormindo: false, armado: false }
    })
}

/** o que `registrarTirados` apaga antes de guardar o novo: dormindo do mesmo rmId ou id+type (o operador tirou DE NOVO) */
export function semDormindoRepetido(lista: Tirado[], novos: Tirado[]): Tirado[] {
    return lista.filter((r) => !(r.dormindo && novos.some((n) => (n.rmId && n.rmId === r.rmId) || (!n.rmId && !r.rmId && tipoDe(n.item) === tipoDe(r.item) && n.item.id === r.item.id))))
}

/** o limite: dormindo primeiro (o mais velho), depois — só passando do limite duro — o visível mais velho */
export function limitar(lista: Tirado[], max = MAX_RASTROS): Tirado[] {
    let nova = lista
    while (nova.length > max) {
        const dorme = nova.filter((r) => r.dormindo).sort((a, b) => a.em - b.em)[0]
        if (dorme) {
            nova = nova.filter((r) => r !== dorme)
            continue
        }
        if (nova.length <= MAX_RASTROS_DURO) break
        const velho = [...nova].sort((a, b) => a.em - b.em)[0]
        nova = nova.filter((r) => r !== velho)
    }
    return nova
}

// ---------------------------------------------------------------- voltou?

const ocorrencias = (vivos: ProjectShowRef[], id: string, type: string) => vivos.filter((v) => v && v.id === id && tipoDe(v) === type).length

/** o item do rastro está de volta no projeto? Com marca: a marca; sem marca: id+type voltou a ter tantas ocorrências quanto antes */
export function voltou(r: Tirado, vivos: ProjectShowRef[], marcas: Set<string>): boolean {
    if (r.rmId) return marcas.has(r.rmId)
    return ocorrencias(vivos, r.item.id, tipoDe(r.item)) >= r.contagemAntes
}

export type ResultadoPoda = { lista: Tirado[]; mudou: boolean }

/**
 * A lista do projeto mudou: quem voltou dorme; quem dorme e saiu de novo acorda (só se foi Ctrl+Z/Ctrl+Shift+Z)
 * ou é descartado. Devolve a MESMA lista quando nada muda.
 */
export function podar(lista: Tirado[], vivos: ProjectShowRef[] | null, desfazendo: boolean): ResultadoPoda {
    if (!vivos) return { lista: [], mudou: lista.length > 0 }
    const marcas = new Set<string>()
    for (const v of vivos) {
        const m = marcaDoItem(v)
        if (m) marcas.add(m)
    }
    let mudou = false
    const nova: Tirado[] = []
    for (const r of lista) {
        const v = voltou(r, vivos, marcas)
        if (!r.armado) {
            if (!v) {
                nova.push({ ...r, armado: true })
                mudou = true
            } else nova.push(r)
            continue
        }
        if (!r.dormindo && v) {
            nova.push({ ...r, dormindo: true })
            mudou = true
        } else if (r.dormindo && !v) {
            mudou = true
            if (desfazendo) nova.push({ ...r, dormindo: false })
            // senão: descarta
        } else nova.push(r)
    }
    return { lista: mudou ? nova : lista, mudou }
}

// ---------------------------------------------------------------- onde fica

/** posição (0..length) onde o item entra na lista viva: logo depois do vizinho; sem o vizinho, pelo índice de antes */
export function posicaoDoRastro(vivos: ProjectShowRef[], r: Pick<Tirado, "depoisDe" | "indice">): number {
    if (!r.depoisDe) return 0
    let n = 0
    for (let i = 0; i < vivos.length; i++) {
        const v = vivos[i]
        if (v && v.id === r.depoisDe.id && tipoDe(v) === r.depoisDe.type && ++n === r.depoisDe.ocorrencia) return i + 1
    }
    return Math.max(0, Math.min(r.indice, vivos.length))
}

export type Marcador = { chave: string; pos: number; indice: number }

/** a ordem dos marcadores na lista: pela posição, depois pelo índice de antes, depois por quem saiu primeiro */
export function ordenarMarcadores(m: (Marcador & { em?: number })[]): Marcador[] {
    return [...m].sort((a, b) => a.pos - b.pos || a.indice - b.indice || (a.em || 0) - (b.em || 0))
}

// ---------------------------------------------------------------- rastro que vem do Sirvo (depois de reabrir o app)

export type DispensaParaRastro = { rmId: string; blocoId: string; nome: string; envio: string }

export type Sintetico = { chave: string; rmId: string; nome: string; pos: number; /** sem botão: o Sirvo também tirou */ semBotao: boolean }

/** fim da família do bloco (antes do próximo cabeçalho/lápide/rodapé); bloco ausente → antes do rodapé, ou no fim */
export function posicaoNoBloco(vivos: ProjectShowRef[], blocoId: string | null): number {
    if (blocoId) {
        const h = vivos.findIndex((v) => v && v.type === "section" && v.id === idDoCabecalho(blocoId))
        if (h >= 0) {
            for (let i = h + 1; i < vivos.length; i++) if (papelDoItem(vivos[i])) return i
            return vivos.length
        }
    }
    const f = vivos.findIndex((v) => v && v.type === "section" && v.id === ID_RODAPE)
    return f >= 0 ? f : vivos.length
}

/**
 * Uma dispensa viva do culto sem item no projeto e sem rastro desta sessão vira linha riscada.
 * `aguardando | confirmar | fila | local`: com Desfazer. `enviada`: sem botão ("tirada também no Sirvo").
 * `devolver`: sem rastro (já está voltando).
 */
export function sinteticosDoSirvo(dispensas: DispensaParaRastro[], vivos: ProjectShowRef[], rmIdsComRastro: Set<string>, blocoExiste: (blocoId: string) => boolean | null): Sintetico[] {
    const marcas = new Set<string>()
    for (const v of vivos) {
        const m = marcaDoItem(v)
        if (m) marcas.add(m)
    }
    const saida: Sintetico[] = []
    for (const d of dispensas) {
        if (marcas.has(d.rmId) || rmIdsComRastro.has(d.rmId)) continue
        if (d.envio === "devolver") continue
        const semBotao = d.envio === "enviada"
        if (!semBotao && !["aguardando", "confirmar", "fila", "local"].includes(d.envio)) continue
        // roteiro não carregado (null) ou bloco que não existe mais: antes do rodapé
        const existe = blocoExiste(d.blocoId)
        saida.push({ chave: `sirvo:${d.rmId}`, rmId: d.rmId, nome: d.nome, pos: posicaoNoBloco(vivos, existe ? d.blocoId : null), semBotao })
    }
    return saida
}

// ---------------------------------------------------------------- ponteiros por posição (o que está no ar aponta por índice)

/** a posição de um ponteiro depois de tirar os itens `removidos` (índices de antes). Quem aponta para um item tirado fica na posição dele. */
export function indiceAposTirar(i: number, removidos: number[]): number {
    return i - removidos.filter((r) => r < i).length
}

/** a posição de um ponteiro depois de inserir um item em `pos` */
export function indiceAposRepor(i: number, pos: number): number {
    return pos <= i ? i + 1 : i
}

// ---------------------------------------------------------------- "ainda no ar" e flag do Ctrl+Z

let emDesfazerRefazer = false

/** history.ts liga em volta de `history(lastUndo, true)` e do refazer: a escrita em `projects` é síncrona */
export function durante<T>(fn: () => T): T {
    const antes = emDesfazerRefazer
    emDesfazerRefazer = true
    try {
        return fn()
    } finally {
        emDesfazerRefazer = antes
    }
}
export const desfazendoAgora = () => emDesfazerRefazer
