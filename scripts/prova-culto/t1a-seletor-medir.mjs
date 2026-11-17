// T-1a-2: mede os retangulos do seletor Culto | Preparar (so isto), para a referencia (FS_REPO=../ref-f0c) ou o HEAD. Mesmo calculo de t1a-barra.mjs.
//   T1A_TAG=ref FS_REPO=../ref-f0c node scripts/prova-culto/t1a-seletor-medir.mjs
import { writeFileSync } from "node:fs"
import { abrir, esperar, irParaModo, prepararCulto, recarregar } from "./t1aLib.mjs"
const j = await abrir("principal")
await recarregar(j)
await prepararCulto(j)
await esperar(1000)
const retDo = () => j.ev(`const b=document.querySelector(".top.panel .modo").getBoundingClientRect(); return [b.x,b.y,b.width,b.height].map(v=>Math.round(v*100)/100)`)
const culto = await retDo()
await irParaModo(j, "Preparar")
const preparar = await retDo()
writeFileSync(`../gravacoes/t1a-seletor-${process.env.T1A_TAG || "head"}.json`, JSON.stringify({ culto, preparar }))
console.log(process.env.T1A_TAG || "head", JSON.stringify({ culto, preparar }))
j.fechar()
