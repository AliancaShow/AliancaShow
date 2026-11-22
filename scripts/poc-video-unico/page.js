const { ipcRenderer } = require('electron')
const q = Object.fromEntries(new URLSearchParams(location.search))
const ROLE = q.role, ID = q.id, VARIANT = q.variant
document.title = ID
const hud = document.getElementById('hud'); hud.textContent = `${ID} | variant ${VARIANT} | ${ROLE}`
let measuring = false
const probes = [], samples = [], extra = { role: ROLE }
const wallNow = () => performance.timeOrigin + performance.now()
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0
const sd = (a, m) => a.length ? Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) : 0
const hist = (a) => { const h = {}; for (const x of a) { const b = Math.round(x / (1000 / 60)); h[b] = (h[b] || 0) + 1 } return h } // in vsyncs
const ready = () => ipcRenderer.send('ready')

// ---------- probes ----------
function addVideoProbe(label, video) {
  const p = { label, kind: 'video', el: video, intervals: [], skipped: 0, frames: 0, lastNow: null, lastPres: null, lastMedia: null, q0: null, readable: true }
  const cb = (now, md) => {
    now = md.expectedDisplayTime || now // vsync-quantized presentation time
    if (measuring) { if (p.lastNow != null) p.intervals.push(now - p.lastNow); if (p.lastPres != null && md.presentedFrames - p.lastPres > 1) p.skipped += md.presentedFrames - p.lastPres - 1; p.frames++ }
    p.lastNow = now; p.lastPres = md.presentedFrames; p.lastMedia = md.mediaTime
    video.requestVideoFrameCallback(cb)
  }
  video.requestVideoFrameCallback(cb)
  probes.push(p); return p
}
function addCanvasProbe(label, canvas, readable) { const p = { label, kind: 'canvas', el: canvas, readable, draws: 0, drawMs: [], intervals: [], lastNow: null }; probes.push(p); return p }

// frame-number barcode burned at y=0.90..0.96, 13 boxes of iw/32 at x=(k+0.5)/16 (box 0 = marker)
const sc = document.createElement('canvas'); sc.width = 160; sc.height = 90
const sctx = sc.getContext('2d', { willReadFrequently: true })
function readFrame(el) {
  try {
    sctx.drawImage(el, 0, 0, 160, 90)
    const row = sctx.getImageData(0, 84, 160, 1).data
    const bit = (k) => { const i = Math.round((k + 0.5) * 10) * 4; return (row[i] + row[i + 1] + row[i + 2]) / 3 > 128 }
    if (!bit(0)) return -1
    let n = 0; for (let k = 1; k <= 12; k++) n = n * 2 + (bit(k) ? 1 : 0)
    return n
  } catch (e) { return -2 }
}
function scheduleTick() {
  const t = wallNow(), next = Math.ceil((t + 1) / 250) * 250
  setTimeout(() => {
    if (measuring) { const late = +(wallNow() - next).toFixed(1); for (const p of probes) if (p.readable) samples.push({ tick: Math.round(next / 250), label: p.label, frame: readFrame(p.el), media: p.lastMedia != null ? Math.round(p.lastMedia * 30) : null, late }) }
    scheduleTick()
  }, next - t)
}
scheduleTick()

function summarize() {
  return probes.map((p) => {
    const r = { label: p.label, kind: p.kind }
    if (p.kind === 'video') { const qq = p.el.getVideoPlaybackQuality(); r.dropped = qq.droppedVideoFrames - p.q0.droppedVideoFrames; r.total = qq.totalVideoFrames - p.q0.totalVideoFrames; r.skippedPresented = p.skipped }
    else { r.draws = p.draws; r.drawMsMean = +mean(p.drawMs).toFixed(2); r.drawMsMax = +Math.max(0, ...p.drawMs).toFixed(2) }
    const iv = p.intervals, m = mean(iv)
    r.cadence = { n: iv.length, mean: +m.toFixed(2), sd: +sd(iv, m).toFixed(2), over50: iv.filter((x) => x > 50.5).length, hist: hist(iv), max: Math.round(Math.max(0, ...iv)) }
    return r
  })
}
ipcRenderer.on('measure', (_e, { on }) => {
  if (on) { measuring = true; for (const p of probes) if (p.kind === 'video') p.q0 = p.el.getVideoPlaybackQuality() }
  else { measuring = false; ipcRenderer.send('stats', { id: ID, role: ROLE, probes: summarize(), samples, extra }) }
})

// ---------- helpers ----------
function fileVideo(parent, { muted, fit, cls }) {
  const v = document.createElement('video')
  v.src = q.media; v.muted = muted; v.preload = 'auto'; v.playsInline = true
  v.style.objectFit = fit || 'contain'; if (cls) v.id = cls
  parent.appendChild(v)
  return v
}
function playAt(v) { ipcRenderer.on('go', (_e, { startAt }) => setTimeout(() => v.play().catch((e) => (extra.playErr = String(e))), Math.max(0, startAt - Date.now()))) }
function overlay(doc, text) { const d = doc.createElement('div'); d.className = 'ov'; d.textContent = text; d.style.cssText = 'position:absolute;left:0;right:0;top:40%;text-align:center;font:bold 32px sans-serif;color:#fff;text-shadow:0 0 6px #000;pointer-events:none;z-index:3'; doc.body.appendChild(d) }

// ---------- roles ----------
if (ROLE === 'out-file' || ROLE === 'main-file') {
  const v = fileVideo(document.body, { muted: q.muted !== '0', fit: q.fit, cls: ROLE === 'main-file' ? 'pv' : '' })
  if (ROLE === 'out-file') overlay(document, 'Santo, Santo, Santo (DOM)')
  addVideoProbe(ID, v); playAt(v)
  v.addEventListener('canplaythrough', ready, { once: true })
}

if (ROLE === 'main-none') { hud.textContent += ' | sem preview (owner oculto)'; ready() }

if (ROLE === 'cap') {
  ;(async () => {
    let id = null
    for (let i = 0; i < 50 && !id; i++) { try { id = await ipcRenderer.invoke('source-id') } catch {} if (!id) await new Promise((r) => setTimeout(r, 200)) }
    extra.sourceId = id
    const t0 = performance.now()
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: id, maxFrameRate: 30, maxWidth: 1920, maxHeight: 1080 } } })
    const v = document.createElement('video'); v.muted = true; v.autoplay = true; v.srcObject = stream; v.style.objectFit = q.fit || 'contain'
    if (ID === 'MAIN') v.id = 'pv'
    document.body.appendChild(v); if (ID !== 'MAIN') overlay(document, 'Santo, Santo, Santo (DOM)')
    await v.play(); extra.gumMs = Math.round(performance.now() - t0); extra.track = stream.getVideoTracks()[0].getSettings()
    addVideoProbe(ID, v); ready()
  })().catch((e) => { extra.err = String(e); hud.textContent += ' ERR ' + e })
}

if (ROLE === 'owner') {
  const OUTS = JSON.parse(q.outs)
  const src = fileVideo(document.body, { muted: false, fit: 'contain', cls: 'pv' }) // the ONLY decoder; plays audio once
  addVideoProbe('SRC', src)
  const kids = []
  src.addEventListener('loadeddata', () => {
    const stream = VARIANT === 'b' ? src.captureStream() : null
    for (const o of OUTS) {
      const w = window.open('about:blank', o.id, `width=${o.w},height=${o.h}`)
      const d = w.document
      d.title = o.id
      d.body.style.cssText = 'margin:0;background:transparent;overflow:hidden'
      if (VARIANT === 'b') {
        const v = d.createElement('video'); v.muted = true; v.autoplay = true; v.playsInline = true
        v.style.cssText = `position:absolute;inset:0;width:100%;height:100%;background:#000;object-fit:${o.fit}`
        v.srcObject = new MediaStream(stream.getVideoTracks()) // video only -> audio stays single, in owner
        d.body.appendChild(v); v.play().catch(() => {})
        addVideoProbe(o.id, v)
      } else {
        const c = d.createElement('canvas'); const dpr = w.devicePixelRatio || 1
        c.width = Math.round(o.w * dpr); c.height = Math.round(o.h * dpr)
        c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;background:#000'
        d.body.appendChild(c)
        kids.push({ o, w, c, ctx: c.getContext('2d', { alpha: false, desynchronized: false }), p: addCanvasProbe(o.id, c, o.fit === 'contain') })
      }
      overlay(d, 'Santo, Santo, Santo (DOM)')
    }
    extra.children = OUTS.map((o) => o.id)
    if (VARIANT === 'b2') startDrawLoop()
    ready()
  }, { once: true })
  playAt(src)

  function drawAll(now) {
    if (!src.videoWidth) return
    const vw = src.videoWidth, vh = src.videoHeight
    for (const k of kids) {
      const cw = k.c.width, ch = k.c.height, t0 = performance.now()
      if (k.o.fit === 'cover') { const s = Math.max(cw / vw, ch / vh), sw = cw / s, sh = ch / s; k.ctx.drawImage(src, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, cw, ch) }
      else { const s = Math.min(cw / vw, ch / vh), dw = vw * s, dh = vh * s; k.ctx.drawImage(src, (cw - dw) / 2, (ch - dh) / 2, dw, dh) }
      if (measuring) { k.p.draws++; k.p.drawMs.push(performance.now() - t0); if (k.p.lastNow != null) k.p.intervals.push(now - k.p.lastNow) }
      k.p.lastNow = now
    }
  }
  function startDrawLoop() {
    // preferred: owner rVFC (one draw per decoded frame). If owner is hidden, rVFC may never fire -> fallback to a child's rAF.
    let got = false
    let stopRvfc = false
    const cb = (now, md) => { if (stopRvfc) return; got = true; drawAll(md.expectedDisplayTime || now); src.requestVideoFrameCallback(cb) }
    src.requestVideoFrameCallback(cb)
    setTimeout(() => {
      if (got && !src.paused && q.owner !== 'hidden') { extra.drawDriver = 'owner-rVFC'; return } // hidden window: rVFC is throttled to ~1 Hz
      stopRvfc = true
      extra.drawDriver = 'child-rAF'
      const w = kids[0].w; let last = -1
      const raf = (now) => { if (src.currentTime !== last) { last = src.currentTime; drawAll(now) } w.requestAnimationFrame(raf) }
      w.requestAnimationFrame(raf)
    }, 3000 + 1500)
  }
}
