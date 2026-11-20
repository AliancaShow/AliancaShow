// ----- AliançaShow · cabine-5 (André, 19/nov): a biblioteca de mídia (stores, IPC, histórico) -----
// A conta mora em `aliancaBibliotecaMidiaLogica.ts`. Só roda na janela principal (a gaveta de Mídia não existe na saída).
import { get } from "svelte/store"
import { uid } from "uid"
import { Main } from "../../types/IPC/Main"
import { history } from "../components/helpers/history"
import { requestMain } from "../IPC/main"
import { activePage, loadedState, media, mediaFolders, mediaTags, special } from "../stores"
import { newToast } from "./common"
import { falhaAlta } from "./aliancaFalha"
import { aceitarNaFoto } from "./aliancaConfigRascunho"
import { capturar } from "./aliancaPastasMidiaLogica"
import { BIB, caminhosDaBiblioteca, idDaCategoria, chaveNoMedia, ehVideoOuImagem, indiceDoMedia, naBiblioteca, pastaJaMigrada, planejarPasta, tagsAoImportar, tagsAoTirar, type PlanoDeMigracao } from "./aliancaBibliotecaMidiaLogica"

export { BIB }

// ---------------------------------------------------------------- ações com Ctrl+Z (histórico MEDIA_PASTA: guarda e repõe `tags`)

function registrar(caminhos: string[], novas: { [caminho: string]: string[] }) {
    const antes = capturar({ mediaTags: get(mediaTags), media: get(media) }, [], caminhos)
    const midia: { [c: string]: { tags: string[] } } = {}
    for (const c of caminhos) midia[c] = { tags: novas[c] }
    history({ id: "MEDIA_PASTA", oldData: antes, newData: { midia }, location: { page: "drawer" } })
}

/** importa (registra, nunca copia) para a categoria, ou para a raiz (null). Devolve quantas entraram */
export function importarCaminhos(caminhos: string[], categoria: string | null): number {
    const m = get(media)
    const indice = indiceDoMedia(m)
    const unicos = Array.from(new Set(caminhos.filter((c) => c && ehVideoOuImagem(c)).map((c) => chaveNoMedia(m, c, indice))))
    if (!unicos.length) return 0
    const t = get(mediaTags)
    const novas: { [c: string]: string[] } = {}
    for (const c of unicos) novas[c] = tagsAoImportar(m[c]?.tags, t, categoria)
    registrar(unicos, novas)
    return unicos.length
}

/** "Tirar da biblioteca": some do programa, o arquivo fica no disco. Shows e roteiros que usam a mídia não mudam */
export function tirarDaBiblioteca(caminhos: string[]): number {
    const m = get(media)
    const alvo = Array.from(new Set(caminhos.filter((c) => naBiblioteca(m[c]?.tags))))
    if (!alvo.length) return 0
    const t = get(mediaTags)
    const novas: { [c: string]: string[] } = {}
    for (const c of alvo) novas[c] = tagsAoTirar(m[c]?.tags, t)
    registrar(alvo, novas)
    newToast(`${alvo.length} ${alvo.length === 1 ? "mídia tirada" : "mídias tiradas"} da biblioteca (o arquivo continua no computador) · Ctrl+Z desfaz`)
    return alvo.length
}

/**
 * "Apagar do computador" (aprovado pelo André 19/nov): cada arquivo vai para a Lixeira do Windows depois da caixa de confirmacao NATIVA
 * (quem decide e o processo principal). O que foi apagado sai da biblioteca; falha fala alto.
 */
export async function apagarDoComputador(caminhos: string[]): Promise<number> {
    const apagados: string[] = []
    for (const c of Array.from(new Set(caminhos.filter(Boolean)))) {
        const r = await requestMain(Main.ALIANCA_LIXEIRA, { caminho: c })
        if (!r) {
            falhaAlta("biblioteca-midia", `a Lixeira nao respondeu: ${c}`)
            continue
        }
        if (r.ok) apagados.push(c)
        else if (r.mensagem) falhaAlta("biblioteca-midia", r.mensagem)
    }
    if (apagados.length) {
        esquecerExistencia()
        tirarDaBiblioteca(apagados)
        newToast(`${apagados.length} ${apagados.length === 1 ? "arquivo foi" : "arquivos foram"} para a Lixeira do Windows`)
    }
    return apagados.length
}

// ---------------------------------------------------------------- leitura do disco (falha ALTA: nada de categoria vazia calada)

/** vídeos e imagens de uma pasta, com as subpastas (achatadas). Lança se o disco não respondeu */
export async function arquivosDaPasta(caminho: string): Promise<string[]> {
    const data = await requestMain(Main.READ_FOLDER, { path: [caminho], depth: 30 })
    if (!data) throw new Error(`a pasta não respondeu (OneDrive offline? rede?): ${caminho}`)
    return Object.values(data)
        .filter((a: any) => !a.isFolder && ehVideoOuImagem(a.path))
        .map((a: any) => a.path)
}

/** existe no disco? cache da sessão por caminho (a lista pergunta muito); `esquecer` limpa para reconferir */
const existeCache = new Map<string, boolean>()
export async function existe(caminho: string): Promise<boolean> {
    if (/^https?:/i.test(caminho)) return true
    if (existeCache.has(caminho)) return existeCache.get(caminho)!
    const info = await requestMain(Main.FILE_INFO, caminho)
    const sim = !!info
    existeCache.set(caminho, sim)
    return sim
}
export const esquecerExistencia = () => existeCache.clear()

/** solta do Explorer: arquivo vai para `categoria` (ou raiz); PASTA vira categoria nova com o nome dela (decisão do André) */
export async function importarSoltos(caminhos: string[], categoria: string | null): Promise<void> {
    const arquivos: string[] = []
    let n = 0
    for (const c of caminhos) {
        const info = await requestMain(Main.FILE_INFO, c)
        if (!info) {
            falhaAlta("biblioteca-midia", `não consegui ler o que foi solto: ${c}`)
            continue
        }
        if (!info.folder) {
            arquivos.push(c)
            continue
        }
        const nome = c.split(/[\\/]/).filter(Boolean).pop() || "Pasta"
        let lista: string[]
        try {
            lista = await arquivosDaPasta(c)
        } catch (e) {
            falhaAlta("biblioteca-midia", e)
            continue
        }
        if (!lista.length) {
            newToast(`a pasta "${nome}" não tem vídeo nem imagem`)
            continue
        }
        const id = criarCategoria(nome)
        n += importarCaminhos(lista, id)
    }
    n += importarCaminhos(arquivos, categoria)
    if (n) newToast(`${n} ${n === 1 ? "mídia importada" : "mídias importadas"} (os arquivos ficam onde estão)`)
    else if (arquivos.length) newToast("nenhum vídeo ou imagem no que foi solto")
}

/** a categoria (pelo nome, sem diferenciar maiúsculas) ou uma nova "frente, para no fim" (padrão de pasta solta) */
function criarCategoria(nome: string): string {
    const t = get(mediaTags)
    const ja = Object.entries(t).find(([, tag]: any) => tag?.aliancaPasta && (tag.name || "").trim().toLowerCase() === nome.trim().toLowerCase())
    if (ja) return ja[0]
    const id = uid()
    const antes = capturar({ mediaTags: t, media: get(media) }, [id], [])
    history({ id: "MEDIA_PASTA", oldData: antes, newData: { mediaTags: { [id]: { name: nome, color: "", aliancaPasta: { fim: "parar", camada: "frente" } } } }, location: { page: "drawer" } })
    if (get(activePage) !== "settings") aceitarNaFoto("mediaTags")
    return id
}

// ---------------------------------------------------------------- migração (uma vez por pasta do disco; fora do histórico)

let migrando = false
const inicio = Date.now()

/** os dados já chegaram? (`loaded` vira true antes dos dados; o `media` chega sozinho por IPC) */
function dadosProntos(): boolean {
    if (!get(loadedState).includes("synced_settings")) return false
    if (!Object.keys(get(mediaFolders)).length) return false
    // `media` vazio pode ser "ainda não chegou": só confia depois de 15 s de app aberto
    return Object.keys(get(media)).length > 0 || Date.now() - inicio > 15000
}

/**
 * Cada pasta do disco que ainda não virou categoria vira (decisão do André, 19/nov). Chamada ao abrir a Mídia.
 * Fora do histórico (um Ctrl+Z não pode desfazer a migração inteira). Confere depois que gravou; se o disco
 * sobrescreveu o `media`, tira a marca e quebra ALTO (roda de novo na próxima vez).
 */
export async function migrarPastasDoDisco(): Promise<void> {
    if (migrando || !dadosProntos() || get(activePage) === "settings") return
    // cabine-5 (aprovado pelo André 19/nov, "aprovo 2A"): arquivo sumido nao toca OUTRO de mesmo nome achado nas pastas do disco
    // (as pastas continuam no store, escondidas). Uma vez so: se alguem religar em Informacoes da midia, fica religado.
    if (!get(special).aliancaAutoLocalizarDecidido) {
        special.update((a) => ({ ...a, autoLocateMedia: false, aliancaAutoLocalizarDecidido: true }))
        aceitarNaFoto("special")
    }
    const pendentes = Object.entries(get(mediaFolders))
        .map(([id, f]: any) => ({ id, ...f }))
        .filter((p) => p.path && !pastaJaMigrada(get(mediaTags), p.id))
    if (!pendentes.length) return
    migrando = true
    try {
        let plano: PlanoDeMigracao | undefined
        for (const p of pendentes) {
            let arquivos: string[]
            try {
                arquivos = await arquivosDaPasta(p.path)
            } catch (e) {
                falhaAlta("biblioteca-midia", e)
                continue
            }
            plano = planejarPasta(p, arquivos, { media: get(media), mediaTags: get(mediaTags) }, (nome) => (get(mediaTags)[idDaCategoria(nome)] ? uid() : idDaCategoria(nome)), plano)
        }
        if (!plano || (!Object.keys(plano.midia).length && !Object.keys(plano.mediaTags).length)) return
        const p = plano
        // a leitura do disco demora: se Configuracoes abriu no meio, nao grava agora (o rascunho dela ja tirou a foto); roda de novo ao sair
        if (get(activePage) === "settings") return

        mediaTags.update((t) => {
            for (const [id, tag] of Object.entries(p.mediaTags)) t[id] = tag
            return t
        })
        media.update((m) => {
            for (const [c, tags] of Object.entries(p.midia)) m[c] = { ...(m[c] || {}), tags }
            return m
        })
        // gravou sozinho, fora de Configuracoes: nao e "alteracao nao salva" no rascunho dela
        aceitarNaFoto("mediaTags")
        const n = Object.keys(p.midia).length

        // confere: o `media` do disco não pode ter chegado por cima
        await new Promise((r) => setTimeout(r, 3000))
        const m = get(media)
        const perdidas = Object.keys(p.midia).filter((c) => !naBiblioteca(m[c]?.tags))
        if (perdidas.length) {
            mediaTags.update((t) => {
                for (const id of Object.keys(p.mediaTags)) if (t[id]) (t[id] as any).aliancaDeDisco = ((t[id] as any).aliancaDeDisco || []).filter((x: string) => !p.migradas.includes(x))
                return t
            })
            aceitarNaFoto("mediaTags")
            falhaAlta("biblioteca-midia", `a migração das pastas do disco não ficou gravada (${perdidas.length} de ${n}); tenta de novo ao abrir a Mídia`)
            return
        }
        if (n) newToast(`${n} mídias das pastas do computador viraram categorias da biblioteca`)
    } finally {
        migrando = false
    }
}

/** Ctrl+K: o que está na biblioteca */
export const bibliotecaAgora = () => caminhosDaBiblioteca(get(media))
