#!/bin/bash
# Abre o Electron de dev (Vite ja de pe em :3000) sobre o perfil restaurado, com CDP em 127.0.0.1:9222.
AQUI="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$AQUI/../.." && pwd)"
PERFIL="${FS_PERFIL_DIR:-$REPO/../prova-perfil}"
PERFIL="$(cygpath -m "$PERFIL" 2>/dev/null || (cd "$PERFIL" && pwd))"
cd "$REPO"
(NODE_ENV=development FS_MOCK_STORE_PATH="$PERFIL/store" nohup npx electron . --user-data-dir="$PERFIL/ud" --remote-debugging-port=9222 --remote-allow-origins=http://127.0.0.1:9222 > "$PERFIL/electron.log" 2>&1 &)
sleep 20
curl -s -m 5 http://127.0.0.1:9222/json/version | head -2
