import { criarLayout } from './layout.js';
import { calcularVisibilidade } from './visibilidade.js';
import { calcularPrioridades } from './produtos.js';
import { alocar } from './alocacao.js';
import { corCalor, paletaProdutos, COR_LIVRE } from './cores.js';

/** Recalcula tudo a partir do estado da tela. É barato: 1080 alfaces, 180 colunas. */
export function simular({ alinhamento, config, produtos, lotar }) {
  const layout = criarLayout(alinhamento);
  const visibilidade = calcularVisibilidade(layout, config);
  const ordenados = calcularPrioridades(produtos);
  const alocacao = alocar(layout, visibilidade.porColuna, ordenados, { lotar });
  const paleta = paletaProdutos(alocacao.resultado.length);
  return { layout, visibilidade, ordenados, alocacao, paleta };
}

/** Float32Array com r,g,b de cada alface, no modo "calor" ou "produtos". */
export function coresDasAlfaces(simulacao, modo) {
  const { layout, visibilidade, alocacao, paleta } = simulacao;
  const cores = new Float32Array(layout.alfaces.length * 3);
  for (const a of layout.alfaces) {
    let cor;
    if (modo === 'calor') {
      cor = corCalor(visibilidade.normalizado[a.id]);
    } else {
      const dono = alocacao.dono[a.coluna];
      cor = dono >= 0 ? paleta[dono] : COR_LIVRE;
    }
    cores.set(cor, a.id * 3);
  }
  return cores;
}
