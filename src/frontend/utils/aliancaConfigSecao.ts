// Configuracoes (C4): rotulos da lista lateral e a "secao" dentro de Conexao (Sirvo e Controle remoto sao itens proprios na lista, mas
// moram na aba `connection` do FreeShow; `settingsTab` nao muda de tipo, quem escolhe qual dos tres pedacos aparece e esta loja).
import { writable, type Writable } from "svelte/store"

export type SecaoDeConexao = "" | "sirvo" | "remote"
export const configSecao: Writable<SecaoDeConexao> = writable("")

/** nomes da lista lateral e dos titulos de pagina (o desenho C4 renomeia Saidas e Outro) */
export const ROTULOS_CONFIG: { [aba: string]: string } = {
    general: "Geral",
    display_settings: "Telas e saídas",
    styles: "Estilos",
    audio: "Áudio",
    connection: "Conexão",
    files: "Arquivos",
    profiles: "Perfis",
    other: "Outros",
    sirvo: "Sirvo",
    remote: "Controle remoto"
}
