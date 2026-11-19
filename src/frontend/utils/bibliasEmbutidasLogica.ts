/**
 * Logica pura do registro das Biblias embutidas (sem store, sem IPC): testavel.
 *
 * O instalador copia bundled-bibles/*.fsb para a pasta do usuario. O nome do
 * arquivo (sem .fsb) e o que o main usa para abrir a Biblia, entao o registro
 * em "scriptures" tem que carregar EXATAMENTE esse nome. Id e sigla saem do
 * arquivo: "Nova Versao Internacional (NVI).fsb" -> id "nvi", sigla "NVI".
 */

export type EntradaDoDisco = { name: string; embutida?: boolean }
export type Registro = { name: string; id?: string; customName?: string; copyright?: string; api?: boolean; collection?: unknown; [chave: string]: any }
export type Plano = {
    /** registros novos, na ordem em que entram (NVI primeiro: e a preferida num perfil novo) */
    registrar: { id: string; registro: Registro }[]
    /** registros antigos cujo nome nao casa com arquivo e que ganham o nome do arquivo embutido equivalente */
    corrigir: { id: string; name: string; customName: string }[]
    /** o que nao tem lugar: registro sem arquivo e sem equivalente embutido. Mostrado alto, nunca calado. */
    erros: string[]
}

const norm = (s: string) =>
    String(s || "")
        .trim()
        .toLowerCase()

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

export function planejarBibliasEmbutidas(noDisco: EntradaDoDisco[], registrados: { [id: string]: Registro }): Plano {
    const plano: Plano = { registrar: [], corrigir: [], erros: [] }
    const nomesNoDisco = new Set(noDisco.map((b) => norm(b.name)))
    const embutidas = ordenar(noDisco.filter((b) => b.embutida))
    const ids = new Set(Object.keys(registrados))
    const nomesRegistrados = new Set(Object.values(registrados).map((r) => norm(r?.name)))
    const consumidos = new Set<string>()

    for (const arquivo of embutidas) {
        const nome = arquivo.name
        // ja registrada (por quem for) com o nome certo: nada a fazer
        if (nomesRegistrados.has(norm(nome))) continue

        const sigla = siglaDoArquivo(nome)
        const idBase = idDoArquivo(nome)

        // registro antigo que e a mesma Biblia com outro nome (id "nvi"/nome "NVI"), cujo nome nao casa com arquivo nenhum
        const antigo = Object.entries(registrados).find(([id, r]) => !consumidos.has(id) && !r?.api && !r?.collection && !nomesNoDisco.has(norm(r?.name)) && (norm(id) === idBase || norm(r?.name) === norm(sigla) || norm(r?.id || "") === idBase))
        if (antigo) {
            consumidos.add(antigo[0])
            plano.corrigir.push({ id: antigo[0], name: nome, customName: antigo[1].customName || sigla })
            continue
        }

        let id = idBase
        while (ids.has(id)) id += "-embutida"
        ids.add(id)
        plano.registrar.push({ id, registro: { name: nome, id, customName: sigla } })
    }

    // o que sobrou sem arquivo (nem equivalente): erro alto
    for (const [id, r] of Object.entries(registrados)) {
        if (!r || r.api || r.collection || consumidos.has(id)) continue
        if (!nomesNoDisco.has(norm(r.name))) plano.erros.push(`A Bíblia "${r.customName || r.name}" está registrada, mas o arquivo "${r.name}.fsb" não existe em Documentos/AliancaShow/Bibles.`)
    }
    return plano
}
