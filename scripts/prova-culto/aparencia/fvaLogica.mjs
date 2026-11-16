// Logica pura do portao de aparencia do Culto (sem CDP, sem disco). Testada em fvaLogica.test.mjs.
// Os 13 estados de fva-estados.mjs gravados em dois apps (referencia e HEAD): nos 11 do Culto, rect, cor e sig exatos sao o portao.

export const ESTADOS_APARENCIA = ["01-culto-parado", "02-culto-no-ar", "03-hover-slide", "04-menu-contexto", "05-gaveta-midia", "06-gaveta-audio", "07-gaveta-biblia", "08-gaveta-shows", "09-config", "10-culto-editor", "11-preparar", "12-preparar-editor", "13-culto-depois-da-volta"]

/** os estados do Culto: todos menos os dois do Preparar (que muda de proposito e nao tem portao) */
export const ESTADOS_CULTO = ESTADOS_APARENCIA.filter((e) => e !== "11-preparar" && e !== "12-preparar-editor")

/** atributos que um item `dom` do esperado.json pode declarar */
export const ATRIBUTOS_DOM = ["data-title", "title", "aria-label"]

/**
 * A mesma normalizacao que a VARREDURA (fva-lib.mjs) aplica ao valor de cada atributo: sem classe de escopo do Svelte, ids gerados
 * viram _X, `var(--x, fallback)` dos tokens de modo vira o fallback, espacos colapsados.
 */
export const normalizarAtributo = (s) =>
    String(s || "")
        .replace(/svelte-[a-z0-9]+/g, "")
        .replace(/(zoom|picker|id)_[0-9a-f]{6,}/g, "$1_X")
        .replace(/var\(--(?:live-opacity|live|sel-wash|sel-line|conteudo-acento|modo-[a-z-]+|prep-rgb|prep|aviso|sobre-acento),\s*([^()]*(?:\([^()]*\)[^()]*)*)\)/g, "$1")
        .replace(/\s+/g, " ")
        .trim()
