// Logica pura do comparador da prova do Culto (sem CDP, sem disco): achatar, mascara, esperado, comparacao.
// Testada em comparar.test.mjs (inclui as mutacoes que TEM de reprovar).

export const TETO_RUIDO = 80

/** caminhos de `outputs` que NUNCA podem ser mascarados (revisao C3) */
const PROIBIDOS_AMOSTRA = ["x/principal/outputs/0/v/default/slide/id", "x/principal/outputs/0/v/default/slide/index", "x/principal/outputs/0/v/default/slide/layout", "x/principal/outputs/0/v/default/background/id", "x/principal/outputs/0/v/default/background/path", "x/principal/outputs/0/v/default/overlays", "x/principal/outputs/0/v/default/overlays/0", "x/principal/outputs/0/v/default/transition/duration", "x/principal/outputs/0/v/default/transition"]

// "*" = um segmento (sem barra); "**" = qualquer coisa
const escapar = (s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
const regexDoPadrao = (p) =>
    new RegExp(
        "^" +
            p
                .split("**")
                .map((pedaco) => pedaco.split("*").map(escapar).join("[^/]*"))
                .join(".*") +
            "$"
    )

/** achata uma gravacao em { "<passo>/<janela>/<grupo>/<resto>": valor } */
/**
 * Troca a raiz do perfil da maquina por __PERFIL__ no TEXTO de uma gravacao, para o baseline nao depender de onde o repo mora.
 * Casa a raiz com barra normal ou com barra invertida escapada de JSON (o app grava os dois), sem diferenciar maiuscula
 * (letra do drive), e so quando ela termina num separador ou no fim da string (nao pega "perfil-bak").
 */
export function normalizarPerfil(txt, raiz) {
    if (!raiz) return txt
    const partes = String(raiz).replace(/\\/g, "/").replace(/\/+$/, "").split("/")
    if (partes.filter(Boolean).length < 2) return txt
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    // separador: "/" ou a barra invertida como aparece no texto JSON ("\\" = dois caracteres)
    const SEP = String.raw`(?:/|\\\\)`
    const re = new RegExp(partes.map(esc).join(SEP) + String.raw`(?=/|\\\\|"|$)`, "gi")
    return txt.replace(re, "__PERFIL__")
}

export function achatar(gravacao) {
    const m = new Map()
    const por = (chave, valor) => {
        if (valor !== null && typeof valor === "object") {
            const ks = Array.isArray(valor) ? valor.map((_, i) => String(i)) : Object.keys(valor)
            if (!ks.length) m.set(chave, Array.isArray(valor) ? "[]" : "{}")
            for (const k of ks) por(chave + "/" + k, valor[k])
        } else m.set(chave, valor)
    }
    for (const p of gravacao.passos) {
        for (const [janela, r] of [
            ["principal", p.principal],
            ["saida", p.saida]
        ]) {
            if (!r) continue
            const base = `${p.id}/${janela}`
            r.outputs?.forEach((e, i) => por(`${base}/outputs/${i}`, e))
            // canais: conjunto + ultimo payload (periodicos so aqui, nunca por contagem)
            for (const [k, v] of Object.entries(r.canais || {})) por(`${base}/canais/${k}`, v ?? "<null>")
            r.estado?.forEach((e, i) => por(`${base}/estado/${i}`, e))
            if (r.foco !== undefined) m.set(`${base}/foco`, r.foco)
            if (r.sinais) por(`${base}/sinais`, r.sinais)
            if (r.saida) por(`${base}/telao`, r.saida)
        }
    }
    return m
}

export function validarRuido(ruido) {
    const erros = []
    const padroes = ruido?.padroes || []
    if (padroes.length > TETO_RUIDO) erros.push(`ruido: ${padroes.length} padroes, acima do teto ${TETO_RUIDO}`)
    for (const p of padroes) {
        const re = regexDoPadrao(p)
        if (PROIBIDOS_AMOSTRA.some((x) => re.test(x))) erros.push(`ruido: o padrao "${p}" mascara um caminho proibido (slide/background/overlays/transition)`)
        if (/^\*+$/.test(p) || p.split("/").length < 3) erros.push(`ruido: padrao amplo demais "${p}"`)
    }
    return erros
}

const TIPOS = ["divergencia", "dom", "efeitoMinimo", "aposentar"]
const CURINGA = /\*|\?|^$/

/**
 * Valida o esquema de esperado.json.
 * Item sem decisaoDeProduto, curinga, tipo desconhecido, item de efeitoMinimo sem de/para, aposentar sem alvo reprovam.
 */
export function validarEsperado(itens) {
    const erros = []
    if (!Array.isArray(itens)) return ["esperado: nao e uma lista"]
    const ids = new Set()
    itens.forEach((it, i) => {
        const n = `esperado[${i}]`
        if (!TIPOS.includes(it.tipo)) return void erros.push(`${n}: tipo "${it.tipo}" invalido`)
        if (!it.fatia) erros.push(`${n}: sem fatia`)
        if (!it.porque || !String(it.porque).trim()) erros.push(`${n}: sem porque`)
        if (it.id) ids.add(it.id)
        if (it.tipo === "divergencia") {
            for (const c of ["passo", "fluxo", "caminho"]) if (!it[c] || CURINGA.test(String(it[c]))) erros.push(`${n}: ${c} ausente ou com curinga`)
            if (!("de" in it) || !("para" in it)) erros.push(`${n}: sem de/para`)
            if (
                String(it.caminho || "")
                    .split("/")
                    .filter(Boolean).length < 1
            )
                erros.push(`${n}: caminho curto demais`)
        }
        if (it.tipo === "dom") {
            for (const c of ["estado", "seletor", "atributo"]) if (!it[c] || CURINGA.test(String(it[c]))) erros.push(`${n}: ${c} ausente ou com curinga`)
            if (!("de" in it) || !("para" in it)) erros.push(`${n}: sem de/para`)
        }
        if (it.tipo === "efeitoMinimo") {
            if (!it.passo || !it.de || !it.para) erros.push(`${n}: efeitoMinimo exige passo, de e para`)
            if (it.para && !it.para.semEfeito && !(it.para.n > 0)) erros.push(`${n}: para invalido`)
            if (it.para?.semEfeito !== undefined && !String(it.para.semEfeito).trim()) erros.push(`${n}: semEfeito sem motivo`)
        }
        if (it.tipo === "aposentar" && !it.alvo) erros.push(`${n}: aposentar sem alvo`)
    })
    itens.forEach((it, i) => {
        if (it.tipo === "aposentar" && !ids.has(it.alvo)) erros.push(`esperado[${i}]: aposentar "${it.alvo}" nao aponta para um item declarado (id)`)
    })
    return erros
}

/** itens de divergencia efetivos, tirando os aposentados (cada aposentadoria precisa apontar um item existente) */
export const itensVivos = (itens) => {
    const aposentados = new Set(itens.filter((i) => i.tipo === "aposentar").map((i) => i.alvo))
    return itens.filter((i) => i.tipo === "divergencia" && !aposentados.has(i.id))
}

const fluxoDaChave = (chave) => {
    const [passo, janela, grupo, ...resto] = chave.split("/")
    return { passo, fluxo: `${janela}.${grupo}`, caminho: resto.join("/") }
}
const mesmo = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Compara A (baseline) com B (nova). Devolve { divergencias, naoDeclaradas, fantasmas, mascarados, erros }.
 * - divergencia = chave com valor diferente (ou ausente num lado) que a mascara nao cobre;
 * - declarada: um item `divergencia` do esperado casa com passo+fluxo+caminho+de+para;
 * - fantasma: item declarado (vivo) que NAO ocorreu.
 */
export function comparar(A, B, { ruido = { padroes: [] }, esperado = [] } = {}) {
    const erros = [...validarRuido(ruido)]
    if (erros.length) return { divergencias: [], naoDeclaradas: [], fantasmas: [], mascarados: 0, erros }
    const a = achatar(A)
    const b = achatar(B)
    const res = (ruido.padroes || []).map(regexDoPadrao)
    const mascarada = (k) => res.some((r) => r.test(k))
    const chaves = [...new Set([...a.keys(), ...b.keys()])]
    const divergencias = []
    let mascarados = 0
    for (const k of chaves) {
        const va = a.has(k) ? a.get(k) : "<ausente>"
        const vb = b.has(k) ? b.get(k) : "<ausente>"
        if (mesmo(va, vb)) continue
        if (mascarada(k)) {
            mascarados++
            continue
        }
        divergencias.push({ chave: k, ...fluxoDaChave(k), de: va, para: vb })
    }
    const vivos = itensVivos(esperado)
    const usados = new Set()
    const naoDeclaradas = []
    for (const d of divergencias) {
        const i = vivos.findIndex((it) => it.passo === d.passo && it.fluxo === d.fluxo && it.caminho === d.caminho && mesmo(it.de, d.de) && mesmo(it.para, d.para))
        if (i >= 0) usados.add(i)
        else naoDeclaradas.push(d)
    }
    const fantasmas = vivos.filter((_, i) => !usados.has(i))
    return { divergencias, naoDeclaradas, fantasmas, mascarados, erros }
}

/** os 5 eventos em volta da divergencia (so para outputs/estado), para a mensagem */
export function contexto(G, d) {
    const p = G.passos.find((x) => x.id === d.passo)
    if (!p) return []
    const [janela, grupo] = d.fluxo.split(".")
    const lista = (janela === "principal" ? p.principal : p.saida)?.[grupo === "outputs" ? "outputs" : grupo === "estado" ? "estado" : "canais"]
    if (!Array.isArray(lista)) return []
    const idx = Number(d.caminho.split("/")[0])
    const i = Number.isFinite(idx) ? idx : 0
    return lista.slice(Math.max(0, i - 2), i + 3).map((e) => JSON.stringify(e).slice(0, 200))
}
