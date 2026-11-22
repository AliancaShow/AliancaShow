# Revisão cética — PR #39 (`feat/cabine-1b`, `a548045`+`b839e57` sobre `2d62837`) — fecho A4/A5

Só leitura do código via git (18/nov). Nada foi executado: as conclusões vêm da leitura dos ramos, não de teste no app.

## Vereditos

| Arquivo | Veredito | Motivo |
|---|---|---|
| `src/frontend/components/stage/Stagebox.svelte` | **APROVAR** | Com fonte explícita é idêntico; sem fonte só muda quando a saída resolvida é ela mesma um retorno, que fora do modo só retorno praticamente não acontece. |
| `src/frontend/components/slide/Textbox.svelte` | **APROVAR** (1 melhoria não bloqueante) | A guarda é `isStage && caixa 0×0`: o telão (slides normais) não passa por ela; no palco com caixa visível o caminho é o mesmo de antes. |

## Respostas

### (1) Modo desligado + caixas visíveis: é equivalente?

**Textbox — sim, em todos os ramos.**
- Slides normais do telão, prévias, editor: `isStage` é `false`, a condição nova (linha 403) nunca é verdadeira. O único efeito é `hiddenAutosizeRetries = 0`, variável que mais ninguém lê. Idêntico.
- Palco com caixa visível (`clientWidth` e `clientHeight` > 0): a guarda não dispara, segue para o mesmo cache/medição de antes.
- Os dois `return` anteriores (mídia/câmera/ícone; `isStage && !stageAutoSize`) continuam antes da guarda, sem mudança.
- O pré-carregamento do `SlideText` (`.loading`) usa `opacity: 0` + `position: absolute`, não `display: none`: a caixa continua medível, então o crossfade do retorno não cai na guarda.

**Stagebox — sim, com uma exceção de canto.**
A condição nova (linha 390) só difere da antiga quando `item.currentOutput.source` está vazio E a saída resolvida (`stageOutputId`) tem `stageOutput`. Fora do modo só retorno isso só ocorre em dois casos:
- nenhuma saída comum habilitada: `getActiveOutputs` cai em `sortedOutputs[0]`, que pode ser um retorno (`helpers/output.ts:566-569`);
- `settings.output` deixado trocado por uma queda com o modo ligado, até o `iniciarSoRetorno` devolver.
O seletor "saída de origem" do layout (`stage/tools/SlideStyle.svelte:30`) já filtra retornos, então o operador não chega nisso pela interface. Nesses casos antes aparecia o layout aninhado (ou vazio, um nível abaixo); agora aparece o `out` do retorno, normalmente vazio.

Observação: a mudança NÃO consulta o store `soRetorno` (que na janela de saída é sempre `false`); ela decide só pelos dados. Isso é o certo para a janela de saída, e é por isso que o efeito vale também com o modo desligado nos dois casos acima.

### (2) O telão pode ficar sem autosize para sempre?

**Não por causa desta mudança.** O texto do telão não é `isStage`; o caminho dele (inclusive a espera de estabilização de layout da janela de saída) não foi tocado.

Para o **retorno/palco** existe um resto, que não é regressão:
- caixa 0×0 → tenta de novo em 200/400/600/800/1000 ms (cerca de 3 s no total) e desiste;
- depois disso só recalcula se a assinatura mudar (conteúdo, estilo, template) ou o `Textbox` for remontado — o `{#key currentSlide}` do Stagebox remonta a cada troca de slide. Aparecer/redimensionar NÃO dispara: o `ratio` do `Textbox` de palco é o padrão 1 e não há `ResizeObserver`;
- enquanto isso o texto fica no tamanho herdado do item (pode ser grande) até a próxima troca de slide.
Antes era pior no mesmo cenário: media 0×0, crescia até 800 px e gravava isso no cache compartilhado.
Na prática: a janela de retorno real nasce com tamanho (e minimizar não zera `clientWidth`), e a miniatura da aba Retorno é montada por `{#if aberta}` (`AliancaOutrasTelas.svelte:30`), então nasce visível. Sobra só uma instância que fique `display:none` por mais de 3 s e depois apareça sem remontar.

### (3) "Saída atual" com fonte explícita continua igual?

**Sim.** Com `source` preenchido, `outputWindowId = source` e a condição nova se reduz à antiga: retorno como fonte → `StageLayout` aninhado (com a mesma trava `disableStagePreview`); saída comum → `Output mirror`. O rótulo (`showLabel`) não mudou.

## Achados

| # | Gravidade | Onde | Cenário | Correção sugerida |
|---|---|---|---|---|
| 1 | Baixa (não bloqueia) | `Textbox.svelte:403-406` | Caixa de palco escondida por mais de ~3 s e depois exibida sem remontar: fica sem autosize até a próxima troca de slide. O contador também não zera num gatilho novo enquanto a caixa segue 0×0 (só uma tentativa a partir daí). | Trocar as 5 tentativas por um `ResizeObserver` no `itemElem` (dispara `debouncedCalculateAutosize` quando sai de 0×0), ou zerar `hiddenAutosizeRetries` no gatilho de assinatura. |
| 2 | Baixa (não bloqueia) | `Stagebox.svelte:390` | Sem nenhuma saída comum habilitada (só retornos), item "saída atual" sem fonte passa a mostrar o `out` do retorno (vazio) em vez do layout aninhado. | Nenhuma necessária; se quiser equivalência estrita, registrar como decisão. |
| 3 | Informativo | `Stagebox.svelte:202,390` | Modo só retorno ligado + item "saída atual" COM fonte explícita = telão: o item mostra o telão, não "o que o modo mandou". É o comportamento anterior, mas o texto do A4 pede o contrário para esse item. | Decidir se fonte explícita deve ser desviada no modo; hoje não é. |
| 4 | Informativo | `scripts/prova-culto/t10-retorno.mjs` (A5) | A prova mede a miniatura visível (remontada ao abrir); não exercita o caso "escondida > 3 s e reaparece sem remontar" do achado 1. | Se o achado 1 for corrigido, somar um passo com espera > 3 s. |

Não verificado: comportamento com `clickReveal`/`maxLines` escondendo todas as linhas de um item de palco (altura 0 com largura > 0 cairia na guarda); pela leitura não há texto a dimensionar nesse estado, mas não foi testado.
