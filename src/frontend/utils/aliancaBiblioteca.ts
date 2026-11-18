import { get } from "svelte/store"
import { history } from "../components/helpers/history"
import { openShow } from "../components/helpers/show"
import { activeEdit, activePopup, activeProject, activeShow, popupData, projects, shows } from "../stores"
import { emEditar, tela, trocarTela } from "./aliancaTela"
import { montarApresentacaoDeMidias } from "./aliancaApresentacao"
import { abaLateral, tipoDaBiblioteca } from "./aliancaBibliotecaEstado"
import { edicaoDoShow, inserirShowNoFim, itemParaVoltar, toqueRepetido, type ComandoNovo } from "./aliancaBibliotecaLogica"
import { fecharDividir } from "./aliancaDividir"
import { motivoSemCulto } from "./aliancaGaveta"
import { gravarNoDisco } from "./aliancaGravarShow"
import { newToast } from "./common"
import { getAccess } from "./profile"

// ----- AliançaShow · Preparar, fatia FV-B: efeitos da aba Biblioteca, do "+ Novo" e do "✎ Editar" -----
//
// Só COMPÕE peças que já existem (as da F6). Nenhuma delas vai para o ar. A conta está em aliancaBibliotecaLogica.ts.
// Sem `.subscribe` no nível do módulo (a janela de saída também importa a árvore de stores).

let ultimoToque: { chave: string; em: number } | null = null

/**
 * O "+" da linha: põe ESTE show no fim do culto aberto (antes do rodapé do Sirvo, se houver). Uma entrada de histórico
 * (`UPDATE`, a mesma de `porNoCulto`): um Ctrl+Z tira. Não abre o show, não mexe nas marcações da gaveta nem no
 * ponto de entrada do "Pôr no culto". Música repete: entra de novo, e o aviso diz.
 */
export function porShowNoFim(id: string): { entrou: boolean; motivo?: string } {
    const motivo = motivoSemCulto()
    if (motivo) return { entrou: false, motivo }
    const show = get(shows)[id]
    if (!show) return { entrou: false, motivo: "esse show não existe mais" }

    // o segundo "+" da mesma linha em menos de 500 ms é duplo clique, não um pedido novo
    const agora = Date.now()
    if (toqueRepetido(ultimoToque, id, agora)) return { entrou: false }
    ultimoToque = { chave: id, em: agora }

    const projetoId = get(activeProject)!
    const vivos = get(projects)[projetoId]?.shows || []
    const { lista: nova, jaEstava } = inserirShowNoFim(vivos, id)
    history({ id: "UPDATE", newData: { key: "shows", data: nova }, oldData: { id: projetoId }, location: { page: "show", id: "project_key" } })
    newToast(jaEstava ? `"${show.name}" já estava no culto; entrou de novo no fim` : `"${show.name}" entrou no fim do culto`)
    return { entrou: true }
}

/**
 * "Apresentação em branco" do "+ Novo": cria na biblioteca (SEM slides, o grid mostra o vazio padrão com o botão de criar
 * slide), grava no disco e ABRE no centro. Não entra no culto (o "+" da linha faz isso). Uma entrada de histórico (`SHOWS`):
 * o primeiro Ctrl+Z apaga o show e o arquivo. Se a aba Biblioteca está na tela, o chip passa para Apresent.
 */
export function criarApresentacaoEmBranco(): string | null {
    const { id, show } = montarApresentacaoDeMidias([], { automatico: false, nome: "Apresentação nova" })
    history({ id: "SHOWS", newData: { data: [{ id, show }], semLimpar: true }, location: { page: "show" } })
    gravarNoDisco(id)
    if (get(abaLateral) === "biblioteca") tipoDaBiblioteca.set("apresentacoes")
    openShow(id)
    // Ctrl+Z apaga o show: o centro não pode ficar apontando para ele (carregando para sempre)
    const parar = shows.subscribe((todos) => {
        if (todos[id]) return
        queueMicrotask(() => parar())
        if (get(activeShow)?.id === id) activeShow.set(null)
    })
    newToast(`"${show.name}" criada na biblioteca; o + da linha põe no culto`)
    return id
}

/**
 * "✎ Editar" do cabeçalho do show: abre o editor neste show, no último slide editado dele (ou no 0). Não mexe no
 * `activeShow`: o item do culto continua destacado ao voltar. Fecha a vista "Dividir" antes (senão o primeiro Esc do
 * editor seria gasto fechando um Dividir invisível).
 */
export function abrirEditorDoShow(showId: string) {
    fecharDividir()
    activeEdit.set(edicaoDoShow(get(activeEdit) as any, showId) as any)
    trocarTela("edit", "biblioteca-editar")
}

let voltaIniciada = false

/**
 * Preparar -> Culto: se o show aberto não é do culto, volta ao último item do culto em que se estava (ou ao primeiro).
 * Só na janela principal (chamada pelo componente da barra), só nessa passagem; sem histórico, sem tocar a saída.
 * Idempotente. Em Culto, abrir show de fora (busca) segue como sempre.
 */
export function iniciarVoltaAoRoteiro() {
    if (voltaIniciada) return
    voltaIniciada = true
    // a ultima tela que NAO e pagina do menu (Configuracoes no meio do caminho nao conta como "sair de Editar")
    let anterior: "mostrar" | "editar" = get(tela) === "editar" ? "editar" : "mostrar"
    let ultimo: { index: number; id: string } | null = null
    const lembrar = (a: any) => {
        const itens = get(projects)[get(activeProject) || ""]?.shows || []
        if (emEditar() && typeof a?.index === "number" && itens[a.index]?.id === a.id) ultimo = { index: a.index, id: a.id }
    }
    activeShow.subscribe(lembrar)
    tela.subscribe((t) => {
        if (t === "pagina") return
        const veioDoPreparar = anterior === "editar" && t === "mostrar"
        anterior = t
        if (!veioDoPreparar) return
        const itens = get(projects)[get(activeProject) || ""]?.shows || []
        const i = itemParaVoltar({ aberto: get(activeShow) as any, itens, ultimo })
        if (i !== null) activeShow.set({ id: itens[i].id, type: "show", index: i } as any)
    })
}

/** o acesso do perfil aos shows; o argumento só liga o template ao store do perfil (a chamada `getAccess` lê por `get`) */
export function acessoAosShows(_perfil?: unknown): { global?: string; [categoria: string]: string | undefined } {
    return getAccess("shows") as any
}

/** os itens do menu "+ Novo": cada um chama a ação que já existe */
export function executarComandoNovo(id: ComandoNovo) {
    if (id === "musica") {
        popupData.set({ modo: "nova" })
        activePopup.set("alianca_letra")
    } else if (id === "varias") activePopup.set("alianca_varias")
    else if (id === "apresentacao") criarApresentacaoEmBranco()
    else if (id === "importar") activePopup.set("import")
}
