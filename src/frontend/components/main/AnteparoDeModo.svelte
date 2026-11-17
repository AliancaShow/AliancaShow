<script lang="ts">
    // 1a, D2 (Q8): o anteparo de 700 ms. SEM markup e SEM timer: um decisor de gesto (aliancaPilulaLogica) escuta, em captura, os
    // eventos do mouse e do teclado. Depois de um chip levar ao Culto, o gesto que COMECA nos 700 ms seguintes sobre a barra do
    // topo (fora do seletor de modo, a esquerda) e engolido inteiro: o toque duplo que cairia no botao que acabou de aparecer sob o
    // dedo nao faz nada. Na excecao o evento PASSA e a falha fica alta.
    import { onDestroy, onMount } from "svelte"
    import { falhaAlta } from "../../utils/aliancaFalha"
    import { anteparoAte } from "../../utils/aliancaPilula"
    import { criarDecisorDeGesto, TIPOS_DO_ANTEPARO, type TipoDeEvento } from "../../utils/aliancaPilulaLogica"

    const decisor = criarDecisorDeGesto()

    function tratar(e: Event) {
        try {
            const alvo = e.target instanceof Element ? e.target : null
            const topo = alvo?.closest(".top.panel") ?? null
            const esquerda = topo?.firstElementChild ?? null
            const engolir = decisor.aoEvento(e.type as TipoDeEvento, { agora: performance.now(), ate: anteparoAte(), naBarra: !!topo, naEsquerda: !!esquerda && esquerda.contains(alvo) })
            if (engolir) {
                e.preventDefault()
                e.stopImmediatePropagation()
                e.stopPropagation()
            }
        } catch (erro) {
            falhaAlta("anteparo", erro)
        }
    }

    onMount(() => {
        for (const t of TIPOS_DO_ANTEPARO) window.addEventListener(t, tratar, { capture: true })
    })
    onDestroy(() => {
        if (typeof window === "undefined") return
        for (const t of TIPOS_DO_ANTEPARO) window.removeEventListener(t, tratar, { capture: true })
    })
</script>
