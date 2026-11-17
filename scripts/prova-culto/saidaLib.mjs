// Preparo da saida nos testes da 1a. A maquina de prova tem UMA tela e a janela principal e maximizada: a saida normal cobriria a
// principal (OutputVisibility recusa e abre o popup choose_screen). Aqui a saida vira uma janelinha travada no canto inferior direito
// (boundsLocked, screen nulo), longe da barra do topo. E preparo por store, feito ANTES do gesto gravado; nada escreve no Sirvo.
export const PREPARAR_SAIDA = `S.activePopup.set(null); S.outputs.update((o)=>{ const d=o.default; d.boundsLocked=true; d.screen=null; d.bounds={x:1560,y:900,width:340,height:150}; return o }); await esp(400); return 1`
