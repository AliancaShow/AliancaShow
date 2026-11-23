// T-1a-17 (1a, Q9): o telao nao responde. Por CDP o `set` e o `update` do store `outputDisplay` viram funcoes que nao fazem nada (window.api vem de
// contextBridge e nao aceita embrulho: este e o jeito de provocar a falta de resposta). Preparar, ⋯, "Ligar o telão": a janela de saida de dev abre de
// verdade, o store nao muda, e depois de ESPERA_STORE_MS o item mostra o texto persistente e o console tem a linha.
// Restaurar set/update e chamar o `set` original com true: o item passa a "Desligar o telão" na hora, sem reabrir o menu.
//   bash scripts/prova-culto/restaurar.sh && bash scripts/prova-culto/reiniciar.sh ; node scripts/prova-culto/t1a-saida-sem-resposta.mjs ; restaurar.sh
import { abrir, clicarEm, desligarSaidaNoCulto, esperar, instalarContagem, irParaModo, lerContagem, localizar, PREPARAR_SAIDA, prepararCulto, recarregar, relato } from "./t1aLib.mjs"
// ESPERA_STORE_MS de aliancaSaidaMenuLogica.ts (1500 ms, M1); o teste le o valor do proprio app para nao divergir
const ESPERA_STORE_MS = 1500

const r = relato("t1a-saida-sem-resposta")
const j = await abrir("principal")
await recarregar(j)
await j.ev(PREPARAR_SAIDA)
await prepararCulto(j)
await irParaModo(j, "Preparar")
await instalarContagem(j)
await j.ev(`window.__linhas=[]; const ce=console.error; console.error=(...a)=>{ window.__linhas.push(a.map(String).join(" ")); ce.apply(console,a) };
window.__setOrig=S.outputDisplay.set; window.__updOrig=S.outputDisplay.update; S.outputDisplay.set=()=>{}; S.outputDisplay.update=()=>{}; return 1`)

const BOTAO = `document.querySelector(".prepararBarra .menuBotao")`
const ITEM = `document.querySelector('[role=menuitem][data-item="saida"]')`
const lerItem = () => j.ev(`const i=${ITEM}; return i?{estado:i.dataset.estado, texto:i.innerText.trim(), dis:i.getAttribute("aria-disabled")}:null`)
const b = await localizar(j, BOTAO)
await clicarEm(j, b.x, b.y)
await esperar(300)
let it = await lerItem()
r.ok("1.1 o item mostra 'Ligar o telão'", it?.estado === "desligado", JSON.stringify(it))
const item = await localizar(j, ITEM)
await clicarEm(j, item.x, item.y)
await esperar(500)
it = await lerItem()
r.ok("1.2 logo depois do clique o item esta em 'Ligando…'", it?.estado === "ligando", JSON.stringify(it))
await esperar(ESPERA_STORE_MS + 400)
it = await lerItem()
r.ok("1.3 sem resposta, o item mostra 'O telão não respondeu. Use o botão do Culto.' (e nao volta a 'Ligar')", it?.estado === "semResposta" && it.texto === "O telão não respondeu. Use o botão do Culto.", JSON.stringify(it))
const linhas = await j.ev(`return window.__linhas.filter(l=>l.includes("o telao nao respondeu"))`)
r.ok("1.4 o console tem a linha '[AliancaShow] menu da saida: o telao nao respondeu'", linhas.length === 1, JSON.stringify(linhas))
const antes = (await lerContagem(j)).canais.filter((k) => k.includes("TOGGLE_OUTPUTS")).length
await esperar(5000)
const depois = (await lerContagem(j)).canais.filter((k) => k.includes("TOGGLE_OUTPUTS")).length
r.ok("1.5 em 5 s nao ha OUTPUT:TOGGLE_OUTPUTS a mais (sem nova tentativa)", depois === antes && antes === 1, `${antes} -> ${depois}`)
it = await lerItem()
r.ok("1.6 o texto e persistente (segue la depois dos 5 s)", it?.estado === "semResposta", JSON.stringify(it))
r.ok("1.7 nenhuma falha interna na linha de avisos (4.4: a falta de resposta pode ser do ambiente)", (await j.ev(`return !(document.querySelector('[data-acao=aviso-linha]')?.textContent||'').includes('Falha interna')`)) === true, "falha interna na linha")

// o mundo responde: restaura e chama o set original com true
await j.ev(`S.outputDisplay.set=window.__setOrig; S.outputDisplay.update=window.__updOrig; S.outputDisplay.set(true); await esp(500); return 1`)
it = await lerItem()
r.ok("2.1 com o store respondendo o item passa a 'Desligar o telão' na hora, sem reabrir o menu", it?.estado === "ligado" && it.texto === "Desligar o telão", JSON.stringify(it))

// limpeza: fecha o menu, volta ao Culto e desliga pelo botao do Culto (a janela abriu de verdade)
await j.ev(`S.activePopup.set(null); return 1`)
await irParaModo(j, "Culto")
await esperar(900)
await desligarSaidaNoCulto(j)
j.fechar()
r.fim()
