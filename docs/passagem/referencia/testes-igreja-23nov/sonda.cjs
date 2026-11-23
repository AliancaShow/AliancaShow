// Sonda de monitores: grava cada mudança que o Windows/Electron anuncia (ligado, desligado, posição, resolução, escala).
// Uso: electron.exe C:\prova-fumacas-23nov\monitores\sonda.cjs --user-data-dir=C:\prova-fumacas-23nov\monitores\ud
// Grava em eventos.jsonl (uma linha por evento) e imprime um resumo legível em cada mudança.
const { app, screen } = require("electron")
const fs = require("fs")
const path = require("path")
const { execFile } = require("child_process")

const ARQ = path.join(__dirname, "eventos.jsonl")
const hora = () => new Date().toLocaleTimeString("pt-BR", { hour12: false }) + "." + String(new Date().getMilliseconds()).padStart(3, "0")
const foto = () =>
    screen
        .getAllDisplays()
        .sort((a, b) => a.bounds.x - b.bounds.x)
        .map((d) => ({ id: d.id, nome: d.label, x: d.bounds.x, y: d.bounds.y, w: d.bounds.width, h: d.bounds.height, escala: d.scaleFactor, primaria: d.id === screen.getPrimaryDisplay().id }))
const resumo = (f) => f.map((d) => `${d.nome}#${d.id} @${d.x},${d.y} ${d.w}x${d.h}${d.escala !== 1 ? " esc" + d.escala : ""}${d.primaria ? " (prim)" : ""}`).join("  |  ")

// o Windows: nome do monitor e caminho do aparelho (WMI), para cruzar com o id do Electron
function wmi(cb) {
    execFile("powershell", ["-NoProfile", "-c", "Get-CimInstance -Namespace root\\wmi WmiMonitorID | % { ((($_.UserFriendlyName | ? {$_ -ne 0}) | % {[char]$_}) -join '') + '=' + $_.InstanceName + '=' + $_.Active }"], { windowsHide: true }, (e, out) => cb(e ? [] : out.trim().split(/\r?\n/)))
}

let n = 0
function gravar(tipo, extra = {}) {
    const f = foto()
    wmi((w) => {
        const linha = { n: ++n, hora: hora(), tipo, ...extra, telas: f, windows: w }
        fs.appendFileSync(ARQ, JSON.stringify(linha) + "\n")
        console.log(`[${linha.hora}] #${n} ${tipo}${extra.mudou ? " " + extra.mudou.join(",") : ""}${extra.tela ? " → " + extra.tela : ""}\n    ${resumo(f)}`)
    })
}

app.disableHardwareAcceleration()
app.whenReady().then(() => {
    gravar("inicio")
    screen.on("display-added", (_e, d) => gravar("LIGOU", { tela: `${d.label}#${d.id}` }))
    screen.on("display-removed", (_e, d) => gravar("DESLIGOU", { tela: `${d.label}#${d.id}` }))
    screen.on("display-metrics-changed", (_e, d, mudou) => gravar("MUDOU", { tela: `${d.label}#${d.id}`, mudou }))
    // marca manual: crie o arquivo marca.txt com o nome da ação que você vai fazer (eu crio para você)
    const marca = path.join(__dirname, "marca.txt")
    fs.watchFile(marca, { interval: 500 }, () => {
        try {
            gravar("MARCA", { acao: fs.readFileSync(marca, "utf8").trim() })
        } catch {}
    })
})
app.on("window-all-closed", (e) => e.preventDefault())
