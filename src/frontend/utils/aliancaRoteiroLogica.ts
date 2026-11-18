// Leiaute v2, roteiro: a montagem da arvore de cultos e das agendas que vivia em Projects.svelte (`ABAS`, `acharPlano`, `sortFolders` e a
// ordenacao), levada sem mudar de regra para uma funcao pura. Alimenta o SeletorDeCulto exatamente como antes.
import type { Tree } from "../../types/Projects"
import { AGENDAS } from "./agendas"
import { sortByName } from "../components/helpers/array"

export const ABAS = [{ id: "todos", nome: "Todos", pasta: "" }, ...AGENDAS.map((a) => ({ id: a.id, nome: a.nome, pasta: a.pasta }))]
export const CHAVE_ABA = "aliancashow.agendaAtiva"
// "Alianca" -> "Aliança" no cabecalho de grupo; pasta que nao e agenda fica como esta
const nomeDaRaiz = (pasta: string) => AGENDAS.find((a) => a.pasta === pasta)?.nome || pasta

export type EntradaDaArvore = {
    folders: { [id: string]: any }
    projects: { [id: string]: any }
    sorted: { projects?: { type?: string } } | null | undefined
    /** acesso do perfil a "projects" ({} sem perfil) */
    profile: { [id: string]: string | undefined }
    agenda: string
}

function acharPlano(itens: Tree[], agenda: string): Tree[] {
    const porPai: { [key: string]: Tree[] } = {}
    itens.forEach((a) => {
        if (!porPai[a.parent]) porPai[a.parent] = []
        porPai[a.parent].push(a)
    })

    const saida: Tree[] = []
    // na aba de uma agenda, so a raiz dela entra; em Todos, todas
    const raizDaAba = ABAS.find((a) => a.id === agenda)?.pasta || ""

    function percorrer(paiId: string, rotulo: string, profundidade: number, raiz: string) {
        if (profundidade > 20) return // trava contra pasta apontando para si mesma

        const filhos = porPai[paiId] || []
        const projetos = filhos.filter((a) => a.type !== "folder")
        const pastas = filhos.filter((a) => a.type === "folder")

        // projeto solto na raiz nao e de agenda nenhuma: so em Todos
        if (projetos.length && !(raizDaAba && !raiz)) {
            // Em Todos, Aliança e Impulso tem cada uma o seu "09-setembro":
            // o nome da agenda entra no cabecalho para nao parecer o mesmo mes
            const titulo = !raizDaAba && raiz && rotulo && rotulo !== raiz ? `${nomeDaRaiz(raiz)} · ${rotulo}` : rotulo
            if (titulo) saida.push({ id: "grupo:" + paiId, type: "grupo", name: titulo, parent: paiId, index: 0, path: "" } as any)
            // path vazio de proposito: o ProjectList so mostra um projeto
            // quando todas as pastas do caminho dele estao abertas, e aqui
            // nao ha mais pasta para abrir -- a lista e continua
            projetos.forEach((projeto) => saida.push({ ...projeto, index: 0, path: "" }))
        }

        pastas.forEach((pasta) => {
            const raizDela = raiz || pasta.name || ""
            if (raizDaAba && raizDela !== raizDaAba) return

            const dela = porPai[pasta.id] || []
            const soPastas = dela.length > 0 && dela.every((a) => a.type === "folder")
            percorrer(pasta.id, soPastas ? rotulo : pasta.name || "", profundidade + 1, raizDela)
        })
    }

    percorrer("/", "", 0, "")
    return saida
}

export function montarArvoreDeCultos(e: EntradaDaArvore): Tree[] {
    const { folders, projects, sorted, profile, agenda } = e
    const f = Object.entries(folders)
        .filter(([id, a]) => !a.deleted && profile[id] !== "none")
        .map(([id, folder]) => ({ ...folder, id, type: "folder" as const }))
    const p = Object.entries(projects)
        .filter(([_, a]) => !a.deleted)
        .map(([id, project]) => ({ ...project, parent: folders[project.parent] ? project.parent : "/", id, shows: [] as any }))

    const sortType = sorted?.projects?.type || "name"
    // sort by name regardless because project folders <= 0.9.5 doesn't have created date
    let sortedFolders = sortByName(f)
    let sortedProjects = sortByName(p)
    if (sortType === "created") {
        sortedFolders = sortedFolders.sort((a, b) => (b.created || 0) - (a.created || 0))
        sortedProjects = sortedProjects.sort((a, b) => (b.created || 0) - (a.created || 0))
    } else if (sortType === "modified") {
        sortedProjects = sortedProjects.sort((a, b) => (b.modified || 0) - (a.modified || 0))
    } else if (sortType === "name_des") {
        sortedFolders = sortedFolders.reverse()
        sortedProjects = sortedProjects.reverse()
    }
    // sort by archived state
    sortedProjects = sortedProjects.sort((a, b) => (!!a.archived === !!b.archived ? 0 : a.archived ? 1 : -1))

    // update parents (if folders are missing)
    let tree: Tree[] = [...(sortedFolders as any), ...sortedProjects].map((a: any) => ({ ...a, parent: !folders[a.parent] || folders[a.parent].deleted ? "/" : a.parent }))

    const folderSorted: Tree[] = []
    function sortFolders(parent = "/", index = 0, path = "") {
        const filtered = tree.filter((a) => a.parent === parent).map((a) => ({ ...a, index, path }))
        filtered.forEach((folder) => {
            const rootParentId = path.split("/")[0] || folder.id
            if (profile[rootParentId] === "none") return

            const isReadOnly = profile[rootParentId] === "read"
            folder.readOnly = isReadOnly
            folderSorted.push(folder)
            if (folder.type !== "folder") return

            sortFolders(folder.id, index + 1, path + folder.id + "/")
        })
    }
    sortFolders()
    tree = acharPlano(folderSorted, agenda)
    return tree
}
