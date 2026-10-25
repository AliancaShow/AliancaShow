/**
 * As agendas, iguais as do Remote (src/lib/agenda.js de la). Aliança e Impulso
 * sao cultos diferentes, com cadencia propria; o Extra nao tem cadencia e cada
 * evento e criado no celular, com dia e nome. A pasta de cada uma e a raiz da
 * arvore, aqui e no Storage.
 *
 * Fica separado do aliancaRemote para o painel de cultos usar sem puxar o
 * Firebase, e para dar para testar sem Electron.
 */
export const AGENDAS = [
    { id: "alianca", nome: "Aliança", pasta: "Alianca", dia: 0, cada: 7, inicio: "" },
    // a cada 15 dias no sabado, contados a partir de 19/09/2026
    { id: "impulso", nome: "Impulso", pasta: "Impulso", dia: 6, cada: 14, inicio: "2026-09-19" },
    { id: "extra", nome: "Extra", pasta: "Extra", dia: -1, cada: 0, inicio: "" }
]
export type Agenda = (typeof AGENDAS)[number]

export const MESES = ["01-janeiro", "02-fevereiro", "03-marco", "04-abril", "05-maio", "06-junho", "07-julho", "08-agosto", "09-setembro", "10-outubro", "11-novembro", "12-dezembro"]

/**
 * "2026-09-06" -> pastas Alianca/2026/09-setembro + projeto "06".
 *
 * No Extra o nome do evento entra no projeto ("07 - Rede de Mulheres"): sem
 * cadencia, so a data nao diz o que e. A pasta no disco continua so o dia, como
 * no Storage.
 */
export function caminhoDoCulto(agenda: Agenda, cultoId: string, nome = "") {
    const data = cultoId.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!data) return null
    const dia = data[3]
    const titulo = String(nome || "").trim()
    return { pastas: [agenda.pasta, data[1], MESES[Number(data[2]) - 1]], dia, projeto: !agenda.cada && titulo ? `${dia} - ${titulo}` : dia }
}

/**
 * Os dias de culto de um mes na cadencia da agenda: Aliança todo domingo,
 * Impulso a cada quinze dias no sabado a partir da ancora -- sem ela nao daria
 * para saber QUAL sabado. Mesma conta do diasDoMes do Remote. Extra, sem
 * cadencia, nao tem dia previsto.
 */
export function diasDoMes(agenda: Agenda, ano: number, mes: number) {
    const dias: string[] = []
    if (!agenda.cada) return dias

    const d = new Date(ano, mes, 1)

    if (agenda.cada === 7) {
        d.setDate(1 + ((7 - d.getDay() + agenda.dia) % 7))
    } else {
        const [a, m, dd] = agenda.inicio.split("-").map(Number)
        const ancora = new Date(a, m - 1, dd)
        // antes da ancora a agenda nao existia
        if (new Date(ano, mes + 1, 0) < ancora) return dias
        d.setTime(ancora.getTime())
        while (d < new Date(ano, mes, 1)) d.setDate(d.getDate() + agenda.cada)
    }

    while (d.getMonth() === mes && d.getFullYear() === ano) {
        dias.push(String(d.getDate()).padStart(2, "0"))
        d.setDate(d.getDate() + agenda.cada)
    }
    return dias
}
