// Roteiro da secao H (Preparar): o que o Preparar NAO pode fazer. Mesmo formato de passo do roteiro.mjs (alvo, gesto, efeito/semEfeito, antes),
// mais `paginaFinal` (opcional): a pagina em que o passo tem de terminar (conferida contra `depois.pagina` pelo invariantes.mjs).
// Rodar: `bash scripts/prova-culto/gravar.sh <rotulo> --roteiro preparar --saida ../gravacoes` e depois
// `node scripts/prova-culto/invariantes.mjs ../gravacoes/gravacao-<rotulo>.json`.
// H nunca liga nem desliga a saida: nenhum passo toca em outputs.
import { ABRE_SHOW, BOTAO_MODO } from "./roteiro.mjs"

export const VERSAO_PREPARAR = 1

const MORTO = "o Preparar ignora o teclado"

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
            { id: "H10-ctrl-o", gesto: { tecla: "o", mods: { ctrl: true } }, semEfeito: MORTO }
        ]
    }
]
