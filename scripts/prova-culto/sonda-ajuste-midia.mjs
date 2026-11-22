// Sonda (22/nov): o ajuste de uma imagem (encaixe, filtro, espelhar) sobrevive a salvar e a reabrir?
//   node scripts/prova-culto/sonda-ajuste-midia.mjs [fase]   fase: "gravar" (padrao) ou "conferir" (depois de reabrir o app)
import { readFileSync } from "node:fs"
import { abrir, esperar } from "./lib.mjs"

const fase = process.argv[2] || "gravar"
const STORE = (process.env.FS_PERFIL_DIR || "C:/prova-perfil-telao") + "/store/media.json"
const j = await abrir("principal", { buffer: true })
const CAMINHO = await j.ev(`return Object.values(get(S.mediaFolders))[0].path + "/f1.png"`)

const noArquivo = () => {
    const m = JSON.parse(readFileSync(STORE, "utf8"))
    const k = Object.keys(m).find((x) => x.replace(/\\/g, "/").toLowerCase() === CAMINHO.replace(/\\/g, "/").toLowerCase())
    return { chave: k, valor: k ? m[k] : null }
}

if (fase === "gravar") {
    const r = await j.ev(`
      const {updateStore}=await import(U("components/helpers/update"))
      const c=${JSON.stringify(CAMINHO)}
      updateStore("media",{keys:[c,"fit"],value:"cover"})
      updateStore("media",{keys:[c,"flipped"],value:true})
      await esp(300)
      const memoria=get(S.media)[c]
      const {save}=await import(U("utils/save")); await save(); await esp(3000)
      return {memoria, depois:get(S.media)[c]}`)
    console.log("MEMORIA", JSON.stringify(r))
    console.log("ARQUIVO", JSON.stringify(noArquivo()))
} else {
    console.log("REABERTO memoria", JSON.stringify(await j.ev(`return get(S.media)[${JSON.stringify(CAMINHO)}]`)))
    console.log("REABERTO arquivo", JSON.stringify(noArquivo()))
}
process.exit(0)
