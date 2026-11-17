import { writeFileSync } from "node:fs"
import { abrir, esperar } from "./lib.mjs"
const j = await abrir("principal")
await j.ev(`S.activePopup.set(null); S.modoAlianca.set("preparar"); S.activePage.set("show");
S.sirvoAvisosX=1; const A=await import(U("utils/aliancaSirvo")); A.sirvoAvisos.set({linhas:[{chave:"a",texto:"Música trocada"},{chave:"b",texto:"Bloco novo"}],anteriores:false,desde:Date.now()});
const C=await import(U("utils/aliancaSirvoChat")); await esp(800); return 1`)
const r = (await j.enviar("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1365, height: 120, scale: 1 } })).result
writeFileSync(process.argv[2], Buffer.from(r.data, "base64"))
j.fechar()
