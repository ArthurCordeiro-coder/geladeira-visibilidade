import { GELADEIRA } from './config.js';

const NOMES_CAMADA = ['base', 'meio', 'topo'];
const NOMES_PROFUNDIDADE = ['frente', 'fundo'];

/**
 * Visibilidade de cada alface:
 *   V = prateleira · H · profundidade · camada · P
 * com H = base + inclinacao · (x / 40) e, só nas prateleiras 4 e 5,
 * P = 1 − intensidade · exp(−d² / (2·sigma²)), d = distância (no plano frontal, em u)
 * do centro da alface até o canto inferior direito da prateleira 5.
 * Depois normaliza min-max pra 0–1.
 */
export function calcularVisibilidade(layout, config) {
  const { alfaces, colunas, prateleiras } = layout;
  const p5 = prateleiras[prateleiras.length - 1];
  const cantoX = p5.x0 + p5.largura;
  const cantoY = p5.y0;
  const doisSigma2 = 2 * config.canto.sigma ** 2;

  const bruto = new Float64Array(alfaces.length);
  for (const a of alfaces) {
    const fPrateleira = config.prateleiras[a.prateleira - 1];
    const xn = a.x / GELADEIRA.larguraTotal;
    const h = config.horizontal.base + config.horizontal.inclinacao * xn;
    const fProfundidade = config.profundidade[NOMES_PROFUNDIDADE[a.profundidade]];
    const fCamada = config.camada[NOMES_CAMADA[a.camada]];
    let p = 1;
    if (GELADEIRA.prateleirasAlinhaveis.includes(a.prateleira)) {
      const d2 = (a.x - cantoX) ** 2 + (a.y - cantoY) ** 2;
      p = 1 - config.canto.intensidade * Math.exp(-d2 / doisSigma2);
    }
    bruto[a.id] = fPrateleira * h * fProfundidade * fCamada * p;
  }

  let min = Infinity;
  let max = -Infinity;
  for (const v of bruto) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const faixa = max - min;
  const normalizado = new Float64Array(alfaces.length);
  for (let i = 0; i < bruto.length; i++) {
    normalizado[i] = faixa > 0 ? (bruto[i] - min) / faixa : 1;
  }

  const porColuna = new Float64Array(colunas.length);
  for (const c of colunas) {
    let soma = 0;
    for (const id of c.alfaces) soma += normalizado[id];
    porColuna[c.id] = soma / c.alfaces.length;
  }

  return { bruto, normalizado, porColuna };
}
