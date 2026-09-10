<p align="center">
  <img src="brand-aliancashow/lockup-horizontal.png" width="440" alt="AliançaShow" />
</p>

<p align="center">
  Software de envio de vídeos e imagens para projetores e painéis de LED.
</p>

## Sobre

O AliançaShow é o programa de projeção usado nos cultos: monta o roteiro antes
e, na hora, controla o que aparece nas telas — letras de música, textos
bíblicos, vídeos, imagens e avisos — com saída para projetores e painéis de LED.

É um aplicativo de computador (Electron + Svelte) feito a partir do
[FreeShow](https://github.com/ChurchApps/FreeShow), e herda tudo que ele faz:
apresentação de letras e slides, stage display para os músicos, controle remoto
pelo celular, importação de Bíblias, saída NDI, gravação e múltiplas saídas
simultâneas.

## O que muda em relação ao FreeShow

Este não é um rebrand de superfície. As diferenças que importam no uso:

**Já vem com o conteúdo da igreja**

- A **Bíblia NVI** vai embutida no instalador e é instalada na primeira
  execução — ninguém precisa baixar Bíblia em máquina nova.
- **306 músicas** importadas do ProPresenter vão junto, na categoria Músicas.

**Integração com o [AliançaShow Remote](https://github.com/AliancaShow/AliancaShow-Remote)**

A equipe envia fotos, vídeos e músicas pelo celular durante a semana; o app
recebe esse material sem ninguém copiar arquivo na mão. A árvore do Storage é
espelhada na pasta Online do disco, e remover um item no Remote remove também
aqui. A pasta de shows é observada: mudou na pasta, recarrega sozinho.

**Layout D**

As oito abas da biblioteca ficam na metade de baixo do painel esquerdo, não na
barra do rodapé. Clicar numa aba abre o conteúdo dela no painel inferior do
centro, logo abaixo da grade de slides.

**Fonte embutida**

A Montserrat vai dentro do app, declarada em `public/global.css`. As músicas
convertidas pedem `font-family:'Montserrat'` peso 900; embutida, elas aparecem
certas em qualquer computador que receba o instalador, sem depender de
instalação no Windows — que exigiria permissão de administrador.

**O que foi retirado**

- Telemetria: Google Analytics e Sentry.
- O canal de atualização automática, que apontava para o projeto do autor
  original.
- Pixabay e Unsplash da aba Online.

**Identidade própria**

Nome, ícones e logotipo, com os arquivos de marca em
[`brand-aliancashow/`](brand-aliancashow). A assinatura de código do Windows
está desativada: o build original usava a conta Azure do projeto de origem, à
qual não temos acesso. O instalador sai sem assinatura e o SmartScreen avisa na
primeira execução.

## Rodando em desenvolvimento

Requisitos: [Node.js](https://nodejs.org/) 22.12+,
[Python 3.12](https://www.python.org/downloads/) com `setuptools`, e — no
Windows — o Visual Studio com "Desenvolvimento para desktop com C++" e o
Windows 10 SDK. No Linux, `libfontconfig1-dev`. Python e o compilador são
necessários porque dependências como NDI, áudio e SQLite são módulos nativos.

```bash
npm install
npm start
```

## Gerando o instalador

```bash
npm run build     # compila frontend, servidores e o processo do Electron
npx electron-builder --config config/building/electron-builder.yaml --win --publish never
node scripts/cleanBuilds.js
```

O resultado é `dist/AliancaShow-1.6.5-x64.exe`. É instalador por usuário: não
pede admin e instala por cima do que estiver na máquina, desde que o app esteja
fechado.

O `cleanBuilds.js` no fim não é opcional. O `preBuild` troca o `public/index.html`
para apontar ao bundle de produção e o `cleanBuilds` desfaz; sem ele, o
`npm start` fica quebrado e o arquivo de produção acaba versionado por engano.

**Compilar não atualiza o app instalado.** É preciso rodar o instalador por
cima para ver a mudança no app do dia a dia.

## Onde ficam os dados

| O quê | Onde |
| --- | --- |
| Shows, projetos, temas e mídias | `Documentos/AliancaShow` |
| Configurações | `AppData/Roaming/aliancashow` |

O que interessa em um backup é `Documentos/AliancaShow`.

## GitHub Actions

Os workflows em [`.github/workflows`](.github/workflows) rodam **apenas por
acionamento manual** (aba *Actions* → *Run workflow*). O `release.yml` disparava
a cada push na `main` e o `winget.yml` publicaria o pacote do projeto original
no catálogo público do WinGet; os dois foram desligados de propósito.

## Créditos e licença

Fork do **[FreeShow](https://freeshow.app/)**, criado e mantido pela
[ChurchApps](https://churchapps.org/) e por
[vassbo](https://github.com/vassbo). O mérito do software original é deles.

Distribuído sob **GPL-3.0**, a mesma licença do projeto original — veja
[LICENSE](LICENSE). O repositório ser privado é compatível com ela: a GPL não
obriga a publicar, só a entregar o código-fonte a quem receber o programa
compilado.
