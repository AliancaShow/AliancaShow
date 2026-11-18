// Leiaute v2, fatia 3 (Editar na forma final): a conta pura. Sem store, sem DOM, nada aqui escreve em `outputs`.
//
// O que o telao mostra de um show e uma FOTO do slide no momento do envio (aliancaFoto.ts). Editar o slide no ar e livre: a foto nao muda, entao o telao
// so troca quando o slide for mandado de novo. Daqui saem os selos NO AR / EDITADO das miniaturas e a faixa "Mandar pro ar" do centro.
import { indiceDaFoto } from "./aliancaFotoLogica"

/** o `out.slide` de uma saida (so o que a conta olha) */
export type SaidaDoAr = { id?: string; layout?: string; index?: number; foto?: { slideId: string; ocorrencia?: number; slide?: any } | null }

export type Selo = { noAr: true; editado: boolean }

/** o que um slide guarda e que a foto cobre: texto/itens e ajustes do slide (cor, fundo proprio...) */
const assinatura = (slide: any): string => JSON.stringify([slide?.items || [], slide?.settings || {}])

/**
 * Selos por POSICAO do layout vivo: so as posicoes que estao no ar (de alguma saida) aparecem. `editado` = o slide vivo difere da foto que a saida mostra.
 * Slide sem foto (a saida le ao vivo) nunca e "editado": o telao ja mostra o que esta na tela.
 */
export function selosDoShow(e: { showId: string; layout: string; ref: { id: string }[]; slides: { [id: string]: any } | null | undefined; noAr: SaidaDoAr[] }): { [posicao: number]: Selo } {
    const saida: { [posicao: number]: Selo } = {}
    for (const o of e.noAr || []) {
        if (!o || o.id !== e.showId || o.layout !== e.layout || typeof o.index !== "number") continue
        const pos = o.foto ? indiceDaFoto(o.foto, o.index, e.ref as any) : o.index
        if (pos < 0 || !e.ref[pos]) continue
        const editado = !!o.foto && assinatura(e.slides?.[e.ref[pos].id]) !== assinatura(o.foto.slide)
        // varias saidas no mesmo slide: basta uma estar defasada para o selo avisar
        saida[pos] = { noAr: true, editado: editado || !!saida[pos]?.editado }
    }
    return saida
}

export type SituacaoDoSlide = "livre" | "no-ar" | "defasado"

/** a nota e a faixa do centro dependem so disto */
export function situacaoDoSlide(selos: { [posicao: number]: Selo }, posicao: number | null | undefined): SituacaoDoSlide {
    if (typeof posicao !== "number") return "livre"
    const s = selos[posicao]
    if (!s) return "livre"
    return s.editado ? "defasado" : "no-ar"
}

export const NOTA_LIVRE = "Clique no texto para editar. Salva sozinho."
export const NOTA_NO_AR = "Este slide está no ar. Pode editar: o telão só muda quando você mandar pro ar de novo."
export const SAIDA_TRAVADA = "Saída travada: destrave para mandar pro ar."
export const FAIXA_DEFASADO = "O telão ainda mostra a versão anterior. Ela só troca quando você mandar pro ar de novo."

/** a faixa nomeia a tela defasada quando ha mais de uma tela (`nomes` vazio = so uma tela: "O telão") */
export function faixaDefasada(nomes: string[]): string {
    if (!nomes.length) return FAIXA_DEFASADO
    const quem = nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`
    return `${quem} ainda ${nomes.length === 1 ? "mostra" : "mostram"} a versão anterior. ${nomes.length === 1 ? "Ela" : "Elas"} só ${nomes.length === 1 ? "troca" : "trocam"} quando você mandar pro ar de novo.`
}

export function notaDoCentro(s: SituacaoDoSlide): string {
    return s === "livre" ? NOTA_LIVRE : s === "no-ar" ? NOTA_NO_AR : ""
}

// ---------------------------------------------------------------- o que muda no telao NA HORA (decisao 6)

/** o que esta no ar de uma saida (so o que a conta olha) */
export type ConteudoDoAr = { background?: { path?: string; id?: string } | null; overlays?: string[] | null; effects?: string[] | null; templates?: string[] | null }

/**
 * Fundo, sobreposicao e efeito sao lidos AO VIVO pelo telao: editar o que esta no ar muda na hora. Devolve o aviso, ou "" quando a edicao nao
 * toca o que esta no ar. (O slide de show e congelado pela foto; versiculo/musica seguem a mesma regra do slide.)
 */
export function avisoAoVivo(e: { tipo?: string; id?: string; noAr: ConteudoDoAr[] }): string {
    const id = e.id || ""
    if (!id || !e.tipo) return ""
    const noAr = (e.noAr || []).some((o) => {
        if (!o) return false
        if (e.tipo === "overlay") return (o.overlays || []).includes(id)
        if (e.tipo === "effect") return (o.effects || []).includes(id)
        if (e.tipo === "media") return o.background?.path === id || o.background?.id === id
        // a camera no fundo e lida ao vivo pelo id; o modelo que a saida usa no slide no ar (o do estilo, ou o do primeiro slide) e lido ao vivo da lista de modelos
        if (e.tipo === "camera") return o.background?.id === id
        if (e.tipo === "template") return (o.templates || []).includes(id)
        return false
    })
    return noAr ? "Isto está no ar: o que você mudar aparece no telão na hora." : ""
}

// ---------------------------------------------------------------- o item em edicao (roteiro ou aberto da biblioteca)

export type TipoEditavel = "show" | "media" | "audio" | "camera" | "overlay" | "template" | "effect"
export const TIPOS_EDITAVEIS: TipoEditavel[] = ["show", "media", "audio", "camera", "overlay", "template", "effect"]
/** `activeEdit.type` que o seletor nao sabe descrever (pdf, ppt...): nao se edita aqui, e quem ve isso tem de avisar em voz alta */
export const tipoDeEdicaoDesconhecido = (t: string | undefined): boolean => !!t && !(TIPOS_EDITAVEIS as string[]).includes(t)

/**
 * Cabine 18/nov (A9): o que o Editor poe em `activeEdit` ao montar quando o item aberto no centro nao e um show. So tipo EDITAVEL entra: um bloco
 * (section), pdf, ppt, folder ou player como `activeShow` virava `activeEdit.type = "section"` e a faixa de falha acendia "editar-tipo-desconhecido"
 * a cada volta de Configuracoes para Editar. Devolve `null` quando nao ha nada a fazer (show, tipo que nao se edita, ou edicao ja em curso de outro item).
 */
export function edicaoDoItemMostrado(show: { id?: string; type?: string } | null | undefined, edit: { id?: string; type?: string } | null | undefined): { id: string; type: TipoEditavel; items: any[] } | null {
    const tipo = show?.type || "show"
    if (!show?.id || tipo === "show" || !(TIPOS_EDITAVEIS as string[]).includes(tipo)) return null
    if (edit?.id && edit.type !== tipo) return null
    return { id: show.id, type: tipo as TipoEditavel, items: [] }
}

/** o `activeEdit` de cada item do roteiro quando ele e escolhido no seletor (null = o tipo nao se edita aqui) */
export function editDoItemDoRoteiro(it: { id: string; type?: string }): { type: TipoEditavel; slide?: number; id?: string; showId?: string; items: any[] } | null {
    const tipo = tipoEditavelDoRoteiro(it.type)
    if (tipo === "show") return { type: "show", slide: 0, items: [], showId: it.id }
    if (tipo === "media" || tipo === "audio") return { type: tipo, id: it.id, items: [] }
    return null
}

export type ItemEditavel = { chave: string; tipo: TipoEditavel; id: string; nome: string }
export const MAX_AVULSOS = 5

export const chaveDoItem = (tipo: string, id: string): string => `${tipo}:${id}`

/** o ultimo aberto vai para a frente; repetido nao duplica; guarda ate `max` (memoria, nao vai para o disco) */
export function empurrarAvulso(lista: ItemEditavel[], item: ItemEditavel, max = MAX_AVULSOS): ItemEditavel[] {
    return [item, ...lista.filter((a) => a.chave !== item.chave)].slice(0, max)
}

/** tira um item que nao existe mais (show apagado) */
export function tirarAvulso(lista: ItemEditavel[], chave: string): ItemEditavel[] {
    return lista.filter((a) => a.chave !== chave)
}

/** o tipo de edicao de um item do roteiro (`image`/`video` editam como midia); null = nao se edita aqui (bloco, PDF, apresentacao...) */
export function tipoEditavelDoRoteiro(tipo: string | undefined): TipoEditavel | null {
    const t = tipo || "show"
    return t === "show" ? "show" : t === "image" || t === "video" ? "media" : t === "audio" ? "audio" : null
}

/** o item aberto esta no roteiro (culto) aberto? Show, midia (imagem/video) e audio; o resto (modelo, camera...) so entra como avulso. */
export function estaNoRoteiro(roteiro: { id?: string; type?: string }[] | null | undefined, tipo: string, id: string): boolean {
    return (roteiro || []).some((i) => !!i && i.id === id && tipoEditavelDoRoteiro(i.type) === tipo)
}

export type OpcaoDoSeletor = { chave: string; chaveItem: string; secao: "No roteiro" | "Aberto da biblioteca"; tipo: TipoEditavel; nome: string; marcado: boolean; indice?: number; avulso?: boolean }

/**
 * As linhas do seletor do item. `chave` e UNICA na lista (o `{#each}` com chave repetida lanca em dev e atualiza errado em producao): o roteiro leva a
 * POSICAO (o mesmo show/midia pode aparecer duas vezes no culto) e o avulso leva a chave do item. Avulso que ja esta no roteiro nao se repete.
 * `indiceAtivo` = a posicao do roteiro que esta aberta (activeShow.index); sem ela, a primeira linha do roteiro com o item aberto leva o visto.
 */
export function opcoesDoSeletor(e: { roteiro: { id: string; type?: string; name?: string }[]; avulsos: ItemEditavel[]; atualChave: string | null; indiceAtivo?: number | null; nomeDe: (tipo: TipoEditavel, id: string, nomeSalvo: string) => string }): OpcaoDoSeletor[] {
    const saida: OpcaoDoSeletor[] = []
    const chaveNoRoteiro = (it: { id: string; type?: string }) => {
        const tipo = tipoEditavelDoRoteiro(it.type)
        return tipo ? chaveDoItem(tipo, it.id) : null
    }
    // qual linha do roteiro e a aberta: a posicao ativa se ela for o item aberto, senao a primeira com o item
    const candidatas = e.roteiro.map((it, i) => (chaveNoRoteiro(it) === e.atualChave ? i : -1)).filter((i) => i > -1)
    const marcada = typeof e.indiceAtivo === "number" && candidatas.includes(e.indiceAtivo) ? e.indiceAtivo : (candidatas[0] ?? -1)
    const doRoteiro = new Set<string>()
    e.roteiro.forEach((it, indice) => {
        const tipo = tipoEditavelDoRoteiro(it.type)
        const chaveItem = chaveNoRoteiro(it)
        if (!tipo || !chaveItem) return
        doRoteiro.add(chaveItem)
        saida.push({ chave: `roteiro:${indice}`, chaveItem, secao: "No roteiro", tipo, nome: e.nomeDe(tipo, it.id, it.name || ""), marcado: indice === marcada, indice })
    })
    for (const a of e.avulsos) {
        if (doRoteiro.has(a.chave)) continue
        saida.push({ chave: `avulso:${a.chave}`, chaveItem: a.chave, secao: "Aberto da biblioteca", tipo: a.tipo, nome: e.nomeDe(a.tipo, a.id, a.nome), marcado: a.chave === e.atualChave, avulso: true })
    }
    return saida
}

/** O tipo curto que o seletor mostra ao lado do nome (o prototipo usa um simbolo) */
export const SIMBOLO_DO_TIPO: { [t in TipoEditavel]: string } = { show: "♪", media: "▶", audio: "♫", camera: "◉", overlay: "▭", template: "▤", effect: "✦" }

/** o rotulo do tipo na linha "EDITANDO" quando nao e um show (sem slides para contar) */
export const ROTULO_DO_TIPO: { [t in TipoEditavel]: string } = { show: "slides", media: "mídia", audio: "áudio", camera: "câmera", overlay: "sobreposição", template: "modelo", effect: "efeito" }

/** a contagem do cabecalho: "6 slides" (singular com 1) */
export function contagemDeSlides(n: number): string {
    return n === 1 ? "1 slide" : `${n} slides`
}

/**
 * Que item o `activeEdit`/`activeShow` descrevem agora? null = nada aberto. O show vem de `activeEdit.showId` ou do `activeShow`.
 * `nomeDe` e injetado (le os stores no componente).
 */
export function itemEmEdicao(e: { edit: { type?: string; id?: string; showId?: string } | null | undefined; show: { id?: string; type?: string } | null | undefined; nomeDe: (tipo: TipoEditavel, id: string) => string }): ItemEditavel | null {
    const tipoEdit = (e.edit?.type || "show") as TipoEditavel
    if (tipoDeEdicaoDesconhecido(tipoEdit)) return null
    let tipo: TipoEditavel
    let id = ""
    if (tipoEdit === "show") {
        tipo = "show"
        // a mesma ordem do Editor e dos slides: o show aberto manda, o `showId` do editor e o reserva (como em `Editor.svelte`)
        id = (e.show && (e.show.type === undefined || e.show.type === "show") ? e.show.id || "" : "") || e.edit?.showId || ""
    } else {
        tipo = tipoEdit
        id = e.edit?.id || ""
    }
    if (!id) return null
    return { chave: chaveDoItem(tipo, id), tipo, id, nome: e.nomeDe(tipo, id) || "" }
}

// ---------------------------------------------------------------- quem mostra ESTE slide (faixa "Mandar pro ar")

/**
 * As saidas que mostram o slide da posicao `posicao` do layout vivo (a foto manda: o layout pode ter andado). `editado` = a foto dessa saida difere do
 * slide vivo. A faixa de pendencia reenvia so para estas: mandar o slide para uma tela que estava em outro e "pular", nao "atualizar".
 */
export function saidasQueMostram(e: { showId: string; layout: string; ref: { id: string }[]; slides: { [id: string]: any } | null | undefined; posicao: number; saidas: { saida: string; slide: SaidaDoAr | null | undefined }[] }): { saida: string; editado: boolean }[] {
    const achadas: { saida: string; editado: boolean }[] = []
    for (const { saida, slide: o } of e.saidas || []) {
        if (!o || o.id !== e.showId || o.layout !== e.layout || typeof o.index !== "number") continue
        const pos = o.foto ? indiceDaFoto(o.foto, o.index, e.ref as any) : o.index
        if (pos !== e.posicao || !e.ref[pos]) continue
        achadas.push({ saida, editado: !!o.foto && assinatura(e.slides?.[e.ref[pos].id]) !== assinatura(o.foto.slide) })
    }
    return achadas
}
