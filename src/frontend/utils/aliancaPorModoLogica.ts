// Estado de leiaute POR MODO (fatia 0b): uma fachada com a API de `Writable` que escolhe, a cada chamada, o valor do Culto ou o do Preparar.
// Logica pura: recebe as stores por funcao e NAO importa `stores.ts` nem a chave do leiaute (sem ciclo).
//
// Por modo: `drawer` (aberta/fechada, altura), `activeDrawerTab` e, dentro de `drawerTabsData`, SO `media.activeSubTab` e `media.aliancaFiltro`
// (pasta e filtro da F7). `resized` (larguras das colunas) tambem e por modo (decisao do Andre: o Preparar nao persiste larguras).
//
// COMPARTILHADOS DE PROPOSITO (seguem como hoje, cada um com o motivo):
//   - `drawerTabsData[*].enabled`: preferencia do usuario (quais abas existem); desligar uma aba vale nos dois modos e persiste.
//   - toda correcao guiada por dado (activeSubTab de shows/overlays/templates/audio, historyHelpers, bible.ts): apagar uma categoria
//     corrige a aba ativa; se fosse por modo o outro modo ficaria apontando para um id morto.
//   - `drawerTabsData[*].openedSubSubTab/openedSubmenus/activeSubmenu`: estado de arvore interna da aba, sem relacao com o modo.
//   - `mediaOptions` (escrito junto com activeSubTab em Drawer.svelte:98), `slidesOptions`, `openedFolders`, `sorted`, `editColumns`:
//     preferencias de exibicao, persistidas, que o Culto sempre dividiu com o Preparar.
//   - `drawerOpenedInEdit`: memoria, par de `drawer.autoclosed`; segue unico porque so e lido junto com o `drawer` do instante.
//
// Garantias (revisao C9/C11): uma assinatura de `modoAlianca` POR STORE, ligada no 1o assinante e solta no ultimo; token de geracao (entrega
// atrasada do Svelte 3 e ignorada); a escolha do lado vai em try/catch, cai no Culto e chama falhaAlta.
import { get, writable } from "svelte/store"
import type { Readable, Writable } from "svelte/store"
import { falhaAlta } from "./aliancaFalha"

export type Modo = "culto" | "preparar"

export type OpcoesPorModo<T> = {
    /** o Writable real do Culto: o que o disco guarda */
    culto: Writable<T>
    /** a store do modo, entregue por funcao (referencia tardia: stores.ts declara `modoAlianca` depois) */
    modo: () => Readable<Modo>
    /** copia PROFUNDA, para a semente do Preparar */
    copiar: (v: T) => T
    /** depois de cada escrita: o valor que o OUTRO lado passa a ter (campos compartilhados). Sem isto os lados sao totalmente independentes */
    comuns?: (escrito: T, outro: T) => T
}

export type PorModo<T> = Writable<T> & {
    culto: Writable<T>
    /** o Writable de um lado, sem escolher pelo modo da hora (para escrita atrasada que decidiu o lado antes) */
    doModo: (m: Modo) => Writable<T>
    /** so testes */
    _zerar: () => void
}

export function criarPorModo<T>(o: OpcoesPorModo<T>): PorModo<T> {
    let preparar: Writable<T> | null = null
    type Assinante = { run: (v: T) => void }
    let assinantes: Assinante[] = []
    let desfazModo: (() => void) | null = null
    let desfazLado: (() => void) | null = null
    let lado: Modo = "culto"
    let geracao = 0
    let iniciando = false

    const escolher = (): Modo => {
        try {
            return get(o.modo()) === "preparar" ? "preparar" : "culto"
        } catch (erro) {
            falhaAlta("leiaute-por-modo", erro)
            return "culto"
        }
    }
    const store = (m: Modo): Writable<T> => {
        if (m === "culto") return o.culto
        // semente: copia profunda do Culto na 1a vez, nunca mais
        if (!preparar) preparar = writable<T>(o.copiar(get(o.culto)))
        return preparar
    }

    const emitir = (v: T) => assinantes.slice().forEach((a) => a.run(v))

    function ligarLado() {
        const minha = ++geracao
        desfazLado?.()
        desfazLado = store(lado).subscribe((v) => {
            if (minha !== geracao) return // entrega atrasada do lado antigo
            if (!iniciando) emitir(v)
        })
    }

    function ligar() {
        iniciando = true
        lado = escolher()
        ligarLado()
        // uma assinatura de modoAlianca por store (a 1a chamada e imediata e so confirma o lado)
        let primeira = true
        desfazModo = o.modo().subscribe(() => {
            if (primeira) return void (primeira = false)
            const novo = escolher()
            if (novo === lado) return
            lado = novo
            iniciando = false
            ligarLado() // a assinatura do lado novo entrega 1 chamada com o valor dele
        })
        iniciando = false
    }

    function desligar() {
        desfazModo?.()
        desfazLado?.()
        desfazModo = desfazLado = null
        geracao++
    }

    // depois de uma escrita no lado `m`, repassa os campos compartilhados ao outro lado
    function sincronizar(m: Modo) {
        if (!o.comuns) return
        const outro: Modo = m === "culto" ? "preparar" : "culto"
        if (outro === "preparar" && !preparar) return // ainda nao existe: nasce da semente
        const escrito = get(store(m))
        store(outro).update((o2) => o.comuns!(escrito, o2))
    }

    const fachada: PorModo<T> = {
        subscribe(run: (v: T) => void) {
            const a = { run }
            assinantes.push(a)
            if (assinantes.length === 1) ligar()
            run(get(store(lado)))
            return () => {
                assinantes = assinantes.filter((x) => x !== a)
                if (!assinantes.length) desligar()
            }
        },
        set(v: T) {
            const m = escolher()
            store(m).set(v)
            sincronizar(m)
        },
        update(fn: (v: T) => T) {
            const m = escolher()
            store(m).update(fn)
            sincronizar(m)
        },
        culto: o.culto,
        doModo: store,
        _zerar() {
            desligar()
            assinantes = []
            preparar = null
            lado = "culto"
        }
    }
    return fachada
}
