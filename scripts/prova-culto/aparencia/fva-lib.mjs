// Ferramentas da FV-A: varredura do DOM, estados e comparacao.
import { writeFileSync, readFileSync } from "node:fs"
import { inflateSync } from "node:zlib"
import { abrir, abrirShow, esperar, clicarSel } from "./a8lib.mjs"
import { clicarEm, mover, caixa } from "./f4lib.mjs"
export { abrir, esperar, clicarSel, clicarEm, mover, caixa, abrirShow }
export const ID = "impulso_aos_teus_pes"

// varredura: uma linha por elemento de body *
export const VARREDURA = String.raw`
const norm=(s)=>String(s||"").replace(/svelte-[a-z0-9]+/g,"").replace(/(?<![\w-])s-[\w-]{12}(?![\w-])/g,"s-X").replace(/(zoom|picker|id)_[0-9a-f]{6,}/g,"$1_X").replace(/var\(--(?:live-opacity|live|sel-wash|sel-line|conteudo-acento|modo-[a-z-]+|prep-rgb|prep|aviso|sobre-acento),\s*([^()]*(?:\([^()]*\)[^()]*)*)\)/g,"$1").replace(/\s+/g," ").trim()
const PROPS=["color","backgroundColor","borderTopColor","borderRightColor","borderBottomColor","borderLeftColor","outlineColor","boxShadow","fill","stroke","caretColor","backgroundImage","textDecorationColor","columnRuleColor"]
const out=[]
const skip=(e)=>!!e.closest(".clockArea, .clock, #clock, .noAr")
for(const e of document.querySelectorAll("body *")){
  const cs=getComputedStyle(e); const r=e.getBoundingClientRect()
  const attrs=[...e.attributes].map(a=>a.name+"="+(a.name==="class"?norm(a.value).split(" ").filter(Boolean).sort().join(" "):norm(a.value))).sort().join(" ")
  const own=skip(e)?"":[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).filter(Boolean).join("|")
  const c={}; for(const p of PROPS) c[p]=cs[p]
  const est={fontSize:cs.fontSize,fontWeight:cs.fontWeight,opacity:cs.opacity,visibility:cs.visibility,display:cs.display,pointerEvents:cs.pointerEvents,zIndex:cs.zIndex}
  out.push({sig:e.tagName+" "+attrs+" #"+own, rect:[r.x,r.y,r.width,r.height].map(v=>Math.round(v*100)/100), cor:c, ff:cs.fontFamily, est, skip:skip(e), tag:e.tagName.toLowerCase()+"."+norm(e.getAttribute("class")||"").split(" ").join(".")})
}
return JSON.stringify({vars:{sec:getComputedStyle(document.body).getPropertyValue("--secondary"),st:getComputedStyle(document.querySelector("main")||document.body).getPropertyValue("--secondary-text")}, ds:{...document.body.dataset}, els:out})`

export async function guardar(j, dir, nome) {
    const dados = await j.ev(VARREDURA)
    writeFileSync(`${dir}/${nome}.json`, dados)
    await j.foto(`${dir}/${nome}.png`)
}

export async function botaoTexto(j, escopo, texto) {
    return clicarSel(j, `[...document.querySelectorAll(${JSON.stringify(escopo)})].find(b=>b.innerText.trim()===${JSON.stringify(texto)})`, texto)
}

// ---- PNG
export function lerPng(arq) {
    const b = readFileSync(arq)
    let p = 8,
        w,
        h,
        tipo = 6,
        idat = []
    while (p < b.length) {
        const n = b.readUInt32BE(p),
            t = b.toString("ascii", p + 4, p + 8)
        if (t === "IHDR") {
            w = b.readUInt32BE(p + 8)
            h = b.readUInt32BE(p + 12)
            tipo = b[p + 17]
        }
        if (t === "IDAT") idat.push(b.subarray(p + 8, p + 8 + n))
        p += 12 + n
    }
    const raw = inflateSync(Buffer.concat(idat)),
        bpp = tipo === 2 ? 3 : 4,
        st = w * bpp,
        px = Buffer.alloc(h * st)
    for (let y = 0; y < h; y++) {
        const f = raw[y * (st + 1)],
            li = y * (st + 1) + 1
        for (let x = 0; x < st; x++) {
            const a = x >= bpp ? px[y * st + x - bpp] : 0,
                u = y ? px[(y - 1) * st + x] : 0,
                c = x >= bpp && y ? px[(y - 1) * st + x - bpp] : 0
            let v = raw[li + x]
            if (f === 1) v += a
            else if (f === 2) v += u
            else if (f === 3) v += (a + u) >> 1
            else if (f === 4) {
                const pp = a + u - c,
                    pa = Math.abs(pp - a),
                    pb = Math.abs(pp - u),
                    pc = Math.abs(pp - c)
                v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c
            }
            px[y * st + x] = v & 255
        }
    }
    if (bpp === 4) return { w, h, px }
    const rgba = Buffer.alloc(w * h * 4)
    for (let i = 0, j = 0; i < w * h; i++) {
        rgba[j++] = px[i * 3]
        rgba[j++] = px[i * 3 + 1]
        rgba[j++] = px[i * 3 + 2]
        rgba[j++] = 255
    }
    return { w, h, px: rgba }
}
// pixels diferentes (limiar por canal) e a caixa envolvente
export function difPng(a, b, lim = 2, mascara = []) {
    const A = lerPng(a),
        B = lerPng(b)
    if (A.w !== B.w || A.h !== B.h) return { n: -1, dim: [A.w, A.h, B.w, B.h] }
    let n = 0,
        x0 = 1e9,
        y0 = 1e9,
        x1 = -1,
        y1 = -1
    for (let y = 0; y < A.h; y++)
        for (let x = 0; x < A.w; x++) {
            if (mascara.some((m) => x >= m[0] && x < m[0] + m[2] && y >= m[1] && y < m[1] + m[3])) continue
            const i = (y * A.w + x) * 4
            if (Math.abs(A.px[i] - B.px[i]) > lim || Math.abs(A.px[i + 1] - B.px[i + 1]) > lim || Math.abs(A.px[i + 2] - B.px[i + 2]) > lim) {
                n++
                x0 = Math.min(x0, x)
                y0 = Math.min(y0, y)
                x1 = Math.max(x1, x)
                y1 = Math.max(y1, y)
            }
        }
    return { n, caixa: n ? [x0, y0, x1 - x0 + 1, y1 - y0 + 1] : null }
}
