// Cabine 6 (Andre, 23/nov): quem pergunta ao disco se a midia existe, na JANELA PRINCIPAL, antes de mandar ao ar (sem mexer no fecho: usa o
// canal que ja existe, DOES_MEDIA_EXIST, via doesMediaExist). A biblioteca pergunta uma vez por arquivo e por pasta aberta (o X aparece antes do
// clique); o clique pergunta de novo, na hora. A conta pura mora em aliancaMidiaSumidaLogica.ts.
import { writable } from "svelte/store"
import { doesMediaExist, isLocalFile } from "../components/helpers/media"
import { avisar, resolverAviso } from "./aliancaAvisos"
import { avisoDeOffline, chaveDeOffline, chaveDeVerificacao, decidirMidia, type DecisaoMidia } from "./aliancaMidiaSumidaLogica"
import { falhaAlta } from "./aliancaFalha"

/** os caminhos que o disco disse que nao existem (o cartao desenha o X) */
export const midiasOffline = writable<Set<string>>(new Set())

const cache = new Map<string, Promise<boolean>>()
let estado = { vista: null as string | null, geracao: 0 }

function marcar(caminho: string, existe: boolean) {
    midiasOffline.update((s) => {
        if (existe === !s.has(caminho)) return s
        const n = new Set(s)
        if (existe) n.delete(caminho)
        else n.add(caminho)
        return n
    })
    // o arquivo voltou: o aviso persistente sai sozinho
    if (existe) resolverAviso(chaveDeOffline(caminho))
}

async function perguntar(caminho: string): Promise<boolean> {
    try {
        const existe = await doesMediaExist(caminho, true)
        marcar(caminho, existe)
        return existe
    } catch (e) {
        falhaAlta("midia-existe", e)
        throw e
    }
}

/** biblioteca: uma pergunta por arquivo na pasta (vista) aberta; trocar de pasta pergunta de novo */
export function conferirNaBiblioteca(caminho: string, vista: string | null): void {
    if (!caminho || !isLocalFile(caminho)) return
    const r = chaveDeVerificacao(estado, vista, caminho)
    if (r.geracao !== estado.geracao) {
        cache.clear()
        estado = { vista, geracao: r.geracao }
    }
    if (cache.has(r.chave)) return
    // a falha ja acendeu a faixa (falhaAlta em `perguntar`); aqui so nao deixa a promessa rejeitada solta
    const p = perguntar(caminho)
    p.catch((e) => falhaAlta("midia-existe-biblioteca", e))
    cache.set(r.chave, p)
}

/** o clique: pergunta AGORA. Offline acende o aviso persistente e devolve "offline" (quem chama nao manda nada ao ar) */
export async function decidirAntesDoAr(caminho: string, nome: string): Promise<DecisaoMidia> {
    const local = isLocalFile(caminho)
    const existe = local ? await perguntar(caminho) : true
    const decisao = decidirMidia({ local, existe })
    if (decisao === "offline") avisarOffline(caminho, nome)
    return decisao
}

export function avisarOffline(caminho: string, nome: string): void {
    const a = avisoDeOffline(nome, caminho)
    avisar(a.texto, "aviso", a.chave)
}
