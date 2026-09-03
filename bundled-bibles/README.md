# Bíblias embutidas no instalador

Todo arquivo `.fsb` desta pasta vai dentro do instalador e é copiado para
`Documentos/AliancaShow/Bibles/` na primeira execução, se ainda não existir lá.
É o que permite enviar um único `.exe` para outro computador e a Bíblia já vir
configurada.

Os `.fsb` **não são versionados** (veja o `.gitignore`): o texto bíblico é
licenciado e não deve entrar no histórico do repositório. Eles precisam estar
presentes nesta pasta no momento de gerar o instalador.

Se a pasta estiver sem nenhum `.fsb`, o build funciona normalmente — o app
apenas não trará Bíblia embutida.
