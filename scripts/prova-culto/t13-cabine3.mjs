// Rodada da cabine, 18/nov, fase 3 (C4): Configuracoes e propriedades do Editar no tema Luz. Cliques e teclas REAIS (nunca force) contra o Show de dev.
//   node scripts/prova-culto/t13-cabine3.mjs <pasta-de-prints>
//   A  casca: titulo, Descartar/Salvar/Fechar, lista de 236 px (Sirvo e Controle remoto como itens), um primario so (Salvar)
//   B  pele: estilos COMPUTADOS dos campos, chaves e botoes de Configuracoes = tokens Luz (nunca vermelho, 44 px, raio 6, borda 1 px)
//   C  "N alteracoes nao salvas" e Descartar desfazem de verdade; Salvar zera
//   D  Telas e saidas: abas (a nova leva NOVO), Habilitada/Nome, secoes raras recolhidas com resumo, mapa das telas, lista de saidas
//   E  propriedades do Editar: secoes com fio, Mais/Avancado recolhidos com resumo, grupo de botoes em pastilha, campos na mesma pele
//   F  a janela de SAIDA nao recebeu a pele (sem data-tema, sem tokens, sem .luz-pele)
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { abrir, clicarEm, esperar, localizar } from "./lib.mjs"

const saida = process.argv[2] || "prints-cabine3"
mkdirSync(saida, { recursive: true })
const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal")
const dom = (expr) => j.ev(`return ${expr}`)
async function print(nome) {
    await esperar(600)
    try {
        const d = await j.enviar("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } })
        writeFileSync(join(saida, nome + ".png"), Buffer.from(d.result.data, "base64"))
        console.log("print", nome)
    } catch (e) {
        console.log("print", nome, "(sem captura)")
    }
}
/** clique REAL no elemento (acha, rola, confere que ele e o que esta sob o cursor) */
async function clique(expr) {
    const a = await localizar(j, expr)
    if (!a.ok) throw new Error("alvo nao clicavel: " + a.motivo + " :: " + expr)
    await clicarEm(j, a.x, a.y)
}
// o valor que um token Luz resolve no navegador (a prova compara com isto, nunca com um numero escrito aqui)
const token = (css) => dom(`(()=>{const p=document.createElement("div"); p.className="luz-pele"; p.style.cssText=${JSON.stringify(css)}; document.body.appendChild(p); const s=getComputedStyle(p); const r={bg:s.backgroundColor,bd:s.borderTopColor,c:s.color,rad:s.borderTopLeftRadius}; p.remove(); return r})()`)
const cs = (expr, props) => dom(`(()=>{const e=${expr}; if(!e) return null; const s=getComputedStyle(e); const o={}; for(const p of ${JSON.stringify(props)}) o[p]=s[p]; return o})()`)
const aba = (id) => j.ev(`S.settingsTab.set(${JSON.stringify(id)}); await esp(900); return 1`)
const cabine = () => dom(`document.querySelector('[data-acao=pagina-cabecalho]').innerText.replace(/\\s+/g," ").trim()`)

try {
    await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
    await j.ev(`S.activePopup.set(null); T.trocarTela("show","segmentado"); await esp(700); T.trocarTela("settings","menu-app"); S.settingsTab.set("general"); await esp(1500); return 1`)

    // ---------- A: casca
    ok("A1 Configuracoes abre com o titulo", /^Configurações/.test(await cabine()), await cabine())
    ok("A2 tres botoes no cabecalho: Descartar (desligado), Salvar, Fechar", await dom(`(()=>{const q=(a)=>document.querySelector('[data-acao='+a+']'); return !!q('pagina-descartar') && q('pagina-descartar').disabled && !!q('pagina-salvar') && !!q('pagina-fechar')})()`))
    const lista = await dom(`(()=>{const l=document.querySelector('[data-acao=config-lista]').getBoundingClientRect(); return {w:Math.round(l.width), itens:[...document.querySelectorAll('[data-acao=config-itens] .it')].map(b=>b.innerText.trim())}})()`)
    ok("A3 lista lateral de 236 px com as 8 paginas + Sirvo + Controle remoto + Monitor de retorno", lista.w === 236 && lista.itens.join("|") === "Geral|Telas e saídas|Estilos|Áudio|Conexão|Arquivos|Perfis|Outros|Sirvo|Controle remoto|Monitor de retorno", JSON.stringify(lista))
    const pri = await token("background: var(--luz-texto); color: var(--luz-tinta)")
    const sa = await cs(`document.querySelector('[data-acao=pagina-salvar]')`, ["backgroundColor", "color", "height", "borderTopLeftRadius"])
    const fe = await cs(`document.querySelector('[data-acao=pagina-fechar]')`, ["backgroundColor", "height"])
    ok("A4 Salvar e o unico primario (creme com tinta, 36 px, raio de acao); Fechar e comum", sa.backgroundColor === pri.bg && sa.color === pri.c && sa.height === "36px" && fe.backgroundColor !== pri.bg, JSON.stringify({ sa, fe, pri }))
    const tit = await cs(`document.querySelector('[data-acao=pagina-cabecalho] h1')`, ["fontSize", "fontWeight"])
    const h2 = await cs(`document.querySelector('[data-acao=config-painel] h2')`, ["fontSize", "fontWeight"])
    ok("A5 titulo de janela 17 px e titulo de pagina 22 px (a regua de tipos do board)", tit.fontSize === "17px" && h2.fontSize === "22px", JSON.stringify({ tit, h2 }))
    await print("c4-1-geral")

    // clique em Sirvo e Controle remoto: titulo e conteudo proprios
    await clique(`document.querySelector('[data-aba=sirvo]')`)
    await esperar(700)
    ok("A6 Sirvo e item proprio: titulo Sirvo, item ativo, e a pagina nao traz as telas de conexao", (await dom(`document.querySelector('[data-acao=config-painel] h2').innerText.trim()`)) === "Sirvo" && (await dom(`document.querySelector('[data-aba=sirvo]').classList.contains('a')`)) && !(await dom(`/RemoteShow/.test(document.querySelector('[data-acao=config-painel]').innerText)`)))
    await print("c4-2-sirvo")
    await clique(`document.querySelector('[data-aba=connection]')`)
    await esperar(700)
    ok("A7 Conexao volta a trazer os servidores (sem Sirvo/Controle remoto dentro)", await dom(`/RemoteShow/.test(document.querySelector('[data-acao=config-painel]').innerText)`))
    await aba("general")

    // ---------- B: pele (estilos computados)
    const campo = await token("background: var(--luz-campo); border: 1px solid var(--luz-borda); color: var(--luz-texto)")
    const tf = await cs(`document.querySelector('[data-acao=config-painel] .textfield')`, ["height", "borderTopWidth", "borderTopColor", "borderTopLeftRadius", "backgroundColor", "color"])
    ok("B1 campo: 44 px, borda 1 px (token), raio 6, fundo = token campo, texto = token texto", tf.height === "44px" && tf.borderTopWidth === "1px" && tf.borderTopColor === campo.bd && tf.borderTopLeftRadius === "6px" && tf.backgroundColor === campo.bg && tf.color === campo.c, JSON.stringify({ tf, campo }))
    const lb = await cs(`document.querySelector('[data-acao=config-painel] .textfield > label')`, ["fontSize", "position"])
    ok("B2 rotulo dentro do campo, 10,5 px quando ha valor (Idioma)", lb.position === "absolute" && lb.fontSize === "10.5px", JSON.stringify(lb))
    ok("B3 sem sublinhado animado (o .underline some)", await dom(`[...document.querySelectorAll('[data-acao=config-painel] .textfield .underline, [data-acao=config-painel] .togglefield .underline')].every(u=>getComputedStyle(u).display==="none")`))
    const tg = await cs(`document.querySelector('[data-acao=config-painel] .togglefield')`, ["height", "borderTopLeftRadius", "backgroundColor"])
    ok("B4 chave em linha: 44 px, raio 6, fundo campo", tg.height === "44px" && tg.borderTopLeftRadius === "6px" && tg.backgroundColor === campo.bg, JSON.stringify(tg))
    // liga uma chave de verdade e le o computado da pilula: creme, nunca vermelha
    const ligada = await dom(`(()=>{const t=[...document.querySelectorAll('[data-acao=config-painel] .togglefield')].find(x=>x.getAttribute('aria-checked')==='true'); return t? getComputedStyle(t.querySelector('.switch')).backgroundColor : null})()`)
    ok("B5 chave ligada = creme (token texto), nunca vermelha", ligada === pri.bg, String(ligada))
    ok("B6 nenhum elemento de Configuracoes pinta com o vermelho do FreeShow (--secondary de upstream)", await dom(`(()=>{const v=getComputedStyle(document.body).getPropertyValue('--luz-vermelho'); const p=document.createElement('div'); p.style.background='var(--luz-vermelho)'; document.body.appendChild(p); const red=getComputedStyle(p).backgroundColor; p.remove(); return ![...document.querySelectorAll('[data-acao=config-painel] .textfield, [data-acao=config-painel] .togglefield, [data-acao=config-painel] .switch, [data-acao=config-painel] button')].some(e=>{const s=getComputedStyle(e); return s.backgroundColor===red || s.borderTopColor===red})})()`))
    ok("B7 a fonte e a Archivo do tema (nao a do sistema)", await dom(`/Archivo/.test(getComputedStyle(document.querySelector('[data-acao=config-painel] .togglefield .toggle-label')).fontFamily)`))

    // ---------- C: alteracoes nao salvas e Descartar (clique real na chave)
    const rot = "Desativar etiquetas"
    const valor = () => dom(`get(S.labelsDisabled)`)
    const v0 = await valor()
    await clique(`[...document.querySelectorAll('[data-acao=config-painel] .togglefield')].find(t=>t.innerText.includes(${JSON.stringify(rot)}))`)
    await esperar(700)
    ok("C1 mexer numa chave faz a loja mudar", (await valor()) !== v0)
    ok("C2 o cabecalho diz \"1 alteração não salva\" (laranja) e o Descartar liga", (await cabine()).includes("1 alteração não salva") && (await dom(`!document.querySelector('[data-acao=pagina-descartar]').disabled`)), await cabine())
    const lar = await token("color: var(--luz-laranja)")
    ok("C3 o aviso usa o laranja do tema (token)", (await cs(`document.querySelector('[data-acao=pagina-pendentes]')`, ["color"]))?.color === lar.c)
    await print("c4-3-nao-salvas")
    await clique(`document.querySelector('[data-acao=pagina-descartar]')`)
    await esperar(800)
    ok("C4 Descartar devolve a loja ao que era e some o aviso", (await valor()) === v0 && !(await cabine()).includes("não salva"), `${await valor()} / ${await cabine()}`)
    ok("C5 a chave na tela voltou junto", await dom(`(()=>{const t=[...document.querySelectorAll('[data-acao=config-painel] .togglefield')].find(t=>t.innerText.includes(${JSON.stringify(rot)})); return t.getAttribute('aria-checked')===${JSON.stringify(String(!!v0))}})()`))
    await clique(`[...document.querySelectorAll('[data-acao=config-painel] .togglefield')].find(t=>t.innerText.includes(${JSON.stringify(rot)}))`)
    await esperar(700)
    await clique(`document.querySelector('[data-acao=pagina-salvar]')`)
    await esperar(2500)
    ok("C6 Salvar zera a contagem (e diz Salvo)", !(await cabine()).includes("não salva"), await cabine())
    // desfaz o que a prova mexeu
    await clique(`[...document.querySelectorAll('[data-acao=config-painel] .togglefield')].find(t=>t.innerText.includes(${JSON.stringify(rot)}))`)
    await esperar(500)
    await clique(`document.querySelector('[data-acao=pagina-descartar]')`)
    await esperar(500)

    // ---------- D: Telas e saidas
    await j.ev(`S.outputs.update(a=>{delete a.ndi_c4; return a}); return 1`)
    await aba("display_settings")
    ok("D1 abas de saida logo abaixo do titulo, com a saida atual marcada", await dom(`!!document.querySelector('[data-acao=saidas-abas] [role=tab][aria-selected=true]')`))
    ok("D2 Nova saida e Identificar telas na mesma faixa", await dom(`!!document.querySelector('[data-acao=saidas-nova]') && !!document.querySelector('[data-acao=saidas-identificar]')`))
    const secoes = await dom(`[...document.querySelectorAll('[data-acao=saidas-conteudo] [data-acao=secao-recolhivel]')].map(b=>({s:b.dataset.secao, aberta:b.getAttribute('aria-expanded'), t:b.innerText.replace(/\\s+/g," ").trim()}))`)
    ok("D3 Blackmagic, NDI e RTMP/WebRTC nascem recolhidas e dizem o que tem dentro", secoes.length === 3 && secoes.every((s) => s.aberta === "false") && /Blackmagic.*nenhuma placa encontrada/i.test(secoes[0].t) && /NDI.*desligado/i.test(secoes[1].t) && /RTMP.*desligado/i.test(secoes[2].t), JSON.stringify(secoes))
    await clique(`document.querySelector('[data-secao=ndi]')`)
    await esperar(500)
    ok("D4 abrir a secao mostra o interruptor de NDI e o resumo some", await dom(`document.querySelector('[data-secao=ndi]').getAttribute('aria-expanded')==='true' && !!document.querySelector('[data-acao=saida-ndi]') && !document.querySelector('[data-secao=ndi] small')`))
    await clique(`document.querySelector('[data-secao=ndi]')`)
    ok("D5 Habilitada e Nome ficam na secao SAIDA, no alto", await dom(`(()=>{const s=document.querySelector('[data-secao=saida]'); const nome=document.querySelector('[data-acao=saida-nome]'); return !!s && !!nome && s.getBoundingClientRect().top < nome.getBoundingClientRect().top && nome.innerText.includes('Nome')})()`))
    // uma saida nova (so a loja: sem janela) vira aba com NOVO e linha na lista
    await j.ev(`S.outputs.update(a=>{a.ndi_c4={name:"NDI Live",enabled:false,invisible:true,ndi:true,out:{},style:Object.keys(get(S.styles))[0]||""}; return a}); await esp(900); return 1`)
    ok("D6 a saida nova vira aba com o selo NOVO", await dom(`[...document.querySelectorAll('[data-acao=saidas-abas] [role=tab]')].some(t=>/NDI Live/.test(t.innerText) && /NOVO/.test(t.innerText))`))
    ok("D7 e aparece em Todas as saidas com o resumo \"só NDI\"", await dom(`[...document.querySelectorAll('[data-acao=saidas-todas] .linha')].some(l=>/NDI Live/.test(l.innerText) && /só NDI/.test(l.innerText))`))
    await clique(`document.querySelector('[data-acao=saidas-abas] [role=tab][data-saida=ndi_c4]')`)
    await esperar(700)
    ok("D8 clicar na aba troca a saida editada (Nome mostra NDI Live)", await dom(`get(S.currentOutputSettings)==='ndi_c4' && document.querySelector('[data-acao=saida-nome] input').value==='NDI Live'`))
    ok("D9 so NDI: a secao Janela some (a saida nao tem janela)", await dom(`![...document.querySelectorAll('[data-acao=saidas-conteudo] .luz-sec')].some(h=>/^janela$/i.test(h.innerText.trim()))`))
    await print("c4-4-saidas-ndi")
    await j.ev(`S.currentOutputSettings.set("default"); await esp(500); S.outputs.update(a=>{delete a.ndi_c4; return a}); await esp(600); return 1`)
    const mapa = await dom(`(()=>{const t=[...document.querySelectorAll('[data-acao=saidas-mapa-telas] .tela')]; return {n:t.length, minha:t.filter(x=>x.classList.contains('minha')).length}})()`)
    ok("D10 mapa das telas: ha tela(s) e a da saida escolhida vem marcada", mapa.n >= 1 && mapa.minha === 1, JSON.stringify(mapa))
    const mr = await cs(`document.querySelector('[data-acao=saidas-mapa-telas] .tela.minha')`, ["backgroundColor"])
    const verm = await token("background: var(--luz-vermelho)")
    ok("D11 a tela marcada e o vermelho do tema (so ela e vermelha)", mr?.backgroundColor === verm.bg)
    await print("c4-5-saidas")

    // ---------- E: propriedades do Editar
    await j.ev(`S.activePopup.set(null); const p=get(S.projects); const alvo=Object.entries(p).find(([k,v])=>(v.shows||[]).some(s=>(s.type===undefined||s.type==="show")))
S.activeProject.set(alvo[0]); const i=alvo[1].shows.findIndex(s=>(s.type===undefined||s.type==="show"))
const {loadShows}=await import(U("components/helpers/setShow")); await loadShows([alvo[1].shows[i].id])
S.activeShow.set({id:alvo[1].shows[i].id,index:i,type:"show"}); S.activeDrawerTab.set("shows"); await esp(900)
T.trocarTela("edit","segmentado"); await esp(1200)
S.activeEdit.set({type:"show",slide:0,items:[0],showId:get(S.activeShow).id}); await esp(1500); return 1`)
    const painel = `document.querySelector('[data-acao=editar-ferramentas]')`
    ok("E1 o painel de propriedades adotou a pele (classe de escopo)", await dom(`${painel}.classList.contains('luz-pele')`))
    const ef = await cs(`${painel}.querySelector('.textfield')`, ["height", "borderTopWidth", "borderTopLeftRadius", "backgroundColor"])
    ok("E2 campos do Editar = mesma regua do board (44 px, borda 1 px, raio 6, fundo campo)", ef && ef.height === "44px" && ef.borderTopWidth === "1px" && ef.borderTopLeftRadius === "6px" && ef.backgroundColor === campo.bg, JSON.stringify(ef))
    const grupos = await dom(`[...${painel}.querySelectorAll('[data-acao=editar-grupo]')].map(b=>({g:b.dataset.grupo, a:b.getAttribute('aria-expanded'), t:b.innerText.replace(/\\s+/g," ").trim()}))`)
    ok("E3 Mais e Avancado (da caixa de texto e da caixa) nascem recolhidos e dizem \"tudo no padrão\"", grupos.length >= 2 && grupos.every((g) => g.a === "false" && /tudo no padrão/.test(g.t)), JSON.stringify(grupos))
    ok("E4 o rotulo de secao e caixa alta 12 px (a regua)", await dom(`(()=>{const s=${painel}.querySelector('.luz-sec'); const c=getComputedStyle(s); return c.fontSize==='12px' && c.textTransform==='uppercase'})()`))
    const pastilha = await dom(`(()=>{const b=[...${painel}.querySelectorAll('.highlight')][0]?.closest('button'); if(!b) return null; const g=b.parentElement; const c=getComputedStyle(g); return {h:c.height, gap:c.columnGap, ovf:c.overflow, hl:getComputedStyle(b.querySelector('.highlight')).display}})()`)
    ok("E5 B I U S: pastilha so (36 px, sem espaco entre botoes) e o .highlight antigo some", pastilha && pastilha.h === "36px" && (pastilha.gap === "0px" || pastilha.gap === "normal") && pastilha.hl === "none", JSON.stringify(pastilha))
    await print("c4-6-editar")
    await clique(`${painel}.querySelector('[data-grupo=mais]')`)
    await esperar(700)
    const resumos = await dom(`[...${painel}.querySelectorAll('[data-acao=secao-resumo]')].map(s=>s.closest('button').innerText.replace(/\\s+/g," ").trim())`)
    ok("E6 abrir Mais mostra as secoes de efeito recolhidas com resumo (Contorno e Sombra: \"desligado\")", resumos.some((t) => /contorno.*desligado/i.test(t)) && resumos.some((t) => /sombra.*desligado/i.test(t)), JSON.stringify(resumos))
    await print("c4-7-editar-mais")
    await clique(`${painel}.querySelector('[data-grupo=mais]')`)

    // ---------- F: a saida nao recebeu a pele
    let s = null
    try {
        s = await abrir("saida")
    } catch (e) {
        s = null
    }
    if (!s) console.log("      (sem janela de saida aberta neste perfil: F vale pelo guarda estatico e pela Prova do Culto)")
    else {
        const r = await s.avaliar(`return {tema: document.body.dataset.tema || null, campoH: getComputedStyle(document.body).getPropertyValue('--luz-campo-h').trim(), pele: document.querySelectorAll('.luz-pele').length}`)
        ok("F1 a janela de saida nao tem data-tema, nao define o token novo e nao tem .luz-pele", r.tema === null && r.campoH === "" && r.pele === 0, JSON.stringify(r))
        s.fechar()
    }
} catch (e) {
    ok("a fumaca nao quebrou", false, String(e && e.stack || e).slice(0, 400))
}
await j.ev(`S.activePopup.set(null); S.currentOutputSettings.set("default"); T.trocarTela("show","segmentado"); return 1`).catch(() => {})
j.fechar()
console.log(falhas.length ? `\nFALHAS: ${falhas.length}\n - ${falhas.join("\n - ")}` : "\nTUDO OK")
process.exit(falhas.length ? 1 : 0)
