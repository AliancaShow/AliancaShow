// Fatia 8 (mensagem pro palco ponta a ponta + modo "so retorno"): fumaca com cliques REAIS (nunca force) contra o Show de dev (CDP,
// FS_CDP_PORTA) e prints 1920x1080. NADA aqui toca o Sirvo: o perfil de prova nao tem chave, entao o envio "conectado" injetado na loja
// volta do main com "Sem chave do Sirvo." sem rede (o contrato do RPC e provado no vitest, com mock).
//   node scripts/prova-culto/t9-palco.mjs <pasta-de-prints>
//   A. sem chave que conduz: caixa desligada com o motivo escrito, Enviar inerte, o modo diz por que nao liga (e nada escreve em outputs)
//   B. com "conduz" injetado: o campo aceita 120 caracteres e o contador acompanha; as validades 1/3/5/10 (padrao 3) selecionam por clique
//   C. Enviar sem chave volta o erro em portugues na linha de estado (que tem altura fixa: nada se desloca)
//   D. modo so retorno: sem retorno configurado nao liga e diz o motivo; com um retorno na loja liga e desliga pelo botao (8b)
//   E. indicador: com o modo ligado na loja, a faixa ambar aparece no topo da coluna No ar e a pilula mostra SO RETORNO; "Desligar" (clique real) volta
//   G. (revisao da fatia 8) o erro NAO esconde a mensagem viva nem o Limpar, e some sozinho em ~6 s; Limpar que falha mantem o botao;
//      estado passageiro (Sirvo fora do ar, sem culto) so aparece na linha de estado e NAO acende a faixa de falha (a chave que so le acende)
//   F. nenhum alvo de clique da coluna se desloca entre o estado em repouso e com texto/erro (a linha de estado e fixa)
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { abrir, clicarEm, esperar, localizar, RECADOS } from "./lib.mjs"

const saida = process.argv[2] || "prints-v2-8"
mkdirSync(saida, { recursive: true })
const falhas = []
const ok = (n, c, x = "") => (console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? " :: " + x : ""}`), c || falhas.push(n))
const j = await abrir("principal", { buffer: true })
const dom = (expr) => j.ev(`return ${expr}`)
async function print(nome, espera = 500) {
    await esperar(espera)
    const d = await j.enviar("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } })
    writeFileSync(join(saida, nome + ".png"), Buffer.from(d.result.data, "base64"))
    console.log("print", nome)
}
const sel = (a) => `document.querySelector('[data-acao=${a}]')`
const clicarAcao = async (a, extra = "") => {
    const r = await localizar(j, `document.querySelector(${JSON.stringify(`[data-acao=${a}]${extra}`)})`)
    if (!r.ok) throw new Error(`${a}: ${r.motivo}`)
    await clicarEm(j, r.x, r.y)
}
const estado = () => dom(`(${sel("aviso-mensagem-palco")}?.textContent||"").trim()`)
const linhaViva = () => dom(`(${sel("estado-mensagem-palco")}?.textContent||"").trim()`)
const temLimpar = () => dom(`!!${sel("limpar-mensagem-palco")}`)
const falhasDaCaixa = () => j.ev(`const F=await import(U("utils/aliancaFalha")); return JSON.stringify(get(F.falhas).filter(f=>f.origem==="mensagem-palco").map(f=>f.mensagem))`)
const textoDe = (a) => dom(`(${sel(a)}?.textContent||"").trim()`)
const posicoes = () => dom(`Object.fromEntries(["mensagem-palco","enviar-mensagem-palco","modo-so-retorno","contador-mensagem"].map(a=>{const r=document.querySelector('[data-acao='+a+']').getBoundingClientRect(); return [a,[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]]}))`)
const saidasJson = () => dom(`JSON.stringify(get(S.outputs))`)

// ---------- estado inicial: restaura o que o teste mexe
await j.ev(`const A=await import(U("utils/aliancaSirvo")); window.__sirvoAntes=JSON.stringify(get(A.sirvo)); return 1`)
await j.ev(`MODO("culto"); await esp(600); ${RECADOS("palco")} return 1`)
const base = await saidasJson()

// ---------- A. sem chave
ok("A. a caixa existe", await dom(`!!${sel("mensagem-palco")}`))
const motivoA = await estado()
ok("A. sem chave: a linha de estado diz o motivo", /chave|culto|Sirvo/i.test(motivoA), motivoA)
ok("A. Enviar inerte sem texto", await dom(`${sel("enviar-mensagem-palco")}.disabled`))
const modoTitulo = await dom(`${sel("modo-so-retorno")}.title`)
ok("A. o botao do modo e inerte (aria-disabled) e o title diz por que", (await dom(`${sel("modo-so-retorno")}.getAttribute("aria-disabled")`)) === "true" && /retorno/i.test(modoTitulo), modoTitulo)
await print("t9-a-sem-chave")
const pos0 = await posicoes()

// ---------- B. com conduz injetado
await j.ev(`const A=await import(U("utils/aliancaSirvo")); A.sirvo.update(e=>({...e,status:"conectado",cultoId:"cult-t9",podeConduzir:true})); await esp(400); return 1`)
ok("B. com conduz: o motivo some", !/chave|conduz|lê o roteiro/i.test(await estado()), await estado())
await clicarAcao("mensagem-palco")
await j.enviar("Input.insertText", { text: "Pastor, faltam cinco minutos para o fim." })
await esperar(200)
ok("B. contador acompanha o texto", (await textoDe("contador-mensagem")) === "40/120", await textoDe("contador-mensagem"))
ok("B. Enviar liga com texto", !(await dom(`${sel("enviar-mensagem-palco")}.disabled`)))
await j.enviar("Input.insertText", { text: "x".repeat(100) })
await esperar(150)
ok("B. o campo para em 120 e o contador fica cheio", (await textoDe("contador-mensagem")) === "120/120" && (await dom(`${sel("contador-mensagem")}.classList.contains("cheio")`)), await textoDe("contador-mensagem"))
ok("B. validade padrao = 3", (await dom(`document.querySelector('[data-acao=duracao-mensagem][aria-pressed=true]').dataset.min`)) === "3")
await clicarAcao("duracao-mensagem", '[data-min="5"]')
ok("B. clicar em 5 seleciona 5", (await dom(`document.querySelector('[data-acao=duracao-mensagem][aria-pressed=true]').dataset.min`)) === "5")
ok("B. so as 4 validades existem", (await dom(`[...document.querySelectorAll('[data-acao=duracao-mensagem]')].map(b=>b.dataset.min).join(",")`)) === "1,3,5,10")
await print("t9-b-texto-120")

// ---------- C. enviar: o erro volta em portugues, sem rede
await clicarAcao("enviar-mensagem-palco")
await esperar(900)
const err = await estado()
ok("C. o erro do envio aparece na linha de estado", /chave/i.test(err), err)
const pos1 = await posicoes()
ok(
    "F. o campo, o Enviar e o modo nao se deslocaram com texto + erro",
    ["mensagem-palco", "enviar-mensagem-palco", "modo-so-retorno"].every((k) => JSON.stringify(pos0[k]) === JSON.stringify(pos1[k])),
    JSON.stringify([pos0, pos1])
)
await print("t9-c-erro")

// ---------- D. modo so retorno
await clicarAcao("modo-so-retorno")
await esperar(300)
const av1 = await estado()
ok("D. sem retorno: nao liga e o motivo aparece escrito", /Nenhum monitor de retorno/.test(av1), av1)
ok("D. o modo segue desligado", (await dom(`${sel("modo-so-retorno")}.getAttribute("aria-pressed")`)) === "false")
await print("t9-d-modo-sem-retorno")
await j.ev(`S.outputs.update(a=>({...a, retorno_t9:{enabled:true,active:false,name:"Retorno t9",color:"#000",bounds:{x:0,y:0,width:1280,height:720},screen:null,stageOutput:"L_t9"}})); await esp(400); return 1`)
await clicarAcao("modo-so-retorno")
await esperar(400)
ok("D. com retorno configurado o modo LIGA (8b: a saida respeita o modo; a prova por caminho esta em t10-retorno)", (await dom(`${sel("modo-so-retorno")}.getAttribute("aria-pressed")`)) === "true")
ok("D. o telao nao foi tocado ao ligar (so o retorno falso mudou)", (await dom(`JSON.stringify(Object.keys(get(S.outputs)).filter(k=>k!=="retorno_t9").map(k=>[k,get(S.outputs)[k].out||null]))`)) === JSON.stringify(Object.keys(JSON.parse(base)).map((k) => [k, JSON.parse(base)[k].out || null])))
await clicarAcao("modo-so-retorno")
await esperar(400)
ok("D. clicar de novo desliga", (await dom(`${sel("modo-so-retorno")}.getAttribute("aria-pressed")`)) === "false")

// ---------- E. indicador (estado forcado na loja: o gesto real so liga depois do ajuste aprovado em output.ts)
// a coluna inteira ANTES da faixa: a faixa ambar nao pode deslocar nada (nem reservar espaco), nem os 38 px que ela ocupava
const colunaAlvos = `[...document.querySelectorAll('[data-acao=tela-principal],[data-acao=modo-so-retorno],[data-acao=mensagem-palco],[data-acao=enviar-mensagem-palco],[data-acao=estado-mensagem-palco]')].map(e=>{const r=e.getBoundingClientRect();return [e.dataset.acao,Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]})`
const antesFaixa = await dom(`JSON.stringify(${colunaAlvos})`)
await j.ev(`const R=await import(U("utils/aliancaSoRetorno")); R.soRetorno.set(true); await esp(400); return 1`)
ok("E. a faixa ambar aparece no topo da coluna No ar", await dom(`!!${sel("faixa-so-retorno")} && ${sel("faixa-so-retorno")}.textContent.includes("SÓ RETORNO")`))
const comFaixa = await dom(`JSON.stringify(${colunaAlvos})`)
ok("E. a faixa NAO desloca a coluna (tela, caixa, Enviar, modo: mesmas posicoes com e sem ela)", antesFaixa === comFaixa, antesFaixa + " != " + comFaixa)
// C3 (cabine 18/nov, contrato mudou): a tarja nao sobrepoe mais o cabecalho: ocupa o LUGAR dele, a mesma faixa de 32 px (a posicao da coluna ja foi provada igual acima)
ok("E. a tarja ocupa a faixa de 32 px do topo (no lugar do cabecalho, em fluxo)", await dom(`getComputedStyle(${sel("faixa-so-retorno")}).position!=="absolute" && Math.round(${sel("topo-no-ar")}.getBoundingClientRect().height)===32`))
ok("E. a pilula mostra SÓ RETORNO", await dom(`${sel("pilula-so-retorno")}?.textContent?.trim()==="SÓ RETORNO"`))
ok("E. o botao ao lado da mensagem esta aceso", (await dom(`${sel("modo-so-retorno")}.getAttribute("aria-pressed")`)) === "true")
await print("t9-e-so-retorno-ligado")
await clicarAcao("desligar-so-retorno")
await esperar(400)
ok("E. Desligar (um clique) tira a faixa e a pilula", await dom(`!${sel("faixa-so-retorno")} && !${sel("pilula-so-retorno")}`))
ok("E. e nada some do telao nem ganha escrita: o desligar so tocou o retorno", (await dom(`JSON.stringify(Object.keys(get(S.outputs)).filter(k=>k!=="retorno_t9").map(k=>[k,get(S.outputs)[k].out||null]))`)) === JSON.stringify(Object.keys(JSON.parse(base)).map((k) => [k, JSON.parse(base)[k].out || null])))

// ---------- G. revisao: erro x viva x Limpar, estado passageiro x faixa de falha
// a mensagem viva entra pelo parafuso da prova (o Sirvo real nao e tocado); o envio continua indo ao main, que sem chave responde "Sem chave do Sirvo."
await j.ev(`const V=await import(U("utils/aliancaMensagemPalcoVista")); const A=await import(U("utils/aliancaSirvo")); V.mensagemSubstituta.set({id:"g1",texto:"Culto acaba em 5 min",ate:new Date(A.sirvoAgora()+180000).toISOString()}); A.sirvo.update(e=>({...e,status:"conectado",cultoId:"cult-t9",podeConduzir:true})); await esp(120); return 1`)
// lida LOGO depois da entrada (M5): sem o relogio ter andado, a contagem nao pode nascer acima da validade escolhida (3:00)
ok("G. a contagem nasce dentro da validade (<= 3:00), mesmo recem-chegada", /no palco · (3:00|2:5[0-9])/.test(await linhaViva()), await linhaViva())
await esperar(1200)
ok("G. a mensagem viva aparece com o Limpar", /Culto acaba em 5 min/.test(await linhaViva()) && (await temLimpar()), await linhaViva())
await print("t9-g1-viva")
await clicarAcao("enviar-mensagem-palco")
await esperar(900)
ok("G. envio recusado: o erro aparece na linha de aviso", /chave/i.test(await estado()), await estado())
ok("G. ...e a mensagem viva e o Limpar CONTINUAM la (o erro nao os esconde)", /Culto acaba em 5 min/.test(await linhaViva()) && (await temLimpar()), await linhaViva())
await print("t9-g2-erro-com-viva")
await clicarAcao("limpar-mensagem-palco")
await esperar(900)
ok("G. Limpar que falha mostra o erro e MANTEM o botao", /chave/i.test(await estado()) && (await temLimpar()), await estado())
await esperar(6600)
ok("G. o erro some sozinho em ~6 s e o Limpar segue ali", (await estado()) === "" && (await temLimpar()), JSON.stringify(await estado()))
await j.ev(`const V=await import(U("utils/aliancaMensagemPalcoVista")); V.mensagemSubstituta.set(undefined); await esp(1300); return 1`)
ok("G. sem mensagem viva a linha da viva esvazia", (await linhaViva()) === "")
// estado passageiro: Sirvo fora do ar -> so a linha de estado, com texto verdadeiro, e a faixa de falha NAO acende
await j.ev(`const A=await import(U("utils/aliancaSirvo")); const F=await import(U("utils/aliancaFalha")); F.falhas.set([]); A.sirvo.update(e=>({...e,status:"caido"})); await esp(400); return 1`)
ok("G. Sirvo fora do ar: a linha de estado diz a verdade", /não está respondendo/.test(await estado()), await estado())
await clicarAcao("mensagem-palco")
await j.enviar("Input.insertText", { text: "Teste passageiro" })
await esperar(200)
await clicarAcao("enviar-mensagem-palco")
await esperar(700)
ok("G. enviar com o Sirvo fora do ar: texto verdadeiro, nada de 'ainda nao ligada'", /não está respondendo/.test(await estado()) && !/ainda não ligada/.test(await estado()), await estado())
ok("G. estado passageiro NAO acende a faixa de falha", (await falhasDaCaixa()) === "[]", await falhasDaCaixa())
await j.ev(`const A=await import(U("utils/aliancaSirvo")); A.sirvo.update(e=>({...e,status:"conectado",cultoId:null})); await esp(400); return 1`)
await clicarAcao("enviar-mensagem-palco")
await esperar(700)
ok("G. sem culto seguido: so a linha de estado, sem faixa", /Nenhum culto/.test(await estado()) && (await falhasDaCaixa()) === "[]", await estado())
// controle positivo: a chave que so le e promessa quebrada e acende
await j.ev(`const A=await import(U("utils/aliancaSirvo")); A.sirvo.update(e=>({...e,status:"conectado",cultoId:"cult-t9",podeConduzir:false})); await esp(400); return 1`)
await clicarAcao("enviar-mensagem-palco")
await esperar(700)
ok("G. chave que so le: ACENDE a faixa de falha (controle positivo)", (await falhasDaCaixa()) !== "[]", await falhasDaCaixa())
await j.ev(`const F=await import(U("utils/aliancaFalha")); F.falhas.set([]); const A=await import(U("utils/aliancaSirvo")); A.sirvo.update(e=>({...e,podeConduzir:true})); await esp(300); return 1`)

// ---------- H. A3 + A2: o texto FICA no campo enquanto a mensagem esta no palco, e a mensagem viva alimenta o item de mensagem do layout de palco
// (uma variavel de texto chamada "Mensagem palco", como a da igreja, num layout de retorno com um item "variavel"). O envio usa o transporte da prova.
const campo = () => dom(`${sel("mensagem-palco")}.value`)
const varTexto = (k) => dom(`get(S.variables)[${JSON.stringify(k)}]?.text ?? null`)
// a previa VISIVEL do retorno (a aba em outras telas; a copia do Preview antigo fica escondida, sem tamanho)
const previaRetorno = () => dom(`([...document.querySelectorAll("#ret_h")].filter(e=>e.getBoundingClientRect().width>0).map(e=>e.innerText).join(" ")).replace(/\\s+/g," ")`)
await j.ev(`const V=await import(U("utils/aliancaMensagemPalcoVista")); const A=await import(U("utils/aliancaSirvo")); V.mensagemSubstituta.set(undefined); const P=await import(U("utils/aliancaMensagemPalcoProva"))
window.__t9ate=0
P.transporteDaProva(async (f,a)=>{ setTimeout(()=>{ if(f==="show_enviar_mensagem_palco") V.mensagemSubstituta.set({id:"h"+Date.now(),texto:a.p_texto,ate:new Date(A.sirvoAgora()+(window.__t9ate||a.p_minutos*60000)).toISOString()}); else V.mensagemSubstituta.set(null) },700); return {ok:true,dados:{}} })
A.sirvo.update(e=>({...e,status:"conectado",cultoId:"cult-t9",podeConduzir:true}))
S.variables.update(v=>({...v, mp_h:{name:"Mensagem palco",type:"text",text:"",enabled:true}}))
S.outputs.update(a=>({...a, ret_h:{enabled:true,active:false,name:"Retorno h",color:"#000",bounds:{x:0,y:0,width:1280,height:720},screen:null,stageOutput:"L_h",out:{}}}))
S.stageShows.update(s=>({...s, L_h:{name:"Retorno h",disabled:false,settings:{color:"#000"},items:{m:{type:"variable",variable:{id:"mp_h"},style:"left:100px;top:300px;width:1700px;height:300px;font-size:90px;color:#fff;",auto:false}}}}))
await esp(600); return 1`)
await j.ev(`const e=document.querySelector('[data-acao=mensagem-palco]'); e.value=""; e.dispatchEvent(new Event("input",{bubbles:true})); await esp(150); return 1`)
await clicarAcao("mensagem-palco")
await j.enviar("Input.insertText", { text: "Pastor, 5 min pro fim" })
await esperar(200)
await j.ev(`const a=[...document.querySelectorAll("[data-acao=outras-telas] [role=tab]")].find(b=>b.textContent.trim()==="Retorno h"); a?.click(); await esp(500); return 1`)
ok("H. antes de enviar nada esta no palco: variavel vazia e a previa sem o texto", (await varTexto("mp_h")) === "" && !/Pastor, 5 min/.test(await previaRetorno()), JSON.stringify([await varTexto("mp_h"), await previaRetorno()]))
await clicarAcao("enviar-mensagem-palco")
await esperar(2200)
ok("H. A3: depois de enviar o texto FICA no campo", (await campo()) === "Pastor, 5 min pro fim", JSON.stringify(await campo()))
ok("H. A3: o campo fica destacado como 'no palco' (classe noar) e a linha diz 'no palco · m:ss'", (await dom(`${sel("mensagem-palco")}.classList.contains("noar")`)) && /no palco · \d:\d\d/.test(await linhaViva()) && !/“/.test(await linhaViva()), await linhaViva())
ok("H. A3: o Limpar esta ali", await temLimpar())
ok("H. A2: a variavel 'Mensagem palco' recebeu o texto", (await varTexto("mp_h")) === "Pastor, 5 min pro fim", String(await varTexto("mp_h")))
ok("H. A2: sirvo_mensagem tambem (o Show cria se nao existe)", (await varTexto("sirvo_mensagem")) === "Pastor, 5 min pro fim", String(await varTexto("sirvo_mensagem")))
ok("H. A2: o layout de palco MOSTRA a mensagem (previa do retorno)", /Pastor, 5 min pro fim/.test(await previaRetorno()), await previaRetorno())
await print("t9-h-no-palco")
await clicarAcao("limpar-mensagem-palco")
await esperar(2000)
ok("H. A3: Limpar esvazia o campo", (await campo()) === "", JSON.stringify(await campo()))
ok("H. A2: Limpar tira a mensagem do layout de palco (variaveis vazias, previa sem o texto)", (await varTexto("mp_h")) === "" && (await varTexto("sirvo_mensagem")) === "" && !/Pastor, 5 min/.test(await previaRetorno()), JSON.stringify([await varTexto("mp_h"), await varTexto("sirvo_mensagem")]))
// expirar sozinha (validade curta forcada na prova): o campo esvazia e o palco limpa
await j.ev(`window.__t9ate=2500; return 1`)
await clicarAcao("mensagem-palco")
await j.enviar("Input.insertText", { text: "Vai expirar" })
await clicarAcao("enviar-mensagem-palco")
await esperar(1800)
ok("H. expirar: com a mensagem no ar o texto fica", (await campo()) === "Vai expirar" && (await varTexto("mp_h")) === "Vai expirar", JSON.stringify([await campo(), await varTexto("mp_h")]))
await esperar(4200)
ok("H. expirar: passou a validade, o campo esvazia sozinho e o palco limpa", (await campo()) === "" && (await varTexto("mp_h")) === "" && !/Vai expirar/.test(await previaRetorno()), JSON.stringify([await campo(), await varTexto("mp_h")]))
await j.ev(`const V=await import(U("utils/aliancaMensagemPalcoVista")); (await import(U("utils/aliancaMensagemPalcoProva"))).transporteDaProva(null); V.mensagemSubstituta.set(undefined); S.outputs.update(a=>{delete a.ret_h; return a}); S.stageShows.update(s=>{delete s.L_h; return s}); S.variables.update(v=>{delete v.mp_h; delete v.sirvo_mensagem; return v}); await esp(400); return 1`)

// ---------- limpeza: devolve a loja ao que era
await j.ev(`S.outputs.update(a=>{delete a.retorno_t9; return a}); const A=await import(U("utils/aliancaSirvo")); A.sirvo.set(JSON.parse(window.__sirvoAntes)); await esp(400); return 1`)
ok("limpeza: a loja de saidas voltou ao que era", (await saidasJson()) === base)
j.fechar()
console.log(falhas.length ? `\n${falhas.length} falha(s): ${falhas.join(" | ")}` : "\nmensagem pro palco e modo so retorno: ok")
process.exit(falhas.length ? 1 : 0)
