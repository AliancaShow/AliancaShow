// b3 page: same URL for engine (hidden owner) and outputs (window.open children). Runs in MAIN WORLD (contextIsolation on).
const q = Object.fromEntries(new URLSearchParams(location.search))
const ROLE = q.role, ID = q.id || ROLE
const bridge = window.api
const hud = document.getElementById('hud')
hud.textContent = `${ID} | b3 | ${location.protocol}`
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0
const sd = (a) => { const m = mean(a); return a.length ? Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) : 0 }
const hist = (a) => { const h = {}; for (const x of a) { const b = Math.round(x / (1000 / 60)); h[b] = (h[b] || 0) + 1 } return h }
const send = (t, data = {}) => bridge ? bridge.send('POC', { t, id: ID, role: ROLE, ...data }) : null
let measuring = false
const longtasks = []
try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (measuring) longtasks.push(Math.round(e.duration)) }).observe({ type: 'longtask', buffered: false }) } catch {}

const sc = document.createElement('canvas'); sc.width = 160; sc.height = 90
const sctx = sc.getContext('2d', { willReadFrequently: true })
function readFrame(el) { // barcode burned in the media (see ../vf.txt)
  try {
    sctx.drawImage(el, 0, 0, 160, 90)
    const row = sctx.getImageData(0, 84, 160, 1).data
    const bit = (k) => { const i = Math.round((k + 0.5) * 10) * 4; return (row[i] + row[i + 1] + row[i + 2]) / 3 > 128 }
    if (!bit(0)) return -1
    let n = 0; for (let k = 1; k <= 12; k++) n = n * 2 + (bit(k) ? 1 : 0)
    return n
  } catch (e) { return -2 }
}

// basic functional report (preload, IPC, origin)
const info = { href: location.href, origin: location.origin, preload: window.__preloadProbe ? { ...window.__preloadProbe } : null, apiKeys: bridge ? Object.keys(bridge) : null, requireInMainWorld: typeof require, dpr: devicePixelRatio, inner: [innerWidth, innerHeight] }

if (ROLE === 'engine') {
  const v = document.createElement('video')
  v.src = q.media; v.muted = true; v.loop = true; v.preload = 'auto'; v.playsInline = true
  document.body.appendChild(v)
  window.__engine = { video: v, readFrame: () => readFrame(v) } // reachable by same-origin children (main world)
  let q0 = null, kids = {}
  // fallback path for cross-origin children: MessageChannel + VideoFrame transfer
  const ports = []
  window.addEventListener('message', (e) => {
    if (e.data?.t !== 'vf-hello' || !e.ports[0]) return
    const port = e.ports[0]; ports.push(port)
    let last = -1
    port.onmessage = () => { // child asks for current frame
      const tv = v.getVideoPlaybackQuality().totalVideoFrames
      if (tv === last || v.readyState < 2) { port.postMessage({ same: true }); return }
      last = tv
      try { const f = new VideoFrame(v); port.postMessage({ f, tv }, [f]) } catch (err) { port.postMessage({ err: String(err) }) }
    }
  })
  bridge.receive('POC', (m) => {
    if (m.t === 'go') { // startAt = shared clock (stands in for the audio master)
      const pos = Math.max(0, (Date.now() - m.startAt) / 1000)
      if (pos > 0.05) { v.currentTime = pos % (v.duration || 60) }
      setTimeout(() => v.play().catch((e) => send('err', { e: String(e) })), Math.max(0, m.startAt - Date.now()))
    }
    if (m.t === 'open') {
      for (const o of m.outs) {
        const url = `index.html?${new URLSearchParams({ role: 'output', id: o.id, fit: o.fit, driver: m.driver, load: m.load, mode: m.mode, check: o.check ? '1' : '0' })}`
        kids[o.id] = window.open(url, o.id)
        info['proxy_' + o.id] = kids[o.id] ? 'WindowProxy' : 'null'
      }
      send('opened', { info })
    }
    if (m.t === 'measure') {
      if (m.on) { measuring = true; q0 = v.getVideoPlaybackQuality() }
      else { measuring = false; const qq = v.getVideoPlaybackQuality(); send('stats', { stats: { dropped: qq.droppedVideoFrames - q0.droppedVideoFrames, total: qq.totalVideoFrames - q0.totalVideoFrames, longtasks }, info }) }
    }
    if (m.t === 'state') send('state', { ct: v.currentTime, frame: readFrame(v), paused: v.paused, tv: v.getVideoPlaybackQuality().totalVideoFrames })
  })
  v.addEventListener('loadeddata', () => send('engine-ready', { info, dur: v.duration, vw: v.videoWidth }), { once: true })
  v.addEventListener('error', () => send('err', { e: 'video error ' + v.error?.code }))
}

if (ROLE === 'output') {
  const DRIVER = q.driver || 'raf', CHECK = q.check === '1'
  const ov = document.createElement('div'); ov.className = 'ov'; ov.textContent = 'Santo, Santo, Santo (DOM)'; document.body.appendChild(ov)
  const c = document.createElement('canvas'); document.body.appendChild(c)
  const ctx = c.getContext('2d', { alpha: false })
  const size = () => { c.width = Math.round(innerWidth * devicePixelRatio); c.height = Math.round(innerHeight * devicePixelRatio) }
  size(); addEventListener('resize', size)
  // opener access test (main world)
  let v = null
  try { v = window.opener.document.querySelector('video'); info.openerAccess = v ? 'OK: opener.document.querySelector(video)' : 'opener ok, no video yet' } catch (e) { info.openerAccess = 'BLOCKED: ' + e.name + ': ' + e.message }
  try { info.openerOrigin = window.opener.location.href } catch (e) { info.openerOrigin = 'blocked' }
  let mode = q.mode === 'vf' || !v ? 'vf' : 'opener'
  info.drawMode = mode
  // IPC test via contextBridge
  const ipc = { startupReceived: null, ackRtMs: null }
  let pingT = 0
  bridge.receive('STARTUP', (a) => { ipc.startupReceived = a })
  bridge.receive('POC', (m) => {
    if (m.t === 'ack') { ipc.ackRtMs = +(performance.now() - pingT).toFixed(2); send('ipc', { ipc }) }
    if (m.t === 'measure') { if (m.on) { measuring = true; reset() } else { measuring = false; send('stats', { stats: summary(), info: { ...info, ipc } }) } }
    if (m.t === 'probe') send('probe', { frame: CHECK ? readFrame(c) : null, draws: st.draws, hidden: document.hidden, vis: document.visibilityState })
  })
  pingT = performance.now(); send('hello', { info })

  // heavy DOM text: 3 layers x 200 spans, layout-triggering CSS animation + text swap every 2s
  // load=1: 3 layers x 200 spans animated (layout each frame); load=2: 1 layer x 200 animated; load=3: 3 x 200 static, text swap every 2 s
  if (['1', '2', '3'].includes(q.load)) {
    if (q.load === '3') document.styleSheets[0].insertRule('.layer span{animation:none!important}')
    for (let L = 0; L < (q.load === '2' ? 1 : 3); L++) {
      const d = document.createElement('div'); d.className = 'layer'; d.style.top = (L * 30) + '%'
      for (let i = 0; i < 200; i++) { const s = document.createElement('span'); s.textContent = `palavra${i} `; s.style.animationDelay = (i % 13) * 0.1 + 's'; d.appendChild(s) }
      document.body.appendChild(d)
    }
    let k = 0; setInterval(() => { k++; for (const s of document.querySelectorAll('.layer span')) s.textContent = `v${k}-${s.textContent.length} ` }, 2000)
  }

  let st
  function reset() { st = { draws: 0, drawMs: [], intervals: [], lastNow: null, seq: [], skipped: 0, dup: 0, lastFrame: null, unreadable: 0, vfErr: 0 } }
  reset()
  function blit(src, sw0, sh0) {
    const cw = c.width, ch = c.height
    if (q.fit === 'cover') { const s = Math.max(cw / sw0, ch / sh0), sw = cw / s, sh = ch / s; ctx.drawImage(src, (sw0 - sw) / 2, (sh0 - sh) / 2, sw, sh, 0, 0, cw, ch) }
    else { const s = Math.min(cw / sw0, ch / sh0), dw = sw0 * s, dh = sh0 * s; ctx.drawImage(src, (cw - dw) / 2, (ch - dh) / 2, dw, dh) }
  }
  let firstDrawSent = false
  function after(now, t0) {
    st.draws++
    if (measuring) {
      st.drawMs.push(performance.now() - t0)
      if (st.lastNow != null) st.intervals.push(now - st.lastNow)
      if (CHECK) {
        const n = readFrame(c)
        if (n < 0) st.unreadable++
        else { if (st.lastFrame != null) { const d = n - st.lastFrame; if (d === 0) st.dup++; else if (d > 1) st.skipped += d - 1 } st.lastFrame = n; if (st.seq.length < 4000) st.seq.push(n) }
      }
    }
    st.lastNow = now
    if (!firstDrawSent) { firstDrawSent = true; send('first-draw', { wall: Date.now(), ct: v ? v.currentTime : null }) }
  }
  function drawOpener(now) { const t0 = performance.now(); blit(v, v.videoWidth, v.videoHeight); after(now, t0) }

  if (mode === 'opener') {
    if (DRIVER === 'rvfc') {
      const cb = (now, md) => { drawOpener(md.expectedDisplayTime || now); v.requestVideoFrameCallback(cb) }
      v.requestVideoFrameCallback(cb)
    } else {
      let last = -1
      const ALL = DRIVER === 'raf-all' // draw every vsync, no gating
      const raf = (now) => { if (v.readyState >= 2) { const tv = ALL ? -2 - st.draws : v.getVideoPlaybackQuality().totalVideoFrames; if (tv !== last) { last = tv; drawOpener(now) } } requestAnimationFrame(raf) }
      requestAnimationFrame(raf)
    }
  } else { // VideoFrame over MessageChannel (works cross-origin)
    const ch = new MessageChannel(); window.opener.postMessage({ t: 'vf-hello' }, '*', [ch.port2])
    let pending = false, rafNow = 0
    ch.port1.onmessage = (e) => {
      pending = false
      if (e.data.err) { st.vfErr++; return }
      if (e.data.f) { const f = e.data.f, t0 = performance.now(); blit(f, f.displayWidth, f.displayHeight); f.close(); after(rafNow, t0) }
    }
    const raf = (now) => { if (!pending) { pending = true; rafNow = now; ch.port1.postMessage(0) } requestAnimationFrame(raf) }
    requestAnimationFrame(raf)
  }
  function summary() {
    const iv = st.intervals
    return { id: ID, driver: DRIVER, mode, check: CHECK, canvas: [c.width, c.height], draws: st.draws, drawMsMean: +mean(st.drawMs).toFixed(2), drawMsMax: +Math.max(0, ...st.drawMs).toFixed(2),
      cadence: { n: iv.length, mean: +mean(iv).toFixed(2), sd: +sd(iv).toFixed(2), over50: iv.filter((x) => x > 50.5).length, max: Math.round(Math.max(0, ...iv)), hist: hist(iv) },
      frames: CHECK ? { skipped: st.skipped, dup: st.dup, unreadable: st.unreadable, first: st.seq[0], last: st.seq[st.seq.length - 1], n: st.seq.length } : null,
      vfErr: st.vfErr, longtasks: { n: longtasks.length, max: Math.max(0, ...longtasks), sum: longtasks.reduce((a, b) => a + b, 0) } }
  }
}

if (ROLE === 'ctl') { // control: standalone BrowserWindow (not a child), animated DOM only
  const d = document.createElement('div'); d.className = 'ov'; document.body.appendChild(d); document.body.style.background = '#000'
  let n = 0; const f = () => { d.textContent = 'ctl ' + n++; requestAnimationFrame(f) }; f()
}
