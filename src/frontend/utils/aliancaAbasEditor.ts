import { derived, get } from "svelte/store"
import type { DrawerTabIds } from "../../types/Tabs"
import { activeDrawerTab, activeEdit, activePage } from "../stores"
import { tela } from "./aliancaTela"
import { drawerTabs } from "../values/tabs"
import { abaAoEntrarNoEditor } from "./aliancaGavetaLogica"
import { falhaAlta } from "./aliancaFalha"
// FVB:INICIO
import { abaLateral } from "./aliancaBibliotecaEstado"
import { abasEscondidasNaBiblioteca } from "./aliancaBibliotecaLogica"
// FVB:FIM

// ----- AliançaShow · Preparar, fatia 6: no editor de um show a gaveta mostra só Mídia, Áudio e Bíblia -----
//
// Só ESCONDE os botões das abas (nada é gravado: `activeDrawerTab` não vai para o disco). Ao entrar no editor, se a
// aba ativa fica escondida, troca para Mídia e guarda a anterior; ao sair, restaura a anterior.

const TODAS = Object.keys(drawerTabs)

export const abasEscondidas = derived([tela, activePage, activeEdit, abaLateral], ([$tela, $pagina, $edit, $aba]) => new Set(abasEscondidasNaBiblioteca(TODAS, { preparar: $tela === "editar", naBiblioteca: $aba === "biblioteca" && $pagina === "show", noEditor: $pagina === "edit", tipoEditado: ($edit as any)?.type })))

export const abaEscondidaNoEditor = (id: string): boolean => get(abasEscondidas).has(id)

let iniciado = false
// a aba de antes de entrar no editor
let anteriorAba: DrawerTabIds | null = null
const anterior = { ler: () => anteriorAba, gravar: (v: DrawerTabIds | null) => (anteriorAba = v) }

export function iniciarAbasDoEditor() {
    if (iniciado) return
    iniciado = true
    abasEscondidas.subscribe((esc) => {
        try {
            if (esc.size) {
                const ativa = get(activeDrawerTab)
                const nova = abaAoEntrarNoEditor(ativa, [...esc])
                if (nova !== ativa) {
                    if (!anterior.ler()) anterior.gravar(ativa)
                    activeDrawerTab.set(nova as DrawerTabIds)
                }
            } else if (anterior.ler()) {
                const volta = anterior.ler() as DrawerTabIds
                anterior.gravar(null)
                activeDrawerTab.set(volta)
            }
        } catch (erro) {
            falhaAlta("abas-do-editor", erro)
        }
    })
}
