// ----- AliançaShow · quais shows embutidos instalar (lógica pura) -----
//
// O instalador leva a biblioteca de músicas em `bundled-shows/`. Antes, cada
// abertura do app copiava de novo todo .show embutido cujo NOME de arquivo não
// existisse na pasta do usuário. Duas consequências:
//   - apagar uma música embutida (uma duplicada, por exemplo) não durava: ela
//     voltava na abertura seguinte;
//   - renomear uma música embutida criava uma gêmea com o MESMO id (o arquivo
//     velho voltava com o nome antigo), e o FreeShow indexa por id.
//
// Agora cada embutido é instalado UMA vez. O que já foi instalado fica anotado
// (por arquivo e por id) e não volta mais, mesmo se o usuário apagar. E nunca
// se copia um show cujo id já está na biblioteca, venha de onde vier.

/** O que já foi resolvido nesta pasta de shows: nome do arquivo embutido → id do show. */
export type EmbutidosResolvidos = { [arquivo: string]: string }

export type DecisaoEmbutido =
    /** já foi instalado (ou resolvido) antes: não volta, mesmo se o usuário apagou */
    | "ja_resolvido"
    /** a biblioteca já tem um show com esse id (renomeado ou instalado por outro caminho) */
    | "id_na_biblioteca"
    /** já existe um arquivo com esse nome (outro show): nunca sobrescreve */
    | "nome_ocupado"
    /** nunca foi instalado e não está na biblioteca: copia */
    | "copiar"

/** Só o nome do arquivo: dá para decidir sem ler o .show embutido? */
export function jaResolvidoPeloArquivo(arquivo: string, resolvidos: EmbutidosResolvidos): boolean {
    return Object.prototype.hasOwnProperty.call(resolvidos, arquivo)
}

/**
 * Decide um embutido. `id` nulo = não deu para ler o id do arquivo: cai na
 * regra antiga (só pelo nome), para não perder a música por um arquivo estranho.
 * `arquivosNaBiblioteca` deve vir em minúsculas (Windows e macOS não distinguem).
 */
export function decidirEmbutido(embutido: { arquivo: string; id: string | null }, ctx: { resolvidos: EmbutidosResolvidos; idsNaBiblioteca: Set<string>; arquivosNaBiblioteca: Set<string> }): DecisaoEmbutido {
    if (jaResolvidoPeloArquivo(embutido.arquivo, ctx.resolvidos)) return "ja_resolvido"
    if (embutido.id && Object.values(ctx.resolvidos).includes(embutido.id)) return "ja_resolvido"
    if (embutido.id && ctx.idsNaBiblioteca.has(embutido.id)) return "id_na_biblioteca"
    if (ctx.arquivosNaBiblioteca.has(embutido.arquivo.toLowerCase())) return "nome_ocupado"
    return "copiar"
}

/**
 * Planeja a instalação inteira. Toda decisão diferente de "copiar" também é
 * anotada como resolvida: o que existia na biblioteca quando o embutido chegou
 * conta como instalado, e se depois for apagado, é porque o usuário quis.
 * Devolve o que copiar e o mapa novo de resolvidos (o antigo não é alterado).
 */
export function planejarEmbutidos(embutidos: { arquivo: string; id: string | null }[], ctx: { resolvidos: EmbutidosResolvidos; idsNaBiblioteca: Set<string>; arquivosNaBiblioteca: Set<string> }): { copiar: string[]; resolvidos: EmbutidosResolvidos; mudou: boolean } {
    const resolvidos: EmbutidosResolvidos = { ...ctx.resolvidos }
    const ids = new Set(ctx.idsNaBiblioteca)
    const arquivos = new Set(ctx.arquivosNaBiblioteca)
    const copiar: string[] = []
    let mudou = false

    for (const e of embutidos) {
        const decisao = decidirEmbutido(e, { resolvidos, idsNaBiblioteca: ids, arquivosNaBiblioteca: arquivos })
        if (decisao === "ja_resolvido") continue
        if (decisao === "copiar") {
            copiar.push(e.arquivo)
            // dois embutidos com o mesmo id: só o primeiro entra
            if (e.id) ids.add(e.id)
            arquivos.add(e.arquivo.toLowerCase())
        }
        resolvidos[e.arquivo] = e.id || ""
        mudou = true
    }

    return { copiar, resolvidos, mudou }
}
