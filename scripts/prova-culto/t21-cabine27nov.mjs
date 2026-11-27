// Cabine 27/nov: setas depois da Biblia, "＋ roteiro" da Biblia, cantor e Lista nos Shows, Outras telas lado a lado, resolucao da Midia em
// Lista sem o selo laranja, menu da categoria de midia, sem o vao de 36 px no roteiro. Contra o Show de dev (CDP), perfil de teste.
//   node scripts/prova-culto/t21-cabine27nov.mjs [pasta-de-fotos]
import { writeFileSync } from "node:fs"
import { abrir, clicarEm, esperar, localizar, tecla } from "./lib.mjs"

const FOTOS = process.argv[2] || ""
const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal", { buffer: true })
await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await esperar(600)
async function foto(nome) {
    if (!FOTOS) return
    const r = await j.enviar("Page.captureScreenshot", { format: "png" })
    writeFileSync(`${FOTOS}/${nome}.png`, Buffer.from(r.result.data, "base64"))
}
const limpar = () => j.ev(`S.outLocked.set(false); S.outputs.update(a=>{Object.values(a).forEach(o=>{o.out={}});return a}); await esp(400); return 1`)
const slideNoAr = () => j.ev(`const o=Object.values(get(S.outputs)).find(o=>!o.stageOutput&&o.out?.slide); return o?.out?.slide ? {id:o.out.slide.id, index:o.out.slide.index} : null`)
async function aba(nome) {
    await j.ev(`let e=document.querySelector('[data-acao=arvore]'); while(e){ if(e.scrollTop) e.scrollTop=0; e=e.parentElement } await esp(200); return 1`)
    const a = await localizar(j, `[...document.querySelectorAll('[data-acao=biblioteca] button, [data-acao=arvore] button')].find(b=>b.innerText.trim().startsWith(${JSON.stringify(nome)}))`)
    if (a.ok) await clicarEm(j, a.x, a.y)
    await esperar(900)
    return a.ok
}

try {
    await j.ev(`MODO("culto"); await esp(600); return 1`)
    await limpar()

    // ---- A: setas depois do duplo clique na Biblia ----
    const showId = await j.ev(`const ids=Object.keys(get(S.shows)).filter(id=>!get(S.shows)[id].private); return ids[0]||""`)
    const T = await j.ev(`const m=await import(U("utils/aliancaTocarNoAr")); await m.tocarShowNoAr(${JSON.stringify(showId)}); await esp(900); return 1`).catch((e) => String(e))
    ok("A uma musica foi ao ar antes", !!(await slideNoAr()), String(T))
    ok("A aba Biblia abre", await aba("Bíblia"))
    for (let t = 0; t < 20 && !(await j.ev(`return !!document.querySelector('[data-regiao=biblioteca] .verse')`)); t++) await esperar(500)
    let v = await localizar(j, `document.querySelectorAll('[data-regiao=biblioteca] .verse')[2]`)
    ok("A versiculo visivel", v.ok, v.motivo)
    await clicarEm(j, v.x, v.y, 1)
    await clicarEm(j, v.x, v.y, 2)
    await esperar(1500)
    let s = await slideNoAr()
    ok("A duplo clique poe a Biblia no ar (slide temp)", s?.id === "temp", JSON.stringify(s))
    await j.ev(`document.activeElement?.blur?.(); return 1`)
    await tecla(j, "ArrowRight")
    await esperar(1200)
    s = await slideNoAr()
    const ativo = await j.ev(`return [...document.querySelectorAll('[data-regiao=biblioteca] .verse')].findIndex(e=>e.classList.contains("isActive"))`)
    ok("A seta para a direita continua na Biblia (nao volta a musica)", s?.id === "temp", JSON.stringify(s))
    ok("A e anda para o versiculo seguinte", ativo === 3, "ativo=" + ativo)
    await tecla(j, "ArrowLeft")
    await esperar(1200)
    const ativo2 = await j.ev(`return [...document.querySelectorAll('[data-regiao=biblioteca] .verse')].findIndex(e=>e.classList.contains("isActive"))`)
    ok("A seta para a esquerda volta um versiculo", ativo2 === 2 && (await slideNoAr())?.id === "temp", "ativo=" + ativo2)
    await foto("a-biblia-setas")

    // A2 ("aprovo", 27/nov): com a aba Biblia FECHADA, a seta continua andando o versiculo e a biblioteca volta para a Biblia
    ok("A2 aba Shows abre (Biblia ainda no ar)", (await aba("Shows")) && (await slideNoAr())?.id === "temp")
    await j.ev(`document.activeElement?.blur?.(); return 1`)
    await tecla(j, "ArrowRight")
    await esperar(2500)
    s = await slideNoAr()
    const abaDepois = await j.ev(`return get(S.activeDrawerTab)`)
    const ativo3 = await j.ev(`return [...document.querySelectorAll('[data-regiao=biblioteca] .verse')].findIndex(e=>e.classList.contains("isActive"))`)
    ok("A2 a seta com a aba fechada nao volta a musica", s?.id === "temp", JSON.stringify(s))
    ok("A2 a biblioteca volta para a Biblia", abaDepois === "scripture", abaDepois)
    ok("A2 e o versiculo andou", ativo3 === 3, "ativo=" + ativo3)
    // o botao de avancar (OutputHelper.advanceOutputs("next")) tambem anda a Biblia
    await j.ev(`const m=await import(U("components/helpers/OutputHelper")); m.OutputHelper.advanceOutputs("next"); await esp(1500); return 1`)
    const ativo4 = await j.ev(`return [...document.querySelectorAll('[data-regiao=biblioteca] .verse')].findIndex(e=>e.classList.contains("isActive"))`)
    ok("A2 o avancar sem tecla tambem anda o versiculo", ativo4 === 4 && (await slideNoAr())?.id === "temp", "ativo=" + ativo4)

    // ---- B: "＋ roteiro" da Biblia ----
    const antes = await j.ev(`const p=get(S.projects)[get(S.activeProject)]; return p?.shows?.length ?? -1`)
    const btn = await localizar(j, `document.querySelector('[data-acao=biblia-no-roteiro]')`)
    ok("B botao ＋ roteiro na Biblia", btn.ok, btn.motivo)
    if (btn.ok && antes >= 0) {
        await clicarEm(j, btn.x, btn.y)
        await esperar(1500)
        const depois = await j.ev(`const p=get(S.projects)[get(S.activeProject)]; const l=p?.shows||[]; const u=l[l.length-1]; return {n:l.length, nome:get(S.shows)[u?.id]?.name||""}`)
        ok("B o trecho entrou no fim do roteiro", depois.n === antes + 1, JSON.stringify(depois) + " antes=" + antes)
        await j.ev(`const h=await import(U("components/helpers/history")); h.undo?.(); await esp(300); h.undo?.(); await esp(300); return 1`).catch(() => {})
    } else ok("B ha culto aberto no perfil", antes >= 0)
    await limpar()

    // ---- C: Shows com cantor e Lista com detalhes ----
    ok("C aba Shows abre", await aba("Shows"))
    const comChave = await j.ev(`return Object.values(get(S.shows)).filter(s=>s?.quickAccess && "artista" in s.quickAccess).length + "/" + Object.keys(get(S.shows)).length`)
    ok("C a lista leve traz a chave do cantor (lida no Electron)", !comChave.startsWith("0/"), comChave)
    await j.ev(`S.drawerTabsData.update(a=>{a.shows={...a.shows, aliancaExibicao:"colunas"}; return a}); await esp(500); return 1`)
    const cantores = await j.ev(`return document.querySelectorAll('[data-acao=biblioteca-cantor]').length`)
    console.log("     cantores visiveis em Colunas:", cantores)
    await foto("c-shows-colunas")
    await j.ev(`S.drawerTabsData.update(a=>{a.shows={...a.shows, aliancaExibicao:"lista", aliancaOrdem:"nome"}; return a}); await esp(700); return 1`)
    const linhas = await j.ev(`return document.querySelectorAll('[data-acao=shows-lista-detalhes] .lin').length`)
    ok("C modo Lista com detalhes tem linhas", linhas > 0, "linhas=" + linhas)
    const o = await localizar(j, `document.querySelector('[data-acao=shows-ordenar-criado]')`)
    if (o.ok) await clicarEm(j, o.x, o.y)
    await esperar(600)
    const ord = await j.ev(`return get(S.drawerTabsData).shows?.aliancaOrdem`)
    ok("C clicar em Criada ordena por data", ord === "criado", ord)
    await foto("c-shows-lista")
    await j.ev(`S.drawerTabsData.update(a=>{a.shows={...a.shows, aliancaExibicao:"colunas", aliancaOrdem:"nome"}; return a}); return 1`)

    // ---- D: Midia em Lista sem selo laranja na resolucao; E: menu da categoria ----
    ok("D aba Mídia abre", await aba("Mídia"))
    await j.ev(`S.mediaOptions.update(a=>({...a, mode:"list"})); await esp(1500); return 1`)
    const fundoLaranja = await j.ev(`return [...document.querySelectorAll('.lc-res')].filter(e=>getComputedStyle(e).backgroundColor!=="rgba(0, 0, 0, 0)").length + "/" + document.querySelectorAll('.lc-res').length`)
    ok("D nenhuma resolucao com fundo colorido", fundoLaranja.startsWith("0/"), fundoLaranja)
    await foto("d-midia-lista")
    await j.ev(`S.mediaOptions.update(a=>({...a, mode:"grid"})); return 1`)
    const cat = await j.ev(`return [...document.querySelectorAll('[data-aba^="pasta:"]')].map(e=>e.dataset.aba+"="+(e.className.includes("#alianca_categoria")?"menu":"-")).join(" ")`)
    ok("E categorias da Midia com menu proprio", /pasta:(?!raiz|sirvo)[^=]+=menu/.test(cat), cat)

    // ---- E2 ("aprovo", 27/nov): ajuste na tela proprio numa FOTO ----
    const foto1 = await j.ev(`return Object.keys(get(S.media)).find(p=>/\.(png|jpe?g|webp)$/i.test(p)) || ""`)
    if (foto1) {
        const antes = await j.ev(`return get(S.media)[${JSON.stringify(foto1)}]?.fit || ""`)
        await j.ev(`MODO("preparar"); await esp(500); const mc=await import(U("components/context/menuClick")); mc.menuClick("alianca_ajuste", true, {id:"cover"}, null, null, {id:"media", data:[{path:${JSON.stringify(foto1)}}]}); await esp(600); return 1`)
        const depois = await j.ev(`return get(S.media)[${JSON.stringify(foto1)}]?.fit || ""`)
        ok("E2 ajuste proprio grava numa foto", depois === "cover", "antes=" + antes + " depois=" + depois)
        await j.ev(`const mc=await import(U("components/context/menuClick")); mc.menuClick("alianca_ajuste", true, {id:"seguir"}, null, null, {id:"media", data:[{path:${JSON.stringify(foto1)}}]}); await esp(400); MODO("culto"); await esp(500); return 1`)
        const volta = await j.ev(`return get(S.media)[${JSON.stringify(foto1)}]?.fit || ""`)
        ok("E2 'Seguir a pasta' tira o ajuste da foto", volta === "", volta)
    } else console.log("     (sem foto no perfil para E2)")

    // ---- F: roteiro sem o vao de 36 px (sem aviso do Sirvo) ----
    const vao = await j.ev(`return document.querySelectorAll('.avisoLugar').length`)
    ok("F sem o lugar vazio do aviso do Sirvo", vao === 0, "avisoLugar=" + vao)

    // ---- G: Outras telas lado a lado ----
    const outras = await j.ev(`const g=document.querySelector('[data-acao=outras-telas-grade]'); return g ? g.querySelectorAll('.prev').length : -1`)
    console.log("     previas em Outras telas:", outras, "(-1 = secao recolhida ou so uma saida)")
    await foto("g-mostrar")
} catch (e) {
    ok("sem excecao", false, String(e?.stack || e))
} finally {
    await limpar().catch(() => {})
    await j.enviar("Emulation.clearDeviceMetricsOverride", {}).catch(() => {})
    console.log(falhas.length ? `\nT21: ${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nT21: tudo ok")
    process.exit(falhas.length ? 1 : 0)
}
