# Roteiro do teste na igreja — 23/nov (F0 do motor de vídeo)

Tempo: ~30 min, **sem culto**, PC da cabine (RX 580, 3 monitores). Nada aqui mexe nos dados da igreja nem no app instalado.

## Antes de começar
1. Feche o AliançaShow instalado, o ProPresenter e qualquer outro programa pesado (eles distorcem a medição do decodificador).
2. Copie `Documentos\AliancaShow` inteira para um pendrive ou outra pasta (backup, por segurança).
3. No clone de dev (`C:\AliancaShow-dev`): `git fetch` e `git checkout feat/cabine-6`, depois `npm install` (se o npm global for 11 e der erro "--prefer-online cannot be provided", use `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" install`).

## 1. Escala do Windows (2 min)
Configurações › Sistema › Tela: anote a **escala** e a **resolução** de cada monitor (1, 2 = LED, 3 = retorno). Ou rode no PowerShell:
```
Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::AllScreens | % { $_.DeviceName + ' ' + $_.Bounds }
```

## 2. Vídeos de teste (5 min)
```
cd C:\AliancaShow-dev\scripts\poc-video-unico
pwsh -File gerar-midia.ps1
```
(precisa do ffmpeg; se não tiver: `winget install Gyan.FFmpeg`, ou traga a pasta `media\` por pendrive deste PC de dev.)

## 3. POC "vídeo único" (≈10 min)
```
pwsh -File run.ps1 -Runs "a:4k,b2:4k,c:4k,a:1080,b2:1080" -Dur 30 -Warm 8
node summarize.js
pwsh -File run-b3.ps1
node summarize-b3.js
```
- `a` = como o app faz hoje (um vídeo por tela). `b2` = um vídeo só, copiado. `c` = espelho por captura.
- As janelas do POC aparecem e somem sozinhas. Não mexa no mouse durante a medição.
- Guarde a pasta `results\` (pendrive ou commit numa branch `teste/igreja-23nov`).

## 4. O que olhar
- Em `a:4k`: o decodificador satura (≈100%) e perde quadros? (esperado: sim — é o travamento do culto)
- Em `b2:4k`: 0 perdidos e decodificador bem abaixo de 100%? Se sim, o motor vale a pena na RX 580.
- Anote se o PC "engasgou" (mouse travando) em algum momento.

## 5. Opcional: LED
Com o app de dev (perfil de teste, **nunca** os dados reais — ver LEIA-PRIMEIRO), confirmar a saída 896×320 no canto do monitor 2 com cadeado, fechar e reabrir (a fatia 1a já grava).
