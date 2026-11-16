#!/bin/bash
# Restaura o perfil de teste da prova do Culto em $FS_PERFIL_DIR (padrao: ../prova-perfil ao lado do repo) e fecha o Electron de dev desse perfil.
# Nunca toca o AliancaShow instalado nem o %APPDATA%: o perfil inteiro vive em $FS_PERFIL_DIR (store, data, ud, midia).
AQUI="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$AQUI/../.." && pwd)"
PERFIL="${FS_PERFIL_DIR:-$REPO/../prova-perfil}"
mkdir -p "$PERFIL"; PERFIL="$(cd "$PERFIL" && pwd -W 2>/dev/null || pwd)"; PERFIL="${PERFIL//\//}"
for p in $(powershell -c "Get-CimInstance Win32_Process | Where {\$_.Name -eq 'electron.exe' -and \$_.CommandLine -match 'prova-perfil|perfil.ud' -and \$_.CommandLine -notmatch '--type='} | % {\$_.ProcessId}" 2>/dev/null); do taskkill //PID $p //T //F >/dev/null 2>&1; done
sleep 3
rm -rf "$PERFIL/store" "$PERFIL/data" "$PERFIL/midia"
cp -r "$AQUI/perfil/store" "$PERFIL/store"; cp -r "$AQUI/perfil/data" "$PERFIL/data"; cp -r "$AQUI/perfil/midia" "$PERFIL/midia"
for f in "$PERFIL"/store/*.json; do sed -i "s#__PERFIL__#$PERFIL#g" "$f"; done
echo "perfil restaurado em $PERFIL (FS_FUNDO=$PERFIL/midia/f1.png)"
