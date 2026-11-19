// Leiaute v2, fatia 5: os EFEITOS da busca Spotlight (Ctrl+K). A conta (referencia de versiculo, o que cada tecla faz, acoes do app) esta em
// aliancaSpotlightLogica.ts. Aqui: procurar nos stores e executar. Reaproveita as pecas que ja existem:
//   - shows: `listarBiblioteca` + `showSearch` (a mesma lista e a mesma busca da biblioteca), trecho da letra de `getTextSnippet`;
//   - midia e audio: `getMediaResults` (varre as pastas de midia e de audio);
//   - roteiro e ▶: `porShowNoFim` e `tocarShowNoAr` (utils/aliancaTocarNoAr.ts, o mesmo caminho do ▶ da biblioteca);
//   - versiculo: `openScripture` com `play` (o componente Scripture da pasta Biblia toca; respeita a saida travada).
// Trocar de tela so pela porta (`trocarTela(..., "spotlight")`) e so quando o resultado vive em outra tela (numa pagina do menu).
// Sem `.subscribe` no nivel do modulo (a janela de saida importa a arvore de stores).
import { get } from "svelte/store"
import { activeDrawerTab, activeEdit, activePopup, activeProfile, activeShow, audioFolders, categories, focusMode, mediaFolders, openScripture, outLocked, outputs, quickSearchActive, scriptures, settingsTab, shows, textCache, drawerTabsData } from "../stores"
import { loadJsonBible } from "../components/drawer/bible/scripture"
import { setDrawerTabData } from "../components/helpers/historyHelpers"
import { openShow } from "../components/helpers/show"
import { getMediaResults } from "../components/quicksearch/quicksearchData"
import { getTextSnippet } from "../components/quicksearch/searchHighlight"
import { porShowNoFim, executarComandoNovo } from "./aliancaBiblioteca"
import { listarBiblioteca, type LinhaDaBiblioteca } from "./aliancaBibliotecaLogica"
import { prepararEdicaoDoShow } from "./aliancaEditarAcoes"
import { falhaAlta } from "./aliancaFalha"
import { alternarTelaCheia, salvarAgora } from "./aliancaJanela"
import { acaoDaTecla, assinaturaDoTemp, conferirLivro, filtrarAcoes, lerReferencia, lerSoLivro, MAX_VERSICULOS, MAXIMO_POR_SECAO, rotuloDaReferencia, tocouNaBiblia, versiculosParaAbrir, type AcaoDeTecla, type ReferenciaBiblica, type TelaDoSpotlight, type TipoDeResultado } from "./aliancaSpotlightLogica"
import { MOTIVO_TRAVADA, tocarShowNoAr } from "./aliancaTocarNoAr"
import { telaAtual, trocarTela } from "./aliancaTela"
import { newToast } from "./common"
import { getAccess } from "./profile"
import { formatSearch, showSearch } from "./search"

export type Resultado = {
    /** unica na lista (a chave do {#each}) */
    chave: string
    tipo: TipoDeResultado
    titulo: string
    /** a linha de baixo: a categoria, o trecho da letra, o texto do versiculo */
    detalhe?: string
    icone?: string
    id: string
    /** so tipo "midia"/"audio": o tipo do arquivo para o `activeShow` */
    arquivo?: { nome: string; tipo: string }
    /** so tipo "versiculo" */
    versiculo?: { ref: ReferenciaBiblica; biblia: string; idDaVersao?: string; nomeDaBiblia: string; texto: string; motivo: string | null }
    /** so tipo "acao" */
    atalho?: string
}

const tela = (): TelaDoSpotlight => telaAtual()

// ---------------------------------------------------------------- procurar

/** musicas e apresentacoes: o que a biblioteca lista (sem privados, arquivados e o que o perfil nao ve), na ordem da busca da biblioteca */
export function buscarShows(consulta: string): Resultado[] {
    try {
        const q = consulta.trim()
        if (q.length < 2) return []
        const acesso = (get(activeProfile) ? getAccess("shows") : {}) as { [categoria: string]: string | undefined }
        const todos = get(shows)
        const base: LinhaDaBiblioteca[] = [...listarBiblioteca({ shows: todos, categorias: get(categories), acesso, tipo: "musicas", ehSemLetraDe: () => false }), ...listarBiblioteca({ shows: todos, categorias: get(categories), acesso, tipo: "apresentacoes", ehSemLetraDe: () => false })]
        const achados = showSearch(
            formatSearch(q),
            base.map((l) => ({ ...todos[l.id], id: l.id }))
        ).slice(0, MAXIMO_POR_SECAO.show)
        const cats = get(categories)
        return achados.map((a) => {
            const trecho = getTextSnippet(get(textCache)[a.id] || "", q)
            const cat = a.category && cats[a.category]?.name ? String(cats[a.category].name).replace(/^category\./, "") : ""
            return { chave: "show:" + a.id, tipo: "show" as const, titulo: a.name || "", detalhe: trecho || cat, icone: a.category && cats[a.category]?.icon ? cats[a.category].icon : "slide", id: a.id }
        })
    } catch (erro) {
        falhaAlta("spotlight-shows", erro)
        return []
    }
}

async function arquivosDe(consulta: string, pastas: { [id: string]: { path?: string } }, tipo: "midia" | "audio"): Promise<Resultado[]> {
    const caminhos = Object.values(pastas)
        .map((a) => a.path!)
        .filter(Boolean)
    if (!caminhos.length) return []
    const achados = (await getMediaResults(formatSearch(consulta), caminhos)).slice(0, MAXIMO_POR_SECAO[tipo])
    // a pasta de midia pode ter audio e vice-versa: cada secao fica com o seu tipo
    return achados
        .filter((a) => (tipo === "audio" ? a.data?.type === "audio" : a.data?.type !== "audio"))
        .map((a) => ({ chave: tipo + ":" + a.id, tipo, titulo: a.name, detalhe: String(a.id).replace(/[\\/][^\\/]*$/, ""), icone: a.icon, id: a.id, arquivo: { nome: a.data?.name || a.name, tipo: a.data?.type || "media" } }))
}

export async function buscarMidia(consulta: string): Promise<Resultado[]> {
    try {
        return consulta.trim().length < 2 ? [] : await arquivosDe(consulta, get(mediaFolders) as any, "midia")
    } catch (erro) {
        falhaAlta("spotlight-midia", erro)
        return []
    }
}

export async function buscarAudio(consulta: string): Promise<Resultado[]> {
    try {
        return consulta.trim().length < 2 ? [] : await arquivosDe(consulta, get(audioFolders) as any, "audio")
    } catch (erro) {
        falhaAlta("spotlight-audio", erro)
        return []
    }
}

export function buscarAcoes(consulta: string): Resultado[] {
    return filtrarAcoes(consulta, undefined, MAXIMO_POR_SECAO.acao).map((a) => ({ chave: "acao:" + a.id, tipo: "acao" as const, titulo: a.nome, id: a.id, icone: "settings", atalho: a.atalho }))
}

/** a Biblia que o Spotlight usa: a aba aberta na pasta Biblia (colecao = a versao de pre-visualizacao dela, a MESMA que o Scripture toca) ou, sem aba, a primeira instalada */
export function bibliaEmUso(): { aba: string; id: string; nome: string } | null {
    const todas = get(scriptures)
    // a aba da pasta Biblia pode estar velha (uma Biblia que saiu): cai para a primeira instalada, nunca diz "nenhuma Biblia" havendo uma (cabine 18/nov, A6)
    const ativa = get(drawerTabsData).scripture?.activeSubTab || ""
    const aba = ativa && todas[ativa] ? ativa : Object.keys(todas)[0] || ""
    if (!aba || !todas[aba]) return null
    const versoes = todas[aba]?.collection?.versions
    const id = versoes?.[todas[aba]?.collection?.previewIndex || 0] || versoes?.[0] || aba
    return { aba, id, nome: todas[aba]?.customName || todas[aba]?.name || id }
}

/** o que a busca diz, alto, quando nao ha nenhuma Biblia (o instalador sai sem Biblia se a pasta bundled-bibles/ estiver sem .fsb) */
export const MOTIVO_SEM_BIBLIA = "Nenhuma Bíblia instalada. Adicione uma em Importar (ou copie o .fsb para Documentos/AliancaShow/Bibles)."

/** "João", "Rom": falta o capitulo. Nunca calado: sem Biblia diz que nao ha Biblia; com Biblia diz como completar. So o nome do livro, sem Enter util. */
function buscarSoLivro(consulta: string): Resultado[] {
    const l = lerSoLivro(consulta)
    if (!l) return []
    const motivo = bibliaEmUso() ? `Falta o capítulo e o versículo: ${l.nome} 3:16` : MOTIVO_SEM_BIBLIA
    const ref = { livro: l.livro, nomeDoLivro: l.nome, capitulo: 0, versiculos: null }
    return [{ chave: "versiculo:livro:" + l.livro, tipo: "versiculo", titulo: l.nome, icone: "scripture", id: l.nome, detalhe: motivo, versiculo: { ref, biblia: "", nomeDaBiblia: "", texto: "", motivo } }]
}

/**
 * D1 (cabine 18/nov): TODAS as Biblias instaladas, com a Biblia em uso (a aba aberta na pasta Biblia) em PRIMEIRO: o Enter direto continua igual (abre a em uso);
 * ↓ ou clique escolhe outra. Uma entrada de `scriptures` que e colecao (varias versoes juntas) conta pela versao de pre-visualizacao, como em `bibliaEmUso`.
 */
export function bibliasInstaladas(): { aba: string; id: string; nome: string }[] {
    const todas = get(scriptures)
    const emUso = bibliaEmUso()
    if (!emUso) return []
    const lista = [emUso]
    for (const aba of Object.keys(todas)) {
        if (aba === emUso.aba || !todas[aba]) continue
        const versoes = todas[aba]?.collection?.versions
        const id = versoes?.[todas[aba]?.collection?.previewIndex || 0] || versoes?.[0] || aba
        lista.push({ aba, id, nome: todas[aba]?.customName || todas[aba]?.name || id })
    }
    return lista
}

/** "Rm 8:28" numa Biblia: o resultado de versiculo, com o texto lido dela. Sem esse livro/capitulo/versiculo: o resultado diz o motivo (Enter avisa, nunca cai calado). */
async function versiculoNaBiblia(ref: ReferenciaBiblica, biblia: { aba: string; id: string; nome: string }): Promise<Resultado> {
    const rotulo = rotuloDaReferencia(ref)
    const base = { chave: "versiculo:" + rotulo + ":" + biblia.aba, tipo: "versiculo" as const, titulo: rotulo, icone: "scripture", id: rotulo }
    const sem = (motivo: string): Resultado => ({ ...base, titulo: `${rotulo} · ${biblia.nome}`, detalhe: motivo, versiculo: { ref, biblia: biblia.aba, idDaVersao: biblia.id, nomeDaBiblia: biblia.nome, texto: "", motivo } })
    try {
        const bible = await loadJsonBible(biblia.id)
        if (!bible) return sem(`Não consegui abrir a Bíblia ${biblia.nome}`)
        // a biblioteca json-bible NAO recusa livro, capitulo ou versiculo que nao existe: cai calada no primeiro. A existencia se confere nos dados.
        const dadosDoLivro = bible.data.books.find((b) => Number(b.number) === ref.livro)
        if (!dadosDoLivro) return sem(`${ref.nomeDoLivro} não está na Bíblia ${biblia.nome}`)
        // o numero do livro nao basta: Biblia com outra numeracao mostraria o texto de outro livro sob o rotulo "Romanos"
        const conferencia = conferirLivro(String(dadosDoLivro.name || ""), ref.livro)
        if (conferencia.resultado === "outro") return sem(`O livro ${ref.livro} da Bíblia ${biblia.nome} é "${conferencia.nome}", não ${ref.nomeDoLivro}`)
        if (ref.versiculos && ref.versiculos[1] - ref.versiculos[0] + 1 > MAX_VERSICULOS) return sem(`São ${ref.versiculos[1] - ref.versiculos[0] + 1} versículos: o máximo de uma vez é ${MAX_VERSICULOS}. Peça um trecho menor.`)
        const dadosDoCapitulo = dadosDoLivro.chapters.find((c) => Number(c.number) === ref.capitulo)
        if (!dadosDoCapitulo) return sem(`${ref.nomeDoLivro} não tem o capítulo ${ref.capitulo}`)
        const temVersiculo = (v: number) => dadosDoCapitulo.verses.some((x) => Number(x.number) === v || (x.endNumber && v > Number(x.number) && v <= Number(x.endNumber)))
        const livro = await bible.getBook(ref.livro)
        const capitulo = await livro.getChapter(ref.capitulo)
        let texto = ""
        if (ref.versiculos) {
            const partes: string[] = []
            for (let v = ref.versiculos[0]; v <= ref.versiculos[1]; v++) {
                if (!temVersiculo(v)) return sem(`${ref.nomeDoLivro} ${ref.capitulo} não tem o versículo ${v}`)
                const verso = capitulo.getVerse(v)
                partes.push(
                    String(verso.getHTML?.() || "")
                        .replace(/<[^>]*>/g, "")
                        .trim()
                )
            }
            texto = partes.join(" ")
        }
        return { ...base, titulo: `${rotulo} · ${biblia.nome}`, detalhe: texto || "Abre o capítulo na pasta Bíblia", versiculo: { ref, biblia: biblia.aba, idDaVersao: biblia.id, nomeDaBiblia: biblia.nome, texto, motivo: null } }
    } catch (erro) {
        falhaAlta("spotlight-versiculo", erro)
        return sem("Não consegui ler esse versículo")
    }
}

/** quanto cada Biblia tem para abrir antes de a linha dela dizer "nao carregou" (revisao do PR #40, achado 3): uma .fsb grande ou uma API sem rede nao prende a busca */
export const PRAZO_BIBLIA_MS = 1500

/** a leitura da Biblia com prazo: estourou, vira a linha de aviso dela (Enter nela avisa e nao abre nada) */
function comPrazo(ref: ReferenciaBiblica, biblia: { aba: string; id: string; nome: string }, prazo = PRAZO_BIBLIA_MS): Promise<Resultado> {
    const rotulo = rotuloDaReferencia(ref)
    const motivo = `A Bíblia ${biblia.nome} não carregou em ${prazo / 1000} s`
    const estourou: Resultado = { chave: "versiculo:" + rotulo + ":" + biblia.aba, tipo: "versiculo", titulo: `${rotulo} · ${biblia.nome}`, icone: "scripture", id: rotulo, detalhe: motivo, versiculo: { ref, biblia: biblia.aba, idDaVersao: biblia.id, nomeDaBiblia: biblia.nome, texto: "", motivo } }
    let relogio: ReturnType<typeof setTimeout> | undefined
    const limite = new Promise<Resultado>((resolve) => (relogio = setTimeout(() => resolve(estourou), prazo)))
    return Promise.race([versiculoNaBiblia(ref, biblia), limite]).finally(() => clearTimeout(relogio))
}

/**
 * "Rm 8:28": UM resultado por Biblia instalada (a em uso primeiro, cada um com o trecho do texto dela). Sem nenhuma Biblia: diz isso, alto.
 * Em PARTES: `primeiro` e o que pinta (so a Biblia em uso, com prazo), `demais` sao as outras Biblias, cada uma com o prazo dela: musicas e a 1a Biblia
 * nao esperam as outras (achado 3 do PR #40).
 */
export function buscarVersiculoEmPartes(consulta: string): { primeiro: Promise<Resultado[]>; demais: Promise<Resultado>[] } {
    const ref = lerReferencia(consulta)
    if (!ref) return { primeiro: Promise.resolve(buscarSoLivro(consulta)), demais: [] }
    const biblias = bibliasInstaladas()
    if (!biblias.length) {
        const rotulo = rotuloDaReferencia(ref)
        return { primeiro: Promise.resolve([{ chave: "versiculo:" + rotulo, tipo: "versiculo", titulo: rotulo, icone: "scripture", id: rotulo, detalhe: MOTIVO_SEM_BIBLIA, versiculo: { ref, biblia: "", nomeDaBiblia: "", texto: "", motivo: MOTIVO_SEM_BIBLIA } }]), demais: [] }
    }
    return { primeiro: comPrazo(ref, biblias[0]).then((r) => [r]), demais: biblias.slice(1).map((b) => comPrazo(ref, b)) }
}

// ---------------------------------------------------------------- executar

/** o que Enter / Ctrl+Enter faz com o resultado nesta tela (a regra pura esta em aliancaSpotlightLogica.ts) */
export function acaoDoResultado(r: Resultado, alternativa: boolean): AcaoDeTecla | null {
    return acaoDaTecla(r.tipo, tela(), alternativa, !!r.versiculo && !r.versiculo.motivo && !!r.versiculo.ref.versiculos)
}

/** para Mostrar antes de abrir algo que vive nela (o resultado vive em Mostrar ou em Editar; numa pagina do menu nao ha onde abrir) */
function paraAOndeVive(): void {
    if (tela() === "pagina") trocarTela("show", "spotlight")
}

/** prazo para a outra Biblia tocar antes de a em uso voltar de qualquer jeito (o componente Scripture carrega e toca em ~1 s) */
export const PRAZO_VOLTAR_BIBLIA_MS = 6000

/**
 * Escolher a OUTRA Biblia para TOCAR vale so para aquele versiculo (achado 3 do PR #40): o componente Scripture precisa da aba dela aberta para tocar, entao
 * a aba em uso volta assim que o slide dela esta no ar (ou no prazo, se nada tocou). Quem so ABRE (Ctrl+Enter) fica na Biblia que escolheu: ali e navegacao.
 */
function devolverABibliaEmUso(emUso: string, alvo: string): void {
    const antes = assinaturaDoTemp(Object.values(get(outputs)) as any[])
    let feito = false
    let parar = () => {}
    const voltar = () => {
        if (feito) return
        feito = true
        parar()
        if (get(drawerTabsData).scripture?.activeSubTab === alvo) setDrawerTabData("scripture", emUso)
    }
    parar = outputs.subscribe((o) => {
        if (tocouNaBiblia(antes, assinaturaDoTemp(Object.values(o) as any[]), alvo)) setTimeout(voltar, 400)
    })
    setTimeout(voltar, PRAZO_VOLTAR_BIBLIA_MS)
}

/** abre a pasta Biblia no versiculo; com `tocar` o componente da Biblia manda ao ar (respeita a trava dele) */
function irParaOVersiculo(r: Resultado, tocar: boolean): void {
    const v = r.versiculo!
    paraAOndeVive()
    if (get(focusMode)) focusMode.set(false)
    const emUso = bibliaEmUso()?.aba || ""
    if (get(drawerTabsData).scripture?.activeSubTab !== v.biblia) {
        setDrawerTabData("scripture", v.biblia)
        if (tocar && emUso && emUso !== v.biblia) devolverABibliaEmUso(emUso, v.biblia)
    }
    activeDrawerTab.set("scripture")
    openScripture.set({ book: v.ref.livro, chapter: v.ref.capitulo, verses: versiculosParaAbrir(v.ref), play: tocar })
}

const ABRIR_CONFIGURACAO: { [id: string]: string } = { settings: "general", display_settings: "display_settings", styles: "styles", connection: "connection" }

function executarAcaoDoApp(id: string): void {
    if (id in ABRIR_CONFIGURACAO) {
        settingsTab.set(ABRIR_CONFIGURACAO[id] as any)
        trocarTela("settings", "spotlight")
    } else if (id === "stage") trocarTela("stage", "spotlight")
    else if (id === "save") salvarAgora()
    else if (id === "fullscreen") alternarTelaCheia()
    else if (id === "import" || id === "export" || id === "history" || id === "shortcuts" || id === "about") activePopup.set(id)
    else if (id === "nova_musica") executarComandoNovo("musica")
    else if (id === "varias_musicas") executarComandoNovo("varias")
    else if (id === "nova_apresentacao") executarComandoNovo("apresentacao")
    else falhaAlta("spotlight-acao", `acao do app desconhecida: ${id}`)
}

/**
 * Faz a acao e devolve se a busca deve FECHAR. Recusa (saida travada, versiculo que nao existe) devolve false: a busca fica aberta, o aviso aparece,
 * e o operador pode tentar de novo ou usar Ctrl+Enter para so abrir. Enter em Mostrar com a saida travada nunca vai ao ar.
 */
export async function executarResultado(r: Resultado, acao: AcaoDeTecla): Promise<boolean> {
    try {
        if (acao === "executar") {
            quickSearchActive.set(false)
            executarAcaoDoApp(r.id)
            return true
        }
        if (acao === "tocar") {
            if (get(outLocked)) {
                newToast(MOTIVO_TRAVADA)
                return false
            }
            quickSearchActive.set(false)
            await tocarShowNoAr(r.id)
            return true
        }
        if (acao === "roteiro") {
            quickSearchActive.set(false)
            const dentro = porShowNoFim(r.id)
            if (!dentro.entrou && dentro.motivo) newToast(`Não entrou no roteiro: ${dentro.motivo}`)
            // Mostrar: abre o show no centro (o Enter da busca da biblioteca fazia o mesmo); Editar fica onde esta
            if (tela() !== "editar") {
                paraAOndeVive()
                openShow(r.id)
            }
            return true
        }
        if (acao === "abrir-show") {
            quickSearchActive.set(false)
            paraAOndeVive()
            openShow(r.id)
            return true
        }
        if (acao === "abrir-editar") {
            quickSearchActive.set(false)
            // o show entra no seletor do editor como "Aberto da biblioteca" (AliancaItemEditando), sem pôr no roteiro
            prepararEdicaoDoShow(r.id)
            return true
        }
        if (acao === "abrir-midia") {
            quickSearchActive.set(false)
            const a = r.arquivo!
            // o mesmo que o QuickSearch antigo fazia: so audio (e o tipo "media") ganha editor proprio; imagem e video so abrem no centro
            if (a.tipo === "media" || a.tipo === "audio") activeEdit.set({ id: r.id, type: a.tipo === "audio" ? "audio" : "media", items: [] } as any)
            paraAOndeVive()
            activeShow.set({ id: r.id, type: a.tipo, name: a.nome } as any)
            if (get(focusMode)) focusMode.set(false)
            return true
        }
        if (acao === "ao-ar" || acao === "abrir-biblia") {
            const v = r.versiculo
            if (!v || v.motivo) {
                newToast(v?.motivo || "Versículo não encontrado")
                return false
            }
            if (acao === "ao-ar" && get(outLocked)) {
                newToast(MOTIVO_TRAVADA)
                return false
            }
            // a Biblia que o Scripture vai tocar tem de estar carregada ANTES: senao o "ao ar" dele toca a referencia antiga (ou Genesis 1:1) e ninguem avisa
            try {
                if (v.idDaVersao && !(await loadJsonBible(v.idDaVersao))) throw new Error("sem dados")
            } catch (erro) {
                falhaAlta("spotlight-biblia", erro)
                newToast(`A Bíblia ${v.nomeDaBiblia} ainda não carregou: nada foi aberto. Tente de novo.`)
                return false
            }
            quickSearchActive.set(false)
            irParaOVersiculo(r, acao === "ao-ar")
            return true
        }
        falhaAlta("spotlight-acao", `acao de tecla desconhecida: ${acao}`)
        return false
    } catch (erro) {
        falhaAlta("spotlight-executar", erro)
        return false
    }
}
