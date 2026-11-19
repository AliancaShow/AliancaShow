// Cabine 4, pedido 2: o campo de numero COM REGUA da prancha C4 (o controle deslizante mora dentro do campo, com - e + de 22 px).
// Aqui mora so a conta (pura); o componente e components/main/AliancaCampoNumero.svelte. Mesmo contrato do MaterialNumberInput (que a saida usa).

/** Texto digitado -> numero. Aceita virgula e conta simples (+ - * / parenteses), como o campo de antes; qualquer outra coisa e invalida (null). */
export function lerNumero(texto: string | number): number | null {
    if (typeof texto === "number") return Number.isFinite(texto) ? texto : null
    const t = String(texto).replace(/,/g, ".").trim()
    if (!t || !/^[0-9+\-*/().\s]+$/.test(t)) return null
    try {
        const v = new Function(`return (${t})`)()
        return typeof v === "number" && Number.isFinite(v) ? v : null
    } catch {
        return null
    }
}

/** Preso em [min, max] (null = sem limite daquele lado) e arredondado para `casas` casas. */
export function prender(v: number, min: number | null, max: number | null, casas = 2): number {
    let r = v
    if (min !== null) r = Math.max(min, r)
    if (max !== null) r = Math.min(max, r)
    return Number(r.toFixed(casas))
}

/** Valor mostrado no campo: sem zeros sobrando ("1,10" vira 1.1), com no maximo `casas` casas. */
export function mostrarNumero(v: number, casas = 2): string {
    return String(Number(Number(v || 0).toFixed(casas)))
}

/** 0..1 da posicao do valor na regua; regua sem extensao = 0. */
export function fracaoNaRegua(v: number, min: number, max: number): number {
    if (!(max > min)) return 0
    return Math.min(1, Math.max(0, (v - min) / (max - min)))
}

/** A regua so aparece com os dois extremos conhecidos (e nao absurdos): sem teto, so os botoes. `showSlider: false` desliga, `true` pede. */
export function temRegua(showSlider: boolean | undefined | null, min: number | null, max: number | null, sliderMin?: number, sliderMax?: number): boolean {
    if (showSlider === false) return false
    const lo = sliderMin ?? min
    const hi = sliderMax ?? max
    if (lo === null || lo === undefined || hi === null || hi === undefined) return false
    return hi > lo
}

/** Uma linha de campos em que TODOS sao numero: cada um que tem regua ganha a linha toda (regua precisa de largura). */
export function linhaSoDeNumeros(tipos: string[]): boolean {
    return tipos.length > 0 && tipos.every((t) => t === "number")
}

/** O valor esta fora do padrao? (o pontinho do rotulo). Sem padrao conhecido = nunca marca. */
export function mudouDoPadrao(valor: number, padrao: number | null | undefined): boolean {
    if (padrao === null || padrao === undefined || Number.isNaN(Number(padrao))) return false
    return Number(valor) !== Number(padrao)
}
