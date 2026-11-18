// Leiaute v2, fatia 3: "mandar de novo" so para ALGUMAS saidas. `refreshOut(true, true)` (components/helpers/output.ts) refotografa o slide de TODAS as saidas
// ativas; o "Mandar so para ‹tela›" e a faixa de pendencia nao podem mexer nas outras. Esta funcao faz a mesma conta (acha o slide da foto no layout vivo,
// tira foto nova, mantem a antiga se o slide sumiu) so para os ids pedidos. Mora fora do fecho da janela de saida (a ancora vigia output.ts).
import { outputs } from "../stores"
import { _show } from "../components/helpers/shows"
import { falhaAlta } from "./aliancaFalha"
import { indiceDaFoto, tirarFoto } from "./aliancaFoto"

export function refotografarSaidas(ids: string[]): void {
    if (!ids.length) return
    try {
        outputs.update((a) => {
            for (const id of ids) {
                const saida = a[id]
                if (!saida) continue
                const slide = saida.out?.slide
                if (slide?.foto) {
                    const ref = _show(slide.id).layouts([slide.layout]).ref()[0] || []
                    const indice = indiceDaFoto(slide.foto, slide.index, ref)
                    const foto = indice > -1 ? tirarFoto(slide.id, slide.layout, indice) : null
                    if (foto) {
                        slide.index = indice
                        slide.foto = foto
                    }
                }
                a[id].out = { ...a[id].out, refresh: true }
            }
            return a
        })
        // o mesmo desenho do refreshOut: o `refresh` so empurra o redesenho e desliga logo depois
        setTimeout(() => {
            outputs.update((a) => {
                for (const id of ids) if (a[id]) a[id].out = { ...a[id].out, refresh: false }
                return a
            })
        }, 100)
    } catch (erro) {
        falhaAlta("refotografar-saidas", erro)
    }
}
