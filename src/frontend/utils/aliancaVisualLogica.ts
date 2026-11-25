// Visual (cabine 6, fatia V1; D6, D10, D13–D17): a parte pura. Um Visual diz, para cada saida, que modelo veste cada tipo de conteudo
// ("Sem modelo" = o slide como foi feito, ou o id de um modelo) e, para cada saida de retorno, o leiaute do retorno (campo separado, D16).
// Ativar um Visual NAO cria motor novo: escreve os campos que ja existem (style.template = Musica e avisos, style.templateScripture = Biblia,
// outputs[id].stageOutput = retorno). Quem escreve e aliancaVisualAplicador.ts; aqui so se calcula o que escrever, o que esta errado e a pendencia do D15.
// Nada aqui importa loja nem o fecho da janela de saida.

/** as colunas da tabela. Para dividir "Aviso" de "Musica" (V5), basta outra entrada aqui com o campo novo do estilo. */
export const COLUNAS = [
    { id: "musica", rotulo: "Música e avisos", campo: "template" },
    { id: "biblia", rotulo: "Bíblia", campo: "templateScripture" }
] as const

export type Coluna = (typeof COLUNAS)[number]["id"]
export type CampoDeEstilo = string
/** "slide" = Sem modelo (a saida mostra o slide como foi feito); qualquer outro texto = id de modelo */
export type Casa = "slide" | string

// ---------------------------------------------------------------- Tela + Visual ("aprovo tela-visual", 23/nov; desenho-tela-e-visual.md)
// O estilo de cada saida virou RESULTADO: estilo = Tela fisica da saida (outputs[id].aliancaTelaFisica) + o que o Visual ativo diz para ela.
// Os dois guardam os campos com o MESMO nome do estilo; chave ausente = nao escreve (o que estiver no estilo fica como esta).

/** Biblia com 2, 3 e 4 versoes: modelo proprio (vazio = igual a Biblia; output.ts cai em templateScripture). Ausente no Visual = nao mexe. */
export const COLUNAS_EXTRA = [
    { id: "biblia2", rotulo: "Bíblia, 2 versões", campo: "templateScripture_2" },
    { id: "biblia3", rotulo: "Bíblia, 3 versões", campo: "templateScripture_3" },
    { id: "biblia4", rotulo: "Bíblia, 4 versões", campo: "templateScripture_4" }
] as const
export type ColunaExtra = (typeof COLUNAS_EXTRA)[number]["id"]

/**
 * 25/nov (fila do André, item 3): o modelo de 2, 3 e 4 versoes mora no MODELO DE BIBLIA (`settings.aliancaVersoes`: { "2": id, ... }).
 * Chave presente vence a coluna extra do Visual ("" = igual ao proprio modelo); chave ausente = a coluna extra decide como antes.
 */
export const VERSOES_DA_BIBLIA = ["2", "3", "4"] as const
export type QuantasVersoes = (typeof VERSOES_DA_BIBLIA)[number]
export const campoDasVersoes = (n: QuantasVersoes) => `templateScripture_${n}`
export function versoesDoModelo(modelo: any): { [n: string]: string } {
    const v = modelo?.settings?.aliancaVersoes
    return v && typeof v === "object" && !Array.isArray(v) ? v : {}
}

/** o que e da TELA (o Screens do ProPresenter): nao muda de culto para culto */
export const CAMPOS_FISICOS = ["aspectRatio", "fit", "lines", "volume", "blurAmount", "blurOpacity", "showAsFaded", "lineOpacity", "skipVirtualBreaks"] as const
/** o que e do VISUAL alem dos modelos (o Look): camadas, fundo, transicao, creditos */
export const CAMPOS_DE_APARENCIA = ["layers", "background", "backgroundImage", "clearStyleBackgroundOnText", "transition", "metadata"] as const
/** campos de modelo: so estes esperam o proximo slide (D15); camadas, fundo e transicao valem na hora, como o Look */
export const CAMPOS_DE_MODELO: string[] = [...COLUNAS.map((c) => c.campo), ...COLUNAS_EXTRA.map((c) => c.campo)]

export type Aparencia = { [campo: string]: any }
export type SaidaDoVisual = { [c in Coluna]?: Casa } & {
    [c in ColunaExtra]?: Casa
} & { aparencia?: Aparencia }
export type Visual = {
    id: string
    nome: string
    saidas: { [outputId: string]: SaidaDoVisual }
    /** por saida de retorno: o leiaute do retorno (stageShows). null/ausente = o Visual nao mexe */
    retorno: { [outputId: string]: string | null }
}

export const NOME_PADRAO = "Culto padrão"
export const SLIDE: Casa = "slide"
/** o rotulo da casa "slide" em toda a tela (casa, seletor, linha de origem, Estilo da saida, Saidas). Pedido do Andre, 23/nov */
export const SEM_MODELO = "Sem modelo"

type Saidas = { [id: string]: any }
type Estilos = { [id: string]: any }
type Mapa = { [id: string]: any }

const ehObjeto = (v: unknown): v is { [k: string]: any } => !!v && typeof v === "object" && !Array.isArray(v)

// ---------------------------------------------------------------- saidas

/** saida normal (veste conteudo): nao e retorno nem saida-chave */
export const ehSaidaNormal = (o: any): boolean => ehObjeto(o) && !o.stageOutput && !o.isKeyOutput
/** saida de retorno (mostra um leiaute de palco) */
export const ehSaidaDeRetorno = (o: any): boolean => ehObjeto(o) && !!o.stageOutput && !o.isKeyOutput

export function saidasNormais(outputs: Saidas | null | undefined): { id: string; nome: string; estilo: string }[] {
    return Object.entries(outputs || {})
        .filter(([, o]) => ehSaidaNormal(o))
        .map(([id, o]) => ({ id, nome: o.name || id, estilo: o.style || "" }))
}
export function saidasDeRetorno(outputs: Saidas | null | undefined): { id: string; nome: string; leiaute: string }[] {
    return Object.entries(outputs || {})
        .filter(([, o]) => ehSaidaDeRetorno(o))
        .map(([id, o]) => ({ id, nome: o.name || id, leiaute: o.stageOutput }))
}

/** o estilo que a saida usa de fato (id que existe na loja) ou "" */
export function estiloDaSaida(o: any, estilos: Estilos): string {
    const id = o?.style || ""
    return id && ehObjeto(estilos?.[id]) ? id : ""
}

// ---------------------------------------------------------------- dado (special)

/** a lista guardada em special.aliancaVisuais, so com entradas validas */
export function lerVisuais(special: any): Visual[] {
    const l = special?.aliancaVisuais
    if (!Array.isArray(l)) return []
    return l
        .filter((v) => ehObjeto(v) && typeof v.id === "string" && v.id)
        .map((v) => ({
            id: v.id,
            nome: String(v.nome || ""),
            saidas: ehObjeto(v.saidas) ? v.saidas : {},
            retorno: ehObjeto(v.retorno) ? v.retorno : {}
        }))
}

export function visualAtivo(special: any): Visual | null {
    const l = lerVisuais(special)
    return l.find((v) => v.id === special?.aliancaVisualAtivo) || null
}

export const casaDe = (v: Visual | null | undefined, outputId: string, coluna: Coluna): Casa => v?.saidas?.[outputId]?.[coluna] || SLIDE

/**
 * migracao (primeira carga): o "Culto padrao" nasce LENDO o que ja esta nos estilos e no retorno de cada saida, para nada mudar na tela.
 * Devolve null se ja existe lista (nunca refaz).
 */
export function migrar(special: any, outputs: Saidas, estilos: Estilos, novoId: string): { aliancaVisuais: Visual[]; aliancaVisualAtivo: string } | null {
    if (Array.isArray(special?.aliancaVisuais)) return null
    const v: Visual = { id: novoId, nome: NOME_PADRAO, saidas: {}, retorno: {} }
    for (const s of saidasNormais(outputs)) {
        const est = estilos?.[estiloDaSaida(outputs[s.id], estilos)] || {}
        const linha: SaidaDoVisual = {}
        for (const c of COLUNAS) linha[c.id] = est[c.campo] || SLIDE
        v.saidas[s.id] = linha
    }
    for (const r of saidasDeRetorno(outputs)) v.retorno[r.id] = r.leiaute || null
    return { aliancaVisuais: [v], aliancaVisualAtivo: novoId }
}

export function nomeLivre(visuais: Visual[], base: string): string {
    const nomes = new Set(visuais.map((v) => v.nome.trim().toLowerCase()))
    if (!nomes.has(base.trim().toLowerCase())) return base
    for (let i = 2; ; i++) if (!nomes.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`
}

export function duplicar(v: Visual, visuais: Visual[], novoId: string): Visual {
    return {
        id: novoId,
        nome: nomeLivre(visuais, `${v.nome} (cópia)`),
        saidas: JSON.parse(JSON.stringify(v.saidas || {})),
        retorno: JSON.parse(JSON.stringify(v.retorno || {}))
    }
}

/**
 * Visual novo: toda saida em "Sem modelo" e o retorno como esta hoje. Camadas, fundo e transicao vem de `base` (o Visual ativo): sem isso,
 * ativar o Visual novo nao mexeria neles, mas trocar de volta para ele depois de outro Visual deixaria o que o outro escreveu (revisao, achado 5).
 */
export function novoVisual(visuais: Visual[], outputs: Saidas, novoId: string, base: Visual | null = null): Visual {
    const v: Visual = {
        id: novoId,
        nome: nomeLivre(visuais, "Visual novo"),
        saidas: {},
        retorno: {}
    }
    for (const s of saidasNormais(outputs)) {
        const linha: SaidaDoVisual = { musica: SLIDE, biblia: SLIDE }
        const b = base?.saidas?.[s.id]
        if (b) {
            for (const c of COLUNAS_EXTRA) if (b[c.id] !== undefined) linha[c.id] = SLIDE
            if (ehObjeto(b.aparencia)) linha.aparencia = JSON.parse(JSON.stringify(b.aparencia))
        }
        v.saidas[s.id] = linha
    }
    for (const r of saidasDeRetorno(outputs)) v.retorno[r.id] = r.leiaute || null
    return v
}

// ---------------------------------------------------------------- Tela + Visual: o estilo composto

/** valor comparavel: undefined (apagar o campo) e diferente de null; objetos com chaves em ordem */
export function estavel(x: any): string {
    if (x === undefined) return "\u0000apagar"
    return JSON.stringify(ordenarChaves(x))
}
function ordenarChaves(x: any): any {
    if (Array.isArray(x)) return x.map(ordenarChaves)
    if (!ehObjeto(x)) return x
    const r: { [k: string]: any } = {}
    for (const k of Object.keys(x).sort()) r[k] = ordenarChaves(x[k])
    return r
}
/** pedido inteiro (chaves presentes, inclusive as de apagar) num texto comparavel */
const estavelDoPedido = (d: { [k: string]: any }): string =>
    Object.keys(d)
        .sort()
        .map((k) => `${k}=${estavel(d[k])}`)
        .join("\u0001")

/** a Tela fisica da saida (outputs[id].aliancaTelaFisica) ou null (saida ainda nao migrada) */
export function telaFisicaDe(o: any): Aparencia | null {
    const t = o?.aliancaTelaFisica
    return ehObjeto(t) ? t : null
}

/** copia so os campos pedidos que existem em `de` (valor undefined nao conta) */
export function escolherCampos(de: any, campos: readonly string[]): Aparencia {
    const r: Aparencia = {}
    if (!ehObjeto(de)) return r
    for (const k of campos) if (de[k] !== undefined) r[k] = JSON.parse(JSON.stringify(de[k]))
    return r
}

/**
 * o que a saida PEDE ao estilo dela: campos da Tela fisica + modelos e aparencia do Visual. Chave presente com valor undefined = apagar o
 * campo do estilo ("Sem modelo"); chave ausente = nao mexer.
 */
export function desejadoDaSaida(v: Visual | null, outputId: string, o: any, templates: Mapa = {}): { [campo: string]: any } {
    const r: { [campo: string]: any } = {}
    const t = telaFisicaDe(o)
    if (t) for (const k of CAMPOS_FISICOS) if (k in t && t[k] !== undefined) r[k] = t[k]
    if (!v) return r
    for (const c of COLUNAS) {
        const casa = casaDe(v, outputId, c.id)
        r[c.campo] = casa === SLIDE ? undefined : casa
    }
    const linha: SaidaDoVisual = v.saidas?.[outputId] || {}
    const biblia = casaDe(v, outputId, "biblia")
    const doModelo = biblia !== SLIDE ? versoesDoModelo(templates?.[biblia]) : {}
    for (const c of COLUNAS_EXTRA) {
        const n = c.campo.slice(-1)
        if (Object.prototype.hasOwnProperty.call(doModelo, n)) {
            const id = doModelo[n]
            r[c.campo] = id && id !== SLIDE && ehObjeto(templates?.[id]) ? id : undefined
            continue
        }
        const casa = linha[c.id]
        if (casa === undefined) continue
        r[c.campo] = !casa || casa === SLIDE ? undefined : casa
    }
    if (ehObjeto(linha.aparencia)) for (const k of CAMPOS_DE_APARENCIA) if (k in linha.aparencia && linha.aparencia[k] !== undefined) r[k] = linha.aparencia[k]
    return r
}

export const VERSAO_TELA = 1

/**
 * migracao Tela + Visual (uma vez; marcador special.aliancaTelaVersao). LE o estilo de cada saida normal, sem mudar nada na tela:
 * a Tela fisica recebe os campos fisicos e CADA Visual recebe a aparencia e os modelos de 2–4 versoes de hoje.
 * Quem chama tem de ter dado antes um estilo proprio a cada saida (saidasParaSeparar estrito). Devolve null se ja migrou.
 */
export function migrarTela(special: any, outputs: Saidas, estilos: Estilos): { telas: { [outputId: string]: Aparencia }; visuais: Visual[] } | null {
    if ((Number(special?.aliancaTelaVersao) || 0) >= VERSAO_TELA) return null
    const telas: { [id: string]: Aparencia } = {}
    const visuais: Visual[] = JSON.parse(JSON.stringify(lerVisuais(special)))
    for (const s of saidasNormais(outputs)) {
        const est = estilos?.[estiloDaSaida(outputs[s.id], estilos)] || {}
        telas[s.id] = escolherCampos(est, CAMPOS_FISICOS)
        for (const v of visuais) {
            const linha: SaidaDoVisual = v.saidas[s.id] || (v.saidas[s.id] = {})
            linha.aparencia = escolherCampos(est, CAMPOS_DE_APARENCIA)
            for (const c of COLUNAS_EXTRA) linha[c.id] = est[c.campo] || SLIDE
        }
    }
    return { telas, visuais }
}

// ---------------------------------------------------------------- plano de escrita

export type EscritaDeEstilo = {
    tipo: "estilo"
    estilo: string
    campo: CampoDeEstilo
    valor: any
    saidas: string[]
    espera?: boolean
}
export type EscritaDeRetorno = {
    tipo: "retorno"
    saida: string
    valor: string
}
export type Escrita = EscritaDeEstilo | EscritaDeRetorno

/**
 * so problema de verdade fica laranja (D14 + pedido do Andre, 23/nov). Estilo dividido ou saida sem estilo NAO e problema: o aplicador da
 * a saida um estilo so dela (copia exata, desenha igual) antes de escrever; ver `saidasParaSeparar`.
 */
export type Problema =
    /** o modelo da casa nao existe mais (a saida mostra o slide como foi feito) */
    | { tipo: "modeloSumiu"; saida: string; coluna: Coluna; modelo: string }
    /** o leiaute de retorno nao existe mais: nada e escrito */
    | { tipo: "leiauteSumiu"; saida: string; leiaute: string }

export const chaveDaEscrita = (e: Escrita): string => (e.tipo === "estilo" ? `estilo:${e.estilo}:${e.campo}` : `retorno:${e.saida}`)

/**
 * as saidas que precisam de um estilo so delas para `v` valer: a saida sem estilo (ou com estilo apagado) que pede modelo, e, num estilo
 * dividido por saidas que pedem coisas diferentes em alguma coluna, todas menos a primeira (a primeira fica com o estilo original).
 * O aplicador da a cada uma uma copia exata do estilo atual (desenha igual) com o nome da saida e so depois escreve. Nunca na carga.
 */
export function saidasParaSeparar(v: Visual | null, outputs: Saidas, estilos: Estilos, estrito = false): string[] {
    const r: string[] = []
    const porEstilo = new Map<string, string[]>()
    for (const s of saidasNormais(outputs)) {
        const est = estiloDaSaida(outputs[s.id], estilos)
        if (!est) {
            // estrito (depois da migracao Tela + Visual): toda saida normal tem estilo so dela, mesmo sem pedir nada
            if (estrito || Object.values(desejadoDaSaida(v, s.id, outputs[s.id])).some((x) => x !== undefined)) r.push(s.id)
            continue
        }
        porEstilo.set(est, [...(porEstilo.get(est) || []), s.id])
    }
    for (const ids of porEstilo.values()) {
        if (ids.length < 2) continue
        const [primeira, ...outras] = ids
        if (estrito) {
            r.push(...outras)
            continue
        }
        const pedidoDe = (id: string) => estavelDoPedido(desejadoDaSaida(v, id, outputs[id]))
        if (outras.some((id) => pedidoDe(id) !== pedidoDe(primeira))) r.push(...outras)
    }
    return r
}

/** o nome do estilo proprio de uma saida: o nome dela (com numero se ja existir um estilo com esse nome) */
export function nomeDoEstiloProprio(nomeDaSaida: string, estilos: Estilos): string {
    const base = (nomeDaSaida || "Saída").trim() || "Saída"
    const nomes = new Set(
        Object.values(estilos || {}).map((e: any) =>
            String(e?.name || "")
                .trim()
                .toLowerCase()
        )
    )
    if (!nomes.has(base.toLowerCase())) return base
    for (let i = 2; ; i++) if (!nomes.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`
}

/**
 * o que ativar `v` escreveria. So devolve escrita que muda algo (valor atual diferente). Saida sem estilo ou estilo dividido com pedidos
 * diferentes nao gera escrita (o aplicador separa antes: `saidasParaSeparar`); nada e escrito calado num estilo que outra saida usa.
 */
export function planoDeEscrita(v: Visual | null, outputs: Saidas, estilos: Estilos, templates: Mapa = {}, leiautes: Mapa = {}): { escritas: Escrita[]; problemas: Problema[] } {
    const escritas: Escrita[] = []
    const problemas: Problema[] = []
    const porEstilo = new Map<string, string[]>()
    for (const s of saidasNormais(outputs)) {
        const est = estiloDaSaida(outputs[s.id], estilos)
        if (!est) continue
        porEstilo.set(est, [...(porEstilo.get(est) || []), s.id])
    }
    if (v)
        for (const s of saidasNormais(outputs))
            for (const c of COLUNAS) {
                const casa = casaDe(v, s.id, c.id)
                if (casa !== SLIDE && !ehObjeto(templates?.[casa]))
                    problemas.push({
                        tipo: "modeloSumiu",
                        saida: s.id,
                        coluna: c.id,
                        modelo: casa
                    })
            }
    for (const [est, ids] of porEstilo) {
        const pedidos = ids.map((id) => desejadoDaSaida(v, id, outputs[id], templates))
        const campos = new Set(pedidos.flatMap((d) => Object.keys(d)))
        for (const campo of campos) {
            // alguem nao pede ou pede outra coisa: estilo dividido, separar antes (saidasParaSeparar)
            if (pedidos.some((d) => !(campo in d))) continue
            if (new Set(pedidos.map((d) => estavel(d[campo]))).size > 1) continue
            const valor = pedidos[0][campo]
            const modelo = CAMPOS_DE_MODELO.includes(campo)
            const atual = modelo ? estilos[est]?.[campo] || undefined : estilos[est]?.[campo]
            if (estavel(atual) !== estavel(valor))
                escritas.push({
                    tipo: "estilo",
                    estilo: est,
                    campo,
                    valor,
                    saidas: ids,
                    espera: modelo
                })
        }
    }
    if (!v) return { escritas, problemas }
    for (const r of saidasDeRetorno(outputs)) {
        const l = v.retorno?.[r.id]
        if (!l) continue
        if (!ehObjeto(leiautes?.[l])) {
            problemas.push({ tipo: "leiauteSumiu", saida: r.id, leiaute: l })
            continue
        }
        if (l !== r.leiaute) escritas.push({ tipo: "retorno", saida: r.id, valor: l })
    }
    return { escritas, problemas }
}

/** saidas que dividem o estilo de `outputId` (sem contar ela) */
export function dividemEstilo(outputs: Saidas, estilos: Estilos, outputId: string): string[] {
    const est = estiloDaSaida(outputs?.[outputId], estilos)
    if (!est) return []
    return saidasNormais(outputs)
        .filter((s) => s.id !== outputId && estiloDaSaida(outputs[s.id], estilos) === est)
        .map((s) => s.id)
}

/**
 * ao por `casa` na coluna de uma saida: precisa de estilo proprio? Sim se a saida nao tem estilo (e a casa e modelo) ou se divide o estilo
 * com outra saida que, no mesmo Visual, pede outra coisa nessa coluna. A tela nao pergunta: o aplicador separa sozinho (copia exata).
 */
export function precisaDeEstiloProprio(v: Visual, outputs: Saidas, estilos: Estilos, outputId: string, coluna: Coluna, casa: Casa): "semEstilo" | "dividido" | null {
    if (!estiloDaSaida(outputs?.[outputId], estilos)) return casa === SLIDE ? null : "semEstilo"
    const outras = dividemEstilo(outputs, estilos, outputId)
    return outras.some((id) => casaDe(v, id, coluna) !== casa) ? "dividido" : null
}

// ---------------------------------------------------------------- divergencia (alguem mexeu por fora)

/** campos de estilo que nao batem com o Visual (sem contar os que estao pendentes nem os que sao problema) */
export function divergencias(v: Visual, outputs: Saidas, estilos: Estilos, pendentes: Set<string> = new Set()): EscritaDeEstilo[] {
    return planoDeEscrita(v, outputs, estilos).escritas.filter((e): e is EscritaDeEstilo => e.tipo === "estilo" && !pendentes.has(chaveDaEscrita(e)))
}

// ---------------------------------------------------------------- D15: vale no proximo slide

/**
 * identidade do slide no ar numa saida: show, leiaute, posicao, pagina e, para a Biblia da gaveta (`id: "temp"`), os itens e valores
 * dinamicos (cada versiculo novo e outro slide com o mesmo id). `line` (limite de linhas) nao conta. Sem slide = null.
 */
export function identidadeDoSlide(slide: any): string | null {
    if (!ehObjeto(slide) || !slide.id) return null
    const base: any = {
        id: slide.id,
        layout: slide.layout ?? null,
        index: slide.index ?? null,
        page: slide.page ?? null
    }
    if (slide.id === "temp") {
        base.tempItems = slide.tempItems ?? null
        base.customDynamicValues = slide.customDynamicValues ?? null
        base.translations = slide.translations ?? null
    }
    try {
        return JSON.stringify(base)
    } catch {
        return `${slide.id}|${slide.layout}|${slide.index}|${Math.random()}`
    }
}

export const slideNoAr = (o: any): boolean => ehObjeto(o) && o.enabled !== false && !!identidadeDoSlide(o.out?.slide)

/** as saidas cujo slide decide quando a escrita entra: estilo = as saidas que o usam; retorno = a propria saida */
export const saidasDaEscrita = (e: Escrita): string[] => (e.tipo === "estilo" ? e.saidas : [e.saida])

type Pendente = {
    escrita: Escrita
    vigiadas: { [outputId: string]: string | null }
}

/**
 * pendencias por chave de escrita. `registrar` separa o que entra ja (nenhuma saida vigiada com slide no ar) do que espera; `aoMudar`
 * devolve o que deve entrar agora (alguma saida vigiada trocou de slide, foi para vazio ou sumiu).
 */
export class Pendencias {
    private mapa = new Map<string, Pendente>()

    chaves(): Set<string> {
        return new Set(this.mapa.keys())
    }
    get tamanho(): number {
        return this.mapa.size
    }
    /** por saida: ha algo esperando o proximo slide nela? */
    saidasEsperando(): Set<string> {
        const r = new Set<string>()
        for (const p of this.mapa.values()) for (const id of Object.keys(p.vigiadas)) r.add(id)
        return r
    }

    /** troca TODAS as pendencias pelo plano novo (um Visual novo substitui o anterior que ainda nao entrou). Devolve o que entra ja. */
    registrar(escritas: Escrita[], outputs: Saidas): Escrita[] {
        this.mapa.clear()
        const ja: Escrita[] = []
        for (const e of escritas) {
            const vigiadas: { [id: string]: string | null } = {}
            for (const id of saidasDaEscrita(e)) if (slideNoAr(outputs?.[id])) vigiadas[id] = identidadeDoSlide(outputs[id].out.slide)
            // camadas, fundo e transicao valem na hora, como o Look do ProPresenter; so modelo e leiaute de retorno esperam o proximo slide
            if (!Object.keys(vigiadas).length || (e.tipo === "estilo" && !e.espera)) ja.push(e)
            else this.mapa.set(chaveDaEscrita(e), { escrita: e, vigiadas })
        }
        return ja
    }

    aoMudar(outputs: Saidas): Escrita[] {
        const sai: Escrita[] = []
        for (const [k, p] of this.mapa) {
            const mudou = Object.entries(p.vigiadas).some(([id, ident]) => identidadeDoSlide(outputs?.[id]?.out?.slide) !== ident)
            if (mudou) {
                sai.push(p.escrita)
                this.mapa.delete(k)
            }
        }
        return sai
    }

    cancelar(): number {
        const n = this.mapa.size
        this.mapa.clear()
        return n
    }
}

// ---------------------------------------------------------------- linha de origem (D14)

export type EtiquetaDeOrigem = {
    saida: string
    nome: string
    texto: string
    problema: string
    pendente: boolean
}

/**
 * a linha de origem de Mostrar: por saida normal, de onde vem a cara (modelo do Visual ou o slide como foi feito) e, por retorno, o leiaute.
 * Le o que a saida usa DE FATO (os campos do estilo), compara com o Visual e so marca problema quando algo nao bate.
 */
export function linhaDeOrigem(
    v: Visual | null,
    coluna: Coluna,
    o: {
        outputs: Saidas
        estilos: Estilos
        templates: Mapa
        leiautes: Mapa
        pendentes?: Set<string>
    }
): EtiquetaDeOrigem[] {
    const r: EtiquetaDeOrigem[] = []
    const campo = COLUNAS.find((c) => c.id === coluna)!.campo
    const pend = o.pendentes || new Set<string>()
    for (const s of saidasNormais(o.outputs)) {
        const est = estiloDaSaida(o.outputs[s.id], o.estilos)
        const usado: string = (est && o.estilos[est]?.[campo]) || ""
        const pedido = v ? casaDe(v, s.id, coluna) : SLIDE
        const pendente = !!est && pend.has(`estilo:${est}:${campo}`)
        let problema = ""
        let texto = usado ? o.templates?.[usado]?.name || "modelo sem nome" : SEM_MODELO
        if (usado && !ehObjeto(o.templates?.[usado])) {
            texto = "modelo não existe mais"
            problema = "o modelo desta saída foi apagado; ela está sem modelo"
        } else if (v && !pendente && (pedido === SLIDE ? "" : pedido) !== usado) {
            problema = "a saída não está como o Visual diz"
        }
        r.push({ saida: s.id, nome: s.nome, texto, problema, pendente })
    }
    for (const s of saidasDeRetorno(o.outputs)) {
        const existe = ehObjeto(o.leiautes?.[s.leiaute])
        r.push({
            saida: s.id,
            nome: s.nome,
            texto: existe ? o.leiautes[s.leiaute].name || "leiaute sem nome" : "leiaute não existe mais",
            problema: existe ? "" : "o leiaute do retorno foi apagado",
            pendente: pend.has(`retorno:${s.id}`)
        })
    }
    return r
}

/** texto curto de um problema, para a tabela e o menu do telao */
export function textoDoProblema(p: Problema, nomes: { saida: (id: string) => string; modelo?: (id: string) => string }): string {
    const col = COLUNAS.find((c) => c.id === (p as any).coluna)?.rotulo || ""
    if (p.tipo === "modeloSumiu") return `${nomes.saida(p.saida)}: o modelo de ${col} não existe mais`
    return `${nomes.saida(p.saida)}: o leiaute do retorno não existe mais`
}
