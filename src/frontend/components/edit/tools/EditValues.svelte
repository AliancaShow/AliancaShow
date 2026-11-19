<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte"
    import { actions, activeEdit, activePage, activeStage, outputs, timers } from "../../../stores"
    import { abertoPorPadrao, blocoAberto, chaveDoBloco } from "../../../utils/aliancaBlocosLogica"
    import { blocos, definirBloco } from "../../../utils/aliancaBlocosEstado"
    import { linhaSoDeNumeros } from "../../../utils/aliancaCampoNumeroLogica"
    import { idDoInput, linhasFiltradas, secoesDoGrupo, type Grupo, type MapaGrupos } from "../../../utils/aliancaEditorLogica"
    import { timelineAtiva } from "../../../utils/aliancaModo"
    import { resumoDaSecao, resumoDoGrupo } from "../../../utils/aliancaResumoSecao"
    import { throttle } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import { mediaExtensions } from "../../../values/extensions"
    import { getSortedTimers } from "../../drawer/timers/timers"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { getFilters, getStyles } from "../../helpers/style"
    import Input from "../../input/Input.svelte"
    import AliancaCampoNumero from "../../main/AliancaCampoNumero.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialFilePicker from "../../inputs/MaterialFilePicker.svelte"
    import MaterialFontDropdown from "../../inputs/MaterialFontDropdown.svelte"
    import MaterialPopupButton from "../../inputs/MaterialPopupButton.svelte"
    import MaterialTextarea from "../../inputs/MaterialTextarea.svelte"
    import { getIsoLanguages } from "../../main/popups/localization/translation"
    import { SlideTimeline } from "../../timeline/SlideTimeline"
    import { parseShadowValue } from "../scripts/edit"
    import { filterItemStyle, mergeWithStyle } from "../scripts/itemClipboard"
    import type { EditBoxSection, EditInput } from "../values/boxes"
    import { captionTranslateLanguages } from "../values/captionLanguages"

    export let sections: { [key: string]: EditBoxSection } = {}
    export let styles: { [key: string]: string } = {}
    export let customValues: { [key: string]: string } = {}
    export let item: any = {}
    export let isStage = false
    export let type: string = ""
    // Preparar (8b): painel agrupado em a vista / Mais / Avancado. Sem `grupos` o painel e o do Culto.
    export let grupos: MapaGrupos | null = null
    // secoes que ficam sempre abertas (sem seta) mesmo sem mapa: tipos sem agrupamento fino
    export let fixas: string[] = []
    // cabine 4: de que tipo e a caixa (text, media, item...): a chave do bloco aberto/recolhido que o operador deixou, guardada entre aberturas do app
    export let escopo = ""

    function getValue(input: EditInput, _updater: any = null) {
        if (!item) return ""

        if (input.type === "toggle") return styles[input.key || ""] || ""
        if (input.type === "radio") return customValues[input.key || ""] || ""
        if (input.id.includes("CSS")) return getStyleString(input)

        const defaultValue = input.value
        let value: any = null
        if (input.id === "filter" || input.id === "backdrop-filter") {
            value = getFilters(item[input.id] || getStyles(item.style)[input.id])?.[input.key || ""] || input.values.value || input.value
        } else if (input.key) {
            value = styles[input.key || ""]
            if (input.type === "checkbox" && (input.key === "box-shadow" || input.key === "text-shadow")) {
                value = value?.includes("inset") || false
            } else if (input.valueIndex !== undefined) {
                if (input.key === "box-shadow" || input.key === "text-shadow") {
                    const arr = parseShadowValue(value)
                    value = arr[input.valueIndex]
                } else {
                    value = value?.split(" ")[input.valueIndex]
                }
            }
            if (input.extension && value !== "" && typeof value !== "boolean") value = Number(value?.toString().replace(input.extension, ""))
        } else {
            const parts = input.id.split(".")
            if (parts.length > 1) value = item[parts[0]]?.[parts[1]]
            else value = item[input.id]
        }
        if (value === undefined) value = input.values.value

        if (input.type === "number") {
            if (value === "") value = undefined
            else value = Number(value)
            if (isNaN(value)) value = undefined
        }
        if (value === undefined) value = defaultValue

        if (input.multiplier) value *= input.multiplier

        // pre 1.5.0 dropdowns
        if (input.type === "fontDropdown" && typeof value === "string") value = value.replaceAll("'", "")

        return value
    }

    function getStyleString(input: EditInput) {
        let style = ""
        const isItem = input.id === "CSS_item"
        const currentStyle = isItem ? item?.style : input.values?.value
        style = (item.type || "text") === "text" && !isStage ? currentStyle : filterItemStyle(currentStyle, isItem)
        if (!style) return ""

        // sort alphabetically
        let split = style.split(";").filter((a) => a)
        let sorted = split.sort((a, b) => a.localeCompare(b))
        style = sorted.join(";") + ";"

        style = style.replaceAll(";", ";\n").replaceAll(": ", ":").replaceAll(":", ": ").trim()
        return style
    }

    // CHANGE

    function toggle(input: any) {
        let value = styles[input.key || ""] || ""

        let exists: number = value.indexOf(input.value)
        if (exists > -1) value = value.slice(0, exists) + value.substring(exists + input.value.length)
        else value = value + " " + input.value
        value = value.trim()

        // changed({ detail: value }, input)
        input.values.value = value
        dispatch("change", clone(input))
    }

    function radio(input: any) {
        let value = input.value
        input.values.value = value
        dispatch("change", clone(input))
    }

    const dispatch = createEventDispatcher()
    let lastChanged = { value: "", key: "" }
    function changed(e: any, input: any, sectionId = "", onlyTimeline = false) {
        let value = e.detail

        if (input.multiplier) {
            if (!value || isNaN(Number(value))) value = input.value || 0
            value = value / input.multiplier
        }

        // update on change (if another keyframe of same key exists)
        if ($timelineAtiva && $activePage === "edit" && ($activeEdit.type || "show") === "show" && (onlyTimeline || SlideTimeline.hasActionWithKey(input.key || "", type))) {
            let timelineValue = value

            if (!onlyTimeline && lastChanged.key === input.key && lastChanged.value === value) return
            lastChanged = { key: input.key, value }

            if (input.key === "width" || input.key === "left") timelineValue = 1920 * (timelineValue / 100)
            if (input.key === "height" || input.key === "top") timelineValue = 1080 * (timelineValue / 100)

            const indexes = $activeEdit?.items?.length ? $activeEdit.items : [0]
            SlideTimeline.addKeyframe({ name: input.values?.label, key: input.key, value: timelineValue, type, indexes }, onlyTimeline)
            if (onlyTimeline) return
        }

        if (input.extension) value += input.extension

        if (input.valueIndex !== undefined) {
            if (sections[sectionId]) {
                const allKeyValues = sections[sectionId]?.inputs.flat().filter((a) => a.key === input.key)
                const sortedKeys = allKeyValues.sort((a, b) => a.valueIndex! - b.valueIndex!)

                let currentValue = styles[input.key || ""] || ""
                const isInset = (input.key === "box-shadow" || input.key === "text-shadow") && currentValue.includes("inset")
                let arr
                if (input.key === "box-shadow" || input.key === "text-shadow") arr = parseShadowValue(currentValue)
                else arr = currentValue.split(" ").filter(Boolean)
                arr[input.valueIndex] = value

                // add any extensions
                for (let i = 0; i < sortedKeys.length; i++) {
                    if (sortedKeys[i].extension && arr[i] !== undefined && arr[i] !== "") {
                        if (!arr[i].toString().endsWith(sortedKeys[i].extension)) {
                            arr[i] = arr[i].toString().replace(/[^0-9.\-]+$/, "") + sortedKeys[i].extension
                        }
                    }
                }

                value = arr.join(" ")
                if (isInset) value = "inset " + value
            } else {
                // reset
                value = ""
            }
        } else if (input.type === "checkbox" && (input.key === "box-shadow" || input.key === "text-shadow")) {
            let currentValue = styles[input.key || ""] || ""
            const isInset = value
            currentValue = currentValue.replace(/\binset\b/gi, "").trim()
            if (isInset) value = "inset " + currentValue
            else value = currentValue
        }

        /// CUSTOM

        // reset text shadow if unchanged & setting text color to gradient
        // there is also a different check to remove it if gradient & shadow does not exist (but only in the output)
        if (input.key === "color" && item.lines && sections["shadow"] && !hasChangedValues("shadow") && value.includes("gradient")) {
            poeValoresBase("shadow")
        }

        if (input.id.includes("CSS")) {
            value = value.replaceAll("\n", "")
            value = (item.type || "text") === "text" && !isStage ? value : mergeWithStyle(value, item.style, input.id === "CSS_item")
        }

        ///

        const dispatchedInput = clone(input)
        if (!dispatchedInput.values) dispatchedInput.values = {}
        dispatchedInput.values.value = value

        const inputKey = `${input.id}${input.key || ""}${input.valueIndex || ""}`
        throttle(inputKey, dispatchedInput, (val) => dispatch("change", val), 20)

        if (input.values) input.values.value = e.detail
    }

    // `ids`: so os inputs desta parte (secao partida); `abrir`: false nao empurra a secao para a lista de abertas
    function hasChangedValues(id, _updater: any = null, ids: string[] | null = null, _abrir = true) {
        if (!sections[id]) return

        let allInputsToCheck: EditInput[] = []
        let filterOut: string[] = []

        sections[id].inputs.flat().forEach((input) => {
            if (filterOut.includes(input.key || "")) return
            if (input.type === "radio") filterOut.push(input.key || "")
            allInputsToCheck.push(input)
        })

        const hasChanged = !!allInputsToCheck.find((a, i) => (!ids || ids.includes(idDoInput(a))) && !isDefaultValue(a, sections[id].defaultValues?.[i]))
        return hasChanged
    }

    function isDefaultValue(input: EditInput, defaultValue: any) {
        if (!defaultValue) defaultValue = input.value
        const currentValue = getValue(input)

        if (input.type === "toggle") {
            return !currentValue?.includes(defaultValue)
        }

        if (input.multiplier) defaultValue *= input.multiplier

        return currentValue === defaultValue
    }

    function resetSection(entrada: Entrada) {
        const id = entrada.id
        sections[id].inputs.forEach((inputRow, rowIndex) => {
            inputRow.forEach((input) => {
                const customDefaultValue = sections[id].defaultValues?.[rowIndex]
                if (isDefaultValue(input, customDefaultValue)) return

                let defaultValue = customDefaultValue ?? input.value

                if (input.type === "toggle") defaultValue = ""
                if (input.type === "radio" && input.value !== defaultValue) return

                if (input.multiplier) defaultValue *= input.multiplier

                // without timeout only last change will take effect as item don't get to update first
                setTimeout(() => changed({ detail: defaultValue }, input))
            })
        })

        if (sections[id].expandAutoValue) setTimeout(() => definirBloco(chaveDoBloco(escopo || type, entrada.chave), false))
    }

    // cabine 4: cada bloco abre e recolhe e a escolha do operador fica guardada (aliancaBlocosEstado). A vista nasce aberta, o raro recolhido.
    // Bloco que LIGA um recurso ao abrir (contorno, sombra, lista, acordes, rolagem) so conta como aberto enquanto o recurso esta ligado neste item:
    // senao a escolha guardada de um item abriria o campo cru em outro, sem o valor-base que o abrir poe.
    function blocoEstaAberto(entrada: Entrada, mudou: boolean, _estado: any = null): boolean {
        const semCabecalho = entrada.id === "default" && !entrada.rotulo
        if (semCabecalho || entrada.fixa || entrada.section.alwaysOpen) return true
        const padrao = grupos ? abertoPorPadrao(entrada.grupo || null) : mudou
        const aberto = blocoAberto($blocos, chaveDoBloco(escopo || type, entrada.chave), padrao)
        return aberto && !(entrada.section.expandAutoValue && !mudou)
    }
    // o valor-base que liga o recurso do bloco (contorno com 10 px, sombra transparente, lista ligada...)
    function poeValoresBase(id: string) {
        Object.entries(sections[id]?.expandAutoValue || {}).forEach(([key, value]) => {
            const input = clone(sections[id].inputs.flat().find((a) => a.id === key || a.key === key))
            if (!input) return

            if (input.valueIndex !== undefined) {
                delete input.valueIndex
                delete input.extension
            }

            changed({ detail: value }, input, id)
        })
    }
    // abrir um bloco que LIGA um recurso poe o valor-base; recolher so esconde
    function alternarBloco(entrada: Entrada, aberto: boolean, mudou: boolean) {
        if (!aberto && !mudou) poeValoresBase(entrada.id)
        definirBloco(chaveDoBloco(escopo || type, entrada.chave), !aberto)
    }

    // lista unica que o {#each} desenha: sem `grupos` sao as secoes de hoje; com `grupos`, a vista + cabecalhos Mais/Avancado
    type Entrada = { chave: string; id: string; section: EditBoxSection; linhas: EditInput[][]; ids: string[] | null; fixa: boolean; rotulo?: string; semReset: boolean; cabecalho?: Grupo; grupo?: Grupo }

    // Mais e Avancado: o cabecalho tambem guarda a escolha (nasce recolhido)
    $: gruposAbertos = { mais: blocoAberto($blocos, chaveDoBloco(escopo || type, "grupo:mais"), false), avancado: blocoAberto($blocos, chaveDoBloco(escopo || type, "grupo:avancado"), false) }
    function alternarGrupo(g: string) {
        definirBloco(chaveDoBloco(escopo || type, "grupo:" + g), !gruposAbertos[g])
    }

    function montarEntradas(secoes: { [key: string]: EditBoxSection }, mapa: MapaGrupos | null, travadas: string[], _abertos: any): Entrada[] {
        if (!mapa) return Object.entries(secoes || {}).map(([id, section]) => ({ chave: id, id, section, linhas: section.inputs, ids: null, fixa: travadas.includes(id), semReset: false, grupo: undefined }))

        const lista: Entrada[] = []
        const doGrupo = (g: Grupo) => secoesDoGrupo(mapa, g, secoes).map((s) => ({ chave: g + ":" + s.id, id: s.id, section: secoes[s.id], linhas: linhasFiltradas(secoes[s.id].inputs, s.ids), ids: s.ids, fixa: false, rotulo: s.rotulo, grupo: g, semReset: !!s.ids || (s.id === "default" && !!s.rotulo && g !== "vista") }))
        lista.push(...doGrupo("vista"))
        for (const g of ["mais", "avancado"] as Grupo[]) {
            const secoesDoG = doGrupo(g)
            if (!secoesDoG.length) continue
            lista.push({ chave: "cab:" + g, id: g, section: { inputs: [] }, linhas: [], ids: null, fixa: false, semReset: true, cabecalho: g })
            if (gruposAbertos[g]) lista.push(...secoesDoG)
        }
        return lista
    }
    $: entradas = montarEntradas(sections, grupos, fixas, gruposAbertos)

    // "•" no cabecalho do grupo fechado quando algo dentro dele foi mudado (nao abre o grupo)
    function grupoAlterado(g: Grupo, _updater: any = null) {
        if (!grupos) return false
        return secoesDoGrupo(grupos, g, sections).some((s) => !sections[s.id].noReset && !!hasChangedValues(s.id, null, s.ids, false))
    }
    $: marcas = grupos ? { mais: grupoAlterado("mais", { styles, item, customValues }), avancado: grupoAlterado("avancado", { styles, item, customValues }) } : { mais: false, avancado: false }

    // C4: resumo do que ha dentro da secao RECOLHIDA (valores de agora) e do grupo fechado (quais secoes mexeram)
    function resumoDe(entrada: Entrada, _updater: any = null): string {
        const valores = entrada.linhas.flat().filter((i) => !i.hidden && i.type !== "tip" && i.type !== "toggle" && i.type !== "radio").map((i) => getValue(i))
        const mudou = entrada.section.noReset || entrada.semReset ? false : !!hasChangedValues(entrada.id, null, entrada.ids, false)
        return resumoDaSecao({ id: entrada.id, mudou, valores })
    }
    function resumoDeGrupo(g: Grupo, _updater: any = null): string {
        if (!grupos) return ""
        const nomes = secoesDoGrupo(grupos, g, sections)
            .filter((s) => !sections[s.id].noReset && !!hasChangedValues(s.id, null, s.ids, false))
            .map((s) => grupos?.rotulos[g + ":" + s.id] || translateText(sections[s.id].name || "edit." + s.id))
        return resumoDoGrupo(nomes)
    }

    ///

    function getOptions(options: string | any[]): any[] {
        if (typeof options === "string") {
            if (options === "timers") {
                return getSortedTimers($timers, { showHours: item?.timer?.showHours !== false, firstActive: isStage }).map((a) => ({ value: a.id, label: a.name, data: a.extraInfo }))
            } else if (options === "actions") {
                return sortByName(keysToID($actions)).map((a) => ({ value: a.id, label: a.name || "" }))
            } else if (options === "outputWindows") {
                return sortByName(keysToID($outputs).filter((a) => a.stageOutput !== $activeStage.id)).map((a) => ({ value: a.id, label: a.name || "" }))
            } else if (options === "captionTranslateLanguages") {
                return item?.captions?.googlekey ? [{ value: "", label: "—" }, ...getIsoLanguages()] : captionTranslateLanguages.map((a) => ({ value: a.id, label: a.name }))
            }
            return []
        }
        return options
    }

    // o padrao do campo (o pontinho "mudou do padrao" do rotulo), na mesma escala do valor mostrado
    function padraoDe(input: EditInput): number | null {
        const d = Number(input.value)
        if (Number.isNaN(d)) return null
        return input.multiplier ? d * input.multiplier : d
    }

    function getValues(input: any) {
        const values = clone(input.values)
        if (input.type === "dropdown") {
            if (values.options === "timers") values.addNew = "new.timer"
            values.options = getOptions(values.options)
        }
        return values
    }

    // TIMELINE Updater
    let timelineUpdater = 0
    let updaterInterval: any = null
    $: if (sections?.timeline && !updaterInterval) {
        updaterInterval = setInterval(() => timelineUpdater++, 100)
    }
    onDestroy(() => {
        if (updaterInterval) clearInterval(updaterInterval)
    })
</script>

<div class="tools">
    {#each entradas as entrada (entrada.chave)}
        {#if entrada.cabecalho}
            <div class="section grupo">
                <button type="button" class="luz-sec dob" data-acao="editar-grupo" data-grupo={entrada.cabecalho} aria-expanded={!!gruposAbertos[entrada.cabecalho]} tabindex="-1" on:click={() => alternarGrupo(entrada.cabecalho || "")}>
                    <Icon id="arrow_back_modern" class="arrow {gruposAbertos[entrada.cabecalho] ? 'open' : ''}" size={0.6} style="opacity: 0.6;" white />
                    {entrada.cabecalho === "mais" ? "Mais" : "Avançado"}
                    {#if marcas[entrada.cabecalho] && !gruposAbertos[entrada.cabecalho]}<span class="marca" title="Tem valor alterado aqui dentro">•</span>{/if}
                    {#if !gruposAbertos[entrada.cabecalho]}<small>{resumoDeGrupo(entrada.cabecalho, { styles, item, customValues })}</small>{/if}
                </button>
            </div>
        {:else}
            {@const id = entrada.id}
            {@const section = entrada.section}
            {@const hasChanged = section.noReset || entrada.semReset ? false : !!hasChangedValues(id, { styles, item }, entrada.ids)}
            {@const comCabecalho = id !== "default" || !!entrada.rotulo}
            {@const expanded = blocoEstaAberto(entrada, hasChanged, $blocos)}
            {@const travado = !!(section.alwaysOpen || entrada.fixa)}

            <div class="section luz-bloco" data-acao="bloco" data-bloco={entrada.chave}>
                {#if comCabecalho}
                    <div class="title">
                        <div class="luz-sec{travado ? '' : ' dob'}" role="button" tabindex="-1" data-acao="bloco-cabecalho" aria-expanded={expanded} on:click={() => !travado && alternarBloco(entrada, expanded, hasChanged)} on:keydown={(e) => !travado && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), alternarBloco(entrada, expanded, hasChanged))}>
                            {#if !travado}
                                <Icon id="arrow_back_modern" class="arrow {expanded ? 'open' : ''}" size={0.6} style="opacity: 0.6;" white />
                            {/if}
                            {#if id === "CSS"}CSS{:else}{entrada.rotulo || translateText(section.name || "edit." + id)}{/if}
                            {#if hasChanged && !expanded}<span class="marca" title="Tem valor alterado aqui dentro">•</span>{/if}
                            {#if !expanded}<small data-acao="secao-resumo">{resumoDe(entrada, { styles, item, customValues })}</small>{/if}

                            {#if hasChanged}
                                <button type="button" class="redefinir" title="Voltar ao padrão" aria-label="Voltar ao padrão" tabindex="-1" on:click|stopPropagation={() => resetSection(entrada)}>
                                    <Icon id="reset" size={0.8} white />
                                </button>
                            {/if}
                        </div>
                    </div>
                {/if}

                {#if expanded}
                    <div class="luz-corpo">
                        {#each entrada.linhas as inputRow}
                            {@const visiveis = inputRow.filter((i) => !i.hidden)}
                            {@const soNumeros = linhaSoDeNumeros(visiveis.map((i) => i.type))}
                            <div class="luz-lin" class:so-numeros={soNumeros}>
                                {#each inputRow as input}
                                    {#if !input.hidden}
                                        {@const value = getValue(input, { styles, item, customValues })}
                                        {@const values = getValues(input)}
                                        {@const hasTimelineAction = $timelineAtiva && $activePage === "edit" && ($activeEdit.type || "show") === "show" && SlideTimeline.hasActionAtTime(input.key || "", type, $activeEdit?.items?.length ? $activeEdit.items : [0], timelineUpdater)}

                                        {#if input.type === "fontDropdown"}
                                            <MaterialFontDropdown label={values.label} {value} style={values.style} fontStyleValue={input.styleValue} on:change={(e) => changed(e, input)} on:fontStyle={(e) => changed(e, { ...input, key: "font" })} enableFontStyles />
                                        {:else if input.type === "toggle"}
                                            <MaterialButton style="min-width: 50px;flex: 1;" title={values.label} on:click={() => toggle(input)}>
                                                <Icon id={values.icon} size={1.2} white />
                                                <div class="highlight" class:active={value.includes(input.value)}></div>
                                            </MaterialButton>
                                        {:else if input.type === "radio"}
                                            <MaterialButton style="min-width: 50px;flex: 1;" title={values.label} on:click={() => radio(input)}>
                                                <Icon id={values.icon} size={1.2} white />
                                                <div class="highlight radio" class:active={value === input.value}></div>
                                            </MaterialButton>
                                        {:else if input.type === "textarea"}
                                            <MaterialTextarea label={values.label} {value} on:change={(e) => changed(e, input, id)} />
                                        {:else if input.type === "media"}
                                            <MaterialFilePicker label={(value ? values.label : "") || "edit.choose_media"} {value} filter={{ name: "Media files", extensions: mediaExtensions }} on:change={(e) => changed(e, input, id)} autoTrigger={$activeEdit.type !== "template"} allowEmpty />
                                        {:else if input.type === "popup"}
                                            <MaterialPopupButton {...values} {value} on:change={(e) => changed(e, input, id)} allowEmpty={values.allowEmpty !== false} />
                                        {:else if input.type === "tip"}
                                            <p class="tip">
                                                {#if values.label}{translateText(values.label)}{/if}
                                                {@html input.values?.subtext || ""}
                                                {#if input.values?.subtext.includes("<a href=")}<Icon id="launch" white />{/if}
                                            </p>
                                        {:else if input.type === "number"}
                                            <AliancaCampoNumero {...values} {value} unit={input.multiplier ? "" : input.extension || ""} defaultValue={section.noReset ? null : (values.defaultValue ?? padraoDe(input))} showSlider={soNumeros || visiveis.length === 1 ? values.showSlider : false} enableKeyframe={$timelineAtiva && $activePage === "edit" && ($activeEdit.type || "show") === "show"} {hasTimelineAction} on:change={(e) => changed(e, input, id)} on:keyframe={(e) => changed(e, input, id, true)} />
                                        {:else}
                                            <Input input={{ type: input.type, ...values, value }} {hasTimelineAction} on:change={(e) => changed(e, input, id)} on:keyframe={(e) => changed(e, input, id, true)} />
                                        {/if}
                                    {/if}
                                {/each}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
    {/each}
</div>

<style>
    .tools {
        padding: 0 12px;

        display: flex;
        flex-direction: column;
        /* gap: 5px; */
        gap: 2px;
    }

    /* C4: titulo de secao = rotulo em caixa alta + fio (o visual e o .luz-sec de global.css); aqui so a seta que gira */
    .title :global(svg.arrow),
    .section :global(svg.arrow) {
        transition: 0.1s transform ease;
        transform: rotate(180deg);
    }
    .title :global(svg.arrow.open),
    .section :global(svg.arrow.open) {
        transform: rotate(-90deg);
    }
    .title :global(button:disabled) {
        opacity: 1;
    }

    .redefinir {
        margin-left: auto;
        order: 4;
        display: flex;
        padding: 4px;
        border: 0;
        background: transparent;
        color: var(--luz-mudo);
        cursor: pointer;
    }
    .marca {
        color: var(--luz-laranja);
        font-size: 1.1rem;
        line-height: 1;
    }

    .section {
        border: 0;
    }

    /* toggle */

    .highlight {
        position: absolute;
        bottom: 5px;
        left: 50%;
        transform: translateX(-50%);

        height: 2px;
        width: 80%;

        background-color: var(--primary-lighter);
        transition: 0.2s background-color ease;
    }
    .highlight.radio {
        width: 100%;
        bottom: 0;
    }
    .highlight.active {
        background-color: var(--secondary);

        box-shadow: 0 0 3px rgb(255 255 255 / 0.2);
    }

    /* tip */

    .tip {
        font-size: 0.8em;
        opacity: 0.8;
        padding: 8px;

        text-align: center;
        text-overflow: revert;
        white-space: normal;

        display: flex;
        justify-content: center;
        align-items: center;
        gap: 5px;
        width: 100%;
    }

    /* Link */
    .tip :global(a) {
        color: var(--text);
        opacity: 0.7;
    }
    .tip :global(a):hover {
        opacity: 0.75;
    }
    .tip :global(a):active {
        opacity: 0.9;
    }
</style>
