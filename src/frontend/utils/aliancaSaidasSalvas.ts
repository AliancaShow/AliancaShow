// Configuração das saídas que sumia ao fechar (André, 22/nov; fatia 1a da cabine 6). O store `outputs` guarda, por saída, o monitor,
// a posição/tamanho, o cadeado, o recorte e o estilo. Ele é gravado no settings.json, mas está na saveList do FreeShow como `null`
// (save.ts), então mudar a tela do telão deixava `saved` em true, e fechar o app com `saved` true fecha SEM gravar
// (initializeClosing -> saveComplete). Prova de 22/nov no perfil de teste: LED 896x320 com cadeado, fechar pelo X, reabrir => 1920x1080.
// Este vigia marca `saved` false quando a CONFIGURAÇÃO de uma saída muda. O estado ao vivo (`out`, `active`, transmitindo) não conta.
// Liga só na janela principal (AliancaTela), fora do fecho da saída.
import { outputs, saved } from "../stores"

/** campos de configuração da saída: mudar qualquer um destes é alteração que tem de ir para o disco */
export const CAMPOS_DE_CONFIGURACAO = [
    "name",
    "color",
    "enabled",
    "screen",
    // cabine 6 ("aprovo monitor-desconectado"): o monitor e a posicao dentro dele; sem isto, fechar o app perderia a escolha do monitor
    "aliancaMonitor",
    "bounds",
    "boundsLocked",
    "cropping",
    "blending",
    "alwaysOnTop",
    "transparent",
    "invisible",
    "taskbar",
    "style",
    // "aprovo tela-visual": a Tela fisica da saida (proporcao, preenchimento, linhas)
    "aliancaTelaFisica",
    "stageOutput",
    "hideFromPreview",
    "forcedResolution"
] as const

/** a assinatura da configuração de todas as saídas, sem o estado ao vivo; `null` se não dá para comparar */
export function assinaturaDasSaidas(o: Record<string, any> | null | undefined): string | null {
    if (!o || typeof o !== "object") return null
    const limpo: Record<string, any> = {}
    for (const id of Object.keys(o).sort()) {
        const s = o[id]
        if (!s || typeof s !== "object") continue
        const campos: Record<string, any> = {}
        for (const k of CAMPOS_DE_CONFIGURACAO) if (s[k] !== undefined) campos[k] = ordenar(s[k])
        limpo[id] = campos
    }
    try {
        return JSON.stringify(limpo)
    } catch {
        return null
    }
}

function ordenar(v: any): any {
    if (!v || typeof v !== "object" || Array.isArray(v)) return v
    const r: Record<string, any> = {}
    for (const k of Object.keys(v).sort()) r[k] = ordenar(v[k])
    return r
}

/** a primeira assinatura vista é a base (o que veio do disco); a partir daí, qualquer mudança é "não salva" */
export class VigiaDeSaidas {
    private base: string | null = null
    mudou(o: Record<string, any> | null | undefined): boolean {
        const a = assinaturaDasSaidas(o)
        if (a === null) return false
        if (this.base === null) {
            this.base = a
            return false
        }
        if (a === this.base) return false
        this.base = a
        return true
    }
}

/**
 * liga o vigia. Espera as saídas do disco chegarem (mesma espera do vigia de mídia): a primeira leitura depois da espera é a base.
 * Devolve o desligar.
 */
export function vigiarConfiguracaoDasSaidas(esperaMs = 6000): () => void {
    const vigia = new VigiaDeSaidas()
    let parar: (() => void) | null = null
    const t = setTimeout(() => {
        parar = outputs.subscribe((o) => {
            if (vigia.mudou(o)) saved.set(false)
        })
    }, esperaMs)
    return () => {
        clearTimeout(t)
        parar?.()
    }
}
