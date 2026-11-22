// node summarize-b3.js -> markdown tables for results/b3_*.json
const fs = require('fs'), path = require('path'), R = path.join(__dirname, 'results')
const files = fs.readdirSync(R).filter((f) => /^b3_.*\.json$/.test(f) && !f.endsWith('.gpu.json'))
const gpu = (t) => { try { return JSON.parse(fs.readFileSync(path.join(R, t + '.gpu.json'))) } catch { return {} } }
const perf = [], func = [], caps = [], crash = []
for (const f of files) {
  const r = JSON.parse(fs.readFileSync(path.join(R, f))), t = r.tag
  const pids = r.pids ? [...new Set(Object.values(r.pids))].length : '?'
  const k1 = r.kids.OUT1?.final || r.kids.OUT1?.hello || {}
  func.push(`| ${t} | ${pids === 1 ? 'same ' + r.pids.engine : JSON.stringify(r.pids)} | ${k1.preload ? `ran (sandboxed=${k1.preload.sandboxed})` : 'NO'} | ${k1.ipc ? `STARTUP=${!!k1.ipc.startupReceived}, rt ${k1.ipc.ackRtMs} ms` : '-'} | ${k1.openerAccess} | ${r.kids.OUT1?.isBrowserWindow} / ${JSON.stringify(r.kids.LED?.boundsNow)} / top=${r.kids.LED?.alwaysOnTopNow} |`)
  const add = (m, label) => {
    if (!m) return; const g = gpu(m.label), s = m.stats
    for (const id of ['OUT1', 'LED', 'OUT3']) { const x = s[id]; if (!x) continue; perf.push(`| ${label} | ${id} ${x.canvas.join('x')} | ${id === 'OUT1' ? `${s.engine?.dropped}/${s.engine?.total}` : ''} | ${x.draws} | ${x.cadence.mean}±${x.cadence.sd} | ${x.cadence.over50} | ${x.frames ? `${x.frames.skipped}/${x.frames.dup}/${x.frames.unreadable}` : '-'} | ${x.drawMsMean}/${x.drawMsMax} | ${x.longtasks.n}/${x.longtasks.max} | ${id === 'OUT1' ? `${g.decodeMean}/${g.decodeMax}` : ''} | ${id === 'OUT1' ? g.d3Mean : ''} | ${id === 'OUT1' ? m.cpuTotalPctOneCore : ''} |`) }
  }
  add(r.measure, t); add(r.measureAfterRecovery, t + ' (after recovery)')
  if (r.capture) { const c = r.capture; caps.push(`| ${t} | ${c.visible?.seq} | ${c.OUT1visible?.frame} | ${c.hiddenPlain?.seq} (draws ${c.hiddenProbe?.draws}->${c.hiddenProbe2?.draws}) | ${c.hiddenStay?.seq} | ${c.offscreen?.seq} (draws ${c.offProbe?.draws}->${c.offProbe2?.draws}, hidden=${c.offProbe?.hidden}) | ${JSON.stringify(c.controlStandaloneHidden)} | ${c.mediaSourceId} |`) }
  if (r.crash) { const c = r.crash; crash.push(`| ${t} | ${c.detectMs} | ${JSON.stringify(c.stateAfter)} | ${JSON.stringify(c.shotBefore && { OUT1: c.shotBefore.OUT1, LED: c.shotBefore.LED })} | ${JSON.stringify({ OUT1: c.shot300.OUT1, LED: c.shot300.LED, OUT3: c.shot300.OUT3 })} | ${JSON.stringify({ OUT1: c.shot2000.OUT1, LED: c.shot2000.LED })} | ${c.recovery.engineReadyMs} | ${c.recovery.allChildrenFirstDrawMs} | ${c.recovery.totalFromCrashMs} | ${Object.values(c.recovery.firstDraw).map((x) => x.offsetMs).join('/')} | ${c.after2s.offsetMs} | ${JSON.stringify(c.pidsAfter)} |`) }
}
console.log('## Funcional\n| run | PIDs | preload | IPC | opener | did-create-window BrowserWindow / LED bounds / alwaysOnTop |\n|---|---|---|---|---|---|\n' + func.join('\n'))
console.log('\n## Desempenho\n| run | saida | engine dropped/total | draws | intervalo ms | >50ms | skip/dup/ilegivel | draw ms med/max | longtasks n/max | decode % med/max | 3D % | CPU % 1 nucleo |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n' + perf.join('\n'))
console.log('\n## Captura\n| run | visivel OUT3 (seq quadros) | OUT1 | oculta simples | oculta stayHidden | fora da tela | controle: BrowserWindow avulsa oculta | mediaSourceId |\n|---|---|---|---|---|---|---|---|\n' + caps.join('\n'))
console.log('\n## Queda\n| run | detect ms | estado filhas | antes RGB | +300ms RGB | +2s RGB | motor pronto ms | 1o quadro todas ms | total desde queda ms | offset 1o quadro ms | offset +2s ms | PIDs depois |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n' + crash.join('\n'))
