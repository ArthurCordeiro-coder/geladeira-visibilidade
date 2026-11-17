import { describe, it, expect, beforeAll } from 'vitest';
import { criarLayout } from '../src/layout.js';
import { CONFIG, copiarConfig } from '../src/config.js';
import { calcularVisibilidade } from '../src/visibilidade.js';

const media = (valores) => valores.reduce((s, v) => s + v, 0) / valores.length;

function mediaOnde(layout, valores, filtro) {
  return media(layout.alfaces.filter(filtro).map((a) => valores[a.id]));
}

function indiceDoMinimo(valores) {
  let melhor = 0;
  for (let i = 1; i < valores.length; i++) if (valores[i] < valores[melhor]) melhor = i;
  return melhor;
}

describe('mapa de calor de visibilidade', () => {
  const layout = criarLayout('centro');
  let vis;
  beforeAll(() => {
    vis = calcularVisibilidade(layout, CONFIG);
  });

  it('normaliza (min-max) as 1080 alfaces para 0–1', () => {
    expect(vis.normalizado).toHaveLength(1080);
    expect(Math.min(...vis.normalizado)).toBe(0);
    expect(Math.max(...vis.normalizado)).toBeCloseTo(1, 12);
  });

  it('aplica V = prateleira · H · profundidade · camada (sem penalidade nas prateleiras 1–3)', () => {
    const alface = layout.alfaces.find(
      (a) => a.prateleira === 2 && a.indiceColuna === 39 && a.profundidade === 0 && a.camada === 2,
    );
    expect(vis.bruto[alface.id]).toBeCloseTo(1.0 * (0.5 + 0.5 * (39.5 / 40)) * 1.0 * 1.0, 12);

    const fundoBase = layout.alfaces.find(
      (a) => a.prateleira === 3 && a.indiceColuna === 0 && a.profundidade === 1 && a.camada === 0,
    );
    expect(vis.bruto[fundoBase.id]).toBeCloseTo(0.9 * (0.5 + 0.5 * (0.5 / 40)) * 0.6 * 0.7, 12);
  });

  it('aplica a penalidade gaussiana do canto inferior direito nas prateleiras 4 e 5', () => {
    // Prateleira 4, centro: x0 = 5, canto da prateleira 5 em (35, 0).
    const alface = layout.alfaces.find(
      (a) => a.prateleira === 4 && a.indiceColuna === 29 && a.profundidade === 0 && a.camada === 1,
    );
    // centro da alface: x = 34.5, y = 3 + 1 + 0.5 = 4.5
    const d2 = (34.5 - 35) ** 2 + (4.5 - 0) ** 2;
    const P = 1 - 0.95 * Math.exp(-d2 / (2 * 6 ** 2));
    const esperado = 0.5 * (0.5 + 0.5 * (34.5 / 40)) * 1.0 * 0.85 * P;
    expect(vis.bruto[alface.id]).toBeCloseTo(esperado, 12);
  });

  it('o lado direito tem visibilidade média maior que o esquerdo', () => {
    const direita = mediaOnde(layout, vis.normalizado, (a) => a.x > 20);
    const esquerda = mediaOnde(layout, vis.normalizado, (a) => a.x < 20);
    expect(direita).toBeGreaterThan(esquerda);
  });

  it('a prateleira 2 tem visibilidade média maior que a prateleira 5', () => {
    const p2 = mediaOnde(layout, vis.normalizado, (a) => a.prateleira === 2);
    const p5 = mediaOnde(layout, vis.normalizado, (a) => a.prateleira === 5);
    expect(p2).toBeGreaterThan(p5);
  });

  it.each(['esquerda', 'centro', 'direita'])(
    'com alinhamento %s, o canto inferior direito tem o menor valor da geladeira',
    (alinhamento) => {
      const l = criarLayout(alinhamento);
      const v = calcularVisibilidade(l, CONFIG);
      const minimo = l.alfaces[indiceDoMinimo(v.normalizado)];
      expect(minimo.prateleira).toBe(5);
      expect(minimo.indiceColuna).toBe(29);
      expect(minimo.camada).toBe(0);
      expect(v.normalizado[minimo.id]).toBe(0);
    },
  );

  it('a visibilidade da coluna é a média das suas 6 alfaces', () => {
    expect(vis.porColuna).toHaveLength(180);
    const coluna = layout.colunas[57];
    expect(vis.porColuna[57]).toBeCloseTo(media(coluna.alfaces.map((id) => vis.normalizado[id])), 12);
  });

  it('usa os pesos recebidos: sem penalidade, o pior lugar vira o canto esquerdo da prateleira 5', () => {
    const config = copiarConfig();
    config.canto.intensidade = 0;
    const v = calcularVisibilidade(layout, config);
    const minimo = layout.alfaces[indiceDoMinimo(v.normalizado)];
    expect(minimo.prateleira).toBe(5);
    expect(minimo.indiceColuna).toBe(0);
  });

  it('não gera NaN quando todos os pesos ficam iguais', () => {
    const config = copiarConfig();
    config.prateleiras = [1, 1, 1, 1, 1];
    config.horizontal = { base: 1, inclinacao: 0 };
    config.profundidade = { frente: 1, fundo: 1 };
    config.camada = { topo: 1, meio: 1, base: 1 };
    config.canto.intensidade = 0;
    const v = calcularVisibilidade(layout, config);
    expect(v.normalizado.every((x) => Number.isFinite(x))).toBe(true);
  });
});
