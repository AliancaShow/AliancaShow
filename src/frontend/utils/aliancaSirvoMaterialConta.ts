import type { ProjectShowRef } from "../../types/Projects"
import { ID_RODAPE } from "./aliancaSirvoProjeto"

// ----- AliançaShow · o material do Sirvo dentro do projeto do culto (F5, S3) -----
//
// Só a conta, sem store (como aliancaSirvoProjeto.ts): recebe a lista de agora,
// o que está no disco e o que o roteiro do Sirvo diz que existe, e devolve a
// lista certa. Quem chama (aliancaSirvoMaterial.ts) lê os stores, chama e
// escreve na mesma passada.
//
// Marca: todo item que o Sirvo pôs leva `data.sirvoMaterial = <id do material>`.
//   - o item é `{id: <caminho no disco>, type: "video"|"image"|"audio", name, data}`;
//   - entra no FIM do projeto, depois do rodapé "Fora do roteiro": nunca mexe
//     na posição de nada que já existe (ponteiros e telão ficam onde estão);
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

export type TipoDoProjeto = "video" | "image" | "audio"
const TIPO_DO_PROJETO: { [tipo: string]: TipoDoProjeto } = { video: "video", imagem: "image", audio: "audio" }

/** um arquivo que o main já baixou (o caminho local; nunca URL) */
export type Baixado = { id: string; caminho: string; nome: string; tipo: string; codec?: string | null }
/** um material do roteiro do Sirvo (`show_roteiro.material[]`): sem URL */
export type MaterialDoRoteiro = { id: string; nome?: string; status?: string; bloco_id?: string | null }

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

export function itemDoMaterial(b: Baixado): ProjectShowRef {
    return { id: b.caminho, type: TIPO_DO_PROJETO[b.tipo] || "video", name: rotuloDoItem(b.nome, b.codec), data: { [MARCA]: b.id } }
}

export type OpcoesMaterial = {
    /** o que está no disco, por id do material */
    baixados: Map<string, Baixado>
    /** `show_roteiro.material[]` por id; null = o Sirvo não mandou a lista (versão antiga): nada é tirado nem posto */
    noRoteiro: Map<string, MaterialDoRoteiro> | null
    /** ids que o Show já pôs NESTE projeto: se não estão mais nele, o operador tirou, e não voltam */
    jaPostos: Set<string>
    /** posições (na lista recebida) com ponteiro vivo: item aberto, foco, saídas */
    ativos?: number[]
    /** momento protegido (culto no ar ou algo na tela) */
    protegido?: boolean
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
    /** daqui a quantos ms há outra coisa a fazer (o fim dos 30 s de cinza); null = nada */
    reavaliarEm: number | null
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
    let reavaliarEm: number | null = null

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
        const r = o.noRoteiro.get(m)
        const b = o.baixados.get(m)
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
            if (o.congelarRemocao || ativos.has(i)) return
            if (o.protegido && [...ativos].some((a) => a > i)) return
            sai.add(item)
            tirados.push(m)
            return
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

    // 3. o que chegou do disco e ainda não está: entra no fim, depois do rodapé
    const novos: ProjectShowRef[] = []
    const temRodape = itens.some((i) => i?.type === "section" && i.id === ID_RODAPE)
    if (o.noRoteiro && temRodape) {
        const caminhos = new Set(itens.map((i) => i?.id))
        for (const [id, b] of o.baixados) {
            const r = o.noRoteiro.get(id)
            if (!r || apagado(r) || vistas.has(id) || o.jaPostos.has(id)) continue
            // o operador já tem esse mesmo arquivo no projeto (arrastou da Mídia): não duplica nem toma conta dele
            if (caminhos.has(b.caminho)) continue
            novos.push(itemDoMaterial({ ...b, nome: r.nome ?? b.nome }))
            postos.push(id)
        }
    }

    if (!sai.size && !novos.length) return { itens, mudouCampos, postos: [], tirados: [], reavaliarEm }
    return { itens: [...itens.filter((i) => !sai.has(i)), ...novos], mudouCampos, postos, tirados, reavaliarEm }
}
