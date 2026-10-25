// Gera as Biblias embutidas no instalador (bundled-bibles/*.fsb) a partir das
// fontes que ficam FORA do repositorio -- o texto e licenciado e nao entra no
// historico (veja bundled-bibles/README.md).
//
//   node scripts/gerarBiblias.js --nvi <caminho>/Biblia-NVI/nvi.json --ara <caminho>/ARA/ARA.xml
//
// Qualquer uma das duas pode ficar de fora. O .fsb e o formato do proprio app:
// JSON com [id, biblia], e o nome do arquivo tem que casar com o "name"
// registrado em scriptures (defaults.ts / bibliasEmbutidas.ts).

const fs = require("fs")
const path = require("path")

const DESTINO = path.join(__dirname, "..", "bundled-bibles")

function argumento(nome) {
    const i = process.argv.indexOf(`--${nome}`)
    return i > -1 ? process.argv[i + 1] : ""
}

// NVI: o JSON aninhado da pasta Biblia-NVI (livro -> capitulo -> versiculo)
function daNvi(arquivo) {
    const nvi = JSON.parse(fs.readFileSync(arquivo, "utf8"))
    return {
        name: "NVI",
        abbreviation: "NVI",
        metadata: { title: nvi.traducao, identifier: "NVI", language: "pt-BR", copyright: "Nova Versão Internacional © Biblica, Inc." },
        books: nvi.livros.map((livro, i) => ({
            number: i + 1,
            name: livro.nome,
            abbreviation: livro.abreviacao,
            id: livro.codigo,
            chapters: livro.capitulos.map((cap) => ({
                number: cap.numero,
                ...(cap.tituloSalmo ? { header: cap.tituloSalmo } : {}),
                verses: cap.versiculos.map((v) => ({ number: v.numero, text: v.texto }))
            }))
        }))
    }
}

// ARA: Zefania XML. Sem dependencia de parser: o arquivo e regular e foi
// validado (66 livros, 1189 capitulos, nenhum versiculo vazio).
const ENTIDADES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" }
const texto = (s) => s.replace(/&(amp|lt|gt|quot|apos);/g, (e) => ENTIDADES[e]).trim()
const atributo = (tag, nome) => (tag.match(new RegExp(`${nome}="([^"]*)"`)) || [])[1] || ""

function daAra(arquivo, codigos) {
    const xml = fs.readFileSync(arquivo, "utf8")
    const books = [...xml.matchAll(/<BIBLEBOOK([^>]*)>([\s\S]*?)<\/BIBLEBOOK>/g)].map(([, attrs, corpo]) => {
        const number = Number(atributo(attrs, "bnumber"))
        return {
            number,
            name: texto(atributo(attrs, "bname")),
            abbreviation: texto(atributo(attrs, "babbr")),
            // a ARA nao traz o codigo USFM; a ordem dos livros e a mesma da NVI
            ...(codigos[number - 1] ? { id: codigos[number - 1] } : {}),
            chapters: [...corpo.matchAll(/<CHAPTER([^>]*)>([\s\S]*?)<\/CHAPTER>/g)].map(([, cattrs, ccorpo]) => ({
                number: Number(atributo(cattrs, "cnumber")),
                verses: [...ccorpo.matchAll(/<VERS([^>]*)>([\s\S]*?)<\/VERS>/g)].map(([, vattrs, v]) => ({ number: Number(atributo(vattrs, "vnumber")), text: texto(v) }))
            }))
        }
    })

    return {
        name: "ARA",
        abbreviation: "ARA",
        metadata: { title: "Almeida Revista e Atualizada", identifier: "ARA", language: "pt-BR", copyright: "Almeida Revista e Atualizada © Sociedade Bíblica do Brasil" },
        books
    }
}

function conferir(biblia) {
    const capitulos = biblia.books.reduce((s, b) => s + b.chapters.length, 0)
    const versiculos = biblia.books.reduce((s, b) => s + b.chapters.reduce((t, c) => t + c.verses.length, 0), 0)
    const vazios = biblia.books.flatMap((b) => b.chapters.flatMap((c) => c.verses.filter((v) => !v.text))).length
    if (biblia.books.length !== 66 || vazios) throw new Error(`${biblia.name}: ${biblia.books.length} livros, ${vazios} versículos vazios`)
    return `${biblia.books.length} livros, ${capitulos} capítulos, ${versiculos} versículos`
}

function gravar(id, biblia) {
    const arquivo = path.join(DESTINO, `${biblia.name}.fsb`)
    fs.writeFileSync(arquivo, JSON.stringify([id, biblia]))
    console.log(`${path.relative(process.cwd(), arquivo)}: ${conferir(biblia)}`)
}

const nvi = argumento("nvi")
const ara = argumento("ara")
if (!nvi && !ara) {
    console.error("Uso: node scripts/gerarBiblias.js --nvi <nvi.json> --ara <ARA.xml>")
    process.exit(1)
}

let codigos = []
if (nvi) {
    const biblia = daNvi(nvi)
    codigos = biblia.books.map((b) => b.id)
    gravar("nvi", biblia)
}
if (ara) gravar("ara", daAra(ara, codigos))
