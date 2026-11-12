# Material do culto pelo Sirvo (F5 v5 — biblioteca da igreja, lado do Show)

Complementa `INTEGRACAO-SIRVO.md` (que vive na branch `docs/integracao-sirvo`). Desenho completo no repo do Sirvo (`desenho-f5-material-v5`, §4.3 e §5); este arquivo é o contrato que o Show cumpre. Migration do Sirvo: **0092**.

## O que faz

O arquivo é **da igreja** (biblioteca); o culto só **usa**. Qualquer membro envia, usa da biblioteca ou substitui; o PC da sala de vídeo baixa sozinho e põe o item no projeto do culto, dentro do bloco escolhido (ou em "Fora do roteiro"). Exige a chave com o interruptor **baixa material** (sem ele o Sirvo responde 42501 e o Show pergunta de novo em 5 min, sem barulho).

Vocabulário: **arquivo** (`arquivo_id`) = a coisa da biblioteca; **versão** (`id` da pendente, `versao_id` do roteiro) = um objeto no R2; **uso** (`id` em `material[]`) = o arquivo neste culto. Não existe versão fixada por culto passado: `material[]` sempre entrega a versão **atual**.

## Contrato com o Sirvo (0092)

- `show_material_pendente(p_chave)` → até 200 linhas `{id (versão), arquivo_id, nome, ext, tipo, tamanho, etag, codec, baixa_status}`: **toda** versão atual de arquivo vivo com uso em culto da janela, baixada ou não. Sem `event_id`/`dia`/`bloco_id`.
- `show_material_url(p_chave, p_id)` (`p_id` = versão) → `{ok:true, url, expira_em}` ou `{ok:false, codigo:'url_indisponivel', tentar_em_s}`. Erros: `P0002` descarta (1 h), `55000` pula até o próximo ciclo, `54000` (120/h) suspende pedidos de URL por 10 min. A URL é `…/<balde>/igrejas/<igreja>/arquivos/<arquivo_id>/<versao>.<ext>`.
- `show_material_status(p_chave, p_id, p_status, p_detalhe, p_codec, p_uso)` com `baixado | no_projeto | usado | falhou`. **`p_uso` é obrigatório em `no_projeto`/`usado`** (uso vivo do mesmo arquivo; 22023 sem ele). `no_projeto` da versão atual mata as versões superadas no servidor.
- `show_material_retencao(p_chave)` → `{arquivos:[{id, morto_em}], versoes:[{id, morto_em}]}` (só mortos; 10/h).
- `show_roteiro.material[]` = `{id (uso), arquivo_id, versao_id, nome, ext, tipo, bloco_id, status}`; `status` `apagando` = janela de 30 s de desfazer; sumir da lista = tirado do culto.

O código do Postgres desses erros chega em `pg` na resposta de `sirvoChamar*`.

## Onde está cada coisa

| Arquivo | Papel |
|---|---|
| `src/electron/sirvo/materialLogica.ts` | contas puras: validação da linha, nome/pasta no disco, URL do R2, ETag, estado para o renderer, `candidatosALimpar`, `caminhosReferenciados` |
| `src/electron/sirvo/material.ts` | fila de download no main; registros por versão (`sirvo_material_v2`), disco |
| `src/electron/sirvo/limpeza.ts` | Lixeira: sonda, retenção do servidor, referências, `shell.trashItem` arquivo a arquivo |
| `src/electron/sirvo/sirvo.ts` | `show_material_pendente/status/retencao` em `FUNCOES`; `show_material_url` só via `sirvoChamarDoMain` |
| `src/frontend/utils/aliancaSirvoMaterial.ts` | renderer: sincroniza (60 s), memória por arquivo, relatos, gatilho da limpeza |
| `src/frontend/utils/aliancaSirvoMaterialConta.ts` | a conta do projeto (entra, troca no lugar, cinza 30 s, sai), sem store |
| `aliancaSirvoMontar.ts` | chama a conta dentro de `atualizarLigado`; faixa "Aplicar" |
| `SirvoIndicador.svelte` | "baixando 2 de 5", falhas, disco e limpeza na dica |

## Regras que não podem quebrar

1. **A URL assinada nunca sai do main.** Pedida por `sirvoChamarDoMain`, usada e esquecida; `estadoParaRenderer` só deixa passar chaves conhecidas.
2. **Download:** 2 em paralelo, 10 min no total e 60 s sem byte, `redirect: "error"`, `Content-Length` = tamanho, ETag igual (MD5 conferido quando o ETag é MD5), espaço livre ≥ tamanho + 500 MB, `.part` e só então renomeia.
3. **Disco:** `Online/Sirvo/<nome40>__<arquivo8>/<nome40>__<versao8>.<ext>`. A pasta de um arquivo é **a que já existe com o sufixo `__<arquivo8>`**. O registro (`sirvo_material_v2`) **não é podado por idade**; só sai o que não está mais no disco. `baixado` só é relatado quando `baixa_status !== 'baixado'`.
4. **Item do projeto** `{id: caminho, type, name, data: {sirvoMaterial: arquivo_id, sirvoVersao: versao_id, sirvoBloco, sirvoMaterialEvento}}`. Chaveado por **arquivo**: um uso novo do mesmo arquivo não muda o item. Memória (`special.aliancaSirvoMaterial`) com chave `<event_id>:<arquivo_id>` e `np`/`us` = **id da versão**.
5. **Troca de versão** (a versão do uso ≠ `sirvoVersao` do item e a nova está no disco): nunca em uso (item aberto/foco, saída, **chaves de `playingAudio`**, pausado conta; `playingAudioPaths` não serve). No momento protegido (no ar ou algo na tela) a troca vira pendência na faixa "Aplicar" ("versão nova de X"); com "Aplicar" troca, mas ainda nunca em uso. Fora do momento protegido troca sozinha, no lugar (mesmo índice e mesma lista). Se o caminho novo já é item do operador no projeto, não troca e avisa. `media[novo]` só é criada se não existe, copiando de `media[antigo]` apenas `fit, fitOptions, volume, loop, videoType, audioType, speed, filter, flipped, flippedY`. Depois da troca: `no_projeto(versão nova, p_uso)`.
6. **Limpeza (PC):** o servidor declara arquivo/versão morto; **30 dias depois** (`morto_em + 30 d`) o Show manda o arquivo para a **Lixeira** (nunca `unlink`), um arquivo por vez, só dentro de `Online/Sirvo`, e só se nada o referencia (SYNCED_SETTINGS, THEMES, STAGE, OVERLAYS, TEMPLATES, cada `.show`, itens **não marcados** dos projetos, e as referências vivas que o renderer manda). Quem dispara é o **renderer**, ≥ 24 h entre rodadas, só com saída vazia, `playingAudio` vazio e fora do `roteiroNoAr`. Exige a chave com `baixa_material`, a **Lixeira testada para este caminho** (Configurações → Sirvo → "Testar a Lixeira"; sonda por `shell.trashItem`, não `fsutil`) e resposta de `show_material_retencao` na hora; sem qualquer um, adia e o indicador diz por quê. Prefixo ambíguo, pasta sem sufixo, id desconhecido: deixa.
7. Passada de material só roda quando nada mais muda a lista e nunca durante um arrasto.

## Teste

`npx vitest run --config config/testing/vitest.config.ts src/electron/sirvo src/frontend/utils`. Em campo (CDP contra o staging): culto no ar, substituir no Sirvo → faixa "versão nova", item inalterado; Aplicar → troca, `no_projeto` chega e a v1 some do bucket (fica no disco 30 dias); áudio tocando segura a troca; **arquivo de 1 GB → `trashItem`** (conferir que rejeita em vez de apagar de vez, e o que faz com item maior que a cota da Lixeira); testar a Lixeira antes de ligar.
