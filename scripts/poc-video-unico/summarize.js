// node summarize.js -> prints markdown tables from results/*.json
const fs = require('fs'), path = require('path')
const R = path.join(__dirname, 'results')
const tags = fs.readdirSync(R).filter((f) => f.endsWith('.json') && !f.endsWith('.gpu.json') && f !== 'measuring.json').map((f) => f.slice(0, -5))
const rows = [], wrows = []
for (const t of tags) {
  const r = JSON.parse(fs.readFileSync(path.join(R, t + '.json')))
  if (!r.stats) { console.log('CHAOS', t, JSON.stringify(r.status)); continue }
  let g = {}; try { g = JSON.parse(fs.readFileSync(path.join(R, t + '.gpu.json'))) } catch {}
  const procs = new Set(Object.values(r.winPids)).size
  rows.push(`| ${t} | ${g.decodeMean}/${g.decodeMax} | ${g.d3Mean} | ${g.cpuPctOneCore} | ${procs} |`)
  const ref = r.variant === 'a' || r.variant === 'c' ? 'OUT1' : 'SRC'
  const byTick = {}
  for (const s of r.stats) for (const x of s.samples) (byTick[x.tick] ||= {})[x.label] = x.frame
  for (const s of r.stats) for (const p of s.probes) {
    const d = []; let bad = 0
    for (const tk of Object.values(byTick)) { const a = tk[p.label], b = tk[ref]; if (a == null || b == null) continue; if (a < 0 || b < 0) { bad++; continue } d.push(b - a) }
    const m = d.length ? d.reduce((x, y) => x + y, 0) / d.length : NaN
    const c = p.cadence
    wrows.push(`| ${t} | ${p.label} | ${p.kind === 'video' ? `${p.dropped}/${p.total}` : `draws ${p.draws} (${p.drawMsMean} ms)`} | ${c.mean}±${c.sd} | ${c.over50}/${c.n} | ${p.label === ref ? 'ref' : d.length ? `${m.toFixed(2)} (min ${Math.min(...d)}, max ${Math.max(...d)}, n=${d.length})` : 'n/a'} | ${bad} |`)
  }
}
console.log('| run | VideoDecode % mean/max | 3D % | CPU % (1 core) | renderer procs |\n|---|---|---|---|---|\n' + rows.join('\n'))
console.log('\n| run | window | dropped/total | interval ms mean±sd | >50ms | lag vs ref (frames) | unreadable |\n|---|---|---|---|---|---|---|\n' + wrows.join('\n'))
