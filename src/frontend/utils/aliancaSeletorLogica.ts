// Seletor compacto de agenda e de culto (FV-S): a parte pura. Sem store, sem DOM, sem relogio proprio (o "hoje" entra de fora).
// Datas sao SEMPRE montadas das partes locais (getFullYear/getMonth/getDate). Criar Date a partir de TEXTO "AAAA-MM-DD" le como UTC e em
// Brasilia vira sabado 14; a conversao para ISO depois das 21h de domingo devolve segunda, e o culto da noite sairia como "passado"
// DURANTE o culto. Os dois estao proibidos aqui (a guarda GS reprova).

export const SEMANAS_CURTAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
export const SEMANAS_LONGAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"]
export const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
export const MESES_LONGOS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

/** quantas semanas de culto PASSADO o popover mostra (decisao do André; o futuro aparece inteiro) */
export const SEMANAS_DE_PASSADO = 8
/** o culto aberto some para o Chromium contar duplo clique por tempo e distancia: a camada fica inerte esse tempo depois do ultimo gesto */
export const INERTE_MS = 500
/** teto de seguranca da camada inerte: um botao "apertado" que nunca solta nao pode prender a tela */
export const TETO_INERTE_MS = 15000
export const CARENCIA_ABERTURA_MS = 150
export const CARENCIA_MUDANCA_MS = 400
export const OCIOSO_MS = 10000
/** depois de fechar por tecla, o ouvinte de teclado vive ate o keyup dessa tecla (ou isto) */
export const TETO_TECLA_MS = 2000
export const PAGINA = 8

const dois = (n: number) => String(n).padStart(2, "0")

/** "AAAA-MM-DD" das partes LOCAIS de uma data */
export function dataLocalISO(d: Date): string {
    return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
}

/** "hoje" no relogio local: chamado a cada abertura do popover (o app fica aberto de sabado para domingo) */
export const hojeLocalISO = (agora: Date = new Date()) => dataLocalISO(agora)

/** data valida (ida e volta: "2026-11-31" vira 1 de dezembro e e recusada) -> partes e dia da semana, senao null */
export function dataValida(iso: string): { ano: number; mes: number; dia: number; semana: number } | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "")
    if (!m) return null
    const ano = Number(m[1])
    const mes = Number(m[2])
    const dia = Number(m[3])
    const d = new Date(ano, mes - 1, dia)
    if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null
    return { ano, mes, dia, semana: d.getDay() }
}

/** soma dias a uma data ISO, na conta do calendario local */
export function somarDias(iso: string, dias: number): string {
    const v = dataValida(iso)
    if (!v) return iso
    return dataLocalISO(new Date(v.ano, v.mes - 1, v.dia + dias))
}

export type RotuloDoDia = {
    /** "Dom 15/nov" (com "/25" quando o ano nao e o corrente); nome do projeto quando nao e um dia valido */
    curto: string
    /** "15/nov", sem o dia da semana (painel estreito) */
    semSemana: string
    /** "domingo, 15 de novembro" */
    longo: string
    evento: string
    valido: boolean
}

/** "07 - Rede de Mulheres" -> "Rede de Mulheres"; "15" -> "" */
export function eventoDoNome(nome: string): string {
    return /^\d{1,2}\s*-\s*(.+)$/.exec((nome || "").trim())?.[1]?.trim() || ""
}

/** "08 · 10h" -> "10h", "08 · 19h30" -> "19h30"; "" quando o nome nao leva hora (so os dias com mais de um culto levam, utils/aliancaPastas.ts) */
export function horaDoNomeDoProjeto(nome: string): string {
    return /·\s*(\d{1,2}h(?:\d{2})?)\s*$/.exec((nome || "").trim())?.[1] || ""
}

export function rotuloDoDia({ cultoId, nomeProjeto, anoAtual }: { cultoId: string | null | undefined; nomeProjeto?: string; anoAtual: number }): RotuloDoDia {
    const nome = (nomeProjeto || "").trim()
    const v = cultoId ? dataValida(cultoId) : null
    if (!v) return { curto: nome || "—", semSemana: nome || "—", longo: nome || "—", evento: "", valido: false }
    const sufixoAno = v.ano !== anoAtual ? `/${String(v.ano).slice(-2)}` : ""
    const base = `${dois(v.dia)}/${MESES_CURTOS[v.mes - 1]}${sufixoAno}`
    return {
        curto: `${SEMANAS_CURTAS[v.semana]} ${base}`,
        semSemana: base,
        longo: `${SEMANAS_LONGAS[v.semana]}, ${v.dia} de ${MESES_LONGOS[v.mes - 1].toLowerCase()}${v.ano !== anoAtual ? ` de ${v.ano}` : ""}`,
        evento: eventoDoNome(nome),
        valido: true
    }
}

// ---------------------------------------------------------------- opcoes de dia

export type ItemDaArvore = { id: string; type?: string; name?: string; archived?: boolean }
export type ResolvidoDoCulto = { agenda: { nome: string }; cultoId: string } | null

export type OpcaoDeDia = {
    id: string
    curto: string
    semSemana: string
    longo: string
    evento: string
    /** "10h"/"19h30" quando o nome do projeto leva a hora; "" quando nao ha o dado */
    hora: string
    /** nome do projeto, inteiro (vai na dica) */
    nome: string
    cultoId: string
    itens: number
    vazio: boolean
    passado: boolean
    hoje: boolean
    arquivado: boolean
    /** nao e culto (criado a mao, fora da arvore de agenda): o rotulo e o nome */
    foraDeCulto: boolean
    /** nome da agenda quando e culto */
    agenda: string
}
export type GrupoDeDias = { chave: string; titulo: string; opcoes: OpcaoDeDia[] }

/**
 * Os grupos sao 1:1 com os itens `grupo` da arvore, na ordem em que vem (nada e reordenado nem reagrupado). So o TITULO e
 * embelezado: se o primeiro projeto do grupo que e culto der agenda+mes+ano, vira "Novembro 2026" (ou "Aliança · Novembro 2026"
 * em Todos); senao fica o nome do grupo como veio. Projetos antes do primeiro grupo ficam em "Outros", na posicao em que vem.
 *
 * Passado: so as ultimas `semanasDePassado` semanas. O culto aberto aparece mesmo mais velho que isso (uma linha no grupo dele).
 * Culto sem data valida e projeto fora de agenda nunca sao cortados.
 */
export function montarOpcoesDeDia({ itens, resolver, contar, hoje, ativoId, emTodos, semanasDePassado = SEMANAS_DE_PASSADO }: { itens: ItemDaArvore[]; resolver: (id: string) => ResolvidoDoCulto; contar: (id: string) => number; hoje: string; ativoId: string | null; emTodos: boolean; semanasDePassado?: number }): GrupoDeDias[] {
    const anoAtual = dataValida(hoje)?.ano ?? new Date().getFullYear()
    const corte = somarDias(hoje, -7 * semanasDePassado)
    const grupos: GrupoDeDias[] = []
    let atual: { chave: string; nome: string; opcoes: OpcaoDeDia[]; titulo: string | null } | null = null
    const fechar = () => {
        if (atual && atual.opcoes.length) grupos.push({ chave: atual.chave, titulo: atual.titulo ?? atual.nome, opcoes: atual.opcoes })
        atual = null
    }
    itens.forEach((item, i) => {
        if (item.type === "grupo") {
            fechar()
            atual = { chave: item.id || `grupo:${i}`, nome: item.name || "", opcoes: [], titulo: null }
            return
        }
        if (item.type === "folder") return
        if (!atual) atual = { chave: "outros", nome: "Outros", opcoes: [], titulo: null }
        const info = resolver(item.id)
        const rot = rotuloDoDia({ cultoId: info?.cultoId, nomeProjeto: item.name, anoAtual })
        const ehCulto = !!info && rot.valido
        if (atual.titulo === null && ehCulto) {
            const v = dataValida(info!.cultoId)!
            atual.titulo = `${emTodos ? `${info!.agenda.nome} · ` : ""}${MESES_LONGOS[v.mes - 1]} ${v.ano}`
        }
        const cultoId = ehCulto ? info!.cultoId : ""
        if (ehCulto && cultoId < corte && item.id !== ativoId) return
        const n = contar(item.id)
        atual.opcoes.push({
            id: item.id,
            curto: ehCulto ? rot.curto : (item.name || "—").trim() || "—",
            semSemana: ehCulto ? rot.semSemana : (item.name || "—").trim() || "—",
            longo: rot.longo,
            evento: ehCulto ? rot.evento : "",
            hora: ehCulto ? horaDoNomeDoProjeto(item.name || "") : "",
            nome: (item.name || "").trim() || "—",
            cultoId,
            itens: n,
            vazio: n === 0,
            passado: ehCulto && cultoId < hoje,
            hoje: ehCulto && cultoId === hoje,
            arquivado: !!item.archived,
            foraDeCulto: !ehCulto,
            agenda: ehCulto ? info!.agenda.nome : ""
        })
    })
    fechar()
    return grupos
}

/**
 * Grupo sem nenhuma linha embaixo nao se desenha. `temLinha` diz se o item vira uma linha de verdade na tela (um projeto
 * arquivado e escondido nao vira); pasta conta sempre como linha. O grupo vazio sai inteiro (o cabecalho e os itens escondidos
 * dele, que nao tem linha para mostrar); o que vem antes do primeiro grupo e os grupos com linha ficam como vieram, na ordem.
 */
export function removerGruposVazios<T extends { type?: string }>(itens: T[], temLinha: (item: T) => boolean): T[] {
    const saida: T[] = []
    let cabecalho = -1
    let comLinha = false
    const fechar = () => {
        if (cabecalho >= 0 && !comLinha) saida.splice(cabecalho)
        cabecalho = -1
        comLinha = false
    }
    for (const item of itens) {
        if (item.type === "grupo") {
            fechar()
            cabecalho = saida.length
        } else if (item.type === "folder" || temLinha(item)) {
            comLinha = true
        }
        saida.push(item)
    }
    fechar()
    return saida
}

export const opcoesPlanas = (grupos: GrupoDeDias[]): OpcaoDeDia[] => grupos.flatMap((g) => g.opcoes)

/** o que o teclado destaca ao abrir: o culto aberto; senao o 1o de hoje em diante; senao o ultimo; senao -1 */
export function indiceInicial(opcoes: { id: string; cultoId?: string }[], ativoId: string | null, hoje: string): number {
    if (!opcoes.length) return -1
    const ativo = ativoId ? opcoes.findIndex((o) => o.id === ativoId) : -1
    if (ativo >= 0) return ativo
    const futuro = opcoes.findIndex((o) => !!o.cultoId && o.cultoId >= hoje)
    return futuro >= 0 ? futuro : opcoes.length - 1
}

export type TeclaDeMovimento = "ArrowDown" | "ArrowUp" | "Home" | "End" | "PageDown" | "PageUp"

/** sem dar a volta: para no fim e no comeco. Lista vazia = -1 */
export function moverDestaque(indice: number, total: number, tecla: TeclaDeMovimento): number {
    if (total <= 0) return -1
    const ini = indice < 0 ? -1 : indice
    switch (tecla) {
        case "ArrowDown":
            return Math.min(total - 1, ini + 1)
        case "ArrowUp":
            return ini < 0 ? 0 : Math.max(0, ini - 1)
        case "Home":
            return 0
        case "End":
            return total - 1
        case "PageDown":
            return Math.min(total - 1, ini + PAGINA)
        case "PageUp":
            return ini < 0 ? 0 : Math.max(0, ini - PAGINA)
    }
}

// ---------------------------------------------------------------- teclado

export type DecisaoDeTecla = { acao: "mover"; tecla: TeclaDeMovimento } | { acao: "escolher" } | { acao: "fechar" } | { acao: "fecharEngolir" } | { acao: "passar" }

const MODIFICADORAS = ["Shift", "Control", "Alt", "Meta", "AltGraph", "CapsLock", "NumLock", "ScrollLock", "OS", "Hyper", "Super", "Fn", "FnLock"]
const MOVIMENTO: string[] = ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"]

/**
 * Com o popover aberto TODA tecla e engolida (so `passar` volta ao app): a que o popover usa age; a que nao usa FECHA e e engolida
 * (um popover esquecido aberto nao pode matar o avanco ao vivo: perde-se um toque, o segundo age). So passam: modificadora pura,
 * Alt+F4, F11 e F12.
 */
export function decidirTecla(e: { key: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean }): DecisaoDeTecla {
    const k = e.key
    if (MODIFICADORAS.includes(k)) return { acao: "passar" }
    if (e.altKey && k === "F4") return { acao: "passar" }
    if (k === "F11" || k === "F12") return { acao: "passar" }
    const comMod = !!(e.ctrlKey || e.altKey || e.metaKey)
    if (!comMod && MOVIMENTO.includes(k)) return { acao: "mover", tecla: k as TeclaDeMovimento }
    if (!comMod && k === "Enter") return { acao: "escolher" }
    if (!comMod && k === "Escape") return { acao: "fechar" }
    return { acao: "fecharEngolir" }
}

// ---------------------------------------------------------------- a camada (anteparo em tela cheia)

/**
 * A camada inerte pode sair do DOM? So quando nenhum botao esta apertado E passaram INERTE_MS do ultimo evento de ponteiro
 * (o segundo clique de um duplo clique e o dblclick nao podem chegar ao que esta embaixo). Teto de seguranca: TETO_INERTE_MS.
 */
export function camadaPodeSair({ apertado, agora, ultimoEvento, inicioInerte }: { apertado: boolean; agora: number; ultimoEvento: number; inicioInerte: number }): boolean {
    if (agora - inicioInerte >= TETO_INERTE_MS) return true
    if (apertado) return false
    return agora - ultimoEvento >= INERTE_MS
}

/** clique em opcao dentro da carencia (recem aberto, ou lista mudou sob o cursor) e ignorado */
export const dentroDaCarencia = (agora: number, ate: number) => agora < ate

/** com a lista mudando sob o cursor (sincronizacao, ordenacao por modificado): assinatura = ids na ordem */
export const assinaturaDasOpcoes = (opcoes: { id: string }[]) => opcoes.map((o) => o.id).join("|")

// ---------------------------------------------------------------- layout

/** painel estreito: abaixo de 240px a agenda encolhe e o botao de dia perde o dia da semana */
export function larguraDoLayout(largura: number): { semSemana: boolean; agendaPct: number } {
    return largura < 240 ? { semSemana: true, agendaPct: 48 } : { semSemana: false, agendaPct: 42 }
}

export const larguraDoPopover = (larguraDaLinha: number) => Math.min(Math.max(larguraDaLinha, 0), 360)

/** abaixo disto o popover esconde o texto "7 itens"/"vazio" (o ponto fica, com dica) */
export const POPOVER_SEM_CONTAGEM = 230

export function posicaoDoPopover({ linha, base, janelaAltura }: { linha: { left: number; width: number }; base: number; janelaAltura: number }): { left: number; top: number; width: number; maxHeight: number } {
    const top = base + 4
    return { left: linha.left, top, width: larguraDoPopover(linha.width), maxHeight: Math.max(120, Math.min(320, janelaAltura - top - 12)) }
}

/** abas de agenda: o nome da ativa; id desconhecido cai em "Todos" */
export function nomeDaAgenda(abas: { id: string; nome: string }[], id: string): string {
    return abas.find((a) => a.id === id)?.nome || "Todos"
}

export type EstadoDoBotaoDia = { texto: string; textoCurto: string; dica: string; desabilitado: boolean; foraDoFiltro: boolean }

/**
 * O botao de dia fechado. `ativo` = o culto aberto ({nome, cultoId}); `noFiltro` = ele aparece na lista do filtro atual.
 * Sem culto aberto: "Escolher culto". Filtro sem nenhum culto: "Sem cultos", desabilitado.
 */
export function estadoDoBotaoDia({ ativo, noFiltro, temCultos, agendaNome, anoAtual, agendaDoAtivo }: { ativo: { nome: string; cultoId: string | null } | null; noFiltro: boolean; temCultos: boolean; agendaNome: string; anoAtual: number; agendaDoAtivo?: string }): EstadoDoBotaoDia {
    if (!temCultos) return { texto: "Sem cultos", textoCurto: "Sem cultos", dica: `Nenhum culto em ${agendaNome}`, desabilitado: true, foraDoFiltro: false }
    if (!ativo) {
        return { texto: "Escolher culto", textoCurto: "Escolher culto", dica: "Escolher o culto", desabilitado: false, foraDoFiltro: false }
    }
    const rot = rotuloDoDia({ cultoId: ativo.cultoId, nomeProjeto: ativo.nome, anoAtual })
    const quem = [agendaDoAtivo, rot.valido ? rot.curto : ativo.nome].filter(Boolean).join(" · ")
    const dica = noFiltro ? `Culto aberto: ${quem}${rot.evento ? ` — ${rot.evento}` : ""}` : `Aberto: ${quem} (fora do filtro ${agendaNome})`
    return { texto: rot.curto, textoCurto: rot.semSemana, dica, desabilitado: false, foraDoFiltro: !noFiltro }
}

// ---------------------------------------------------------------- marcacao do leiaute v2 (cartoes de local e de dia)

/** bolinha de cada agenda no botao e no popover de local (cores do prototipo: Aliança azul, Impulso ambar; Extra verde; Todos neutra) */
export function corDaAgenda(id: string): string {
    if (id === "alianca") return "#7ea6d8"
    if (id === "impulso") return "#eba640"
    if (id === "extra") return "#5ec48d"
    return "rgba(248, 248, 240, 0.5)"
}

/** a segunda linha do cartao de local */
export function subDaAgenda(id: string): string {
    if (id === "alianca") return "Ministério Aliança"
    if (id === "impulso") return "Igreja Impulso"
    if (id === "extra") return "Eventos avulsos"
    return "Todas as agendas"
}

/** o cartao de dia: "DOM" e "15" a partir do culto (null quando nao e dia valido: o cartao mostra o nome inteiro) */
export function partesDoDia(cultoId: string): { semana: string; num: string } | null {
    const v = dataValida(cultoId)
    return v ? { semana: SEMANAS_CURTAS[v.semana].toUpperCase(), num: String(v.dia) } : null
}

/** o culto aberto e o de hoje (selo HOJE no botao fechado) */
export const ehHoje = (cultoId: string | null | undefined, hoje: string) => !!cultoId && cultoId === hoje
