// Visual (cabine 6, fatia V1) + Tela ("aprovo tela-visual", 23/nov): o UNICO lugar do codigo Alianca que escreve campos de estilo por causa
// da Tela fisica ou do Visual, e `stageOutput` por causa do Visual. A logica pura (o que escrever, problemas, pendencia do D15, migracao)
// mora em aliancaVisualLogica.ts. Desenho: docs/passagem/referencia/desenho-tela-e-visual.md.
//
// Regras (plano-modelos-visual.md + adendo da revisao cetica + desenho-tela-e-visual.md):
//  - o estilo de cada saida e RESULTADO: Tela fisica (outputs[id].aliancaTelaFisica) + Visual ativo. Ninguem mais edita estilo a mao;
//  - escreve direto nas lojas, SEM `history` (Ctrl+Z nao desfaz o Visual, como o Look do ProPresenter);
//  - campos do Visual valem na hora com Configuracoes aberta e entram na foto do rascunho (Descartar nao desfaz troca de Visual). Campos da
//    Tela NAO entram na foto: a Tela e configuracao comum (Descartar devolve a Tela e a conferencia recompoe o estilo);
//  - D15: saida com slide no ar so recebe MODELO (e leiaute de retorno) quando o slide dela muda. Camadas, fundo e transicao valem na hora.
//    STYLES vai na hora para a janela de saida e OUTPUTS espera >= 1 ms (listeners.ts), entao o estilo chega antes do slide novo;
//  - toda saida normal tem estilo so dela (depois da migracao): dividida ou sem estilo ganha uma copia exata, com o nome da saida;
//  - CONFERENCIA (revisao, achados 2 e 3): estilo trocado por fora (menu "Trocar estilo", acao, API, config vinda de outra maquina ou da
//    nuvem, restaurar backup) e conferido campo a campo e refeito, com aviso laranja. Nunca cria estilo vazio calado.
// Liga so na janela principal (AliancaTela); nada do fecho da saida importa este arquivo.
import { get, writable, type Writable } from "svelte/store"
import { uid } from "uid"
import { loaded, loadedState, outputs, saved, special, stageShows, styles, templates } from "../stores"
import { clone } from "../components/helpers/array"
import { avisar } from "./aliancaAvisos"
import { aceitarCaminhosNaFoto } from "./aliancaConfigRascunho"
import { falhaAlta } from "./aliancaFalha"
import { CAMPOS_FISICOS, estavel, lerVisuais, migrar, migrarTela, nomeDoEstiloProprio, novoVisual as novoVisualPuro, Pendencias, planoDeEscrita, precisaDeEstiloProprio, saidasNormais, saidasParaSeparar, telaFisicaDe, VERSAO_TELA, visualAtivo, versoesDoModelo, type Aparencia, type QuantasVersoes, type Casa, type Coluna, type Escrita, type Problema, type Visual } from "./aliancaVisualLogica"

/** o que espera o proximo slide (para a linha de origem nao acusar divergencia e Configuracoes > Visual dizer onde espera) */
export const visualPendente: Writable<{
    chaves: Set<string>
    saidas: Set<string>
}> = writable({ chaves: new Set(), saidas: new Set() })
/** problemas do ultimo plano aplicado (modelo/leiaute apagado) */
export const problemasDoVisual: Writable<Problema[]> = writable([])

const pendencias = new Pendencias()
function publicarPendencias() {
    visualPendente.set({
        chaves: pendencias.chaves(),
        saidas: pendencias.saidasEsperando()
    })
}

const ehFisico = (campo: string) => (CAMPOS_FISICOS as readonly string[]).includes(campo)
const migrouTela = () => (Number(get(special)?.aliancaTelaVersao) || 0) >= VERSAO_TELA

/** executa escritas ja decididas: lojas direto, sem historico; so os caminhos do Visual entram na foto do rascunho */
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
                else (a[e.estilo] as any)[e.campo] = clone(e.valor)
                if (!ehFisico(e.campo)) caminhos.push(["styles", e.estilo, e.campo])
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
    if (caminhos.length) aceitarCaminhosNaFoto(caminhos)
}

/** aplica o Visual ativo (e a Tela): camadas/fundo/transicao/Tela entram ja; modelo com slide no ar espera o proximo slide (D15) */
export function aplicarVisualAtivo(): void {
    const v = visualAtivo(get(special))
    // antes de escrever: quem divide estilo (ou nao tem) ganha um so dele, copia exata (nada muda na tela)
    for (const id of saidasParaSeparar(v, get(outputs), get(styles), migrouTela())) darEstiloProprio(id)
    const plano = planoDeEscrita(v, get(outputs), get(styles), get(templates), get(stageShows))
    problemasDoVisual.set(plano.problemas)
    const ja = pendencias.registrar(plano.escritas, get(outputs))
    escrever(ja)
    publicarPendencias()
}

/**
 * 25/nov: "Biblia com 2+ versoes" no modelo de Biblia. `valor` "" = igual ao proprio modelo. Grava em `templates[id].settings.aliancaVersoes`
 * e reaplica o Visual (as saidas cuja Biblia e este modelo recebem o novo modelo de N versoes no proximo slide, como qualquer modelo, D15).
 */
export function mudarVersoesDaBiblia(modeloId: string, n: QuantasVersoes, valor: string): void {
    if (!(get(templates) as any)[modeloId]) return falhaAlta("visual", `mudarVersoesDaBiblia: modelo "${modeloId}" não existe`)
    templates.update((a: any) => {
        const m = a[modeloId]
        if (!m) return a
        m.settings = { ...(m.settings || {}), aliancaVersoes: { ...versoesDoModelo(m), [n]: valor || "" } }
        return a
    })
    // quem reaplica e o vigia de `templates` em iniciarVisual (pega tambem o Ctrl+Z)
}

/**
 * a Tela de uma saida mudou (bloco "Tela" em Configuracoes > Saidas): grava `aliancaTelaFisica` e escreve no estilo na hora (configuracao
 * fisica nao espera slide). Nao mexe nas pendencias do Visual.
 */
export function mudarTelaFisica(outputId: string, campos: Aparencia): void {
    const o: any = get(outputs)[outputId]
    if (!o) return falhaAlta("tela", `mudarTelaFisica: saída "${outputId}" não existe`)
    outputs.update((a) => {
        if (!a[outputId]) return a
        const t = { ...(telaFisicaDe(a[outputId]) || {}) }
        for (const [k, val] of Object.entries(campos)) {
            if (!ehFisico(k)) continue
            if (val === undefined) delete t[k]
            else t[k] = clone(val)
        }
        ;(a[outputId] as any).aliancaTelaFisica = t
        return a
    })
    comporAgora()
}

/** escreve tudo que nao espera slide (Tela, camadas, fundo) e o que nao esta pendente; usado pela Tela e pela conferencia */
function comporAgora(): Escrita[] {
    const v = visualAtivo(get(special))
    for (const id of saidasParaSeparar(v, get(outputs), get(styles), migrouTela())) darEstiloProprio(id)
    const pend = pendencias.chaves()
    const plano = planoDeEscrita(v, get(outputs), get(styles), get(templates), get(stageShows))
    problemasDoVisual.set(plano.problemas)
    // retorno e modelo seguem o D15 so quando vem de troca de Visual; aqui o estilo esta errado por fora: conserta tudo que nao esta pendente
    const escritas = plano.escritas.filter((e) => !pend.has(e.tipo === "estilo" ? `estilo:${e.estilo}:${e.campo}` : `retorno:${e.saida}`))
    escrever(escritas)
    return escritas
}

/** grava a lista de Visuais (e, se vier, o ativo) em `special`; entra na foto do rascunho */
export function gravarVisuais(lista: Visual[], ativo?: string): void {
    special.update((s) => ({
        ...s,
        aliancaVisuais: clone(lista),
        ...(ativo !== undefined ? { aliancaVisualAtivo: ativo } : {})
    }))
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

/** Visual novo: herda camadas, fundo e transicao do ativo (revisao, achado 5) */
export function criarVisualNovo(visuais: Visual[], novoId: string): Visual {
    return novoVisualPuro(visuais, get(outputs), novoId, visualAtivo(get(special)))
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

/** muda a linha inteira de uma saida num Visual (aparencia e Biblia 2–4, no "Aparencia" da pagina Visual) */
export function mudarLinha(visualId: string, saida: string, mudar: (linha: any) => void): void {
    const v = lerVisuais(get(special)).find((x) => x.id === visualId)
    if (!v) return falhaAlta("visual", `mudarLinha: Visual "${visualId}" não existe`)
    const novo = clone(v) as Visual
    const linha: any = clone(novo.saidas[saida] || {})
    mudar(linha)
    novo.saidas[saida] = linha
    mudarVisual(novo)
}

/** Descartar em Configuracoes: o que esperava o proximo slide nao entra mais; a conferencia recompoe o estilo a partir da Tela devolvida */
export function cancelarPendenciasDoVisual(): number {
    const n = pendencias.cancelar()
    publicarPendencias()
    aplicarProblemas()
    // a conferencia aplica o que o Visual diz sem acusar "mudado por fora" (o operador acabou de descartar)
    conferenciaSilenciosa = true
    agendarConferencia(0)
    return n
}
function aplicarProblemas() {
    const v = visualAtivo(get(special))
    problemasDoVisual.set(planoDeEscrita(v, get(outputs), get(styles), get(templates), get(stageShows)).problemas)
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
        a[id] = {
            ...(antigo ? clone(antigo) : {}),
            name: nomeDoEstiloProprio(o.name, a)
        } as any
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

// ---------------------------------------------------------------- partida: migracoes, conferencia e vigia do proximo slide

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

/** migracao Tela + Visual: cada saida normal com estilo so dela; Tela fisica e aparencia LIDAS do estilo de hoje (nada muda na tela) */
function migrarTelaSePreciso() {
    if (migrouTela()) return
    for (const id of saidasParaSeparar(visualAtivo(get(special)), get(outputs), get(styles), true)) darEstiloProprio(id)
    const m = migrarTela(get(special), get(outputs), get(styles))
    if (!m) return
    outputs.update((a) => {
        for (const [id, t] of Object.entries(m.telas)) if (a[id]) (a[id] as any).aliancaTelaFisica = t
        return a
    })
    special.update((s) => ({
        ...s,
        aliancaVisuais: m.visuais,
        aliancaTelaVersao: VERSAO_TELA
    }))
    aceitarCaminhosNaFoto([
        ["special", "aliancaVisuais"],
        ["special", "aliancaTelaVersao"]
    ])
    // a migracao tem de ir para o disco mesmo que o operador nao mexa em nada
    saved.set(false)
}

/** o que a conferencia olha: estilos das saidas normais, a Tela, o estilo apontado e o Visual ativo (o slide no ar nao conta) */
function assinaturaDaConferencia(): string {
    const o: any = get(outputs)
    const est: any = get(styles)
    const partes: any[] = []
    for (const s of saidasNormais(o)) partes.push([s.id, o[s.id]?.style || "", o[s.id]?.aliancaTelaFisica ?? null, o[s.id]?.style ? (est[o[s.id].style] ?? null) : null])
    const sp: any = get(special)
    return estavel([partes, sp?.aliancaVisualAtivo ?? null, sp?.aliancaVisuais ?? null, sp?.aliancaTelaVersao ?? null])
}

function assinaturaDasVersoes(): string {
    const m: any = get(templates)
    return estavel(Object.keys(m || {}).sort().map((id) => [id, versoesDoModelo(m[id])]))
}

let ultimaAssinatura = ""
let conferenciaSilenciosa = false
let tConferencia: ReturnType<typeof setTimeout> | null = null
/** espera o estado ficar parado (restaurar e nuvem entregam as lojas em separado) antes de conferir */
function agendarConferencia(ms = 1500) {
    if (tConferencia) clearTimeout(tConferencia)
    tConferencia = setTimeout(conferir, ms)
}

/**
 * confere o estilo de cada saida contra Tela + Visual e refaz o que estiver diferente (revisao, achados 2–4). Saida nova (sem Tela)
 * ganha a Tela padrao vazia (o estilo dela fica como o FreeShow cria). Nunca roda antes dos dados nem da migracao.
 */
function conferir() {
    tConferencia = null
    try {
        if (!dadosProntos() || !migrouTela()) return
        const o: any = get(outputs)
        const est: any = get(styles)
        const semTela = saidasNormais(o).filter((s) => !telaFisicaDe(o[s.id]))
        if (semTela.length)
            outputs.update((a) => {
                for (const s of semTela) if (a[s.id] && !telaFisicaDe(a[s.id])) (a[s.id] as any).aliancaTelaFisica = {}
                return a
            })
        const sumiu = saidasNormais(o).filter((s) => o[s.id]?.style && !est[o[s.id].style])
        const dividia = saidasParaSeparar(visualAtivo(get(special)), o, est, true).filter((id) => o[id]?.style && est[o[id].style])
        const escritas = comporAgora()
        if (conferenciaSilenciosa) return
        for (const s of sumiu) avisar(`${s.nome}: a configuração interna de aparência desta saída sumiu e foi refeita pela Tela e pelo Visual.`, "aviso", `tela-visual:${s.id}:sumiu`)
        for (const id of dividia) avisar(`${o[id]?.name || id}: esta saída passou a usar a aparência de outra (atalho ou ação antiga) e foi separada de novo.`, "aviso", `tela-visual:${id}:dividia`)
        const porSaida = new Set<string>()
        for (const e of escritas) if (e.tipo === "estilo") for (const id of e.saidas) if (!sumiu.some((s) => s.id === id) && !dividia.includes(id)) porSaida.add(id)
        for (const id of porSaida) avisar(`${o[id]?.name || id}: a aparência foi mudada por fora (estilo) e voltou ao que a Tela e o Visual dizem. Mude em Configurações › Saídas ou › Visual.`, "aviso", `tela-visual:${id}:por-fora`)
    } catch (e) {
        falhaAlta("tela-visual", e)
    } finally {
        conferenciaSilenciosa = false
        ultimaAssinatura = assinaturaDaConferencia()
    }
}

/** liga o Visual na janela principal: migra uma vez quando os dados chegam, confere e vigia o proximo slide de cada saida. Devolve o desligar. */
export function iniciarVisual(): () => void {
    const paradas: (() => void)[] = []
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
            migrarTelaSePreciso()
            aplicarProblemas()
        } catch (e) {
            falhaAlta("visual", e)
        }
        ultimaAssinatura = assinaturaDaConferencia()
        agendarConferencia()
        paradas.push(
            outputs.subscribe((o) => {
                if (pendencias.tamanho) {
                    const sai = pendencias.aoMudar(o)
                    if (sai.length) {
                        // sincrono, dentro do assinante: o estilo novo chega a janela de saida antes do slide novo
                        escrever(sai)
                        publicarPendencias()
                    }
                }
                vigiar()
            })
        )
        paradas.push(styles.subscribe(vigiar))
        paradas.push(special.subscribe(vigiar))
        // 25/nov: "Biblia com 2+ versoes" mora no modelo; mudou (inclusive por Ctrl+Z) -> reaplica o Visual
        let versoes = assinaturaDasVersoes()
        paradas.push(
            templates.subscribe(() => {
                const a = assinaturaDasVersoes()
                if (a === versoes) return
                versoes = a
                try {
                    aplicarVisualAtivo()
                } catch (e) {
                    falhaAlta("visual", e)
                }
            })
        )
    }
    // so agenda quando algo que a conferencia olha mudou (o slide no ar muda `outputs` a toda hora)
    const vigiar = () => {
        if (!migrouTela()) return
        const a = assinaturaDaConferencia()
        if (a === ultimaAssinatura) return
        ultimaAssinatura = a
        agendarConferencia()
    }
    ligar()
    return () => {
        if (t) clearTimeout(t)
        if (tConferencia) clearTimeout(tConferencia)
        for (const p of paradas) p()
    }
}
