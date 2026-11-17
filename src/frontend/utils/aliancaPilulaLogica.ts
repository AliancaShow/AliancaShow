// 1a, D2: a pilula, os chips e o anteparo de 700 ms do Preparar. Puro (nao importa store nem componente).

/** o anteparo (D2): depois de um chip levar ao Culto, o gesto que COMECA dentro desta janela e engolido inteiro */
export const ANTEPARO_MS = 700

// ---------------------------------------------------------------- a pilula

export type MaterialDoSirvo = { habilitado: boolean | null; naFila: number; falhas: { id?: string; nome: string }[] }

/** "nao chegou" = na fila ou com falha (`baixando` nao entra); so com o material habilitado (null = ainda nao carregou, false = a chave nao baixa) */
export function naoChegou(e: MaterialDoSirvo | null | undefined): number {
    if (!e || e.habilitado !== true) return 0
    return (Number(e.naFila) || 0) + (e.falhas?.length || 0)
}

export type TextoDaPilula = { texto: string; pronto: boolean }

/** `N pra conferir · K sem letra · W não chegou` (so as partes maiores que zero); tudo zero = `tudo pronto ✓` */
export function textoDaPilula(p: { conferir: number; semLetra: number; naoChegou: number }): TextoDaPilula {
    const partes: string[] = []
    if (p.conferir > 0) partes.push(`${p.conferir} pra conferir`)
    if (p.semLetra > 0) partes.push(`${p.semLetra} sem letra`)
    if (p.naoChegou > 0) partes.push(`${p.naoChegou} não chegou`)
    if (!partes.length) return { texto: "tudo pronto ✓", pronto: true }
    return { texto: partes.join(" · "), pronto: false }
}

/** a pilula so e clicavel quando ha algo para abrir (conferir ou sem letra); so "nao chegou" nao abre item */
export function pilulaClicavel(p: { conferir: number; semLetra: number }): boolean {
    return p.conferir > 0 || p.semLetra > 0
}

/** dica (data-title): conferir e sem letra sao do projeto aberto; "nao chegou" e do culto que o Sirvo segue */
export function dicaDaPilula(p: { conferir: number; semLetra: number }, e: MaterialDoSirvo | null | undefined): string {
    const linhas = ["Conferir e sem letra: do projeto aberto. Clique abre o primeiro."]
    const n = naoChegou(e)
    if (n > 0) {
        const nomes = (e?.falhas || []).map((f) => f.nome)
        let t = "Não chegou: do culto que o Sirvo segue (na fila ou com falha)."
        if (nomes.length) t += " Falhou: " + nomes.slice(0, 5).join(", ") + (nomes.length > 5 ? ` e mais ${nomes.length - 5}` : "") + "."
        linhas.push(t)
    }
    return linhas.join("\n")
}

/** o 1o indice que precisa conferir; se nenhum, o 1o sem letra; senao null */
export function primeiroPendente(total: number, ehConferir: (i: number) => boolean, ehSemLetra: (i: number) => boolean): number | null {
    for (let i = 0; i < total; i++) if (ehConferir(i)) return i
    for (let i = 0; i < total; i++) if (ehSemLetra(i)) return i
    return null
}

// ---------------------------------------------------------------- os chips

export type AvisosDoSirvo = { linhas: unknown[]; anteriores: boolean }
export type Chip = { id: "roteiro" | "chat" | "desenho"; texto: string; titulo: string }

export function chipRoteiro(a: AvisosDoSirvo | null | undefined): Chip | null {
    const n = a?.linhas?.length || 0
    if (!(n > 0 || a?.anteriores)) return null
    return { id: "roteiro", texto: n > 0 ? `Roteiro mudou · ${n}` : "Roteiro mudou", titulo: "O roteiro do Sirvo mudou. Vai ao Culto, onde o aviso espera." }
}

export type ChatDoSirvo = { naoLidas: number; cultoId: string | null; ligado: boolean; congelado: boolean }
export function chipChat(c: ChatDoSirvo | null | undefined, cultoSeguido: string | null | undefined): Chip | null {
    if (!c || !(c.naoLidas > 0) || !cultoSeguido || c.cultoId !== cultoSeguido || !(c.ligado || c.congelado)) return null
    return { id: "chat", texto: `Chat · ${c.naoLidas} ${c.naoLidas === 1 ? "nova" : "novas"}`, titulo: "Mensagens novas do chat do culto. Vai ao Culto, onde ele abre." }
}

/** desenho no telao: preencher, zoom diferente de 100 ou pintura (a mesma conta da bolinha vermelha do Desenhar no Culto) */
export function desenhoAtivo(drawTool: string | null | undefined, drawSettings: any, paintCache: unknown[] | null | undefined): boolean {
    return drawTool === "fill" || (drawTool === "zoom" && drawSettings?.zoom?.size !== 100) || !!(drawTool === "paint" && paintCache?.length)
}

export function chipDesenho(ativo: boolean): Chip | null {
    return ativo ? { id: "desenho", texto: "Desenho ativo", titulo: "Há um desenho ativo no telão. Vai ao Culto para limpar." } : null
}

// ---------------------------------------------------------------- o anteparo

export type ContextoDeGesto = { agora: number; ate: number; naBarra: boolean; naEsquerda: boolean }

/** engole so o gesto que COMECA dentro da janela, sobre a barra, fora do seletor de modo (a esquerda). `<` estrito: aos 700 ms exatos passa */
export function deveEngolir(c: ContextoDeGesto): boolean {
    return c.agora < c.ate && c.naBarra && !c.naEsquerda
}

export type TipoDeEvento = "pointerdown" | "mousedown" | "mouseup" | "click" | "dblclick" | "contextmenu" | "keydown"
export const TIPOS_DO_ANTEPARO: TipoDeEvento[] = ["pointerdown", "mousedown", "mouseup", "click", "dblclick", "contextmenu", "keydown"]

/**
 * O relogio so e lido na DECISAO do inicio do gesto (pointerdown, ou mousedown sem pointerdown antes). O resto do gesto
 * (mouseup, click, dblclick, contextmenu) herda a decisao, mesmo que passe de 700 ms. Tecla nunca e engolida e zera a decisao.
 */
export function criarDecisorDeGesto() {
    let engolindo = false
    let pointerVisto = false
    return {
        aoEvento(tipo: TipoDeEvento, contexto: ContextoDeGesto): boolean {
            switch (tipo) {
                case "pointerdown":
                    engolindo = deveEngolir(contexto)
                    pointerVisto = true
                    return engolindo
                case "mousedown":
                    if (pointerVisto) {
                        pointerVisto = false
                        return engolindo
                    }
                    engolindo = deveEngolir(contexto)
                    return engolindo
                case "keydown":
                    engolindo = false
                    return false
                default:
                    return engolindo
            }
        }
    }
}
