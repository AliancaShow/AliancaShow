import type { User } from "firebase/auth"
import { ref, update, type Database } from "firebase/database"
import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import type { ProjectShowRef } from "../../types/Projects"
import { requestMain, sendMain } from "../IPC/main"
import { folders, projects, shows } from "../stores"
import { cultoDoProjeto } from "./agendas"
import { meuComputador, souDonoDe } from "./aliancaControle"

/**
 * O que foi montado direto no computador tambem aparece no celular, como item
 * "local": nome e referencia, sem arquivo. Sem isso o culto aparecia pela
 * metade la -- quem montava pelo celular nao sabia o que ja estava resolvido.
 *
 * Vai nos dois sentidos: remover um item "local" no celular tira do culto aqui
 * tambem (o celular avisa isso ao remover).
 *
 * Cada computador mexe so nos itens que ele publicou ("porComputador"), e so
 * na agenda em que e dono. Sem essa marca, a maquina de casa apagaria do
 * celular o que a da igreja montou.
 *
 * "Removido no celular" so vale para chave que este computador ja VIU no
 * banco. Escrita recem-feita ainda nao voltou pelo ouvinte; tratar a ausencia
 * dela como remocao tiraria do culto o que acabou de ser publicado.
 */

const CHAVE_VISTOS = "aliancaLocaisVistos"
let vistos: { [culto: string]: string[] } | null = null

/** chave estavel por item: o mesmo show ou arquivo cai sempre no mesmo lugar */
function chaveDoItem(id: string) {
    let h = 5381
    for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) >>> 0
    return `local_${h.toString(36)}`
}

function nomeDoItem(item: ProjectShowRef) {
    const tipo = item.type || "show"
    const nome =
        tipo === "show"
            ? get(shows)[item.id]?.name
            : item.name ||
              item.id
                  .split(/[\\/]/)
                  .pop()
                  ?.replace(/\.[^.]+$/, "")
    return String(nome || "Item").slice(0, 60)
}

export async function sincronizarLocais(porAgenda: { [agenda: string]: { [culto: string]: any } }, db: Database | null, usuario: User | null | undefined, vindosDoRemote: { [culto: string]: string[] }) {
    const meuId = meuComputador()
    if (!db || !usuario || !meuId) return false

    if (!vistos) vistos = (await requestMain(Main.GET_STORE_VALUE, { file: "config", key: CHAVE_VISTOS })) || {}
    const antes = JSON.stringify(vistos)

    let mudou = false
    const escritas: { [caminho: string]: any } = {}

    for (const projetoId of Object.keys(get(projects))) {
        const culto = cultoDoProjeto(projetoId, get(projects), get(folders))
        if (!culto || !souDonoDe(culto.agenda.id)) continue

        const chave = `${culto.agenda.id}/${culto.cultoId}`
        const base = `agendas/${culto.agenda.id}/cultos/${culto.cultoId}`
        const doCelular = new Set(vindosDoRemote[chave] || [])

        // o que este computador ja tem publicado neste culto
        const noBanco = new Set(
            Object.entries(porAgenda[culto.agenda.id]?.[culto.cultoId]?.itens || {})
                .filter(([, item]: [string, any]) => item?.tipo === "local" && item.porComputador === meuId)
                .map(([k]) => k)
        )

        // o que foi montado aqui: tudo menos secao e o que veio do celular
        const locais: { [k: string]: ProjectShowRef } = {}
        for (const item of get(projects)[projetoId]?.shows || []) {
            if (item.type === "section" || doCelular.has(item.id) || item.id.startsWith("remote_")) continue
            locais[chaveDoItem(item.id)] = item
        }

        // removido no celular: ja esteve no banco, saiu de la, e continua aqui
        const removidos = (vistos[chave] || []).filter((k) => !noBanco.has(k) && locais[k])
        if (removidos.length) {
            const fora = new Set(removidos.map((k) => locais[k].id))
            projects.update((a) => {
                a[projetoId].shows = (a[projetoId].shows || []).filter((s) => !fora.has(s.id))
                return a
            })
            removidos.forEach((k) => delete locais[k])
            mudou = true
        }

        let ordem = 0
        for (const [k, item] of Object.entries(locais)) {
            ordem++
            if (noBanco.has(k)) continue
            escritas[`${base}/itens/${k}`] = {
                nome: nomeDoItem(item),
                tipo: "local",
                ref: String(item.id).slice(0, 400),
                midia: String(item.type || "show").slice(0, 20),
                porComputador: meuId,
                uid: usuario.uid,
                email: usuario.email || "",
                // a ordem do culto vai junto, para o celular listar na mesma sequencia
                enviadoEm: Date.now() + ordem
            }
            escritas[`${base}/data`] = culto.cultoId
        }
        // tirado do culto aqui: sai do celular tambem
        for (const k of noBanco) if (!locais[k]) escritas[`${base}/itens/${k}`] = null

        vistos[chave] = [...noBanco].filter((k) => locais[k])
    }

    if (Object.keys(escritas).length) {
        try {
            await update(ref(db), escritas)
        } catch (err) {
            console.error("Falha ao publicar o que foi montado no computador:", err)
        }
    }

    if (JSON.stringify(vistos) !== antes) sendMain(Main.SET_STORE_VALUE, { file: "config", key: CHAVE_VISTOS, value: vistos })
    return mudou
}
