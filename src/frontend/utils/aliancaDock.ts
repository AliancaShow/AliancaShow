// Leiaute v2, fatia 9: as barras de `FloatingInputs` que boiavam sobre os cartoes da biblioteca (voltar/caminho da pasta de midia, + YouTube/Vimeo,
// + efeito/overlay) assentam no rodape da area, no tema Luz. `FloatingInputs.svelte` esta no fecho da janela de saida (a ancora o vigia) e nao pode mudar:
// o estilo entra pela prop `style` que ele ja aceita, no fim do atributo, com `!important` para vencer a folha dele.
export type LadoDaBarra = "left" | "right"

export function estiloDock(lado: LadoDaBarra): string {
    return ["position: sticky", "bottom: 0", "left: auto", "right: auto", "flex: none", "margin-top: auto", "width: max-content", "border-radius: 8px", "border-color: var(--luz-borda)", "background-color: var(--luz-painel-opaco)", "box-shadow: none", "backdrop-filter: none", `align-self: ${lado === "left" ? "flex-start" : "flex-end"}`].map((d) => `${d} !important`).join(";") + ";"
}
