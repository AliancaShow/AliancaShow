// ----- AliançaShow · "Texto ligado" da caixa de texto ("Sim, assim", 24/nov) -----
//
// O "Linked Text" do ProPresenter em cima do motor que o FreeShow ja tem: os valores dinamicos (`{slide_text_next}`,
// `{scripture_reference}`, `{time_hours}`...). O operador escolhe "Referência" numa lista em portugues; a caixa recebe o MESMO codigo
// que o botao direito › Valores dinamicos poria. Nada muda no telao nem no fecho: o desenho e o do FreeShow.
// Logica PURA (sem store, sem DOM). O painel e `components/edit/tools/AliancaTextoLigado.svelte`.

export type TrechoDeTexto = { value: string; style?: string; [k: string]: any }
export type LinhaDeTexto = { align?: string; text: TrechoDeTexto[]; [k: string]: any }
export type CaixaLigavel = { type?: string; lines?: LinhaDeTexto[]; [k: string]: any }

/** emLinhas: cada parte numa linha (ex.: referência em cima, versão embaixo, como o modelo "Bíblia" do FreeShow) */
export type OpcaoLigada = { id: string; rotulo: string; partes: string[]; exemplo?: string; emLinhas?: boolean }
export type GrupoLigado = { id: string; rotulo: string; opcoes: OpcaoLigada[] }

export const NENHUM: OpcaoLigada = { id: "nenhum", rotulo: "Nenhum (texto que eu escrevo)", partes: [] }

const op = (id: string, rotulo: string, partes: string | string[], exemplo = ""): OpcaoLigada => ({ id, rotulo, partes: Array.isArray(partes) ? partes : [partes], exemplo })

const SLIDE: GrupoLigado = {
    id: "slide",
    rotulo: "Slide",
    opcoes: [
        op("slide_atual", "Texto do slide atual", "{slide_text_current}"),
        op("slide_proximo", "Texto do próximo slide", "{slide_text_next}"),
        op("slide_anterior", "Texto do slide anterior", "{slide_text_previous}"),
        op("slide_notas", "Anotações do slide", "{slide_notes}"),
        op("slide_notas_proximo", "Anotações do próximo slide", "{slide_notes_next}"),
        op("slide_grupo", "Grupo (Verso, Refrão…)", "{slide_group}"),
        op("slide_grupo_proximo", "Próximo grupo", "{slide_group_next}"),
        op("slide_numero", "Número do slide", "{slide_number}"),
        op("musica_nome", "Nome da música", "{show_name}"),
        op("musica_proxima", "Próxima música do culto", "{show_name_next}")
    ]
}

const BIBLIA: GrupoLigado = {
    id: "biblia",
    rotulo: "Bíblia",
    opcoes: [
        op("biblia_versiculo_numero", "Versículo (com número)", ["{scripture_number} ", "{scripture_text}"], "16 Porque Deus amou o mundo…"),
        op("biblia_versiculo", "Versículo (só o texto)", "{scripture_text}", "Porque Deus amou o mundo…"),
        op("biblia_referencia", "Referência", "{scripture_reference}", "João 3:16"),
        { ...op("biblia_referencia_versao", "Referência e versão (2 linhas)", ["{scripture_reference}", "{scripture_name}"], "João 3:16 · ARA"), emLinhas: true },
        op("biblia_referencia_completa", "Referência completa (todos os slides)", "{scripture_reference_full}", "João 3:16-18"),
        op("biblia_referencia_ultimo", "Referência só no último slide", "{scripture_reference_last}", "João 3:16-18"),
        op("biblia_livro", "Livro", "{scripture_book}", "João"),
        op("biblia_capitulo", "Capítulo", "{scripture_chapter}", "3"),
        op("biblia_versiculos", "Versículos", "{scripture_verses}", "16-18"),
        op("biblia_versao", "Versão", "{scripture_name}", "ARA")
    ]
}

const RELOGIO: GrupoLigado = {
    id: "relogio",
    rotulo: "Relógio e data",
    opcoes: [op("hora", "Hora (19:30)", "{time_hours}:{time_minutes}"), op("hora_segundos", "Hora com segundos (19:30:05)", "{time_hours}:{time_minutes}:{time_seconds}"), op("data", "Data (24/11/2026)", "{time_date}/{time_month}/{time_year}"), op("dia_semana", "Dia da semana", "{time_str_day}")]
}

const MIDIA: GrupoLigado = {
    id: "midia",
    rotulo: "Vídeo e áudio",
    opcoes: [op("video_tempo", "Vídeo: tempo passado", "{video_time}"), op("video_falta", "Vídeo: tempo que falta", "{video_countdown}"), op("video_duracao", "Vídeo: duração", "{video_duration}"), op("audio_titulo", "Áudio: música tocando", "{audio_title}"), op("audio_artista", "Áudio: artista", "{audio_artist}"), op("audio_falta", "Áudio: tempo que falta", "{audio_countdown}")]
}

const PROJETO: GrupoLigado = {
    id: "projeto",
    rotulo: "Culto (projeto)",
    opcoes: [op("projeto_secao", "Parte atual do culto", "{project_section}"), op("projeto_secao_proxima", "Próxima parte do culto", "{project_section_next}")]
}

/** mesmo id que o FreeShow da ao cronometro (`getVariableNameId` em showActions.ts) */
export const idDoCronometro = (nome: string) => "timer_" + String(nome).toLowerCase().trim().replaceAll(" ", "_")

/**
 * As opcoes da lista, por grupo. Bíblia so aparece em modelo (no slide de uma musica o valor nao teria de onde vir).
 * Cronometros: um por cronometro criado (com nome).
 */
export function gruposLigados(c: { emModelo: boolean; cronometros?: string[] }): GrupoLigado[] {
    const grupos = [SLIDE]
    if (c.emModelo) grupos.push(BIBLIA)
    grupos.push(RELOGIO)
    const nomes = (c.cronometros || []).filter((n) => typeof n === "string" && n.trim())
    if (nomes.length) grupos.push({ id: "cronometros", rotulo: "Cronômetros", opcoes: nomes.map((n) => op("cron:" + idDoCronometro(n), n, `{${idDoCronometro(n)}}`)) })
    grupos.push(MIDIA, PROJETO)
    return grupos
}

export const todasAsOpcoes = (grupos: GrupoLigado[]) => grupos.flatMap((g) => g.opcoes)

/** os trechos com texto da caixa, na ordem */
const trechos = (caixa: CaixaLigavel | null | undefined) =>
    (caixa?.lines || [])
        .flatMap((l) => l?.text || [])
        .map((t) => String(t?.value ?? ""))
        .filter((v) => v.length)

/**
 * O que a caixa mostra hoje: "nenhum" (texto escrito ou vazio), uma opcao da lista, ou "misto" (texto fixo junto com valor,
 * ou um valor que a lista nao tem: feito pelo botao direito; o painel nao mexe sem o operador pedir).
 */
export function lerLigacao(caixa: CaixaLigavel | null | undefined, opcoes: OpcaoLigada[]): { tipo: "nenhum" } | { tipo: "opcao"; opcao: OpcaoLigada } | { tipo: "misto"; texto: string } {
    const t = trechos(caixa)
    const junto = t.join("")
    if (!/\{[^}]+\}/.test(junto)) return { tipo: "nenhum" }
    const limpo = t.map((v) => v.trim()).filter(Boolean)
    const achada = opcoes.find((o) => o.partes.length === limpo.length && o.partes.every((p, i) => p.trim() === limpo[i]))
    if (achada) return { tipo: "opcao", opcao: achada }
    return { tipo: "misto", texto: junto }
}

/**
 * As linhas novas da caixa ligada a `opcao` (a caixa inteira, como no ProPresenter). Guarda o alinhamento e o estilo do 1o trecho
 * (fonte, tamanho, cor que o operador ja escolheu). "Versículo (com número)": o numero reaproveita o estilo do numero que a caixa ja tinha.
 * Nenhum = caixa vazia com o mesmo estilo.
 */
export function linhasLigadas(caixa: CaixaLigavel | null | undefined, opcao: OpcaoLigada): LinhaDeTexto[] {
    const linhas = caixa?.lines || []
    const primeira = linhas[0] || { align: "", text: [] }
    const todos = linhas.flatMap((l) => l?.text || [])
    const principal = todos.find((t) => t?.value && !/\{scripture\d*_number\}/.test(t.value)) || todos[0]
    const estilo = principal?.style || ""
    const doNumero = todos.find((t) => /\{scripture\d*_number\}/.test(t?.value || ""))?.style
    if (opcao.emLinhas)
        return opcao.partes.map((p, i) => {
            const antiga = linhas[i] || primeira
            const estiloDaLinha = (antiga.text || []).find((t) => t?.value)?.style ?? antiga.text?.[0]?.style ?? estilo
            return { align: antiga.align || primeira.align || "", text: [{ value: p, style: estiloDaLinha }] }
        })
    const text: TrechoDeTexto[] = opcao.partes.length ? opcao.partes.map((p) => ({ value: p, style: /\{scripture\d*_number\}/.test(p) ? (doNumero ?? estilo) : estilo })) : [{ value: "", style: estilo }]
    return [{ align: primeira.align || "", text }]
}

const temValor = (c: CaixaLigavel) => /\{[^}]+\}/.test(trechos(c).join(""))
const temBiblia = (itens: CaixaLigavel[]) => itens.some((c) => trechos(c).some((v) => v.includes("{scripture")))

/**
 * O aviso que o painel mostra embaixo da lista, por causa da regra do FreeShow ao aplicar um modelo (`mergeWithTemplate`, output.ts):
 * - modelo de Bíblia: o texto do slide nao entra; caixa sem valor fica vazia no telao;
 * - outros modelos: a letra cai nas caixas de texto pela ORDEM; se a 1a caixa estiver ligada, a letra apaga o valor.
 */
export function avisoDoModelo(c: { emModelo: boolean; itens: CaixaLigavel[]; indice: number; modoBiblia?: boolean }): { nivel: "info" | "alerta"; texto: string } | null {
    if (!c.emModelo) return null
    const caixa = c.itens[c.indice]
    if (!caixa || (caixa.type || "text") !== "text") return null
    const biblia = !!c.modoBiblia || temBiblia(c.itens)
    if (biblia) {
        if (temValor(caixa)) return null
        return { nivel: "info", texto: "Modelo de Bíblia: esta caixa não recebe o versículo. Sem um valor ligado, ela fica vazia no telão." }
    }
    const caixasDeTexto = c.itens.filter((x) => x && (x.type || "text") === "text")
    const ordem = caixasDeTexto.indexOf(caixa)
    if (ordem === 0 && temValor(caixa)) return { nivel: "alerta", texto: "Esta é a caixa LETRA do modelo: numa música, a letra cai nela e apaga o valor ligado. Ligue outra caixa, ou suba esta em Organizar itens." }
    const forma = !trechos(caixa).join("").trim() && /background/.test(String(caixa.style || ""))
    if (ordem === 0 && forma) return { nivel: "alerta", texto: "Esta forma ficou como caixa LETRA: numa música, a letra cai dentro dela. Por enquanto, a forma precisa ficar na frente da letra (mais acima em Organizar itens)." }
    if (ordem === 0) return { nivel: "info", texto: "Caixa LETRA: numa música, a letra cai aqui." }
    return null
}

/** forma: uma caixa de texto vazia com fundo (o "shape" do ProPresenter). Estilo CSS dos itens do FreeShow. */
export function estiloDaForma(tipo: "retangulo" | "circulo"): { [k: string]: string } {
    const base = { "background-color": "rgba(255,255,255,0.25)", left: "660px", top: "290px", width: "600px", height: "500px" }
    return tipo === "circulo" ? { ...base, width: "500px", left: "710px", "border-radius": "50%" } : base
}

/**
 * Qual caixa recebe a letra quando o modelo e aplicado numa musica (regra atual do FreeShow, `mergeWithTemplate`): a 1a caixa de texto
 * pela ordem dos itens. Modelo de Bíblia: nenhuma (o versiculo vem pelos valores ligados). Fora de modelo: -1.
 */
export function indiceDaLetra(c: { emModelo: boolean; itens: CaixaLigavel[]; modoBiblia?: boolean }): number {
    if (!c.emModelo || !!c.modoBiblia || temBiblia(c.itens || [])) return -1
    return (c.itens || []).findIndex((x) => x && (x.type || "text") === "text")
}
