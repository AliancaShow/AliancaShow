// POC b3: hidden ENGINE window + outputs opened by window.open with the REAL app URL (http dev-style or file:// prod-style),
// same webPreferences as AliancaShow outputOptions (incl. preload mirroring preload.ts). Isolated from the AliancaShow repo.
const { app, BrowserWindow, ipcMain, screen, desktopCapturer } = require('electron')
const path = require('path'), fs = require('fs'), http = require('http'), { pathToFileURL } = require('url')

const A = {}
for (const a of process.argv) if (a.startsWith('--poc-')) { const [k, v] = a.slice(6).split('='); A[k] = v }
const URLMODE = A.url || 'file', PREFS = A.prefs || (URLMODE === 'http' ? 'dev' : 'prod'), MEDIA = A.media || '4k'
const DRIVER = A.driver || 'raf', LOAD = A.load || '0', MODE = A.mode || 'opener', TEST = A.test || 'perf'
const WARM = +(A.warm || 8), DUR = +(A.dur || 30)
const TAG = `b3_${URLMODE}-${PREFS}_${MEDIA}_${DRIVER}${MODE === 'vf' ? '_vf' : ''}${LOAD !== '0' ? '_load' + LOAD : ''}${TEST !== 'perf' ? '_' + TEST : ''}`
const POC = path.join(__dirname, '..'), APPDIR = path.join(__dirname, 'app'), RES = path.join(POC, 'results'), FLAG = path.join(RES, 'measuring.json')
const MEDIAFILE = path.join(POC, 'media', MEDIA === '4k' ? 'test_4k.mp4' : 'test_1080.mp4')
app.setPath('userData', path.join(POC, '.userdata-b3'))
fs.mkdirSync(RES, { recursive: true }); try { fs.unlinkSync(FLAG) } catch {}

// ---- exact copy of AliancaShow outputOptions (windowOptions.ts), isProd switched by --poc-prefs ----
const isProd = PREFS === 'prod'
const webPreferences = {
  preload: path.join(__dirname, 'preload.js'),
  webSecurity: isProd,
  nodeIntegration: !isProd,
  contextIsolation: true,
  allowRunningInsecureContent: false,
  webviewTag: true,
  backgroundThrottling: false,
  autoplayPolicy: 'no-user-gesture-required',
}
const outputOptions = { backgroundColor: '#000000', transparent: true, show: false, alwaysOnTop: true, resizable: false, frame: false, skipTaskbar: true, hasShadow: false, enableLargerThanScreen: true, titleBarStyle: 'default' }

const R = { tag: TAG, args: A, electron: process.versions.electron, chrome: process.versions.chrome, webPreferences, outputOptions, events: [], kids: {}, ipc: {}, stats: {} }
const ev = (k, d = {}) => { R.events.push({ t: Date.now(), k, ...d }); console.log(k, JSON.stringify(d).slice(0, 300)) }
let OUTS, engine, startAt, server, baseUrl
const kids = {} // id -> BrowserWindow
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function serve() { // tiny static server standing in for the vite dev server (localhost:<port>)
  return new Promise((res) => {
    server = http.createServer((req, rsp) => {
      const u = new URL(req.url, 'http://x'); let f
      if (u.pathname.startsWith('/media/')) f = path.join(POC, 'media', path.basename(u.pathname))
      else f = path.join(APPDIR, u.pathname === '/' ? 'index.html' : path.normalize(u.pathname).replace(/^[\\/]+/, ''))
      if (!f.startsWith(POC) || !fs.existsSync(f)) { rsp.writeHead(404); return rsp.end() }
      const size = fs.statSync(f).size, type = f.endsWith('.mp4') ? 'video/mp4' : f.endsWith('.js') ? 'text/javascript' : 'text/html'
      const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '')
      if (m) { const s = m[1] ? +m[1] : 0, e = m[2] ? +m[2] : size - 1; rsp.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${s}-${e}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': e - s + 1 }); fs.createReadStream(f, { start: s, end: e }).pipe(rsp) }
      else { rsp.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' }); fs.createReadStream(f).pipe(rsp) }
    }).listen(0, 'localhost', () => { baseUrl = `http://localhost:${server.address().port}/`; res() })
  })
}

function createEngine() {
  engine = new BrowserWindow({ ...outputOptions, show: false, width: 640, height: 360, title: 'ENGINE', webPreferences })
  const query = { role: 'engine', media: URLMODE === 'http' ? '/media/' + path.basename(MEDIAFILE) : pathToFileURL(MEDIAFILE).href }
  if (URLMODE === 'http') engine.loadURL(baseUrl + 'index.html?' + new URLSearchParams(query))
  else engine.loadFile(path.join(APPDIR, 'index.html'), { query })
  engine.webContents.on('render-process-gone', (_e, d) => ev('engine-gone', d))
  engine.webContents.on('preload-error', (_e, p, err) => ev('engine-preload-error', { p, err: String(err) }))
  engine.webContents.on('console-message', (e) => !/Security Warning/.test(e.message) && ev('engine-console', { msg: e.message }))
  engine.webContents.on('did-fail-load', (_e, c, d, u) => ev('engine-fail-load', { c, d, u }))
  engine.webContents.setWindowOpenHandler(({ url, frameName }) => {
    const o = OUTS.find((x) => x.id === frameName)
    ev('open-handler', { url, frameName })
    if (!o) return { action: 'deny' }
    return { action: 'allow', overrideBrowserWindowOptions: { ...outputOptions, x: o.x, y: o.y, width: o.w, height: o.h, title: o.id, webPreferences } }
  })
  engine.webContents.on('did-create-window', (child, { frameName, url }) => {
    const o = OUTS.find((x) => x.id === frameName); kids[frameName] = child
    const k = (R.kids[frameName] ||= {}); k.url = url; k.isBrowserWindow = child instanceof BrowserWindow
    child.setBounds({ x: o.x, y: o.y, width: o.w, height: o.h }); child.setAlwaysOnTop(true, 'screen-saver'); child.showInactive()
    k.boundsAsked = { x: o.x, y: o.y, width: o.w, height: o.h }; k.boundsGot = child.getBounds(); k.contentBounds = child.getContentBounds(); k.alwaysOnTop = child.isAlwaysOnTop(); k.visible = child.isVisible()
    child.webContents.on('did-finish-load', () => { k.pid = child.webContents.getOSProcessId(); child.webContents.send('STARTUP', { channel: 'TYPE', data: 'output' }) })
    child.webContents.on('preload-error', (_e, p, err) => ev('child-preload-error', { id: frameName, err: String(err) }))
    child.webContents.on('console-message', (e) => !/Security Warning/.test(e.message) && ev('child-console', { id: frameName, msg: e.message }))
    child.webContents.on('render-process-gone', (_e, d) => ev('child-gone', { id: frameName, ...d }))
    ev('did-create-window', { id: frameName })
  })
}

ipcMain.on('POC', (e, m) => {
  const from = e.sender
  if (m.t === 'engine-ready') { R.lastEngineReady = Date.now(); R.engineInfo = m.info; R.enginePid = engine.webContents.getOSProcessId(); ev('engine-ready', { pid: R.enginePid, dur: m.dur }); if (!startAt) startAt = Date.now() + 1500; engine.webContents.send('POC', { t: 'go', startAt }); engine.webContents.send('POC', { t: 'open', outs: OUTS, driver: DRIVER, load: LOAD, mode: MODE }) }
  if (m.t === 'opened') R.engineOpened = m.info
  if (m.t === 'hello') { (R.kids[m.id] ||= {}).hello = m.info; from.send('POC', { t: 'ack' }) }
  if (m.t === 'ipc') (R.kids[m.id] ||= {}).ipc = m.ipc
  if (m.t === 'first-draw') { const clock = ((m.wall - startAt) / 1000) % 60; (R.kids[m.id] ||= {}).firstDraw = { wall: m.wall, ct: m.ct, clock, offsetMs: m.ct != null ? Math.round((m.ct - clock) * 1000) : null }; ev('first-draw', { id: m.id }); onFirstDraw() }
  if (m.t === 'stats') { R.stats[m.id] = m.stats; if (m.id === 'engine') R.engineInfo = m.info; else R.kids[m.id].final = m.info; statsWaiter && statsWaiter() }
  if (m.t === 'state' || m.t === 'probe') { replies[m.id] && replies[m.id](m) }
  if (m.t === 'err') ev('page-err', m)
})
const replies = {}
const ask = (w, id, t) => new Promise((res) => { replies[id] = res; w.webContents.send('POC', { t }); setTimeout(() => res({ timeout: true }), 2000) })
let statsWaiter = null, firstDrawWaiter = null
function onFirstDraw() { if (firstDrawWaiter && OUTS.every((o) => R.kids[o.id]?.firstDraw)) { const f = firstDrawWaiter; firstDrawWaiter = null; f() } }
const allFirstDraw = () => new Promise((res) => { firstDrawWaiter = res; onFirstDraw() })

function metricsCpu() { return Object.fromEntries(app.getAppMetrics().map((m) => [m.pid, { type: m.type, name: m.name, cum: m.cpu.cumulativeCPUUsage, memMB: Math.round(m.memory.workingSetSize / 1024) }])) }
async function measure(seconds, label) {
  const c0 = metricsCpu(), t0 = Date.now()
  fs.writeFileSync(FLAG, JSON.stringify({ tag: label, pids: Object.keys(c0).map(Number), t: t0, dur: seconds }))
  R.stats = {}
  const targets = [engine, ...Object.values(kids)]
  targets.forEach((w) => w.webContents.send('POC', { t: 'measure', on: true }))
  await sleep(seconds * 1000)
  const got = new Promise((res) => { statsWaiter = () => { if (Object.keys(R.stats).length === targets.length) { statsWaiter = null; res() } } })
  targets.forEach((w) => w.webContents.send('POC', { t: 'measure', on: false }))
  await Promise.race([got, sleep(8000)])
  const c1 = metricsCpu(), el = (Date.now() - t0) / 1000
  const cpu = {}; let tot = 0
  for (const [pid, m] of Object.entries(c1)) { if (!c0[pid] || m.cum == null) continue; const p = +(100 * (m.cum - c0[pid].cum) / el).toFixed(1); tot += p; cpu[pid] = { type: m.type, name: m.name, pctOneCore: p, memMB: m.memMB } }
  try { fs.unlinkSync(FLAG) } catch {}
  return { label, seconds: el, cpuTotalPctOneCore: +tot.toFixed(1), cpu, stats: R.stats }
}

function decodeImg(img) { // read burned-in barcode from a NativeImage (contain-fit 16:9 window)
  if (img.isEmpty()) return { empty: true }
  const sz = img.getSize(), s = img.resize({ width: 160, height: 90 }), bm = s.toBitmap(), row = 84 * 160 * 4
  const bit = (k) => { const i = row + Math.round((k + 0.5) * 10) * 4; return (bm[i] + bm[i + 1] + bm[i + 2]) / 3 > 128 }
  let mid = 0; { const i = (45 * 160 + 80) * 4; mid = [bm[i + 2], bm[i + 1], bm[i]] }
  if (!bit(0)) return { size: sz, frame: -1, centerRGB: mid }
  let n = 0; for (let k = 1; k <= 12; k++) n = n * 2 + (bit(k) ? 1 : 0)
  return { size: sz, frame: n, centerRGB: mid }
}
async function cap(w, name, opts) {
  const t0 = Date.now()
  const img = await Promise.race([opts ? w.webContents.capturePage(undefined, opts) : w.webContents.capturePage(), sleep(3000).then(() => null)])
  if (!img) return { timeout: true, ms: Date.now() - t0 }
  if (name) fs.writeFileSync(path.join(RES, `${TAG}_${name}.png`), img.toPNG())
  return { ms: Date.now() - t0, ...decodeImg(img) }
}
async function capLoop(w, name, opts) { // like CaptureLifecycle: capture repeatedly (10 x ~100 ms)
  const r = []; for (let i = 0; i < 10; i++) { const c = await cap(w, i === 9 ? name : null, opts); r.push(c.timeout ? 'T' : c.empty ? 'E' : c.frame); if (c.timeout) break; await sleep(100) }
  const fr = r.filter((x) => typeof x === 'number' && x >= 0)
  return { seq: r.join(','), distinctFrames: new Set(fr).size }
}
async function screenShot(name) {
  const d = screen.getPrimaryDisplay(), W = d.size.width * d.scaleFactor, H = d.size.height * d.scaleFactor
  const t0 = Date.now(); const [s] = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: W, height: H } })
  const img = s.thumbnail; fs.writeFileSync(path.join(RES, `${TAG}_${name}.png`), img.toPNG())
  const bm = img.toBitmap(), w = img.getSize().width
  const px = (x, y) => { const i = (y * w + x) * 4; return [bm[i + 2], bm[i + 1], bm[i]] }
  const sf = d.scaleFactor, at = (x, y) => px(Math.round(x * sf), Math.round(y * sf))
  return { ms: Date.now() - t0, OUT1: at(1500, 900), OUT3: at(150, 600), LED: at(1050, 100), uncoveredByOutputsNone: true }
}
async function captureTests() {
  const w = kids.OUT3, out = (R.capture = {})
  out.mediaSourceId = (() => { try { return w.getMediaSourceId() } catch (e) { return 'ERR ' + e.message } })()
  out.visible = await capLoop(w, 'cap_visible')
  out.engineNow = await ask(engine, 'engine', 'state')
  out.OUT1visible = await cap(kids.OUT1, 'cap_OUT1')
  w.hide(); await sleep(1500)
  out.hiddenProbe = await ask(w, 'OUT3', 'probe'); out.hiddenPlain = await capLoop(w, 'cap_hidden'); out.hiddenProbe2 = await ask(w, 'OUT3', 'probe')
  out.hiddenStay = await capLoop(w, 'cap_hidden_stay', { stayHidden: true, stayAwake: true }); out.hiddenProbe3 = await ask(w, 'OUT3', 'probe')
  w.setBounds({ x: -3000, y: 0, width: 960, height: 540 }); w.showInactive(); await sleep(1500)
  out.offscreenBounds = w.getBounds()
  out.offProbe = await ask(w, 'OUT3', 'probe'); out.offscreen = await capLoop(w, 'cap_offscreen'); out.offProbe2 = await ask(w, 'OUT3', 'probe')
  // control: standalone hidden BrowserWindow with the same options (as the app's invisible outputs today)
  const ctl = new BrowserWindow({ ...outputOptions, show: false, width: 960, height: 540, webPreferences })
  if (URLMODE === 'http') await ctl.loadURL(baseUrl + 'index.html?role=ctl'); else await ctl.loadFile(path.join(APPDIR, 'index.html'), { query: { role: 'ctl' } })
  await sleep(500); const c1 = await cap(ctl, 'cap_ctl_hidden'); await sleep(300); const c2 = await cap(ctl, null)
  out.controlStandaloneHidden = { first: c1.timeout ? 'TIMEOUT' : c1.empty ? 'EMPTY' : 'image ' + JSON.stringify(c1.size), second: c2.timeout ? 'TIMEOUT' : c2.empty ? 'EMPTY' : 'image' }
  ctl.destroy()
  return out
}

async function crashTest() {
  const out = {}
  out.pidsBefore = { engine: engine.webContents.getOSProcessId(), ...Object.fromEntries(Object.entries(kids).map(([k, w]) => [k, w.webContents.getOSProcessId()])) }
  out.shotBefore = await screenShot('crash_0_before')
  const tCrash = Date.now(); let tGone = null
  engine.webContents.once('render-process-gone', () => { tGone = Date.now() })
  engine.webContents.forcefullyCrashRenderer()
  await sleep(300); out.shot300 = await screenShot('crash_1_300ms')
  await sleep(1700); out.shot2000 = await screenShot('crash_2_2000ms')
  out.detectMs = tGone ? tGone - tCrash : null
  out.stateAfter = Object.fromEntries(Object.entries(kids).map(([k, w]) => [k, w.isDestroyed() ? 'destroyed' : { crashed: w.webContents.isCrashed(), visible: w.isVisible() }]))
  out.engineCrashed = engine.webContents.isCrashed()
  // ---- recovery: destroy everything of the engine family, recreate, resume at the shared clock ----
  const t0 = Date.now()
  for (const k of Object.keys(R.kids)) delete R.kids[k].firstDraw
  Object.values(kids).forEach((w) => !w.isDestroyed() && w.destroy()); for (const k of Object.keys(kids)) delete kids[k]
  engine.destroy()
  createEngine()
  await allFirstDraw()
  const tAll = Date.now()
  out.recovery = { engineReadyMs: R.lastEngineReady - t0, allChildrenFirstDrawMs: tAll - t0, totalFromCrashMs: tAll - tCrash, firstDraw: Object.fromEntries(OUTS.map((o) => [o.id, R.kids[o.id].firstDraw])) }
  out.shotRecovered = await screenShot('crash_3_recovered')
  await sleep(2000)
  const st = await ask(engine, 'engine', 'state'); const clock = ((Date.now() - startAt) / 1000) % 60
  out.after2s = { engineCt: st.ct, clock, offsetMs: Math.round((st.ct - clock) * 1000), paused: st.paused }
  out.pidsAfter = { engine: engine.webContents.getOSProcessId(), ...Object.fromEntries(Object.entries(kids).map(([k, w]) => [k, w.webContents.getOSProcessId()])) }
  return out
}

app.whenReady().then(async () => {
  const d = screen.getPrimaryDisplay(); R.display = { bounds: d.bounds, scaleFactor: d.scaleFactor, n: screen.getAllDisplays().length }
  OUTS = [
    { id: 'OUT1', x: d.bounds.x, y: d.bounds.y, w: d.bounds.width, h: d.bounds.height, fit: 'contain', check: true }, // 1920x1080 at 100%
    { id: 'LED', x: d.bounds.x + 1000, y: d.bounds.y + 60, w: 896, h: 320, fit: 'cover' },
    { id: 'OUT3', x: d.bounds.x + 40, y: d.bounds.y + 480, w: 960, h: 540, fit: 'contain' },
  ]
  if (URLMODE === 'http') await serve()
  if (TEST === 'crash') { const bd = new BrowserWindow({ ...d.bounds, frame: false, backgroundColor: '#ff00ff', skipTaskbar: true, focusable: false, show: false }); bd.loadURL('about:blank'); bd.showInactive(); R.backdrop = 'magenta #ff00ff, non-topmost, full screen behind outputs' }
  const hard = setTimeout(() => { ev('HARD TIMEOUT'); finish(3) }, (WARM + DUR + 90) * 1000)
  createEngine()
  await allFirstDraw()
  ev('all-first-draw')
  R.pids = { engine: engine.webContents.getOSProcessId(), ...Object.fromEntries(Object.entries(kids).map(([k, w]) => [k, w.webContents.getOSProcessId()])) }
  R.processTypes = app.getAppMetrics().map((m) => ({ pid: m.pid, type: m.type, name: m.name }))
  for (const [k, w] of Object.entries(kids)) { R.kids[k].boundsNow = w.getBounds(); R.kids[k].alwaysOnTopNow = w.isAlwaysOnTop() }
  await sleep(WARM * 1000)
  if (TEST === 'perf') { R.measure = await measure(DUR, TAG); R.capture = await captureTests() }
  if (TEST === 'crash') { R.crash = await crashTest(); R.measureAfterRecovery = await measure(DUR, TAG + '-after') }
  clearTimeout(hard); finish(0)
})
function finish(code) {
  try { fs.writeFileSync(path.join(RES, `${TAG}.json`), JSON.stringify(R, null, 1)) } catch (e) { console.error(e) }
  try { fs.unlinkSync(FLAG) } catch {}
  server && server.close()
  setTimeout(() => app.exit(code), 200)
}
