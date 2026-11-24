// Teste real do vídeo na cabine (24/nov, "Roteiro do teste real"): mede o APP de verdade (não o POC) tocando um vídeo de fundo nas saídas.
// Usa o app de dev aberto sobre um PERFIL DE TESTE com CDP em 9222 (nunca os dados da igreja). Roteiro: docs/passagem/referencia/roteiro-video-real.md
//
//   node scripts/prova-culto/medir-video.mjs --video "C:\...\fundo.mp4" [--seg 60] [--letra] [--rotulo fundo-1080] [--saida resultados-video]
//
// Por cena: toca o vídeo pelo mesmo caminho do operador (playMedia), espera 8 s, mede por --seg segundos e limpa.
//   - cada janela de saída: quadros perdidos (getVideoPlaybackQuality) e cadência (requestVideoFrameCallback: média e desvio do intervalo)
//   - janela principal: quantos <video> estão tocando (a fatia A diz 0: as prévias vêm por captura)
//   - placa: decodificador e 3D (contadores do Windows, só os processos do app)
//   - --letra: troca o slide de uma música a cada 3 s durante a medição (disputa de thread com o vídeo)
import { spawn } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { conectar } from "./cdp.mjs"
import { RAIZ_APP, abrir, esperar } from "./lib.mjs"

const arg = (n, d) => {
    const i = process.argv.indexOf("--" + n)
    return i < 0 ? d : process.argv[i + 1]
}
const VIDEO = arg("video", "")
const SEG = Number(arg("seg", "60"))
const LETRA = process.argv.includes("--letra")
const ROTULO = arg("rotulo", (LETRA ? "letra-" : "") + String(VIDEO).split(/[\\/]/).pop())
const PASTA = arg("saida", "resultados-video")
if (!VIDEO) {
    console.error('uso: node scripts/prova-culto/medir-video.mjs --video "C:\\caminho\\video.mp4" [--seg 60] [--letra] [--rotulo nome]')
    process.exit(2)
}
mkdirSync(PASTA, { recursive: true })

const principal = await abrir("principal")

// ---- janelas de saída (todas as páginas do app que não são a principal)
async function saidas() {
    const alvos = (await (await fetch("http://127.0.0.1:9222/json/list")).json()).filter((t) => t.type === "page" && t.url.startsWith("http://localhost:3000"))
    const lista = []
    for (const t of alvos) {
        const j = await conectar(t.webSocketDebuggerUrl)
        const ehSaida = await j.avaliar("return !document.querySelector('[data-regiao=\"topo\"]')").catch(() => false)
        // cada janela de saida so conhece a propria saida no store `outputs`: o nome vem dali
        const NOME = `const S=await import(${JSON.stringify("/@fs/" + RAIZ_APP + "/src/frontend/stores.ts")}); let o; S.outputs.subscribe((v)=>(o=v))(); const s=Object.values(o||{})[0]; return (s?.name||"?")+" "+innerWidth+"x"+innerHeight`
        if (ehSaida) lista.push({ j, tamanho: await j.avaliar(NOME).catch(() => "? " + t.id.slice(0, 6)) })
        else j.fechar()
    }
    return lista
}

// ---- contadores da placa (só os processos electron do perfil de teste), em paralelo com a medição
function contadores(segundos) {
    const ps = `
$pids = @(Get-CimInstance Win32_Process | ? { $_.Name -eq 'electron.exe' -and $_.CommandLine -match 'remote-debugging-port=9222' } | % { [int]$_.ProcessId })
$kids = @(Get-CimInstance Win32_Process | ? { $pids -contains [int]$_.ParentProcessId } | % { [int]$_.ProcessId }); $pids += $kids
$c = Get-Counter -Counter @('\\GPU Engine(*engtype_VideoDecode)\\Utilization Percentage','\\GPU Engine(*engtype_3D)\\Utilization Percentage') -SampleInterval 1 -MaxSamples ${Math.max(5, segundos - 2)} -ErrorAction SilentlyContinue
$rows = foreach ($s in $c) { $dec=0; $d3=0; $decAll=0
  foreach ($x in $s.CounterSamples) { $own=$false; if ($x.InstanceName -match '^pid_(\\d+)_') { $own = $pids -contains [int]$Matches[1] }
    if ($x.InstanceName -like '*videodecode*') { $decAll += $x.CookedValue; if ($own) { $dec += $x.CookedValue } } elseif ($own) { $d3 += $x.CookedValue } }
  [pscustomobject]@{dec=$dec; d3=$d3; decAll=$decAll} }
[pscustomobject]@{ pids=$pids.Count; amostras=$rows.Count;
  decodeMedia=[math]::Round(($rows | Measure-Object dec -Average).Average,1); decodeMax=[math]::Round(($rows | Measure-Object dec -Maximum).Maximum,1);
  decodeTodosMedia=[math]::Round(($rows | Measure-Object decAll -Average).Average,1); d3Media=[math]::Round(($rows | Measure-Object d3 -Average).Average,1) } | ConvertTo-Json -Compress`
    return new Promise((r) => {
        let out = ""
        const p = spawn("powershell", ["-NoProfile", "-Command", ps], { windowsHide: true })
        p.stdout.on("data", (d) => (out += d))
        p.on("close", () => {
            try {
                r(JSON.parse(out.trim()))
            } catch {
                r({ erro: out.trim().slice(0, 200) })
            }
        })
    })
}

// ---- medição dentro de cada saída: qualidade no início e no fim + intervalos entre quadros (rVFC) no meio
const INICIO = `
const vs=[...document.querySelectorAll("video")].filter(v=>!v.paused&&v.readyState>=2)
window.__medida={ini:vs.map(v=>v.getVideoPlaybackQuality()), ints:[], parar:false}
const v=vs[0]; if(v&&v.requestVideoFrameCallback){ let ant=0; const f=(now)=>{ if(ant) window.__medida.ints.push(now-ant); ant=now; if(!window.__medida.parar) v.requestVideoFrameCallback(f) }; v.requestVideoFrameCallback(f) }
return vs.length`
const FIM = `
const m=window.__medida; if(!m) return null; m.parar=true
const vs=[...document.querySelectorAll("video")].filter(v=>!v.paused&&v.readyState>=2)
const fim=vs.map(v=>v.getVideoPlaybackQuality())
let total=0, perdidos=0; fim.forEach((q,i)=>{ const a=m.ini[i]||{totalVideoFrames:0,droppedVideoFrames:0}; total+=q.totalVideoFrames-a.totalVideoFrames; perdidos+=q.droppedVideoFrames-a.droppedVideoFrames })
const ints=m.ints.slice(5); const med=ints.reduce((a,b)=>a+b,0)/(ints.length||1); const dp=Math.sqrt(ints.reduce((a,b)=>a+(b-med)**2,0)/(ints.length||1))
const travadas=ints.filter(x=>x>med*2.5).length
return {videos:vs.length, quadros:total, perdidos, pctPerdidos: total? Math.round(1000*perdidos/total)/10 : null, intervaloMs: Math.round(med*10)/10, desvioMs: Math.round(dp*10)/10, travadas}`

// ---- a cena
console.log(`cena "${ROTULO}": ${VIDEO} | ${SEG}s${LETRA ? " | trocando slide a cada 3 s" : ""}`)
await principal.ev(`MODO("culto"); return 1`)
const tocou = await principal.ev(`const A=await import(U("components/actions/apiHelper")); A.playMedia({path:${JSON.stringify(VIDEO)}}); await esp(800); return Object.values(get(S.outputs)).filter(o=>o?.out?.background?.path).length`)
if (!tocou) {
    console.error("o vídeo não foi para nenhuma saída (saída trancada? modo só retorno ligado?)")
    process.exit(1)
}
await esperar(8000)

// música para a cena --letra: a primeira do roteiro com 4+ slides
let trocar = null
if (LETRA) {
    const ok = await principal.ev(`
      const P=get(S.projects)[get(S.activeProject)]; const SS=await import(U("components/helpers/setShow")); const H=await import(U("components/helpers/show"))
      for (const it of (P?.shows||[])) { if ((it.type||"show")!=="show") continue; await SS.loadShows([it.id]); const sh=get(S.showsCache)[it.id]; const lay=sh?.settings?.activeLayout; const n=lay?H.getLayoutRef(it.id).length:0; if(n>=4){ window.__letra={id:it.id, layout:lay, n, i:0}; return sh.name } }
      return null`)
    if (!ok) console.warn("sem música com 4+ slides no roteiro ativo: medindo sem trocar slide")
    else {
        console.log("trocando slides de:", ok)
        trocar = setInterval(() => {
            principal.ev(`const L=window.__letra; const O=await import(U("components/helpers/output")); O.setOutput("slide",{id:L.id, layout:L.layout, index:(L.i++)%L.n}); return 1`).catch(() => {})
        }, 3000)
    }
}

const telas = await saidas()
const nVideos = await Promise.all(telas.map((t) => t.j.avaliar(INICIO).catch(() => 0)))
const gpu = contadores(SEG)
await esperar(SEG * 1000)
if (trocar) clearInterval(trocar)
const porTela = []
for (let i = 0; i < telas.length; i++) {
    const r = await telas[i].j.avaliar(FIM).catch((e) => ({ erro: String(e) }))
    if (nVideos[i] || r?.videos) porTela.push({ tela: telas[i].tamanho, ...r })
    telas[i].j.fechar()
}
// so conta video que DECODIFICA arquivo: as previas por captura (fatia A) sao <video> com srcObject (a janela do telao), sem custo de decodificador
const naPrincipal = await principal.ev(`return [...document.querySelectorAll("video")].filter(v=>!v.paused && !v.srcObject && !!v.currentSrc).length`)
const placa = await gpu

// limpa (fundo e, se trocou, o slide)
await principal.ev(`const C=await import(U("components/output/clear")); C.clearBackground(); ${trocar ? "C.clearSlide();" : ""} return 1`)

const resultado = { rotulo: ROTULO, video: VIDEO, segundos: SEG, letra: LETRA, quando: new Date().toISOString(), telas: porTela, videosTocandoNaPrincipal: naPrincipal, placa }
writeFileSync(join(PASTA, ROTULO.replace(/[^\w.-]+/g, "_") + ".json"), JSON.stringify(resultado, null, 2))

console.log("")
for (const t of porTela) console.log(`  ${t.tela}: ${t.quadros} quadros, ${t.perdidos} perdidos (${t.pctPerdidos}%), intervalo ${t.intervaloMs} ms ±${t.desvioMs}, travadas ${t.travadas}`)
console.log(`  janela principal: ${naPrincipal} vídeo(s) decodificando arquivo (as prévias por captura não contam)`)
console.log(`  placa: decodificador ${placa.decodeMedia}% (máx ${placa.decodeMax}%), todos os programas ${placa.decodeTodosMedia}%, 3D ${placa.d3Media}%`)
const perdeu = porTela.some((t) => (t.pctPerdidos || 0) > 1)
console.log(perdeu ? "  RESULTADO: PERDEU QUADROS" : "  RESULTADO: ok (até 1% perdido)")
process.exit(0)
