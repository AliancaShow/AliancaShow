# Material da semana pelo Sirvo (F5, fatia S3 — lado do Show)

Complementa `INTEGRACAO-SIRVO.md` (que vive na branch `docs/integracao-sirvo`). Desenho completo no repo do Sirvo (desenho F5, §2.3, §2.6, §6 S3).

## O que faz

Qualquer pessoa envia arquivo (vídeo, imagem, áudio) pelo Sirvo; o PC da sala de vídeo baixa sozinho e o coloca no projeto do culto, em "Fora do roteiro". Exige a chave com o interruptor **baixa material** (sem ele o Sirvo responde 42501 e o Show pergunta de novo em 5 min, sem barulho).

## Contrato com o Sirvo (migration 0091)

- `show_material_pendente(p_chave)` → lista (até 200): `id, event_id, dia, nome, ext, tipo, tamanho, etag, codec, bloco_id, baixa_status`. O que falhou continua listado: o Show tem o próprio recuo por id (1, 5, 15, 60 min; zera ao reabrir).
- `show_material_url(p_chave, p_id)` → `{ok:true, url, expira_em, ...}` ou `{ok:false, codigo:'url_indisponivel', tentar_em_s}` (não é erro). Erros: `P0002` descarta o item (1 h), `55000` pula até o próximo ciclo, `54000` (120/h) suspende pedidos de URL por 10 min.
- `show_material_status(p_chave, p_id, p_status, p_detalhe, p_codec)` com `baixado | no_projeto | usado | falhou`. `54000` (60/min) fica na fila.
- `show_roteiro.material[]` = `{id, nome, bloco_id, status}`; `apagando` = janela de 30 s de desfazer; sumir da lista = apagado.

O código do Postgres desses erros chega em `pg` na resposta de `sirvoChamar*` (`src/electron/sirvo/sirvo.ts`).

## Onde está cada coisa

| Arquivo | Papel |
|---|---|
| `src/electron/sirvo/materialLogica.ts` | contas puras: validação da linha, nome no disco, destino, URL do R2, ETag, espaço, estado que vai ao renderer |
| `src/electron/sirvo/material.ts` | fila de download no processo principal |
| `src/electron/sirvo/sirvo.ts` | `show_material_pendente/status` em `FUNCOES`; `show_material_url` só via `sirvoChamarDoMain`; código `nao_baixa`; `r2Host` por ambiente |
| `src/frontend/utils/aliancaSirvoMaterial.ts` | renderer: sincroniza (60 s), memória, avisos `no_projeto`/`usado` |
| `src/frontend/utils/aliancaSirvoMaterialConta.ts` | a conta do projeto (entra no fim, cinza 30 s, sai), sem store |
| `aliancaSirvoMontar.ts` | chama a conta dentro de `atualizarLigado` |
| `aliancaRemote.ts` | o Remote poupa itens `sirvoMaterial` |
| `SirvoIndicador.svelte` | "baixando 2 de 5" e "N arquivos falharam" |

## Regras que não podem quebrar

1. **A URL assinada nunca sai do main.** É pedida por `sirvoChamarDoMain` (fora de `FUNCOES`, o renderer não consegue chamar), usada e esquecida; `estadoParaRenderer` só deixa passar chaves conhecidas; `detalhe` de falha é código curto.
2. **Download:** 2 em paralelo, 10 min no total e 60 s sem byte, `redirect: "error"`, `Content-Length` = tamanho, ETag igual (e MD5 conferido quando o ETag é MD5), espaço livre ≥ tamanho + 500 MB, `.part` e só então renomeia. 3 tentativas (5/30/120 s).
3. **Host e caminho:** `<conta>.r2.cloudflarestorage.com` (32 hex; fixe a conta em `AMBIENTES[..].r2Host` quando existir) e `/<balde>/igrejas/<uuid>/eventos/<event_id>/<id>.<ext>` com `event_id`, `id` e `ext` iguais aos pedidos. Balde `sirvo-material` (produção) ou `sirvo-material-staging` (Show em desenvolvimento).
4. **Disco:** `Online/Sirvo/<dia>/<nome-limpo-40>__<id8>.<ext>`, extensão da lista fechada (mp4 mov m4v webm jpg jpeg png webp gif mp3 m4a wav). O Show **nunca apaga** arquivo por causa do Sirvo.
5. **Projeto (S5):** item `{id: caminho, type, name, data: {sirvoMaterial: id, sirvoBloco}}`. Vai para DENTRO do bloco que o Sirvo escolheu (`show_roteiro.material[].bloco_id`), logo depois das músicas e do material anterior do bloco; sem bloco, ou bloco que não está no projeto, vai para o fim ("Fora do roteiro"). `sirvoBloco` guarda para onde o Show o levou: religar a outro bloco no Sirvo move o item (o mesmo objeto, os ponteiros acompanham); o que o operador arrastou fica onde ele pôs. A trava do momento protegido é a das músicas (`ordemMudaAteOPonteiro`, em `aliancaSirvoProjeto.ts`): mudança que alcança um ponteiro vivo fica pendente até o "Aplicar". Só toca no que tem a marca. Item que o operador tirou à mão não volta. Apagado no Sirvo: fica cinza por 30 s e sai; nunca sai se estiver aberto/no foco/na saída. HEVC leva "(HEVC — pode não tocar)".
6. Passada de material só roda quando nada mais muda a lista (ordem dos blocos sem pendência) e nunca durante um arrasto.

## Teste

`npx vitest run --config config/testing/vitest.config.ts src/electron/sirvo src/frontend/utils`. Em campo: CDP contra o staging (`npm start` fala com o staging do Sirvo): celular envia, arquivo no disco em até ~70 s, apagar no Sirvo deixa o item cinza e depois o tira sem apagar o arquivo, URL vencida vira `falhou`.
