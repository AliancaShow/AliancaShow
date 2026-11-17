// Roteiro da secao H (Preparar): o que o Preparar NAO pode fazer. Mesmo formato de passo do roteiro.mjs (alvo, gesto, efeito/semEfeito, antes),
// mais `paginaFinal` (opcional): a pagina em que o passo tem de terminar (conferida contra `depois.pagina` pelo invariantes.mjs).
// Rodar: `bash scripts/prova-culto/gravar.sh <rotulo> --roteiro preparar --saida ../gravacoes` e depois
// `node scripts/prova-culto/invariantes.mjs ../gravacoes/gravacao-<rotulo>.json`.
// H nunca liga nem desliga a saida: nenhum passo toca em outputs.
import { ABRE_SHOW, BOTAO_MODO } from "./roteiro.mjs"

export const VERSAO_PREPARAR = 1

const MORTO = "o Preparar ignora o teclado"
const PILULA = `document.querySelector(".prepararBarra .pilula")`
const NOVO = `document.querySelector(".prepararBarra .alianca-novo .botao")`
const MENU = `document.querySelector(".prepararBarra .menuBotao")`
const VOLTAR = `document.querySelector(".prepararBarra .voltar")`
const ITEM = (nome) => `document.querySelector('[role=menuitem][data-item="${nome}"]')`

// preparo: fundo, slide e sobreposicao no ar (o Culto fica com conteudo no ar; o Preparar nao pode mexer nele)
export const SECOES_PREPARAR = [
    {
        id: "H",
        titulo: "Preparar: nada vai ao ar",
        preparar: `${ABRE_SHOW}\nawait MAIN_TUDO()`,
        passos: [
            { id: "H01-vai-preparar", alvo: BOTAO_MODO("Preparar"), gesto: { clique: true }, semEfeito: "so troca o modo (sinais)" },
            { id: "H02-espaco", gesto: { tecla: " " }, semEfeito: MORTO },
            { id: "H03-seta-direita", gesto: { tecla: "ArrowRight" }, semEfeito: MORTO },
            { id: "H04-f1", gesto: { tecla: "F1" }, semEfeito: MORTO },
            { id: "H05-f2", gesto: { tecla: "F2" }, semEfeito: MORTO },
            { id: "H06-f3", gesto: { tecla: "F3" }, semEfeito: MORTO },
            { id: "H07-f5", gesto: { tecla: "F5" }, semEfeito: MORTO },
            { id: "H08-ponto", gesto: { tecla: "." }, semEfeito: MORTO },
            { id: "H09-esc", gesto: { tecla: "Escape" }, semEfeito: MORTO },
            { id: "H10-ctrl-o", gesto: { tecla: "o", mods: { ctrl: true } }, semEfeito: MORTO },
            // ---- 1a: a barra do Preparar (clique real em cada peca; nenhuma pode ir ao telao)
            // o aviso de tecla (3 s) troca a pilula por um texto: espera ele passar antes de procurar a pilula
            { id: "H11-pilula", antes: "await esp(3300)", alvo: PILULA, gesto: { clique: true }, semEfeito: "perfil sem pendencia: a pilula nao abre nada" },
            { id: "H12-novo-abre", alvo: NOVO, gesto: { clique: true }, semEfeito: "abre o menu + Novo (sem efeito de pagina)" },
            { id: "H13-novo-esc", gesto: { tecla: "Escape" }, semEfeito: "o Esc fecha o menu + Novo" },
            { id: "H14-menu-abre", alvo: MENU, gesto: { clique: true }, semEfeito: "abre o menu ⋯" },
            { id: "H15-config", alvo: ITEM("config"), gesto: { clique: true }, efeito: { fluxo: "estado", n: 1 }, paginaFinal: "settings" },
            { id: "H16-voltar", alvo: VOLTAR, gesto: { clique: true }, efeito: { fluxo: "estado", n: 1 }, paginaFinal: "show" },
            { id: "H17-menu-abre", alvo: MENU, gesto: { clique: true }, semEfeito: "abre o menu ⋯" },
            // conteudo no ar e a saida desligada: o item do telao esta desabilitado e o clique nao pode emitir OUTPUT:TOGGLE_OUTPUTS
            { id: "H18-saida-bloqueada", alvo: ITEM("saida"), gesto: { clique: true }, semEfeito: "o item do telao esta desabilitado (ha conteudo carregado): nada ao telao" },
            { id: "H19-esc-fecha-menu", gesto: { tecla: "Escape" }, semEfeito: "o Esc fecha o menu ⋯" },
            // Ctrl+G, o texto de um popup NEGADO no Preparar ("Gerenciar grupos") e Enter: toast e fecha; julgado pelas invariantes (zero outputs, zero canal)
            { id: "H20-busca-negada", gesto: { sequencia: [{ tecla: "g", mods: { ctrl: true } }, { texto: "Gerenciar grupos" }, { tecla: "Enter" }] }, semEfeito: "a busca bloqueia o popup (aviso Use no Culto)" }
        ]
    }
]
