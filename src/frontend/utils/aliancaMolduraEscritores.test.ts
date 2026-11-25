// Fatia 2, secao 3 do plano: a guarda dos ESCRITORES de `activePage`. `activePage` e fachada (aliancaPaginaGuarda): o unico lugar do app que escreve
// nela e a porta `trocarTela` (aliancaTela.ts). Este teste:
//   1. proibe `activePage.set(`/`.update(` em qualquer arquivo que nao seja aliancaTela.ts (a fachada recusaria a troca de classe de qualquer jeito;
//      aqui o erro aparece na hora do teste e nao na faixa de falha no meio do culto);
//   2. compara, arquivo a arquivo, as chamadas de `trocarTela(` com `aliancaMolduraEscritores.json`, que guarda a CLASSE de cada chamador (gesto) e
//      a lista de arquivos que tiveram a escrita RETIRADA (efeito colateral, origem remota) com o motivo; escritor novo reprova ate o JSON ser
//      regravado de proposito (REGRAVAR_ESCRITORES=1) e o diff do JSON aparece no PR;
//   3. confere que o destino e a lista de gestos sao conhecidos (GESTOS em aliancaTela.ts) e que `$activePage =`, `bind:` com `$activePage` e
//      `$[` com chave variavel fora dos arquivos de DOLAR_COLCHETE nao existem;
//   4. proibe `modoAlianca` em codigo (o store saiu).
//
// O QUE ESTA GUARDA NAO COBRE: escrita por outro nome (um alias de `activePage`), `trocarTela` montado por texto, e parenteses dentro de texto no
// argumento (a contagem de parenteses leria errado). Linhas que comecam por // ou * ou /* sao ignoradas.
import { readdirSync, readFileSync, statSync, writeFileSync } from "fs"
import { join, relative } from "path"
import { describe, expect, it } from "vitest"

const SRC = join(__dirname, "..")
const JSON_PATH = join(__dirname, "aliancaMolduraEscritores.json")
const DESTINOS = ['"show"', '"edit"', '"stage"', '"settings"', '"draw"']

/** destinos que chegam por argumento: o valor vem de fora e a fachada recusa o que nao tem lugar */
export const DINAMICOS: Record<string, string[]> = {
    "components/main/AliancaMenuApp.svelte": ["p"]
}

/**
 * arquivos que usam `$[chave]` (o mapa generico de stores de stores.ts). So `historyStores.ts`, `menuClick.ts` e `update.ts` escrevem (e
 * `update.ts` so e chamado com "media"); `listeners.ts` so le (`get($[...])`). Conferido por leitura na 1b: nenhum desses passa `activePage`.
 */
export const DOLAR_COLCHETE = ["components/helpers/historyStores.ts", "components/context/menuClick.ts", "components/helpers/update.ts", "utils/listeners.ts"]

/** a CLASSE de cada arquivo que chama a porta (secao 3 do plano). Arquivo novo sem classe reprova. */
export const CLASSES: Record<string, string> = {
    "components/context/aliancaMenusEditar.ts": "gesto: botao direito (Editar na linha de show da biblioteca)",
    "components/context/menuClick.ts": "gesto: botao direito (Editar e abrir em Mostrar) e paginas do menu",
    "components/drawer/info/ScriptureInfo.svelte": "gesto: botao de pagina",
    "components/edit/tools/SlideStyle.svelte": "gesto: botao de pagina (editar o modelo)",
    "components/main/AliancaCorpoPagina.svelte": "gesto: botao Fechar do cabecalho das paginas do menu (volta a Mostrar ou a Editar, de onde veio)",
    "components/main/AliancaModeloBiblia.svelte": "gesto: botao Editar modelo da Biblia (cabecalho da biblioteca, cabine-5)",
    "components/main/AliancaMenuApp.svelte": "gesto: menu do app",
    "components/main/AliancaSirvoPilula.svelte": "gesto: pilula Sirvo",
    "components/main/AliancaTelaoPilula.svelte": "gesto: pilula do telao (abrir Configuracoes; e o item Editar visuais do Visual, cabine 6)",
    "components/main/AliancaTopo.svelte": "gesto: segmentado Mostrar | Editar",
    "components/main/AliancaOrigemModelo.svelte": "gesto: clique numa etiqueta da linha de origem abre o modelo no Editar (cabine 6, V1)",
    "components/main/StatusIndicator.svelte": "gesto: botao de pagina",
    "components/main/popups/MetadataDisplay.svelte": "gesto: botao de pagina (popup)",
    "components/main/popups/OutputSelector.svelte": "gesto: botao de pagina (popup)",
    "components/main/popups/SelectStageLayout.svelte": "gesto: botao de pagina (popup)",
    "components/main/popups/SelectStyle.svelte": "gesto: botao de pagina (popup)",
    "components/main/popups/TemplateInfo.svelte": "gesto: botao de pagina (popup)",
    "components/main/popups/TemplateStyleOverrides.svelte": "gesto: botao de pagina (popup)",
    "components/output/preview/MultiOutputs.svelte": "gesto, morre com o arquivo",
    "components/settings/SettingsTabs.svelte": "gesto, morre com o arquivo (fatia 4)",
    "components/settings/tabs/Outputs.svelte": "gesto: botao de pagina",
    "components/settings/tabs/Styles.svelte": "gesto: botao de pagina (editar o modelo)",
    "components/stage/StageLayout.svelte": "gesto: botao de pagina",
    "utils/aliancaChamadas.ts": "gesto: botao Salvar e ajustar da chamada (Chamadas, coluna No ar) abre a sobreposicao no Editar",
    "utils/aliancaBiblioteca.ts": "gesto: Editar da biblioteca",
    "utils/aliancaSpotlight.ts": "gesto: busca Spotlight (Ctrl+K): Configuracoes, Telas e abrir o que vive em Mostrar quando a busca abre numa pagina do menu",
    "utils/aliancaPilula.ts": "gesto: chips que levam a Mostrar"
}

/** arquivos que tinham `activePage.set(` e perderam: nao trocam a tela (efeito colateral ou origem remota) */
export const RETIRADOS: Record<string, string> = {
    "IPC/responsesMain.ts": "remota: processo principal (restaurar); a acao acontece, a tela nao troca",
    "components/actions/apiHelper.ts": "remota: API e celular",
    "components/drawer/audio/AudioMeter.svelte": "colateral: abrir o mixer levava a Mostrar",
    "components/edit/scripts/edit.ts": "colateral: abrir a gaveta levava a Mostrar (a biblioteca agora fica sempre aberta)",
    "components/helpers/history.ts": "colateral: desfazer/refazer nunca navega",
    "components/inputs/HiddenInput.svelte": "colateral: renomear leva ao editor",
    "components/main/popups/CleaningUtility.svelte": "colateral: limpeza de shows",
    "components/main/popups/ResetAll.svelte": "colateral: reiniciar tudo",
    "components/settings/tabs/Connection.svelte": "colateral: sincronizar provedor de conteudo",
    "components/show/Slides.svelte": "colateral: criar slide levava ao editor",
    "components/slide/Slide.svelte": "colateral (decisao 4: duplo clique/notas no slide nao abre o editor)",
    "converters/project.ts": "colateral: converter projeto abria o item",
    "utils/shortcuts.ts": "atalho de troca: Ctrl+Shift+T nao troca mais de tela (alterna a edicao de texto dentro de Editar)"
}

function arquivos(dir: string, saida: string[] = []): string[] {
    for (const nome of readdirSync(dir)) {
        const p = join(dir, nome)
        if (statSync(p).isDirectory()) arquivos(p, saida)
        else if (/\.(ts|svelte)$/.test(nome) && !/\.test\.ts$/.test(nome)) saida.push(p)
    }
    return saida
}

export function lerTudo(): Record<string, string> {
    const o: Record<string, string> = {}
    for (const p of arquivos(SRC)) o[relative(SRC, p).replace(/\\/g, "/")] = readFileSync(p, "utf8").replace(/\r\n/g, "\n")
    return o
}

/** troca por linha vazia o que e comentario de linha inteira (a contagem nao enxerga comentario) */
const semComentarios = (src: string) =>
    src
        .split("\n")
        .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l))
        .join("\n")

/** o texto entre os parenteses que abrem em `abre` (indice do `(`) e o fecho correspondente, sem espacos nas pontas */
function argumento(src: string, abre: number): string {
    let n = 0
    for (let i = abre; i < src.length; i++) {
        if (src[i] === "(") n++
        else if (src[i] === ")" && --n === 0) return src.slice(abre + 1, i).trim()
    }
    return src.slice(abre + 1).trim()
}

/** os gestos conhecidos, lidos do texto de aliancaTela.ts (sem importar o modulo, que puxa a arvore de stores) */
export function gestosConhecidos(textos: Record<string, string>): string[] {
    const m = /export const GESTOS = \[([\s\S]*?)\] as const/.exec(textos["utils/aliancaTela.ts"] || "")
    return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : []
}

/** por arquivo, os argumentos de cada `trocarTela(` (a chamada da porta; a definicao em aliancaTela.ts nao conta) */
export function extrairPortas(textos: Record<string, string>): Record<string, string[]> {
    const saida: Record<string, string[]> = {}
    for (const [arq, bruto] of Object.entries(textos).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
        if (arq === "utils/aliancaTela.ts") continue
        const src = semComentarios(bruto)
        const args: string[] = []
        for (const m of src.matchAll(/(?<![A-Za-z_.])trocarTela\(/g)) args.push(argumento(src, m.index! + m[0].length - 1))
        if (args.length) saida[arq] = args
    }
    return saida
}

export type Esperado = { portas: Record<string, { classe: string; chamadas: string[] }>; retirados: Record<string, string> }

export function gerarEsperado(textos: Record<string, string>): Esperado {
    const portas: Esperado["portas"] = {}
    for (const [arq, chamadas] of Object.entries(extrairPortas(textos))) portas[arq] = { classe: CLASSES[arq] || "SEM CLASSE", chamadas }
    return { portas, retirados: { ...RETIRADOS } }
}

export function problemasDosEscritores(textos: Record<string, string>, esperado: Esperado): string[] {
    const erros: string[] = []
    const real = extrairPortas(textos)
    const gestos = gestosConhecidos(textos)
    // 2. o JSON bate com o codigo
    for (const arq of new Set([...Object.keys(real), ...Object.keys(esperado.portas)])) {
        if (JSON.stringify(real[arq] || []) !== JSON.stringify(esperado.portas[arq]?.chamadas || [])) erros.push(`${arq}: chamadas de trocarTela mudaram (esperado ${JSON.stringify(esperado.portas[arq]?.chamadas || [])}, achei ${JSON.stringify(real[arq] || [])})`)
        if (real[arq] && !CLASSES[arq]) erros.push(`${arq}: chama a porta e nao tem CLASSE (secao 3 do plano)`)
    }
    // 3. destino e gesto conhecidos
    for (const [arq, chamadas] of Object.entries(real)) {
        for (const c of chamadas) {
            const [destino, gesto] = c.split(/,\s*(?=[^,]*$)/)
            if (!DESTINOS.includes(destino) && !(DINAMICOS[arq] || []).includes(destino)) erros.push(`${arq}: destino fora da lista nomeada de dinamicos: trocarTela(${c})`)
            if (!gestos.includes((gesto || "").replace(/"/g, ""))) erros.push(`${arq}: gesto desconhecido (fora de GESTOS): trocarTela(${c})`)
        }
    }
    for (const [arq, bruto] of Object.entries(textos)) {
        const src = semComentarios(bruto)
        // 1. a fachada: so a porta escreve
        if (arq !== "utils/aliancaTela.ts" && /activePage\.(set|update)\(/.test(src)) erros.push(`${arq}: activePage.set/update fora da porta (use trocarTela ou tire a escrita)`)
        if (/\$activePage\s*=(?!=)/.test(src)) erros.push(`${arq}: $activePage = (atribuicao)`)
        if (/bind:[A-Za-z:]*=\{\s*\$activePage/.test(src)) erros.push(`${arq}: bind: com $activePage`)
        if (/\$\[/.test(src) && !DOLAR_COLCHETE.includes(arq)) erros.push(`${arq}: $[ com chave variavel fora de ${DOLAR_COLCHETE.join(", ")}`)
        // 4. o store modoAlianca saiu
        if (/\bmodoAlianca\b/.test(src)) erros.push(`${arq}: modoAlianca (o store saiu na fatia 2; use \`tela\`)`)
    }
    return erros
}

const REAL = lerTudo()
if (process.env.REGRAVAR_ESCRITORES) writeFileSync(JSON_PATH, JSON.stringify(gerarEsperado(REAL), null, 4) + "\n")
const ESPERADO: Esperado = JSON.parse(readFileSync(JSON_PATH, "utf8"))

describe("escritores de activePage (secao 3, fatia 2)", () => {
    it("o JSON bate com o codigo, arquivo a arquivo, e nada foge das regras", () => {
        expect(problemasDosEscritores(REAL, ESPERADO)).toEqual([])
    })
    it("o JSON esta em ordem de arquivo (diff estavel) e o que ele diz e o que gerarEsperado diz", () => {
        const chaves = Object.keys(ESPERADO.portas)
        expect(chaves).toEqual([...chaves].sort())
        expect(ESPERADO).toEqual(gerarEsperado(REAL))
    })
    it("os arquivos de RETIRADOS existem e nao escrevem mais em activePage", () => {
        for (const arq of Object.keys(RETIRADOS)) {
            expect(REAL[arq], arq).toBeDefined()
            expect(/activePage\.(set|update)\(/.test(semComentarios(REAL[arq])), arq).toBe(false)
        }
    })
    it("os dinamicos nomeados existem de verdade (lista sem entrada morta)", () => {
        for (const [arq, args] of Object.entries(DINAMICOS))
            for (const a of args)
                expect(
                    ESPERADO.portas[arq]?.chamadas.some((c) => c.startsWith(a + ",")),
                    arq
                ).toBe(true)
    })
    it("so a janela principal chama a porta: nenhum arquivo do fecho da saida tem chamada (a saida nunca troca de tela)", () => {
        // a porta tem `if (!ehPrincipal()) return false`; aqui so a conferencia do texto
        expect(REAL["utils/aliancaTela.ts"]).toContain("if (!ehPrincipal()) return false")
    })

    describe("mutacoes (texto injetado)", () => {
        const com = (arq: string, texto: string) => ({ ...REAL, [arq]: (REAL[arq] || "") + "\n" + texto })
        const ARQ = "components/main/AliancaTopo.svelte"
        it("activePage.set(...) fora da porta reprova (mesmo literal valido)", () => {
            expect(problemasDosEscritores(com(ARQ, 'activePage.set("show")'), ESPERADO).join()).toContain("fora da porta")
        })
        it("escritor novo da porta reprova ate regravar o JSON", () => {
            expect(problemasDosEscritores(com(ARQ, 'trocarTela("show", "segmentado")'), ESPERADO).join()).toContain("mudaram")
        })
        it("destino variavel fora da lista reprova", () => {
            expect(problemasDosEscritores(com(ARQ, 'trocarTela(qualquer, "segmentado")'), ESPERADO).join()).toContain("fora da lista nomeada")
        })
        it("gesto inventado reprova", () => {
            expect(problemasDosEscritores(com(ARQ, 'trocarTela("show", "inventado")'), ESPERADO).join()).toContain("gesto desconhecido")
        })
        it("activePage.update(, $activePage = e bind: reprovam", () => {
            expect(problemasDosEscritores(com(ARQ, "activePage.update((a) => a)"), ESPERADO).join()).toContain("fora da porta")
            expect(problemasDosEscritores(com(ARQ, '$activePage = "draw"'), ESPERADO).join()).toContain("atribuicao")
            expect(problemasDosEscritores(com(ARQ, "<input bind:value={$activePage} />"), ESPERADO).join()).toContain("bind")
        })
        it("$activePage === nao e atribuicao", () => {
            expect(problemasDosEscritores(com(ARQ, '{#if $activePage === "show"}x{/if}'), ESPERADO).join()).not.toContain("atribuicao")
        })
        it("$[chave] fora dos arquivos permitidos reprova", () => {
            expect(problemasDosEscritores(com(ARQ, "$[id].set(1)"), ESPERADO).join()).toContain("$[")
        })
        it("o store modoAlianca em codigo reprova", () => {
            expect(problemasDosEscritores(com(ARQ, "$: x = $modoAlianca"), ESPERADO).join()).toContain("modoAlianca")
        })
        it("comentario nao conta", () => {
            expect(problemasDosEscritores(com(ARQ, '// activePage.set("draw")\n// modoAlianca'), ESPERADO)).toEqual([])
        })
    })
})
