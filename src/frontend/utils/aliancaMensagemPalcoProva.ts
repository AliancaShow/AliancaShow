// Parafuso SO da prova (sem imports: nao puxa o Sirvo para quem so envia).
// `transporteDaProva`: outro parafuso SO da prova. O envio real vai ao Sirvo (sem chave no perfil de prova); a fumaca troca o transporte por um que
// responde "ok" e devolve a mensagem viva depois (como o roteiro faria), para provar o que a caixa e o palco fazem com um envio que DEU CERTO.
type Resposta = { ok: boolean; dados?: any; codigo?: string; mensagem?: string }
type Transporte = (funcao: string, args: { [key: string]: any }) => Promise<Resposta>
let transporte: Transporte | null = null
export const transporteDaProva = (fn: Transporte | null) => (transporte = fn)
export const transporteAtual = () => transporte
