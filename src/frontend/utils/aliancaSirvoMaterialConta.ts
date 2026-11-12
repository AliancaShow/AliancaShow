import type { ProjectShowRef } from "../../types/Projects"
import { marcaDe as marcaDeMusica } from "./aliancaSirvoMusicas"
import { ID_RODAPE, ordemMudaAteOPonteiro, papelDoItem, PREFIXO_LAPIDE, PREFIXO_SIRVO } from "./aliancaSirvoProjeto"

// ----- AliançaShow · o material do Sirvo dentro do projeto do culto (F5, S3) -----
//
// Só a conta, sem store (como aliancaSirvoProjeto.ts): recebe a lista de agora,
// o que está no disco e o que o roteiro do Sirvo diz que existe, e devolve a
// lista certa. Quem chama (aliancaSirvoMaterial.ts) lê os stores, chama e
// escreve na mesma passada.
//
// v5 (biblioteca da igreja): o item é chaveado por ARQUIVO. Marca: `data.sirvoMaterial = <arquivo_id>`;
// `data.sirvoVersao = <versao_id>` é a versão que o item toca. Versão nova de um arquivo que já está no
// projeto TROCA NO LUGAR (mesmo índice, mesma lista) — nunca em uso (item aberto/foco, saída, áudio
// tocando) e, no momento protegido, só pelo "Aplicar" (pendente).
// Marca: todo item que o Sirvo pôs leva `data.sirvoMaterial = <arquivo_id>`.
//   - o item é `{id: <caminho no disco>, type: "video"|"image"|"audio", name, data}`;
//   - entra DENTRO do bloco que o Sirvo escolheu (`show_roteiro.material[].bloco_id`): na
//     família do cabeçalho, logo depois da última música/material do bloco. Sem bloco, ou
//     bloco que não está no projeto: no FIM, depois do rodapé "Fora do roteiro".
//     `data.sirvoBloco` guarda para onde o Show o levou: só se o Sirvo MUDAR de ideia
//     (religou a outro bloco) o item se mexe; o que o operador arrastou fica onde ele pôs;
//   - o que muda de posição obedece à trava do momento protegido da reconciliação das
//     músicas (`ordemMudaAteOPonteiro`): mudança que alcança um ponteiro vivo fica
//     PENDENTE até o "Aplicar" (`pendente: true`);
//   - o que não tem a marca nunca é tocado (nem tirado, nem renomeado);
//   - o ARQUIVO nunca é apagado: o item some do projeto, o disco fica.
// Apagou no Sirvo: o item fica cinza por 30 s ("apagado no Sirvo") e então sai —
// menos se estiver em uso (item aberto, no foco ou na saída), caso em que fica
// cinza até soltar; e no momento protegido só sai se nenhum ponteiro vivo está
// depois dele (tirar o item desceria a posição de quem está depois).

export const MARCA = "sirvoMaterial"
export const APAGANDO_EM = "sirvoApagandoEm"
export const GRACA_APAGAR_MS = 30_000
export const PREFIXO_APAGADO = "(apagado no Sirvo) "
/** de qual culto o item veio (para não confundir material de outro culto com apagado) */
export const EVENTO = "sirvoMaterialEvento"
/** o bloco para onde o Show levou o item ("" = Fora do roteiro) */
export const BLOCO = "sirvoBloco"
/** a versão (id da versão no Sirvo) que o item toca */
export const VERSAO = "sirvoVersao"

/** caminho normalizado para comparar (barras e caixa) */
export const normCam = (p: unknown) =>
    String(p ?? "")
        .replace(/\\/g, "/")
        .toLowerCase()

export type TipoDoProjeto = "video" | "image" | "audio"
const TIPO_DO_PROJETO: { [tipo: string]: TipoDoProjeto } = { video: "video", imagem: "image", audio: "audio" }

/** uma VERSÃO que o main já baixou (o caminho local; nunca URL). `id` = id da versão */
export type Baixado = { id: string; arquivo_id: string; caminho: string; nome: string; tipo: string; codec?: string | null }
/** um uso do roteiro do Sirvo (`show_roteiro.material[]`): `id` = id do uso, `versao_id` = a versão a tocar; sem URL */
export type MaterialDoRoteiro = { id: string; arquivo_id: string; versao_id?: string; nome?: string; status?: string; bloco_id?: string | null }

/** a marca do item (id do material no Sirvo); null para item do operador */
export const marcaDoMaterial = (item: ProjectShowRef | null | undefined): string | null => {
    const m = item?.data?.[MARCA]
    return typeof m === "string" && m ? m : null
}

export const ehHevc = (codec: unknown) => /hvc1|hev1|hevc|h\.?265/i.test(String(codec ?? ""))

const limpo = (t: unknown, max = 100) =>
    String(t ?? "")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .slice(0, max)
        .trim()

/** o rótulo do item: nome + aviso de HEVC */
export const rotuloDoItem = (nome: unknown, codec?: unknown) => limpo(nome) + (ehHevc(codec) ? " (HEVC — pode não tocar)" : "")

export function itemDoMaterial(b: Baixado, bloco = "", evento?: string | null): ProjectShowRef {
    return { id: b.caminho, type: TIPO_DO_PROJETO[b.tipo] || "video", name: rotuloDoItem(b.nome, b.codec), data: { [MARCA]: b.arquivo_id, [VERSAO]: b.id, [BLOCO]: bloco, ...(evento ? { [EVENTO]: evento } : {}) } }
}

/**
 * A troca de versão leva só o AJUSTE do operador (lista branca). `fromTime`/`toTime`, `info`, `creationTime`,
 * `tracks`, `cropping` etc. são DO ARQUIVO e nunca atravessam. Só copia se `media[novo]` ainda não existe;
 * devolve o mapa (o mesmo, se nada a fazer).
 */
export const CAMPOS_DE_MIDIA_QUE_ATRAVESSAM = ["fit", "fitOptions", "volume", "loop", "videoType", "audioType", "speed", "filter", "flipped", "flippedY"] as const
export function copiarMidiaDaTroca<M extends { [caminho: string]: any }>(media: M, de: string, para: string): M {
    if (!media || de === para || media[para] || !media[de]) return media
    const copia: { [k: string]: any } = {}
    for (const k of CAMPOS_DE_MIDIA_QUE_ATRAVESSAM) if (media[de][k] !== undefined) copia[k] = media[de][k]
    if (!Object.keys(copia).length) return media
    return { ...media, [para]: copia }
}

export type OpcoesMaterial = {
    /** o que está no disco, por id da VERSÃO */
    baixados: Map<string, Baixado>
    /** caminhos (normalizados com normCam) em uso FORA da lista: nas saídas e nas chaves de `playingAudio` (pausado conta) */
    emUso?: Set<string>
    /** `show_roteiro.material[]` por ARQUIVO (arquivo_id); null = o Sirvo não mandou a lista (versão antiga): nada é tirado nem posto */
    noRoteiro: Map<string, MaterialDoRoteiro> | null
    /** ids que o Show já pôs NESTE projeto: se não estão mais nele, o operador tirou, e não voltam */
    jaPostos: Set<string>
    /** posições (na lista recebida) com ponteiro vivo: item aberto, foco, saídas */
    ativos?: number[]
    /** momento protegido (culto no ar ou algo na tela) */
    protegido?: boolean
    /** o culto do roteiro que o Show segue: item de OUTRO culto (projeto religado) não é tocado nem tirado */
    eventoId?: string | null
    /** "Aplicar": passa por cima do momento protegido */
    forcar?: boolean
    /** nada sai do projeto agora (ex.: projeto fechado com slide na tela que guardou uma posição): só entra */
    congelarRemocao?: boolean
    agora: number
}

export type ResultadoMaterial = {
    /** a lista nova; é a MESMA lista recebida quando nada mudou */
    itens: ProjectShowRef[]
    /** algum item foi alterado no próprio objeto (nome, cinza, marca repetida) */
    mudouCampos: boolean
    /** ids que entraram agora no projeto */
    postos: string[]
    /** ids que saíram agora do projeto */
    tirados: string[]
    /** havia posição a mudar (entrada ou religação de bloco) e o momento protegido segurou: espera o "Aplicar" */
    pendente: boolean
    /** trocas de versão feitas agora, no lugar: a mídia do operador (fit, volume…) é copiada de `de` para `para` */
    trocas: { arquivo: string; de: string; para: string }[]
    /** nomes: versão nova que NÃO pôde trocar porque o item está em uso (reavalia quando o uso baixar) */
    trocaEmUso: string[]
    /** nomes: versão nova que o momento protegido segurou; o "Aplicar" troca */
    trocaPendente: string[]
    /** nomes: a versão nova já está no projeto como item do operador; não trocou */
    trocaJaNoProjeto: string[]
    /** daqui a quantos ms há outra coisa a fazer (o fim dos 30 s de cinza); null = nada */
    reavaliarEm: number | null
}

/**
 * `show_roteiro.material[]` como mapa. NULL (a conta não faz nada) quando o Sirvo não mandou a
 * lista OU quando a chave não baixa material: sem o interruptor o Sirvo manda `[]`, e uma lista
 * vazia leria como "tudo foi apagado" e tiraria do projeto, em 30 s, o que já estava lá.
 */
export function mapaDoRoteiro(material: unknown, habilitado: boolean | null): Map<string, MaterialDoRoteiro> | null {
    if (habilitado !== true || !Array.isArray(material)) return null
    return new Map((material as MaterialDoRoteiro[]).filter((m) => m && typeof m.arquivo_id === "string").map((m) => [m.arquivo_id, m]))
}

const apagado = (r: MaterialDoRoteiro | undefined) => !r || r.status === "apagando" || r.status === "apagado"

/**
 * Põe o material baixado no projeto e tira o que foi apagado no Sirvo.
 * Idempotente: rodar de novo sobre o resultado não muda nada.
 */
export function conciliarMaterial(itens: ProjectShowRef[], o: OpcoesMaterial): ResultadoMaterial {
    const ativos = new Set(o.ativos || [])
    let mudouCampos = false
    const postos: string[] = []
    const tirados: string[] = []
    const trocas: { arquivo: string; de: string; para: string }[] = []
    const trocaEmUso: string[] = []
    const trocaPendente: string[] = []
    const trocaJaNoProjeto: string[] = []
    let reavaliarEm: number | null = null
    const emUsoCam = o.emUso || new Set<string>()
    // em uso = ponteiro vivo na lista (aberto/foco/saída com posição) OU o caminho está numa saída / tocando
    const emUsoItem = (item: ProjectShowRef, i: number) => ativos.has(i) || emUsoCam.has(normCam(item.id))

    // 1. marca duplicada (copiar e colar): a primeira é a oficial; as outras viram item do operador
    const vistas = new Set<string>()
    for (const item of itens) {
        const m = marcaDoMaterial(item)
        if (!m) continue
        if (!vistas.has(m)) {
            vistas.add(m)
            continue
        }
        const { [MARCA]: _marca, [APAGANDO_EM]: _cinza, ...resto } = item.data
        item.data = resto
        mudouCampos = true
    }

    // 2. o que já está no projeto: nome certo, cinza e saída
    const sai = new Set<ProjectShowRef>()
    itens.forEach((item, i) => {
        const m = marcaDoMaterial(item)
        if (!m || o.noRoteiro === null) return
        const deOutroCulto = o.eventoId && typeof item.data?.[EVENTO] === "string" && item.data[EVENTO] !== o.eventoId
        if (deOutroCulto) return
        const r = o.noRoteiro.get(m)
        const b = o.baixados.get(String(item.data?.[VERSAO] ?? "")) ?? (r?.versao_id ? o.baixados.get(r.versao_id) : undefined)
        const emCinza = typeof item.data?.[APAGANDO_EM] === "number"

        if (apagado(r)) {
            if (!emCinza) {
                item.name = PREFIXO_APAGADO + limpo(item.name?.startsWith(PREFIXO_APAGADO) ? item.name.slice(PREFIXO_APAGADO.length) : item.name)
                item.data = { ...item.data, [APAGANDO_EM]: o.agora }
                mudouCampos = true
            }
            const desde = (emCinza ? Number(item.data[APAGANDO_EM]) : o.agora) || o.agora
            const falta = desde + GRACA_APAGAR_MS - o.agora
            if (falta > 0) {
                reavaliarEm = reavaliarEm === null ? falta : Math.min(reavaliarEm, falta)
                return
            }
            // venceu: em uso nunca sai; no momento protegido, só se ninguém vivo está depois dele
            if (o.congelarRemocao || emUsoItem(item, i)) return
            if (o.protegido && [...ativos].some((a) => a > i)) return
            sai.add(item)
            tirados.push(m)
            return
        }

        // versão nova do mesmo arquivo: troca no lugar (mesmo índice, mesma lista) quando livre
        const nova = r?.versao_id ? o.baixados.get(r.versao_id) : undefined
        const versaoDoItem = typeof item.data?.[VERSAO] === "string" ? item.data[VERSAO] : null
        if (!emCinza && r?.versao_id && nova && versaoDoItem && versaoDoItem !== r.versao_id) {
            if (emUsoItem(item, i)) {
                trocaEmUso.push(nova.nome)
            } else if (itens.some((x) => x !== item && x?.id === nova.caminho)) {
                trocaJaNoProjeto.push(nova.nome)
            } else if (!o.forcar && (o.protegido || o.congelarRemocao)) {
                trocaPendente.push(nova.nome)
            } else {
                trocas.push({ arquivo: m, de: item.id, para: nova.caminho })
                item.id = nova.caminho
                item.name = rotuloDoItem(r.nome ?? nova.nome, nova.codec)
                item.data = { ...item.data, [VERSAO]: r.versao_id }
                mudouCampos = true
                return
            }
        }

        // voltou (o Sirvo desfez o apagar): sai do cinza e volta ao rótulo certo
        if (emCinza) {
            const { [APAGANDO_EM]: _cinza, ...resto } = item.data
            item.data = resto
            item.name = rotuloDoItem(r?.nome ?? b?.nome ?? item.name, b?.codec)
            mudouCampos = true
        } else {
            const nome = rotuloDoItem(r?.nome ?? b?.nome ?? item.name, b?.codec)
            if (item.name !== nome && b) {
                item.name = nome
                mudouCampos = true
            }
        }
    })

    // a lista depois das saídas (nenhum ponteiro vivo fica depois de quem saiu: as posições dos ativos não mudam)
    const base = sai.size ? itens.filter((i) => !sai.has(i)) : itens

    // 3. onde cada material deve estar: dentro do bloco do Sirvo (se o bloco está no projeto), senão no fim
    const temRodape = itens.some((i) => i?.type === "section" && i.id === ID_RODAPE)
    const vivos = blocosVivos(base)
    // bloco que saiu do Sirvo e virou lápide: o material que já estava nele fica lá, como as músicas
    const lapides = new Set(base.filter((i) => papelDoItem(i) === "lapide").map((i) => i.id.slice(PREFIXO_LAPIDE.length)))
    const caminhos = new Set(base.map((i) => i?.id))
    const doMarcado = new Map<string, ProjectShowRef>()
    for (const item of base) {
        const m = marcaDoMaterial(item)
        if (m && !doMarcado.has(m)) doMarcado.set(m, item)
    }
    type Mover = { id: string; item: ProjectShowRef; existente: boolean; alvo: string }
    const mover: Mover[] = []
    if (o.noRoteiro && temRodape) {
        // na ordem do Sirvo (material[]): a ordem entre os que chegam juntos é estável
        for (const [id, r] of o.noRoteiro) {
            const b = r.versao_id ? o.baixados.get(r.versao_id) : undefined
            if (apagado(r) || !b) continue
            const alvo = r.bloco_id && vivos.has(r.bloco_id) ? r.bloco_id : ""
            const atual = doMarcado.get(id)
            if (atual) {
                if (typeof atual.data?.[EVENTO] === "string" && o.eventoId && atual.data[EVENTO] !== o.eventoId) continue
                const onde = typeof atual.data?.[BLOCO] === "string" ? atual.data[BLOCO] : ""
                if (onde === alvo || typeof atual.data?.[APAGANDO_EM] === "number") continue
                if (lapides.has(onde)) continue
                // em uso (aberto, foco, saída) não é levado a outro lugar. `ativos` e `itens.indexOf` são posições da lista
                // RECEBIDA; quem sai (`sai`) nunca está antes de um ponteiro, então as posições dos ativos valem também em `base`
                if (emUsoItem(atual, itens.indexOf(atual))) continue
                mover.push({ id, item: atual, existente: true, alvo })
                continue
            }
            if (vistas.has(id) || o.jaPostos.has(id)) continue
            // o operador já tem esse mesmo arquivo no projeto (arrastou da Mídia): não duplica nem toma conta dele
            if (caminhos.has(b.caminho)) continue
            mover.push({ id, item: itemDoMaterial({ ...b, nome: r.nome ?? b.nome }, alvo, o.eventoId), existente: false, alvo })
        }
    }

    let depois = base
    let pendente = false
    if (mover.length) {
        // a lista que sai de uma escolha de movimentos (os existentes saem de onde estão e entram no alvo)
        const montar = (escolhidos: Mover[]) => {
            const saem = new Set(escolhidos.filter((m) => m.existente).map((m) => m.item))
            const lista = saem.size ? base.filter((i) => !saem.has(i)) : [...base]
            for (const m of escolhidos) {
                if (!m.alvo) lista.push(m.item)
                else lista.splice(depoisDoUltimoDoBloco(lista, m.alvo), 0, m.item)
            }
            return lista
        }
        // a mesma trava das músicas, mas item a item: o que entra no fim ("Fora do roteiro") passa primeiro, e o que
        // alcança um ponteiro vivo fica pendente SOZINHO (não segura os outros)
        const trava = !o.forcar && (o.protegido || o.congelarRemocao)
        const alcancaPonteiro = (lista: ProjectShowRef[]) => (o.congelarRemocao ? lista.slice(0, base.length).some((x, i) => x !== base[i]) : ordemMudaAteOPonteiro(base, lista, [...ativos]))
        const ordenados = [...mover.filter((m) => !m.alvo), ...mover.filter((m) => m.alvo)]
        const aceitos: Mover[] = []
        for (const m of ordenados) {
            if (trava && alcancaPonteiro(montar([...aceitos, m]))) pendente = true
            else aceitos.push(m)
        }
        if (aceitos.length) {
            const novaLista = montar(aceitos)
            // a mesma sequência de objetos (o item já estava no lugar): só a marca muda, sem escrita estrutural
            // (não mexe no Ctrl+Z, na seleção nem no "abrir por posição" do celular)
            const mesma = novaLista.length === base.length && novaLista.every((x, i) => x === base[i])
            if (!mesma) depois = novaLista
            for (const m of aceitos) {
                if (m.existente) {
                    m.item.data = { ...m.item.data, [BLOCO]: m.alvo }
                    mudouCampos = true
                } else postos.push(m.id)
            }
        }
    }

    // a troca presa pelo momento protegido também espera o "Aplicar"
    if (trocaPendente.length) pendente = true
    const extra = { trocas, trocaEmUso, trocaPendente, trocaJaNoProjeto }
    if (depois === itens) return { itens, mudouCampos, postos: [], tirados: [], pendente, reavaliarEm, ...extra }
    return { itens: depois, mudouCampos, postos, tirados, pendente, reavaliarEm, ...extra }
}

/** blocos cujo cabeçalho está no projeto (família viva) */
function blocosVivos(itens: ProjectShowRef[]): Set<string> {
    return new Set(itens.filter((i) => papelDoItem(i) === "cabecalho").map((i) => i.id.slice(PREFIXO_SIRVO.length)))
}

/**
 * Onde entra o próximo material do bloco: logo depois da última música ou material dele
 * (a família é o cabeçalho e o que vem embaixo, até o próximo item do Sirvo); sem nenhum,
 * logo depois do cabeçalho. Item do operador nunca é tocado.
 */
function depoisDoUltimoDoBloco(itens: ProjectShowRef[], blocoId: string): number {
    const cab = itens.findIndex((i) => i.id === PREFIXO_SIRVO + blocoId && papelDoItem(i) === "cabecalho")
    let ultimo = cab
    for (let j = cab + 1; j < itens.length && !papelDoItem(itens[j]); j++) if (marcaDeMusica(itens[j]) || marcaDoMaterial(itens[j])) ultimo = j
    return ultimo + 1
}

/** a limpeza só roda com tela e áudio livres (a trava do ao vivo, do lado do renderer; pura para ser testada) */
export function podeLimparAgora(c: { roteiroNoAr: boolean; saidasComAlgo: number; tocando: number; ultimaEm: number; agora: number }): boolean {
    return !c.roteiroNoAr && c.saidasComAlgo === 0 && c.tocando === 0 && c.agora - c.ultimaEm >= 24 * 3_600_000
}
