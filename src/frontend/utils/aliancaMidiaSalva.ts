// Ajustes de mídia que sumiam ao reabrir (André, 22/nov). O store `media` guarda, por arquivo, o que o André ajusta em Editar
// (encaixe, filtros, espelhar, recorte, velocidade, início/fim, volume) e na biblioteca (favorito, etiquetas). Ele é gravado no
// media.json, mas NÃO está na saveList do FreeShow, que é a lista que marca "alterações não salvas". Então mudar um ajuste deixava
// `saved` em true, e fechar o app com `saved` true fecha SEM gravar (initializeClosing -> saveComplete). O ajuste só ficava se o
// autosave de 15 min passasse antes de fechar.
// Este vigia marca `saved` false quando o que importa do `media` muda. Liga só na janela principal (AliancaTela), fora do fecho da saída.
import { media, saved } from "../stores"

/** chaves que o app escreve sozinho ao navegar (cache de leitura do arquivo): mudar só elas não é alteração do André */
export const CHAVES_DE_CACHE = ["info", "creationTime", "contentFile", "licenseExpiresAt", "name"]

/** a assinatura do que o André ajustou, sem o cache; `null` se não dá para comparar */
export function assinaturaDosAjustes(m: Record<string, any> | null | undefined): string | null {
    if (!m || typeof m !== "object") return null
    const limpo: Record<string, any> = {}
    for (const caminho of Object.keys(m).sort()) {
        const v = m[caminho]
        if (!v || typeof v !== "object") continue
        const campos: Record<string, any> = {}
        for (const k of Object.keys(v).sort()) if (!CHAVES_DE_CACHE.includes(k)) campos[k] = v[k]
        if (Object.keys(campos).length) limpo[caminho] = campos
    }
    try {
        return JSON.stringify(limpo)
    } catch {
        return null
    }
}

/** um vigia: a primeira assinatura vista é a base (o que veio do disco); a partir daí, qualquer mudança é "não salva" */
export class VigiaDeAjustes {
    private base: string | null = null
    /** devolve true quando a mudança tem de marcar "não salvo" */
    mudou(m: Record<string, any> | null | undefined): boolean {
        const a = assinaturaDosAjustes(m)
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
 * liga o vigia. Espera o `media` do disco chegar (a abertura manda MEDIA junto com o resto; o FreeShow só liga o próprio
 * vigia de "não salvo" uns 5 s depois): a primeira leitura depois da espera é a base. Devolve o desligar.
 */
export function vigiarAjustesDeMidia(esperaMs = 6000): () => void {
    const vigia = new VigiaDeAjustes()
    let parar: (() => void) | null = null
    const t = setTimeout(() => {
        parar = media.subscribe((m) => {
            if (vigia.mudou(m)) saved.set(false)
        })
    }, esperaMs)
    return () => {
        clearTimeout(t)
        parar?.()
    }
}
