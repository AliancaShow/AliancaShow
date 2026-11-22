# Revisão cética: Bíblias embutidas (commit `346c9e9`, `origin/feat/cabine-3`)

Base: `git diff 4f2bcb7 346c9e9`. Só leitura do código pelo git; nada foi executado (nem app, nem testes).
Data: 19/nov/2026.

## Resumo

- Nada do commit roda na janela de saída, no retorno ou no palco. O risco para o telão é nulo.
- Não apaga nada, não troca o id nem a Bíblia em uso de um perfil existente.
- Dois defeitos reais, ambos na janela principal:
  1. máquina que já tem `NVI.fsb`/`ARA.fsb` (o nome que o próprio `scripts/gerarBiblias.js` gera) fica com **4 Bíblias, duas "NVI" e duas "ARA"**, e a duplicata volta a cada abertura se for apagada;
  2. o "erro alto" **nunca aparece**: o código grava `alertMessage` mas não abre o popup.

## As quatro perguntas

### 1. Roda ou muda algo na janela de saída?

Não.

- `registrarBibliasEmbutidas` só é chamada em `src/frontend/utils/updateSettings.ts:364`, dentro de `updateList.scriptures`, que só roda via `updateSyncedSettings` (`src/frontend/IPC/responsesMain.ts:65`).
- Esse receptor só é montado por `setupMainReceivers()`, chamado apenas em `startupMain` (`startup.ts:73`). A janela de saída passa por `startupOutput` (`startup.ts:207-215`), que só liga o canal `OUTPUT` e nunca pede `SYNCED_SETTINGS`.
- No processo principal, `sendMain` só envia para a `mainWindow` (`src/electron/IPC/main.ts:16-21`).
- O store `scriptures` não é enviado para OUTPUT nem STAGE; só para REMOTE (`listeners.ts:211-213`) e para o índice no Firebase (`aliancaControle.ts:69`, com atraso de 2 s). O slide de versículo chega à saída com o texto já pronto.
- `defaults.ts`, `files.ts` e `responsesMain.ts` (electron) rodam no processo principal: um valor padrão, uma extração de função sem mudança de comportamento e um campo a mais numa resposta de IPC que só a janela principal pede.

Efeito colateral fora da janela principal: o Remote (celular) e o índice `biblia` do Firebase passam a listar as Bíblias novas, inclusive as duplicatas do achado A1.

### 2. Riscos para um perfil existente

| Risco | Resultado |
|---|---|
| Apaga algo | Não. O plano só acrescenta ou corrige `name`/`customName`; `installBundledBibles` nunca sobrescreve arquivo (`files.ts:447`). |
| Perde a Bíblia preferida | Não. O id é preservado na correção, registros novos entram no fim do objeto, e `drawerTabsData.scripture.activeSubTab` não é tocado. |
| Troca a Bíblia em uso no meio do culto | Não. O plano é idempotente depois da primeira carga. Ele roda de novo em restauração de backup, sincronização de nuvem e "resetar tudo" (`backup.ts:248`, `drive.ts:261/286`, `save.ts:62`), mas sem efeito novo. |
| Duplica | **Sim**, ver A1. |
| Bíblia importada à mão | Preservada. Só é "corrigido" um registro cujo arquivo não existe E que casa por id ou sigla com a embutida. |

### 3. Default `scriptures: {}`: alguém assume que há Bíblia?

Não encontrei quem quebre calado.

- `BiblePage.svelte:20` usa `versionIds[0] || ""`.
- `aliancaSpotlight.ts:108-120` devolve `null` e mostra `MOTIVO_SEM_BIBLIA`.
- `aliancaControle.ts:339` devolve `""` e `publicarBiblia` sai sem publicar.
- Não há mais `"nvi"` fixo em `src/` (fora dos testes e de um comentário velho em `ImportScripture.svelte:2-4`).
- O `electron-store` continua entregando a chave `scriptures` (vazia), então `updateList.scriptures` roda e o registro acontece também em perfil novo e em "resetar tudo".

Ressalva: se o instalador for gerado com `bundled-bibles/` sem `.fsb`, o app abre sem nenhuma Bíblia. O Spotlight avisa; a gaveta de Bíblia fica só vazia.

### 4. Perfil novo, máquina zerada: há corrida entre cópia e registro?

Não. `installBundledBibles()` é síncrona (`copyFileSync`) e roda em `src/electron/index.ts:137`, depois de `await setupStores()` e antes de `createMain()` (linha 155). A janela principal ainda não existe quando a cópia termina.

Furo lateral, que já existia antes do commit: a cópia só acontece na abertura. Se a pessoa trocar a pasta de dados com o app aberto, os registros ficam apontando para arquivos que só chegam à pasta nova na próxima abertura.

## Veredito por arquivo

| Arquivo | Veredito | Motivo |
|---|---|---|
| `src/electron/data/defaults.ts` | APROVAR | `{}` é seguro: nenhum leitor assume Bíblia no default e o registro cobre perfil novo. |
| `src/electron/utils/files.ts` | APROVAR | Extração pura de `bundledBiblesFolder()`; `installBundledBibles` não mudou. |
| `src/electron/IPC/responsesMain.ts` | APROVAR | Campo `embutida` aditivo, com try/catch; os 2 chamadores estão na janela principal. |
| `src/types/IPC/Main.ts` | APROVAR | Só tipo, campo opcional. |
| `src/frontend/utils/bibliasEmbutidas.ts` | APROVAR COM CORREÇÃO | O alerta de erro nunca é exibido (A2). |
| `src/frontend/utils/bibliasEmbutidasLogica.ts` | APROVAR COM CORREÇÃO | Duplica NVI/ARA em máquina que já tem `NVI.fsb`/`ARA.fsb` (A1). |

## Achados

### A1. MÉDIA-ALTA: duplica NVI e ARA em máquina que já tem `NVI.fsb`/`ARA.fsb`

- Onde: `bibliasEmbutidasLogica.ts:66-76`. O teste `bibliasEmbutidasLogica.test.ts:38-41` consagra o comportamento (`ara-embutida`).
- Premissa do commit que não fecha: `scripts/gerarBiblias.js:25,66,82` gera `NVI.fsb` e `ARA.fsb`, com `name` "NVI"/"ARA". Com esses arquivos o default antigo casava. Os arquivos longos (`Nova Versao Internacional (NVI).fsb`, `Almeida Revista e Atualizada 1993 (ARA).fsb`) estão hoje em `bundled-bibles/` local, fora do git, com ids aleatórios (`74a1c3786fc`), ou seja, parecem exportados pelo app e não gerados pelo script.
- Cenário: igreja instalada por um instalador anterior (commits `f679c55`/`51a2a4e`) tem `Bibles/NVI.fsb` e `Bibles/ARA.fsb` e os registros `nvi`/"NVI" e `ara`/"ARA", funcionando. O instalador novo copia os dois arquivos longos. O plano não acha registro com esses nomes; o registro antigo não conta como "antigo" porque o arquivo dele existe; então registra `nvi-embutida` e `ara-embutida` com `customName` "NVI"/"ARA".
- Efeito: 4 Bíblias na gaveta, no Spotlight (que lista todas, `aliancaSpotlight.ts:135`), no Remote e no Firebase, duas a duas com o mesmo rótulo. Apagar a duplicata não adianta: ela é registrada de novo na próxima abertura. A Bíblia em uso não muda.
- Não verifiquei o que há de fato na máquina da igreja; o cenário depende de o instalador anterior ter sido gerado com os arquivos do script.
- Correção: no plano, antes de registrar, tratar como "já tenho" qualquer registro local (sem `api`/`collection`) com id igual a `idBase` ou `name`/`customName` igual à sigla, mesmo com arquivo no disco. E decidir um único nome de arquivo para o instalador, alinhando `gerarBiblias.js` com o que vai em `bundled-bibles/`.

### A2. MÉDIA: o "erro alto" é mudo

- Onde: `bibliasEmbutidas.ts:25-28`.
- O código faz `alertMessage.set(...)` mas não `activePopup.set("alert")`. No resto do app os dois andam juntos (ex.: `Templates.svelte:111-112`), e ninguém assina `alertMessage` para abrir o popup. O erro só vai para o `console.error`.
- Cenário: registro de Bíblia sem arquivo. O comentário do código e o teste prometem aviso; a pessoa não vê nada.
- Correção: abrir o popup, com dois cuidados. Não atropelar o popup `initialize` da primeira execução. E como `updateList.scriptures` roda de novo em backup e sincronização, avisar uma vez por sessão.

### A3. BAIXA: falsos positivos na lista de erros (ficam relevantes quando A2 for corrigido)

- Onde: `bibliasEmbutidasLogica.ts:79-83`.
- `norm` não remove `.fsb` do nome registrado, embora `ImportScripture.svelte:18` trate esse caso. E `loadScripture` ainda abre Bíblias da pasta antiga `Documentos/Bibles` (`responsesMain.ts:324`), que o plano não olha.
- Cenário: Bíblia que abre normalmente seria acusada de "arquivo não existe" a cada abertura.
- Correção: normalizar o sufixo `.fsb`; aceitar o caminho legado ou não acusar nesse caso.

### A4. BAIXA: o copyright da NVI saiu do registro

- Onde: `defaults.ts:128` e `bibliasEmbutidasLogica.ts:76`.
- O default antigo levava "Nova Versão Internacional © Biblica, Inc."; o registro novo não tem `copyright`, e os `.fsb` longos têm `metadata.copyright` vazio.
- Não verifiquei onde esse campo aparece na tela; se a atribuição for exigência de licença, vale conferir.
- Correção: preencher o `metadata.copyright` no arquivo (o `gerarBiblias.js` já faz isso) ou levar o copyright no registro.

### A5. BAIXA: Bíblia embutida não pode ser removida

- Onde: `updateSettings.ts:364` + plano.
- Apagar a ARA da lista dura até a próxima abertura. O código anterior já se comportava assim para `nvi`/`ara`; agora vale para toda `.fsb` do instalador.
- Correção, se o dono quiser poder remover: guardar a lista de embutidas dispensadas.

### A6. INFO: janela curta com o nome antigo

- `scriptures.set(v)` roda antes do `await` do IPC (`updateSettings.ts:362-364`). Por alguns milissegundos `nvi` ainda tem `name: "NVI"`.
- Se algo tentasse abrir a Bíblia nesse intervalo, o id iria para `notFound.bible`, que só é limpo em dois pontos (`historyActions.ts:252`, `Connection.svelte:151`).
- Não achei quem leia tão cedo: o primeiro leitor automático é o `publicarBiblia`, com 2 s de atraso.
