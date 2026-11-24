// Configuracoes (C4, cabine 18/nov): a parte pura do "N alteracoes nao salvas" e do "Descartar".
// As configuracoes valem na hora (o app e ao vivo); "rascunho" aqui e a diferenca entre o estado de agora e a FOTO tirada quando a pagina abriu
// (ou quando o ultimo "Salvar" confirmou). Contar = quantas coisas diferem; Descartar = devolver cada uma ao que a foto guardou.

export type Foto = { [loja: string]: any }

/**
 * chaves de uma saida que entram no rascunho: so configuracao de papel (nome, cor, estilo, layout de palco, sempre-no-topo e os dados de NDI/RTMP/WebRTC).
 * Fora, de proposito: criar/apagar saida, ligar/desligar saida/janela/NDI/RTMP/WebRTC/Blackmagic, `transparent`/`invisible` (recriam a janela), tela e limites
 * (o mapa tem o seu Desfazer), Blackmagic e `forcedResolution` (amarrados a placa) e `cropping`. Tudo isso vale NA HORA, nao conta e o Descartar nao toca.
 */
export const CHAVES_DE_SAIDA = ["name", "color", "style", "aliancaTelaFisica", "stageOutput", "alwaysOnTop", "ndiData", "rtmpData", "webrtcData"] as const

/** dentro de rtmpData/webrtcData, `streaming` e estado vivo da transmissao (nao e configuracao) */
const SEM_VIVO = ["rtmpData", "webrtcData"]

const ehObjeto = (v: unknown): v is { [k: string]: any } => !!v && typeof v === "object" && !Array.isArray(v)
const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** a vista das saidas que conta: so as chaves de papel de cada saida, sem o estado vivo da transmissao */
export function vistaDasSaidas(outs: { [id: string]: any } | null | undefined): { [id: string]: any } {
    const r: { [id: string]: any } = {}
    for (const [id, o] of Object.entries(outs || {})) {
        const v: { [k: string]: any } = {}
        for (const k of CHAVES_DE_SAIDA) {
            if (!o || o[k] === undefined) continue
            if (SEM_VIVO.includes(k) && ehObjeto(o[k])) {
                const { streaming: _vivo, ...resto } = o[k]
                v[k] = resto
            } else v[k] = o[k]
        }
        r[id] = v
    }
    return r
}

/** saida criada ou apagada depois da foto vale na hora: so as saidas que existem nos dois lados entram na conta */
function saidasEmComum(antes: unknown, depois: unknown): [unknown, unknown] {
    if (!ehObjeto(antes) || !ehObjeto(depois)) return [antes, depois]
    const ids = Object.keys(antes).filter((id) => id in depois)
    return [Object.fromEntries(ids.map((id) => [id, antes[id]])), Object.fromEntries(ids.map((id) => [id, depois[id]]))]
}
const parDaLoja = (loja: string, foto: Foto, agora: Foto): [unknown, unknown] => (loja === "outputs" ? saidasEmComum(foto[loja], agora[loja]) : [foto[loja], agora[loja]])

/** o que mudou numa loja: objeto simples conta chave por chave (inclusive entrada nova e apagada); o resto conta 1 se for diferente */
export function mudancasDaLoja(antes: unknown, depois: unknown): string[] {
    if (igual(antes, depois)) return []
    if (ehObjeto(antes) && ehObjeto(depois)) {
        const chaves = new Set([...Object.keys(antes), ...Object.keys(depois)])
        return [...chaves].filter((k) => !igual(antes[k], depois[k]))
    }
    return [""]
}

/** quantas alteracoes ha entre a foto e o estado atual (cada loja soma as suas) */
export function contarMudancas(foto: Foto, agora: Foto): number {
    let n = 0
    for (const loja of Object.keys(foto)) n += mudancasDaLoja(...parDaLoja(loja, foto, agora)).length
    return n
}

/** "2 alterações não salvas" / "1 alteração não salva" / "" (nada) */
export function textoDeAlteracoes(n: number): string {
    if (!n) return ""
    return n === 1 ? "1 alteração não salva" : `${n} alterações não salvas`
}

/** lojas que diferem (para o Descartar saber o que devolver) */
export function lojasMudadas(foto: Foto, agora: Foto): string[] {
    return Object.keys(foto).filter((loja) => mudancasDaLoja(...parDaLoja(loja, foto, agora)).length > 0)
}

export type EfeitosDeSaida = {
    estilo: boolean
    sempreNoTopo: { id: string; valor: boolean }[]
}

/**
 * devolve, DENTRO de `atual` (as saidas vivas), cada chave de papel ao que a foto guardou. So mexe em saida que existe nos dois lados
 * (saida criada ou apagada depois da foto vale na hora) e preserva o estado vivo da transmissao. Devolve o que a UI precisa refazer.
 */
export function restaurarSaidas(atual: { [id: string]: any }, fotoSaidas: { [id: string]: any }): EfeitosDeSaida {
    const efeitos: EfeitosDeSaida = { estilo: false, sempreNoTopo: [] }
    for (const [id, v] of Object.entries(fotoSaidas || {})) {
        const o = atual[id]
        if (!o) continue
        for (const k of CHAVES_DE_SAIDA) {
            const guardado = (v as any)[k]
            const viva = vistaDasSaidas({ [id]: o })[id][k]
            if (igual(guardado, viva)) continue
            if (guardado === undefined) delete o[k]
            else if (SEM_VIVO.includes(k) && ehObjeto(guardado))
                o[k] = {
                    ...JSON.parse(JSON.stringify(guardado)),
                    ...(ehObjeto(o[k]) && o[k].streaming !== undefined ? { streaming: o[k].streaming } : {})
                }
            else o[k] = JSON.parse(JSON.stringify(guardado))
            if (k === "style") efeitos.estilo = true
            if (k === "alwaysOnTop") efeitos.sempreNoTopo.push({ id, valor: guardado !== false })
        }
    }
    return efeitos
}

/**
 * cabine 6 (Visual, V1): copia para a FOTO o valor de agora num caminho ([loja, chave, ...]). Serve para o que vale na hora mesmo com
 * Configuracoes aberta (trocar o Visual escreve em `special`, `styles` e `outputs[id].stageOutput/style`): so aquele caminho deixa de contar
 * como "nao salvo" e o Descartar nao o desfaz; o resto da loja (o que o operador mexeu a mao) continua no rascunho.
 * Em `outputs` a foto e a vista reduzida: saida que nao esta na foto (criada depois) fica de fora, como ja e a regra.
 */
export function aceitarCaminho(foto: Foto, agora: Foto, caminho: string[]): void {
    const [loja, ...resto] = caminho
    if (!loja || !(loja in foto)) return
    if (!resto.length) {
        foto[loja] = agora[loja] === undefined ? undefined : JSON.parse(JSON.stringify(agora[loja]))
        return
    }
    let f: any = foto[loja]
    let a: any = agora[loja]
    if (!ehObjeto(f)) return
    for (const k of resto.slice(0, -1)) {
        a = ehObjeto(a) ? a[k] : undefined
        if (!ehObjeto(f[k])) {
            if (loja === "outputs") return
            f[k] = {}
        }
        f = f[k]
    }
    const ult = resto[resto.length - 1]
    const v = ehObjeto(a) ? a[ult] : undefined
    if (v === undefined) delete f[ult]
    else f[ult] = JSON.parse(JSON.stringify(v))
}
