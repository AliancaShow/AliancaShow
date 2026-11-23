// Visual (cabine 6, fatia V1): o UNICO lugar do codigo Alianca que escreve `template`/`templateScripture` de estilo e `stageOutput` por causa
// do Visual. A logica pura (o que escrever, problemas, pendencia do D15) mora em aliancaVisualLogica.ts.
//
// Regras (plano-modelos-visual.md + adendo da revisao cetica):
//  - escreve direto nas lojas, SEM `history` (Ctrl+Z nao desfaz o Visual);
//  - vale na hora com Configuracoes aberta: cada caminho escrito entra na foto do rascunho (nao conta como "nao salvo"; Descartar nao desfaz);
//  - D15 plano A: saida com slide no ar so recebe a escrita quando o slide dela muda (assinante de `outputs`, sincrono). STYLES vai na hora
//    para a janela de saida e OUTPUTS espera >= 1 ms (listeners.ts), entao o estilo chega antes do slide novo. Descartar cancela a pendencia;
//  - o operador nunca pensa em "estilo" (pedido do Andre, 23/nov): saida sem estilo, ou que divide o estilo com outra que pede outra coisa,
//    ganha SOZINHA um estilo so dela = copia exata do atual (desenha igual), com o nome da saida, e so depois o modelo e escrito. Laranja so
//    para problema de verdade (modelo ou leiaute apagado). Nunca na carga: so quando um Visual e aplicado (casa mudada ou Visual trocado).
// Liga so na janela principal (AliancaTela); nada do fecho da saida importa este arquivo.
import { get, writable, type Writable } from "svelte/store"
import { uid } from "uid"
import { loaded, loadedState, outputs, special, stageShows, styles, templates } from "../stores"
import { clone } from "../components/helpers/array"
import { aceitarCaminhosNaFoto } from "./aliancaConfigRascunho"
import { falhaAlta } from "./aliancaFalha"
import { lerVisuais, migrar, nomeDoEstiloProprio, Pendencias, planoDeEscrita, precisaDeEstiloProprio, saidasParaSeparar, visualAtivo, type Casa, type Coluna, type Escrita, type Problema, type Visual } from "./aliancaVisualLogica"

/** o que espera o proximo slide (para a linha de origem nao acusar divergencia e Configuracoes > Visual dizer onde espera) */
export const visualPendente: Writable<{ chaves: Set<string>; saidas: Set<string> }> = writable({ chaves: new Set(), saidas: new Set() })
/** problemas do ultimo plano aplicado (modelo/leiaute apagado) */
export const problemasDoVisual: Writable<Problema[]> = writable([])

const pendencias = new Pendencias()
function publicarPendencias() {
    visualPendente.set({ chaves: pendencias.chaves(), saidas: pendencias.saidasEsperando() })
}

/** executa escritas ja decididas: lojas direto, sem historico, e cada caminho entra na foto do rascunho */
function escrever(escritas: Escrita[]) {
    if (!escritas.length) return
    const caminhos: string[][] = []
    const deEstilo = escritas.filter((e) => e.tipo === "estilo")
    const deRetorno = escritas.filter((e) => e.tipo === "retorno")
    if (deEstilo.length)
        styles.update((a) => {
            for (const e of deEstilo) {
                if (e.tipo !== "estilo" || !a[e.estilo]) continue
                if (e.valor === undefined) delete (a[e.estilo] as any)[e.campo]
                else (a[e.estilo] as any)[e.campo] = e.valor
                caminhos.push(["styles", e.estilo, e.campo])
            }
            return a
        })
    if (deRetorno.length)
        outputs.update((a) => {
            for (const e of deRetorno) {
                // nunca transforma saida normal em retorno: so troca o leiaute de quem ja e retorno
                if (e.tipo !== "retorno" || !a[e.saida]?.stageOutput) continue
                a[e.saida].stageOutput = e.valor
                caminhos.push(["outputs", e.saida, "stageOutput"])
            }
            return a
        })
    aceitarCaminhosNaFoto(caminhos)
}

/** aplica o Visual ativo: o que nao tem slide no ar entra ja; o resto espera o proximo slide daquela saida (D15) */
export function aplicarVisualAtivo(): void {
    const v = visualAtivo(get(special))
    if (!v) {
        problemasDoVisual.set([])
        return
    }
    // antes de escrever: quem divide estilo (ou nao tem) ganha um so dele, copia exata (nada muda na tela)
    for (const id of saidasParaSeparar(v, get(outputs), get(styles))) darEstiloProprio(id)
    const plano = planoDeEscrita(v, get(outputs), get(styles), get(templates), get(stageShows))
    problemasDoVisual.set(plano.problemas)
    const ja = pendencias.registrar(plano.escritas, get(outputs))
    escrever(ja)
    publicarPendencias()
}

/** grava a lista de Visuais (e, se vier, o ativo) em `special`; entra na foto do rascunho */
export function gravarVisuais(lista: Visual[], ativo?: string): void {
    special.update((s) => ({ ...s, aliancaVisuais: clone(lista), ...(ativo !== undefined ? { aliancaVisualAtivo: ativo } : {}) }))
    aceitarCaminhosNaFoto([
        ["special", "aliancaVisuais"],
        ["special", "aliancaVisualAtivo"]
    ])
}

/** troca o Visual que esta valendo (pilula ou pagina) */
export function ativarVisual(id: string): void {
    const lista = lerVisuais(get(special))
    if (!lista.some((v) => v.id === id)) return falhaAlta("visual", `ativarVisual: Visual "${id}" não existe`)
    gravarVisuais(lista, id)
    aplicarVisualAtivo()
}

/** muda um Visual da lista; se for o ativo, aplica (com a regra do D15) */
export function mudarVisual(v: Visual): void {
    const lista = lerVisuais(get(special)).map((x) => (x.id === v.id ? v : x))
    gravarVisuais(lista)
    if (get(special).aliancaVisualAtivo === v.id) aplicarVisualAtivo()
}

/**
 * muda uma casa (saida x coluna) de um Visual. Se for o Visual que esta valendo e a saida divide o estilo com outra que pede outra coisa
 * (ou nao tem estilo), ESTA saida ganha antes um estilo so dela (copia exata, com o nome dela). Sem pergunta: nada muda na tela por isso.
 */
export function mudarCasa(visualId: string, saida: string, coluna: Coluna, casa: Casa): void {
    const v = lerVisuais(get(special)).find((x) => x.id === visualId)
    if (!v) return falhaAlta("visual", `mudarCasa: Visual "${visualId}" não existe`)
    const novo = clone(v) as Visual
    novo.saidas[saida] = { ...(novo.saidas[saida] || {}), [coluna]: casa }
    if (get(special).aliancaVisualAtivo === visualId && precisaDeEstiloProprio(v, get(outputs), get(styles), saida, coluna, casa)) darEstiloProprio(saida)
    mudarVisual(novo)
}

/** Descartar em Configuracoes: o que esperava o proximo slide nao entra mais */
export function cancelarPendenciasDoVisual(): number {
    const n = pendencias.cancelar()
    publicarPendencias()
    if (n) aplicarProblemas()
    return n
}
function aplicarProblemas() {
    const v = visualAtivo(get(special))
    problemasDoVisual.set(v ? planoDeEscrita(v, get(outputs), get(styles), get(templates), get(stageShows)).problemas : [])
}

/**
 * da a uma saida um estilo SO dela: copia exata do estilo que ela usa (ou um vazio, se nao tinha), com o nome da saida, e aponta a saida
 * para ele. A copia desenha igual, entao nada muda no telao. Nao reaplica: quem chama (aplicarVisualAtivo ou a casa do Visual) escreve depois.
 * O estilo e gravado ANTES da saida: STYLES vai na hora para a janela de saida e OUTPUTS espera >= 1 ms, entao ela nunca aponta para o nada.
 */
export function darEstiloProprio(outputId: string): string | null {
    const o: any = get(outputs)[outputId]
    if (!o) {
        falhaAlta("visual", `darEstiloProprio: saída "${outputId}" não existe`)
        return null
    }
    const antigo: any = o.style ? get(styles)[o.style] : null
    const id = uid()
    styles.update((a) => {
        a[id] = { ...(antigo ? clone(antigo) : {}), name: nomeDoEstiloProprio(o.name, a) } as any
        return a
    })
    outputs.update((a) => {
        if (a[outputId]) a[outputId].style = id
        return a
    })
    aceitarCaminhosNaFoto([
        ["styles", id],
        ["outputs", outputId, "style"]
    ])
    return id
}

// ---------------------------------------------------------------- partida: migracao e vigia do proximo slide

const dadosProntos = () => get(loaded) && get(loadedState).includes("synced_settings")

function migrarSePreciso() {
    const m = migrar(get(special), get(outputs), get(styles), uid())
    if (!m) return
    // a migracao so LE estilos e retornos: nao escreve em `styles` nem em `outputs` (o perfil continua desenhando igual)
    special.update((s) => ({ ...s, ...m }))
    aceitarCaminhosNaFoto([
        ["special", "aliancaVisuais"],
        ["special", "aliancaVisualAtivo"]
    ])
}

/** liga o Visual na janela principal: migra uma vez quando os dados chegam e vigia o proximo slide de cada saida. Devolve o desligar. */
export function iniciarVisual(): () => void {
    let parar: (() => void) | null = null
    let tentativas = 0
    let t: ReturnType<typeof setTimeout> | null = null
    const ligar = () => {
        t = null
        if (!dadosProntos()) {
            if (++tentativas > 120) return falhaAlta("visual", "as configurações não chegaram em 60 s: o Visual não foi ligado")
            t = setTimeout(ligar, 500)
            return
        }
        try {
            migrarSePreciso()
            aplicarProblemas()
        } catch (e) {
            falhaAlta("visual", e)
        }
        parar = outputs.subscribe((o) => {
            if (!pendencias.tamanho) return
            const sai = pendencias.aoMudar(o)
            if (!sai.length) return
            // sincrono, dentro do assinante: o estilo novo chega a janela de saida antes do slide novo
            escrever(sai)
            publicarPendencias()
        })
    }
    ligar()
    return () => {
        if (t) clearTimeout(t)
        parar?.()
    }
}
