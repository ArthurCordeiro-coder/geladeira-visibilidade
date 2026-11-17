import { describe, it, expect } from 'vitest';
import { corCalor, paletaProdutos, VERMELHO, AMARELO, VERDE, hexDe } from '../src/cores.js';

describe('escala do mapa de calor', () => {
  it('0 = vermelho, 0,5 = amarelo, 1 = verde', () => {
    expect(corCalor(0)).toEqual(VERMELHO);
    expect(corCalor(0.5)).toEqual(AMARELO);
    expect(corCalor(1)).toEqual(VERDE);
  });

  it('interpola no meio do caminho e limita fora de 0–1', () => {
    const meio = corCalor(0.25);
    meio.forEach((c, i) => expect(c).toBeCloseTo((VERMELHO[i] + AMARELO[i]) / 2, 12));
    expect(corCalor(-3)).toEqual(VERMELHO);
    expect(corCalor(7)).toEqual(VERDE);
  });

  it('converte pra hexadecimal', () => {
    expect(hexDe([1, 0, 0.5])).toBe('#ff0080');
  });
});

describe('paleta de produtos', () => {
  it.each([1, 12, 30])('gera %d cores distintas', (n) => {
    const cores = paletaProdutos(n).map(hexDe);
    expect(cores).toHaveLength(n);
    expect(new Set(cores).size).toBe(n);
  });

  it('é determinística', () => {
    expect(paletaProdutos(12)).toEqual(paletaProdutos(12));
  });
});
