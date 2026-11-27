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

## Pendências

### Bugs relatados pelo André, ainda não corrigidos
1. Outras telas: as prévias ficam empilhadas. A proposta é mostrar as 3 lado a lado, sem abas.
2. As setas do teclado param de passar slide depois de usar a Bíblia.
3. "Ajuste na tela".
4. Menu de propriedades da pasta.
5. Seletor de cor abre fora do lugar. A proposta é um componente só para seletor de cor, menus e listas suspensas: ancorado no botão, a 6 px dele, virando de lado quando falta espaço e desenhado por cima de tudo.

### Pequenos
- Como pôr um capítulo ou versículos da Bíblia no roteiro.
- Espaço vazio de 36 px (`.avisoLugar`) abaixo do seletor de culto no roteiro.
- Artista e metadados das músicas: o André disse "por enquanto vamos deixar".

### Pendências antigas (de antes de 25/nov; confira se ainda valem)
- Alertas rápidos por cima da letra ("placa XXX-XXXX", "pais da criança X").
- No modo só retorno, o áudio da gaveta não é barrado.
- O fundo do slide não acompanha no retorno.
- "Pré-visualizar" está sem substituto.
- Ajustes baixos não feitos da revisão do PR #42: 6, 13, 14, 15 e 16 (`revisoes/revisao-cabine4-codigo.md`).
- Perguntas ao André:
  - o cartão do Spotify na faixa de vídeo precisa de volume?
  - no modo só retorno, o item de palco "saída atual" mostra o telão ou o que foi para o retorno?

### Roadmap (`plano-cabine-6.md`)
- **Vídeo liso:** os espelhos não decodificam (quadro parado com o tempo restante). Antes disso, rodar na cabine (RX 580) o POC "decodifica uma vez, mostra N vezes".
- **D10:** escolher, por saída, se ela "usa o slide" ou "aplica o modelo X".
- **D20:** botão "Reaplicar modelo", deixando claro que o modelo aplicado é uma cópia.

Ordem sugerida: os 5 bugs (atrapalham o culto), depois os alertas rápidos, depois o resto.
