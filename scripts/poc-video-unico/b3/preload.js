// Mirror of AliancaShow src/electron/preload.ts (contextBridge "api": send/receive/removeListener/getListeners/showFilePath)
// + a POC-only probe object. Single file: works under sandbox (prod prefs) and non-sandbox (dev prefs).
const { contextBridge, ipcRenderer, webUtils } = require('electron')
const storedReceivers = {}
let openerFromPreload
try { openerFromPreload = window.opener ? (window.opener.document ? 'opener.document OK (isolated world)' : 'opener without document') : 'no opener' } catch (e) { openerFromPreload = 'BLOCKED: ' + e.message }
contextBridge.exposeInMainWorld('api', {
  send: (channel, data, id) => ipcRenderer.send(channel, data, id),
  receive: (channel, func, id) => {
    const receiver = (_e, args, listenedId) => func(args, listenedId)
    if (id && storedReceivers[id]) ipcRenderer.removeListener(channel, storedReceivers[id])
    ipcRenderer.on(channel, receiver)
    if (id) storedReceivers[id] = receiver
  },
  removeListener: (channel, id) => { if (!storedReceivers[id]) return; ipcRenderer.removeListener(channel, storedReceivers[id]); delete storedReceivers[id] },
  getListeners: () => ipcRenderer.eventNames().map((c) => [c.toString(), ipcRenderer.listenerCount(c)]),
  showFilePath: (file) => webUtils.getPathForFile(file),
})
contextBridge.exposeInMainWorld('__preloadProbe', {
  ran: true, sandboxed: !!process.sandboxed, contextIsolated: !!process.contextIsolated,
  hasRequireInMainWorld: 'checked-in-page', href: location.href, openerFromPreload, t: Date.now(),
})
ipcRenderer.on('AUDIO_PORT', (event, data) => { if (event.ports && event.ports.length > 0) window.postMessage({ type: 'AUDIO_PORT_RESPONSE', targetId: data?.targetId }, '*', [event.ports[0]]) })
