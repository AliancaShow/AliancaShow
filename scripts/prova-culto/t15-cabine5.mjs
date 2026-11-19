// Cabine-5 (19/nov, PC da igreja). Fumaca contra o Show de dev (CDP). Sem cliques forcados.
//   node scripts/prova-culto/t15-cabine5.mjs
//   A  Configuracoes com fundo no ar e fade longo: enquanto o fade de saida da previa do No ar roda, so UM corpo aparece e ele tem a altura toda
//   B  arvore da Biblia sem "Colecoes"/"Nova colecao"; "＋ biblia" no fim
//   C  biblioteca de midia: a pasta do disco virou categoria; nenhuma pasta do disco na arvore; tirar da biblioteca + Ctrl+Z; offline aparece
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
// a migracao roda ao abrir a Midia (o perfil tem `media` cheio: nao espera os 15 s)
let mig = null
for (let i = 0; i < 20 && !mig?.cat; i++) {
    await esperar(1000)
    mig = await j.ev(`const t=get(S.mediaTags); const cat=Object.entries(t).find(([,x])=>x.aliancaPasta && (x.aliancaDeDisco||[]).length); const m=get(S.media); const f1=Object.keys(m).find(k=>/f1\\.png$/i.test(k)); return {cat:cat?cat[0]:null, nome:cat?cat[1].name:null, f1, tagsF1:f1?m[f1].tags:null}`)
}
ok("C1 a pasta do disco do perfil virou categoria", !!mig?.cat, JSON.stringify(mig))
ok("C2 f1 entrou na biblioteca, na categoria", !!mig?.tagsF1?.includes("alianca:bib") && mig.tagsF1.includes(mig.cat), JSON.stringify(mig?.tagsF1))
ok("C3 nenhuma pasta do disco na arvore", (await j.ev(`return document.querySelectorAll('[class*="#category_media_button"]').length`)) === 0)
ok("C4 linha '＋ importar mídia' na arvore", (await j.ev(`return [...document.querySelectorAll('[data-acao="arvore-add"]')].some(b=>/importar m/.test(b.textContent))`)) === true)
// tirar da biblioteca e Ctrl+Z
const tirar = await j.ev(`
  const B=await import(U("utils/aliancaBibliotecaMidia")); const H=await import(U("components/helpers/history"))
  const f1=${JSON.stringify(mig?.f1 || "")}
  const n=B.tirarDaBiblioteca([f1]); await esp(300); const depois=get(S.media)[f1]?.tags||[]
  H.undo(); await esp(500); const desfeito=get(S.media)[f1]?.tags||[]
  return {n, depois, desfeito}`)
ok("C5 tirar da biblioteca: sai a marca e a categoria", tirar.n === 1 && !tirar.depois.includes("alianca:bib") && !tirar.depois.includes(mig?.cat), JSON.stringify(tirar))
ok("C6 Ctrl+Z repoe na categoria", tirar.desfeito.includes("alianca:bib") && tirar.desfeito.includes(mig?.cat), JSON.stringify(tirar.desfeito))
// offline: um arquivo que nao existe importado na raiz aparece como OFFLINE (nao some)
const off = await j.ev(`
  const B=await import(U("utils/aliancaBibliotecaMidia")); const r=Object.values(get(S.mediaFolders))[0].path
  B.importarCaminhos([r+"/sumiu-de-proposito.mp4"], null)
  S.activeDrawerTab.set("media"); S.drawerTabsData.update(a=>{a.media={...(a.media||{}),activeSubTab:"all"};return a}); await esp(4000)
  const c=[...document.querySelectorAll('[data-acao=midia-cartao]')].find(x=>x.innerText.includes("sumiu-de-proposito"))
  return {existe:!!c, estado:c?.dataset.estado||null, texto:c?.innerText||""}`)
ok("C7 offline aparece na raiz (nao some)", off.existe, JSON.stringify(off))
ok("C8 offline marcado como OFFLINE", off.estado === "falta" && /OFFLINE/.test(off.texto), JSON.stringify(off))

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
