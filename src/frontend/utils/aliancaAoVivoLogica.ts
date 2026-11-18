// Leiaute v2, roteiro: a faixa AO VIVO. Pura. Fatia 1: acende quando o telao esta soltando alguma coisa (a saida ligada); resposta do
// dono (17/nov): "Sirvo iniciado" NAO acende e o horario da agenda tambem nao. O motivo e o texto depois do "AO VIVO".
export type EntradaAoVivo = { telaoLigado: boolean }
export type FaixaAoVivo = { aceso: boolean; motivo: string }

export function faixaAoVivo(e: EntradaAoVivo): FaixaAoVivo {
    return e.telaoLigado ? { aceso: true, motivo: "telão ligado" } : { aceso: false, motivo: "" }
}
