// Rodada da cabine 18/nov, C1: a duracao no canto do cartao. O FreeShow so a le quando o video carrega ao passar o mouse; aqui cada arquivo e lido UMA vez
// (so os metadados, duas leituras por vez) e fica no cache da sessao.
import { encodeFilePath } from "../components/helpers/media"
import { criarCacheDeDuracao } from "./aliancaMidiaCartaoLogica"

function lerMetadados(caminho: string): Promise<number> {
    return new Promise((resolve) => {
        const v = document.createElement("video")
        const fim = (d: number) => {
            v.onloadedmetadata = null
            v.onerror = null
            v.removeAttribute("src")
            v.load()
            resolve(d)
        }
        const t = setTimeout(() => fim(0), 8000)
        v.preload = "metadata"
        v.muted = true
        v.onloadedmetadata = () => (clearTimeout(t), fim(Number.isFinite(v.duration) ? v.duration : 0))
        v.onerror = () => (clearTimeout(t), fim(0))
        v.src = encodeFilePath(caminho)
    })
}

export const duracaoDeMidia = criarCacheDeDuracao(lerMetadados, 2)
