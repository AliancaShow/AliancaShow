import { get } from "svelte/store"
import { uid } from "uid"
import type { Project } from "../../types/Projects"
import { folders, projects } from "../stores"
import { AGENDAS, caminhoDoCulto } from "./agendas"

/**
 * As pastas e o projeto de cada culto, num lugar so para os dois lados:
 *
 *   - o Remote do Pedro (aliancaRemote.ts), que cria a arvore do ano e poe o
 *     que chega pelo celular no projeto do dia;
 *   - a ponte com o Sirvo (aliancaSirvoProjeto.ts), que monta os blocos do
 *     roteiro no projeto do culto.
 *
 * Os dois precisam escolher SEMPRE o mesmo projeto. Se cada um tivesse a sua
 * regra, um Ctrl+Z que traz de volta um "09" apagado (depois de o Remote ja ter
 * recriado outro) deixaria a foto num "09" e os blocos no outro.
 *
 * Nada aqui fala com o Firebase nem com o Sirvo.
 */

/** garante uma pasta pelo caminho, devolvendo o id da ultima */
export function garantirPastas(caminho: string[]) {
    let pai = "/"
    let mudou = false

    for (const nome of caminho) {
        const atuais = get(folders)
        const existente = Object.entries(atuais).find(([, f]: any) => f.name === nome && f.parent === pai)

        if (existente) {
            pai = existente[0]
            continue
        }

        const id = uid()
        folders.update((a) => {
            a[id] = { name: nome, parent: pai, created: Date.now() }
            return a
        })
        pai = id
        mudou = true
    }

    return { id: pai, mudou }
}

// ---------------------------------------------------------------- o projeto do dia

// so os campos lidos aqui: os testes passam projetos sem o resto
type ProjetoComLigacao = Partial<Pick<Project, "name" | "parent" | "archived" | "deleted" | "sirvo">>
type ProjetosComLigacao = { [id: string]: ProjetoComLigacao }

const vivo = (p: ProjetoComLigacao | undefined) => !!p && !p.archived && !p.deleted
const ligado = (p: ProjetoComLigacao | undefined) => vivo(p) && !!p!.sirvo?.eventId

/** o nome do Pedro: "06", ou "07 - Rede de Mulheres" no Extra */
const bateNoNome = (p: ProjetoComLigacao, dia: string) => p.name === dia || String(p.name).startsWith(`${dia} - `)

/**
 * O projeto do dia nesta pasta, por ordem de preferencia:
 *
 *   1. o ligado a ESTE culto do Sirvo (`sirvo.eventId`), qualquer que seja o
 *      nome -- com dois cultos no dia o Show renomeia ("08 · 10h"), e a ligacao
 *      nao pode depender do nome;
 *   2. entre os que batem no nome, o que esta ligado a algum culto do Sirvo;
 *   3. o primeiro que bate no nome (a regra de sempre do Remote).
 *
 * Sem `eventId` (o Remote nao sabe de Sirvo) vale do passo 2 em diante. Enquanto
 * nenhum projeto tiver a ligacao, o resultado e exatamente o de antes.
 *
 * Achar um projeto ligado a OUTRO culto nao e erro aqui: quem chama confere e
 * para para perguntar (ver `ligadoAOutroCulto`).
 */
export function acharProjetoEm(todos: ProjetosComLigacao, pastaId: string, dia: string, eventId?: string | null): string | null {
    const daPasta = Object.entries(todos).filter(([, p]) => p?.parent === pastaId)

    if (eventId) {
        const desteCulto = daPasta.find(([, p]) => ligado(p) && p.sirvo!.eventId === eventId)
        if (desteCulto) return desteCulto[0]
    }

    const peloNome = daPasta.filter(([, p]) => bateNoNome(p, dia))
    const preferido = peloNome.find(([, p]) => ligado(p)) || peloNome[0]
    return preferido?.[0] || null
}

/** o projeto do dia nesta pasta, no store (ver `acharProjetoEm`) */
export function acharProjeto(pastaId: string, dia: string, eventId?: string | null) {
    return acharProjetoEm(get(projects), pastaId, dia, eventId)
}

/**
 * O projeto ligado a este culto, em qualquer pasta: o operador pode ter movido
 * o projeto. Com mais de um ligado (copia de um projeto antigo, Ctrl+Z), vale o
 * que esta na pasta do dia; senao, o primeiro.
 */
export function projetoLigadoAoCulto(todos: ProjetosComLigacao, eventId: string, pastaDoDia?: string | null): string | null {
    const ligados = Object.entries(todos).filter(([, p]) => ligado(p) && p.sirvo!.eventId === eventId)
    const naPasta = pastaDoDia ? ligados.find(([, p]) => p.parent === pastaDoDia) : undefined
    return (naPasta || ligados[0])?.[0] || null
}

/** o projeto achado pelo nome ja pertence a outro culto do Sirvo: nao monta, pergunta */
export function ligadoAOutroCulto(projeto: ProjetoComLigacao | undefined, eventId: string) {
    return ligado(projeto) && projeto!.sirvo!.eventId !== eventId
}

// ---------------------------------------------------------------- o nome do projeto de um culto do Sirvo

type CultoComHora = { event_id: string; comeca_em: string }

const fmtData = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

/** "2026-11-08T11:00:00Z" -> "2026-11-08", a data do culto em Sao Paulo (null se nao for data) */
export function dataDoCulto(comecaEm: string): string | null {
    const t = Date.parse(comecaEm)
    if (isNaN(t)) return null
    // en-CA formata como AAAA-MM-DD
    return fmtData.format(new Date(t))
}

/** "08h", ou "19h30" quando os minutos nao sao :00 (hora de Sao Paulo) */
function horaDoNome(comecaEm: string) {
    const [h, m] = fmtHora.format(new Date(Date.parse(comecaEm))).split(":")
    return m === "00" ? `${h}h` : `${h}h${m}`
}

/**
 * Pastas e nome do projeto de um culto do Sirvo. Todo culto do Sirvo e da
 * agenda Aliança (decisao de 07/11: o roteiro do Impulso nao passa pelo Sirvo).
 *
 *   um culto no dia      -> "08"                    (o mesmo nome que o Remote da)
 *   dois ou mais no dia  -> "08 · 08h", "08 · 10h"   (TODOS ganham a hora)
 *
 * `cultos` e a lista que o Show conhece; o proprio culto conta mesmo se nao
 * estiver nela. Como o primeiro culto do dia muda de nome quando aparece um
 * segundo, quem liga projeto a culto e o `sirvo.eventId`, nunca o nome.
 */
export function caminhoDoCultoSirvo(culto: CultoComHora, cultos: CultoComHora[]) {
    const data = dataDoCulto(culto.comeca_em)
    const alianca = AGENDAS.find((a) => a.id === "alianca")!
    const partes = data && caminhoDoCulto(alianca, data)
    if (!partes) return null

    const doDia = new Set(cultos.filter((c) => dataDoCulto(c.comeca_em) === data).map((c) => c.event_id))
    doDia.add(culto.event_id)
    if (doDia.size < 2) return partes

    return { ...partes, projeto: `${partes.dia} · ${horaDoNome(culto.comeca_em)}` }
}
