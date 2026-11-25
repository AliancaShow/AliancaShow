// Editor na proporcao do telao (Andre, 25/nov: "o telao ta no formato 896x320 mas nao ta assim aqui"). O FreeShow desenha o editor na
// proporcao da "primeira saida ativa", que vem em ORDEM ALFABETICA: com "NDI-Alpha" (1920x1080, sem janela) antes de "Painel LED" o editor
// ficava em 16:9. Aqui o editor segue a mesma tela principal da coluna No ar: a primeira saida habilitada com janela, sem contar o retorno
// (palco). Pura.
import { saidasHabilitadas } from "./aliancaTransporteLogica"

type SaidaMinima = {
    enabled?: boolean
    invisible?: boolean
    stageOutput?: string | boolean
}

/** id da saida cuja proporcao o editor mostra; "" = nenhuma serve (o getResolution volta ao comportamento do FreeShow) */
export function saidaDoEditor(outputs: Record<string, SaidaMinima | undefined> | null | undefined): string {
    const lista = outputs || {}
    const semPalco = (id: string) => !lista[id]?.stageOutput
    const comJanela = saidasHabilitadas(lista).find(semPalco)
    if (comJanela) return comJanela
    return (
        Object.entries(lista)
            .filter(([, o]) => o?.enabled && !o?.stageOutput)
            .map(([id]) => id)[0] || ""
    )
}
