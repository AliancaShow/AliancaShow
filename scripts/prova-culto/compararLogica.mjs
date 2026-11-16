// Logica pura do comparador da prova do Culto (sem CDP, sem disco): achatar, mascara, esperado, comparacao.
// Testada em comparar.test.mjs (inclui as mutacoes que TEM de reprovar).

import { ATRIBUTOS_DOM, ESTADOS_CULTO, normalizarAtributo } from "./aparencia/fvaLogica.mjs"

export const TETO_RUIDO = 80

/** fatias que podem declarar excecoes no esperado.json (outra fatia reprova no esquema) */
export const FATIAS_VALIDAS = ["0b", "0c", "1a", "1b"]
/** teto de itens `divergencia` por fatia (os itens de decisao, efeitoMinimo e dom, tem a propria trava: decisaoDeProduto + fantasma) */
export const TETO_PADRAO = 10
export const TETO_POR_FATIA = {
    // 0b: E1, E2, E3 (19 itens de `principal.sinais`, relatorio-layout-f0.md)
    "0b": 19
}

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

/**
 * Canais que um passo MORTO ainda pode tocar: so os periodicos do app (sem relacao com o gesto).
 * Qualquer outro canal num passo julgado e PARADA 1 do plano (caminho que pode ir ao telao): nao se acrescenta aqui por conta propria.
 */
export const CANAIS_DE_REPOUSO = [
    "MAIN:SPOTIFY_GET_STATE", // periodico, ja tratado em ruido.json
    "MAIN:CHECK_RAM_USAGE" // periodico, ja tratado em ruido.json
]

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Juiz de "passo morto" (6.2): o gesto nao pode ter feito NADA. So olha a gravacao B (a nova).
 * Devolve a lista de violacoes { regra, detalhe } (vazia = o passo esta morto de verdade).
 */
export function passoMorto(p) {
    const v = []
    const pr = p.principal || {}
    const sa = p.saida || {}
    const antes = p.antesDoGesto
    if (!antes) return [{ regra: 0, detalhe: "gravacao sem antesDoGesto: regrave com o rodar.mjs da 0c" }]
    if (pr.outputs?.length) v.push({ regra: 1, detalhe: `principal.outputs tem ${pr.outputs.length} evento(s)` })
    if (pr.estado?.length) v.push({ regra: 2, detalhe: `principal.estado tem ${pr.estado.length} evento(s): ${JSON.stringify(pr.estado).slice(0, 160)}` })
    for (const c of Object.keys(pr.canais || {})) if (!CANAIS_DE_REPOUSO.includes(c)) v.push({ regra: 3, detalhe: `canal fora de CANAIS_DE_REPOUSO: ${c}${/^(OUTPUT|STAGE):/.test(c) ? " (PARADA 1: caminho que pode ir ao telao)" : ""}` })
    if (!igual(pr.foco, antes.foco)) v.push({ regra: 4, detalhe: `foco ${JSON.stringify(antes.foco)} -> ${JSON.stringify(pr.foco)}` })
    if (!igual(pr.sinais, antes.sinais)) v.push({ regra: 4, detalhe: `sinais mudaram: ${JSON.stringify(antes.sinais).slice(0, 120)} -> ${JSON.stringify(pr.sinais).slice(0, 120)}` })
    if (sa.outputs?.length) v.push({ regra: 5, detalhe: `saida.outputs tem ${sa.outputs.length} evento(s)` })
    if (sa.estado?.length) v.push({ regra: 5, detalhe: `saida.estado tem ${sa.estado.length} evento(s)` })
    const t = sa.saida || {}
    if (t.hash !== antes.hash) v.push({ regra: 6, detalhe: `saida.hash ${antes.hash} -> ${t.hash}` })
    if (antes.telao && (t.texto !== antes.telao.texto || t.elementos !== antes.telao.elementos)) v.push({ regra: 6, detalhe: `saida texto/elementos mudaram: ${JSON.stringify(antes.telao).slice(0, 100)} -> ${JSON.stringify({ texto: t.texto, elementos: t.elementos }).slice(0, 100)}` })
    return v.map((x) => ({ passo: p.id, ...x }))
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
        else if (!FATIAS_VALIDAS.includes(it.fatia)) erros.push(`${n}: fatia "${it.fatia}" fora de ${JSON.stringify(FATIAS_VALIDAS)}`)
        if ((it.tipo === "efeitoMinimo" || it.tipo === "dom") && (!it.decisaoDeProduto || !String(it.decisaoDeProduto).trim())) erros.push(`${n}: ${it.tipo} sem decisaoDeProduto`)
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
            for (const c of ["seletor", "atributo"]) if (!it[c] || CURINGA.test(String(it[c]))) erros.push(`${n}: ${c} ausente ou com curinga`)
            if (!Array.isArray(it.estados) || !it.estados.length) erros.push(`${n}: estados deve ser uma lista explicita e nao vazia`)
            else for (const e of it.estados) if (!ESTADOS_CULTO.includes(e)) erros.push(`${n}: estado "${e}" nao e um dos estados do Culto`)
            if (it.seletor && !/^[A-Z][A-Z0-9]*$/.test(String(it.seletor))) erros.push(`${n}: seletor deve ser o nome da tag em maiusculas`)
            if (it.atributo && !ATRIBUTOS_DOM.includes(it.atributo)) erros.push(`${n}: atributo "${it.atributo}" fora de ${JSON.stringify(ATRIBUTOS_DOM)}`)
            if (!("de" in it) || !("para" in it)) erros.push(`${n}: sem de/para`)
            else for (const c of ["de", "para"]) if (typeof it[c] !== "string" || normalizarAtributo(it[c]) !== it[c]) erros.push(`${n}: ${c} tem de ser texto ja normalizado como a varredura normaliza`)
        }
        if (it.tipo === "efeitoMinimo") {
            if (!it.passo || !it.de || !it.para) erros.push(`${n}: efeitoMinimo exige passo, de e para`)
            if (it.para && !it.para.semEfeito && !(it.para.n > 0)) erros.push(`${n}: para invalido`)
            if (it.para?.semEfeito !== undefined && !String(it.para.semEfeito).trim()) erros.push(`${n}: semEfeito sem motivo`)
            if (it.julgar !== undefined) {
                if (it.julgar !== "passoMorto") erros.push(`${n}: julgar "${it.julgar}" desconhecido`)
                else if (it.de?.fluxo !== "estado" || it.para?.semEfeito === undefined) erros.push(`${n}: julgar passoMorto so vale com de.fluxo "estado" e para.semEfeito`)
            }
        }
        if (it.tipo === "aposentar" && !it.alvo) erros.push(`${n}: aposentar sem alvo`)
    })
    const porFatia = {}
    for (const it of itens) if (it.tipo === "divergencia" && it.fatia) porFatia[it.fatia] = (porFatia[it.fatia] || 0) + 1
    for (const [fatia, n] of Object.entries(porFatia)) {
        const teto = TETO_POR_FATIA[fatia] ?? TETO_PADRAO
        if (n > teto) erros.push(`esperado: fatia ${fatia} tem ${n} divergencias, acima do teto ${teto}`)
    }
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
    // passos julgados como "passo morto": saem da comparacao literal (nas duas gravacoes) e B passa por passoMorto()
    const julgados = new Set((esperado || []).filter((i) => i.tipo === "efeitoMinimo" && i.julgar === "passoMorto").map((i) => i.passo))
    const chaves = [...new Set([...a.keys(), ...b.keys()])].filter((k) => !julgados.has(k.split("/")[0]))
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
    const passoMortoViolacoes = []
    const passoDe = (G, id) => G.passos.find((p) => p.id === id)
    for (const it of (esperado || []).filter((i) => i.tipo === "efeitoMinimo")) {
        const pa = passoDe(A, it.passo)
        const pb = passoDe(B, it.passo)
        if (!pb) continue
        if (it.julgar === "passoMorto") {
            passoMortoViolacoes.push(...passoMorto(pb))
            // ocorreu: A tem evento em principal.estado nesse passo e B nao. Iguais = o item nao muda nada = fantasma
            if (!(pa?.principal?.estado?.length > 0 && !(pb.principal?.estado?.length > 0))) fantasmas.push(it)
        } else if (it.de?.n > 0 && pb.efeitoMedido && pb.efeitoMedido.n >= it.de.n) {
            // sem julgar: o efeito que o item diz ter sumido ainda esta la
            fantasmas.push(it)
        }
    }
    return { divergencias, naoDeclaradas, fantasmas, mascarados, erros, passoMorto: passoMortoViolacoes }
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

/**
 * 6.1: aplica os itens `efeitoMinimo` do esperado.json ao roteiro (numa COPIA; o roteiro original nunca e mutado).
 * O `de` do item tem de ser igual, por JSON.stringify, ao que o roteiro declara hoje (`passo.efeito` ou `{ semEfeito }`): override cego reprova.
 * Devolve { secoes, aplicados: [ids], erros }.
 */
export function aplicarEfeitoMinimo(secoes, itens) {
    const copia = JSON.parse(JSON.stringify(secoes))
    const erros = []
    const aplicados = []
    for (const it of (itens || []).filter((i) => i.tipo === "efeitoMinimo")) {
        const nome = it.id || `${it.passo}`
        const passo = copia.flatMap((s) => s.passos).find((p) => p.id === it.passo)
        if (!passo) {
            erros.push(`efeitoMinimo ${nome}: o passo ${it.passo} nao existe no roteiro`)
            continue
        }
        const declarado = passo.efeito ?? { semEfeito: passo.semEfeito }
        if (JSON.stringify(declarado) !== JSON.stringify(it.de)) {
            erros.push(`efeitoMinimo ${nome}: override cego em ${it.passo}: o roteiro declara ${JSON.stringify(declarado)} e o item diz ${JSON.stringify(it.de)}`)
            continue
        }
        if (it.para.semEfeito !== undefined) {
            delete passo.efeito
            passo.semEfeito = it.para.semEfeito
        } else {
            delete passo.semEfeito
            passo.efeito = { fluxo: it.para.fluxo, n: it.para.n }
        }
        passo.efeitoAplicado = it.id || nome
        aplicados.push(it.id || nome)
    }
    return { secoes: copia, aplicados, erros }
}

/** ids dos itens efeitoMinimo de um esperado (o que `rodar.mjs` tem de ter aplicado) */
export const idsEfeitoMinimo = (esperado) => (esperado || []).filter((i) => i.tipo === "efeitoMinimo").map((i) => i.id || i.passo)

/**
 * Cabecalhos de duas gravacoes: o que as torna incomparaveis. `cb.esperadoAplicado` (o que rodar.mjs aplicou ao gravar B)
 * tem de ser igual aos ids efeitoMinimo do esperado recebido agora (sem ordem), senao a comparacao seria cega.
 */
export function conferirCabecalhos(ca, cb, esperado) {
    const incompativeis = []
    if (ca.versaoRoteiro !== cb.versaoRoteiro) incompativeis.push(`versaoRoteiro ${ca.versaoRoteiro} != ${cb.versaoRoteiro} (so vale com item efeitoMinimo/aposentar no esperado)`)
    if (JSON.stringify(ca.janela) !== JSON.stringify(cb.janela)) incompativeis.push(`janela ${JSON.stringify(ca.janela)} != ${JSON.stringify(cb.janela)}`)
    if (ca.perfilSha !== cb.perfilSha) incompativeis.push(`perfilSha ${ca.perfilSha} != ${cb.perfilSha}`)
    const aplicado = [...(cb.esperadoAplicado || [])].sort()
    const pedido = [...idsEfeitoMinimo(esperado)].sort()
    if (JSON.stringify(aplicado) !== JSON.stringify(pedido)) incompativeis.push(`esperadoAplicado ${JSON.stringify(aplicado)} != itens efeitoMinimo do esperado ${JSON.stringify(pedido)}: B foi gravada com outro esperado.json`)
    return incompativeis
}
