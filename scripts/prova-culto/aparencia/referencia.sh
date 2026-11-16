#!/bin/bash
# Portao de aparencia do Culto: grava os 13 estados em DOIS apps na mesma sessao (a REFERENCIA e o HEAD = este worktree) e compara.
#   FS_PERFIL_DIR=<pasta> bash scripts/prova-culto/aparencia/referencia.sh <pasta-da-referencia> <pasta-de-saida> [rodadas]
# `rodadas` (padrao 1): quantas gravacoes de cada lado depois do aquecimento (a 0c usa 4 para medir o A/A e a tolerancia de pixel).
# Saidas: <pasta-de-saida>/ref-<i>/ref-<estado>.{json,png}, head-<i>/head-<estado>.*, aq-<lado>/ (aquecimento, descartado), vite-<lado>.log.
# Ao terminar, a :3000 fica LIVRE (suba a sua Vite de novo: o primeiro uso e aquecimento).
# FS_MUTAR_APARENCIA (ex.: desloca-topo) vale so para o lado HEAD.
# Sai com 2 se: a :3000 esta ocupada, a pasta da referencia nao esta preparada, o SHA da ancora nao existe, a Vite nao sobe em 90 s,
# ou um modulo do app nao e importavel por URL. Fora isso, o codigo de saida e o do fva-comparar.mjs (0 igual, 1 reprovou).
#
# Preparo da pasta de referencia (uma vez por maquina, fora do repositorio):
#   git worktree add ../ref-ancora 6d96af4 && (cd ../ref-ancora && npm ci && npm run build:electron:dev)
set -u
AQUI="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$AQUI/../../.." && pwd)"
REF_ARG="${1:-}"
SAIDA_ARG="${2:-}"
RODADAS="${3:-1}"
if [ -z "$REF_ARG" ] || [ -z "$SAIDA_ARG" ]; then echo "uso: referencia.sh <pasta-da-referencia> <pasta-de-saida> [rodadas]" >&2; exit 2; fi
if [ "${FS_LAYOUT+definida}" = "definida" ]; then echo "o leiaute classico nao existe mais: tire FS_LAYOUT do ambiente" >&2; exit 2; fi
if curl -s -m 2 -o /dev/null http://127.0.0.1:3000; then echo "a porta 3000 esta ocupada: pare a Vite antes" >&2; exit 2; fi
if [ ! -d "$REF_ARG/node_modules" ] || [ ! -f "$REF_ARG/build/electron/index.js" ]; then
  echo "a pasta da referencia nao esta preparada (falta node_modules ou build/electron/index.js): git worktree add <pasta> <sha> && (cd <pasta> && npm ci && npm run build:electron:dev)" >&2; exit 2
fi
ANCORA="$(tr -d '\r\n' < "$AQUI/../ancora.txt")"
if ! git -C "$REPO" cat-file -e "${ANCORA}^{commit}" 2>/dev/null; then
  echo "ANCORA: o commit $ANCORA nao existe mais (rebase/squash?). Regrave scripts/prova-culto/ancora.txt com a base real da pilha." >&2; exit 2
fi
REF="$(cd "$REF_ARG" && pwd)"
mkdir -p "$SAIDA_ARG"; SAIDA="$(cd "$SAIDA_ARG" && pwd)"
export FS_PERFIL_DIR="${FS_PERFIL_DIR:-$REPO/../prova-perfil}"
MUT="${FS_MUTAR_APARENCIA:-}"
unset FS_MUTAR_APARENCIA

derrubar_vite() {
  powershell -c 'Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | % { taskkill /PID $_.OwningProcess /T /F }' > /dev/null 2>&1
  for _ in $(seq 1 30); do curl -s -m 1 -o /dev/null http://127.0.0.1:3000 || return 0; sleep 1; done
  return 1
}

estados() { # <lado> <pasta> <saida-do-lado> <prefixo>
  local lado="$1" pasta="$2" dir="$3" pref="$4" mut=""
  [ "$lado" = "head" ] && mut="$MUT"
  mkdir -p "$dir"
  (cd "$REPO" && FS_REPO="$pasta" FS_MUTAR_APARENCIA="$mut" node scripts/prova-culto/aparencia/fva-estados.mjs "$dir" "$pref")
}

for lado in ref head; do
  if [ "$lado" = "ref" ]; then PASTA="$REF"; else PASTA="$REPO"; fi
  echo "=== $lado ($PASTA)"
  (cd "$PASTA" && nohup npm run build:frontend:dev > "$SAIDA/vite-$lado.log" 2>&1 &)
  ok=0
  for _ in $(seq 1 90); do if curl -s -m 2 -o /dev/null http://127.0.0.1:3000; then ok=1; break; fi; sleep 1; done
  if [ "$ok" != "1" ]; then echo "a Vite do lado $lado nao subiu em 90 s (veja $SAIDA/vite-$lado.log)" >&2; derrubar_vite; exit 2; fi
  # aquecimento (descartado; se cair, segue)
  bash "$AQUI/../restaurar.sh" > /dev/null && FS_REPO="$PASTA" bash "$AQUI/../reiniciar.sh" > /dev/null
  echo "-- aquecimento $lado"
  estados "$lado" "$PASTA" "$SAIDA/aq-$lado" "aq-" > "$SAIDA/aq-$lado.log" 2>&1 || echo "(aquecimento caiu: segue)"
  for i in $(seq 1 "$RODADAS"); do
    bash "$AQUI/../restaurar.sh" > /dev/null && FS_REPO="$PASTA" bash "$AQUI/../reiniciar.sh" > /dev/null || { echo "restaurar/reiniciar falhou" >&2; derrubar_vite; exit 2; }
    echo "-- rodada $lado-$i"
    if ! estados "$lado" "$PASTA" "$SAIDA/$lado-$i" "$lado-" > "$SAIDA/$lado-$i.log" 2>&1; then
      echo "a gravacao $lado-$i falhou (veja $SAIDA/$lado-$i.log):" >&2; tail -5 "$SAIDA/$lado-$i.log" >&2
      bash "$AQUI/../restaurar.sh" > /dev/null; derrubar_vite; exit 2
    fi
  done
  bash "$AQUI/../restaurar.sh" > /dev/null
  derrubar_vite || { echo "a :3000 nao liberou" >&2; exit 2; }
done

cd "$REPO" && node scripts/prova-culto/aparencia/fva-comparar.mjs "$SAIDA/ref-1" ref- "$SAIDA/head-1" head-
