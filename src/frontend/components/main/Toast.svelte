<script lang="ts">
    // Cabine 6 (Andre, 23/nov): o toast flutuante do canto (texto comido, fonte enorme, por cima do No ar) acabou. Este componente continua
    // montado por App.svelte so na janela principal e virou a PONTE: cada mensagem do `newToast` (utils/common.ts, que fica como esta) vai
    // para a linha de avisos do leiaute (AliancaAvisos.svelte, no pe de AliancaTela) com o nivel certo, e sai da fila antiga. Sem markup.
    import { onDestroy } from "svelte"
    import { get } from "svelte/store"
    import { dictionary, toastMessages } from "../../stores"
    import { receberToast } from "../../utils/aliancaAvisos"
    import { translateText } from "../../utils/language"

    const tem = (grupo: string, chave: string) => !!(get(dictionary) as any)?.[grupo]?.[chave]

    const parar = toastMessages.subscribe((lista) => {
        if (!lista?.length) return
        const chegadas = lista.slice()
        toastMessages.set([])
        for (const m of chegadas) receberToast(m, translateText, tem)
    })
    onDestroy(parar)
</script>
