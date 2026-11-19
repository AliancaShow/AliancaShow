// Configuracoes (C4, cabine 18/nov): foto das lojas de configuracao, contagem de alteracoes nao salvas e Descartar.
// A logica pura mora em aliancaConfigRascunhoLogica.ts; aqui so ha o que fala com as lojas do app.
//
// O que o rascunho cobre: tudo que as paginas de Configuracoes escrevem em loja de CONFIGURACAO (lista em lojasDeConfiguracao) e, por saida, as chaves de
// papel (CHAVES_DE_SAIDA). Fora, de proposito e dito na propria tela: criar/apagar saida, ligar/desligar saida/janela/NDI/RTMP/WebRTC/Blackmagic, mover de tela
// (valem na hora); `dataPath` (mover a pasta de dados mexe em arquivos no disco: nao ha como "desmover"); login de nuvem/Drive/OBS/provedores (conexao viva).
// A foto nasce UMA vez, ao abrir Configuracoes pela primeira vez, e so e renovada ao Salvar (o botao) ou ao Descartar: reabrir a pagina e o autosave nao a zeram.
import { get, writable, type Writable } from "svelte/store"
import { OUTPUT } from "../../types/Channels"
import { Main } from "../../types/IPC/Main"
import { clone } from "../components/helpers/array"
import { refreshOut } from "../components/helpers/output"
import { sendMain } from "../IPC/main"
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
    serverData,
    slidesOptions,
    special,
    splitLines,
    theme,
    themes,
    timeFormat,
    transitionData
} from "../stores"
import { contarMudancas, lojasMudadas, restaurarSaidas, vistaDasSaidas, type Foto } from "./aliancaConfigRascunhoLogica"
import { setLanguage } from "./language"
import { send } from "./request"
import { getSyncedSettings } from "./save"
import { updateThemeValues } from "./updateSettings"

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
        serverData,
        audioChannelsData,
        audioEffects,
        eqPresets,
        transitionData,
        slidesOptions,
        special,
        theme,
        themes
    }
}

function lerAgora(): Foto {
    const f: Foto = {}
    for (const [nome, loja] of Object.entries(lojasDeConfiguracao())) f[nome] = clone(get(loja))
    f.outputs = vistaDasSaidas(get(outputs))
    return f
}

let foto: Foto = {}
let temFoto = false
let paradas: (() => void)[] = []
let agenda: ReturnType<typeof setTimeout> | null = null
let ultimaVistaDeSaidas = ""

function recontar() {
    agenda = null
    const n = contarMudancas(foto, lerAgora())
    alteracoesNaoSalvas.set(n)
    return n
}
function pedirRecontagem() {
    if (agenda) return
    agenda = setTimeout(recontar, 150)
}

/** tira a foto do estado de agora (a primeira vez que Configuracoes abre, e depois de cada Salvar confirmado ou Descartar que desfez tudo) */
export function tirarFoto(f: Foto = lerAgora()) {
    foto = f
    temFoto = true
    alteracoesNaoSalvas.set(0)
}

/** o estado de agora, para ser a foto SE o Salvar confirmar (o que estava no disco e o do momento do clique, nao o da confirmacao) */
export function fotoParaSalvar(): Foto {
    return lerAgora()
}

/** comeca a contar (a pagina abriu). Reabrir NAO renova a foto: so a primeira abertura (ou depois de um Salvar/Descartar) a tira. */
export function iniciarRascunho() {
    pararRascunho()
    if (!temFoto) tirarFoto()
    ultimaVistaDeSaidas = JSON.stringify(vistaDasSaidas(get(outputs)))
    const lojas = Object.values(lojasDeConfiguracao())
    paradas = lojas.map((loja) => {
        let primeira = true
        return loja.subscribe(() => {
            if (primeira) return (primeira = false)
            pedirRecontagem()
        })
    })
    // `outputs` muda a cada slide que vai ao ar: so recontar quando a vista reduzida (as chaves de papel) mudou
    let primeiraSaida = true
    paradas.push(
        outputs.subscribe((o) => {
            if (primeiraSaida) return (primeiraSaida = false)
            const v = JSON.stringify(vistaDasSaidas(o))
            if (v === ultimaVistaDeSaidas) return
            ultimaVistaDeSaidas = v
            pedirRecontagem()
        })
    )
    recontar()
}

export function pararRascunho() {
    paradas.forEach((p) => p())
    paradas = []
    if (agenda) clearTimeout(agenda)
    agenda = null
}

const mudou = (nomes: string[], ...lojas: string[]) => lojas.some((l) => nomes.includes(l))

/**
 * devolve cada loja mudada ao que a foto guardou E refaz o efeito que a aba faria (idioma, tema, servidores, Companion, estilo e sempre-no-topo da saida).
 * Devolve quantas lojas voltaram e quantas alteracoes seguem pendentes (se alguma nao pode ser desfeita, a foto fica e o aviso diz isso).
 */
export function descartarAlteracoes(): { desfeitas: number; restantes: number } {
    const mudadas = lojasMudadas(foto, lerAgora())
    const todas = lojasDeConfiguracao()
    let efeitosDeSaida = { estilo: false, sempreNoTopo: [] as { id: string; valor: boolean }[] }
    for (const nome of mudadas) {
        if (nome === "outputs") {
            outputs.update((a: any) => {
                efeitosDeSaida = restaurarSaidas(a, foto.outputs || {})
                return a
            })
        } else if (nome === "language") setLanguage(foto.language)
        else if (todas[nome]) todas[nome].set(clone(foto[nome]))
    }
    // efeitos que as abas disparam ao mudar (a loja sozinha nao os refaz)
    if (efeitosDeSaida.estilo) setTimeout(refreshOut)
    for (const { id, valor } of efeitosDeSaida.sempreNoTopo) if (get(outputs)[id]?.enabled) send(OUTPUT, ["SET_VALUE"], { id, key: "alwaysOnTop", value: valor })
    if (mudou(mudadas, "theme", "themes")) updateThemeValues((get(themes) as any)[get(theme)] || (get(themes) as any).default)
    if (mudou(mudadas, "disabledServers", "ports", "maxConnections", "serverData")) sendMain(Main.START, { ports: get(ports), max: get(maxConnections), disabled: get(disabledServers), data: get(serverData) })
    if (mudou(mudadas, "companion")) {
        if (get(todas.companion)?.enabled) sendMain(Main.WEBSOCKET_START, get(ports).companion)
        else sendMain(Main.WEBSOCKET_STOP)
    }
    const restantes = recontar()
    if (!restantes) tirarFoto()
    return { desfeitas: mudadas.length, restantes }
}
