# Passagem 27/nov: versões 1.9.2 a 1.9.9

Branch `feat/cabine-6`, HEAD `56b86bc` (enviado ao GitHub). O instalador mais novo é `dist\AliancaShow-1.9.9-x64.exe`.

## Como testar sem tocar nos dados da igreja
- O app de dev roda **só** no perfil `C:\perfil-teste-igreja`: `bash /c/perfil-teste-igreja/abrir-dev.sh`, em segundo plano. O script fecha sozinho o Electron de teste anterior.
- Nunca abra o app de dev sobre `Documentos\AliancaShow` ou `%APPDATA%\aliancashow`, e não abra o app instalado durante o trabalho.
- Só um Electron pode ocupar a porta CDP 9222. As provas usam `scripts/prova-culto/lib.mjs`: `abrir("principal",{buffer:true})`, `tecla(j, tecla)` (tecla real), `j.ev(PRE+…)`.
- Antes de gerar o instalador, pare o app de teste.

## O que entrou em cada versão
| Versão | Commit | O que mudou |
|---|---|---|
| 1.9.2 | `a14de36` | Três aprovos de fecho de 25/nov: backup-settings, selecionar-tela e estilo-menus |
| 1.9.3 | `ea82449` | No ar com seções de título e setinha; Recados junta Palco e Chamadas |
| 1.9.4 | `4ab3049` | Editor no formato do telão; Bíblia com 2 cliques; apagar modelo; Telas, Modelos e Visual; saída principal; ajuste na tela por pasta e por arquivo |
| 1.9.5 | `180c43e` | Editor: caixas desenhadas e gravadas na proporção da tela principal |
| 1.9.6 | `861213d` | Janelas próprias do AliançaShow (fechar, confirmar, aviso, novo show, modelos, monitor, importar); janela de modelos em grade; roteiro enxuto |
| 1.9.7 | `fc93a14` | Ficha da música no Editar (título, categoria, modelo) e "Revisada" do rascunho; setas mostram o slide; apagar música; X na busca |
| 1.9.8 | `b513a46` | Biblioteca com abas fixas e funil e + em ícone; letra da web rápida (Letras via `net.fetch`, 5 s por fonte, nunca trava); "Buscar na internet" na Nova música; barra uniforme em Mídia e Bíblia |
| 1.9.9 | `56b86bc` | Mídia em Lista com colunas Duração, Resolução, Tamanho e Adicionado (ordena por nome ou data); espaço e Backspace digitam na Nova música |

## Exceções de fecho aprovadas nesta rodada (já registradas na âncora)
- backup-settings, selecionar-tela, estilo-menus (25/nov)
- editor-telao, papeis-saida, ajuste-pasta, editor-caixas (25/nov)
- `LyricSearch.ts` e `popups/AliancaLetra.svelte` ("Aprovo os dois", 26/nov)
- `AliancaLetra.svelte` com `class="edit"` nos campos ("Aprovo", 26/nov)

## Lições técnicas desta rodada
- **Atalhos:** `shortcuts.ts` só deixa digitar quando o campo em foco tem a classe `edit`. Sem ela, espaço avança o telão e Backspace apaga. Todo `input` ou `textarea` novo precisa de `class="edit"`.
- **Letras.mus.br:** com axios dava 403. O `net.fetch` do Electron com cabeçalhos de navegador (o mesmo `ugFetch` do Ultimate Guitar) resolve. Não tente contornar proteção anti-robô.
- **Arquivos CRLF:** edite com script node que normaliza para `\n`, troca e devolve o CRLF.
- **Fecho:** confira com `fechoDoRef("src/frontend/MainOutput.svelte","HEAD")` num `_tmp-*.mjs` dentro de `scripts/prova-culto/`, e apague o script depois.
- **Estado dos testes:** vitest passa, exceto o RTMP de integração (precisa de ffmpeg). svelte-check mostra 129 erros, todos anteriores a esta rodada.

## Rodada da tarde de 27/nov (depois da 1.9.9, ainda sem versão)
Corrigido e provado no perfil de teste (`scripts/prova-culto/t21-cabine27nov.mjs`):
- **Setas depois da Bíblia:** com o versículo no ar, seta, PageUp/PageDown e espaço andam o versículo. Antes voltavam para a última música aberta (o slide "temp" da Bíblia era tratado como show no OutputHelper). O listener fica em `Scripture.svelte`, por isso só vale com a aba Bíblia aberta.
- **"＋ roteiro" na Bíblia:** põe a seleção (capítulo inteiro com o botão direito no capítulo, série com Shift+clique) no fim do roteiro, sem abrir e sem ir ao ar (`utils/aliancaBibliaNoCulto.ts`).
- **Outras telas:** prévias lado a lado, sem abas. O `{#key}` com transições globais segurava a prévia antiga montada.
- **Propriedades da categoria de mídia:** botão direito na categoria → "Propriedades da categoria…". O resumo do cabeçalho é clicável e mostra também o ajuste. "Ajuste na tela" do arquivo só aparece onde grava (vídeo, fora do Mostrar). O check considera todos os alvos.
- **Seletor de cor no Editar:** abre ancorado na pastilha (só CSS em `public/global.css`, o MaterialColorInput é do fecho).
- **Roteiro:** o lugar de 36 px do aviso do Sirvo só existe com aviso.
- **Mídia em Lista:** a resolução acima do recomendado aparecia como faixa laranja (herdava o selo "4K" da grade); agora é texto laranja.
- **Shows:** cantor discreto ao lado do nome (`quickAccess.artista`, lido no Electron em `trimShow`; cache antigo é relido uma vez) e "Lista com detalhes" (Nome, Cantor, Categoria, Último uso, Criada; ordena pelo cabeçalho).
- **Spotify:** dar play no Spotify agora limpa o áudio de arquivo (`utils/aliancaSpotifyParaAudio.ts`). O outro sentido já existia. Volume já existe nos dois cartões.

## Pendências

### Pequenos
- Artista e metadados das músicas além do cantor: o André disse "por enquanto vamos deixar".
- Alertas rápidos: o ajuste da caixa de texto não fica idêntico no telão ("bom o suficiente para usar").
- Setas da Bíblia com a aba Bíblia fechada ainda caem na música: a correção robusta é no `OutputHelper.ts` (fecho, precisa de aprovo).
- "Ajuste na tela" por arquivo para fotos: o clique grava só vídeo (`menuClick.ts`, fecho); hoje o item fica escondido para foto.

### Pendências antigas (de antes de 25/nov; confira se ainda valem)
- Alertas rápidos por cima da letra ("placa XXX-XXXX", "pais da criança X").
- Modo só retorno: o André respondeu que o retorno não precisa de áudio nem de fundo do slide; não há o que fazer.
- "Pré-visualizar" está sem substituto.
- Ajustes baixos não feitos da revisão do PR #42: 6, 13, 14, 15 e 16 (`revisoes/revisao-cabine4-codigo.md`).
- Respostas do André (27/nov): o Spotify é um áudio como outro, com volume (já existe); "saída atual" no palco mostra o telão (como já é).

### Roadmap (`plano-cabine-6.md`)
- **Vídeo liso:** os espelhos não decodificam (quadro parado com o tempo restante). Antes disso, rodar na cabine (RX 580) o POC "decodifica uma vez, mostra N vezes".
- **D10:** escolher, por saída, se ela "usa o slide" ou "aplica o modelo X".
- **D20:** botão "Reaplicar modelo", deixando claro que o modelo aplicado é uma cópia.

Ordem sugerida: os 5 bugs (atrapalham o culto), depois os alertas rápidos, depois o resto.
