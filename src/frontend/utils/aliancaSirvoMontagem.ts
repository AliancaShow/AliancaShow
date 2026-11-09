import type { Project, ProjectShowRef } from "../../types/Projects"
import { acharProjetoEm, caminhoDoCultoSirvo, dataDoCulto, ligadoAOutroCulto, projetoLigadoAoCulto } from "./aliancaPastas"
import { papelDoItem } from "./aliancaSirvoProjeto"

// ----- AliançaShow · qual projeto recebe o roteiro do Sirvo (F0b, passo 4) -----
//
// Só a DECISÃO, sem store: quem chama (aliancaSirvoMontar.ts) lê os stores,
// pergunta aqui o que fazer e faz. Desenho: desenho-f0b-montar-projeto.md,
// §1.2, §2.3 e as "Decisões do André" no fim.
//
//   1. o projeto já ligado a este culto (em qualquer pasta)  -> reconciliar
//   2. dois ou mais EVENTOS no dia (com roteiro ou não)       -> não cria nem monta;
//      a faixa avisa (o nome com horário ainda depende do Pedro)
//   3. o projeto do dia, achado pelo nome na pasta da data:
//        ligado a outro culto          -> pergunta
//        este culto já foi montado     -> pergunta ("montar de novo?"); nunca remonta sozinho
//        vazio                         -> monta sozinho
//        com conteúdo                  -> pergunta
//   4. não existe projeto do dia                              -> cria e monta
//      (a não ser que este culto já tenha sido montado: o projeto foi apagado
//      de propósito, e o Remote recria o "DD" quando for o caso)

type ProjetoParaDecidir = Partial<Pick<Project, "name" | "parent" | "archived" | "deleted" | "sirvo" | "shows">>
type Pastas = { [id: string]: { name?: string; parent?: string } | undefined }
type CultoDaLista = { event_id: string; comeca_em: string }

export type EntradaDecisao = {
    /** o culto que o Show segue */
    eventId: string
    /** o começo do culto (do roteiro), para achar a data em São Paulo */
    comecaEm: string
    /** quantos blocos o roteiro aceito tem */
    blocos: number
    /** a lista do show_cultos: todo evento conta, tenha roteiro ou não */
    cultos: CultoDaLista[]
    projetos: { [id: string]: ProjetoParaDecidir }
    pastas: Pastas
    /** a memória "já montei este culto": eventId -> projeto */
    montados: { [eventId: string]: string }
}

export type MotivoPergunta = "tem_conteudo" | "montado_antes" | "outro_culto"

export type Decisao = { acao: "nada"; motivo: "sem_data" | "roteiro_vazio" | "apagado" | "arquivado" } | { acao: "reconciliar"; projetoId: string } | { acao: "varios_no_dia"; projetoId: string | null; quantos: number } | { acao: "criar"; pastas: string[]; nome: string } | { acao: "montar"; projetoId: string } | { acao: "perguntar"; projetoId: string; motivo: MotivoPergunta }

/** a pasta pelo caminho, sem criar nada (null se alguma parte não existe) */
export function pastaPeloCaminho(pastas: Pastas, caminho: string[]): string | null {
    let pai = "/"
    for (const nome of caminho) {
        const achada = Object.entries(pastas).find(([, f]) => f?.name === nome && f?.parent === pai)
        if (!achada) return null
        pai = achada[0]
    }
    return pai
}

/** quantos eventos o Sirvo tem na data deste culto (São Paulo), contando ele mesmo */
export function eventosNoDia(eventId: string, comecaEm: string, cultos: CultoDaLista[]) {
    const data = dataDoCulto(comecaEm)
    if (!data) return 0
    const ids = new Set((cultos || []).filter((c) => c?.event_id && dataDoCulto(c.comeca_em) === data).map((c) => c.event_id))
    ids.add(eventId)
    return ids.size
}

export function decidirProjeto(e: EntradaDecisao): Decisao {
    const caminho = caminhoDoCultoSirvo({ event_id: e.eventId, comeca_em: e.comecaEm }, [])
    const pastaDoDia = caminho ? pastaPeloCaminho(e.pastas, caminho.pastas) : null

    // 1. já ligado: a ligação é pelo eventId, nunca pelo nome
    const ligado = projetoLigadoAoCulto(e.projetos, e.eventId, pastaDoDia)
    if (ligado) return { acao: "reconciliar", projetoId: ligado }

    if (!caminho) return { acao: "nada", motivo: "sem_data" }
    const doDia = pastaDoDia ? acharProjetoEm(e.projetos, pastaDoDia, caminho.dia) : null

    // 2. dois cultos no mesmo dia: o nome do segundo projeto ainda não foi combinado
    const quantos = eventosNoDia(e.eventId, e.comecaEm, e.cultos)
    if (quantos > 1) return { acao: "varios_no_dia", projetoId: doDia, quantos }

    // sem bloco nenhum não há o que montar (nem projeto a criar)
    if (!(e.blocos > 0)) return { acao: "nada", motivo: "roteiro_vazio" }

    const jaMontado = !!e.montados?.[e.eventId]

    // 4. não existe o projeto do dia
    if (!doDia) return jaMontado ? { acao: "nada", motivo: "apagado" } : { acao: "criar", pastas: caminho.pastas, nome: caminho.projeto }

    // 3. existe
    const projeto = e.projetos[doDia]
    // o primeiro pelo nome é o que o Remote usa: se está arquivado, criar outro "DD" deixaria os dois lados em projetos diferentes
    if (projeto?.archived || projeto?.deleted) return { acao: "nada", motivo: "arquivado" }
    if (ligadoAOutroCulto(projeto, e.eventId)) return { acao: "perguntar", projetoId: doDia, motivo: "outro_culto" }
    if (jaMontado) return { acao: "perguntar", projetoId: doDia, motivo: "montado_antes" }
    if (!projeto?.shows?.length) return { acao: "montar", projetoId: doDia }
    return { acao: "perguntar", projetoId: doDia, motivo: "tem_conteudo" }
}

/**
 * A lista nova só ACRESCENTA no fim: todo item que já existia continua na
 * mesma posição. Assim nenhum ponteiro por posição (item ativo, saída,
 * seleção, arrasto) aponta para outro item depois da escrita.
 */
export function apenasAcrescenta(antes: ProjectShowRef[], depois: ProjectShowRef[]) {
    return depois.length >= antes.length && antes.every((item, i) => depois[i] === item)
}

/**
 * "Desligar do Sirvo": os cabeçalhos, lápides e o rodapé viram seções comuns,
 * destrancadas, com id novo e sem `data.sirvo`. Nada sai do lugar e o `data`
 * do operador fica. Muda os itens no próprio objeto; devolve quantos mudaram.
 */
export function soltarDoSirvo(itens: ProjectShowRef[], novoId: () => string) {
    let n = 0
    for (const item of itens) {
        if (!papelDoItem(item)) continue
        item.id = novoId()
        if (item.data && typeof item.data === "object" && "sirvo" in item.data) {
            const { sirvo: _fora, ...resto } = item.data
            item.data = resto
        }
        n++
    }
    return n
}

/**
 * Converter em modelo e duplicar o projeto: a CÓPIA não é do culto. Tira o
 * campo `sirvo` e os itens do Sirvo viram seções comuns (o rodapé também). Muda
 * a cópia no próprio objeto: chame só sobre um clone.
 */
export function copiaSemSirvo<T extends { sirvo?: Project["sirvo"]; shows?: ProjectShowRef[] }>(copia: T, novoId: () => string): T {
    if (!copia || typeof copia !== "object") return copia
    delete copia.sirvo
    if (Array.isArray(copia.shows)) soltarDoSirvo(copia.shows, novoId)
    return copia
}
