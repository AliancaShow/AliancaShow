// Configuracoes (C4, cabine 18/nov): foto das lojas de configuracao, contagem de alteracoes nao salvas e Descartar.
// A logica pura mora em aliancaConfigRascunhoLogica.ts; aqui so ha o que fala com as lojas do app.
import { get, writable, type Writable } from "svelte/store"
import { clone } from "../components/helpers/array"
import {
    alertUpdates,
    audioChannelsData,
    audioEffects,
    autoOutput,
    autosave,
    disabledServers,
    eqPresets,
    formatNewShow,
    fullColors,
    groupNumbers,
    labelsDisabled,
    language,
    maxConnections,
    outputs,
    ports,
    remotePassword,
    slidesOptions,
    splitLines,
    timeFormat,
    transitionData
} from "../stores"
import { contarMudancas, lojasMudadas, vistaDasSaidas, CHAVES_DE_SAIDA, type Foto } from "./aliancaConfigRascunhoLogica"
import { getSyncedSettings } from "./save"

/** quantas alteracoes nao salvas ha (alimenta o cabecalho de Configuracoes) */
export const alteracoesNaoSalvas: Writable<number> = writable(0)

function lojasDeConfiguracao(): { [nome: string]: Writable<any> } {
    return {
        ...getSyncedSettings(),
        language,
        timeFormat,
        labelsDisabled,
        groupNumbers,
        fullColors,
        formatNewShow,
        splitLines,
        autosave,
        autoOutput,
        alertUpdates,
        ports,
        maxConnections,
        disabledServers,
        remotePassword,
        audioChannelsData,
        audioEffects,
        eqPresets,
        transitionData,
        slidesOptions
    }
}

function lerAgora(): Foto {
    const f: Foto = {}
    for (const [nome, loja] of Object.entries(lojasDeConfiguracao())) f[nome] = clone(get(loja))
    f.outputs = vistaDasSaidas(get(outputs))
    return f
}

let foto: Foto = {}
let paradas: (() => void)[] = []
let agenda: ReturnType<typeof setTimeout> | null = null

function recontar() {
    agenda = null
    alteracoesNaoSalvas.set(contarMudancas(foto, lerAgora()))
}
function pedirRecontagem() {
    if (agenda) return
    agenda = setTimeout(recontar, 150)
}

/** tira a foto do estado de agora (ao abrir a pagina e depois de cada Salvar confirmado) */
export function tirarFoto() {
    foto = lerAgora()
    alteracoesNaoSalvas.set(0)
}

/** comeca a contar (a pagina abriu) */
export function iniciarRascunho() {
    pararRascunho()
    tirarFoto()
    const lojas = [...Object.values(lojasDeConfiguracao()), outputs]
    paradas = lojas.map((loja) => {
        let primeira = true
        return loja.subscribe(() => {
            if (primeira) return (primeira = false)
            pedirRecontagem()
        })
    })
}

export function pararRascunho() {
    paradas.forEach((p) => p())
    paradas = []
    if (agenda) clearTimeout(agenda)
    agenda = null
}

/** devolve cada loja mudada ao que a foto guardou; a recontagem zera o aviso. Devolve quantas lojas voltaram. */
export function descartarAlteracoes(): number {
    const agora = lerAgora()
    const mudadas = lojasMudadas(foto, agora)
    const todas = lojasDeConfiguracao()
    for (const nome of mudadas) {
        if (nome === "outputs") {
            outputs.update((a: any) => {
                for (const [id, v] of Object.entries(foto.outputs || {})) {
                    if (!a[id]) continue
                    for (const k of CHAVES_DE_SAIDA) {
                        if ((v as any)[k] === undefined) delete a[id][k]
                        else a[id][k] = clone((v as any)[k])
                    }
                }
                return a
            })
        } else if (todas[nome]) todas[nome].set(clone(foto[nome]))
    }
    recontar()
    return mudadas.length
}
