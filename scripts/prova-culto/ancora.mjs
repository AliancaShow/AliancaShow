// Ancora da janela de saida (revisao C14): nenhum arquivo do FECHO DE IMPORTS de `MainOutput.svelte` pode mudar entre a ancora (a base da
// pilha de layout) e o HEAD, salvo os da lista de excecoes abaixo, cada uma com motivo. A lista tem SHA TRAVADO: crescer exige mudar este
// arquivo (aparece no diff, com o motivo).
//
//   node scripts/prova-culto/ancora.mjs           (usa scripts/prova-culto/ancora.txt)
//   node scripts/prova-culto/ancora.mjs <sha>
//
// Reprova se: o SHA da ancora nao existe (rebase/squash apaga SHA de branch local), o fecho vem vazio, ou a lista de excecoes mudou sem o SHA.
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, posix } from "node:path"
import { fileURLToPath } from "node:url"

const ENTRADA = "src/frontend/MainOutput.svelte"

/** excecoes: arquivo do fecho que a pilha de layout PODE mudar, e por que a saida continua igual */
export const EXCECOES = {
    "src/frontend/stores.ts": {
        "motivo": "0b: fachada por modo de drawer/resized/activeDrawerTab/drawerTabsData; na saida `modoAlianca` nunca muda e a fachada se comporta como writable (vitest da fachada 'no processo de saida')",
        "sha": "633fb9f8ea882df1eecfff87b40ab43535fece62dea4bfa927eea3d0c30d13e3"
    },
    "src/frontend/utils/request.ts": {
        "motivo": "0a: gancho de IPC dentro de import.meta.env.DEV (some do build)",
        "sha": "209887db924050a4db78f9ff81d959c28d4ae15ebe029416287761a4803b4a59"
    },
    "src/frontend/IPC/main.ts": {
        "motivo": "0a: gancho de IPC dentro de import.meta.env.DEV (some do build)",
        "sha": "c654fc7dc7715ec2b2466bb6e595cd55a34ccacb587f41b73e2771976115014e"
    },
    "src/frontend/utils/save.ts": {
        "motivo": "0b: o disco grava drawer/drawerTabsData/resized do lado `.culto`; na saida `modoAlianca` e sempre o Culto, entao `.culto` e o mesmo store que ela ja via | leiaute v2 (commit 3): grava a chave nova `aliancaTela` (larguras/altura das divisorias); a saida nao le a chave nova",
        "sha": "536f9fd519125caf8b52accc932e0fc9240aa5e84cfabc9b95ed5a9d08aae763"
    },
    "src/frontend/utils/updateSettings.ts": {
        "motivo": "0b: carregar drawer/drawerTabsData/resized escreve no lado `.culto`; na saida `modoAlianca` e sempre o Culto, entao e o mesmo `set` de antes | leiaute v2 (commit 3): le a chave nova `aliancaTela`; carga so na janela principal",
        "sha": "6d7a2b68f8890bfe94a7e2903d97638d37d3cf5f3bf0297f93564ef6973ab60b"
    },
    "src/frontend/utils/common.ts": {
        "motivo": "0b: togglePanels guarda o 'fechei tudo' por modo (valorPorModo); so o atalho `t` da janela principal chama, e no Culto equivale a variavel unica de antes",
        "sha": "8a1ee669826a69871d531a8afb1c3165bae135c6a150e629559acb5aed23c51c"
    },
    "src/frontend/utils/startup.ts": {
        "motivo": "1b: iniciarLayoutAlianca(), iniciarMolduraAlianca() e configurarRegistroDeFalha() rodam em startupMain (a saida sai antes, por startupOutput); iniciarLayoutAlianca e iniciarMolduraAlianca ainda tem guarda de currentWindow | leiaute v2 (commit 10): iniciarMolduraAlianca sai de startupMain (so a janela principal rodava)",
        "sha": "91088ae04bd4cb6b529e47d2026b953d2d4ff7c4fd4420fb562571912c001b84"
    },
    "src/frontend/utils/shortcuts.ts": {
        "motivo": "1a/1b: porta do modo foco removida; 1b: teclas 1 a 6 (troca de pagina) saem e o Esc volta da moldura; atalho so roda na janela principal | leiaute v2 (commit 10): saem voltarDaPagina, tres ramos do Esc do Preparar, a abertura da gaveta no Ctrl+1..8 e projectTimelineActive de isTimelineActive; atalho so roda na janela principal",
        "sha": "82fe3f34d077bdc61193c47fd9b49cea0e27c807baf78d8c4f47fb02c361d522"
    },
    "src/frontend/components/context/contextMenus.ts": {
        "motivo": "1a: porta do modo foco removida; atalho e menu so rodam na janela principal",
        "sha": "d4955d71515b129536ba5f2c2343bc95a1e112231a7b2f0321d56f4f5b726d1f"
    },
    "src/frontend/components/context/menuClick.ts": {
        "motivo": "1a: porta do modo foco removida; atalho e menu so rodam na janela principal | leiaute v2 (commit 10): quick_start_guide passa a chamar falhaAlta; so roda na janela principal",
        "sha": "d956312fb884d0bd34e8bf38c1d0ec3411cca66dd7daf9328775f8fac190082e"
    },
    "src/frontend/components/main/popups/Shortcuts.svelte": {
        "motivo": "1a/1b: porta do modo foco e linha das teclas 1 a 6 removidas da lista de atalhos; popup so abre na janela principal",
        "sha": "25574a27a8b19b89900127436ea9745e0ce8658a47c403c9884003dfa2fdd26e"
    },
    "src/electron/utils/menuTemplate.ts": {
        "motivo": "1a: item do modo foco removido do menu nativo; arquivo do processo principal, o fecho o alcanca so por imports '..' dentro de src/electron e nunca entra no bundle da saida; conferido: unico importador e src/electron/index.ts",
        "sha": "13c7f8b762d5cab36e54a916117577f86518d910709ae2eb38d547740d5c41fd"
    },
    "src/frontend/utils/aliancaAbasEditor.ts": {
        "motivo": "0b/R2: a aba de antes do editor vira valorPorModo e o catch chama falhaAlta; iniciarAbasDoEditor so roda em startupMain (nunca na saida)",
        "sha": "0a03f8e05766304764ee54ac3d9122cafa6761a2710c4dc32619ba6d24a1c98b"
    },
    "src/frontend/utils/aliancaTema.ts": {
        "motivo": "leiaute v2 (fatia 1, commits 3 e 10): so escreve data-tema=\"luz\" no body da janela principal e sai cedo em qualquer outra janela (currentWindow); nenhum import de store alem de currentWindow; nada assina store",
        "sha": "ac71363d6cb09c612264872e4f877f99dae8aec6f3a8325be07e884b74330da3"
    },
    "src/frontend/utils/aliancaTemaLogica.ts": {
        "motivo": "leiaute v2 (commit 10): arquivo APAGADO (a escolha de tema/fonte do FreeShow e do Preparar morreu: uma aparencia so); a saida nunca o usou de fato",
        "sha": "apagado"
    },
    "src/frontend/components/main/popups/Initialize.svelte": {
        "motivo": "leiaute v2 (commit 10): sai guideActive.set(true) (o guia deixou de existir); o popup so abre na janela principal",
        "sha": "934a3a0aaa9936f5918655e950237e1fcb8e9de26124478f489a090f4412c261"
    }
}

/**
 * arquivos que ENTRARAM no fecho de imports da saida depois da ancora (arquivo novo, ou um que ja existia e passou a ser importado por alguem do fecho).
 * Todo arquivo de fecho(HEAD) menos fecho(ancora) tem de estar aqui. `sha` = SHA-256 do conteudo no HEAD com CRLF trocado por LF.
 */
export const NOVOS_NO_FECHO = {
    "src/frontend/utils/aliancaDrawerTabsLogica.ts": {
        "motivo": "0b: logica pura de `drawerTabsData` por modo; nao assina store",
        "sha": "6cc2921b1ab971a4aadca1dc44f382b063a173f266578b8def8b6b9f34e52e16"
    },
    "src/frontend/utils/aliancaPorModoLogica.ts": {
        "motivo": "0b: fachada por modo; na saida `modoAlianca` nunca muda e ela se comporta como writable",
        "sha": "e3d4679aab7de56d98b21c5404c268b4ed32e6070a726ab6799acef4464c03e3"
    },
    "src/frontend/utils/aliancaLayoutEstado.ts": {
        "motivo": "0b: `iniciarLayoutAlianca` sai cedo fora da janela principal; `valorPorModo` sem assinatura",
        "sha": "cbc1ae8dc6893f1e8df0975d0ef3eb4b772a923b94b5d6cc7c77fd338f2695b7"
    },
    "src/frontend/utils/aliancaFalha.ts": {
        "motivo": "R2: so cria um writable e escreve nele; nada monta FaixaDeFalha na janela de saida; na saida a falha vira so console.error; o registro em disco so e configurado em startupMain",
        "sha": "6ce913d9d26b33afa713bb663fab43ff7ec4f07e2fdee27473a7978492a6d929"
    },
    "src/frontend/utils/aliancaTelaEstado.ts": {
        "motivo": "leiaute v2 (commit 3): so cria writables (`aliancaTela`); ninguem da janela de saida os assina",
        "sha": "175c3c996dc5e076973a11342124cdec5e0e765a812bea6048ff76f6f782d5b1"
    }
}

export const SHA_EXCECOES = "08bddbe75b9388879fc79a92f365ece696870e40a435fa9b1090637c707758fd"
export const SHA_NOVOS = "cca44206a6c3dc808f117d823a748946e7639dd17ac87e13685d88f7d6d2f7c9"
export const shaDasExcecoes = () => createHash("sha256").update(JSON.stringify(EXCECOES), "utf8").digest("hex")
export const shaDosNovos = () => createHash("sha256").update(JSON.stringify(NOVOS_NO_FECHO), "utf8").digest("hex")
/** SHA-256 do texto com CRLF trocado por LF (o checkout do Windows nao pode mudar o sha) */
export const shaDoTexto = (txt) => createHash("sha256").update(String(txt).replace(/\r\n/g, "\n"), "utf8").digest("hex")

const git = (args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] })
const lerNoRef = (ref, caminho) => {
    try {
        return git(["show", `${ref}:${caminho}`])
    } catch {
        return null
    }
}

const IMPORT = /(?:import\s+(?:[^'";]*?\s+from\s+)?|import\(\s*|export\s+[^'";]*?\s+from\s+)["']([^"']+)["']/g

/** resolve um import relativo para um arquivo que existe no ref; devolve caminho ou null */
export function resolver(deArquivo, alvo, existe) {
    if (!alvo.startsWith(".")) return null
    const base = posix.normalize(posix.join(posix.dirname(deArquivo), alvo))
    for (const c of [base, base + ".ts", base + ".js", base + ".svelte", base + "/index.ts", base + "/index.js"]) if (existe(c)) return c
    return null
}

/** le varios arquivos de um ref de uma vez (git cat-file --batch: um processo so). devolve { caminho: texto|null } */
export function lerLote(ref, caminhos) {
    const saida = {}
    if (!caminhos.length) return saida
    const buf = execFileSync("git", ["cat-file", "--batch"], { input: caminhos.map((c) => `${ref}:${c}`).join("\n") + "\n", maxBuffer: 1024 * 1024 * 1024 })
    let p = 0
    for (const c of caminhos) {
        const fim = buf.indexOf(10, p)
        const cab = buf.toString("utf8", p, fim)
        p = fim + 1
        if (cab.endsWith(" missing")) {
            saida[c] = null
            continue
        }
        const tam = Number(cab.split(" ")[2])
        saida[c] = buf.toString("utf8", p, p + tam)
        p += tam + 1
    }
    return saida
}

/** o mesmo fecho, mas lendo em lote por nivel (rapido em repositorio grande) */
export function fechoDoRef(entrada, ref) {
    const cache = {}
    const ler = (cs) => {
        const falta = cs.filter((c) => !(c in cache))
        Object.assign(cache, lerLote(ref, falta))
    }
    const vistos = new Set()
    let nivel = [entrada]
    while (nivel.length) {
        ler(nivel)
        const proximos = new Set()
        const candidatos = []
        const pares = []
        for (const f of nivel) {
            if (vistos.has(f) || cache[f] == null) continue
            vistos.add(f)
            for (const m of cache[f].matchAll(IMPORT)) {
                if (!m[1].startsWith(".")) continue
                const base = posix.normalize(posix.join(posix.dirname(f), m[1]))
                const cs = [base, base + ".ts", base + ".js", base + ".svelte", base + "/index.ts", base + "/index.js"]
                candidatos.push(...cs)
                pares.push(cs)
            }
        }
        ler(candidatos)
        for (const cs of pares) {
            const r = cs.find((c) => cache[c] != null)
            if (r && !vistos.has(r)) proximos.add(r)
        }
        nivel = [...proximos]
    }
    return vistos
}

/** fecho de imports a partir da entrada, lendo do ref dado. leitor(caminho) => texto | null */
export function fecho(entrada, leitor) {
    const vistos = new Set()
    const fila = [entrada]
    while (fila.length) {
        const f = fila.pop()
        if (vistos.has(f)) continue
        const texto = leitor(f)
        if (texto == null) continue
        vistos.add(f)
        for (const m of texto.matchAll(IMPORT)) {
            const r = resolver(f, m[1], (c) => leitor(c) != null)
            if (r && !vistos.has(r)) fila.push(r)
        }
    }
    return vistos
}

/**
 * fechoDaAncora / fechoDoHead: conjuntos de arquivos; alterados: arquivos que mudaram entre a ancora e o HEAD;
 * shaAtual(caminho): SHA do conteudo no HEAD (ou null se o arquivo nao existe).
 */
export function verificar({ fechoDaAncora, fechoDoHead = null, alterados, excecoes = EXCECOES, novos = NOVOS_NO_FECHO, shaExcecoes = SHA_EXCECOES, shaNovos = SHA_NOVOS, shaAtual = () => null }) {
    const erros = []
    if (!fechoDaAncora.size) erros.push("o fecho de imports de MainOutput.svelte veio vazio")
    if (shaDasExcecoes() !== shaExcecoes && excecoes === EXCECOES) erros.push(`a lista de excecoes mudou (sha ${shaDasExcecoes()} != ${shaExcecoes}): atualize SHA_EXCECOES junto com o motivo`)
    if (shaDosNovos() !== shaNovos && novos === NOVOS_NO_FECHO) erros.push(`a lista NOVOS_NO_FECHO mudou (sha ${shaDosNovos()} != ${shaNovos}): atualize SHA_NOVOS junto com o motivo`)
    for (const a of alterados) if (fechoDaAncora.has(a) && !(a in excecoes)) erros.push(`${a}: arquivo da janela de saida mudou desde a ancora e nao esta na lista de excecoes`)
    // diferenca de conjuntos: tudo que entrou no fecho precisa de motivo (existisse ou nao na ancora)
    if (fechoDoHead) for (const n of fechoDoHead) if (!fechoDaAncora.has(n) && !(n in novos)) erros.push(`${n}: arquivo NOVO no fecho da janela de saida (nao estava no fecho da ancora) e nao esta em NOVOS_NO_FECHO`)
    if (fechoDoHead) for (const n of Object.keys(novos)) if (fechoDaAncora.has(n) || !fechoDoHead.has(n)) erros.push(`${n}: esta em NOVOS_NO_FECHO mas nao e um arquivo que entrou no fecho`)
    // trava de conteudo: mudar o arquivo sem atualizar o sha (e reler o motivo) reprova
    for (const [lista, nome] of [
        [excecoes, "EXCECOES"],
        [novos, "NOVOS_NO_FECHO"]
    ]) {
        for (const [caminho, e] of Object.entries(lista)) {
            const atual = shaAtual(caminho)
            if (atual === null) continue
            if (atual !== e.sha) erros.push(`${caminho}: o conteudo mudou (sha ${atual}) e ${nome} guarda ${e.sha}: releia o motivo e atualize o sha`)
        }
    }
    return erros
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const aqui = dirname(fileURLToPath(import.meta.url))
    const ancora = process.argv[2] || readFileSync(join(aqui, "ancora.txt"), "utf8").trim()
    try {
        git(["cat-file", "-e", `${ancora}^{commit}`])
    } catch {
        console.error(`ANCORA: o commit ${ancora} nao existe mais (rebase/squash?). Regrave scripts/prova-culto/ancora.txt com a base real da pilha.`)
        process.exit(1)
    }
    const f = fechoDoRef(ENTRADA, ancora)
    const alterados = git(["diff", "--name-only", "--no-renames", ancora, "HEAD"]).split("\n").filter(Boolean)
    const fHead = fechoDoRef(ENTRADA, "HEAD")
    const erros = verificar({ fechoDaAncora: f, fechoDoHead: fHead, alterados, shaAtual: (c) => (lerNoRef("HEAD", c) === null ? null : shaDoTexto(lerNoRef("HEAD", c))) })
    if (erros.length) {
        console.error(`ANCORA: ${erros.length} erro(s)`)
        for (const e of erros) console.error("  - " + e)
        process.exit(1)
    }
    console.log(`ANCORA: ok (fecho de ${f.size} arquivos; ${alterados.filter((a) => f.has(a)).length} alterados, todos na lista de excecoes; ${[...fHead].filter((n) => !f.has(n)).length} novos no fecho, todos em NOVOS_NO_FECHO)`)
}
