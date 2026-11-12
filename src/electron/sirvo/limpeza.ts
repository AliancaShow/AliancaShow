// ----- AliançaShow · limpeza do material do Sirvo no disco (F5 do Show, v5) -----
//
// O servidor declara arquivos/versões MORTOS (show_material_retencao); 30 dias depois da morte, o
// Show manda o arquivo para a LIXEIRA do Windows (nunca unlink) e só quando nada o referencia.
// Quem dispara é o RENDERER, e só com saída vazia, nada tocando e fora do roteiroNoAr
// (aliancaSirvoMaterial.ts). Só mexe dentro de Online/Sirvo. Falha = fica, anotada.

import { dialog, shell } from "electron"
import fs from "fs"
import path from "path"
import { _store } from "../data/store"
import { getDataFolderPath } from "../utils/files"
import { candidatosALimpar, caminhosReferenciados, normCaminho, PASTA_DO_SIRVO, type Mortos, type PastaDoSirvo } from "./materialLogica"
import { sirvoChamarDoMain, sirvoSufixoDoAmbiente } from "./sirvo"

export type ResultadoLimpeza = { adiada: string | null; arquivos: number; bytes: number }

const raizDoSirvo = () => path.join(getDataFolderPath("onlineMedia"), PASTA_DO_SIRVO)
const chaveLixeira = () => "sirvo_lixeira" + sirvoSufixoDoAmbiente()
const SONDA = ".sonda-lixeira.txt"

/** as subpastas de Online/Sirvo e os arquivos diretos nelas (sem seguir link) */
export function lerArvore(raiz = raizDoSirvo()): PastaDoSirvo {
    const saida: PastaDoSirvo = []
    let pastas: fs.Dirent[] = []
    try {
        pastas = fs.readdirSync(raiz, { withFileTypes: true })
    } catch {
        return saida
    }
    for (const p of pastas) {
        if (!p.isDirectory()) continue
        const arquivos: PastaDoSirvo[number]["arquivos"] = []
        try {
            for (const f of fs.readdirSync(path.join(raiz, p.name), { withFileTypes: true })) {
                if (!f.isFile()) continue
                const caminho = path.join(raiz, p.name, f.name)
                const st = fs.statSync(caminho, { throwIfNoEntry: false })
                if (st) arquivos.push({ nome: f.name, caminho, mtimeMs: st.mtimeMs })
            }
        } catch {}
        saida.push({ pasta: p.name, arquivos })
    }
    return saida
}

export function bytesDaArvore(arvore: PastaDoSirvo): number {
    let n = 0
    for (const p of arvore) for (const f of p.arquivos) n += fs.statSync(f.caminho, { throwIfNoEntry: false })?.size || 0
    return n
}

/** "Testar a Lixeira": manda um arquivo de teste e pergunta ao operador se ele está lá. Grava a conferência PARA ESTE caminho. */
export async function testarLixeira(): Promise<{ ok: boolean; mensagem: string }> {
    const raiz = raizDoSirvo()
    try {
        fs.mkdirSync(raiz, { recursive: true })
        const sonda = path.join(raiz, SONDA)
        fs.writeFileSync(sonda, "teste da Lixeira do AliançaShow")
        await shell.trashItem(sonda)
        const r = await dialog.showMessageBox({ type: "question", buttons: ["Sim, está na Lixeira", "Não está"], defaultId: 0, cancelId: 1, title: "Testar a Lixeira", message: "Mandei o arquivo .sonda-lixeira.txt para a Lixeira. Ele está lá?" })
        if (r.response !== 0) return { ok: false, mensagem: "Lixeira não confirmada: a limpeza do material continua desligada." }
        _store.ACCESS?.set(chaveLixeira(), { lixeiraConferidaEm: Date.now(), caminho: normCaminho(raiz) })
        return { ok: true, mensagem: "Lixeira conferida." }
    } catch (erro) {
        return { ok: false, mensagem: "A Lixeira não aceitou o arquivo de teste: a limpeza do material continua desligada." }
    }
}

const lixeiraConferida = () => {
    const c = _store.ACCESS?.get(chaveLixeira()) as { lixeiraConferidaEm?: number; caminho?: string } | undefined
    return !!c?.lixeiraConferidaEm && c.caminho === normCaminho(raizDoSirvo())
}

/** os textos dos stores salvos que podem apontar para um arquivo (STAGE, THEMES, SYNCED_SETTINGS, OVERLAYS, TEMPLATES) e cada .show */
function textosParaVarrer(): string[] {
    const textos: string[] = []
    for (const k of ["SYNCED_SETTINGS", "THEMES", "STAGE", "OVERLAYS", "TEMPLATES"] as const) {
        try {
            textos.push(JSON.stringify(_store[k]?.store ?? {}))
        } catch {}
    }
    try {
        const pasta = getDataFolderPath("shows")
        for (const f of fs.readdirSync(pasta)) if (f.toLowerCase().endsWith(".show")) textos.push(fs.readFileSync(path.join(pasta, f), "utf8"))
    } catch {}
    return textos
}

export async function limparMaterial(vivos: string[], habilitado: boolean | null): Promise<ResultadoLimpeza> {
    const adia = (motivo: string): ResultadoLimpeza => ({ adiada: motivo, arquivos: 0, bytes: 0 })
    if (habilitado !== true) return adia("a chave não baixa material")
    if (!lixeiraConferida()) return adia("Lixeira não testada")
    const r = await sirvoChamarDoMain("show_material_retencao", {})
    const d: any = r.ok ? r.dados : null
    if (!r.ok || !d || !Array.isArray(d.arquivos) || !Array.isArray(d.versoes)) return adia("sem resposta do Sirvo")
    const mortos: Mortos = { arquivos: d.arquivos, versoes: d.versoes }

    const raiz = raizDoSirvo()
    const arvore = lerArvore(raiz)
    const agora = Date.now()
    const vivosNorm = new Set((Array.isArray(vivos) ? vivos : []).filter((v) => typeof v === "string").map(normCaminho))
    let candidatos = candidatosALimpar(arvore, mortos, vivosNorm, agora)
    if (!candidatos.length) return { adiada: null, arquivos: 0, bytes: 0 }

    const projetos = (_store.PROJECTS?.store as any)?.projects
    const referenciados = caminhosReferenciados(textosParaVarrer(), projetos, candidatos)
    candidatos = candidatos.filter((c) => !referenciados.has(c))

    let arquivos = 0
    let bytes = 0
    let falhas = 0
    const base = path.resolve(raiz) + path.sep
    for (const c of candidatos) {
        // só dentro de Online/Sirvo, um arquivo por vez, nunca a pasta
        if (!path.resolve(c).startsWith(base)) continue
        const tamanho = fs.statSync(c, { throwIfNoEntry: false })?.size || 0
        try {
            await shell.trashItem(c)
            arquivos++
            bytes += tamanho
        } catch {
            falhas++ // fica no disco; nunca unlink
        }
    }
    // pasta que ficou vazia sai (rmdir só remove vazia)
    for (const p of arvore) {
        try {
            fs.rmdirSync(path.join(raiz, p.pasta))
        } catch {}
    }
    return { adiada: falhas ? `${falhas} arquivo(s) não foram para a Lixeira` : null, arquivos, bytes }
}
