// POC "decode once, show N times" -- isolated, outside AliancaShow repo.
if (process.argv.includes('--poc-variant=b3')) return require('./b3/main.js') // b3: engine + real-URL children (see b3/)
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url')

const args = {}
for (const a of process.argv) if (a.startsWith('--poc-')) { const [k, v] = a.slice(6).split('='); args[k] = v }
const VARIANT = args.variant || 'a'          // a | b | b2 | c
const MEDIA = args.media || '1080'           // 1080 | 4k
const OWNER = args.owner || 'main'           // b/b2: main (UI window decodes) | hidden (dedicated hidden compositor window)
const WARM = +(args.warm || 8), DUR = +(args.dur || 30)
const CHAOS = args.chaos || ''         // minimize:LABEL | crash:LABEL | occlude:LABEL
const TAG = `${VARIANT}${OWNER === 'hidden' ? '-hidden' : ''}_${MEDIA}${CHAOS ? '_' + CHAOS.replace(':', '-') : ''}`
const ROOT = __dirname, RES = path.join(ROOT, 'results'), FLAG = path.join(RES, 'measuring.json')
app.setPath('userData', path.join(ROOT, '.userdata'))
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
const mediaUrl = pathToFileURL(path.join(ROOT, 'media', MEDIA === '4k' ? 'test_4k.mp4' : 'test_1080.mp4')).href

const OUTS = [
  { id: 'OUT1', x: 960, y: 0, w: 960, h: 540, fit: 'contain' },
  { id: 'LED', x: 960, y: 570, w: 896, h: 320, fit: 'cover' },     // 14:5 LED wall
  { id: 'OUT3', x: 0, y: 460, w: 640, h: 360, fit: 'contain' },
]
const webPreferences = { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false, webSecurity: false, autoplayPolicy: 'no-user-gesture-required' }
// mimic AliancaShow outputOptions (frameless, transparent, skipTaskbar, alwaysOnTop)
const outOpts = { frame: false, transparent: true, resizable: false, skipTaskbar: true, hasShadow: false, alwaysOnTop: true, backgroundColor: '#00000000', show: true }
const page = (q) => pathToFileURL(path.join(ROOT, 'page.html')).href + '?' + new URLSearchParams({ variant: VARIANT, media: mediaUrl, owner: OWNER, ...q })

const wins = {}            // label -> BrowserWindow
const children = new Set() // window.open children (no node/ipc)
let expectedReady = 0, ready = 0, stats = [], expectedStats = 0

function mk(label, b, q, extra = {}) {
  const w = new BrowserWindow({ x: b.x, y: b.y, width: b.w, height: b.h, title: label, webPreferences, ...extra })
  w.loadURL(page({ role: q.role, id: label, fit: b.fit || 'contain', ...q }))
  wins[label] = w
  return w
}

app.whenReady().then(() => {
  fs.mkdirSync(RES, { recursive: true }); try { fs.unlinkSync(FLAG) } catch {}
  const MAINB = { x: 0, y: 0, w: 640, h: 420 }
  if (VARIANT === 'a') {
    mk('MAIN', MAINB, { role: 'main-file' })
    OUTS.forEach((o) => mk(o.id, o, { role: 'out-file', muted: o.id === 'OUT1' ? '0' : '1' }, outOpts))
    expectedReady = 4
  } else if (VARIANT === 'b' || VARIANT === 'b2') {
    const owner = OWNER === 'hidden'
      ? mk('OWNER', { x: 0, y: 0, w: 640, h: 360 }, { role: 'owner', outs: JSON.stringify(OUTS) }, { show: false })
      : mk('MAIN', MAINB, { role: 'owner', outs: JSON.stringify(OUTS) })
    if (OWNER === 'hidden') mk('MAIN', MAINB, { role: 'main-none' })
    owner.webContents.setWindowOpenHandler(({ frameName }) => {
      const o = OUTS.find((x) => x.id === frameName)
      if (!o) return { action: 'deny' }
      return { action: 'allow', overrideBrowserWindowOptions: { ...outOpts, x: o.x, y: o.y, width: o.w, height: o.h, title: o.id, webPreferences: { backgroundThrottling: false } } }
    })
    owner.webContents.on('did-create-window', (child, { frameName }) => { wins[frameName] = child; children.add(frameName) })
    expectedReady = OWNER === 'hidden' ? 2 : 1
  } else if (VARIANT === 'c') {
    const src = mk('OUT1', OUTS[0], { role: 'out-file', muted: '0' }, outOpts)
    const sid = () => src.getMediaSourceId()
    mk('MAIN', MAINB, { role: 'cap', srcId: '' })
    OUTS.slice(1).forEach((o) => mk(o.id, o, { role: 'cap' }, outOpts))
    // capture windows ask for the source id once OUT1 is shown
    ipcMain.handle('source-id', () => sid())
    expectedReady = 4
  }
})

ipcMain.on('ready', () => {
  if (++ready !== expectedReady) return
  const startAt = Date.now() + 700
  broadcast('go', { startAt })
  setTimeout(() => {
    app.getAppMetrics() // reset percentCPUUsage baseline
    const pids = app.getAppMetrics().map((m) => m.pid)
    const winPids = Object.fromEntries(Object.entries(wins).map(([k, w]) => [k, w.webContents.getOSProcessId()]))
    fs.writeFileSync(FLAG, JSON.stringify({ tag: TAG, pids, t: Date.now() }))
    broadcast('measure', { on: true })
    if (CHAOS) setTimeout(() => chaos(winPids), 3000)
    setTimeout(() => finish(winPids), DUR * 1000)
  }, 700 + WARM * 1000)
})

function broadcast(ch, data) { Object.values(wins).forEach((w) => !w.isDestroyed() && w.webContents.send(ch, data)) }

function finish(winPids) {
  const metrics = app.getAppMetrics().map((m) => ({ pid: m.pid, type: m.type, name: m.name, serviceName: m.serviceName, cpu: +m.cpu.percentCPUUsage.toFixed(1), memMB: Math.round(m.memory.workingSetSize / 1024) }))
  stats = []; expectedStats = new Set(Object.values(winPids)).size
  ipcMain.on('stats', (_e, s) => {
    stats.push(s)
    if (stats.length === expectedStats) {
      const out = { tag: TAG, chaosLog, variant: VARIANT, media: MEDIA, owner: OWNER, electron: process.versions.electron, chrome: process.versions.chrome, winPids, metrics, stats }
      fs.writeFileSync(path.join(RES, `${TAG}.json`), JSON.stringify(out, null, 1))
      try { fs.unlinkSync(FLAG) } catch {}
      setTimeout(() => app.exit(0), 300)
    }
  })
  // one stats report per renderer process (owner reports for its children)
  const seen = new Set()
  Object.entries(wins).forEach(([k, w]) => { const p = winPids[k]; if (seen.has(p) || w.isDestroyed() || children.has(k)) return; seen.add(p); w.webContents.send('measure', { on: false }) })
  expectedStats = seen.size
  setTimeout(() => { console.error('stats timeout'); app.exit(2) }, 10000)
}

const chaosLog = []
function chaos(winPids) {
  const [kind, label] = CHAOS.split(':'), w = wins[label]
  chaosLog.push({ t: Date.now(), kind, label })
  if (kind === 'minimize') w.minimize()
  if (kind === 'occlude') { // cover the window with an opaque always-on-top window
    const b = w.getBounds(); const cov = new BrowserWindow({ ...b, frame: false, alwaysOnTop: true, backgroundColor: '#333', focusable: false }); cov.setAlwaysOnTop(true, 'screen-saver'); cov.loadURL('about:blank'); wins['COVER'] = cov; children.add('COVER')
  }
  if (kind === 'crash') {
    w.webContents.forcefullyCrashRenderer()
    setTimeout(() => {
      const st = Object.fromEntries(Object.entries(wins).map(([k, x]) => [k, x.isDestroyed() ? 'destroyed' : (x.webContents.isCrashed() ? 'CRASHED (window open, content dead)' : 'alive')]))
      fs.writeFileSync(path.join(RES, `${TAG}.json`), JSON.stringify({ tag: TAG, chaos: CHAOS, winPids, status: st }, null, 1))
      try { fs.unlinkSync(FLAG) } catch {}
      app.exit(0)
    }, 3000)
  }
}
