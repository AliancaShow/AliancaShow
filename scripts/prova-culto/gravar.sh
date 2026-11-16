#!/bin/bash
# Uma gravacao da prova do Culto numa SESSAO NOVA: restaura o perfil, reabre o Electron de dev e roda o roteiro.
# Cada gravacao parte de um app recem-aberto (o estado de uma sessao anterior vaza para a seguinte: Preparar semeado, editor, gaveta).
#   FS_PERFIL_DIR=<pasta> bash scripts/prova-culto/gravar.sh <rotulo> [--secoes A,B] [--pixel] [--mutar ID] [--saida DIR]
# Pre-requisito: Vite em :3000 (`npm run build:frontend:dev`). O rotulo do leiaute vai no cabecalho (FS_LAYOUT=classico|novo).
AQUI="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$AQUI/../.." && pwd)"
export FS_PERFIL_DIR="${FS_PERFIL_DIR:-$REPO/../prova-perfil}"
bash "$AQUI/restaurar.sh" > /dev/null && bash "$AQUI/reiniciar.sh" > /dev/null || exit 2
PERFIL="$(cygpath -m "$FS_PERFIL_DIR" 2>/dev/null || (cd "$FS_PERFIL_DIR" && pwd))"
export FS_FUNDO="$PERFIL/midia/f1.png"
export FS_PERFIL_STORE="$AQUI/perfil/store"   # o sha do perfil sai do MODELO versionado (nao depende do caminho da maquina)
cd "$REPO" && node "$AQUI/rodar.mjs" --rotulo "$@"
