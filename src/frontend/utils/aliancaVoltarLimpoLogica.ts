/** Menu do telao, item "Voltar o que foi limpo" (restoreOutput): o motivo de estar indisponivel, em texto. "" = disponivel. */
export function motivoVoltarLimpo(e: { travada: boolean; haCache: boolean; pronto: boolean }): string {
    if (e.travada) return "A saída está travada. Destrave para voltar o que foi limpo."
    if (!e.haCache) return "Nada foi limpo ainda."
    if (!e.pronto) return "Espere um instante."
    return ""
}
