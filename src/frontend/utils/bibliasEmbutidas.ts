import { Main } from "../../types/IPC/Main"
import { requestMain } from "../IPC/main"
import { alertMessage, scriptures } from "../stores"
import { planejarBibliasEmbutidas } from "./bibliasEmbutidasLogica"

/**
 * As Biblias que vao no instalador (bundled-bibles/) precisam estar registradas
 * em "scriptures" com o NOME DO ARQUIVO, senao o main nao as abre. Toda .fsb
 * embutida e registrada na carga (a NVI primeiro); registro antigo com nome que
 * nao casa e corrigido; o que nao tem lugar vira alerta (ver o plano).
 * Nunca apaga registro do usuario.
 */
export async function registrarBibliasEmbutidas() {
    const noDisco: { name: string; embutida?: boolean; legado?: boolean }[] = (await requestMain(Main.READ_BIBLES_FOLDER, undefined as any)) || []

    let erros: string[] = []
    scriptures.update((a) => {
        const plano = planejarBibliasEmbutidas(noDisco, a as any)
        erros = plano.erros
        for (const c of plano.corrigir) a[c.id] = { ...a[c.id], name: c.name, customName: c.customName, ...(c.copyright ? { copyright: c.copyright } : {}) } as any
        for (const r of plano.registrar) a[r.id] = r.registro as any
        return a
    })

    if (erros.length) {
        console.error(erros.join("\n"))
        mostrarErros(erros)
    }
}

// avisa uma vez por sessao (o registro roda de novo em backup/sincronizacao) e espera outro popup aberto fechar
const jaAvisados = new Set<string>()
function mostrarErros(erros: string[], tentativa = 0) {
    const ok = avisarErros(erros, jaAvisados, {
        definirMensagem: (m) => alertMessage.set(m),
        abrirPopup: () => activePopup.set("alert"),
        popupAtual: () => get(activePopup)
    })
    if (!ok && tentativa < 40) setTimeout(() => mostrarErros(erros, tentativa + 1), 3000)
}
