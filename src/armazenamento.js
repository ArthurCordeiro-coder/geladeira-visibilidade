export const CHAVE_LISTA = 'geladeira-visibilidade:lista';

function padrao() {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function listaValida(lista) {
  return (
    Array.isArray(lista) &&
    lista.length > 0 &&
    lista.every(
      (p) =>
        p &&
        typeof p.produto === 'string' &&
        ['preco', 'volume', 'quantidade'].every((c) => typeof p[c] === 'number' && Number.isFinite(p[c])),
    )
  );
}

/** Guarda a última lista importada. Nada sai do navegador. Devolve false se não deu. */
export function salvarLista(produtos, armazenamento = padrao()) {
  try {
    const limpa = produtos.map(({ produto, preco, volume, quantidade }) => ({ produto, preco, volume, quantidade }));
    armazenamento.setItem(CHAVE_LISTA, JSON.stringify(limpa));
    return true;
  } catch {
    return false;
  }
}

/** Devolve a lista salva ou null (sem lista, localStorage bloqueado ou conteúdo inválido). */
export function carregarLista(armazenamento = padrao()) {
  try {
    const texto = armazenamento.getItem(CHAVE_LISTA);
    if (!texto) return null;
    const lista = JSON.parse(texto);
    return listaValida(lista) ? lista : null;
  } catch {
    return null;
  }
}
