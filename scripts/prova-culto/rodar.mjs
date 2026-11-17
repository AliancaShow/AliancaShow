// Roda o roteiro de gestos contra o Show de dev (CDP, porta 9222) e grava `gravacao-<rotulo>.json`.
//
//   node scripts/prova-culto/rodar.mjs --rotulo base1 [--saida DIR] [--secoes A,B,E] [--pixel] [--mutar ID] [--esperado ARQ] [--roteiro culto|preparar]
//
// O esperado.json (ou o de --esperado) e lido antes do laco: os itens `efeitoMinimo` sao APLICADOS ao roteiro (aplicarEfeitoMinimo) e o
// cabecalho grava `esperadoAplicado: [ids]`. Cada passo grava, no nivel do passo (fora de principal/saida, fora do achatar):
// antesDoGesto { hash, foco, sinais, pagina }, depois { pagina } e efeitoMedido { fluxo, n }.
//
// Pre-requisitos: Vite em :3000 e o Electron de dev com --remote-debugging-port=9222 sobre o perfil de teste restaurado
// (`restaurar.sh` + `reiniciar.sh`).
//
// Regras que impedem "passar calado" (revisao C1): alvo inexistente, coberto por outro elemento ou efeito abaixo do minimo REPROVAM
// a execucao (exit 1), mesmo gravando o arquivo. Mutacoes em runtime (so por CDP, nada no codigo): --mutar
//   extra-escrita       um outputs.update no-op logo depois do clique A01
//   sem-limpar-fundo    outputs.update some durante B02 (o app "esquece" de limpar o fundo)
//   ipc-sem-canal       o gancho de IPC ignora o canal OUT_SLIDE_CACHE (nenhum passo do roteiro emite TRANSITION; este e emitido em 18)
//   saida-estilo        so a janela de saida muda de aparencia (escritas iguais, pixel diferente)
//   cobrir:<passo>      um elemento transparente cobre o alvo do passo (tem de reprovar pela regra C1)
//   --css ARQUIVO       injeta o CSS na janela principal antes do roteiro (T7, prototipo descartavel)
//   digito-troca        antes de A11 injeta um keydown em captura que, para a tecla 2, faz S.activePage.set("edit") (o comportamento que a 1b tirou): o juiz de passo morto reprova A11
//   escreve-no-preparar (so --roteiro preparar) um outputs.update depois do 1o passo de H: o invariantes.mjs tem de reprovar
//   canal-no-preparar   (so --roteiro preparar) um send(OUTPUT, [COLORBARS]) depois do 1o passo de H: o invariantes.mjs tem de reprovar
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { abrir, clicarEm, esperar, localizar, tecla, RAIZ } from "./lib.mjs"
import { FUNCOES_PREPARO, SECOES as SECOES_CULTO, VERSAO as VERSAO_CULTO } from "./roteiro.mjs"
import { SECOES_PREPARAR, VERSAO_PREPARAR } from "./roteiro-preparar.mjs"
import { aplicarEfeitoMinimo, normalizarPerfil, validarEsperado } from "./compararLogica.mjs"
if (process.env.FS_LAYOUT !== undefined) { console.error("o leiaute classico nao existe mais: tire FS_LAYOUT do ambiente"); process.exit(2) }

const arg = (n, d = null) => {
    const i = process.argv.indexOf("--" + n)
    return i < 0 ? d : ((process.argv[i + 1]?.startsWith("--") ? true : process.argv[i + 1]) ?? true)
}
const ROTULO = arg("rotulo", "tmp")
const SAIDA = arg("saida", join(RAIZ, "scripts/prova-culto/gravacoes"))
const SO = arg("secoes") ? String(arg("secoes")).split(",") : null
const MUTAR = arg("mutar")
const PIXEL = !!arg("pixel")
// --roteiro preparar: a secao H (o Preparar nao vai ao ar), julgada por invariantes.mjs. Sem a flag: o roteiro A a F do Culto
const ROTEIRO = arg("roteiro", "culto")
if (ROTEIRO !== "culto" && ROTEIRO !== "preparar") {
    console.error('--roteiro: "culto" ou "preparar"')
    process.exit(2)
}
const SECOES = ROTEIRO === "preparar" ? SECOES_PREPARAR : SECOES_CULTO
const VERSAO = ROTEIRO === "preparar" ? VERSAO_PREPARAR : VERSAO_CULTO
const ARQ_ESPERADO = arg("esperado") && arg("esperado") !== true ? String(arg("esperado")) : join(RAIZ, "scripts/prova-culto/esperado.json")
const ESPERADO = JSON.parse(readFileSync(ARQ_ESPERADO, "utf8"))
const errosEsperado = validarEsperado(ESPERADO)
const aplicacao = aplicarEfeitoMinimo(SECOES, ROTEIRO === "preparar" ? [] : ESPERADO)
if (errosEsperado.length || aplicacao.erros.length) {
    console.error("ESPERADO INVALIDO para esta gravacao:\n  - " + [...errosEsperado, ...aplicacao.erros].join("\n  - "))
    process.exit(1)
}
const SECOES_RODAR = aplicacao.secoes
const PASSO_ORIGINAL = Object.fromEntries(SECOES.flatMap((s) => s.passos).map((p) => [p.id, p]))
// o mesmo calculo do efeito minimo (C1), usado tambem para gravar o que foi medido no fluxo declarado no roteiro ORIGINAL
const medirEfeito = (fluxo, r, hashAntes) => (fluxo === "outputs" ? r.p.outputs.filter((x) => x.mudou).length : fluxo === "estado" ? r.p.estado.length : fluxo === "saida" ? (r.s.saida?.hash !== hashAntes ? 1 : 0) : fluxo === "ipc" ? Object.keys(r.p.canais).filter((k) => !ehPeriodico(k)).length : 0)
const CSS = arg("css") // T7: CSS injetado na janela principal (prototipo descartavel, nunca vai ao app)
const FUNDO = process.env.FS_FUNDO || join(RAIZ, "scripts/prova-culto/perfil/midia/f1.png").split(String.fromCharCode(92)).join("/")
// raiz do perfil desta maquina: sai da gravacao como __PERFIL__ (o baseline vale em qualquer pasta, inclusive na maquina do Pedro)
const RAIZ_PERFIL = process.env.FS_PERFIL_RAIZ || FUNDO.split("/").slice(0, -2).join("/")
const PERIODICOS = ["ACTIVE_TIMERS", "PLAYING_VIDEO_STATE", "METRONOME_TIMER", "AUDIO_DATA", "SPOTIFY_GET_STATE"]
const ehPeriodico = (k) => PERIODICOS.some((p) => k.endsWith(":" + p))

mkdirSync(SAIDA, { recursive: true })
const gravadorTxt = readFileSync(join(RAIZ, "scripts/prova-culto/gravador.js"), "utf8")

const dbg = (m) => process.env.FS_DEBUG && console.log("[dbg]", m)
const principal = await abrir("principal")
dbg("principal ok")
const saida = await abrir("saida")
dbg("saida ok")
// a janela de saida fica escondida: o Chromium a estrangula (animacoes e timers param, o print trava). Emular foco a mantem ativa
// SEM trazer ela para a frente (as teclas reais continuam indo para a principal).
await saida.enviar("Emulation.setFocusEmulationEnabled", { enabled: true })
await saida.enviar("Page.enable", {})
await saida.enviar("Page.setWebLifecycleState", { state: "active" })
dbg("emulacao ok")
await principal.ev(gravadorTxt.replace("__JANELA__", '"principal"').replace("__RAIZ__", JSON.stringify(RAIZ_PERFIL)))
dbg("gravador principal ok")
await saida.ev(gravadorTxt.replace("__JANELA__", '"saida"').replace("__RAIZ__", JSON.stringify(RAIZ_PERFIL)))
const PREPARO = FUNCOES_PREPARO.replace("S_FUNDO", JSON.stringify(FUNDO))

// repouso: 250 ms sem nenhum evento nos dois fluxos (e no minimo 300 ms)
async function quieto(max = 6000) {
    const t0 = Date.now()
    await esperar(300)
    while (Date.now() - t0 < max) {
        const [a, b] = await Promise.all([principal.avaliar("return window.__provaParado(250)"), saida.avaliar("return window.__provaParado(250)")])
        if (a && b) return true
        await esperar(80)
    }
    return false
}
// o telao so e lido quando o html para de mudar E nao ha animacao correndo (2 leituras iguais com 400 ms entre elas; no maximo 8 s)
async function saidaEstavel() {
    const t0 = Date.now()
    let h = await saida.avaliar("return await window.__provaHash()")
    while (Date.now() - t0 < 8000) {
        await esperar(400)
        const h2 = await saida.avaliar("return await window.__provaHash()")
        const anim = await saida.avaliar("return window.__provaAnimando()")
        if (h2 === h && anim === 0) return true
        h = h2
    }
    return false
}
// o print da saida exige a janela na frente (CDP entrega as teclas direto na pagina, entao trazer a saida nao desvia os gestos)
async function fotoSaida(arquivo) {
    for (let t = 0; t < 6; t++) {
        await saida.enviar("Page.bringToFront", {})
        await esperar(500)
        const r = await Promise.race([saida.enviar("Page.captureScreenshot", { format: "png" }), new Promise((res) => setTimeout(() => res(null), 5000))])
        if (r?.result?.data) return writeFileSync(arquivo, Buffer.from(r.result.data, "base64"))
    }
    throw new Error("sem print da saida")
}
const fim = async () => (await saidaEstavel(), await fimLeitura())
const fimLeitura = async () => ({ p: await principal.avaliar("return await window.__provaFim()"), s: await saida.avaliar("return await window.__provaFim()") })

const violacoes = []
const passos = []
let hashAnterior = null

const dims = await principal.ev("return {w:innerWidth,h:innerHeight,dpr:devicePixelRatio}")
// CRLF -> LF: o checkout no Windows (autocrlf) troca o fim de linha do modelo e nao pode mudar o sha do perfil
const perfilSha = createHash("sha256")
    .update(process.env.FS_PERFIL_STORE ? ["projects.json", "shows.json"].map((f) => (existsSync(join(process.env.FS_PERFIL_STORE, f)) ? readFileSync(join(process.env.FS_PERFIL_STORE, f), "utf8").replace(/\r\n/g, "\n") : "")).join("|") : "sem-perfil")
    .digest("hex")
    .slice(0, 16)
let commit = "?"
try {
    commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: RAIZ, encoding: "utf8" }).trim()
} catch {}

if (CSS) {
    const texto = readFileSync(String(CSS), "utf8")
    await principal.ev(`const s=document.createElement("style"); s.id="__css_prova"; s.textContent=${JSON.stringify(texto)}; document.head.appendChild(s); await esp(500); return 1`)
    dbg("css injetado")
}
if (MUTAR === "saida-estilo") await saida.ev("document.body.style.filter='invert(1)'; return 1")
if (MUTAR === "ipc-sem-canal") await principal.ev("window.__mutIpc=(id,canal)=>canal==='OUT_SLIDE_CACHE'; return 1")

for (const secao of SECOES_RODAR) {
    if (SO && !SO.includes(secao.id)) continue
    // cada secao parte de um estado restaurado (divergencia numa nao contamina a seguinte)
    dbg("secao " + secao.id)
    await principal.ev(PREPARO + secao.preparar)
    dbg("preparo ok")
    await quieto()
    dbg("quieto ok")
    await fim()
    hashAnterior = (await saida.avaliar("return await window.__provaFim()")).saida?.hash ?? null
    for (const passo of secao.passos) {
        const falhas = []
        if (passo.antes) {
            await principal.ev(PREPARO + passo.antes)
            await quieto()
            const f0 = await fim()
            hashAnterior = f0.s.saida?.hash ?? hashAnterior
        }
        const telaoAntes = (await saida.avaliar("return await window.__provaLeitura()")).telao
        const hashAntesDoGesto = telaoAntes?.hash ?? hashAnterior
        const leituraAntes = await principal.avaliar("return window.__provaLeitura()")
        if (MUTAR === "sem-limpar-fundo" && passo.id === "B02-limpar-fundo") await principal.ev("window.__mutPular=()=>true; return 1")
        let coord = null
        if (passo.alvo) {
            if (MUTAR === `cobrir:${passo.id}`) {
                await principal.ev(`const e=(${passo.alvo}); const r=e.getBoundingClientRect(); const d=document.createElement("div"); d.id="__cobertura"; d.style.cssText="position:fixed;left:"+r.x+"px;top:"+r.y+"px;width:"+r.width+"px;height:"+r.height+"px;z-index:99999;background:transparent"; document.body.appendChild(d); return 1`)
            }
            const l = await localizar(principal, passo.alvo)
            if (!l.ok) falhas.push(`alvo: ${l.motivo}`)
            else coord = l
        }
        const g = passo.gesto
        if (g.clique && coord) await clicarEm(principal, coord.x, coord.y)
        else if (g.clique && !coord) falhas.push("clique sem alvo valido")
        else if (g.tecla) {
            if (MUTAR === "digito-troca" && passo.id === "A11-digito-2") await principal.ev('window.addEventListener("keydown", (e) => { if (e.key === "2") S.activePage.set("edit") }, true); return 1')
            await tecla(principal, g.tecla, g.mods || {})
        } else if (g.sequencia) {
            // varios gestos reais em ordem: tecla (Input.dispatchKeyEvent) ou texto (Input.insertText)
            for (const s of g.sequencia) {
                if (s.tecla) await tecla(principal, s.tecla, s.mods || {})
                else if (typeof s.texto === "string") await principal.enviar("Input.insertText", { text: s.texto })
                await esperar(s.espera ?? 350)
            }
        } else if (g.espera) await esperar(g.espera)
        if (MUTAR === "extra-escrita" && passo.id === "A01-clique-slide-1") await principal.ev("S.outputs.update(a=>a); return 1")
        await quieto()
        if (MUTAR === `cobrir:${passo.id}`) await principal.ev(`document.getElementById("__cobertura")?.remove(); return 1`)
        if (MUTAR === "sem-limpar-fundo" && passo.id === "B02-limpar-fundo") await principal.ev("window.__mutPular=null; return 1")
        const r = await fim()
        // efeito minimo (C1)
        const e = passo.efeito
        if (!e && !passo.semEfeito) falhas.push("passo sem efeito declarado e sem semEfeito")
        if (e && e.n > 0) {
            const medido = medirEfeito(e.fluxo, r, hashAnterior)
            if (medido < e.n) falhas.push(`efeito abaixo do minimo: ${e.fluxo} ${medido} < ${e.n}`)
        }
        const original = PASSO_ORIGINAL[passo.id]?.efeito
        const efeitoMedido = original?.fluxo ? { fluxo: original.fluxo, n: medirEfeito(original.fluxo, r, hashAnterior) } : null
        const leituraDepois = await principal.avaliar("return window.__provaLeitura()")
        hashAnterior = r.s.saida?.hash ?? hashAnterior
        if (PIXEL) await fotoSaida(join(SAIDA, `${ROTULO}-${passo.id}.png`))
        falhas.forEach((f) => violacoes.push(`${passo.id}: ${f}`))
        if (ROTEIRO === "preparar" && passo.id === "H01-vai-preparar") {
            // mutacoes da secao H (tem de dar vermelho no invariantes.mjs): o efeito aparece no passo SEGUINTE
            if (MUTAR === "escreve-no-preparar") await principal.ev("S.outputs.update(a => { a.default.out.slide = null; return a }); return 1")
            if (MUTAR === "canal-no-preparar") await principal.ev('const R = await import(U("utils/request")); R.send("OUTPUT", ["COLORBARS"], get(S.colorbars)); return 1')
        }
        passos.push({ id: passo.id, secao: secao.id, ...(passo.paginaFinal !== undefined ? { paginaFinal: passo.paginaFinal } : {}), semEfeito: passo.semEfeito ?? null, ...(passo.efeitoAplicado ? { efeitoAplicado: passo.efeitoAplicado } : {}), antesDoGesto: { hash: hashAntesDoGesto, telao: telaoAntes ? { texto: telaoAntes.texto, elementos: telaoAntes.elementos } : null, foco: leituraAntes.foco, sinais: leituraAntes.sinais, pagina: leituraAntes.pagina }, depois: { pagina: leituraDepois.pagina }, efeitoMedido, principal: r.p, saida: r.s })
        console.log(`${falhas.length ? "FALHA" : "ok   "} ${passo.id}  outputs=${r.p.outputs.length} estado=${r.p.estado.length} canais=${Object.keys(r.p.canais).length}${falhas.length ? "  <- " + falhas.join("; ") : ""}`)
    }
}

const gravacao = { cabecalho: { ...(ROTEIRO === "preparar" ? { roteiro: "preparar" } : {}), versaoRoteiro: VERSAO, rotulo: ROTULO, commit, perfilSha, janela: dims, mutacao: MUTAR || null, esperadoAplicado: aplicacao.aplicados, secoes: SO || SECOES_RODAR.map((s) => s.id) }, violacoes, passos }
writeFileSync(join(SAIDA, `gravacao-${ROTULO}.json`), normalizarPerfil(JSON.stringify(gravacao, null, 1), RAIZ_PERFIL))
console.log(`\ngravado ${join(SAIDA, `gravacao-${ROTULO}.json`)}  passos=${passos.length}  violacoes=${violacoes.length}`)
principal.fechar()
saida.fechar()
process.exit(violacoes.length ? 1 : 0)
