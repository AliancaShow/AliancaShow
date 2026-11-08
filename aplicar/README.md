# Aplicar — tema “Vidro” do AliançaShow

Pacote de handoff para o Claude Code rodando **dentro do repositório** `AliancaShow/AliancaShow` (branch `main`).

Coloque esta pasta na raiz do repo (`aplicar/`) e comece pedindo ao Claude Code:

> Leia `aplicar/README.md` e implemente o tema “Vidro” seguindo a ordem de implementação. Não reestruture layout: o Layout D já existe.

---

## O que é este pacote

| Arquivo | O que é |
| --- | --- |
| `README.md` | Este documento. É a especificação executável — autossuficiente. |
| `Especificacao Tema AliancaShow.dc.html` | Especificação visual navegável (tokens, camada de vidro, tela por tela, aceite). Abrir no navegador. |
| `AliancaShow Mostrar.dc.html` | Protótipo funcional das telas Mostrar / Editar / Palco / Bíblia / Ajustes. Abrir no navegador. |
| `support.js` | Runtime que os dois arquivos `.dc.html` precisam. Não editar. |
| `theme/aliancashow-vidro.json` | Tema no formato `Themes` (o mesmo de `defaultThemes.ts`). Pode ser copiado direto. |

### Sobre os arquivos de design

Os dois `.dc.html` são **referências de design feitas em HTML** — protótipos que mostram aparência e comportamento pretendidos, **não código de produção para copiar**. A tarefa é **recriar esse visual no ambiente do próprio codebase**: Svelte 4 + TypeScript + Electron, CSS por componente (`<style>` dentro de cada `.svelte`), variáveis CSS globais em `public/global.css` e o sistema de temas do app.

**Fidelidade: alta (hifi).** Cores, tipografia, espaçamentos, raios e estados abaixo têm valores exatos e devem ser reproduzidos fielmente. Onde um componente do FreeShow não estiver descrito, seguir a escala de tokens deste documento em vez de inventar valores.

---

## Regra de ouro

Este redesenho é **um tema novo + ajustes de CSS por componente**. Não é rewrite, não é mudança de arquitetura.

- A hierarquia de navegação, os painéis, os stores e as ações continuam **iguais**.
- O “Layout D” (Projetos em cima, Biblioteca de 8 abas embaixo, drawer dentro do `.center`, relógio no pé da coluna direita) **já está implementado** em `src/frontend/MainLayout.svelte`. Não mexer nessa estrutura.
- Só existem **três** estados novos (seção “Estado necessário”).

---

## Cor de marca

O vermelho oficial é **`#F21A27`** (“Vermelho LED” do guia de marca), já presente em `public/global.css`. O handoff anterior usava `#e4383f`, calibrado a partir de um print — **descartar esse valor**. A cor vive num único ponto: o token `--secondary`.

Vinho `#750B0B` e dourado `#F1D278` permanecem apenas como acentos existentes (`--accent`, gradientes do `MaterialButton`). Não entram na interface do dia a dia.

---

## Design tokens

### Marca

| Token | Valor | Uso |
| --- | --- | --- |
| `--secondary` | `#f21a27` | Marca. Item no ar, blackout, “Limpar tudo”, borda de aba ativa |
| `--secondary-opacity` | `rgba(242,26,39,0.5)` | Seleção de texto, outline do editbox (já existente) |
| wash de marca | `rgb(242 26 39 / 0.16)` | Fundo de item ativo / no ar |
| linha de marca | `rgb(242 26 39 / 0.30)` | Borda (`inset 0 0 0 1px`) do elemento ativo |
| glow no ar | `rgb(242 26 39 / 0.60)` | Glória luminosa atrás do slide no ar, com `blur(15px)` |
| texto sobre marca | `#ff8f97` | Texto/ícone sobre wash de marca |
| texto de marca forte | `#ff9aa2` | Número do slide no ar, chip de arranjo ativo |
| ponto “NO AR” | `#ff5b66` | Ponto pulsante do badge |

### Superfícies e texto

| Token | Valor |
| --- | --- |
| `--primary` | `#141416` |
| `--primary-lighter` | `#1f2023` |
| `--primary-darker` | `#0f0f11` |
| `--primary-darkest` | `#0a0a0c` |
| `--text` | `#eceded` |
| escala de texto | `#ffffff` · `#c2c3c9` · `#a9aab0` · `#83848b` · `#6f7077` |
| `--hover` | `rgb(255 255 255 / 0.05)` |
| `--focus` | `rgb(242 26 39 / 0.28)` |
| linha de lista | `rgb(255 255 255 / 0.035)` |
| controle / campo | `rgb(255 255 255 / 0.06)` |
| selecionado neutro | `rgb(255 255 255 / 0.09)` |
| trilha de segmented | `rgb(0 0 0 / 0.30)` – `rgb(0 0 0 / 0.35)` |
| divisor | `rgb(255 255 255 / 0.06)` |
| status ok / atenção / off | `#4ade80` · `#facc15` · `#4b4e55` |
| cores de grupo | Verso `#6ea8fe` · Coro `#f21a27` · Ponte `#facc15` · Final `#4ade80` · Pré-coro `#a78bfa` |

### Espaçamento, raios, sombras

- Escala: `2 / 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20px`.
- Padding de painel `12–16px`; gap entre painéis `12px`; gap da grade de slides `14px`; gap da grade de mídia `10px`.
- Raios: `2px` (chips de cor) · `8px` (linhas, botões pequenos) · `9px` (botões de ação) · `10px` (cards de slide, preview) · `12px` (painéis) · `18–20px` (pills e trilhas).
- **Sem sombras projetadas nos painéis** — a profundidade vem de desfoque + borda. Sombra fica só para overlays (popup, contexto, toast). Remover `box-shadow: 0 0 4px rgb(0 0 0 / 0.4)` de `components/main/Top.svelte`.

### Tipografia

Fonte de UI: stack de sistema (não mudar). Dados numéricos e técnicos: **JetBrains Mono**, empacotada localmente (Electron não deve buscar fonte em runtime).

```css
/* public/global.css — .woff2 em public/fonts/ */
@font-face {
  font-family: "JetBrains Mono";
  src: url("./fonts/JetBrainsMono-VariableFont_wght.woff2") format("woff2-variations");
  font-weight: 400 700;
  font-display: block;
}
:root { --font-mono: "JetBrains Mono", ui-monospace, monospace; }
```

| Escala | Uso |
| --- | --- |
| 30px / 500 / mono, `-0.02em` | Relógio da coluna direita |
| 22px / 700 | Texto renderizado no preview de saída |
| 19px / 600, `-0.015em` | Título do show |
| 14px / 600 | Texto da miniatura de slide |
| 13px / 600 | Marca, abas do topo, botão primário |
| 12.5px / 400 | Itens de lista |
| 12px / 400 | Labels de controle |
| 11px uppercase, `0.12em` | Cabeçalho de painel |
| 10px mono, `0.08em` | Chips, status, contexto de pasta |
| 9px–8px mono | Metadados (índice, duração, camada) |

Nada abaixo de **10px** para texto lido em operação; nada abaixo de **8px** em nenhum lugar. Montserrat e CMGSans continuam fontes de *conteúdo projetado*, não de UI.

---

## Camada de vidro

Adicionar em `public/global.css`, no `:root`, ao lado dos tokens existentes:

```css
:root {
  --glass:      rgb(255 255 255 / 0.04);   /* superfície de painel */
  --glass-line: rgb(255 255 255 / 0.07);   /* borda hairline */
  --glass-blur: 24px;
  --radius:     12px;

  --canvas: radial-gradient(120% 90% at 16% -10%, #1c1418 0%, #0b0b0d 52%, #08080a 100%);
}

/* aplicar nos CONTAINERS de painel, nunca nas linhas internas */
.panel {
  background: var(--glass);
  backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-line);
  border-radius: var(--radius);
}

/* special.optimizedMode já faz .isOptimized { backdrop-filter: none !important; }
   por isso o vidro precisa de fundo sólido de fallback */
.isOptimized .panel { background: var(--primary-darker); }
```

Barra superior usa `rgb(255 255 255 / 0.045)`.

Brilho decorativo de marca atrás dos painéis (absoluto, `pointer-events: none`):

```css
position: absolute; top: -140px; left: -80px; width: 600px; height: 460px;
border-radius: 50%; background: rgb(242 26 39 / 0.15); filter: blur(100px);
```

Se houver queda de FPS em máquina fraca, trocar por PNG/gradiente estático.

**Regras que acompanham o vidro**

- **Sem bordas internas de 1px** entre linhas de lista — a separação é por fundo. Remover `border-bottom: 1px solid var(--secondary)` de `drawer/media/Media.svelte` e `drawer/audio/Audio.svelte`.
- **Seleção neutra ≠ seleção de marca.** Apenas selecionado: `rgb(255 255 255 / 0.09)`. No ar / ativo: wash de marca + `inset 0 0 0 1px` linha de marca. Hoje `drawer/Card.svelte` usa `outline: 2px solid var(--secondary)` nos dois casos — separar.
- **Transições:** `background-color 120ms ease, border-color 120ms ease, color 120ms ease`. Nada acima de 160ms — é ferramenta ao vivo.
- **Foco de teclado:** `box-shadow: 0 0 0 2px var(--focus)`. Obrigatório: o app é operado por teclado.
- **Estados vazios:** texto 12px `#6f7077` centralizado, sem ilustração.

---

## Tema

`theme/aliancashow-vidro.json` está no formato `Themes` de `src/types/Settings.ts`:

```json
{
  "name": "AliançaShow — Vidro",
  "font": { "family": "", "size": "1em" },
  "colors": {
    "primary": "#141416",
    "primary-lighter": "#1f2023",
    "primary-darker": "#0f0f11",
    "primary-darkest": "#0a0a0c",
    "text": "#eceded",
    "textInvert": "#161616",
    "secondary-text": "#f8f8f0",
    "secondary": "#f21a27",
    "secondary-opacity": "rgba(242, 26, 39, 0.5)",
    "hover": "rgb(255 255 255 / 0.05)",
    "focus": "rgb(242 26 39 / 0.28)"
  }
}
```

Instalar como tema padrão: adicionar a entrada em `src/frontend/components/settings/tabs/defaultThemes.ts` com `default: true` e apontar o tema inicial em `src/frontend/utils/startup.ts`. **Não apagar os temas do FreeShow.**

`secondary-text` é recalculado por contraste em `App.svelte` — manter off-white sobre o vermelho da marca. `font.family` vazio preserva a stack de sistema: o que muda é a escala, não a fonte de UI.

---

## Telas

### 1. Barra superior — `components/main/Top.svelte`, `components/inputs/TopButton.svelte`

- Altura **54px** (hoje 40px), `display:flex; align-items:center; gap:18px; padding:0 16px`, raio 12px, superfície de vidro, **sem** `box-shadow`.
- Marca: quadrado 9×9px, raio 2px, `var(--secondary)` + “ALIANÇA” 13px/600, `letter-spacing:0.18em`, uppercase, cor `#eceded`. Substitui o `h1` de 1.8em.
- Divisor 1px × 22px, `rgb(255 255 255 / 0.08)`.
- Abas **Mostrar / Editar / Palco / Bíblia**: ícone 15px + label 13px, `padding:7px 14px`, raio 8px, gap 8px.
  - ativa: fundo `rgb(255 255 255 / 0.09)`, texto `#fff`, peso 600
  - inativa: sem fundo, `#83848b`, peso 400; hover `rgb(255 255 255 / 0.05)`, texto `#c2c3c9`
- Badge **“NO AR”** — só quando `$outputDisplay` é `true`; é o único elemento com pulso:

```css
padding: 6px 12px; border-radius: 20px;
background: rgb(242 26 39 / 0.14); border: 1px solid rgb(242 26 39 / 0.30);
font-family: var(--font-mono); font-size: 11px; color: #ff8f97;
```

  Ponto 6×6px `#ff5b66` com `@keyframes liveGlow` (opacity .55 → 1 → .55, 2s, `ease-in-out`, infinito). Texto: `NO AR · <tempo de culto>` em mono.
- Ícones utilitários à direita: 32×32px, raio 8px, fundo `rgb(255 255 255 / 0.05)`, ícone 16px `#9a9ba1`. O botão de saídas (`output_window_button`) fica em estado de marca (wash + linha + ícone `#ff8f97`) em vez do `border-bottom` atual.

### 2. Projetos — `components/show/Projects.svelte`

- Cabeçalho `padding:14px 16px 10px`: ícone pasta 14px `#83848b` + “PROJETOS” 11px uppercase `0.12em`; `+` (14px, stroke 1.8) à direita.
- Nó do projeto: 13px/600 `#eceded`, chevron 13px em `var(--secondary)` quando expandido, contador em mono 10px `#6f7077`.
- Item do culto: `padding:7px 9px`, raio 8px, gap 9px — índice mono 9px `#6f7077` (largura fixa 13px), nome 12.5px com ellipsis, tipo mono 9px (`VID`, `LTR`, `SLD`, `BIB`, `IMG`).
  - item no ar: wash de marca, nome `#fff`, tipo `#ff8f97`
  - item apenas aberto: `rgb(255 255 255 / 0.09)`
  - hover: `rgb(255 255 255 / 0.05)`

### 3. Biblioteca — `components/drawer/LibraryTabs.svelte`

Manter a borda-esquerda de 3px em `var(--secondary)` da aba ativa. Trocar o fundo da ativa por wash de marca; header para 11px uppercase `0.12em` `#83848b`; linhas `padding:8px 9px`, raio 8px, gap 11px, ícone 15px, label 12.5px `#a9aab0`.

Ordem já existente em `values/tabs.ts`: Shows · Mídia · Áudio · Sobreposições · Modelos · Bíblia · Calendário · Funções.

### 4. Show (grade de slides) — `components/show/Show.svelte`, `show/Slides.svelte`, `slide/Layouts.svelte`

- Cabeçalho `padding:16px 20px 12px`, gap 14px: título 19px/600 `-0.015em`; chip de categoria (`padding:3px 9px`, raio 20px, fundo `rgb(255 255 255 / 0.07)`, 11px `#b6b7bd`); contagem mono 10px `#6f7077`; à direita botão “Arranjo” (pill, `padding:6px 12px`, raio 18px, fundo `rgb(255 255 255 / 0.06)`, 12px `#d6d7da`) e alternador grade/lista (30×30px, raio 8px; ativo `rgb(255 255 255 / 0.09)` + ícone `#fff`).
- Barra de arranjo: chips mono 10px, `padding:5px 11px`, raio 14px, `letter-spacing:0.08em`, gap 6px. Seção atual: `rgb(242 26 39 / 0.22)` + `#ff9aa2`. Outras: `rgb(255 255 255 / 0.06)` + `#a9aab0`.
- Grade: `repeat(5, 1fr)`, gap 14px, `align-content:start`, `padding:0 20px 18px`. Cinco por linha é a densidade aprovada.
- Card: raio 10px, `overflow:hidden`, borda `rgb(255 255 255 / 0.07)`, fundo `rgb(255 255 255 / 0.03)`. Área do slide `aspect-ratio:16/9`, fundo `#000` (no app, a miniatura real). Rodapé `padding:7px 10px`, fundo `rgb(255 255 255 / 0.03)`, número mono 10px + grupo 10px uppercase `0.09em` `#83848b`.
- **Slide no ar — “glória luminosa”** (a sinalização escolhida; não usar borda vermelha grossa):

```css
/* pseudo-elemento atrás do card */
position: absolute; inset: -13px; border-radius: 18px;
background: rgb(242 26 39 / 0.60); filter: blur(15px);
/* e no card */
border-color: rgba(255,120,130,0.75);
```

  Número do slide em `#ff9aa2`. Entra com `opacity`/`filter` em 160ms; **não animar em loop**.
- Próximo slide: apenas borda mais clara (`rgb(255 255 255 / 0.18)`), sem glow. Selecionado: `rgb(255 255 255 / 0.28)`. Hover: `rgb(255 255 255 / 0.14)`.

### 5. Drawer / Mídia — `components/drawer/Drawer.svelte`, `drawer/media/Media.svelte`, `drawer/Card.svelte`

- Altura 264px, duas partes.
- **Fontes** (210px, `padding:14px 12px`, divisor à direita): título com ícone; linhas `padding:7px 9px`, raio 8px, gap 10px — ponto 6×6px raio 2px (`#4b4e55` inativo, `var(--secondary)` ativo), nome 12.5px, contagem mono 9px. Ativo: wash de marca + `#fff`. Rodapé: “Adicionar pasta” full-width, `padding:9px`, raio 8px, fundo `rgb(255 255 255 / 0.06)`.
- **Arquivos** (`flex:1`, `padding:14px 16px`, gap 10px): busca em pill (`padding:6px 12px`, raio 18px, fundo `rgb(255 255 255 / 0.05)`, lupa 13px, placeholder 12px `#6f7077`, `max-width:280px`) + contexto à direita mono 10px (`FUNDOS · 24 ARQUIVOS`). Grade `repeat(6, 1fr)`, gap 10px: thumb `aspect-ratio:16/9`, card raio 8px, borda `rgb(255 255 255 / 0.06)`, duração mono 8px `rgba(255,255,255,0.75)` no canto inferior direito, nome 10px `#a9aab0` em faixa `rgb(255 255 255 / 0.03)`, `padding:5px 7px`, com ellipsis.
- Item em uso: borda `rgba(255,120,130,0.75)`. Apenas selecionado: `rgb(255 255 255 / 0.09)`.

### 6. Monitor de saída — `components/output/preview/Preview.svelte` + `PreviewOutputs.svelte`, `MultiOutputs.svelte`, `output/ShowActions.svelte`, `preview/ClearButtons.svelte`

- `padding:14px`, gap 11px. As `.section` trocam `border-radius:10px` + borda por vidro e raio 12px; o modo `float` mantém o `backdrop-filter` já existente.
- **Comutador de saídas** (decisão de produto: *uma* área de monitoramento comutável, não N previews): segmented full-width, trilha `rgb(0 0 0 / 0.35)`, `padding:3px`, raio 20px; opção `flex:1`, `padding:6px`, raio 16px, mono 10px; ativa `rgb(255 255 255 / 0.10)` + `#fff`/700; inativa `#83848b`. Opções: PROJETOR · LED · STREAM · PALCO. **Troca só o que o preview mostra; não altera qual saída está no ar.**
- Preview `aspect-ratio:16/9`, raio 10px, borda `rgb(255 255 255 / 0.12)`, fundo `#000` (conteúdo é o output real).
- Linha de status mono 10px `#83848b`, `space-between`: resolução/refresh à esquerda, `04 / 10` à direita.
- **Transporte:** 5 botões `flex:1`, altura 36px, raio 9px, fundo `rgb(255 255 255 / 0.06)`, ícone 16px `#d6d7da` — anterior, próximo, play, travar, blackout. Só o blackout usa marca (wash + `inset 0 0 0 1px` linha + ícone `#ff8f97`).

### 7. Ações — `preview/ClearButtons.svelte`

- `padding:12px`, gap 10px.
- **Limpar tudo**: `background: rgb(242 26 39 / 0.90)`, `padding:10px`, raio 9px, 13px/700 `#fff`, ícone × 14px stroke 2. Hover: `var(--secondary)` cheio. **É o único botão sólido vermelho da tela — a hierarquia depende disso.**
- **Seletores de camada**: 5 botões `flex:1`, altura 38px, raio 9px, barra 12×2px + label mono 8px (`TEXTO`, `FUNDO`, `SOBREP`, `ÁUDIO`, `PALCO`). Ativa: wash de marca + `#ff8f97`; inativa `rgb(255 255 255 / 0.06)` + `#a9aab0`.

### 8. Grupos / Metadados / Notas — `components/show/ShowTools.svelte`

- Abas: trilha `rgb(0 0 0 / 0.30)`, `padding:4px`, `margin:10px 10px 0`, raio 9px; ativa `rgb(255 255 255 / 0.09)`, 12px/600 `#fff`; inativa `#83848b`.
- Lista de grupos: linhas `padding:8px 10px`, raio 8px, fundo `rgb(255 255 255 / 0.035)`, gap 10px — chip de cor 7×7px raio 2px, nome 12.5px `#c2c3c9`, contagem mono 9px `#6f7077`.

### 9. Relógio — `components/system/Clock.svelte` + `.clockArea` em `MainLayout.svelte`

`padding:14px 16px`, `align-items:baseline`, `space-between`: hora mono 30px/500 `-0.02em` `#eceded`, segundos 15px `#6f7077`; data 11px `#83848b`. **O relógio gigante vermelho sai** — a classe `.colored` (`color: var(--secondary)`) deixa de ser aplicada aqui; vira informação de apoio, não protagonista. Manter a cor de marca no relógio apenas nos itens de *palco*, onde é conteúdo.

### 10. Editar — `components/edit/Editor.svelte`, `edit/Navigation.svelte`, `edit/Slides.svelte`, `edit/tools/*`, `edit/editbox/Editbox.svelte`

Mesma moldura e vidro. Barras de ferramenta trocam `var(--primary-darker)` por vidro + raio 12px; campos internos `rgb(255 255 255 / 0.06)`, raio 8px. Editbox mantém o outline em `var(--secondary-opacity)` (é seleção, não marca), reduzido para 3px. A tira de slides usa **o mesmo card e a mesma sinalização de no ar** da grade do Mostrar — não podem existir duas linguagens de slide.

### 11. Palco — `components/stage/StageLayout.svelte`, `StageLayouts.svelte`, `StageTools.svelte`

Lista de layouts com a linha de 8px/raio 8px do painel Projetos; layout ativo com wash de marca. O canvas de edição continua preto puro (é WYSIWYG do que o músico vê) — só a moldura ganha raio 12px. A saída de palco aparece como a opção PALCO do comutador, sem preview separado.

### 12. Bíblia — `components/bible/BiblePage.svelte`, `drawer/bible/Scripture.svelte`

Colunas livro / capítulo / versículo em vidro raio 12px. Números de versículo em mono 11px `#6f7077`. Versículo selecionado: trocar o preenchimento sólido `var(--secondary)` por wash de marca + texto `#fff` (o sólido vermelho é exclusivo do “Limpar tudo”). O `border-inline-start: 3px solid var(--secondary)` do versículo ativo **permanece** — é a única régua vermelha que sobrevive. Projetos fica à esquerda também nesta página (já implementado).

### 13. Ajustes — `components/settings/Settings.svelte`, `SettingsTabs.svelte`, `settings/tabs/Theme.svelte`, `components/inputs/Material*.svelte`

`SettingsTabs` herda a linha da Biblioteca (borda-esquerda 3px + wash de marca na ativa). Grupos de configuração viram cards de vidro raio 12px; `CombinedInput`/`InputRow` em `rgb(255 255 255 / 0.06)`, raio 8px, altura mínima 36px. `MaterialButton` `contained` usa `var(--secondary)` plano, sem o gradiente vinho→dourado (exceto ações destacadas de marca).

### 14. Remote — `src/server/` (remote · stage · cam), `utils/remoteTalk.ts`, `utils/aliancaRemote.ts`

Mesmos tokens de cor e o mesmo card de slide (raio 10px, glow de no ar). Alvos de toque **nunca abaixo de 44px**. O transporte repete a ordem do monitor: anterior, próximo, play, travar, blackout. O app **AliançaShow Remote** (repositório separado) recebe a paleta em um segundo passo — fora do escopo deste pacote.

---

## Interações e comportamento

- **Navegação de slides:** clique envia ao output; teclado (setas / espaço / Page Up-Down) mantém o comportamento atual do FreeShow (`utils/shortcuts.ts`, `Preview.svelte`). Duplo-clique no item do projeto abre o show.
- **Bíblia:** clique seleciona o versículo, duplo-clique envia ao ar.
- **Hover** em itens de lista e botões: `rgb(255 255 255 / 0.05)`; cursor `default` (app desktop), `pointer` só onde já é `pointer` hoje.
- **Comutador de saídas:** troca apenas o preview.
- **Blackout:** limpa visualmente a saída sem perder o slide atual.
- **Responsivo:** abaixo de ~1280px de largura, o painel Mídia colapsa para 200px de altura e a grade de slides cai para 4 colunas; abaixo de ~1100px a coluna direita vira gaveta. Larguras fixas das colunas laterais **nunca** escalam por viewport units.

## Divisões redimensionáveis

Três divisões são arrastáveis verticalmente. Usar o componente que já existe: `components/system/Resizeable.svelte`, com o store `resized` (`src/frontend/stores.ts`) — o mesmo mecanismo de `leftPanel` / `rightPanel` / `timeline`, que já persiste o tamanho.

| Divisão | Painéis | Limites | Id sugerido no store |
| --- | --- | --- | --- |
| Projetos ↔ Biblioteca | `Projects.svelte` / `LibraryTabs.svelte` (coluna esquerda) | 120–620px | `library` |
| Slides ↔ Mídia | `Show.svelte` / `Drawer.svelte` (coluna central) | 140–560px | `drawer` (já existe) |
| Projetor ↔ Grupos | `Preview.svelte` / `ShowTools.svelte` (coluna direita) | 210–560px | `preview` |

Alça: 12px de altura no vão entre os painéis, `cursor: row-resize`, barra interna de 44×3px, raio 2px, `rgb(255 255 255 / 0.14)`; hover do vão `rgb(255 255 255 / 0.06)`. O painel que rola recebe `min-height: 0` + `overflow: hidden`; o outro fica com altura fixa vinda do store.

No monitor de saída, status e transporte ficam ancorados no rodapé (`flex: 1` num espaçador antes deles), para que aumentar o painel não desalinhe os controles.

## Regra de layout crítica

Todo painel que rola precisa de `min-height: 0` + `overflow: hidden` no container flex e `flex: none` nas linhas internas. Sem isso, os cards de altura fixa consomem a coluna e o painel `flex: 1` corta uma linha no meio.

## Estado necessário

Nada novo além do que o app já tem, com três exceções:

| Estado | O que é |
| --- | --- |
| `previewOutputId` | Qual saída o monitor único está exibindo. Local ao painel, persistir por sessão. |
| `serviceElapsed` | Cronômetro do culto no badge “NO AR”, derivado do instante em que a primeira saída ficou ativa. |
| `activeLayer` | Camada selecionada (texto / fundo / sobreposição / áudio / palco). O conceito já existe; aqui ganha UI explícita. |

Todo o resto (projeto ativo, show ativo, índice de slide, arranjo, outputs, grupos) já está nos stores (`src/frontend/stores.ts`).

## Assets

- **Logotipo**: exportar SVG monocromático de `brand-aliancashow/Logotipo_AliançaShow.pdf` para a barra superior. Hoje o mock usa quadrado + wordmark tipografado.
- **Ícones**: usar o set do próprio app (`components/helpers/Icon.svelte` + `values/icons.ts`), normalizado em **15px, stroke 1.6, `currentColor`, sem preenchimento**. Não desenhar ícones novos.
- **Miniaturas de mídia**: no protótipo são placeholders listrados; no app são as thumbnails reais.
- **JetBrains Mono**: baixar o `.woff2` (licença OFL) para `public/fonts/`.

## Ordem de implementação

1. Instalar o tema (cores + escala tipográfica) e aplicar globalmente. Já resolve a maior queixa: “tudo tem o mesmo peso”.
2. Variáveis de vidro em `public/global.css` + converter os containers de painel (bordas duras → vidro + raio 12px), com fallback sólido para o modo otimizado.
3. Normalizar os ícones (15px / stroke 1.6 / monocromático).
4. Grade de slides: card novo + sinalização de no ar por glow.
5. Barra superior: 54px, abas com ícone, badge NO AR, ícones utilitários.
6. Coluna direita: comutador de saída único, transporte, camadas, abas, relógio reduzido.
7. Painel Mídia (fontes + grade de 6 colunas); depois Bíblia, Editar, Palco e Ajustes na mesma linguagem.

## Aceite

- [ ] Em 1600×900 nenhum painel corta linha no meio.
- [ ] O slide no ar é identificável a 3 metros de distância, sem procurar.
- [ ] Só existe um botão sólido vermelho na tela Mostrar: “Limpar tudo”.
- [ ] Nenhum texto operacional abaixo de 10px; nenhum texto abaixo de 8px.
- [ ] Anel de foco visível em todos os controles alcançáveis por Tab.
- [ ] Com `special.optimizedMode` ligado a interface continua legível.
- [ ] `npm run lint` e `npm test` passam.

## Pendências para o cliente

- Exportar o SVG do logotipo para a barra superior.
- Confirmar se o vermelho de projeção (conteúdo) é o mesmo `#F21A27` da interface.
- Baixar o `.woff2` da JetBrains Mono para `public/fonts/`.
