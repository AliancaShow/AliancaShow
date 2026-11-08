// ----- AliançaShow · texto de fora dentro de uma dica (data-title) -----
//
// A dica do FreeShow (components/main/Tooltip.svelte) desenha o `data-title`
// com {@html}: é assim que as dicas do upstream mostram <b>. Texto que vem do
// Sirvo (nome do culto, nome do bloco, link) digitado por qualquer líder
// viraria HTML dentro do Show. Todo `data-title` com texto de fora passa aqui.

const ENTIDADES: { [c: string]: string } = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }

/** o texto como TEXTO na dica: escapa o que o {@html} leria como marcação */
export function dicaSegura(texto: string | null | undefined) {
    return String(texto ?? "").replace(/[&<>"']/g, (c) => ENTIDADES[c])
}
