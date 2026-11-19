/**
 * Logica pura do registro das Biblias embutidas (sem store, sem IPC): testavel.
 *
 * O instalador copia bundled-bibles/*.fsb para a pasta do usuario. O nome do
 * arquivo (sem .fsb) e o que o main usa para abrir a Biblia, entao o registro
 * em "scriptures" tem que carregar EXATAMENTE esse nome. Id e sigla saem do
 * arquivo: "Nova Versao Internacional (NVI).fsb" -> id "nvi", sigla "NVI".
 */

export type EntradaDoDisco = { name: string; embutida?: boolean; legado?: boolean }
export type Registro = { name: string; id?: string; customName?: string; copyright?: string; api?: boolean; collection?: unknown; [chave: string]: any }
export type Plano = {
    /** registros novos, na ordem em que entram (NVI primeiro: e a preferida num perfil novo) */
    registrar: { id: string; registro: Registro }[]
    /** registros antigos cujo nome nao casa com arquivo e que ganham o nome do arquivo embutido equivalente */
    corrigir: { id: string; name: string; customName: string; copyright?: string }[]
    /** o que nao tem lugar: registro sem arquivo e sem equivalente embutido. Mostrado alto, nunca calado. */
    erros: string[]
}

const norm = (s: string) =>
    String(s || "")
        .trim()
        .toLowerCase()
        .replace(/\.fsb$/, "")

/** atribuicao de licenca que o registro carrega (por id) */
const COPYRIGHTS: { [id: string]: string } = { nvi: "Nova Versão Internacional © Biblica, Inc." }

/** "Nova Versao Internacional (NVI)" -> "NVI"; sem parenteses, o nome inteiro */
export function siglaDoArquivo(nome: string): string {
    const m = /\(([^()]{1,20})\)\s*$/.exec(nome)
    return (m ? m[1] : nome).trim()
}

export function idDoArquivo(nome: string): string {
    return (
        norm(siglaDoArquivo(nome))
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || "biblia"
    )
}

/** a NVI vem primeiro (preferida padrao); o resto em ordem alfabetica */
function ordenar(embutidas: EntradaDoDisco[]) {
    return [...embutidas].sort((a, b) => {
        const pa = idDoArquivo(a.name) === "nvi" ? 0 : 1
        const pb = idDoArquivo(b.name) === "nvi" ? 0 : 1
        return pa - pb || a.name.localeCompare(b.name)
    })
}

/** a Biblia (local) registrada e a mesma da embutida: mesmo id, mesma sigla no nome/customName */
function mesmaBiblia(id: string, r: Registro, idBase: string, sigla: string) {
    return norm(id) === idBase || norm(r?.id || "") === idBase || norm(r?.name) === norm(sigla) || norm(r?.customName || "") === norm(sigla) || idDoArquivo(r?.name) === idBase
}

export function planejarBibliasEmbutidas(noDisco: EntradaDoDisco[], registrados: { [id: string]: Registro }): Plano {
    const plano: Plano = { registrar: [], corrigir: [], erros: [] }
    const nomesNoDisco = new Set(noDisco.map((b) => norm(b.name)))
    const embutidas = ordenar(noDisco.filter((b) => b.embutida))
    const ids = new Set(Object.keys(registrados))
    const nomesRegistrados = new Set(Object.values(registrados).map((r) => norm(r?.name)))
    const consumidos = new Set<string>()
    const locais = () => Object.entries(registrados).filter(([, r]) => r && !r.api && !r.collection)

    for (const arquivo of embutidas) {
        const nome = arquivo.name
        // ja registrada (por quem for) com o nome certo: nada a fazer
        if (nomesRegistrados.has(norm(nome))) continue

        const sigla = siglaDoArquivo(nome)
        const idBase = idDoArquivo(nome)
        const candidatos = locais().filter(([id, r]) => !consumidos.has(id) && mesmaBiblia(id, r, idBase, sigla))

        // "ja tenho": registro da mesma Biblia cujo arquivo existe e e equivalente (NVI.fsb ~ Nova Versao Internacional (NVI).fsb).
        // Arquivo existente de OUTRA Biblia (importada a mao) nao conta: id/sigla ocupados por ela nao sao "tenho".
        if (candidatos.some(([, r]) => nomesNoDisco.has(norm(r.name)) && idDoArquivo(r.name) === idBase)) continue

        // registro antigo da mesma Biblia, sem arquivo nenhum: ganha o nome do arquivo embutido
        const antigo = candidatos.find(([, r]) => !nomesNoDisco.has(norm(r.name)))
        if (antigo) {
            consumidos.add(antigo[0])
            const cr = antigo[1].copyright ? undefined : COPYRIGHTS[idBase]
            plano.corrigir.push({ id: antigo[0], name: nome, customName: antigo[1].customName || sigla, ...(cr ? { copyright: cr } : {}) })
            continue
        }

        let id = idBase
        while (ids.has(id)) id += "-embutida"
        ids.add(id)
        plano.registrar.push({ id, registro: { name: nome, id, customName: sigla, ...(COPYRIGHTS[idBase] ? { copyright: COPYRIGHTS[idBase] } : {}) } })
    }

    // o que sobrou sem arquivo (nem equivalente): erro alto. ".fsb" no nome e a pasta legada (Documentos/Bibles, marcada legado) contam como existentes.
    for (const [id, r] of Object.entries(registrados)) {
        if (!r || r.api || r.collection || consumidos.has(id)) continue
        if (!nomesNoDisco.has(norm(r.name))) plano.erros.push(`A Bíblia "${r.customName || r.name}" está registrada, mas o arquivo "${String(r.name).replace(/\.fsb$/i, "")}.fsb" não existe em Documentos/AliancaShow/Bibles.`)
    }
    return plano
}

type AvisoDeps = { definirMensagem: (m: string) => void; abrirPopup: () => void; popupAtual: () => string | null | undefined }

/** Mostra o erro ao operador (mensagem + popup "alert"). Nao atropela outro popup aberto (ex.: o da primeira execucao): devolve false para tentar de novo. */
export function avisarErros(erros: string[], jaAvisados: Set<string>, deps: AvisoDeps): boolean {
    const novos = erros.filter((e) => !jaAvisados.has(e))
    if (!novos.length) return true
    if (deps.popupAtual()) return false
    novos.forEach((e) => jaAvisados.add(e))
    deps.definirMensagem(novos.join("<br>"))
    deps.abrirPopup()
    return true
}
