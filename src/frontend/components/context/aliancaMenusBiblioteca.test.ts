import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { contextMenuItems } from "./contextMenus"
import { NOVOS, REMOVIDOS, semDestinoPorLayout } from "./aliancaMenusBibliotecaLayouts"

// os layouts ANTIGOS, lidos do texto de contextMenus.ts (o modulo de registro troca os do mapa vivo ao ser importado)
const fonte = readFileSync(join(__dirname, "contextMenus.ts"), "utf8")
function antigoDe(layout: string): string[] | null {
    const ini = fonte.indexOf(`
    ${layout}: [`)
    if (ini < 0) return null
    const abre = fonte.indexOf("[", ini)
    const m = [null, fonte.slice(abre + 1, fonte.indexOf("]", abre))]
    return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null
}

describe("menus da biblioteca e do roteiro (fatia 6)", () => {
    it("o registro troca os layouts e acende a falha alta de quem ficou sem destino (a conta e do outro arquivo; o modulo so a chama)", () => {
        const reg = readFileSync(join(__dirname, "aliancaMenusBiblioteca.ts"), "utf8")
        expect(reg).toContain("Object.assign(contextMenuLayouts, NOVOS)")
        expect(reg).toMatch(/semDestinoPorLayout\(antigos\)[\s\S]*falhaAlta\("menu-biblioteca"/)
    })
    it("todo item do menu novo existe em contextMenuItems (ou e separador/grupo)", () => {
        const itensDaFatia = ["alianca_roteiro", "alianca_agora", "alianca_agora_item", "alianca_subir", "alianca_descer", "alianca_tirar", "alianca_titulo", "alianca_novo_bloco", "alianca_tirar_bib", "alianca_apagar_pc", "alianca_apagar_show", "alianca_cat_props"]
        const registrados = readFileSync(join(__dirname, "aliancaMenusBiblioteca.ts"), "utf8") + readFileSync(join(__dirname, "aliancaMenusEditar.ts"), "utf8")
        for (const [layout, itens] of Object.entries(NOVOS))
            for (const i of itens) {
                if (i === "SEPARATOR" || i.startsWith("GROUP_")) continue
                const existe = !!contextMenuItems[i] || (itensDaFatia.includes(i) && registrados.includes(`${i}:`)) || i === "alianca_editar" || i === "alianca_mover" || i === "alianca_fim" || i === "alianca_camada"
                expect(existe, `${layout}: ${i}`).toBe(true)
            }
    })
    it("todo item do menu ANTIGO esta no novo ou declarado em REMOVIDOS, com o destino escrito", () => {
        const antigos: { [k: string]: string[] } = {}
        for (const k of Object.keys(NOVOS)) {
            const a = antigoDe(k)
            if (a) antigos[k] = a
        }
        // show_drawer e project_effect nasceram aqui (o FreeShow nao tinha menu para eles); alianca_categoria e a categoria de midia (cabine 27/nov)
        expect(
            Object.keys(NOVOS)
                .filter((k) => !antigos[k])
                .sort()
        ).toEqual(["alianca_categoria", "project_effect", "show_drawer", "stream_card"])
        expect(semDestinoPorLayout(antigos)).toEqual({})
        for (const [layout, declarados] of Object.entries(REMOVIDOS)) for (const [item, destino] of Object.entries(declarados)) expect(destino.length, `${layout}.${item}`).toBeGreaterThan(5)
    })
    it("mutacao: um item antigo a mais, sem declaracao, e acusado", () => {
        const antigos: { [k: string]: string[] } = { media_card: [...(antigoDe("media_card") || []), "item_novo_do_upstream"] }
        expect(semDestinoPorLayout(antigos).media_card).toEqual(["item_novo_do_upstream"])
    })
    it("so os itens deliberados vao ao ar (Mostrar agora / play do roteiro)", () => {
        const aoAr = ["alianca_agora", "alianca_agora_item", "play_no_audio", "play_no_filters"]
        for (const itens of Object.values(NOVOS)) for (const i of itens) if (/^play($|_no_)|agora/.test(i)) expect(aoAr).toContain(i)
    })
    it('revisao da fatia 6, achado 1: "Mostrar agora" num versiculo chama playScripture() direto, nunca refaz o duplo clique (que com a Biblia no ar devolve false)', () => {
        const reg = readFileSync(join(__dirname, "aliancaMenusBiblioteca.ts"), "utf8")
        expect(reg).not.toMatch(/dispararNoAlvo\([^)]*"dblclick"/)
        expect(reg).toMatch(/startsWith\("#scripture"\)[\s\S]{0,260}playScripture\(\)/)
        expect(reg).toMatch(/closest\?\.\("\.verse"\)/)
    })
    it("revisao da fatia 6, achado 2: o registro arma o anteparo no clique do menu e engole os toques sobre o retangulo que ele ocupava", () => {
        const reg = readFileSync(join(__dirname, "aliancaMenusBiblioteca.ts"), "utf8")
        expect(reg).toContain("criarAnteparo(")
        expect(reg).toMatch(/anteparo\.armar\(menu\.getBoundingClientRect\(\)/)
        for (const t of ["mousedown", "mouseup", "click", "dblclick"]) expect(reg, t).toContain(`"${t}"`)
        expect(reg).toMatch(/anteparo\.engole\([\s\S]{0,400}stopImmediatePropagation\(\)/)
    })
    it('revisao da fatia 6, achado 3: "Tirar do roteiro" passa pela porta do Delete (deleteAction), nao grava a lista na mao', () => {
        const reg = readFileSync(join(__dirname, "aliancaMenusBiblioteca.ts"), "utf8")
        const tirar = reg.slice(reg.indexOf("function tirar("), reg.indexOf("const ACOES"))
        expect(tirar).toContain('deleteAction({ id: "show", data: [{ index: r.indice }] })')
        expect(tirar).not.toContain("gravarLista")
    })
    it("revisao da fatia 6, achado 5: o menu do roteiro confere o data-id do botao e recusa com aviso (nao falha alta) se o roteiro mudou", () => {
        const reg = readFileSync(join(__dirname, "aliancaMenusBiblioteca.ts"), "utf8")
        const f = reg.slice(reg.indexOf("function itemDoRoteiro("), reg.indexOf("function roteiroTravado"))
        expect(f).toContain('marca(contextElem, "data-id")')
        expect(f).toContain("itemContinuaLa(lista, indice, idMarcado)")
        expect(f).toMatch(/itemContinuaLa[\s\S]*newToast\("O roteiro mudou/)
        const rot = readFileSync(join(__dirname, "../main/AliancaRoteiro.svelte"), "utf8")
        expect(rot).toContain("data-id={cab.item.id}")
        expect(rot).toContain("data-id={l.item.id}")
    })
    it("revisao da fatia 6, achado 6: Mostrar agora dispara o clique no item (alvoDoItem), nunca no elemento mais interno do botao direito (ultimoAlvo)", () => {
        const reg = readFileSync(join(__dirname, "aliancaMenusBiblioteca.ts"), "utf8")
        expect(reg).toContain("function alvoDoItem(")
        expect(reg).toContain('dispararNoAlvo(item, "click")')
        expect(reg).toContain('newToast("A lista mudou. Abra o menu de novo.")')
        expect(reg).toContain("const item = alvoDoItem(contextElem)")
        expect(reg).not.toMatch(/dispararNoAlvo\(alvo,/)
    })
    it("revisao da fatia 6, achado 9: Mostrar agora num cartao que ja esta no ar (.main.active) nao refaz o clique (que alterna e tira do ar)", () => {
        const reg = readFileSync(join(__dirname, "aliancaMenusBiblioteca.ts"), "utf8")
        expect(reg).toMatch(/closest\("\.main\.active"\)[\s\S]{0,80}newToast\("Já está no ar"\)[\s\S]*dispararNoAlvo\(item, "click"\)/)
        const card = readFileSync(join(__dirname, "../drawer/Card.svelte"), "utf8")
        expect(card).toContain("class:active")
    })
    it("revisao da fatia 6, achado 10: a selecao que sumiu entre o botao direito e o clique avisa o operador (a falha alta fica para defeito de codigo)", () => {
        const reg = readFileSync(join(__dirname, "aliancaMenusBiblioteca.ts"), "utf8")
        expect(reg).not.toMatch(/nada selecionado para pôr no roteiro/)
        expect(reg).toContain('newToast("A seleção mudou. Abra o menu de novo.")')
    })
    it("revisao da fatia 6, achado 11: Mostrar agora de um show do roteiro aplica o leiaute do item, abre o item no centro e so entao manda ao ar", () => {
        const reg = readFileSync(join(__dirname, "aliancaMenusBiblioteca.ts"), "utf8")
        expect(reg).toMatch(/swichProjectItem\(indice, item\.id\)[\s\S]{0,120}abrirItemDoRoteiro\(item, indice\)[\s\S]{0,120}tocarShowNoAr\(item\.id/)
    })
    it("revisao da fatia 6, achado 12: nenhum REMOVIDOS diz que a previa e o clique simples (o clique so seleciona e nao abre no centro): a falta e declarada", () => {
        for (const [layout, declarados] of Object.entries(REMOVIDOS))
            for (const [item, destino] of Object.entries(declarados)) {
                expect(destino, `${layout}.${item}`).not.toMatch(/a previa e o clique simples/)
                if (item === "preview" || /previa/i.test(destino)) expect(destino, `${layout}.${item}`).toContain("SEM SUBSTITUTO")
            }
    })
    it("revisao da fatia 6, achado 13: as travas do roteiro vem de motivoDaTrava (Novo bloco so recusa roteiro travado; tirar/mover/titulo recusam cabecalho e rodape do Sirvo)", () => {
        const reg = readFileSync(join(__dirname, "aliancaMenusBiblioteca.ts"), "utf8")
        expect(reg).toContain("motivoDaTrava(get(projects)[projetoId], item, acao,")
        const novo = reg.slice(reg.indexOf("alianca_novo_bloco: ({ contextElem })"))
        expect(novo).toContain('roteiroTravado(r.projetoId, r.item, "novo")')
    })
})

describe('cabine 18/nov, A11: o menu da midia nao tem "Mostrar agora (sem pôr no roteiro)" (o ▶ do cartao ja faz isso)', () => {
    it("media_card nao traz alianca_agora; os outros layouts de biblioteca seguem com ele", () => {
        expect(NOVOS.media_card).not.toContain("alianca_agora")
        expect(NOVOS.show_drawer).toContain("alianca_agora")
        expect(NOVOS.overlay_card).toContain("alianca_agora")
    })
})
