import { Main } from "../../types/IPC/Main"
import { requestMain } from "../IPC/main"
import { scriptures } from "../stores"

/**
 * As Biblias que vao no instalador (bundled-bibles/, gerado por
 * scripts/gerarBiblias.js) precisam estar registradas em "scriptures" para
 * aparecer. O defaults.ts so vale em instalacao nova: o valor salvo vence o
 * default, entao numa maquina que ja tinha so a NVI a ARA nunca apareceria.
 *
 * Registra so o que existe no disco. Registrar sem o arquivo deixaria a
 * traducao na lista como "nao encontrada".
 */
const EMBUTIDAS: { [id: string]: { name: string; id: string; copyright: string } } = {
    nvi: { name: "NVI", id: "nvi", copyright: "Nova Versão Internacional © Biblica, Inc." },
    ara: { name: "ARA", id: "ara", copyright: "Almeida Revista e Atualizada © Sociedade Bíblica do Brasil" }
}

export async function registrarBibliasEmbutidas() {
    const noDisco: { name: string }[] = (await requestMain(Main.READ_BIBLES_FOLDER, undefined as any)) || []
    const nomes = new Set(noDisco.map((b) => b.name.toLowerCase()))

    scriptures.update((a) => {
        const registrados = new Set(Object.values(a).map((b: any) => String(b?.name || "").toLowerCase()))
        for (const [id, biblia] of Object.entries(EMBUTIDAS)) {
            const nome = biblia.name.toLowerCase()
            if (a[id] || registrados.has(nome) || !nomes.has(nome)) continue
            a[id] = biblia as any
        }
        return a
    })
}
