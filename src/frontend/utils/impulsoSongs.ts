// AliancaShow: as 12 musicas base do Impulso, geradas a partir dos .txt de
// "Letras Impulso". Uma secao por slide, e o layout segue a ordem da linha
// ESTRUTURA de cada arquivo — por isso alguns layouts repetem slides (ex.:
// "Tempestade de Gloria" tem 5 secoes e 7 slides no layout).
//
// Para regerar depois de editar os .txt, veja scripts/gerarImpulso.md

import type { Show } from "../../types/Show"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"
import { setShow } from "../components/helpers/setShow"

export const IMPULSO_CATEGORY = "impulso"

type ImpulsoSection = { id: string; group: string; lines: string[] }
type ImpulsoSong = { id: string; name: string; sections: ImpulsoSection[]; order: string[] }

const IMPULSO_SONGS: ImpulsoSong[] = [
    {
        id: "impulso_aos_teus_pes",
        name: "Aos Teus Pés",
        sections: [
            { id: "verso_1", group: "Verso 1", lines: ["Uma vida é pouco para Te amar", "Tudo que tenho quero Te entregar", "Sua voz é tão doce aqui", "Seu abraço é tão quente", "Seus olhos me incendeiam de amor", "Meu coração Te leva aonde for"] },
            { id: "pre_refrao", group: "Pré-Refrão", lines: ["Não posso viver sem Ti"] },
            { id: "refrao_1", group: "Refrão 1", lines: ["Eis-me aqui, eu sou aquele", "Que Tu chamas pelo nome", "Eu irei"] },
            { id: "refrao_2", group: "Refrão 2", lines: ["Senhor, eu Te amo", "Senhor, eu Te quero", "Não só uma noite, mas", "Toda minha vida aos Teus pés"] },
            { id: "ponte", group: "Ponte", lines: ["Toda minha vida", "Toda a minha vida aos Teus pés"] },
            { id: "final", group: "Final", lines: ["Então queimarei", "Dia e noite", "Eu queimarei", "Sem cessar"] },
        ],
        order: ["verso_1", "pre_refrao", "refrao_1", "refrao_2", "ponte", "final"]
    },
    {
        id: "impulso_cordeiro_santo",
        name: "Cordeiro Santo",
        sections: [
            { id: "verso_1", group: "Verso 1", lines: ["Entronizado nos céus", "Teu nome ecoa", "Por toda terra", "Em ti sou filho", "Em tua presença", "Vejo tua glória"] },
            { id: "refrao", group: "Refrão", lines: ["Onde os seus anjos", "Te adoram", "Cordeiro santo, Emanuel", "Cantamos santo", "Ao nosso amado", "Seja adorado", "Na terra e céus"] },
            { id: "refrao_2", group: "Refrão 2", lines: ["Quem tem ouvido ouça o som", "Quem tem olhos veja glória", "Os que tem boca clamarão", "Ora vem, Senhor Jesus", "Ora vem, ora vem", "Ora vem, Senhor Jesus"] },
            { id: "refrao_3", group: "Refrão 3", lines: ["O som da tua trombeta", "O som que vem do céu", "O som que anuncia", "O Deus de Israel"] },
        ],
        order: ["verso_1", "refrao", "refrao_2", "refrao_3"]
    },
    {
        id: "impulso_cristo_vive",
        name: "Cristo Vive",
        sections: [
            { id: "intro", group: "Intro", lines: ["Nos assentamos", "Compartilhamos vinho e pão", "Olhando nos seus olhos", "Amor que não tem fim"] },
            { id: "verso_1", group: "Verso 1", lines: ["O sangue que nos lava", "Ele é o pão da vida", "E quando não vejo saída", "Ele é o meu Senhor"] },
            { id: "refrao", group: "Refrão", lines: ["Cristo vive", "Ele ressuscitou", "Venceu a morte", "E hoje livre sou", "Os joelhos se dobrarão", "Escama cairão", "O cordeiro morreu e vira como leão"] },
            { id: "pos_refrao", group: "Pós-Refrão", lines: ["Cristo", "Vive", "Cristo", "Vive"] },
        ],
        order: ["intro", "verso_1", "refrao", "pos_refrao"]
    },
    {
        id: "impulso_dissolver",
        name: "Dissolver",
        sections: [
            { id: "verso_1", group: "Verso 1", lines: ["És a minha fonte, meu horizonte", "Meu coração é tua casa, vem morar", "Por onde eu passar, que possam enxergar a ti em mim"] },
            { id: "verso_2", group: "Verso 2", lines: ["És o meu abrigo, meu motivo de sorrir a sós", "Me achou perdido quando tudo que restou foi só"] },
            { id: "refrao", group: "Refrão", lines: ["Faça dissolver, desintegrar, todo medo de me aproximar", "Do teu amor, és meu Senhor, único que pode me salvar", "Faça eu lembrar o meu lugar", "Reconstruir o teu altar", "E te entregar o que é meu", "O que é meu é tão seu"] },
            { id: "ponte", group: "Ponte", lines: ["Ouço tua voz ao meu calar", "Posso respirar sem medo", "Vejo tudo me mostrar", "Que esse é meu lugar", "Me rendo"] },
        ],
        order: ["verso_1", "verso_2", "refrao", "ponte"]
    },
    {
        id: "impulso_fome_e_sede",
        name: "Fome e Sede",
        sections: [
            { id: "intro", group: "Intro", lines: ["Fome que não morre", "Sede que não passa", "Me entrego pra ter mais de ti"] },
            { id: "verso_1", group: "Verso 1", lines: ["Sacia meu desejo", "A minha vontade", "Da tua presença em mim"] },
            { id: "pre_refrao", group: "Pré-Refrão", lines: ["O pão que só tu tens", "E que eu não se encontra em outro lugar", "Eu não vou parar até te alcançar", "Meu coração deseja", "Toda minha alma anseia por ti", "Me ensina a fazer tua vontade"] },
            { id: "refrao_1", group: "Refrão 1", lines: ["Quando nada mais importa", "Tudo perde o valor perante a ti", "Só tu me satisfaz! Só tu me satisfaz!", "Eu me alimento da tua glória", "E do mover do teu Espírito em mim", "Só tu me satisfaz! Só tu me satisfaz!"] },
            { id: "refrao_2", group: "Refrão 2", lines: ["Tu que me move, tu que me abraça", "Tu que me acolhe em tua graça", "Encontrei amor", "Eu dependo de ti, Senhor"] },
        ],
        order: ["intro", "verso_1", "pre_refrao", "refrao_1", "refrao_2"]
    },
    {
        id: "impulso_minha_paz",
        name: "Minha Paz",
        sections: [
            { id: "refrao", group: "Refrão", lines: ["Meu Deus eu quero minha paz", "Eu quero muito mais pra viver", "Vou me entregar", "Fortificar", "A fortaleza com meus irmãos", "E nada abala minha fé", "Tua Palavra é luz pro meu caminho", "Eu sigo de pé", "Vem o que vier", "Eu sei que não to sozinho"] },
            { id: "verso_1", group: "Verso 1", lines: ["Eu nessa maré sou navegante", "Energia cristalina contagia nesse instante", "Quem tá comigo pelo mesmo objetivo, viver o que tem de bom e mostrar que Deus tá vivo"] },
            { id: "verso_2", group: "Verso 2", lines: ["Eu sigo vivendo vivão, mandando meu som com meus irmãos", "Segura a visão, é sem limite no apetite de mais", "Eu quero sonhar eu quero liberdade", "Quero amor quero tomar coragem", "Pra falar pra todo mundo que isso aqui é de verdade"] },
            { id: "verso_3", group: "Verso 3", lines: ["To progredindo com os irmãos", "Debaixo da unção", "Vamo viver vivão", "Subsolo chegou então", "Chegamo pesadão", "Sempre na união", "Nós somos a geração", "Que Deus chamou então", "Vamo mudar o mundão", "Eu sei o meu chamado", "Então já to ligado", "Sempre onde eu estiver", "Sua luz vai tá pra todo lado"] },
            { id: "final", group: "Final", lines: ["Eu sou tua casa", "Me chama de lar", "Faz tua morada", "Venha habitar"] },
        ],
        order: ["refrao", "verso_1", "verso_2", "verso_3", "final"]
    },
    {
        id: "impulso_queremos_te_ver",
        name: "Queremos Te Ver",
        sections: [
            { id: "verso_1", group: "Verso 1", lines: ["Em teus passos, eu quero andar", "Seu sorriso vem, me avivar", "Suas mãos, quero tocar", "Em teus braços me lançar"] },
            { id: "ponte", group: "Ponte", lines: ["E ele vem, ele vem, aqui", "E ele vem, ele vem, aqui"] },
            { id: "refrao", group: "Refrão", lines: ["Tua noiva te espera", "Com tua glória enche a terra", "Vem Jesus", "As lamparinas já estão acesas", "Queremos te ver, te ver", "Vem Jesus"] },
            { id: "verso_2", group: "Verso 2", lines: ["Tu prometestes que viria", "Tu percorrestes o caminho", "Foram perfuradas as suas mãos", "Junto com elas o meu coração"] },
        ],
        order: ["verso_1", "ponte", "refrao", "verso_2"]
    },
    {
        id: "impulso_quero_ser_como_voce",
        name: "Quero Ser Como Você",
        sections: [
            { id: "intro", group: "Intro", lines: ["Parara pa pa", "Parara pa pa", "Parararara pa pa a a a"] },
            { id: "verso_1", group: "Verso 1", lines: ["E eu sei que se eu te seguir", "Vou saber pra onde ir", "Sei que o Senhor está aqui, está aqui"] },
            { id: "pre_refrao", group: "Pré-Refrão", lines: ["Não quero pensar em desistir", "Sei que você está aqui", "Sei que você está aqui, está aqui"] },
            { id: "refrao_1", group: "Refrão 1", lines: ["Então me leva", "Pra onde eu devo ir", "Sei que vou conseguir", "Te ver face a face", "E outra vez me encher de ti", "No meu respirar", "No meu caminhar", "No meu falar", "Em tudo em que eu pensar"] },
            { id: "refrao_2", group: "Refrão 2", lines: ["Quero ser como você foi", "Quero ir por onde você for", "Quero me entregar e viver do teu amor, do teu amor"] },
        ],
        order: ["intro", "verso_1", "pre_refrao", "refrao_1", "refrao_2"]
    },
    {
        id: "impulso_saudade",
        name: "Saudade",
        sections: [
            { id: "verso_1", group: "Verso 1", lines: ["Tão pequeno eu sou diante da tua glória", "E mesmo assim me olha", "Com tanto amor", "Seu singelo amor me envolve em tua graça", "Vem Senhor, me toca com seu ardor"] },
            { id: "refrao", group: "Refrão", lines: ["Eu sinto saudade", "Do seu coração", "Batendo em mim", "Eu sinto vontade", "De estar em teus braços", "E nunca mais sair"] },
            { id: "ponte", group: "Ponte", lines: ["Eu não sei viver sem tua presença", "Vazio eu seria, sem ti meu Jesus", "Sem você, de mim não sobra nada", "Toda minha vida é pra ti adorar"] },
        ],
        order: ["verso_1", "refrao", "ponte"]
    },
    {
        id: "impulso_te_adoraremos",
        name: "Te Adoraremos",
        sections: [
            { id: "verso_1", group: "Verso 1", lines: ["Vi no céu a esperança", "A luz dos homens nessa terra", "Nele o meu prazer está", "És onde habita a alegria"] },
            { id: "pre_refrao", group: "Pré-Refrão", lines: ["Minha alma anseia por ti", "Em ver seus olhos como chamas", "Minha alma anseio por ti", "Meu rei, eu sei que tu és por mim"] },
            { id: "refrao", group: "Refrão", lines: ["Te adoraremos, no meio do vale louvaremos", "A todo tempo, a ti seja a honra e o louvor"] },
            { id: "refrao_2", group: "Refrão 2", lines: ["Ao rei que está assentado cantamos", "Aleluia", "Somente aquele que é digno exaltamos", "Aleluia"] },
        ],
        order: ["verso_1", "pre_refrao", "refrao", "refrao_2"]
    },
    {
        id: "impulso_tempestade_de_gloria",
        name: "Tempestade de Glória",
        sections: [
            { id: "verso_1", group: "Verso 1", lines: ["Eu ouço a tua voz que insiste a me dizer", "Do teu amor", "Que nunca acaba"] },
            { id: "verso_2", group: "Verso 2", lines: ["Eu ouço a sua voz", "Que insiste a me chamar", "De filho meu", "De filho meu"] },
            { id: "pre_refrao", group: "Pré-Refrão", lines: ["Nada vai parar o meu Deus", "Em breve ele irá", "Nada vai me impedir", "De ir até você"] },
            { id: "refrao", group: "Refrão", lines: ["Tempestade de glória", "Faz tremer terra e céu", "Vem com a sua espada", "Ele é o Santo de Israel"] },
            { id: "ponte", group: "Ponte", lines: ["Cura, transforma", "Enche esse lugar", "Cura, transforma", "Vem me incendiar"] },
        ],
        order: ["verso_1", "verso_2", "verso_1", "verso_2", "pre_refrao", "refrao", "ponte"]
    },
    {
        id: "impulso_voz_da_criacao",
        name: "Voz da Criação",
        sections: [
            { id: "verso_1", group: "Verso 1", lines: ["No princípio era o verbo", "Deus que se fez carne", "Luz pros homens se tornou", "Estava com Deus, Ele era Deus", "Sem Ele não há vida"] },
            { id: "verso_2", group: "Verso 2", lines: ["Tu és a voz da criação", "O Deus que veio e lutou", "E chave do inferno tomou"] },
            { id: "pre_refrao", group: "Pré-Refrão", lines: ["E nem a morte te segurou", "Quero ir contigo por onde for, eu vou", "Viver o seu amor"] },
            { id: "refrao", group: "Refrão", lines: ["Ele tabernaculou, com seu povo andou", "Levou os meus pecados, hoje livre eu sou", "Ele se entregou, o meu corpo curou", "Por isso grato sou"] },
            { id: "ponte", group: "Ponte", lines: ["PRA VIVER", "O SEU", "AMORR OOO OO O O"] },
            { id: "refrao_2", group: "Refrão 2", lines: ["Queremos ver o seu reino descer aqui", "Queremos ver o seu avivamento aqui", "Queremos ser aqueles que tu escolheu", "Queremos ter aquilo que nos prometeu"] },
        ],
        order: ["verso_1", "verso_2", "pre_refrao", "refrao", "ponte", "refrao_2", "ponte"]
    },
]

// A categoria precisa existir mesmo em instalacao antiga: o valor salvo em
// settings vence o default do defaults.ts, entao adicionar la nao basta.
// Sem isto os shows ficam com "Categoria: Nao encontrado".
export function ensureImpulsoCategory(saved: Record<string, unknown> | null | undefined) {
    const list = { ...(saved || {}) } as Record<string, unknown>
    if (!list[IMPULSO_CATEGORY]) list[IMPULSO_CATEGORY] = { name: "category.impulso", icon: "song", default: true }
    return list
}

export function createImpulsoShows() {
    const created = new Date("2026-09-02").getTime()

    IMPULSO_SONGS.forEach((song) => {
        const slides: Show["slides"] = {}

        song.sections.forEach((section) => {
            slides[section.id] = {
                group: section.group,
                color: null,
                globalGroup: undefined,
                settings: {},
                notes: "",
                items: [
                    {
                        style: DEFAULT_ITEM_STYLE,
                        align: "",
                        lines: section.lines.map((line) => ({ align: "", text: [{ value: line, style: "font-size: 100px;" }] }))
                    }
                ]
            }
        })

        setShow(song.id, {
            name: song.name,
            category: IMPULSO_CATEGORY,
            settings: { activeLayout: "default", template: "default" },
            timestamps: { created, modified: null, used: null },
            quickAccess: {},
            meta: {},
            slides,
            layouts: { default: { name: song.name, notes: "", slides: song.order.map((id) => ({ id })) } },
            media: {}
        } as Show)
    })
}
