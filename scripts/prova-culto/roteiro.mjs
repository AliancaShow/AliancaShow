// Roteiro de gestos da prova do Culto. Entrada: perfil de teste restaurado (`restaurar.sh`), show `impulso_aos_teus_pes`.
// Cada passo declara `alvo` (para gestos de mouse) e `efeito` (o minimo que TEM de acontecer) ou `semEfeito: "motivo"`.
// Cliques e teclas sao REAIS (Input.dispatch*), nunca force. A preparacao (`antes`) usa store e fica FORA da janela gravada.
// A troca de modo (Culto/Preparar) e clique real no botao de `AliancaModo.svelte`.
//
// efeito: { fluxo: "outputs" | "estado" | "saida" | "ipc", n } -- outputs: n escritas que MUDARAM o valor; estado: n mudancas de
// activePage/activeShow/...; saida: o telao mudou (hash do html); ipc: n canais nao periodicos tocados.

export const VERSAO = 1
export const ID_SHOW = "impulso_aos_teus_pes"

const ABRE_SHOW = `S.activePopup.set(null); S.modoAlianca.set("culto"); S.editMode.set("default");
S.outputs.update(a=>{a.default.out={};return a});
const {loadShows}=await import(U("components/helpers/setShow")); await loadShows([${JSON.stringify(ID_SHOW)}]);
S.activeShow.set({id:${JSON.stringify(ID_SHOW)},type:"show"}); S.activePage.set("show");
S.drawer.set({height:300,stored:null}); S.resized.update(a=>({...a,leftPanel:290,rightPanel:290,leftPanelDrawer:290,rightPanelDrawer:290})); S.activeDrawerTab.set("shows");
document.activeElement?.blur?.(); await esp(900)`

const SLIDE = (i) => `document.querySelectorAll("#showArea .slide")[${i}]`
const BOTAO_MODO = (nome) => `[...document.querySelectorAll("button")].find(b=>b.innerText.trim()===${JSON.stringify(nome)} && b.closest("header, .top, nav, div"))`
// os botoes da `.clear` mudam de posicao conforme o estado (o de restaurar so aparece depois de limpar): acha-se pelo marcador do titulo
const LIMPA = (m) => `[...document.querySelector(".clear").querySelectorAll("button")].find(b=>((b.getAttribute("data-title")||"")+" "+b.innerText).includes(${JSON.stringify(m)}))`

export const SECOES = [
    {
        id: "A",
        titulo: "Slides e teclado (Culto)",
        preparar: ABRE_SHOW,
        passos: [
            { id: "A01-clique-slide-1", alvo: SLIDE(0), gesto: { clique: true }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "A02-clique-slide-2", alvo: SLIDE(1), gesto: { clique: true }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "A03-seta-direita", gesto: { tecla: "ArrowRight" }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "A04-seta-esquerda", gesto: { tecla: "ArrowLeft" }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "A05-espaco", gesto: { tecla: " " }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "A06-page-down", gesto: { tecla: "PageDown" }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "A07-page-up", gesto: { tecla: "PageUp" }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "A08-home", gesto: { tecla: "Home" }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "A09-end", gesto: { tecla: "End" }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "A10-digito-1", antes: "S.activePage.set('show'); await esp(300)", gesto: { tecla: "1" }, semEfeito: "ja esta na pagina Mostrar: o digito 1 nao troca nada (a fatia 1b declara a diferenca)" },
            { id: "A11-digito-2", antes: "S.activePage.set('show'); await esp(300)", gesto: { tecla: "2" }, efeito: { fluxo: "estado", n: 1 } },
            { id: "A12-digito-3", antes: "S.activePage.set('show'); await esp(300)", gesto: { tecla: "3" }, efeito: { fluxo: "estado", n: 1 } },
            { id: "A13-digito-4", antes: "S.activePage.set('show'); await esp(300)", gesto: { tecla: "4" }, efeito: { fluxo: "estado", n: 1 } },
            { id: "A14-digito-5", antes: "S.activePage.set('show'); await esp(300)", gesto: { tecla: "5" }, efeito: { fluxo: "estado", n: 1 } },
            { id: "A15-digito-6", antes: "S.activePage.set('show'); await esp(300)", gesto: { tecla: "6" }, efeito: { fluxo: "estado", n: 1 } },
            { id: "A16-escape", antes: "S.activePage.set('show'); await esp(300)", gesto: { tecla: "Escape" }, efeito: { fluxo: "outputs", n: 1 } }
        ]
    },
    {
        id: "B",
        titulo: "Limpar (uma camada por vez, tudo, restaurar)",
        preparar: `${ABRE_SHOW}`,
        // fundo + slide + sobreposicao no ar (o slide por clique real no 1o passo de cada rodada)
        passos: [
            { id: "B01-pe-slide", alvo: SLIDE(2), gesto: { clique: true }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "B02-limpar-fundo", antes: "await MAIN_FUNDO()", alvo: LIMPA("[F1]"), gesto: { clique: true }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "B03-limpar-slide", alvo: LIMPA("[F2]"), gesto: { clique: true }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "B04-repor-tudo", antes: "await MAIN_TUDO()", gesto: { tecla: "F3" }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "B05-limpar-sobreposicao", antes: "await MAIN_TUDO()", alvo: LIMPA("[F3]"), gesto: { clique: true }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "B06-tecla-f4-audio", antes: "await MAIN_TUDO()", gesto: { tecla: "F4" }, semEfeito: "o perfil de teste nao tem audio tocando: F4 so limpa audio (NAO testado com audio real); o botao de audio nasce desabilitado" },
            { id: "B07-limpar-tudo", antes: "await MAIN_TUDO()", alvo: LIMPA("[esc]"), gesto: { clique: true }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "B08-restaurar", antes: "await esp(2500)", alvo: LIMPA("Restaurar"), gesto: { clique: true }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "B09-tecla-f1", antes: "await MAIN_TUDO()", gesto: { tecla: "F1" }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "B10-tecla-f2", antes: "await MAIN_TUDO()", gesto: { tecla: "F2" }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "B11-tecla-ponto", antes: "await MAIN_TUDO()", gesto: { tecla: "." }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "B12-escape", antes: "await MAIN_TUDO()", gesto: { tecla: "Escape" }, efeito: { fluxo: "outputs", n: 1 } }
        ]
    },
    {
        id: "C",
        titulo: "Gaveta (Midia, abas, busca)",
        preparar: ABRE_SHOW,
        passos: [
            { id: "C01-aba-midia", alvo: `[...document.querySelectorAll("#leftPanelDrawer button, .drawer button, button")].find(b=>b.innerText.trim()==="Mídia" && b.closest("#leftPanelDrawer, .drawerTabs, .tabs, div"))`, gesto: { clique: true }, efeito: { fluxo: "estado", n: 0 }, semEfeito: "a aba ativa nao e um fluxo gravado: o efeito esta nos sinais (abaAtiva), comparados a parte" },
            { id: "C02-ctrl-2-aba", gesto: { tecla: "2", mods: { ctrl: true } }, semEfeito: "so troca a aba da gaveta (sinais)" },
            { id: "C03-ctrl-1-aba", gesto: { tecla: "1", mods: { ctrl: true } }, semEfeito: "so troca a aba da gaveta (sinais)" },
            { id: "C04-ctrl-f", gesto: { tecla: "f", mods: { ctrl: true } }, semEfeito: "abre a busca/localizar, sem escrever no telao" }
        ]
    },
    {
        id: "E",
        titulo: "Modo e pagina com algo no ar",
        preparar: ABRE_SHOW,
        passos: [
            { id: "E01-pe-slide", alvo: SLIDE(0), gesto: { clique: true }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "E02-vai-preparar", alvo: BOTAO_MODO("Preparar"), gesto: { clique: true }, semEfeito: "so troca o modo (sinais)" },
            { id: "E03-espaco-no-preparar", gesto: { tecla: " " }, semEfeito: "o Preparar ignora o teclado: NAO pode escrever no telao" },
            { id: "E04-seta-no-preparar", gesto: { tecla: "ArrowRight" }, semEfeito: "o Preparar ignora o teclado: NAO pode escrever no telao" },
            { id: "E05-f1-no-preparar", gesto: { tecla: "F1" }, semEfeito: "o Preparar ignora o teclado: NAO pode escrever no telao" },
            { id: "E06-abre-gaveta", antes: "S.drawer.set({height:300,stored:null}); await esp(300)", gesto: { tecla: "2", mods: { ctrl: true } }, semEfeito: "so troca a aba da gaveta (sinais)" },
            { id: "E07-esc-no-preparar-com-gaveta", antes: "S.drawer.set({height:300,stored:null}); await esp(300)", gesto: { tecla: "Escape" }, semEfeito: "no Preparar o Esc so recolhe a gaveta (sinais): E1 da fatia 0b" },
            { id: "E08-ctrl-t-no-preparar", gesto: { tecla: "t", mods: { ctrl: true } }, semEfeito: "so fecha/abre colunas (sinais): E2 da fatia 0b" },
            { id: "E09-volta-culto", alvo: BOTAO_MODO("Culto"), gesto: { clique: true }, semEfeito: "so troca o modo; os sinais do Culto depois da volta sao o que a fatia 0b muda de proposito (E1/E2)" }
        ]
    },
    {
        id: "F",
        titulo: "Tempo (repouso com slide no ar)",
        preparar: ABRE_SHOW,
        passos: [
            { id: "F01-pe-slide", alvo: SLIDE(0), gesto: { clique: true }, efeito: { fluxo: "outputs", n: 1 } },
            { id: "F02-repouso-6s", gesto: { espera: 6000 }, semEfeito: "repouso: so canais periodicos (ACTIVE_TIMERS etc.), comparados pelo conjunto de canais e ultimo payload; timer de contagem real NAO testado" }
        ]
    }
]

// preparacao de fundo/sobreposicao no ar (store, fora da gravacao). So um arquivo real do perfil: nunca src vazio.
export const FUNCOES_PREPARO = `
const FUNDO = S_FUNDO
globalThis.MAIN_FUNDO = async () => { const O = await import(U("components/helpers/output")); O.setOutput("background", { path: FUNDO, type: "image", name: "f1.png" }); await esp(500) }
globalThis.MAIN_TUDO = async () => {
  const O = await import(U("components/helpers/output"))
  S.overlays.update(a => { a.ov_prova = { name: "ov", items: [], created: 1 }; return a })
  const id = ${JSON.stringify(ID_SHOW)}
  const layout = get(S.showsCache)[id]?.settings?.activeLayout
  O.setOutput("slide", { id, layout, index: 2, line: 0 })
  O.setOutput("background", { path: FUNDO, type: "image", name: "f1.png" })
  O.setOutput("overlays", ["ov_prova"])
  await esp(500)
}
`
