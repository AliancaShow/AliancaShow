# Músicas embutidas no instalador

Todo `.show` desta pasta vai dentro do instalador e é copiado para
`Documentos/AliancaShow/Shows/` na primeira execução, se ainda não existir lá.
É o que permite enviar um único `.exe` para outro computador e a biblioteca já
vir montada.

Os `.show` **não são versionados** (veja o `.gitignore`) — são conteúdo, não
código. Precisam estar presentes aqui no momento de gerar o instalador.

Se a pasta estiver vazia, o build funciona normalmente e o app apenas não traz
músicas embutidas.
