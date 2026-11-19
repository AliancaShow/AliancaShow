// Leiaute v2, fatia 6: os layouts novos do botao direito da biblioteca e do roteiro, e a lista do que SAIU do menu antigo (com o destino). So dados:
// sem stores nem componentes, para o teste ler sem carregar o app. O registro (e a falha alta de quem ficou sem destino) e `aliancaMenusBiblioteca.ts`.
import { semDestino } from "../../utils/aliancaMenusBibliotecaLogica"

export type Layout = { [id: string]: string[] }
/** layouts que o FreeShow nao tinha (a linha de show usava o menu `default`, com a busca rapida): nascem aqui */
export const CRIADOS = ["show_drawer", "project_effect", "stream_card"]
export const SO_O_LUGAR = "SEM SUBSTITUTO da previa: o clique simples so seleciona e nao abre no centro (decisao do Andre: restaurar `preview` ou aceitar)"
const SEM_MARCA = "a lista nova nao mostra essa marca"

/** layout -> o menu novo */
export const NOVOS: Layout = {
    // biblioteca
    show_drawer: ["alianca_editar", "alianca_roteiro", "alianca_agora"],
    media_card: ["edit", "alianca_roteiro", "SEPARATOR", "play_no_audio", "play_no_filters", "createSlideshow", "SEPARATOR", "favourite", "SEPARATOR", "alianca_mover", "alianca_fim", "alianca_camada", "SEPARATOR", "media_tag_set", "media_tag_filter", "sort_media_by", "SEPARATOR", "system_open", "SEPARATOR", "alianca_tirar_bib", "alianca_apagar_pc"],
    audio_button: ["edit", "alianca_roteiro", "alianca_agora", "SEPARATOR", "effects_library_add", "favourite", "SEPARATOR", "alianca_mover", "SEPARATOR", "system_open"],
    audio_button_playlist: ["edit", "alianca_agora", "SEPARATOR", "remove"],
    overlay_card: ["edit", "alianca_roteiro", "alianca_agora", "SEPARATOR", "overlay_actions", "display_duration", "SEPARATOR", "lock_to_output", "place_under_slide", "SEPARATOR", "rename", "recolor", "duplicate", "delete"],
    overlay_card_default: ["edit", "alianca_roteiro", "alianca_agora", "SEPARATOR", "duplicate", "delete"],
    overlay_card_readonly: ["alianca_agora"],
    effect_card: ["edit", "alianca_agora", "SEPARATOR", "display_duration", "SEPARATOR", "place_under_slide", "SEPARATOR", "rename", "recolor", "duplicate", "delete"],
    effect_card_default: ["edit", "alianca_agora", "SEPARATOR", "duplicate", "delete"],
    scripture_verse: ["alianca_agora", "SEPARATOR", "create_show", "SEPARATOR", "selectAll", "SEPARATOR", "route_bible"],
    action: ["alianca_agora", "SEPARATOR", "GROUP_edit", "disable", "action_tag_set", "action_tag_filter", "SEPARATOR", "export", "SEPARATOR", "duplicate", "delete"],
    action_readonly: ["alianca_agora", "SEPARATOR", "action_tag_filter"],
    camera_card: ["alianca_agora", "SEPARATOR", "GROUP_edit", "startup_activate", "SEPARATOR", "recording"],
    screen_card: ["alianca_agora", "SEPARATOR", "recording"],
    // NDI e BlackMagic: entradas de video que vao ao fundo da saida; o FreeShow nao tinha menu para elas (revisao da fatia 6, achado 4)
    stream_card: ["alianca_agora"],
    // video online (YouTube/Vimeo), efeito sonoro e stream de audio: o menu antigo ganha o "Mostrar agora" no topo (o clique so seleciona)
    player_button: ["alianca_agora", "SEPARATOR", "GROUP_open", "player_tag_set", "player_tag_filter", "SEPARATOR", "rename", "delete"],
    audio_effect_button: ["alianca_agora", "SEPARATOR", "GROUP_rename_only", "remove", "SEPARATOR", "system_open"],
    audio_stream: ["alianca_agora", "SEPARATOR", "GROUP_edit", "delete"],
    // cabine-5: os 3 tipos da pasta de midia saem do submenu "Tipo" para a raiz (o menu e curto)
    category_media_button: ["GROUP_rename_only", "delete_remove", "SEPARATOR", "type_default", "type_background", "type_foreground", "SEPARATOR", "system_open"],
    // cabine-5: a arvore da Biblia nao tem mais Colecoes (decisao do Andre, 19/nov)
    category_scripture: ["newScripture"],
    // roteiro: itens
    project_show: ["alianca_editar", "alianca_agora_item", "SEPARATOR", "alianca_subir", "alianca_descer", "SEPARATOR", "alianca_tirar"],
    project_show_placeholder: ["alianca_subir", "alianca_descer", "SEPARATOR", "alianca_tirar"],
    project_show_placeholder_template: ["alianca_subir", "alianca_descer", "SEPARATOR", "alianca_tirar"],
    project_media: ["alianca_agora_item", "play_no_audio", "play_no_filters", "SEPARATOR", "alianca_subir", "alianca_descer", "SEPARATOR", "alianca_tirar"],
    project_audio: ["alianca_agora_item", "SEPARATOR", "alianca_subir", "alianca_descer", "SEPARATOR", "alianca_tirar"],
    project_player: ["alianca_subir", "alianca_descer", "SEPARATOR", "alianca_tirar"],
    project_overlay: ["alianca_subir", "alianca_descer", "SEPARATOR", "alianca_tirar"],
    project_pdf: ["alianca_subir", "alianca_descer", "SEPARATOR", "alianca_tirar"],
    project_ppt: ["alianca_subir", "alianca_descer", "SEPARATOR", "alianca_tirar"],
    project_screen: ["alianca_subir", "alianca_descer", "SEPARATOR", "alianca_tirar"],
    project_camera: ["alianca_subir", "alianca_descer", "SEPARATOR", "alianca_tirar"],
    project_ndi: ["alianca_subir", "alianca_descer", "SEPARATOR", "alianca_tirar"],
    project_folder: ["alianca_subir", "alianca_descer", "SEPARATOR", "alianca_tirar"],
    project_effect: ["alianca_subir", "alianca_descer", "SEPARATOR", "alianca_tirar"],
    // roteiro: blocos
    project_section: ["alianca_titulo", "alianca_subir", "alianca_descer", "SEPARATOR", "alianca_novo_bloco", "SEPARATOR", "alianca_tirar"]
}

/** layout -> item do menu ANTIGO que nao esta no novo -> para onde foi. Texto vai para a descricao do PR e para o teste */
export const REMOVIDOS: { [layout: string]: { [item: string]: string } } = {
    show_drawer: {},
    media_card: { GROUP_open: "Editar ficou (item `edit`); SEM SUBSTITUTO da previa: o clique simples na midia agora manda ao ar (cabine 18/nov, B1), nao abre no centro" },
    audio_button: { GROUP_open: "Editar ficou (item `edit`); SEM SUBSTITUTO da previa: o clique simples so seleciona e nao abre no centro (decisao do Andre: restaurar `preview` ou aceitar)" },
    audio_button_playlist: { GROUP_open: "Editar ficou (item `edit`); SEM SUBSTITUTO da previa: o clique simples so seleciona e nao abre no centro (decisao do Andre: restaurar `preview` ou aceitar)" },
    overlay_card: { GROUP_open: "Editar ficou (item `edit`); SEM SUBSTITUTO da previa: o clique simples so seleciona e nao abre no centro (decisao do Andre: restaurar `preview` ou aceitar)" },
    overlay_card_default: { GROUP_open: "Editar ficou (item `edit`); SEM SUBSTITUTO da previa: o clique simples so seleciona e nao abre no centro (decisao do Andre: restaurar `preview` ou aceitar)" },
    overlay_card_readonly: { preview: SO_O_LUGAR },
    effect_card: { GROUP_open: "Editar ficou (item `edit`); SEM SUBSTITUTO da previa: o clique simples so seleciona e nao abre no centro (decisao do Andre: restaurar `preview` ou aceitar)" },
    effect_card_default: { GROUP_open: "Editar ficou (item `edit`); SEM SUBSTITUTO da previa: o clique simples so seleciona e nao abre no centro (decisao do Andre: restaurar `preview` ou aceitar)" },
    scripture_verse: {},
    action: {},
    action_readonly: {},
    camera_card: {},
    screen_card: {},
    stream_card: {},
    player_button: {},
    audio_effect_button: {},
    audio_stream: {},
    category_media_button: { media_type: "os tres tipos (Padrao, Plano de fundo, Primeiro plano) foram para a raiz do menu" },
    category_scripture: { createCollection: "a Biblia nao tem mais Colecoes na arvore (decisao do Andre, 19/nov); as que existem ficam guardadas" },
    project_show: { GROUP_rename_only: "o nome do show se edita no editor (Editar); a lista nova nao renomeia no lugar", remove: "Tirar do roteiro", mark_played: SEM_MARCA, private: "show privado nao tem marca na lista nova" },
    project_show_placeholder: { remove: "Tirar do roteiro" },
    project_show_placeholder_template: { GROUP_rename_only: "a lista nova nao renomeia no lugar", remove: "Tirar do roteiro" },
    project_media: { play: "Mostrar agora", remove: "Tirar do roteiro", mark_played: SEM_MARCA },
    project_audio: { remove: "Tirar do roteiro", mark_played: SEM_MARCA },
    project_player: { remove: "Tirar do roteiro" },
    project_overlay: { remove: "Tirar do roteiro" },
    project_pdf: { remove: "Tirar do roteiro", mark_played: SEM_MARCA },
    project_ppt: { remove: "Tirar do roteiro", mark_played: SEM_MARCA },
    project_screen: { remove: "Tirar do roteiro" },
    project_camera: { remove: "Tirar do roteiro" },
    project_ndi: { remove: "Tirar do roteiro" },
    project_folder: { remove: "Tirar do roteiro" },
    project_section: { GROUP_recolor: "a lista nova nao mostra a cor do bloco", remove: "Tirar do roteiro" }
}

/** a conta do registro: o que ficou sem destino em cada layout (vazia = tudo tem lugar). Exportada para o teste e para o PR. */
export function semDestinoPorLayout(antigos: Layout): { [layout: string]: string[] } {
    const falhas: { [layout: string]: string[] } = {}
    for (const [layout, novo] of Object.entries(NOVOS)) {
        const velho = antigos[layout]
        if (!velho && CRIADOS.includes(layout)) continue
        if (!velho) {
            falhas[layout] = ["(o layout nao existe mais em contextMenus.ts)"]
            continue
        }
        const sem = semDestino(velho, novo, REMOVIDOS[layout] || {})
        if (sem.length) falhas[layout] = sem
    }
    return falhas
}
