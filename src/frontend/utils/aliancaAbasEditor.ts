import { derived, get } from "svelte/store"
import type { DrawerTabIds } from "../../types/Tabs"
import { activeDrawerTab, activeEdit, activePage, modoAlianca } from "../stores"
import { drawerTabs } from "../values/tabs"
import { abaAoEntrarNoEditor, abasEscondidasNoEditor } from "./aliancaGavetaLogica"

// ----- AliançaShow · Preparar, fatia 6: no editor de um show a gaveta mostra só Mídia, Áudio e Bíblia -----
//
// Só ESCONDE os botões das abas (nada é gravado: `activeDrawerTab` não vai para o disco). Ao entrar no editor, se a
// aba ativa fica escondida, troca para Mídia e guarda a anterior; ao sair, restaura a anterior.

const TODAS = Object.keys(drawerTabs)

export const abasEscondidas = derived([modoAlianca, activePage, activeEdit], ([$modo, $pagina, $edit]) => new Set(abasEscondidasNoEditor(TODAS, { preparar: $modo === "preparar", noEditor: $pagina === "edit", tipoEditado: ($edit as any)?.type })))

export const abaEscondidaNoEditor = (id: string): boolean => get(abasEscondidas).has(id)

let iniciado = false
let anterior: DrawerTabIds | null = null

export function iniciarAbasDoEditor() {
    if (iniciado) return
    iniciado = true
    abasEscondidas.subscribe((esc) => {
        try {
            if (esc.size) {
                const ativa = get(activeDrawerTab)
                const nova = abaAoEntrarNoEditor(ativa, [...esc])
                if (nova !== ativa) {
                    if (!anterior) anterior = ativa
                    activeDrawerTab.set(nova as DrawerTabIds)
                }
            } else if (anterior) {
                const volta = anterior
                anterior = null
                activeDrawerTab.set(volta)
            }
        } catch (erro) {
            console.error("Preparar: falha ao trocar a aba da gaveta no editor", erro)
        }
    })
}
