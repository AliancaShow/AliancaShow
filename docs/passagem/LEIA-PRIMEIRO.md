# AliançaShow: passagem entre computadores (atualizado em 22/nov)

> **Atualização 22/nov (noite): o trabalho agora segue na `feat/cabine-6`** (parte da `feat/cabine-5`). Leia `referencia/plano-cabine-6.md` (decisões D1–D29 do André), `referencia/desenho-motor-de-saida.md` (vídeo decodificado uma vez) e, para o teste de 23/nov no PC da cabine, `referencia/roteiro-igreja-23nov.md`. Regra nova para tudo: **entrada derrubada nunca volta sozinha** (D4). npm global 11 falha com dependências git: use `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" install`.

Este arquivo é para o Claude Code que vai continuar o trabalho, seja no PC da projeção da igreja ou em outro computador. Leia o arquivo inteiro antes de mexer em qualquer coisa.

> Os caminhos `referencia/...` deste arquivo ficam em `docs/passagem/referencia/` no repo.

## O que é
O AliançaShow é um fork do FreeShow (Svelte 3 + Electron) e vai substituir o ProPresenter na Igreja Aliança. É o "leiaute v2" (tema Luz). Não existe modo clássico nem versão de reserva. O André (dono) testa aqui na cabine, em 1920×1080, escala 100%.

Repo: `https://github.com/AliancaShow/AliancaShow`. A pilha de PRs rascunho é **#38 → #39 → #40 → #41 → #42 → #43**. Trabalhe a partir de **`feat/cabine-5`** (PR #43; HEAD `612e3d8` ou mais novo). A `feat/cabine-5` parte da `feat/cabine-4` (`7e7dd1b`). O instalador que está na cabine é o `fd8b5c6`.

O que a cabine 5 já fez está nos commits da `feat/cabine-5` e nas anotações `referencia/desenho-midia-cabine5.md` e `referencia/aprovo-fecho-midia-cabine5.md`. Isso inclui a biblioteca de mídia, Apagar do computador (Lixeira), a prévia escondida sem vídeo por saída e escolher/editar o modelo da Bíblia.

## Como montar
1. Pré-requisitos: Git, Node 22 (a máquina de origem usa 22.16) e `gh` logado numa conta com acesso ao repo (`gh auth login`).
2. Clone o repo em `C:\AliancaShow-dev`, ou em outra pasta FORA de Documentos\AliancaShow:
   ```
   git clone https://github.com/AliancaShow/AliancaShow.git
   git checkout feat/cabine-5
   npm install
   ```
3. Copie a pasta `bundled-bibles\` (ARA e NVI) para a raiz do clone. Ela NÃO está no Git: leve por pendrive/nuvem a partir de `C:\AliancaShow-dev\bundled-bibles` do PC da cabine. Os `.fsb` são gitignored; sem eles o instalador sai sem Bíblia.
4. Para rodar em dev: `npm start` (Vite :3000 + Electron).

## ⚠️ Cuidado, esta máquina é a de produção
- **Os dados reais da igreja ficam em `Documentos\AliancaShow`** (shows, mídias, Bíblias, configurações). O app de dev e as fumaças usam a mesma pasta de dados por padrão. **Antes de rodar o app de dev ou qualquer fumaça**, aponte o app para um perfil de teste separado (`--user-data-dir` próprio e pasta de dados de teste, como as fumaças fazem com `FS_PERFIL_DIR` / `FS_MOCK_STORE_PATH`). Também faça uma cópia de `Documentos\AliancaShow` e guarde fora. Nunca rode `restaurar`/limpeza de perfil sobre os dados reais.
- O app instalado e o app de dev não devem ficar abertos ao mesmo tempo sobre os mesmos dados.
- Não mova saídas (telão) pelo mapa das telas durante um culto.

## Regras do André (não negociáveis)
- **Sem modo clássico, fallback ou flag.** O que não tem lugar no leiaute novo quebra alto e visível, nunca cai calado no antigo.
- Todo box é redimensionável; nada fica flutuando por cima do conteúdo; as divisórias persistem.
- Cores e raios só com tokens `--luz-*` (`public/global.css`); nada de valor solto.
- **Fecho da janela de saída:** os arquivos que a janela de saída (telão/retorno/palco) carrega estão listados por `node scripts/prova-culto/ancora.mjs`.
  - Mudar QUALQUER arquivo do fecho precisa de aprovação explícita do André **antes**. Mostre o arquivo, o diff e o motivo, e espere ele escrever "aprovo …".
  - Não edite `ancora.mjs`, `esperado.json` nem os invariantes sem esse "aprovo". Depois dele, registre a exceção recalculando os shas.
  - Antes de gerar qualquer instalador, rode `ancora.mjs` você mesmo. **Tem que dar `ANCORA: ok`.** Não confie em relato de subagente: já aconteceu de um agente afirmar "ok" com 6 arquivos alterados.
- **Prova do Culto** (`scripts/prova-culto/`): grave o HEAD e compare com `referencia/gravacoes/gravacao-base-2d62837.json` usando `--esperado esperado.json --ruido`. O critério é **0 divergência em outputs**.
  - As 38 divergências em `principal.sinais` (`midia/sub` "pasta:raiz"→"all" etc.) são esperadas, da árvore C6.
  - Se der F01 `align`, é partida a frio: regrave.
  - Cabine 6, fatia V1 (Visual): na primeira carga a migração grava `special.aliancaVisuais` e `special.aliancaVisualAtivo`. O `special` inteiro vai para a janela de saída (`listeners.ts:366`), então aparece uma divergência **esperada** em `OUTPUT:SPECIAL` (só essas duas chaves; ninguém na saída as lê). Em `principal.sinais` entram a pílula do Visual, a linha de origem e o item "Visual" de Configurações. Os campos `styles`/`outputs` **não** mudam na migração: divergência em outro canal de saída é defeito.
  - Cabine 6 (`feat/cabine-6-telao`): o app abre com o telão ligado. Uma vez por perfil, `aliancaTelaoPartida.ts` liga `autoOutput` e grava `special.aliancaTelaoNaPartida`. O perfil da Prova (`scripts/prova-culto/perfil`) já traz essa marca (o telão continua desligado na partida das fumaças); ela é a terceira chave esperada em `OUTPUT:SPECIAL`.
- Desenho e plano passam por revisão cética ANTES do código. Mudança grande de UX: discuta com o André antes.
- Commits:
  - autoria `git -c user.name="André Zagato" -c user.email="zagato@mediavaultmm.com" commit`, mensagem em pt;
  - **proibido `push --force`, merge na `main` e `click({force:true})` em testes**;
  - merges sempre normais (nada de rebase).
- Testes antes de entregar:
  - `npm run test:layout` verde;
  - unit: só os 4 `RtmpStreamer.integration` falham, porque precisam de ffmpeg real;
  - svelte-check com no máximo 152 erros;
  - fumaças t2, t4, t6, t7-menus, t8, t9, t9-palco, t10, t11, t12, t13, t14 e vivo.

## Instalador
Rode com o clone limpo e `bundled-bibles\` presente:
```
npm run build
$env:CSC_IDENTITY_AUTO_DISCOVERY='false'; npx electron-builder --config config/building/electron-builder.yaml --win nsis --x64 --publish never
```
O `.exe` sai em `dist\`. Confira que `dist\win-unpacked\resources\bibles` tem os 2 `.fsb`.

## Onde paramos (pendências)
- Perguntas abertas ao André:
  1. o cartão do Spotify na faixa de vídeo precisa de volume?
  2. com o "só retorno" ligado e o item de palco "saída atual" apontando de propósito para o telão: mostra o telão (como hoje) ou o que foi para o retorno?
- Baixos não feitos da revisão do PR #42: 6, 13, 14, 15 e 16 (`referencia/revisoes/revisao-cabine4-codigo.md`).
- Abertos de antes:
  - o áudio da gaveta não é barrado no modo só retorno;
  - o fundo do slide não acompanha no retorno;
  - "Pré-visualizar" está sem substituto;
  - falta o recurso de alertas rápidos por cima da letra ("placa XXX-XXXX", "pais da criança X").
- O que foi decidido nesta rodada: `referencia/rodada-cabine-18nov.md`. O board aprovado é `referencia/leiaute-v2-prototipos/Rodada-cabine-C1-C5.html`.
