// Gravador (injetado pelo rodar.mjs em cada janela; roda depois do PRE: tem S, get, esp). So existe em dev, nunca vai para o build.
// Grava o que o app FAZ: cada escrita em `outputs` (inclusive a que nao muda nada), os canais de IPC tocados e, na saida, o que CHEGOU.
// hash do html atual da saida (para esperar o telao parar: transicoes entre slides deixam as duas camadas no DOM)
// animacoes/transicoes ainda correndo na saida (CSS, WAAPI e transicoes do Svelte): o telao so e lido com zero
window.__provaAnimando = () => document.getAnimations().length
window.__provaHash = async () => {
    const html = document.body.innerHTML.replace(/svelte-[a-z0-9]+/g, "").replace(/(zoom|picker|id)_[0-9a-f]{6,}/g, "$1_X")
    const h = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(html))))
    return h.map((b) => b.toString(16).padStart(2, "0")).join("")
}
if (!window.__provaCulto) {
    const rec = (window.__provaCulto = { janela: __JANELA__, out: [], ipc: {}, est: [], ultimo: Date.now() })
    const tocar = () => (rec.ultimo = Date.now())
    const copia = (v) => {
        try {
            return JSON.parse(JSON.stringify(v ?? null))
        } catch {
            return "<nao serializavel>"
        }
    }
    // rotulo de quem chamou: os 3 primeiros quadros fora de stores/gravador, como funcao@arquivo (sem linha e sem ?t= do Vite)
    const rotulo = () => {
        const r = []
        for (const l of String(new Error().stack || "")
            .split("\n")
            .slice(1)) {
            if (/stores\.ts|gravador|__provaCulto|<anonymous>/.test(l)) continue
            const m = /at (?:async )?([^ (]+) \(.*?([^/\?]+?)\.(?:ts|svelte|js)(?:\?[^:)]*)?:\d+:\d+\)/.exec(l)
            if (m) r.push(m[1] + "@" + m[2])
            if (r.length >= 3) break
        }
        return r.join(" < ")
    }
    // so o `out` de cada saida (o resto de `outputs` e configuracao e nao e o que o telao mostra)
    const so = (v) => Object.fromEntries(Object.entries(v || {}).map(([k, x]) => [k, copia(x?.out)]))

    const o = S.outputs
    const set0 = o.set.bind(o)
    const up0 = o.update.bind(o)
    o.set = (v) => {
        const antes = JSON.stringify(so(get(o)))
        if (window.__mutPular?.()) return tocar()
        const r = set0(v)
        rec.out.push({ op: "set", por: rotulo(), mudou: antes !== JSON.stringify(so(get(o))), v: so(get(o)) })
        tocar()
        return r
    }
    o.update = (fn) => {
        const antes = JSON.stringify(so(get(o)))
        if (window.__mutPular?.()) return tocar()
        const r = up0(fn)
        rec.out.push({ op: "update", por: rotulo(), mudou: antes !== JSON.stringify(so(get(o))), v: so(get(o)) })
        tocar()
        return r
    }

    // IPC que SAI desta janela (gancho DEV em utils/request.ts e IPC/main.ts). Guarda o conjunto de canais e o ultimo payload (copiado na hora).
    globalThis.__gravarIPC = (id, canal, dados) => {
        if (window.__mutIpc?.(id, canal)) return
        rec.ipc[id + ":" + canal] = copia(dados)
        tocar()
    }

    // sinais de estado (sequencia ordenada das mudancas; deterministicas)
    const seguir = (nome, store, f = (x) => x) => {
        let primeiro = true
        store.subscribe((v) => {
            if (primeiro) return void (primeiro = false)
            rec.est.push({ fluxo: nome, v: copia(f(v)) })
            tocar()
        })
    }
    if (rec.janela === "principal") {
        seguir("activePage", S.activePage)
        seguir("activeShow", S.activeShow, (v) => v && { id: v.id, type: v.type })
        seguir("activeEdit", S.activeEdit, (v) => v && { slide: v.slide, showId: v.showId, n: (v.items || []).length })
        seguir("outLocked", S.outLocked)
        seguir("playingAudio", S.playingAudio, (v) => Object.keys(v || {}).sort())
        seguir("activeTimers", S.activeTimers, (v) => (v || []).map((t) => t.id).sort())
        seguir("slideTimers", S.slideTimers, (v) => Object.keys(v || {}).sort())
        seguir("overlayTimers", S.overlayTimers, (v) => Object.keys(v || {}).sort())
    }
    window.__provaSinais = () => {
        const base = (s) => (s && s.culto ? s.culto : s)
        const m = get(S.modoAlianca)
        return {
            modo: m,
            drawer: copia(get(S.drawer)),
            resized: copia(get(S.resized)),
            abaAtiva: get(S.activeDrawerTab),
            midia: copia({ sub: get(S.drawerTabsData).media?.activeSubTab, filtro: get(S.drawerTabsData).media?.aliancaFiltro }),
            culto: { drawer: copia(get(base(S.drawer))), resized: copia(get(base(S.resized))), abaAtiva: get(base(S.activeDrawerTab)) }
        }
    }
    const descr = (e) => (e ? e.tagName + (e.id ? "#" + e.id : "") + (e.className && typeof e.className === "string" ? "." + e.className.split(" ").filter(Boolean).slice(0, 2).join(".") : "") : null)
    // fecha o passo: devolve o que aconteceu e zera
    window.__provaFim = async () => {
        const s = { outputs: rec.out.splice(0), canais: { ...rec.ipc }, estado: rec.est.splice(0), foco: descr(document.activeElement) }
        rec.ipc = {}
        if (rec.janela === "saida") {
            // o que CHEGOU ao telao: o html normalizado (sem classes svelte nem ids gerados), em hash
            const html = document.body.innerHTML.replace(/svelte-[a-z0-9]+/g, "").replace(/(zoom|picker|id)_[0-9a-f]{6,}/g, "$1_X")
            const dados = new TextEncoder().encode(html)
            const h = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", dados)))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("")
            s.saida = { texto: document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 400), hash: h, elementos: document.body.querySelectorAll("*").length }
        } else {
            s.sinais = window.__provaSinais()
        }
        return s
    }
    window.__provaParado = (ms) => Date.now() - rec.ultimo >= ms
}
return "gravador pronto: " + window.__provaCulto.janela
