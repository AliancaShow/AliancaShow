// T-1a-2, 4, 6, 9, 10, 11, 12 (no Preparar), 14 e 15 (1a): a barra do Preparar de verdade. Cliques e teclas REAIS, nunca force.
//   FS_PERFIL_DIR=... bash scripts/prova-culto/restaurar.sh && bash scripts/prova-culto/reiniciar.sh ; node scripts/prova-culto/t1a-barra.mjs ; restaurar.sh
import { VARREDURA } from "./aparencia/fva-lib.mjs"
import { abrir, clicarEm, desligarSaidaNoCulto, esperar, injetarChips, instalarContagem, irParaModo, lerContagem, ligarSaidaNoCulto, localizar, prepararCulto, recarregar, relato, tecla } from "./t1aLib.mjs"

const r = relato("t1a-barra")
const j = await abrir("principal")
await recarregar(j)
await prepararCulto(j)
await esperar(1000)
const retDo = (expr) => j.ev(`const b=(${expr}).getBoundingClientRect(); return [b.x,b.y,b.width,b.height].map(v=>Math.round(v*100)/100)`)
const MODO = `document.querySelector(".top.panel .modo")`

// ---------------------------------------------------------------- T-1a-2: o seletor no mesmo pixel
const retCulto = await retDo(MODO)
await irParaModo(j, "Preparar")
const retPrep = await retDo(MODO)
// DESVIO: o retangulo NAO e igual entre os modos nem na referencia (as fontes do Preparar, FV-A, alargam a marca em ~5 px). O que a 1a
// promete e nao mexer: grava os retangulos e o t1a-seletor-compara.mjs os compara com os da referencia (../ref-f0c) medidos pelo mesmo script.
import("node:fs").then(({ writeFileSync }) => writeFileSync(`../gravacoes/t1a-seletor-${process.env.T1A_TAG || "head"}.json`, JSON.stringify({ culto: retCulto, preparar: retPrep })))
r.ok("T-1a-2.1 o seletor Culto | Preparar tem altura e y iguais nos dois modos (largura: ver t1a-seletor-compara.mjs)", retCulto[1] === retPrep[1] && retCulto[3] === retPrep[3], `${retCulto} vs ${retPrep}`)
await instalarContagem(j)
{
    const b = await localizar(j, `[...document.querySelectorAll(".top.panel .modo button")].find(b=>b.innerText.trim()==="Culto")`)
    await clicarEm(j, b.x, b.y, 2) // duplo clique rapido no seletor
    await esperar(600)
    const e = await j.ev(`return {modo:get(S.modoAlianca), faixa:!!document.querySelector(".faixaFalha"), falhas:get((await import(U("utils/aliancaFalha"))).falhas).length}`)
    const c = await lerContagem(j)
    r.ok("T-1a-2.2 duplo clique no seletor termina num modo coerente, sem erro e sem escrita em outputs", (e.modo === "culto" || e.modo === "preparar") && !e.faixa && e.falhas === 0 && c.out === 0, JSON.stringify({ e, c }))
}
await irParaModo(j, "Preparar")
await esperar(300)

// ---------------------------------------------------------------- T-1a-4: aviso de tecla
await j.ev(`document.activeElement?.blur?.(); return 1`)
const PIL = `document.querySelector(".prepararBarra .pilula, .prepararBarra .aviso")`
const textoPil = () => j.ev(`const p=${PIL}; return p?{cls:p.className.split(" ")[0], t:p.innerText.trim()}:null`)
await tecla(j, " ")
await esperar(300)
let p = await textoPil()
r.ok("T-1a-4.1 Espaco no Preparar: a pilula vira o aviso de tecla ignorada", p?.cls === "aviso" && p.t.startsWith("Tecla ignorada"), JSON.stringify(p))
r.ok("T-1a-4.2 o seletor de modo pisca junto", (await j.ev(`return !!document.querySelector(".top.panel .modo.piscando")`)) === true, "nao piscou")
{
    const pl = await j.ev(`const p=${PIL}.getBoundingClientRect(); return {x:p.x+p.width/2,y:p.y+p.height/2}`)
    await clicarEm(j, pl.x, pl.y)
    await esperar(200)
    r.ok("T-1a-4.3 clique na pilula durante o aviso nao abre nada", (await j.ev(`return get(S.activePage)==="show"`)) === true, "mudou de pagina")
}
for (let i = 0; i < 5; i++) {
    await tecla(j, " ")
    await esperar(150)
}
await esperar(3400)
p = await textoPil()
r.ok("T-1a-4.4 5 teclas seguidas: 3 s depois da ultima a pilula volta (um timer so)", p?.cls === "pilula", JSON.stringify(p))
await tecla(j, " ")
await esperar(300)
await irParaModo(j, "Culto")
await irParaModo(j, "Preparar")
p = await textoPil()
r.ok("T-1a-4.5 trocar de modo durante o aviso limpa o aviso", p?.cls === "pilula", JSON.stringify(p))
await instalarContagem(j)
await tecla(j, "o", { ctrl: true })
await esperar(500)
{
    const e = await j.ev(`return {od:!!get(S.outputDisplay)}`)
    const c = await lerContagem(j)
    p = await textoPil()
    r.ok("T-1a-4.6 Ctrl+O avisa e nao liga o telao", p?.cls === "aviso" && !e.od && !c.canais.some((k) => k.includes("TOGGLE_OUTPUTS")), JSON.stringify({ p, e, c }))
}
await esperar(3400)

// ---------------------------------------------------------------- T-1a-6: pilula (sem letra e nao chegou por injecao; ver desvio no PR)
{
    const info = await j.ev(`const pid="090fa9015be"; S.activeProject.set(pid); S.editingProjectTemplate.set(false); await esp(300);
S.textCache.update(t=>({...t, impulso_cordeiro_santo:"", impulso_cristo_vive:""})); await esp(500);
const P=await import(U("utils/aliancaPilula")); return {pil:get(P.pilula).texto, shows:get(S.projects)[pid]?.shows?.length}`)
    r.ok("T-1a-6.1 a pilula conta '2 sem letra' (textCache vazio de 2 musicas do projeto)", /2 sem letra/.test(info.pil), JSON.stringify(info))
    await j.ev(`const M=await import(U("utils/aliancaSirvoMaterial")); M.sirvoMaterialEstado.update(e=>({...e,habilitado:true,naFila:1,falhas:[{id:"x",nome:"arquivo.mp4",detalhe:"falhou"}]})); await esp(300); return 1`)
    p = await textoPil()
    r.ok("T-1a-6.2 com o material injetado a pilula soma '2 nao chegou'", /2 não chegou/.test(p?.t || ""), JSON.stringify(p))
    await instalarContagem(j)
    const pl = await localizar(j, PIL)
    await clicarEm(j, pl.x, pl.y)
    await esperar(1200)
    const e = await j.ev(`const P=await import(U("utils/aliancaPilula")); return {idx:get(S.activeShow)?.index, id:get(S.activeShow)?.id, pil:get(P.pilula).texto}`)
    const c = await lerContagem(j)
    r.ok("T-1a-6.3 o clique abre o 1o sem letra do projeto e o numero cai 1", e.idx !== undefined && /1 sem letra/.test(e.pil), JSON.stringify(e))
    r.ok("T-1a-6.4 zero outputs na pilula", c.out === 0 && !c.canais.some((k) => /TOGGLE|SLIDE|CLEAR/.test(k)), JSON.stringify(c))
    await j.ev(`S.textCache.update(t=>({...t, impulso_cristo_vive:"x"})); const M=await import(U("utils/aliancaSirvoMaterial")); M.sirvoMaterialEstado.update(e=>({...e,naFila:0,falhas:[]})); await esp(400); return 1`)
    await j.ev(`const t=get(S.textCache); S.textCache.update(a=>{ for(const k of ["impulso_cordeiro_santo","impulso_cristo_vive","impulso_aos_teus_pes"]) if(a[k]==="") a[k]="x"; return a }); await esp(300); return 1`)
    p = await textoPil()
    r.ok("T-1a-6.5 tudo zero: 'tudo pronto ✓' e o clique nao faz nada", p?.t === "tudo pronto ✓", JSON.stringify(p))
}

// ---------------------------------------------------------------- T-1a-10: a barra
await prepararCulto(j)
await irParaModo(j, "Preparar")
await esperar(500)
{
    const e = await j.ev(`const q=(s)=>document.querySelectorAll(s).length; return {faixa:[...document.querySelectorAll(".faixa")].filter(x=>/Preparando/.test(x.innerText)).length, clockArea:q(".clockArea"), relogios:q(".prepararBarra .relogio"), altura:document.querySelector(".top.panel").getBoundingClientRect().height, rolagem:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1}`)
    r.ok("T-1a-10.1 Preparar sem a faixa antiga, sem o relogio do rodape, um relogio so na barra", e.faixa === 0 && e.clockArea === 0 && e.relogios === 1, JSON.stringify(e))
    r.ok("T-1a-10.2 altura da barra 54 px e sem rolagem nova", e.altura === 54 && !e.rolagem, JSON.stringify(e))
}
await injetarChips(j)
const larguras = [1365, 1099, 899, 759]
for (const w of larguras) {
    await j.enviar("Emulation.setDeviceMetricsOverride", { width: w, height: 760, deviceScaleFactor: 1, mobile: false })
    await esperar(600)
    const e = await j.ev(
        `const b=document.querySelector(".prepararBarra").getBoundingClientRect(); const dentro=(s)=>{const el=document.querySelector(s); if(!el) return null; const r=el.getBoundingClientRect(); return r.left>=b.left-0.5&&r.right<=b.right+0.5}; const chip=document.querySelector(".prepararBarra .chip"); const rel=document.querySelector(".prepararBarra .relogio"); const pil=document.querySelector(".prepararBarra .pilula"); return {menu:dentro(".prepararMenu"), chipTexto:getComputedStyle(chip.querySelector(".texto")).display, chipIcone:getComputedStyle(chip.querySelector(".icone")).display, relogio:getComputedStyle(rel).display, pilMax:getComputedStyle(pil).maxWidth, pilW:pil.getBoundingClientRect().width}`
    )
    r.ok(`T-1a-10.3 ${w}px: ⋯ dentro da barra`, e.menu === true, JSON.stringify(e))
    if (w <= 1099) r.ok(`T-1a-10.4 ${w}px: chips viram icone com numero`, e.chipTexto === "none" && e.chipIcone !== "none", JSON.stringify(e))
    else r.ok(`T-1a-10.4 ${w}px: chips com o texto inteiro`, e.chipTexto !== "none", JSON.stringify(e))
    if (w <= 899) r.ok(`T-1a-10.5 ${w}px: pilula corta em 220 px`, e.pilMax === "220px" && e.pilW <= 221, JSON.stringify(e))
    if (w <= 759) r.ok(`T-1a-10.6 ${w}px: o relogio some`, e.relogio === "none", JSON.stringify(e))
    else r.ok(`T-1a-10.6 ${w}px: o relogio aparece`, e.relogio !== "none", JSON.stringify(e))
}
await j.enviar("Emulation.clearDeviceMetricsOverride", {})
await esperar(500)

// ---------------------------------------------------------------- T-1a-9: + Novo
{
    const itensAntes = ["Música (colar letra)"]
    r.ok("T-1a-9.1 a coluna esquerda nao tem mais o botao + Novo", (await j.ev(`return document.querySelectorAll(".left .alianca-novo, .abas .alianca-novo").length`)) === 0, "ainda tem na coluna")
    r.ok("T-1a-9.2 o botao esta na barra do Preparar (so em show)", (await j.ev(`return document.querySelectorAll(".prepararBarra .alianca-novo .botao").length`)) === 1, "sem botao")
    const b = await localizar(j, `document.querySelector(".prepararBarra .alianca-novo .botao")`)
    await clicarEm(j, b.x, b.y)
    await esperar(400)
    const m = await j.ev(`const m=document.querySelector(".prepararBarra .alianca-novo .menu"); if(!m) return null; const r=m.getBoundingClientRect(); return {rotulos:[...m.querySelectorAll("[role=menuitem]")].map(x=>x.innerText.trim()), dentro:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}`)
    r.ok("T-1a-9.3 o menu abre dentro da janela", m?.dentro === true, JSON.stringify(m))
    r.ok("T-1a-9.4 os itens do menu", m?.rotulos?.length >= 3 && itensAntes.every((x) => m.rotulos.includes(x)), JSON.stringify(m))
    const mus = await localizar(j, `[...document.querySelectorAll(".prepararBarra .alianca-novo [role=menuitem]")].find(x=>x.innerText.trim()==="Música (colar letra)")`)
    await clicarEm(j, mus.x, mus.y)
    await esperar(600)
    r.ok("T-1a-9.5 'Música (colar letra)' abre o mesmo popup", (await j.ev(`return get(S.activePopup)`)) === "alianca_letra", "popup diferente")
    await j.ev(`S.activePopup.set(null); await esp(300); return 1`)
    await j.ev(`S.activePage.set("settings"); await esp(400); return 1`)
    r.ok("T-1a-9.6 fora de show o botao nao aparece", (await j.ev(`return document.querySelectorAll(".prepararBarra .alianca-novo").length`)) === 0, "apareceu")
    await j.ev(`S.activePage.set("show"); await esp(400); return 1`)
}

// ---------------------------------------------------------------- T-1a-11: modo foco
{
    await j.ev(`S.activeShow.set({id:"impulso_aos_teus_pes",type:"show"}); await esp(300); return 1`)
    await tecla(j, "f", { ctrl: true, shift: true })
    await esperar(500)
    const e = await j.ev(`return {foco:get(S.focusMode), show:get(S.activeShow)?.id}`)
    r.ok("T-1a-11.1 Ctrl+Shift+F nao faz nada: focusMode falso e activeShow intacto", e.foco === false && e.show === "impulso_aos_teus_pes", JSON.stringify(e))
}

// ---------------------------------------------------------------- T-1a-14: voltar
{
    const b = await localizar(j, `document.querySelector(".prepararBarra .menuBotao")`)
    await clicarEm(j, b.x, b.y)
    await esperar(300)
    const c = await localizar(j, `document.querySelector('[role=menuitem][data-item="config"]')`)
    await clicarEm(j, c.x, c.y)
    await esperar(600)
    r.ok("T-1a-14.1 ⋯ › Configuracoes leva a settings e mostra '← Voltar'", (await j.ev(`return get(S.activePage)==="settings" && !!document.querySelector(".prepararBarra .voltar")`)) === true, "")
    const v = await localizar(j, `document.querySelector(".prepararBarra .voltar")`)
    await clicarEm(j, v.x, v.y)
    await esperar(500)
    r.ok("T-1a-14.2 Voltar volta a show", (await j.ev(`return get(S.activePage)`)) === "show", "")
}

// ---------------------------------------------------------------- T-1a-15: busca no Preparar
const busca = async (texto) => {
    await tecla(j, "g", { ctrl: true })
    await esperar(500)
    await j.enviar("Input.insertText", { text: texto })
    await esperar(700)
}
// o componente de toast consome o store (o valor pode sumir antes da leitura): um gravador assina e guarda tudo que ja passou por ele
await j.ev(`window.__toasts=[]; S.toastMessages.subscribe(v=>{ for(const m of v) if(!window.__toasts.includes(m)) window.__toasts.push(m) }); return 1`)
const toast = () => j.ev(`return window.__toasts.slice()`)
const zerarToast = () => j.ev(`window.__toasts.length=0; S.toastMessages.set([]); S.quickSearchActive.set(false); return 1`)
const fechou = () => j.ev(`return get(S.quickSearchActive)===false`)
{
    await j.ev(`S.toastMessages.set([]); return 1`)
    await instalarContagem(j)
    await busca("a")
    const cats = await j.ev(`return [...document.querySelectorAll(".quicksearch .category-header")].map(x=>x.innerText.trim())`)
    r.ok("T-1a-15.1 a lista nao mostra a categoria de acoes", !cats.some((x) => /^(a[cç][oõ]es|actions)$/i.test(x)), JSON.stringify(cats))
    await tecla(j, "Escape")
    await esperar(300)
    for (const [rot, txt] of [
        ["Gerenciar grupos", "Gerenciar grupos"],
        ["Transição", "Transição"],
        ["Letra (vista da grade)", "Letra"]
    ]) {
        await zerarToast()
        await busca(txt)
        await tecla(j, "Enter")
        await esperar(500)
        const t = await toast()
        const dbg = await j.ev(`return {vals:[...document.querySelectorAll(".quicksearch .values button")].map(e=>e.innerText.trim().replace(/\s+/g," ").slice(0,30)), ativo:get(S.activePage), show:get(S.activeShow)?.id}`)
        r.ok(`T-1a-15.2 '${rot}' + Enter: toast 'Use no Culto' e a busca fecha`, t.some((x) => x.startsWith("Use no Culto")) && (await fechou()), JSON.stringify({ t, dbg }))
    }
    // com o clique do mouse no 1o resultado
    await zerarToast()
    await busca("Gerenciar grupos")
    const res = await localizar(j, `document.querySelector(".quicksearch .values button")`)
    if (res.ok) {
        await clicarEm(j, res.x, res.y)
        await esperar(500)
        const t = await toast()
        r.ok("T-1a-15.3 o mesmo com o clique do mouse", t.some((x) => x.startsWith("Use no Culto")) && (await fechou()), JSON.stringify(t))
    } else r.ok("T-1a-15.3 o mesmo com o clique do mouse", false, res.motivo)
    // Desenhar: toast proprio e nao abre draw
    await zerarToast()
    await busca("Desenhar")
    await tecla(j, "Enter")
    await esperar(500)
    r.ok("T-1a-15.4 'Desenhar' + Enter: toast de Desenhar e Biblia e nao abre draw", (await toast()).some((x) => x.startsWith("Desenhar e Bíblia")) && (await j.ev(`return get(S.activePage)`)) !== "draw", JSON.stringify(await toast()))
    // permitidos
    await zerarToast()
    await j.ev(`S.activeShow.set({id:"impulso_aos_teus_pes",type:"show"}); S.activePage.set("show"); await esp(400); return 1`)
    const n0 = await j.ev(`return Object.keys(get(S.showsCache)["impulso_aos_teus_pes"]?.slides||{}).length`)
    await busca("Novo slide")
    await tecla(j, "Enter")
    await esperar(800)
    const n1 = await j.ev(`return Object.keys(get(S.showsCache)["impulso_aos_teus_pes"]?.slides||{}).length`)
    r.ok("T-1a-15.5 'Novo slide' + Enter: o show ganha um slide, sem toast", n1 === n0 + 1 && !(await toast()).some((x) => x.startsWith("Use no Culto")), JSON.stringify({ n0, n1, t: await toast() }))
    await j.ev(`S.activePopup.set(null); S.quickSearchActive.set(false); return 1`)
    await busca("Novo show")
    await tecla(j, "Enter")
    await esperar(700)
    r.ok("T-1a-15.6 'Novo show' + Enter abre o popup de novo show", (await j.ev(`return get(S.activePopup)`)) === "show", String(await j.ev(`return get(S.activePopup)`)))
    await j.ev(`S.activePopup.set(null); return 1`)
    const c = await lerContagem(j)
    r.ok("T-1a-15.7 zero escrita em outputs e zero OUTPUT:TOGGLE/CLEAR em toda a busca", c.out === 0 && !c.canais.some((k) => /TOGGLE|CLEAR|SLIDE|DRAW/.test(k)), JSON.stringify(c))
}

// ---------------------------------------------------------------- T-1a-12 (no Preparar): faixa de falha
{
    await j.ev(`S.quickSearchActive.set(false); S.activePage.set("show"); await esp(400); return 1`)
    const varrer = async () => JSON.parse(await j.ev(VARREDURA)).els
    const antes = await varrer()
    await j.ev(`const f=await import(U("utils/aliancaFalha")); f.falhaAlta("teste-cdp", new Error("x")); return 1`)
    await esperar(400)
    const depois = (await varrer()).filter((e) => !e.tag.includes("faixaFalha"))
    const difs = []
    for (let i = 0; i < Math.min(antes.length, depois.length); i++) if (JSON.stringify(antes[i].rect) !== JSON.stringify(depois[i].rect)) difs.push(antes[i].tag)
    r.ok("T-1a-12.1 no Preparar a faixa nao muda nenhum rect (mesmo numero de elementos, todo rect igual)", antes.length === depois.length && difs.length === 0, `${antes.length} vs ${depois.length}; ${difs[0] || ""}`)
    const e = await j.ev(`const f=document.querySelector(".faixaFalha"); const b=f.getBoundingClientRect(); const t=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2); return {ehFaixa:!!t?.closest(".faixaFalha"), pos:getComputedStyle(f).position, pe:getComputedStyle(f).pointerEvents}`)
    r.ok("T-1a-12.2 elementFromPoint no centro da faixa nao e a faixa; fixed e pointer-events none", !e.ehFaixa && e.pos === "fixed" && e.pe === "none", JSON.stringify(e))
}

// ---------------------------------------------------------------- T-1a-10: NO AR nao zera e a barra fica forte com algo no ar
await recarregar(j)
await ligarSaidaNoCulto(j)
{
    const sl = await localizar(j, `document.querySelectorAll("#showArea .slide")[0]`)
    if (sl.ok) await clicarEm(j, sl.x, sl.y)
    await esperar(1500)
    const t = []
    for (let i = 0; i < 3; i++) {
        await irParaModo(j, "Preparar")
        t.push(await j.ev(`return document.querySelector(".prepararBarra .noAr")?.innerText.trim()||null`))
        await irParaModo(j, "Culto")
    }
    const seg = (s) =>
        s
            ? s
                  .split("·")[1]
                  .trim()
                  .split(":")
                  .reduce((a, x) => a * 60 + Number(x), 0)
            : -1
    r.ok("T-1a-10.7 NO AR nao zera em 3 idas e voltas (o tempo so cresce)", t.every((s) => s) && seg(t[0]) <= seg(t[1]) && seg(t[1]) <= seg(t[2]) && seg(t[2]) >= 3, JSON.stringify(t))
    await irParaModo(j, "Preparar")
    r.ok("T-1a-10.8 com algo no ar a barra fica 'forte'", (await j.ev(`return !!document.querySelector(".prepararBarra.forte")`)) === true, "sem .forte")
    await irParaModo(j, "Culto")
}
await desligarSaidaNoCulto(j)
j.fechar()
r.fim()
