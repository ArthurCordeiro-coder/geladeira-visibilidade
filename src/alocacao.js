import { ALFACES_POR_COLUNA } from './layout.js';

/** Colunas que um produto ocupa: ceil(quantidade / 6). */
export function colunasNecessarias(quantidade) {
  return Math.ceil(quantidade / ALFACES_POR_COLUNA);
}

/**
 * Divide `total` colunas na proporção das quantidades (método dos maiores restos),
 * com no mínimo 1 coluna por produto. Empates favorecem quem vem antes (maior prioridade).
 * Pressupõe quantidades.length <= total.
 */
export function distribuirLotado(quantidades, total) {
  const somaQ = quantidades.reduce((s, q) => s + q, 0);
  const cotas = quantidades.map((q) => (q / somaQ) * total);
  const partes = cotas.map((c) => Math.max(1, Math.floor(c)));
  let diferenca = total - partes.reduce((s, p) => s + p, 0);

  while (diferenca > 0) {
    let escolhido = 0;
    for (let i = 1; i < partes.length; i++) {
      if (cotas[i] - partes[i] > cotas[escolhido] - partes[escolhido]) escolhido = i;
    }
    partes[escolhido]++;
    diferenca--;
  }
  // O mínimo de 1 pode estourar o total: tira de quem mais passou da própria cota.
  while (diferenca < 0) {
    let escolhido = -1;
    for (let i = partes.length - 1; i >= 0; i--) {
      if (partes[i] <= 1) continue;
      if (escolhido < 0 || cotas[i] - partes[i] < cotas[escolhido] - partes[escolhido]) escolhido = i;
    }
    partes[escolhido]--;
    diferenca++;
  }
  return partes;
}

/**
 * Decide quantas colunas cada produto (já ordenado por prioridade) recebe.
 * lotar = true: as `total` colunas são repartidas na proporção das quantidades.
 * lotar = false: cada um pede ceil(q/6); a partir do primeiro que não cabe,
 * ele e todos de prioridade menor vão pra lista "Não coube".
 */
export function planejarColunas(ordenados, total, lotar) {
  if (lotar) {
    const cabem = ordenados.slice(0, total);
    const partes = distribuirLotado(
      cabem.map((p) => p.quantidade),
      total,
    );
    return {
      planos: cabem.map((produto, i) => ({ produto, colunas: partes[i] })),
      naoCoube: ordenados.slice(total),
    };
  }

  const planos = [];
  let usadas = 0;
  for (let i = 0; i < ordenados.length; i++) {
    const colunas = colunasNecessarias(ordenados[i].quantidade);
    if (usadas + colunas > total) return { planos, naoCoube: ordenados.slice(i) };
    planos.push({ produto: ordenados[i], colunas });
    usadas += colunas;
  }
  return { planos, naoCoube: [] };
}

/**
 * Alocação gulosa: em ordem de prioridade, a semente é a coluna livre de maior
 * visibilidade; o bloco cresce pro vizinho livre (mesma prateleira) mais visível.
 * Se travar, abre uma nova semente.
 *
 * Devolve `dono` (índice em `resultado` por coluna, -1 = livre), `resultado` e `naoCoube`.
 */
export function alocar(layout, visColunas, ordenados, { lotar = true } = {}) {
  const { colunas } = layout;
  const total = colunas.length;
  const { planos, naoCoube } = planejarColunas(ordenados, total, lotar);
  const dono = new Int32Array(total).fill(-1);
  const porVisibilidade = [...colunas.keys()].sort((a, b) => visColunas[b] - visColunas[a] || b - a);
  let cursor = 0;

  const livreNaPrateleira = (id, prateleira) =>
    id >= 0 && id < total && dono[id] === -1 && colunas[id].prateleira === prateleira;

  const resultado = planos.map(({ produto, colunas: pedidas }, ordem) => {
    const blocos = [];
    let restantes = pedidas;
    while (restantes > 0) {
      while (dono[porVisibilidade[cursor]] !== -1) cursor++;
      const semente = porVisibilidade[cursor];
      const prateleira = colunas[semente].prateleira;
      const bloco = [semente];
      dono[semente] = ordem;
      restantes--;
      let esquerda = semente - 1;
      let direita = semente + 1;
      while (restantes > 0) {
        const podeEsquerda = livreNaPrateleira(esquerda, prateleira);
        const podeDireita = livreNaPrateleira(direita, prateleira);
        if (!podeEsquerda && !podeDireita) break;
        const vaiPraDireita = podeDireita && (!podeEsquerda || visColunas[direita] >= visColunas[esquerda]);
        const escolhida = vaiPraDireita ? direita++ : esquerda--;
        dono[escolhida] = ordem;
        bloco.push(escolhida);
        restantes--;
      }
      blocos.push(bloco);
    }
    const colunaIds = blocos.flat();
    const visibilidadeMedia = colunaIds.reduce((s, id) => s + visColunas[id], 0) / colunaIds.length;
    return { ...produto, colunas: pedidas, colunaIds, blocos, visibilidadeMedia };
  });

  return { dono, resultado, naoCoube };
}
