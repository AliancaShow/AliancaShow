// A2: a mensagem pro palco viva (a mesma que a caixa mostra, lida do roteiro do Sirvo) escreve no item de mensagem do layout de palco do
// FreeShow: uma variavel de texto (aliancaMensagemPalcoLogica.chavesDaMensagem). Sai (variavel vazia) quando a mensagem expira ou e limpa.
// Sobe UMA vez com a janela principal (AliancaTopo). O laco do Sirvo ja escreve `sirvo_mensagem` a cada segundo; este espelho garante o mesmo
// para a variavel que a igreja usa no layout (ex.: "Mensagem palco") e nao depende de o laco estar de pe quando o texto e lido.
import { get } from "svelte/store"
import { variables } from "../stores"
import { chavesDaMensagem, mensagemViva, textoDaVariavel } from "./aliancaMensagemPalcoLogica"
import { mensagemDaCaixa } from "./aliancaMensagemPalcoVista"
import { sirvoAgora } from "./aliancaSirvo"

/** escreve `texto` em toda variavel da mensagem; so toca a loja se algo mudou; sem variavel nenhuma, cria `sirvo_mensagem` (so quando ha texto) */
export function escreverMensagemNoPalco(texto: string): void {
    const atuais = get(variables) as { [chave: string]: any }
    const chaves = chavesDaMensagem(atuais)
    if (!chaves.length) {
        if (!texto) return
        variables.update((a: any) => ({ ...a, sirvo_mensagem: { name: "sirvo_mensagem", type: "text", text: texto, enabled: true } }))
        return
    }
    const mudou = chaves.filter((c) => (atuais[c].text || "") !== texto)
    if (!mudou.length) return
    variables.update((a: any) => {
        for (const c of mudou) a[c] = { ...a[c], text: texto }
        return a
    })
}

export function iniciarEspelhoDaMensagem(): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null
    const aplicar = (msg: Parameters<typeof mensagemViva>[0]) => {
        if (timer) clearTimeout(timer)
        timer = null
        const viva = mensagemViva(msg, sirvoAgora())
        escreverMensagemNoPalco(viva ? textoDaVariavel(viva.texto) : "")
        // a mensagem sai do palco no segundo em que o `ate` passa
        if (viva) timer = setTimeout(() => aplicar(msg), Math.max(250, viva.ateMs - sirvoAgora() + 50))
    }
    const sair = mensagemDaCaixa.subscribe(aplicar)
    return () => {
        sair()
        if (timer) clearTimeout(timer)
    }
}
