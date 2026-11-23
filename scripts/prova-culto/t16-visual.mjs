// Cabine-6, fatia V1 (Visual). Fumaca contra o Show de dev (CDP), perfil de teste. Sem cliques forcados.
//   node scripts/prova-culto/t16-visual.mjs            (passo 1: A..E; deixa o app aberto)
//   node scripts/prova-culto/t16-visual.mjs reaberto   (passo 2, depois de fechar pelo X e reabrir: F)
//   FS_PRINTS=<pasta> grava os prints (pagina Visual, pilula, linha de origem)
//   A  migracao: "Culto padrao" existe e esta valendo
//   B  Configuracoes > Visual: tabela saidas x [Musica e avisos, Biblia] + campo do retorno
//   C  escolher modelo na Musica de uma saida: style.template muda; linha de origem em Mostrar mostra; pilula troca na hora sem slide no ar;
//      com slide no ar so entra no proximo slide
//   D  estilo dividido: faixa laranja + "Criar estilo proprio e usar"
//   E  Descartar nao desfaz o Visual; trocar Visual nao conta como "nao salvo"
//   F  fechar e reabrir: Visuais e o ativo persistem (passo 2)
import { writeFileSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { abrir, clicarEm, esperar, localizar, tecla } from "./lib.mjs"

const PRINTS = process.env.FS_PRINTS || ""
const ESTADO = join(PRINTS || ".", "t16-estado.json")
const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal", { buffer: true })
await j.enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await esperar(800)
const foto = async (nome) => PRINTS && console.log("     print: " + (await j.foto(join(PRINTS, nome))))
const clicar = async (nome, expr) => {
    const l = await localizar(j, expr)
    ok("clique: " + nome, l.ok, l.motivo)
    if (l.ok) await clicarEm(j, l.x, l.y)
    await esperar(500)
    return l.ok
}
/**
 * escolhe a opcao `rotulo` num <select>: valor + evento `change` (o mesmo que o popup nativo dispara). Nao da para usar as setas: o
 * keydown de SettingsTabs (janela) toma ArrowUp/ArrowDown mesmo com o <select> focado e troca a pagina de Configuracoes.
 */
async function escolherNoSelect(seletor, rotulo) {
    const r = await j.ev(`const s=document.querySelector(${JSON.stringify(seletor)}); if(!s) return false; const o=[...s.options].find(o=>o.textContent.trim()===${JSON.stringify(rotulo)}); if(!o) return false
      s.focus(); s.value=o.value; s.dispatchEvent(new Event("change",{bubbles:true})); await esp(600); return true`)
    return r
}
const estado = `const sp=get(S.special); const o=get(S.outputs); const st=get(S.styles)
  return {vis:(sp.aliancaVisuais||[]).map(v=>({id:v.id,nome:v.nome,saidas:v.saidas})), ativo:sp.aliancaVisualAtivo,
    saidas:Object.fromEntries(Object.entries(o).map(([k,x])=>[k,{nome:x.name,estilo:x.style||"",tpl:st[x.style]?.template||null,tplB:st[x.style]?.templateScripture||null}])),
    naoSalvas:null, dataPath:get(S.dataPath)}`
const ler = () => j.ev(estado)
const pilula = () => j.ev(`const p=document.querySelector('[data-acao="visual-pilula"]'); return p?{texto:p.innerText.replace(/\\s+/g," ").trim(), proximo:!!p.querySelector('[data-acao="visual-pilula-proximo"]'), problema:!!p.querySelector('[data-acao="visual-pilula-problema"]')}:null`)
const origem = () => j.ev(`const o=document.querySelector('[data-acao="origem-modelo"]'); return o?{coluna:o.dataset.coluna, texto:o.innerText.replace(/\\s+/g," ").trim(), prob:[...o.querySelectorAll(".og.prob")].map(e=>e.innerText.replace(/\\s+/g," ").trim())}:null`)
const pendentes = () => j.ev(`const p=document.querySelector('[data-acao="pagina-pendentes"]'); const d=document.querySelector('[data-acao="pagina-descartar"]'); return {texto:p?.innerText||"", descartarLigado:d?!d.disabled:null}`)
async function abrirVisual() {
    await clicar("pilula", `document.querySelector('[data-acao="visual-pilula"]')`)
    await foto("pilula-menu.png")
    await clicar("Editar visuais", `document.querySelector('[data-acao="visual-editar"]')`)
    await esperar(900)
}
const fecharPagina = () => clicar("Fechar Configuracoes", `document.querySelector('[data-acao="pagina-fechar"]')`)

const dp = await j.ev(`return get(S.dataPath)`)
ok("0 dataPath e o do perfil de teste (nunca Documents/AliancaShow)", /verif-visual|prova-perfil|Temp/i.test(dp) && !/Documents[\\/]AliancaShow/i.test(dp), dp)
if (falhas.length) process.exit(1)

if (process.argv[2] === "reaberto") {
    // ---------------------------------------------------------------- F
    const antes = existsSync(ESTADO) ? JSON.parse(readFileSync(ESTADO, "utf8")) : null
    const agora = await ler()
    ok("F1 a lista de Visuais voltou igual", !!antes && JSON.stringify(agora.vis) === JSON.stringify(antes.vis), JSON.stringify(agora.vis))
    ok("F2 o ativo voltou", !!antes && agora.ativo === antes.ativo, `${agora.ativo} (antes ${antes?.ativo})`)
    ok("F3 os modelos das saidas voltaram", !!antes && JSON.stringify(agora.saidas) === JSON.stringify(antes.saidas), JSON.stringify(agora.saidas))
    ok("F4 nao migrou de novo (um so Culto padrao)", agora.vis.filter((v) => v.nome === "Culto padrão").length === 1)
    const p = await pilula()
    ok("F5 pilula mostra o ativo", !!p && p.texto.includes(agora.vis.find((v) => v.id === agora.ativo)?.nome || "?"), JSON.stringify(p))
    console.log(falhas.length ? `\nt16 (reaberto): ${falhas.length} FALHA(S): ${falhas.join(", ")}` : "\nt16 (reaberto): tudo ok")
    process.exit(falhas.length ? 1 : 0)
}

// ---------------------------------------------------------------- A
const e0 = await ler()
ok("A1 migracao: existe 'Culto padrão'", e0.vis.some((v) => v.nome === "Culto padrão"), JSON.stringify(e0.vis))
ok("A2 'Culto padrão' esta valendo", e0.vis.find((v) => v.nome === "Culto padrão")?.id === e0.ativo)
ok("A3 pilula diz Culto padrao", (await pilula())?.texto.includes("Culto padrão"), JSON.stringify(await pilula()))

// cenario: uma 2a saida normal (desligada, sem estilo) e um retorno (desligado) com um leiaute de palco. Fora de Configuracoes (nao conta no rascunho).
await j.ev(`
  S.stageShows.update(a=>({...a, t16leiaute:{name:"Retorno t16", items:{}, settings:{}}}))
  S.outputs.update(a=>({...a, t16b:{name:"Telão 2", enabled:false, active:false, out:{}, show:{}, bounds:{x:0,y:0,width:1920,height:1080}, screen:null},
    t16r:{name:"Retorno", enabled:false, active:false, stageOutput:"t16leiaute", out:{}, show:{}, bounds:{x:0,y:0,width:1920,height:1080}, screen:null}}))
  await esp(600); return 1`)

// ---------------------------------------------------------------- B
await abrirVisual()
const pag = await j.ev(`const p=document.querySelector('[data-acao="visual-pagina"]'); if(!p) return null
  const t=p.querySelector('[data-acao="visual-tabela"]')
  return {h:[...t.querySelectorAll(".h")].map(e=>e.textContent.trim()), saidas:[...t.querySelectorAll(".sd b")].map(e=>e.textContent.trim()),
    casas:[...t.querySelectorAll("[data-casa]")].map(e=>e.dataset.casa), retorno:!!p.querySelector('[data-acao="visual-retorno"] select'),
    secRetorno:/LEIAUTE DO RETORNO/.test(p.innerText), titulo:document.querySelector(".tela h2, h2")?.textContent?.trim()}`)
ok("B1 pagina Visual aberta", !!pag, JSON.stringify(pag))
ok("B2 colunas Musica e avisos + Biblia", JSON.stringify(pag?.h) === JSON.stringify(["MÚSICA E AVISOS", "BÍBLIA"]), JSON.stringify(pag?.h))
ok("B3 uma linha por saida normal (Primary, Telao 2)", pag?.saidas.includes("Primary") && pag?.saidas.includes("Telão 2") && pag.casas.length === 4, JSON.stringify(pag?.saidas))
ok("B4 campo do leiaute do retorno", pag?.secRetorno && pag?.retorno)
await foto("visual-pagina.png")

// ---------------------------------------------------------------- C (escolher modelo) + E (nao salvo)
const pend0 = await pendentes()
const escolheu = await escolherNoSelect('[data-casa="default:musica"] select', "Brackets")
ok("C1 seletor da Musica do Primary achou a opcao", escolheu)
// Primary aponta para um estilo que nao existe no perfil: a tela pergunta antes de criar estilo proprio
const pergunta = await j.ev(`const f=document.querySelector('[data-acao="visual-estilo-proprio"]'); return f?f.innerText.replace(/\\s+/g," "):null`)
console.log("     pergunta: " + pergunta)
if (pergunta) await clicar("Criar estilo proprio e usar (Primary)", `document.querySelector('[data-acao="visual-estilo-proprio-sim"]')`)
await esperar(600)
const e1 = await ler()
ok("C2 style.template do Primary = brackets", e1.saidas.default.tpl === "brackets", JSON.stringify(e1.saidas.default))
ok("C3 o Visual guarda a casa", e1.vis.find((v) => v.id === e1.ativo)?.saidas.default?.musica === "brackets")
const pend1 = await pendentes()
console.log("     nao salvo antes/depois: " + JSON.stringify(pend0) + " / " + JSON.stringify(pend1))
await foto("visual-pagina-brackets.png")

// E: mudar so uma casa do Visual nao conta como "nao salvo"; depois mudar o retorno tambem nao
const e1b = await escolherNoSelect('[data-retorno="t16r"] select', "Retorno t16")
const pendR = await pendentes()
ok("E1 escolher modelo (com estilo proprio criado pelo Visual) nao acende 'nao salvo'", pend1.texto === pend0.texto, JSON.stringify(pend1))
ok("E1b mexer no leiaute do retorno nao acende 'nao salvo'", e1b && pendR.texto === pend0.texto, JSON.stringify(pendR))
// "+ Novo visual" (para a pilula ter dois)
await clicar("+ Novo visual", `document.querySelector('[data-acao="visual-novo"]')`)
const pendN = await pendentes()
ok("E2 criar Visual nao acende 'nao salvo'", pendN.texto === pend0.texto, JSON.stringify(pendN))
// trocar o ativo pela pagina e voltar (Usar este agora)
await clicar("Usar este agora (Visual novo)", `[...document.querySelectorAll('[data-acao="visual-usar"]')][0]`)
const eTroca = await ler()
ok("E3 'Usar este agora' troca e aplica (Primary sem modelo)", eTroca.vis.find((v) => v.id === eTroca.ativo)?.nome === "Visual novo" && !eTroca.saidas.default.tpl, JSON.stringify(eTroca.saidas.default))
ok("E4 trocar o ativo nao acende 'nao salvo'", (await pendentes()).texto === pend0.texto, JSON.stringify(await pendentes()))
// mudanca de outra opcao (faz o Descartar ter o que desfazer) e Descartar
await j.ev(`S.special.update(s=>({...s, t16outra:true})); await esp(400); return 1`)
const pendO = await pendentes()
console.log("     depois de mudar outra opcao: " + JSON.stringify(pendO))
const visAntesDesc = JSON.stringify((await ler()).vis)
if (pendO.descartarLigado) await clicar("Descartar", `document.querySelector('[data-acao="pagina-descartar"]')`)
else ok("E5 Descartar ligado depois de mudar outra opcao", false, JSON.stringify(pendO))
await esperar(800)
const eD = await ler()
const outra = await j.ev(`return get(S.special).t16outra ?? null`)
ok("E5 Descartar desfez a outra opcao", outra === null || outra === undefined, String(outra))
ok("E6 Descartar NAO desfez o Visual (lista e ativo)", JSON.stringify(eD.vis) === visAntesDesc && eD.vis.find((v) => v.id === eD.ativo)?.nome === "Visual novo", JSON.stringify({ ativo: eD.ativo, n: eD.vis.length }))
ok("E7 Descartar NAO desfez o estilo proprio criado", !!eD.saidas.default.estilo && eD.saidas.default.estilo !== "default", JSON.stringify(eD.saidas.default))
await fecharPagina()

// ---------------------------------------------------------------- C (pilula sem slide no ar; linha de origem)
const pegaVisual = async (nome) => {
    await clicar("pilula", `document.querySelector('[data-acao="visual-pilula"]')`)
    await clicar("pilula: " + nome, `[...document.querySelectorAll('[data-acao="visual-pilula-menu"] [role=menuitemradio]')].find(b=>b.innerText.includes(${JSON.stringify(nome)}))`)
    await esperar(400)
}
await j.ev(`const s=Object.values(get(S.shows)).length; const id=Object.keys(get(S.shows)).find(k=>get(S.shows)[k].name==="Aos Teus Pés"); S.activeShow.set({id,type:"show"}); await esp(1200); return id`)
await pegaVisual("Culto padrão")
const eC = await ler()
ok("C4 pilula sem slide no ar: Culto padrao entra na hora", eC.saidas.default.tpl === "brackets" && !(await pilula()).proximo, JSON.stringify(eC.saidas.default))
const og = await origem()
ok("C5 linha de origem mostra Primary: Brackets", !!og && /Primary: Brackets/.test(og.texto) && og.coluna === "musica", JSON.stringify(og))
await foto("origem-brackets.png")
await clicar("pilula", `document.querySelector('[data-acao="visual-pilula"]')`)
await foto("pilula-aberta.png")
await tecla(j, "Escape")

// ---------------------------------------------------------------- C (com slide no ar: entra no proximo slide)
await clicar("1o slide (no ar)", `document.querySelectorAll("#showArea .slide.context")[0]`)
await esperar(800)
const noAr = await j.ev(`return get(S.outputs).default?.out?.slide||null`)
ok("C6 ha slide no ar no Primary", !!noAr, JSON.stringify(noAr))
await pegaVisual("Visual novo")
const eP = await ler()
const pp = await pilula()
ok("C7 com slide no ar: modelo NAO muda ainda", eP.saidas.default.tpl === "brackets", JSON.stringify(eP.saidas.default))
ok("C8 pilula avisa 'vale no proximo slide'", pp?.proximo, JSON.stringify(pp))
const ogP = await origem()
console.log("     origem pendente: " + JSON.stringify(ogP))
await foto("pilula-proximo-slide.png")
await clicar("2o slide", `document.querySelectorAll("#showArea .slide.context")[1]`)
await esperar(800)
const eP2 = await ler()
ok("C9 proximo slide: o Visual novo entrou (sem modelo)", !eP2.saidas.default.tpl, JSON.stringify(eP2.saidas.default))
ok("C10 pilula sem aviso depois do slide", !(await pilula())?.proximo)
const ogV = await origem()
ok("C11 origem: Primary como o slide foi feito", /Primary: como o slide foi feito/.test(ogV?.texto || ""), JSON.stringify(ogV))
await pegaVisual("Culto padrão")
ok("C12a voltando ao Culto padrao com slide no ar: ainda sem modelo", !(await ler()).saidas.default.tpl)
// proximo slide pela tecla real (← → avancam)
await tecla(j, "ArrowRight")
await esperar(800)
ok("C12 de volta ao Culto padrao apos o proximo slide", (await ler()).saidas.default.tpl === "brackets")
await j.ev(`const o=Object.keys(get(S.outputs)); S.outputs.update(a=>{for(const k of o) if(a[k].out) a[k].out={...a[k].out, slide:null}; return a}); await esp(400); return 1`)

// ---------------------------------------------------------------- D (estilo dividido)
// Telao 2 passa a dividir o estilo do Primary (fora de Configuracoes, como faria "Estilo da saida")
await j.ev(`const st=get(S.outputs).default.style; S.outputs.update(a=>{a.t16b.style=st; return a}); await esp(500); return st`)
await abrirVisual()
const dv = await escolherNoSelect('[data-casa="t16b:musica"] select', "Parentheses")
ok("D1 seletor da Musica do Telao 2 respondeu", dv)
const fx = await j.ev(`const f=document.querySelector('[data-acao="visual-estilo-proprio"]'); if(!f) return null
  const cs=getComputedStyle(f); const b=f.querySelector('[data-acao="visual-estilo-proprio-sim"]')
  return {texto:f.innerText.replace(/\\s+/g," "), bg:cs.backgroundColor, sombra:cs.boxShadow, botao:b?.textContent.trim(), laranja:getComputedStyle(document.documentElement).getPropertyValue("--luz-laranja").trim()}`)
ok("D2 faixa do estilo dividido aparece", !!fx && /divide o estilo/.test(fx.texto), JSON.stringify(fx))
ok("D3 botao 'Criar estilo próprio e usar'", fx?.botao === "Criar estilo próprio e usar")
const problemasCel = await j.ev(`return [...document.querySelectorAll('[data-acao="visual-tabela"] .cel.prob')].map(e=>({casa:e.dataset.casa, contorno:getComputedStyle(e).boxShadow}))`)
console.log("     celulas em laranja: " + JSON.stringify(problemasCel))
await foto("visual-estilo-dividido.png")
const antesD = await ler()
ok("D4 antes do sim nada foi escrito no estilo dividido", antesD.saidas.default.tpl === "brackets" && antesD.vis.find((v) => v.id === antesD.ativo).saidas.t16b?.musica !== "parentheses", JSON.stringify(antesD.saidas))
await clicar("Criar estilo proprio e usar (Telao 2)", `document.querySelector('[data-acao="visual-estilo-proprio-sim"]')`)
await esperar(700)
const eD2 = await ler()
ok("D5 Telao 2 com estilo proprio e Parentheses; Primary continua Brackets", eD2.saidas.t16b.estilo !== eD2.saidas.default.estilo && eD2.saidas.t16b.tpl === "parentheses" && eD2.saidas.default.tpl === "brackets", JSON.stringify(eD2.saidas))
await foto("visual-pagina-final.png")
await fecharPagina()
// o cenario continua, para o passo 2 conferir a persistencia
const fim = await ler()
if (PRINTS) writeFileSync(ESTADO, JSON.stringify(fim, null, 1))
console.log(falhas.length ? `\nt16: ${falhas.length} FALHA(S): ${falhas.join(", ")}` : "\nt16: tudo ok (agora feche pelo X, reabra e rode com 'reaberto')")
process.exit(falhas.length ? 1 : 0)
