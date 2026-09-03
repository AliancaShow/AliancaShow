// ----- FreeShow -----
// Svelte app entry point

import "svelte"
import App from "./App.svelte"

// AliancaShow: relato de erros ao Sentry removido. O DSN era do projeto do
// autor. No processo principal ele ja se desativava sozinho em forks (compara
// app.name com "freeshow"), entao so o renderer subia -- e tentava falar com um
// principal que nunca iniciava, gerando os erros sentry-ipc:// no console.

const app = new App({ target: document.body })

export default app
