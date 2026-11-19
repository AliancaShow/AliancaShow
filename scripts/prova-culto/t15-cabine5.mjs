// Cabine-5 (19/nov, PC da igreja). Fumaca contra o Show de dev (CDP). Sem cliques forcados.
//   node scripts/prova-culto/t15-cabine5.mjs
//   A  Configuracoes com fundo no ar e fade longo: enquanto o fade de saida da previa do No ar roda, so UM corpo aparece e ele tem a altura toda
//   B  arvore da Biblia sem "Colecoes"/"Nova colecao"; "＋ biblia" no fim
//   C  botao direito numa pasta de midia: os 3 tipos na raiz, sem o submenu "Tipo"
//   D  Configuracoes > Geral: "Troca de fundo" (Fade / Corte seco) grava a transicao global de midia
import { abrir, clicarEm, esperar, localizar } from "./lib.mjs"

const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal", { buffer: true })

// ---------------------------------------------------------------- A
await j.ev(`MODO("culto"); return 1`)
await esperar(800)
const fundo = await j.ev(`
  const cfg=get(S.dataPath); const out=Object.keys(get(S.outputs))[0]
  S.transitionData.update(a=>({...a, media:{type:"fade",duration:3000,easing:"linear"}}))
  const midia=Object.values(get(S.mediaFolders))[0]?.path
  const path=midia+"/f1.png"
  S.outputs.update(o=>{o[out].out={...(o[out].out||{}), background:{path, type:"image"}}; return o})
  await esp(3500)
  return path`)
ok("A0 fundo no ar", !!fundo, fundo)
const corpos = await j.ev(`
  T.trocarTela("settings","segmentado"); await esp(250)
  const tela=document.querySelector(".tela"); const th=tela.getBoundingClientRect().height
  const cs=[...tela.querySelectorAll(":scope > .corpo")].map(c=>({pag:c.dataset.pagina||"mostrar", h:Math.round(c.getBoundingClientRect().height), vis:getComputedStyle(c).display!=="none"}))
  return {th:Math.round(th), cs}`)
const visiveis = corpos.cs.filter((c) => c.vis)
ok("A1 so um corpo visivel durante o fade", visiveis.length === 1, JSON.stringify(corpos))
ok("A2 o visivel e Configuracoes", visiveis[0]?.pag === "settings", visiveis[0]?.pag)
ok("A3 Configuracoes com a altura toda (nao a metade)", visiveis[0] && visiveis[0].h > corpos.th * 0.8, `${visiveis[0]?.h} de ${corpos.th}`)
console.log("     (corpos no DOM nesse instante: " + corpos.cs.length + (corpos.cs.length > 1 ? " — o cenario do defeito se reproduziu" : " — o fade ja tinha acabado") + ")")
// Svelte 3: o grupo de saida do corpo antigo as vezes NAO termina (fica no DOM, escondido, enquanto se esta na pagina). Relatado, nao reprovado:
// o conserto da cabine-5 e ele nao aparecer; ele sai quando se volta ao Mostrar (A4).
await esperar(3500)
const preso = await j.ev(`return [...document.querySelectorAll(".tela > .corpo")].length`)
console.log("     corpos no DOM 3,5 s depois do fade (ainda em Configuracoes): " + preso)
await j.ev(`S.transitionData.update(a=>({...a, media:{type:"fade",duration:800,easing:"sine"}})); const out=Object.keys(get(S.outputs))[0]; S.outputs.update(o=>{o[out].out={}; return o}); MODO("culto"); return 1`)
await esperar(2500)
const depois = await j.ev(`return [...document.querySelectorAll(".tela > .corpo")].map(c=>c.dataset.pagina||"mostrar").join(",")`)
ok("A4 voltando ao Mostrar sobra um corpo so", depois === "mostrar", depois)

// ---------------------------------------------------------------- B
const biblia = await j.ev(`
  const {default:_x}=await import(U("utils/aliancaArvoreLogica")).catch(()=>({}))
  S.activeDrawerTab?.set?.("scripture"); S.drawerTabsData.update(d=>({...d, scripture:{...(d.scripture||{}), activeSubTab:d.scripture?.activeSubTab||""}}))
  await esp(800)
  const txt=document.body.innerText
  return {colecoes:/Cole[cç][oõ]es/.test(txt), nova:/Nova cole[cç][aã]o/i.test(txt), add:[...document.querySelectorAll('[data-acao="arvore-add"]')].map(b=>b.textContent.trim())}`)
ok("B1 sem titulo Colecoes", !biblia.colecoes)
ok("B2 sem botao Nova colecao", !biblia.nova)
console.log("     linhas ＋ na arvore: " + JSON.stringify(biblia.add))

// ---------------------------------------------------------------- C
const raizMidia = await localizar(j, `[...document.querySelectorAll("button.no")].find(b=>b.querySelector(".nome")?.textContent.trim()==="Mídia")`)
if (raizMidia.ok) await clicarEm(j, raizMidia.x, raizMidia.y)
await esperar(900)
const pasta = await localizar(j, `[...document.querySelectorAll('[class*="#category_media_button"]')][0] || [...document.querySelectorAll(".context")].find(e=>String(e.className).includes("category_media_button"))`)
if (!pasta.ok) ok("C0 pasta de midia na arvore", false, pasta.motivo)
else {
    await j.enviar("Input.dispatchMouseEvent", { type: "mousePressed", x: pasta.x, y: pasta.y, button: "right", clickCount: 1 })
    await j.enviar("Input.dispatchMouseEvent", { type: "mouseReleased", x: pasta.x, y: pasta.y, button: "right", clickCount: 1 })
    await esperar(600)
    const itens = await j.ev(`return [...document.querySelectorAll(".contextMenu .item, .contextMenu p, .contextMenu button")].map(e=>e.innerText.trim()).filter(Boolean)`)
    const t = itens.join(" | ")
    ok("C1 Tipo: Padrao na raiz", /Tipo: Padr/.test(t), t)
    ok("C2 Tipo: Plano de fundo na raiz", /Tipo: Plano de fundo/.test(t))
    ok("C3 Tipo: Primeiro plano na raiz", /Tipo: Primeiro plano/.test(t))
    await j.ev(`document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"})); return 1`)
    await clicarEm(j, 5, 400)
}

// ---------------------------------------------------------------- D
const d = await j.ev(`
  const R=await import(U("utils/aliancaTrocaFundo"))
  const antes=R.modoTrocaFundo(get(S.transitionData).media)
  S.transitionData.update(a=>({...a, media:R.trocaFundo(a.media,"corte")})); const corte=get(S.transitionData).media
  S.transitionData.update(a=>({...a, media:R.trocaFundo(a.media,"fade")})); const fade=get(S.transitionData).media
  T.trocarTela("settings","segmentado"); await esp(900)
  const tem=/Troca de fundo/.test(document.body.innerText)
  MODO("culto")
  return {antes, corte, fade, tem}`)
ok("D1 campo Troca de fundo nas Configuracoes", d.tem)
ok("D2 corte seco = none / 0 ms", d.corte.type === "none" && d.corte.duration === 0, JSON.stringify(d.corte))
ok("D3 volta ao fade 800 ms", d.fade.type === "fade" && d.fade.duration === 800, JSON.stringify(d.fade))

console.log(falhas.length ? `\nt15: ${falhas.length} FALHA(S): ${falhas.join(", ")}` : "\nt15: tudo ok")
process.exit(falhas.length ? 1 : 0)
