// Chamadas (André, 24/nov: Kids, Estacionamento). Logica pura (testada em aliancaChamadasLogica.test.ts).
// Uma chamada e uma SOBREPOSICAO do FreeShow com `aliancaChamada` (o texto-modelo com [campos], a posicao e as saidas). Ao chamar, o texto
// com os campos preenchidos vai para a caixa da sobreposicao e ela entra nas saidas escolhidas; a saida nao muda (nada aqui e do fecho).

export type Posicao = "faixa" | "canto" | "centro" | "livre"

export interface DadosDaChamada {
    modelo: string
    posicao: Posicao
    saidas: string[]
}

export const POSICOES: { id: Posicao; rotulo: string }[] = [
    { id: "faixa", rotulo: "Faixa embaixo" },
    { id: "canto", rotulo: "Canto" },
    { id: "centro", rotulo: "Centro" },
    { id: "livre", rotulo: "Livre…" }
]

/** segundos (0 = ate tirar) */
export const DURACOES: { s: number; rotulo: string }[] = [
    { s: 30, rotulo: "30 s" },
    { s: 60, rotulo: "1 min" },
    { s: 120, rotulo: "2 min" },
    { s: 0, rotulo: "Até tirar" }
]
export const DURACAO_PADRAO = 60
export const VAZIO = "__"
export const LIMITE_CAMPO = 40

export const CHAMADAS_PADRAO: { nome: string; modelo: string; cor: string }[] = [
    { nome: "Kids", modelo: "Pais da criança [número], favor comparecer ao Kids", cor: "#e63946" },
    { nome: "Estacionamento", modelo: "Dono do [carro] placa [placa], favor comparecer ao carro", cor: "#e63946" }
]

/** os [campos] do texto, na ordem, sem repetir (o nome e o que esta entre colchetes, aparado) */
export function camposDoModelo(modelo: string): string[] {
    const vistos: string[] = []
    for (const m of String(modelo || "").matchAll(/\[([^\[\]]+)\]/g)) {
        const nome = m[1].trim()
        if (nome && !vistos.some((v) => v.toLowerCase() === nome.toLowerCase())) vistos.push(nome)
    }
    return vistos
}

/** o texto que vai ao telao: cada [campo] vira o valor digitado (vazio vira "__"); espacos sobrando somem */
export function montarTexto(modelo: string, valores: Record<string, string>): string {
    const porNome = new Map(Object.entries(valores || {}).map(([k, v]) => [k.trim().toLowerCase(), String(v ?? "").trim()]))
    return String(modelo || "")
        .replace(/\[([^\[\]]+)\]/g, (_, nome: string) => porNome.get(nome.trim().toLowerCase()) || VAZIO)
        .replace(/\s+/g, " ")
        .trim()
}

/** pode chamar: tem texto e todo campo foi preenchido */
export function prontaParaChamar(modelo: string, valores: Record<string, string>): boolean {
    if (!String(modelo || "").trim()) return false
    return camposDoModelo(modelo).every((c) => !!String(valores?.[c] ?? "").trim())
}

/** rotulo do campo no painel: primeira letra maiuscula */
export const rotuloDoCampo = (nome: string) => (nome ? nome[0].toUpperCase() + nome.slice(1) : nome)

/** "0:58" (para o NO AR); null se nao tem fim */
export function restante(ateMs: number | null, agoraMs: number): string | null {
    if (!ateMs) return null
    const s = Math.max(0, Math.ceil((ateMs - agoraMs) / 1000))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/** caixa da sobreposicao (1920x1080) para cada posicao pronta; "livre" devolve null (fica o que foi ajustado no Editar) */
export function caixaDaPosicao(posicao: Posicao, cor: string): { style: string; align: string; alinhamentoLinha: string; estiloTexto: string } | null {
    const fundo = `background-color:${cor || "#e63946"};`
    const texto = "font-weight:bold;color:#FFFFFF;"
    if (posicao === "faixa") return { style: `top:880px;left:0px;width:1920px;height:200px;${fundo}`, align: "", alinhamentoLinha: "text-align: center;", estiloTexto: `font-size:70px;${texto}` }
    if (posicao === "canto") return { style: `top:40px;left:1200px;width:680px;height:260px;${fundo}border-radius:24px;`, align: "", alinhamentoLinha: "text-align: center;", estiloTexto: `font-size:52px;${texto}` }
    if (posicao === "centro") return { style: `top:290px;left:210px;width:1500px;height:500px;${fundo}border-radius:32px;`, align: "", alinhamentoLinha: "text-align: center;", estiloTexto: `font-size:90px;${texto}` }
    return null
}

/** a sobreposicao (itens) de uma chamada com o texto dado. Com "livre", reaproveita a caixa e os estilos que ja existem */
export function itensDaChamada(atuais: any[] | undefined, posicao: Posicao, cor: string, texto: string): any[] {
    const caixa = caixaDaPosicao(posicao, cor)
    const velho = Array.isArray(atuais) && atuais.length ? atuais : null
    const base = velho ? JSON.parse(JSON.stringify(velho)) : []
    const iTexto = base.findIndex((i: any) => Array.isArray(i?.lines))
    if (!caixa && iTexto >= 0) {
        const it = base[iTexto]
        const estilo = it.lines[0]?.text?.[0]?.style || "font-size:70px;font-weight:bold;color:#FFFFFF;"
        it.lines = [{ align: it.lines[0]?.align ?? "text-align: center;", text: [{ value: texto, style: estilo }] }]
        return base
    }
    const c = caixa || (caixaDaPosicao("faixa", cor) as NonNullable<ReturnType<typeof caixaDaPosicao>>)
    return [{ type: "text", style: c.style, align: c.align, lines: [{ align: c.alinhamentoLinha, text: [{ value: texto, style: c.estiloTexto }] }] }]
}

/** a cor de fundo da caixa (para manter ao trocar a posicao) */
export function corDaCaixa(itens: any[] | undefined, padrao = "#e63946"): string {
    const estilo = String((itens || []).find((i: any) => Array.isArray(i?.lines))?.style || "")
    return estilo.match(/background-color:\s*([^;]+);?/)?.[1]?.trim() || padrao
}

/** saidas validas de uma chamada: so as normais (nao retorno) que existem; vazio = todas as normais */
export function saidasDaChamada(saidas: string[] | undefined, todas: Record<string, any>): string[] {
    const normais = Object.entries(todas || {})
        .filter(([, o]) => o && !o.stageOutput && !o.isKeyOutput)
        .map(([id]) => id)
    const escolhidas = (saidas || []).filter((id) => normais.includes(id))
    return escolhidas.length ? escolhidas : saidas?.length ? [] : normais
}

/** nome livre para uma chamada nova */
export function nomeNovo(existentes: string[], base = "Chamada"): string {
    const tem = (n: string) => existentes.some((e) => e.trim().toLowerCase() === n.toLowerCase())
    if (!tem(base)) return base
    let i = 2
    while (tem(`${base} ${i}`)) i++
    return `${base} ${i}`
}
