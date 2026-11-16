// Guarda do ramo CLASSICO (chave `aliancaLayoutCulto`). Congela o texto do que o Culto classico executa.
//
//   node scripts/classico-guarda.mjs [--exigir-blocos] [--ancora <sha>]
//
// O ramo antigo de uma fatia de Culto vai entre marcadores (em comentario, em qualquer linguagem):
//     CLASSICO:INICIO <id>   ...   CLASSICO:FIM <id>
// O texto entre eles (CRLF -> LF, sem o recuo de cada linha) e hasheado e comparado a `scripts/classico.lock.json`:
//     { "<id>": { "arquivo": "src/frontend/...", "sha": "<sha256>" } }
// Reprova quando: bloco sumiu ou mudou de hash; marcador sem par; id duplicado; arquivo marcado fora do lock; lock apontando para arquivo
// inexistente ou sem o bloco; `--exigir-blocos` com lock vazio; bloco que NAO existe, byte a byte (menos o recuo), no mesmo arquivo na
// ancora (revisao C15: o "antigo verbatim" nao pode nascer alterado). Mudar o hash de um bloco existente exige CLASSICO_PERMITE=<id>
// na linha de comando E aparece como diferenca do lock no PR. Na fatia 0 nao ha bloco real: so a mecanica e provada (fixtures).
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const unificar = (t) => t.replace(/\r\n/g, "\n")
export const semRecuo = (t) =>
    unificar(t)
        .split("\n")
        .map((l) => l.trim())
        .join("\n")
export const shaDoBloco = (texto) => createHash("sha256").update(semRecuo(texto), "utf8").digest("hex")

const MARCA = /CLASSICO:(INICIO|FIM)\s+([A-Za-z0-9_.:-]+)/

/** extrai os blocos de um texto: [{ id, texto }] e erros de marcador */
export function extrairBlocos(arquivo, texto) {
    const blocos = []
    const erros = []
    const abertos = new Map()
    unificar(texto)
        .split("\n")
        .forEach((linha, i) => {
            const m = MARCA.exec(linha)
            if (!m) return
            const [, tipo, id] = m
            if (tipo === "INICIO") {
                if (abertos.has(id)) erros.push(`${arquivo}:${i + 1}: marcador INICIO ${id} repetido sem FIM`)
                abertos.set(id, { linha: i, corpo: [] })
            } else {
                const a = abertos.get(id)
                if (!a) return void erros.push(`${arquivo}:${i + 1}: FIM ${id} sem INICIO`)
                blocos.push({ id, texto: a.corpo.join("\n") })
                abertos.delete(id)
            }
        })
    // linhas entre marcadores: segunda passada simples (corpo = linhas apos INICIO e antes de FIM)
    const linhas = unificar(texto).split("\n")
    const reais = []
    const pilha = new Map()
    linhas.forEach((linha, i) => {
        const m = MARCA.exec(linha)
        if (m && m[1] === "INICIO") pilha.set(m[2], i)
        else if (m && m[1] === "FIM" && pilha.has(m[2])) {
            reais.push({ id: m[2], texto: linhas.slice(pilha.get(m[2]) + 1, i).join("\n") })
            pilha.delete(m[2])
        }
    })
    for (const [id, a] of abertos) erros.push(`${arquivo}:${a.linha + 1}: INICIO ${id} sem FIM`)
    return { blocos: reais, erros }
}

/**
 * @param {{ arquivos: Record<string,string>, lock: Record<string,{arquivo:string,sha:string}>, permite?: string[], exigirBlocos?: boolean, ancoraTexto?: (arquivo:string)=>string|null }} e
 * @returns {string[]} erros
 */
export function verificar({ arquivos, lock, permite = [], exigirBlocos = false, ancoraTexto = null }) {
    const erros = []
    const achados = new Map()
    for (const [arquivo, texto] of Object.entries(arquivos)) {
        const { blocos, erros: e } = extrairBlocos(arquivo, texto)
        erros.push(...e)
        for (const b of blocos) {
            if (achados.has(b.id)) erros.push(`bloco ${b.id} duplicado (${achados.get(b.id).arquivo} e ${arquivo})`)
            else achados.set(b.id, { arquivo, texto: b.texto })
        }
    }
    const ids = Object.keys(lock || {})
    if (exigirBlocos && !ids.length) erros.push("--exigir-blocos: o lock esta vazio")
    for (const id of ids) {
        const l = lock[id]
        if (!(l.arquivo in arquivos)) {
            erros.push(`lock ${id}: aponta para arquivo inexistente (${l.arquivo})`)
            continue
        }
        const a = achados.get(id)
        if (!a) {
            erros.push(`bloco ${id}: sumiu de ${l.arquivo}`)
            continue
        }
        if (a.arquivo !== l.arquivo) erros.push(`bloco ${id}: mudou de arquivo (${l.arquivo} -> ${a.arquivo})`)
        if (shaDoBloco(a.texto) !== l.sha && !permite.includes(id)) erros.push(`bloco ${id}: o texto mudou (hash diferente do lock; so com CLASSICO_PERMITE=${id} e o lock no diff)`)
        if (ancoraTexto) {
            const antigo = ancoraTexto(l.arquivo)
            if (antigo == null || !semRecuo(antigo).includes(semRecuo(a.texto))) erros.push(`bloco ${id}: o texto NAO existe em ${l.arquivo} na ancora (o ramo antigo nao pode nascer alterado)`)
        }
    }
    for (const [id, a] of achados) if (!(id in (lock || {}))) erros.push(`bloco ${id} (${a.arquivo}) fora do lock`)
    return erros
}

// ---------- CLI ----------
function listar(dir, acc = []) {
    for (const n of readdirSync(dir)) {
        if (n === "node_modules" || n.startsWith(".")) continue
        const p = join(dir, n)
        if (statSync(p).isDirectory()) listar(p, acc)
        else if (/\.(svelte|ts|js|css)$/.test(n)) acc.push(p.split(String.fromCharCode(92)).join("/"))
    }
    return acc
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const ia = process.argv.indexOf("--ancora")
    const ancora = ia > 0 ? process.argv[ia + 1] : null
    const arquivos = {}
    for (const f of listar("src/frontend")) arquivos[f] = readFileSync(f, "utf8")
    const lock = existsSync("scripts/classico.lock.json") ? JSON.parse(readFileSync("scripts/classico.lock.json", "utf8")) : {}
    const ancoraTexto = ancora
        ? (f) => {
              try {
                  return execFileSync("git", ["show", `${ancora}:${f}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 })
              } catch {
                  return null
              }
          }
        : null
    const erros = verificar({ arquivos, lock, permite: (process.env.CLASSICO_PERMITE || "").split(",").filter(Boolean), exigirBlocos: process.argv.includes("--exigir-blocos"), ancoraTexto })
    if (erros.length) {
        console.error(`CLASSICO: ${erros.length} erro(s)`)
        for (const e of erros) console.error("  - " + e)
        process.exit(1)
    }
    console.log(`CLASSICO: ok (${Object.keys(lock).length} blocos travados)`)
}
