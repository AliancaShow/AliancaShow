// Ancora da janela de saida (revisao C14): nenhum arquivo do FECHO DE IMPORTS de `MainOutput.svelte` pode mudar entre a ancora (a base da
// pilha de layout) e o HEAD, salvo os da lista de excecoes abaixo, cada uma com motivo. A lista tem SHA TRAVADO: crescer exige mudar este
// arquivo (aparece no diff, com o motivo).
//
//   node scripts/prova-culto/ancora.mjs           (usa scripts/prova-culto/ancora.txt)
//   node scripts/prova-culto/ancora.mjs <sha>
//
// Reprova se: o SHA da ancora nao existe (rebase/squash apaga SHA de branch local), o fecho vem vazio, ou a lista de excecoes mudou sem o SHA.
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, posix } from "node:path"
import { fileURLToPath } from "node:url"

const ENTRADA = "src/frontend/MainOutput.svelte"

/** excecoes: arquivo do fecho que a pilha de layout PODE mudar, e por que a saida continua igual */
export const EXCECOES = {
    "src/frontend/components/slide/Zoomed.svelte": {
        "motivo": "teste 13 (\"aprovo posição-sobra\", André 24/nov): \"Posição quando sobra espaço\" (alignPosition) não tinha efeito. O alignStyle passa a vir DEPOIS do bloco de centro no style, e com classe `alinhado` (align fora de center) a .slide perde a margem automática. Com align center (padrão de todas as saídas) o resultado é o mesmo de antes",
        "sha": "e1950c3835d173ec04cc99dd573161bba7b1feaff379cf3cd4b3ea1eeb0113fd"
    },
    "src/frontend/utils/aliancaTela.ts": {
        "motivo": "revisao da fatia 2 (achado 2): `tecladoLivre` passa de `tela === mostrar` para `tela !== editar` (o teclado da saida vive nas paginas do menu). Na saida `tela` e sempre `mostrar` (derivada com currentWindow !== null), entao o resultado e o mesmo de antes",
        "sha": "fd746e6f21ff4c7fc67a9ab5e9dd1e0bfb405bf5aa9867e9fd2f7a6fa70bdd47"
    },
    "src/frontend/utils/aliancaModo.ts": {
        "motivo": "revisao da fatia 2 (achado 2) + fatia 3: `tecladoPodeMexerNaSaida(alvo, tecla)` consulta `tecladoVivo(tela, campoDeTexto, tecla)` (em Editar so o Esc passa) e a marca de tecla em curso nao conta o Esc; na saida a tela e `mostrar` e a funcao devolve true como antes",
        "sha": "78f5a520f89be3540ccfede738033a357fe3904e25aea8db3fd29aba99d0c4e6"
    },
    "src/frontend/utils/aliancaBibliotecaEstado.ts": {
        "motivo": "revisao da fatia 2 (achado 2.1): so zera a biblioteca ao chegar em Mostrar vindo de Editar; assinante da `tela` so montado pela janela principal (iniciarEstadoDaBiblioteca nao roda na saida)",
        "sha": "cd5ff071b766caf8aa58acb27731a66a6ff64d3fe5860e7eb422816363d0f116"
    },
    "src/frontend/utils/aliancaBibliotecaLogica.ts": {
        "motivo": "revisao da fatia 2 (achado 2.1): acrescenta a funcao pura `chegadaZeraBiblioteca`; nada existente muda",
        "sha": "10ec435d1bdc5038f1ea231691ed4210e0d1551528d59f6cb85e6f97a69f2dbd"
    },
    "src/electron/index.ts": {
        "motivo": "fatia 4 (decisao 8 do Andre, aprovada 18/nov): so `createMain` (janela principal) troca `frame/autoHideMenuBar` por `titleBarStyle: hidden` + `titleBarOverlay`, e `setGlobalMenu` zera o menu no Windows tambem em dev. A criacao da janela de saida nao muda",
        "sha": "bf96cef8c00bec3e925bd74935e159bba906200eb46851c534480c123b640616"
    },
    "src/electron/IPC/responsesMain.ts": {
        "motivo": "fatia 4 (aprovada 18/nov): novo canal `TOGGLE_DEVTOOLS` (sem efeito em producao; em dev abre o DevTools da janela principal). Nenhuma resposta existente muda | Biblias embutidas (aprovado pelo André 19/nov; revisao bancada/revisao-biblias-fecho.md): READ_BIBLES_FOLDER devolve embutida/legado por Biblia | cabine-5 (aprovado pelo André 19/nov, \"aprovo 1, 2B e 3\"): canal novo ALIANCA_LIXEIRA (Apagar do computador da biblioteca de midia: caixa nativa + shell.trashItem + confere). Nenhuma resposta existente muda; a saida nao chama",
        "sha": "6d3796b36e5bc3d9e3d7a3ec4ecbd547785383d8abbfc7489cfcb394d2b83f40"
    },
    "src/types/IPC/Main.ts": {
        "motivo": "fatia 4 (aprovada 18/nov): tipo do canal novo `TOGGLE_DEVTOOLS`; so acrescenta | Biblias embutidas (aprovado pelo André 19/nov; revisao bancada/revisao-biblias-fecho.md): READ_BIBLES_FOLDER devolve embutida/legado por Biblia | cabine-5 (aprovado pelo André 19/nov, \"aprovo 1, 2B e 3\"): tipo do canal novo ALIANCA_LIXEIRA; so acrescenta",
        "sha": "e194d4d53011ca5a4c6e90084551ff62d4b2115f014c4245b54b65085e0d7117"
    },
    "src/electron/utils/menuTemplate.ts": {
        "motivo": "fatia 4 (aprovada 18/nov): tira `quick_start_guide` do menu (macOS); nada da saida usa",
        "sha": "9ffaa005809bbc29f23e7e8777b840462f2dc40d570f9b85388611c6cc0c787f"
    },
    "src/frontend/components/context/contextMenus.ts": {
        "motivo": "fatia 4 (aprovada 18/nov): apaga os layouts `file/edit/view/help` da barra de menus que saiu (MenuBar.svelte apagado); nenhum outro layout muda. cabine-6 (aprovado pelo André 25/nov, \"aprovo estilo-menus\"): output_preview perde change_style/edit_style (o estilo virou resultado de Tela + Visual)",
        "sha": "519cec9d4600ea3ce1727f7b3c0c4b328f81d6bffbe7e71cf3858c7aafbbc621"
    },
    "src/frontend/utils/common.ts": {
        "motivo": "fatia 4 (aprovada 18/nov): apaga a constante `MENU_BAR_HEIGHT` (sem mais usos); nada mais muda",
        "sha": "e40aca15f3713ae101ff0475ca64d173adda3db2db857eed917a796282330746"
    },
    "src/frontend/components/main/popups/Initialize.svelte": {
        "motivo": "fatia 4 (aprovada 18/nov): tira o paragrafo de dicas do FreeShow do primeiro uso; o popup so abre na janela principal",
        "sha": "d8ea6859563eb19ea94aa9c71de9cf7fc102fd02aa84e1eadf98cdd815b3c31c"
    },
    "src/frontend/components/helpers/output.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): ponto unico do desvio em setOutput; recusa o que nao e letra; expiracao de sobreposicao em semDesvio. Modo desligado: identico. + \"aprovo caixa-da-letra\" (André 24/nov): mergeWithTemplate poe a letra na 1a caixa LIVRE do modelo (ordemDaLetra: livre > forma > ligada) e as caixas que sobram guardam a camada do modelo; modelo cuja 1a caixa e livre: identico; Biblia: identico",
        "sha": "723d6107e9e8e01133a07e7ed0701a497a09849034055200618bc0c5fb0e6a2f"
    },
    "src/frontend/components/helpers/OutputHelper.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): setas leem a posicao do retorno no modo; automacao roda na janela propria. Modo desligado: identico",
        "sha": "fd6a3a23df26a58c5975b013524df739cc31fce0c5d0fc6a803c1877dedc3d4b"
    },
    "src/frontend/components/helpers/showActions.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): updateOut/checkActionTrigger retornam cedo no modo; playPdf recusa antes de limpar o fundo. Modo desligado: identico",
        "sha": "5b4be1ecb0288b49fb356bb8f17c69cb80397a95c1cd40b0b07e372c365d7585"
    },
    "src/frontend/components/output/clear.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): limpezas parciais de sobreposicao/efeito fora do desvio. Modo desligado: identico",
        "sha": "ff53361a099d57d8b6bd20c5b0c9bbabc41e4e72669940efe991b4b96bd18855"
    },
    "src/frontend/components/actions/apiHelper.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): API/celular nao limpa o telao antes de enviar no modo; repetir/mudo em semDesvio; audio recusado no modo. Modo desligado: identico",
        "sha": "ee4ba33f1e44e552cc1dddc3ad87a26ff35796ef6ab5395cedebf86f4a54fb78"
    },
    "src/frontend/components/context/menuClick.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): midia nao limpa o telao antes de enviar no modo. Modo desligado: identico",
        "sha": "dcdd1aadf3852a18ea71a23329a020bb37c4ceb1a870d17aa0f291dcbd86c877"
    },
    "src/frontend/utils/shortcuts.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): togglePlayingMedia recusa no modo (Espaco/seta nao mexem no video do telao); playFolder herda a janela de automacao. Modo desligado: identico",
        "sha": "15c2507c81735c878439449294e47379f903e6455988fa3f04a876c8fd9f3de5"
    },
    "src/frontend/components/media/video/videoPlayer.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): fim de video de pasta abre iniciarAutomacao() em try/finally; com o modo desligado devolve null e nada muda | cabine-5 (aprovado pelo André 19/nov, \"aprovo 1, 2B e 3\"): arquivo que nao existe (locateMediaFile null) mostra aviso (newToast) antes do return false que ja existia; o que toca nao muda | cabine-6 D25 (aprovado pelo André 22/nov, \"aprovo transporte\"): pausa suave: campo `rampa` no estado enviado as saidas (multiplica a velocidade durante a curva de 0,7 s), `sincronizarAgora()` empurra o estado a cada passo, e o volume nao e reposto enquanto a rampa corre. Sem pausa suave `rampa` e undefined e nada muda",
        "sha": "c6968e50a7987273f751c7e44e7389a3be088692e1c28576df3e449d3a083fc3"
    },
    "src/frontend/components/timeline/ShowTimeline.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): linha do tempo move o telao como automacao (iniciarAutomacao em try/finally); modo desligado: identico",
        "sha": "3025cd53ccf5f3b4e5d5c230214fc6862a3af1fe4b124ca19573fefb3e367b9c"
    },
    "src/frontend/components/timeline/TimelinePlayback.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): video da linha do tempo move o telao como automacao (iniciarAutomacao em try/finally); modo desligado: identico",
        "sha": "fb5b607e4f98f7623a7b710cc3199d22477e8dcd29933acdbec6544c2401b3c2"
    },
    "src/frontend/components/stage/Stagebox.svelte": {
        "motivo": "rodada da cabine (A4/A5, aprovada pelo André 18/nov): item 'saida atual' sem fonte explicita mostra o conteudo da saida em vez de desenhar o proprio retorno dentro dele (recursao no modo so retorno). Com fonte explicita: identico | cabine-6 fatia A (aprovado pelo André 22/nov, \"aprovo previas\"): o item \"saida atual\" mostra a captura ao vivo da janela da saida (AliancaCaptura) em vez de decodificar o video de novo; quando mira a propria janela (so retorno) continua com <Output mirror>",
        "sha": "2735e739240fa8e1b590c4602a67ab4e37ea0ae757778c9d372a9b20f61b9dbb"
    },
    "src/frontend/components/slide/Textbox.svelte": {
        "motivo": "rodada da cabine (A4/A5, aprovada pelo André 18/nov): autosize de PALCO nao mede nem usa cache com caixa escondida/0x0 (cache envenenado a 800 px). Slides do telao nao passam pela guarda",
        "sha": "5a4637063f642fbf9a6fc4b2e6f86d9bd791d0b77a0fb7432241d42971b3b48f"
    },
    "src/electron/data/defaults.ts": {
        "motivo": "Biblias embutidas (aprovado pelo André 19/nov; revisao bancada/revisao-biblias-fecho.md): default de scriptures fica vazio (o nvi/'NVI' nao casava com o arquivo); nada da saida le scriptures",
        "sha": "34deed63a1dc16ae1a01542894e36a7ec664f64f2cda4236387f214bad885818"
    },
    "src/electron/utils/files.ts": {
        "motivo": "Biblias embutidas (aprovado pelo André 19/nov; revisao bancada/revisao-biblias-fecho.md): bundledBiblesFolder() exportado (resources/bibles ou bundled-bibles/); a copia na partida ja existia",
        "sha": "bd969066fda1caaaae933a3e8d593ecca8b21bbb8e628d6b153d4a79e99cbeda"
    },
    "src/frontend/utils/bibliasEmbutidas.ts": {
        "motivo": "Biblias embutidas (aprovado pelo André 19/nov; revisao bancada/revisao-biblias-fecho.md): registra cada .fsb embutida sem duplicar NVI/ARA, corrige registro antigo e alerta alto quando falta arquivo; so roda na janela principal (updateSyncedSettings)",
        "sha": "9a11d8d01cf6312e4639768b765c5904ecb88c9c161e8428f1d97ce5fb29a824"
    },
    "src/frontend/audio/audioFading.ts": {
        "motivo": "cabine-6 D11 (aprovado pelo André 22/nov, \"aprovo Fading\"): regra \"nada volta sozinho\": audio derrubado pelo video pausa de verdade (AudioPlayer.pause) e fadeinAllPlayingAudio nao religa mais. So a janela principal toca audio; a saida nao chama estas funcoes",
        "sha": "45bb774c8372658b97a61ba7f8d2c307a223a106bb368f9295c898a9e318484b"
    },
    "src/electron/output/helpers/OutputLifecycle.ts": {
        "motivo": "cabine-6 1a (aprovado pelo André 22/nov, \"aprovo resize\"): o handler de `resize` da janela de saida tinha a condicao invertida (veio assim do FreeShow 1.6.5): com mover desligado, todo resize feito pelo Windows (LED perde/volta sinal, DPI) gravava os limites. Agora espelha o `move`: so grava quando o operador esta movendo. Nada do que a saida desenha muda | cabine-6 fatia A (aprovado pelo André 22/nov, \"aprovo previas\"): liga o vigia de queda/travamento das saidas (aliancaVigiaSaida: render-process-gone, unresponsive e batimento de 1 s; recarrega a janela e avisa alto na principal) e cria a janela opaca (`transparent: !!output.transparent`) para renderer morto nunca mostrar a area de trabalho",
        "sha": "6a44a17bfd6d784424f205ae8a84aa7d8a6a0188b0074a382dafa612c3c43541"
    },
    "src/frontend/components/media/Video.svelte": {
        "motivo": "cabine-6 D25 (aprovado pelo André 22/nov, \"aprovo transporte\"): a velocidade alvo do sync passa a ser `targetPlaybackRate * (data.rampa ?? 1)`, para cada saida desacelerar junto com o relogio na pausa suave. Sem pausa suave `rampa` e undefined e o resultado e o mesmo de antes",
        "sha": "462281eb6952cbe9beb8c96354cf347bbc030dd4e87a6804ba3627a279383177"
    },
    "src/frontend/components/output/layers/Media.svelte": {
        "motivo": "cabine-6 fatia A (aprovado pelo André 22/nov, \"aprovo previas\"): com o contexto previaSemVideo (so a previa desenhada da janela principal liga) o video vira miniatura parada (AliancaMiniaturaVideo); na janela de saida o contexto nunca existe e o ramo e o mesmo de antes",
        "sha": "3550c45e1f197549a567f0c2ee85b0305918cbbc8812ffe187bd2befacd74b6d"
    },
    "src/frontend/components/slide/views/MediaItem.svelte": {
        "motivo": "cabine-6 fatia A (aprovado pelo André 22/nov, \"aprovo previas\"): mesma regra para video dentro do slide: miniatura parada so na previa desenhada da janela principal; na saida o ramo original fica igual",
        "sha": "af0ba9c1200de72bba4738b4008dd0503b3a312346f2e5d580182148e40dca0b"
    },
    "src/electron/output/helpers/OutputVisibility.ts": {
        "motivo": "cabine-6 (aprovado pelo André 23/nov no PC da igreja, \"aprovo monitor-desconectado\"): a saida presa ao MONITOR. `resolveOutputBounds` consulta o registro da saida (aliancaMonitorSaida): screen = monitor inteiro, aliancaMonitor = tamanho proprio dentro do monitor; monitor ausente nao move (antes caia calado nas coordenadas soltas e a janela ia para o monitor que o Windows pos no lugar). `toggleOutput` com o monitor ausente esconde a janela, mantem a saida ligada e avisa (vale com force). Config antiga (sem screen e sem aliancaMonitor) segue o caminho de sempre. Nada do que a saida desenha muda",
        "sha": "96205aa9f9e300eaaf976148d4025163a126745c5e611bb1fd0d14ba56dce600"
    },
    "src/electron/data/backup.ts": {
        "motivo": "cabine-6 (aprovado pelo André 25/nov, \"aprovo backup-settings\"): restaurar um backup mandava SYNCED_SETTINGS.json para o store SETTINGS (o teste de nome casava as duas) e sobrescrevia as configuracoes locais; a condicao do SETTINGS passa a excluir SYNCED_SETTINGS. Teste em backup.test.ts. Nada do que a saida desenha muda",
        "sha": "470fdf98a8c47c8a7d530c5896f5456b7aa9b098e92e340e0b9218af201a7389"
    },
    "src/frontend/IPC/responsesMain.ts": {
        "motivo": "cabine-6 (aprovado pelo André 25/nov, \"aprovo selecionar-tela\"): ToMain.ALERT ignora \"error.display\" (a janela que bloqueia quando o telao nao liga); o aviso de saida fora do ar no pe ja diz qual saida caiu. Uma linha; nada do que a saida desenha muda",
        "sha": "c7f10aaf51d9abe6c4523a584e83082c3ea94f075849954398a240fdc1ad778d"
    },
    "src/frontend/components/main/popups/TemplateInfo.svelte": {
        "motivo": "cabine-6 (aprovado pelo André 25/nov, \"aprovo estilo-menus\"): so textos do popup de informacoes do modelo (fala em Visual; o botao diz \"Abrir o Visual\"); a acao do botao e a mesma",
        "sha": "543fde66a7b0a4d2a8e62b163ec3bce171b97bdb807c27567ccfefb462e72687"
    },
    "src/frontend/components/drawer/pages/TemplateSlide.svelte": {
        "motivo": "editor-telao (aprovado pelo André 25/nov, \"aprovo editor-telao\"): a proporcao do desenho do modelo passa a vir de saidaDoEditor($outputs) (a tela principal da coluna No ar) em vez da primeira saida ativa em ordem alfabetica. So o editor de modelo, a lista de modelos e o popup de escolher modelo desenham este componente; a janela de saida nao o monta",
        "sha": "a66ba7887138646a5b823aac2b008843f01fee5c531bbda334c795a86a2bf8cf"
    }
}

/**
 * arquivos que ENTRARAM no fecho de imports da saida depois da ancora (arquivo novo, ou um que ja existia e passou a ser importado por alguem do fecho).
 * Todo arquivo de fecho(HEAD) menos fecho(ancora) tem de estar aqui. `sha` = SHA-256 do conteudo no HEAD com CRLF trocado por LF.
 */
export const NOVOS_NO_FECHO = {
    "src/frontend/utils/aliancaTecladoLogica.ts": {
        "motivo": "revisao da fatia 2 (achado 2) + fatia 3: funcao pura `tecladoVivo(tela, campo, tecla)`, importada por aliancaModo.ts; em `mostrar` devolve true (o terceiro argumento so muda o ramo `editar`, que a saida nunca tem)",
        "sha": "ef3200817fe6961538c62f2b685672b5395f8ce47575c20731a9d2e2f27fb057"
    },
    "src/frontend/utils/aliancaSoRetorno.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): arquivo novo: estado do modo, ponto de desvio, janela de automacao, recusarNoModo; output.ts o importa",
        "sha": "277556209cdaed9a0daf779564f94d3dec590e84ee305558b9b04d7c857f7221"
    },
    "src/frontend/utils/aliancaSoRetornoLogica.ts": {
        "motivo": "fatia 8b (so retorno, aprovada pelo André 18/nov): arquivo novo: parte pura (aceitaNoModo, oQueRecusou, motivoDaRecusa)",
        "sha": "cbf854f6e38498cb2214baae2898e72394de0ee07d1ad1b5974780c49fd5274d"
    },
    "src/frontend/utils/bibliasEmbutidasLogica.ts": {
        "motivo": "Biblias embutidas (aprovado pelo André 19/nov; revisao bancada/revisao-biblias-fecho.md): logica pura do registro (sem efeito colateral); entra no fecho via bibliasEmbutidas.ts",
        "sha": "63db7ef3fe23133f6e4f21f83dd4fa34fc857399291413469ca970c5c7cff2d5"
    },
    "src/frontend/components/output/AliancaCaptura.svelte": {
        "motivo": "cabine-6 fatia A (aprovado pelo André 22/nov, \"aprovo previas\"): captura ao vivo da janela de uma saida (getUserMedia desktop pelo id da janela), com selo de estado; na saida so e usada pelo Stagebox \"saida atual\"",
        "sha": "6c809bab3ad80a065db9bf0760eb2c416bc167176787e7e82a9b816d065ec4e1"
    },
    "src/frontend/utils/aliancaCaptura.ts": {
        "motivo": "cabine-6 fatia A (aprovado pelo André 22/nov, \"aprovo previas\"): pede a fonte de captura da janela por id de saida (canal ALIANCA_FONTE_SAIDA) e gerencia as trilhas",
        "sha": "9f5e5ffab06c88bae27d0b290c65dc9a457fe2bf53566f97a5ef97870a9cc9de"
    },
    "src/frontend/utils/aliancaCapturaLogica.ts": {
        "motivo": "cabine-6 fatia A (aprovado pelo André 22/nov, \"aprovo previas\"): logica pura da captura (estado da saida -> captura, quadro parado ou selo; espelhoDeSiMesmo)",
        "sha": "7fbc9ddcb824306a5e385f509220f3d4e8d35e2a02cbe86b5a3bbf2d6c5bc8c5"
    },
    "src/types/aliancaSaidaCanais.ts": {
        "motivo": "cabine-6 fatia A (aprovado pelo André 22/nov, \"aprovo previas\"): tipos do canal ALIANCA_FONTE_SAIDA e do aviso de queda; so acrescenta",
        "sha": "2a34f0214e8ae805ce233d7b46a5ff5aed37ef84c8e51b9feaed7beb169f3a22"
    },
    "src/electron/output/aliancaVigiaSaida.ts": {
        "motivo": "cabine-6 fatia A (aprovado pelo André 22/nov, \"aprovo previas\"): vigia de queda/travamento das janelas de saida (processo principal); recarrega e avisa a principal",
        "sha": "a3721b8dc174ce6e1167c5ba3918cee3caf6cf1b04e6f33cf84034d50c3b2e6b"
    },
    "src/electron/output/aliancaVigiaLogica.ts": {
        "motivo": "cabine-6 fatia A (aprovado pelo André 22/nov, \"aprovo previas\"): logica pura do vigia (quedas deduplicadas; 3 em 60 s = fora do ar)",
        "sha": "5103b1c1a0ea40a7a70ddbdf39f96ca9e61e32da84064fae488a4ad8c69c4028"
    },
    "src/frontend/utils/aliancaPreviaSemVideo.ts": {
        "motivo": "cabine-6 fatia A (aprovado pelo André 22/nov, \"aprovo previas\"): contexto Svelte que so a previa desenhada da janela principal liga; na janela de saida devolve sempre false",
        "sha": "ad0f56cf34132b44df395a414642ecbc71122c4589199a556fc9d0597b93aad4"
    },
    "src/frontend/components/media/AliancaMiniaturaVideo.svelte": {
        "motivo": "cabine-6 fatia A (aprovado pelo André 22/nov, \"aprovo previas\"): miniatura parada do video (mesmo encaixe), usada so com previaSemVideo ligado",
        "sha": "04922194a3ab7c1baca3ccf0e3934775d3f9b3d3640e0c560945ef655c4da25a"
    },
    "src/electron/output/aliancaMonitorSaida.ts": {
        "motivo": "cabine-6 (aprovado pelo André 23/nov no PC da igreja, \"aprovo monitor-desconectado\"): arquivo novo (processo principal): registro por saida, estado DESCONECTADO, escutadores de monitor e o canal com a janela principal",
        "sha": "9d5834bc58a84d6807ca8d5e5daa1587603bd652355389c9f46d1df94538efc0"
    },
    "src/electron/output/aliancaMonitorLogica.ts": {
        "motivo": "cabine-6 (aprovado pelo André 23/nov no PC da igreja, \"aprovo monitor-desconectado\"): arquivo novo: logica pura (destinoDaSaida, monitorDaJanela), com testes",
        "sha": "d39857da5afd882fd52bafe273752d011d08385f0ea25c277a1d3d1b95c8512f"
    },
    "src/types/aliancaMonitorCanais.ts": {
        "motivo": "cabine-6 (aprovado pelo André 23/nov no PC da igreja, \"aprovo monitor-desconectado\"): arquivo novo: so tipos e nomes dos canais ALIANCA_MONITOR_REGISTRO / ALIANCA_MONITOR_AVISO",
        "sha": "f778032e020fefc1f9f92c794d1ea7bfb69502f8b29a8279f61d64a83715c170"
    },
    "src/frontend/utils/aliancaSaidaDoEditorLogica.ts": {
        "motivo": "editor-telao (aprovado pelo André 25/nov, \"aprovo editor-telao\"): arquivo novo: funcao pura saidaDoEditor (qual saida da a proporcao do editor), com testes; entra no fecho via TemplateSlide.svelte",
        "sha": "caedf4bcd55ffbf360bfae51a4bf3a4abaccc82704ebd7da70e3b75761c4dcb5"
    },
    "src/frontend/utils/aliancaTransporteLogica.ts": {
        "motivo": "editor-telao (aprovado pelo André 25/nov, \"aprovo editor-telao\"): arquivo que ja existia (logica pura da coluna No ar), sem mudanca; entra no fecho porque aliancaSaidaDoEditorLogica.ts importa saidasHabilitadas",
        "sha": "9183e3f26eeda86d1aac1e8774d6407adaaea96d168b9ffb4551596608d83659"
    }
}

export const SHA_EXCECOES = "7e5cec7c969cca22eb92c04b6bf0134c60838e7795659863cd4b8e77e3b3aae3"
export const SHA_NOVOS = "150808e96d6c2d240a5c4b155436856f2550f6776655b1d183b9c928c64049e2"
export const shaDasExcecoes = () => createHash("sha256").update(JSON.stringify(EXCECOES), "utf8").digest("hex")
export const shaDosNovos = () => createHash("sha256").update(JSON.stringify(NOVOS_NO_FECHO), "utf8").digest("hex")
/** SHA-256 do texto com CRLF trocado por LF (o checkout do Windows nao pode mudar o sha) */
export const shaDoTexto = (txt) => createHash("sha256").update(String(txt).replace(/\r\n/g, "\n"), "utf8").digest("hex")

const git = (args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] })
const lerNoRef = (ref, caminho) => {
    try {
        return git(["show", `${ref}:${caminho}`])
    } catch {
        return null
    }
}

const IMPORT = /(?:import\s+(?:[^'";]*?\s+from\s+)?|import\(\s*|export\s+[^'";]*?\s+from\s+)["']([^"']+)["']/g

/** resolve um import relativo para um arquivo que existe no ref; devolve caminho ou null */
export function resolver(deArquivo, alvo, existe) {
    if (!alvo.startsWith(".")) return null
    const base = posix.normalize(posix.join(posix.dirname(deArquivo), alvo))
    for (const c of [base, base + ".ts", base + ".js", base + ".svelte", base + "/index.ts", base + "/index.js"]) if (existe(c)) return c
    return null
}

/** le varios arquivos de um ref de uma vez (git cat-file --batch: um processo so). devolve { caminho: texto|null } */
export function lerLote(ref, caminhos) {
    const saida = {}
    if (!caminhos.length) return saida
    const buf = execFileSync("git", ["cat-file", "--batch"], { input: caminhos.map((c) => `${ref}:${c}`).join("\n") + "\n", maxBuffer: 1024 * 1024 * 1024 })
    let p = 0
    for (const c of caminhos) {
        const fim = buf.indexOf(10, p)
        const cab = buf.toString("utf8", p, fim)
        p = fim + 1
        if (cab.endsWith(" missing")) {
            saida[c] = null
            continue
        }
        const tam = Number(cab.split(" ")[2])
        saida[c] = buf.toString("utf8", p, p + tam)
        p += tam + 1
    }
    return saida
}

/** o mesmo fecho, mas lendo em lote por nivel (rapido em repositorio grande) */
export function fechoDoRef(entrada, ref) {
    const cache = {}
    const ler = (cs) => {
        const falta = cs.filter((c) => !(c in cache))
        Object.assign(cache, lerLote(ref, falta))
    }
    const vistos = new Set()
    let nivel = [entrada]
    while (nivel.length) {
        ler(nivel)
        const proximos = new Set()
        const candidatos = []
        const pares = []
        for (const f of nivel) {
            if (vistos.has(f) || cache[f] == null) continue
            vistos.add(f)
            for (const m of cache[f].matchAll(IMPORT)) {
                if (!m[1].startsWith(".")) continue
                const base = posix.normalize(posix.join(posix.dirname(f), m[1]))
                const cs = [base, base + ".ts", base + ".js", base + ".svelte", base + "/index.ts", base + "/index.js"]
                candidatos.push(...cs)
                pares.push(cs)
            }
        }
        ler(candidatos)
        for (const cs of pares) {
            const r = cs.find((c) => cache[c] != null)
            if (r && !vistos.has(r)) proximos.add(r)
        }
        nivel = [...proximos]
    }
    return vistos
}

/** fecho de imports a partir da entrada, lendo do ref dado. leitor(caminho) => texto | null */
export function fecho(entrada, leitor) {
    const vistos = new Set()
    const fila = [entrada]
    while (fila.length) {
        const f = fila.pop()
        if (vistos.has(f)) continue
        const texto = leitor(f)
        if (texto == null) continue
        vistos.add(f)
        for (const m of texto.matchAll(IMPORT)) {
            const r = resolver(f, m[1], (c) => leitor(c) != null)
            if (r && !vistos.has(r)) fila.push(r)
        }
    }
    return vistos
}

/**
 * fechoDaAncora / fechoDoHead: conjuntos de arquivos; alterados: arquivos que mudaram entre a ancora e o HEAD;
 * shaAtual(caminho): SHA do conteudo no HEAD (ou null se o arquivo nao existe).
 */
export function verificar({ fechoDaAncora, fechoDoHead = null, alterados, excecoes = EXCECOES, novos = NOVOS_NO_FECHO, shaExcecoes = SHA_EXCECOES, shaNovos = SHA_NOVOS, shaAtual = () => null }) {
    const erros = []
    if (!fechoDaAncora.size) erros.push("o fecho de imports de MainOutput.svelte veio vazio")
    if (shaDasExcecoes() !== shaExcecoes && excecoes === EXCECOES) erros.push(`a lista de excecoes mudou (sha ${shaDasExcecoes()} != ${shaExcecoes}): atualize SHA_EXCECOES junto com o motivo`)
    if (shaDosNovos() !== shaNovos && novos === NOVOS_NO_FECHO) erros.push(`a lista NOVOS_NO_FECHO mudou (sha ${shaDosNovos()} != ${shaNovos}): atualize SHA_NOVOS junto com o motivo`)
    for (const a of alterados) if (fechoDaAncora.has(a) && !(a in excecoes)) erros.push(`${a}: arquivo da janela de saida mudou desde a ancora e nao esta na lista de excecoes`)
    // diferenca de conjuntos: tudo que entrou no fecho precisa de motivo (existisse ou nao na ancora)
    if (fechoDoHead) for (const n of fechoDoHead) if (!fechoDaAncora.has(n) && !(n in novos)) erros.push(`${n}: arquivo NOVO no fecho da janela de saida (nao estava no fecho da ancora) e nao esta em NOVOS_NO_FECHO`)
    if (fechoDoHead) for (const n of Object.keys(novos)) if (fechoDaAncora.has(n) || !fechoDoHead.has(n)) erros.push(`${n}: esta em NOVOS_NO_FECHO mas nao e um arquivo que entrou no fecho`)
    // trava de conteudo: mudar o arquivo sem atualizar o sha (e reler o motivo) reprova
    for (const [lista, nome] of [
        [excecoes, "EXCECOES"],
        [novos, "NOVOS_NO_FECHO"]
    ]) {
        for (const [caminho, e] of Object.entries(lista)) {
            const atual = shaAtual(caminho)
            if (atual === null) continue
            if (atual !== e.sha) erros.push(`${caminho}: o conteudo mudou (sha ${atual}) e ${nome} guarda ${e.sha}: releia o motivo e atualize o sha`)
        }
    }
    return erros
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const aqui = dirname(fileURLToPath(import.meta.url))
    const ancora = process.argv[2] || readFileSync(join(aqui, "ancora.txt"), "utf8").trim()
    try {
        git(["cat-file", "-e", `${ancora}^{commit}`])
    } catch {
        console.error(`ANCORA: o commit ${ancora} nao existe mais (rebase/squash?). Regrave scripts/prova-culto/ancora.txt com a base real da pilha.`)
        process.exit(1)
    }
    const f = fechoDoRef(ENTRADA, ancora)
    const alterados = git(["diff", "--name-only", "--no-renames", ancora, "HEAD"]).split("\n").filter(Boolean)
    const fHead = fechoDoRef(ENTRADA, "HEAD")
    const erros = verificar({ fechoDaAncora: f, fechoDoHead: fHead, alterados, shaAtual: (c) => (lerNoRef("HEAD", c) === null ? null : shaDoTexto(lerNoRef("HEAD", c))) })
    if (erros.length) {
        console.error(`ANCORA: ${erros.length} erro(s)`)
        for (const e of erros) console.error("  - " + e)
        process.exit(1)
    }
    console.log(`ANCORA: ok (fecho de ${f.size} arquivos; ${alterados.filter((a) => f.has(a)).length} alterados, todos na lista de excecoes; ${[...fHead].filter((n) => !f.has(n)).length} novos no fecho, todos em NOVOS_NO_FECHO)`)
}
