import { describe, it, expect } from 'vitest';
import { criarLayout } from '../src/layout.js';

describe('layout da geladeira', () => {
  it('tem 3 prateleiras de 40×2×3 e 2 de 30×2×3, numeradas de cima (1) pra baixo (5)', () => {
    const { prateleiras } = criarLayout('centro');
    expect(prateleiras.map((p) => p.numero)).toEqual([1, 2, 3, 4, 5]);
    expect(prateleiras.map((p) => [p.largura, p.profundidade, p.altura])).toEqual([
      [40, 2, 3],
      [40, 2, 3],
      [40, 2, 3],
      [30, 2, 3],
      [30, 2, 3],
    ]);
  });

  it('tem 1080 alfaces e 180 colunas de 6 alfaces cada', () => {
    const { alfaces, colunas } = criarLayout('centro');
    expect(alfaces).toHaveLength(1080);
    expect(colunas).toHaveLength(180);
    for (const coluna of colunas) {
      expect(coluna.alfaces).toHaveLength(6);
    }
  });

  it('cada alface pertence a exatamente uma coluna', () => {
    const { alfaces, colunas } = criarLayout('centro');
    const vistas = new Set();
    for (const coluna of colunas) {
      for (const id of coluna.alfaces) {
        expect(vistas.has(id)).toBe(false);
        vistas.add(id);
        expect(alfaces[id].coluna).toBe(coluna.id);
      }
    }
    expect(vistas.size).toBe(1080);
  });

  it('a prateleira 1 fica no alto e a 5 embaixo (y cresce pra cima)', () => {
    const { prateleiras } = criarLayout('centro');
    for (let i = 1; i < prateleiras.length; i++) {
      expect(prateleiras[i].y0).toBeLessThan(prateleiras[i - 1].y0);
    }
    expect(prateleiras[4].y0).toBe(0);
  });

  it.each([
    ['esquerda', 0],
    ['centro', 5],
    ['direita', 10],
  ])('alinhamento %s desloca as prateleiras 4 e 5 em %d u', (alinhamento, deslocamento) => {
    const { prateleiras } = criarLayout(alinhamento);
    expect(prateleiras[0].x0).toBe(0);
    expect(prateleiras[3].x0).toBe(deslocamento);
    expect(prateleiras[4].x0).toBe(deslocamento);
  });

  it('o x da alface é o centro dela na largura total (0 a 40)', () => {
    const { alfaces } = criarLayout('centro');
    const xs = alfaces.map((a) => a.x);
    expect(Math.min(...xs)).toBe(0.5);
    expect(Math.max(...xs)).toBe(39.5);
    const daPrateleira5 = alfaces.filter((a) => a.prateleira === 5).map((a) => a.x);
    expect(Math.min(...daPrateleira5)).toBe(5.5);
    expect(Math.max(...daPrateleira5)).toBe(34.5);
  });

  it('cada coluna tem 2 de profundidade × 3 camadas', () => {
    const { colunas, alfaces } = criarLayout('centro');
    const combinacoes = colunas[0].alfaces
      .map((id) => `${alfaces[id].profundidade}-${alfaces[id].camada}`)
      .sort();
    expect(combinacoes).toEqual(['0-0', '0-1', '0-2', '1-0', '1-1', '1-2']);
  });

  it('rejeita alinhamento desconhecido', () => {
    expect(() => criarLayout('diagonal')).toThrow(/alinhamento/i);
  });
});
