; AliançaShow: trava de versão do Windows no instalador.
;
; O app é Electron 37 (Chromium 138), que só roda no Windows 10 ou 11. O NSIS,
; porém, roda em qualquer Windows: num Windows 7/8/8.1 o instalador termina
; "com sucesso", cria os atalhos, e o programa simplesmente não abre (ou fecha
; sem mensagem). Aqui o instalador recusa antes de copiar qualquer arquivo e
; diz o motivo. O Windows de 32 bits já é barrado pelo próprio electron-builder
; (check64BitAndSetRegView), porque o pacote só traz x64.
;
; Este arquivo é salvo em UTF-8 com BOM: sem o BOM o NSIS lê os acentos na
; página de código do sistema e a mensagem sai embaralhada.

!macro customInit
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "O AliançaShow precisa do Windows 10 ou 11 (64 bits).$\r$\n$\r$\nEste computador tem uma versão anterior do Windows. Nela o programa até seria instalado, mas não abriria." /SD IDOK
    SetErrorLevel 2
    Quit
  ${EndIf}
!macroend
