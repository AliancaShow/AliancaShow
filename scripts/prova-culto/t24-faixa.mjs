// H1 (fatia R3), refeita na cabine 6 (Andre, 23/nov: "tem 2 barras de alerta"): a falha alta NAO tem mais faixa propria. Ela vira ERRO na
// linha de avisos do pe (AliancaAvisos), que ja tem lugar no leiaute: nada fora da linha se mexe, ha uma barra so, o x dispensa e a mesma
// falha volta (com as vezes) se acontecer de novo. Abrir/fechar os ultimos avisos: botao com seta e clique no texto; o Esc nao mexe na lista.
//
//   FS_PERFIL_DIR=... bash scripts/prova-culto/restaurar.sh && bash scripts/prova-culto/reiniciar.sh   (app limpo, perfil de prova)
//   node scripts/prova-culto/t24-faixa.mjs          (sai com 1 em qualquer falha, imprimindo o passo; depois, restaurar.sh de novo)
//
// Cliques e teclas sao REAIS (Input.dispatch*), nunca force. O app e o de dev com o perfil de prova; nada aqui escreve no Sirvo.
import { abrir, clicarEm, esperar, localizar, tecla } from "./lib.mjs"
import { VARREDURA } from "./aparencia/fva-lib.mjs"

const falhas = []
const ok = (passo, cond, detalhe = "") => {
    console.log(`${cond ? "ok   " : "FALHA"} ${passo}${cond ? "" : "  <- " + detalhe}`)
    if (!cond) falhas.push(`${passo}: ${detalhe}`)
    return cond
}

const j = await abrir("principal")
const ACENDE = `const f=await import(U("utils/aliancaFalha")); f.falhaAlta("teste-cdp", new Error("x")); return 1`
const LINHA = `document.querySelector("[data-acao=aviso-linha]")`
const ESTADO = `const l=${LINHA}; const h=document.querySelector("[data-acao=avisos-historico]"); const lista=document.querySelector("[data-acao=avisos-lista]");
return {nivel:l?.dataset.nivel||"", txt:l?.querySelector("[data-acao=aviso-texto]")?.textContent||"", x:!!l?.querySelector("[data-acao=aviso-dispensar]"),
 faixas:document.querySelectorAll(".faixaFalha").length, aberto:h?.getAttribute("aria-expanded"), seta:h?.querySelector(".seta")?.textContent||"", titulo:h?.title||"",
 lista:lista?Math.round(lista.getBoundingClientRect().height):0}`

async function recarregar() {
    await j.avaliar("location.reload(); return 1").catch(() => {})
    await esperar(2000)
    for (let t = 0; t < 60 && !(await j.avaliar('return !!document.querySelector("[data-acao=aviso-linha]")').catch(() => false)); t++) await esperar(1000)
    await esperar(1500)
}
// comeca sempre de um app sem falha (uma rodada anterior deixa a falha guardada ate o app recarregar)
await recarregar()

// ---------------------------------------------------------------- 1. a falha entra na linha; nada fora dela se mexe; uma barra so
await j.ev(`S.activePopup.set(null); MODO("culto"); document.activeElement?.blur?.(); await esp(600); return 1`)
const DA_LINHA = /^(span|button)\.(ponto|texto|vezes|mais|fechar|alterna|seta|hist)\b/
const fora = (l) => l.filter((e) => !DA_LINHA.test(e.tag) && !e.sig.includes("data-regiao=avisos") && !e.sig.includes("data-acao=aviso-linha"))
const varrer = async () => JSON.parse(await j.ev(VARREDURA)).els
const antes = fora(await varrer())
await j.ev(ACENDE)
await esperar(300)
const depois = fora(await varrer())
let e = await j.ev(ESTADO)
ok("1.1 a falha e ERRO na linha de avisos, com o texto da faixa antiga", e.nivel === "erro" && e.txt === "Falha interna do AliançaShow: teste-cdp (1×). Avise quem cuida do programa.", JSON.stringify(e))
ok("1.2 uma barra so (nao existe .faixaFalha)", e.faixas === 0, `${e.faixas} faixas`)
ok("1.3 o mesmo numero de elementos fora da linha", antes.length === depois.length, `${antes.length} antes, ${depois.length} depois`)
const difs = []
for (let i = 0; i < Math.min(antes.length, depois.length); i++) if (JSON.stringify(antes[i].rect) !== JSON.stringify(depois[i].rect)) difs.push(`${antes[i].tag} ${JSON.stringify(antes[i].rect)} -> ${JSON.stringify(depois[i].rect)}`)
ok("1.4 todo rect fora da linha igual, par a par", difs.length === 0, `${difs.length} diferem; 1o: ${difs[0]}`)
ok("1.5 tem x (e informacao de defeito: dispensavel)", e.x, "sem x")

// ---------------------------------------------------------------- 2. x dispensa; a mesma falha volta somando
const x = await localizar(j, `document.querySelector("[data-acao=aviso-dispensar]")`)
ok("2.0 o x esta livre para o clique", x.ok, x.motivo)
if (x.ok) await clicarEm(j, x.x, x.y)
await esperar(300)
e = await j.ev(ESTADO)
ok("2.1 o x tirou a falha da linha", !e.txt.includes("Falha interna"), e.txt)
await j.ev(ACENDE)
await esperar(300)
e = await j.ev(ESTADO)
ok("2.2 a mesma falha de novo volta com (2×)", e.nivel === "erro" && e.txt.includes("teste-cdp (2×)"), e.txt)

// ---------------------------------------------------------------- 3. abrir/fechar os ultimos avisos: obvio, e nunca pelo Esc
ok("3.0 fechado: seta ▴, aria-expanded=false, titulo Mostrar", e.aberto === "false" && e.seta === "▴" && e.titulo === "Mostrar últimos avisos" && e.lista === 0, JSON.stringify(e))
const txt = await localizar(j, `document.querySelector("[data-acao=aviso-texto]")`)
ok("3.1 o texto da linha esta livre para o clique", txt.ok, txt.motivo)
if (txt.ok) await clicarEm(j, txt.x, txt.y)
await esperar(300)
e = await j.ev(ESTADO)
ok("3.2 clique no texto abre: seta ▾, aria-expanded=true, titulo Esconder, lista entre 72 e 300 px", e.aberto === "true" && e.seta === "▾" && e.titulo === "Esconder últimos avisos" && e.lista >= 72 && e.lista <= 300, JSON.stringify(e))
await tecla(j, "Escape")
await esperar(300)
ok("3.3 o Esc (tecla de panico) nao fecha a lista", (await j.ev(ESTADO)).aberto === "true", "o Esc fechou")
const hist = await localizar(j, `document.querySelector("[data-acao=avisos-historico]")`)
if (hist.ok) await clicarEm(j, hist.x, hist.y)
await esperar(300)
e = await j.ev(ESTADO)
ok("3.4 o botao com a seta fecha", hist.ok && e.aberto === "false" && e.seta === "▴" && e.lista === 0, JSON.stringify({ hist, e }))
const teto = await j.ev(`const {alturaDaListaDeAvisos}=await import(U("utils/aliancaAvisos")); alturaDaListaDeAvisos.set(9999); return 1`)
if (hist.ok) await clicarEm(j, hist.x, hist.y)
await esperar(300)
const alt = await j.ev(`return {lista:Math.round(document.querySelector("[data-acao=avisos-lista]").getBoundingClientRect().height), tela:innerHeight}`)
ok("3.5 a lista aberta nunca passa de 300 px nem de 35% da janela", teto === 1 && alt.lista <= 300 && alt.lista <= Math.floor(alt.tela * 0.35), JSON.stringify(alt))
if (hist.ok) await clicarEm(j, hist.x, hist.y)
await esperar(300)

// ---------------------------------------------------------------- 4. so na principal
const saida = await abrir("saida")
ok("4.1 na janela de saida nao existe linha de avisos nem .faixaFalha", (await saida.ev(`return !document.querySelector("[data-acao=aviso-linha]") && !document.querySelector(".faixaFalha")`)) === true, "a saida tem barra")
saida.fechar()
j.fechar()

if (falhas.length) {
    console.error(`\nt24-faixa: ${falhas.length} passo(s) falharam:\n  - ${falhas.join("\n  - ")}`)
    process.exit(1)
}
console.log("\nt24-faixa: verde")
