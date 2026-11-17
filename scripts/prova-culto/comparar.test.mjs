// Prova de que o comparador MORDE. Roda com `node --test scripts/prova-culto/comparar.test.mjs`.
// Cada mutacao parte de uma gravacao sintetica que passa e tem de reprovar (ou o esquema/mascara tem de ser recusado).
import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { achatar, aplicarEfeitoMinimo, comparar, CANAIS_DE_REPOUSO, conferirCabecalhos, normalizarPerfil, passoMorto, validarEsperado, validarRuido } from "./compararLogica.mjs"

const clone = (x) => JSON.parse(JSON.stringify(x))
const out = (index) => ({ op: "update", por: "setOutput@output", mudou: true, v: { default: { slide: { id: "s", index, layout: "default" } } } })
const base = () => ({
    cabecalho: { versaoRoteiro: 1 },
    passos: [
        { id: "A01", principal: { outputs: [out(0)], canais: { "OUTPUT:OUT": { n: 1 }, "OUTPUT:ACTIVE_TIMERS": { t: 5 } }, estado: [{ fluxo: "activePage", v: "show" }], foco: "BODY", sinais: { drawer: { height: 300 } } }, saida: { outputs: [], canais: {}, estado: [], saida: { hash: "aa", elementos: 6 } } },
        { id: "A02", principal: { outputs: [out(1), out(2)], canais: {}, estado: [], foco: "BODY" }, saida: { outputs: [], canais: {}, estado: [], saida: { hash: "bb", elementos: 6 } } }
    ]
})
const ruido = { padroes: ["*/principal/canais/OUTPUT:ACTIVE_TIMERS/*"] }

test("A/A: igual", () => {
    const r = comparar(base(), base(), { ruido })
    assert.equal(r.naoDeclaradas.length, 0)
    assert.equal(r.divergencias.length, 0)
})
test("ruido mascara so o que declara", () => {
    const b = base()
    b.passos[0].principal.canais["OUTPUT:ACTIVE_TIMERS"].t = 9
    const r = comparar(base(), b, { ruido })
    assert.equal(r.divergencias.length, 0)
    assert.equal(r.mascarados, 1)
    const sem = comparar(base(), b, { ruido: { padroes: [] } })
    assert.equal(sem.naoDeclaradas.length, 1)
})
test("MUTACAO extra escrita em outputs reprova e aponta o passo", () => {
    const b = base()
    b.passos[0].principal.outputs.push({ ...out(0), mudou: false })
    const r = comparar(base(), b, { ruido })
    assert.ok(r.naoDeclaradas.length > 0)
    assert.equal(r.naoDeclaradas[0].passo, "A01")
})
test("MUTACAO troca de ordem de dois eventos reprova (teste de unidade do comparador)", () => {
    const b = base()
    b.passos[1].principal.outputs.reverse()
    const r = comparar(base(), b, { ruido })
    assert.ok(r.naoDeclaradas.some((d) => d.passo === "A02"))
})
test("MUTACAO canal de IPC suprimido reprova", () => {
    const b = base()
    delete b.passos[0].principal.canais["OUTPUT:OUT"]
    const r = comparar(base(), b, { ruido })
    assert.ok(r.naoDeclaradas.some((d) => d.passo === "A01" && d.fluxo === "principal.canais"))
})
test("MUTACAO so a receptora muda (escritas iguais, telao diferente) reprova", () => {
    const b = base()
    b.passos[1].saida.saida.hash = "zz"
    const r = comparar(base(), b, { ruido })
    assert.ok(r.naoDeclaradas.some((d) => d.fluxo === "saida.telao"))
})
test("MUTACAO activePage (estado) reprova", () => {
    const b = base()
    b.passos[0].principal.estado[0].v = "edit"
    const r = comparar(base(), b, { ruido })
    assert.ok(r.naoDeclaradas.some((d) => d.fluxo === "principal.estado"))
})
test("MUTACAO out.slide.index mudado reprova, e mascarar esse caminho e RECUSADO", () => {
    const b = base()
    b.passos[1].principal.outputs[1].v.default.slide.index = 7
    const r = comparar(base(), b, { ruido })
    assert.ok(r.naoDeclaradas.length > 0)
    const proibido = comparar(base(), b, { ruido: { padroes: ["*/principal/outputs/*/v/default/slide/index"] } })
    assert.ok(proibido.erros.length > 0)
    assert.ok(validarRuido({ padroes: ["*/principal/outputs/*/v/default/background/path"] }).length > 0)
    assert.ok(validarRuido({ padroes: ["*/principal/outputs/*/v/default/overlays/*"] }).length > 0)
    assert.ok(validarRuido({ padroes: ["*"] }).length > 0)
})
test("teto de ruido", () => {
    assert.ok(validarRuido({ padroes: Array.from({ length: 200 }, (_, i) => `a/b/c${i}`) }).length > 0)
})

const item = (extra = {}) => ({ tipo: "divergencia", id: "e1", fatia: "0b", passo: "A01", fluxo: "principal.sinais", caminho: "drawer/height", de: 300, para: 40, porque: "E1", ...extra })
test("divergencia declarada passa; fora da lista reprova; declarada que nao ocorreu reprova", () => {
    const b = base()
    b.passos[0].principal.sinais.drawer.height = 40
    assert.equal(comparar(base(), b, { ruido, esperado: [item()] }).naoDeclaradas.length, 0)
    assert.equal(comparar(base(), b, { ruido, esperado: [] }).naoDeclaradas.length, 1)
    // item cujo "para" esta errado nao casa
    assert.equal(comparar(base(), b, { ruido, esperado: [item({ para: 41 })] }).naoDeclaradas.length, 1)
    // fantasma
    const r = comparar(base(), base(), { ruido, esperado: [item()] })
    assert.equal(r.fantasmas.length, 1)
})
test("aposentar: item aposentado deixa de ser fantasma, mas so se apontar um item existente", () => {
    const itens = [item({ decisaoDeProduto: "d" }), { tipo: "aposentar", fatia: "1a", alvo: "e1", porque: "modo foco removido", decisaoDeProduto: "doc X" }]
    assert.equal(validarEsperado(itens).length, 0)
    assert.equal(comparar(base(), base(), { ruido, esperado: itens }).fantasmas.length, 0)
    const orfao = [{ tipo: "aposentar", fatia: "1a", alvo: "nao-existe", porque: "x", decisaoDeProduto: "d" }]
    assert.ok(validarEsperado(orfao).length > 0)
})
test("aposentar item que AINDA ocorre: a divergencia volta a reprovar", () => {
    const b = base()
    b.passos[0].principal.sinais.drawer.height = 40
    const itens = [item(), { tipo: "aposentar", fatia: "1a", alvo: "e1", porque: "x", decisaoDeProduto: "d" }]
    assert.equal(comparar(base(), b, { ruido, esperado: itens }).naoDeclaradas.length, 1)
})
test("esquema: sem curinga", () => {
    assert.ok(validarEsperado([item({ decisaoDeProduto: "d", caminho: "drawer/*" })]).length > 0)
    assert.ok(validarEsperado([item({ decisaoDeProduto: "d", passo: "" })]).length > 0)
    assert.ok(validarEsperado([{ tipo: "curinga", fatia: "x", porque: "y" }], {}).length > 0)
})
test("tipos efeitoMinimo e dom exigem de/para e motivo", () => {
    assert.ok(validarEsperado([{ tipo: "efeitoMinimo", fatia: "1b", passo: "A10", de: { fluxo: "estado", n: 1 }, para: { semEfeito: "" }, porque: "x" }]).length > 0)
    assert.equal(validarEsperado([{ tipo: "efeitoMinimo", fatia: "1b", passo: "A10", de: { fluxo: "estado", n: 1 }, para: { semEfeito: "teclas 1-6 removidas" }, porque: "x", decisaoDeProduto: "d" }]).length, 0)
    assert.ok(validarEsperado([{ tipo: "dom", fatia: "1b", estados: ["01-culto-parado"], seletor: "*", atributo: "data-title", de: "a", para: "b", porque: "x", decisaoDeProduto: "d" }]).length > 0)
    assert.equal(validarEsperado([{ tipo: "dom", fatia: "1b", estados: ["01-culto-parado"], seletor: "BUTTON", atributo: "data-title", de: "Edicao [2]", para: "Edicao", porque: "x", decisaoDeProduto: "d" }]).length, 0)
})
test("achatar: ausente num lado e divergencia", () => {
    const b = base()
    b.passos[1].principal.outputs.pop()
    assert.ok(achatar(base()).size > achatar(b).size)
    assert.ok(comparar(base(), b, { ruido }).naoDeclaradas.length > 0)
})

test("normalizarPerfil: a raiz do perfil some da gravacao nos dois formatos de barra, e so ela", () => {
    const raiz = "C:/Users/x/bancada/perfil"
    const g = {
        a: "C:/Users/x/bancada/perfil/midia/f1.png",
        b: "C:\\Users\\x\\bancada\\perfil\\midia\\v1.mp4",
        c: "c:/users/x/bancada/perfil",
        d: "C:/Users/x/bancada/perfil-bak/midia/f1.png",
        e: "C:/Users/x/bancada/perfil\\store\\media-cache\\i1.png"
    }
    const n = JSON.parse(normalizarPerfil(JSON.stringify(g), raiz))
    assert.equal(n.a, "__PERFIL__/midia/f1.png")
    assert.equal(n.b, "__PERFIL__\\midia\\v1.mp4")
    assert.equal(n.c, "__PERFIL__")
    assert.equal(n.d, g.d, "perfil-bak nao e o perfil")
    assert.equal(n.e, "__PERFIL__\\store\\media-cache\\i1.png")
    // a raiz pode chegar com barra invertida e barra no fim (FS_PERFIL_DIR cru do Windows)
    assert.deepEqual(JSON.parse(normalizarPerfil(JSON.stringify(g), "C:\\Users\\x\\bancada\\perfil\\")), n)
    // sem raiz, ou raiz rasa demais, nao mexe em nada
    assert.equal(normalizarPerfil("C:/a", ""), "C:/a")
    assert.equal(normalizarPerfil("C:/a", "C:/"), "C:/a")
})

// Q5 (fatia R): a ferramenta nao conhece mais o leiaute antigo. Roda o comparar.mjs de verdade, em processo filho.
const BASELINE = "scripts/prova-culto/baseline/slice0-base.json"
const comparar_mjs = (...args) => spawnSync(process.execPath, ["scripts/prova-culto/comparar.mjs", ...args], { encoding: "utf8" })
test("Q5: flag desconhecida sai com 2", () => {
    const r = comparar_mjs(BASELINE, BASELINE, "--classico")
    assert.equal(r.status, 2)
    assert.match(r.stderr, /flag desconhecida: --classico/)
    assert.equal(comparar_mjs(BASELINE, BASELINE, "--qualquer-outra").status, 2)
})
test("Q5: --esperado continua aceito", () => {
    // so os itens `divergencia` do esperado.json real (os `efeitoMinimo` da 1b exigem uma gravacao feita com eles aplicados: a baseline nao tem)
    const dir = mkdtempSync(join(tmpdir(), "q5e-"))
    const arq = join(dir, "esperado-divergencias.json")
    writeFileSync(arq, JSON.stringify(JSON.parse(readFileSync("scripts/prova-culto/esperado.json", "utf8")).filter((i) => i.tipo === "divergencia")))
    const r = comparar_mjs(BASELINE, BASELINE, "--esperado", arq)
    // o baseline contra ele mesmo deixa os itens declarados sem ocorrer (status 1), mas a flag e aceita: nunca 2
    assert.equal(r.status, 1, r.stderr)
    assert.match(r.stdout, /comparadas \d+ chaves/)
})
test("Q5: gravacao com leiaute diferente de novo sai com 2", () => {
    const dir = mkdtempSync(join(tmpdir(), "q5-"))
    const g = JSON.parse(readFileSync(BASELINE, "utf8"))
    g.cabecalho.layout = "classico"
    const arq = join(dir, "antiga.json")
    writeFileSync(arq, JSON.stringify(g))
    const r = comparar_mjs(BASELINE, arq)
    assert.equal(r.status, 2)
    assert.match(r.stderr, /nao existe mais/)
})

// 6.1: rodar.mjs aplica efeitoMinimo e grava o que o juiz precisa
const ROTEIRO = () => [
    {
        id: "A",
        passos: [
            { id: "P1", gesto: { tecla: "1" }, semEfeito: "ja esta na pagina" },
            { id: "P2", gesto: { tecla: "2" }, efeito: { fluxo: "estado", n: 1 } }
        ]
    }
]
const itemEfeito = (extra = {}) => ({ tipo: "efeitoMinimo", id: "em1", fatia: "1b", passo: "P2", de: { fluxo: "estado", n: 1 }, para: { semEfeito: "teclas 1-6 removidas" }, porque: "x", decisaoDeProduto: "d", ...extra })
test("efeitoMinimo: aplica o para na copia e anota o id; o roteiro original nao e mutado", () => {
    const orig = ROTEIRO()
    const r = aplicarEfeitoMinimo(orig, [itemEfeito()])
    assert.deepEqual(r.erros, [])
    assert.deepEqual(r.aplicados, ["em1"])
    const p2 = r.secoes[0].passos[1]
    assert.equal(p2.efeito, undefined)
    assert.equal(p2.semEfeito, "teclas 1-6 removidas")
    assert.equal(p2.efeitoAplicado, "em1")
    assert.deepEqual(orig, ROTEIRO(), "o original ficou intacto")
    // o inverso: semEfeito vira efeito
    const inv = aplicarEfeitoMinimo(orig, [itemEfeito({ id: "em2", passo: "P1", de: { semEfeito: "ja esta na pagina" }, para: { fluxo: "estado", n: 1 } })])
    assert.deepEqual(inv.erros, [])
    assert.deepEqual(inv.secoes[0].passos[0].efeito, { fluxo: "estado", n: 1 })
    assert.equal(inv.secoes[0].passos[0].semEfeito, undefined)
})
test("MUTACAO efeitoMinimo com de diferente do roteiro (override cego) reprova", () => {
    const r = aplicarEfeitoMinimo(ROTEIRO(), [itemEfeito({ de: { fluxo: "estado", n: 2 } })])
    assert.equal(r.erros.length, 1)
    assert.match(r.erros[0], /override cego/)
    assert.deepEqual(r.aplicados, [])
})
test("MUTACAO efeitoMinimo em passo que nao existe reprova", () => {
    const r = aplicarEfeitoMinimo(ROTEIRO(), [itemEfeito({ passo: "P9" })])
    assert.equal(r.erros.length, 1)
    assert.match(r.erros[0], /nao existe/)
})
test("achatar: antesDoGesto, depois e efeitoMedido (nivel do passo) nao entram no mapa", () => {
    const sem = base()
    const com = base()
    com.passos[0].antesDoGesto = { hash: "aa", foco: "BODY", sinais: { modo: "culto" }, pagina: "show" }
    com.passos[0].depois = { pagina: "show" }
    com.passos[0].efeitoMedido = { fluxo: "estado", n: 1 }
    assert.deepEqual([...achatar(sem)], [...achatar(com)])
})
test("conferirCabecalhos: esperadoAplicado tem de ser igual aos ids efeitoMinimo do esperado", () => {
    const ca = { versaoRoteiro: 2, janela: { w: 1 }, perfilSha: "p" }
    const ok = { ...ca, esperadoAplicado: ["em1"] }
    assert.deepEqual(conferirCabecalhos(ca, ok, [itemEfeito()]), [])
    assert.deepEqual(conferirCabecalhos(ca, { ...ca }, []), [], "gravacao antiga sem o campo e esperado sem efeitoMinimo: igual")
    assert.ok(conferirCabecalhos(ca, { ...ca, esperadoAplicado: [] }, [itemEfeito()]).some((m) => /esperadoAplicado/.test(m)))
    assert.ok(conferirCabecalhos(ca, ok, []).some((m) => /esperadoAplicado/.test(m)))
    assert.ok(conferirCabecalhos(ca, { ...ca, janela: { w: 2 } }, []).length > 0)
})
test("comparar.mjs: B gravada com outro esperado sai com 2 (esperadoAplicado)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ea-"))
    const g = JSON.parse(readFileSync(BASELINE, "utf8"))
    g.cabecalho.esperadoAplicado = ["fantasma"]
    const arq = join(dir, "b.json")
    writeFileSync(arq, JSON.stringify(g))
    const r = comparar_mjs(BASELINE, arq)
    assert.equal(r.status, 2)
    assert.match(r.stderr, /esperadoAplicado/)
})

// 6.2: juiz de passo morto
const IDS_DIGITOS = ["A11-digito-2", "A12-digito-3", "A13-digito-4", "A14-digito-5", "A15-digito-6"]
const itensMortos = () => IDS_DIGITOS.map((passo, i) => ({ tipo: "efeitoMinimo", id: "pm" + i, fatia: "1b", passo, de: { fluxo: "estado", n: 1 }, para: { semEfeito: "teclas 1-6 removidas" }, julgar: "passoMorto", porque: "x", decisaoDeProduto: "d" }))
// A: a gravacao do baseline de hoje (digito troca de pagina); B: o A10 real copiado para A11-A15 (o digito nao faz nada)
const baselineReal = () => JSON.parse(readFileSync("scripts/prova-culto/baseline/slice0-base.json", "utf8"))
const parDeDigitos = () => {
    const A = baselineReal()
    const B = baselineReal()
    const a10 = A.passos.find((p) => p.id === "A10-digito-1")
    for (const id of IDS_DIGITOS) {
        const i = B.passos.findIndex((p) => p.id === id)
        const morto = clone(a10)
        morto.id = id
        // o baseline e anterior a 0c: antesDoGesto sai do proprio estado do passo morto (nada mudou, entao antes = depois)
        morto.antesDoGesto = { hash: morto.saida.saida.hash, telao: { texto: morto.saida.saida.texto, elementos: morto.saida.saida.elementos }, foco: morto.principal.foco, sinais: morto.principal.sinais, pagina: "show" }
        B.passos[i] = morto
    }
    return { A, B }
}
test("passo morto: o A10 real copiado para A11-A15 com os 5 itens passa, sem fantasma", () => {
    const { A, B } = parDeDigitos()
    const r = comparar(A, B, { ruido, esperado: itensMortos() })
    assert.deepEqual(r.passoMorto, [])
    assert.equal(r.fantasmas.length, 0)
    assert.equal(r.naoDeclaradas.filter((d) => IDS_DIGITOS.includes(d.passo)).length, 0, "as chaves dos passos julgados saem da comparacao literal")
})
const morto1 = () => {
    const { B } = parDeDigitos()
    return clone(B.passos.find((p) => p.id === "A11-digito-2"))
}
const reprova = (mutar, regra) => {
    const p = morto1()
    mutar(p)
    const v = passoMorto(p)
    assert.ok(
        v.some((x) => x.regra === regra),
        "esperava a regra " + regra + ", veio " + JSON.stringify(v)
    )
}
test("MUTACAO passo morto: evento activeShow em estado reprova", () => reprova((p) => p.principal.estado.push({ fluxo: "activeShow", v: { id: "x" } }), 2))
test("MUTACAO passo morto: sinais.modo trocado reprova", () => reprova((p) => (p.principal.sinais.modo = "preparar"), 4))
test("MUTACAO passo morto: foco trocado reprova", () => reprova((p) => (p.principal.foco = "BUTTON.x"), 4))
test("MUTACAO passo morto: canal OUTPUT:OVERLAYS reprova", () => reprova((p) => (p.principal.canais["OUTPUT:OVERLAYS"] = {}), 3))
test("MUTACAO passo morto: canal OUTPUT:COLORBARS reprova", () => reprova((p) => (p.principal.canais["OUTPUT:COLORBARS"] = {}), 3))
test("MUTACAO passo morto: canal STAGE:SWITCH reprova", () => reprova((p) => (p.principal.canais["STAGE:SWITCH"] = {}), 3))
test("passo morto: canal de repouso passa", () => {
    const p = morto1()
    for (const c of CANAIS_DE_REPOUSO) p.principal.canais[c] = {}
    assert.deepEqual(passoMorto(p), [])
})
test("MUTACAO passo morto: principal.outputs nao vazio reprova", () => reprova((p) => p.principal.outputs.push(out(0)), 1))
test("MUTACAO passo morto: saida.outputs nao vazio com hash igual reprova", () => reprova((p) => p.saida.outputs.push(out(0)), 5))
test("MUTACAO passo morto: telao com hash diferente reprova; texto ou elementos diferentes tambem", () => {
    reprova((p) => (p.saida.saida.hash = "zz"), 6)
    reprova((p) => (p.saida.saida.texto = "outro"), 6)
    reprova((p) => (p.saida.saida.elementos += 1), 6)
})
test("passo morto: gravacao sem antesDoGesto reprova", () => reprova((p) => delete p.antesDoGesto, 0))
test("MUTACAO esquema: julgar sobre passo com de.fluxo outputs reprova; julgar desconhecido reprova", () => {
    const it = itensMortos()[0]
    assert.deepEqual(validarEsperado([it]), [])
    assert.ok(validarEsperado([{ ...it, de: { fluxo: "outputs", n: 1 } }]).length > 0)
    assert.ok(validarEsperado([{ ...it, para: { fluxo: "estado", n: 1 } }]).length > 0)
    assert.ok(validarEsperado([{ ...it, julgar: "qualquer" }]).length > 0)
})
test("MUTACAO fantasma: item SEM julgar com o efeito ainda presente reprova", () => {
    const { A, B } = parDeDigitos()
    const sem = itensMortos().map(({ julgar, ...resto }) => resto)
    // o efeito medido de B ainda atinge de.n (1): o item diz que o digito deixou de trocar a pagina, mas troca
    for (const id of IDS_DIGITOS) B.passos.find((p) => p.id === id).efeitoMedido = { fluxo: "estado", n: 1 }
    assert.equal(comparar(A, B, { ruido, esperado: sem }).fantasmas.length, 5)
    for (const id of IDS_DIGITOS) B.passos.find((p) => p.id === id).efeitoMedido = { fluxo: "estado", n: 0 }
    assert.equal(comparar(A, B, { ruido, esperado: sem }).fantasmas.length, 0)
})
test("MUTACAO fantasma: so um dos cinco passos perdeu a troca, os outros quatro sao fantasmas", () => {
    const { A } = parDeDigitos()
    const B = baselineReal() // o digito AINDA troca a pagina nos 5 passos
    for (const p of B.passos) p.antesDoGesto = { hash: p.saida.saida?.hash, telao: { texto: p.saida.saida?.texto, elementos: p.saida.saida?.elementos }, foco: p.principal.foco, sinais: p.principal.sinais, pagina: "show" }
    const um = parDeDigitos().B.passos.find((p) => p.id === "A11-digito-2")
    B.passos[B.passos.findIndex((p) => p.id === "A11-digito-2")] = um
    const r = comparar(A, B, { ruido, esperado: itensMortos() })
    assert.equal(r.fantasmas.length, 4)
    assert.deepEqual(r.fantasmas.map((x) => x.passo).sort(), IDS_DIGITOS.slice(1))
    // e cada um dos quatro tambem viola o juiz (o digito ainda faz coisa)
    assert.ok(r.passoMorto.some((v) => v.passo === "A12-digito-3"))
})
test("comparar.mjs imprime e reprova passo morto violado", () => {
    const { A, B } = parDeDigitos()
    B.passos.find((p) => p.id === "A11-digito-2").principal.estado.push({ fluxo: "activePage", v: "edit" })
    const dir = mkdtempSync(join(tmpdir(), "pm-"))
    writeFileSync(join(dir, "a.json"), JSON.stringify(A))
    writeFileSync(join(dir, "b.json"), JSON.stringify({ ...B, cabecalho: { ...B.cabecalho, esperadoAplicado: itensMortos().map((i) => i.id) } }))
    writeFileSync(join(dir, "e.json"), JSON.stringify(itensMortos()))
    const r = comparar_mjs(join(dir, "a.json"), join(dir, "b.json"), "--esperado", join(dir, "e.json"))
    assert.equal(r.status, 1, r.stdout + r.stderr)
    assert.match(r.stderr, /PASSO MORTO VIOLADO: passo A11-digito-2 regra 2/)
})

// 6.3: teto, fatias e decisao
const div = (i, fatia = "0b") => ({ tipo: "divergencia", id: "d" + i, fatia, passo: "A01", fluxo: "principal.sinais", caminho: "c/" + i, de: 1, para: 2, porque: "x" })
test("teto da 0b: 20 itens reprova, 19 passa", () => {
    assert.ok(validarEsperado(Array.from({ length: 20 }, (_, i) => div(i))).some((e) => /teto 19/.test(e)))
    assert.deepEqual(validarEsperado(Array.from({ length: 19 }, (_, i) => div(i))), [])
})
test("teto padrao: 11 itens numa fatia sem excecao reprova, 10 passa", () => {
    assert.ok(validarEsperado(Array.from({ length: 11 }, (_, i) => div(i, "1a"))).some((e) => /teto 10/.test(e)))
    assert.deepEqual(validarEsperado(Array.from({ length: 10 }, (_, i) => div(i, "1a"))), [])
})
test("fatia fora da lista reprova (1b-dom, 2a, vazia)", () => {
    for (const fatia of ["1b-dom", "2a", "0a"])
        assert.ok(
            validarEsperado([div(1, fatia)]).some((e) => /fatia/.test(e)),
            fatia
        )
    assert.ok(validarEsperado([div(1, "0c")]).length === 0)
})
test("dom e efeitoMinimo sem decisaoDeProduto reprovam", () => {
    const dom = { tipo: "dom", fatia: "1b", estados: ["01-culto-parado"], seletor: "BUTTON", atributo: "data-title", de: "a", para: "b", porque: "x" }
    assert.ok(validarEsperado([dom]).some((e) => /decisaoDeProduto/.test(e)))
    assert.deepEqual(validarEsperado([{ ...dom, decisaoDeProduto: "d" }]), [])
    const em = { tipo: "efeitoMinimo", fatia: "1b", passo: "A11-digito-2", de: { fluxo: "estado", n: 1 }, para: { semEfeito: "m" }, porque: "x" }
    assert.ok(validarEsperado([em]).some((e) => /decisaoDeProduto/.test(e)))
})
test("esquema dom: estados explicitos do Culto, tag em maiuscula, atributo da lista, de/para normalizados", () => {
    const dom = { tipo: "dom", fatia: "1b", estados: ["01-culto-parado"], seletor: "BUTTON", atributo: "data-title", de: "a", para: "b", porque: "x", decisaoDeProduto: "d" }
    assert.deepEqual(validarEsperado([dom]), [])
    assert.ok(validarEsperado([{ ...dom, estados: ["*"] }]).length > 0, "curinga")
    assert.ok(validarEsperado([{ ...dom, estados: [] }]).length > 0, "vazio")
    assert.ok(validarEsperado([{ ...dom, estados: ["11-preparar"] }]).length > 0, "estado do Preparar")
    assert.ok(validarEsperado([{ ...dom, estado: "01-culto-parado", estados: undefined }]).length > 0, "estado no singular")
    assert.ok(validarEsperado([{ ...dom, seletor: "button.tab" }]).length > 0, "seletor com classe")
    assert.ok(validarEsperado([{ ...dom, atributo: "class" }]).length > 0, "atributo fora da lista")
    assert.ok(validarEsperado([{ ...dom, de: "  a  " }]).length > 0, "de nao normalizado")
})

test("1b: o esperado.json real tem 19 divergencias da 0b + 5 efeitoMinimo (A11 a A15, passo morto) + 6 dom (data-title sem [N]), todos da 1b com decisaoDeProduto", () => {
    const itens = JSON.parse(readFileSync("scripts/prova-culto/esperado.json", "utf8"))
    assert.deepEqual(validarEsperado(itens), [])
    const da = (f) => itens.filter((i) => i.fatia === f)
    assert.equal(da("0b").length, 19)
    assert.equal(da("1b").length, 11)
    const efeitos = da("1b").filter((i) => i.tipo === "efeitoMinimo")
    assert.deepEqual(efeitos.map((i) => i.passo), ["A11-digito-2", "A12-digito-3", "A13-digito-4", "A14-digito-5", "A15-digito-6"])
    for (const i of efeitos) assert.equal(i.julgar, "passoMorto")
    const doms = da("1b").filter((i) => i.tipo === "dom")
    assert.deepEqual(doms.map((i) => i.para), ["Mostrando", "Editando", "Visão do palco", "Desenhando", "Configurações", "Bíblia"])
    for (const i of da("1b")) assert.match(i.decisaoDeProduto, /decisão 12/)
})
