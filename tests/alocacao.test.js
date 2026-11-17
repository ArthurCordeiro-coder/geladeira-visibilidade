import { describe, it, expect } from 'vitest';
import { criarLayout } from '../src/layout.js';
import { CONFIG } from '../src/config.js';
import { calcularVisibilidade } from '../src/visibilidade.js';
import { calcularPrioridades } from '../src/produtos.js';
import { colunasNecessarias, distribuirLotado, planejarColunas, alocar } from '../src/alocacao.js';

const soma = (xs) => xs.reduce((s, x) => s + x, 0);

describe('colunas por produto', () => {
  it.each([
    [1, 1],
    [6, 1],
    [7, 2],
    [60, 10],
    [61, 11],
  ])('quantidade %d → %d coluna(s)', (q, c) => {
    expect(colunasNecessarias(q)).toBe(c);
  });
});

describe('lotar geladeira (maiores restos, mínimo 1)', () => {
  it('distribui as 180 colunas na proporção das quantidades', () => {
    expect(distribuirLotado([50, 50, 50], 180)).toEqual([60, 60, 60]);
    expect(distribuirLotado([1, 2], 180)).toEqual([60, 120]);
  });

  it('entrega as sobras pros maiores restos, na ordem de prioridade em caso de empate', () => {
    // 180/7 = 25,71… → 7×25 = 175, sobram 5
    expect(distribuirLotado([1, 1, 1, 1, 1, 1, 1], 180)).toEqual([26, 26, 26, 26, 26, 25, 25]);
  });

  it('garante pelo menos 1 coluna por produto', () => {
    const r = distribuirLotado([1, 1, 10000], 180);
    expect(r).toEqual([1, 1, 178]);
    expect(soma(r)).toBe(180);
  });
});

describe('planejamento das colunas', () => {
  const ordenados = [
    { produto: 'A', quantidade: 600 }, // 100 colunas
    { produto: 'B', quantidade: 480 }, // 80 colunas
    { produto: 'C', quantidade: 60 }, // 10 colunas
  ];

  it('lotado: usa as 180 colunas e ninguém fica de fora', () => {
    const { planos, naoCoube } = planejarColunas(ordenados, 180, true);
    expect(soma(planos.map((p) => p.colunas))).toBe(180);
    expect(naoCoube).toEqual([]);
  });

  it('sem lotar: usa ceil(quantidade/6) e os de menor prioridade que passam de 180 ficam de fora', () => {
    const { planos, naoCoube } = planejarColunas(ordenados, 180, false);
    expect(planos.map((p) => [p.produto.produto, p.colunas])).toEqual([
      ['A', 100],
      ['B', 80],
    ]);
    expect(naoCoube.map((p) => p.produto)).toEqual(['C']);
  });

  it('sem lotar e cabendo tudo: sobra espaço livre', () => {
    const { planos } = planejarColunas([{ produto: 'A', quantidade: 12 }], 180, false);
    expect(planos.map((p) => p.colunas)).toEqual([2]);
  });

  it('lotado com mais produtos que colunas: cada um ganha 1 e o excedente não cabe', () => {
    const muitos = Array.from({ length: 182 }, (_, i) => ({ produto: `P${i}`, quantidade: 6 }));
    const { planos, naoCoube } = planejarColunas(muitos, 180, true);
    expect(planos).toHaveLength(180);
    expect(planos.every((p) => p.colunas === 1)).toBe(true);
    expect(naoCoube.map((p) => p.produto)).toEqual(['P180', 'P181']);
  });
});

describe('alocação gulosa em blocos contíguos', () => {
  const layout = criarLayout('centro');
  const vis = calcularVisibilidade(layout, CONFIG);
  const melhorColuna = vis.porColuna.indexOf(Math.max(...vis.porColuna));

  const produto = (nome, preco, volume, quantidade) => ({ produto: nome, preco, volume, quantidade });

  it('o primeiro produto começa na coluna mais visível e cresce pro vizinho mais visível', () => {
    const ordenados = calcularPrioridades([produto('A', 1, 100, 18), produto('B', 9, 1, 6)]);
    const r = alocar(layout, vis.porColuna, ordenados, { lotar: false });
    const a = r.resultado[0];
    expect(a.colunaIds).toContain(melhorColuna);
    const c = layout.colunas[melhorColuna];
    // a melhor coluna é a da ponta direita da prateleira 2; só dá pra crescer pra esquerda
    expect(c.prateleira).toBe(2);
    expect(c.indice).toBe(39);
    expect([...a.colunaIds].sort((x, y) => x - y)).toEqual([melhorColuna - 2, melhorColuna - 1, melhorColuna]);
    expect(a.blocos).toHaveLength(1);
  });

  it('quando trava na prateleira, abre uma nova semente na melhor coluna livre', () => {
    // 45 colunas: enche a prateleira 2 (40) e abre outro bloco com 5
    const ordenados = calcularPrioridades([produto('A', 1, 100, 270)]);
    const r = alocar(layout, vis.porColuna, ordenados, { lotar: false });
    const blocos = r.resultado[0].blocos;
    expect(blocos.map((b) => b.length)).toEqual([40, 5]);
    expect(new Set(blocos[0].map((id) => layout.colunas[id].prateleira))).toEqual(new Set([2]));
    const segundo = blocos[1].map((id) => layout.colunas[id]);
    expect(new Set(segundo.map((c) => c.prateleira)).size).toBe(1);
  });

  it('lotado: as 180 colunas ganham dono, sem repetir', () => {
    const ordenados = calcularPrioridades([
      produto('A', 2, 300, 300),
      produto('B', 5, 100, 200),
      produto('C', 9, 50, 100),
    ]);
    const r = alocar(layout, vis.porColuna, ordenados, { lotar: true });
    expect([...r.dono].every((d) => d >= 0)).toBe(true);
    const todas = r.resultado.flatMap((p) => p.colunaIds);
    expect(new Set(todas).size).toBe(180);
    expect(soma(r.resultado.map((p) => p.colunas))).toBe(180);
  });

  it('cada bloco é contíguo e fica numa prateleira só', () => {
    const ordenados = calcularPrioridades([
      produto('A', 2, 300, 300),
      produto('B', 5, 100, 200),
      produto('C', 9, 50, 100),
      produto('D', 4, 80, 90),
    ]);
    const r = alocar(layout, vis.porColuna, ordenados, { lotar: true });
    for (const p of r.resultado) {
      for (const bloco of p.blocos) {
        const cols = bloco.map((id) => layout.colunas[id]).sort((x, y) => x.indice - y.indice);
        expect(new Set(cols.map((c) => c.prateleira)).size).toBe(1);
        cols.forEach((c, i) => expect(c.indice).toBe(cols[0].indice + i));
      }
    }
  });

  it('só abre bloco novo quando o anterior travou em borda ou em produto já colocado', () => {
    const ordenados = calcularPrioridades([
      produto('A', 2, 300, 300),
      produto('B', 5, 100, 200),
      produto('C', 9, 50, 100),
      produto('D', 4, 80, 90),
    ]);
    const r = alocar(layout, vis.porColuna, ordenados, { lotar: true });
    r.resultado.forEach((p, ordem) => {
      p.blocos.slice(0, -1).forEach((bloco) => {
        const cols = bloco.map((id) => layout.colunas[id]).sort((x, y) => x.indice - y.indice);
        for (const vizinho of [cols[0].id - 1, cols[cols.length - 1].id + 1]) {
          const c = layout.colunas[vizinho];
          if (!c || c.prateleira !== cols[0].prateleira) continue; // borda da prateleira
          expect(r.dono[vizinho]).toBeLessThan(ordem); // ocupado por alguém de prioridade maior
        }
      });
    });
  });

  it('calcula a visibilidade média recebida por produto', () => {
    const ordenados = calcularPrioridades([produto('A', 1, 100, 18)]);
    const r = alocar(layout, vis.porColuna, ordenados, { lotar: false });
    const a = r.resultado[0];
    const esperado = soma(a.colunaIds.map((id) => vis.porColuna[id])) / a.colunaIds.length;
    expect(a.visibilidadeMedia).toBeCloseTo(esperado, 12);
  });

  it('sem lotar, lista o que não coube e deixa colunas livres (-1) quando sobra espaço', () => {
    const ordenados = calcularPrioridades([produto('A', 1, 100, 1000), produto('B', 9, 1, 300)]);
    const r = alocar(layout, vis.porColuna, ordenados, { lotar: false });
    expect(r.resultado.map((p) => p.produto)).toEqual(['A']);
    expect(r.naoCoube.map((p) => p.produto)).toEqual(['B']);
    expect([...r.dono].filter((d) => d === -1)).toHaveLength(180 - 167);
  });
});
