import { describe, it, expect } from 'vitest';
import {
  normalizarCabecalho,
  lerNumero,
  lerProdutos,
  calcularPrioridades,
  ErroPlanilha,
} from '../src/produtos.js';

describe('cabeçalhos', () => {
  it.each([
    ['Produto', 'produto'],
    [' PREÇO ', 'preco'],
    ['preço', 'preco'],
    ['Volume', 'volume'],
    ['QUANTIDADE', 'quantidade'],
  ])('"%s" vira "%s"', (entrada, saida) => {
    expect(normalizarCabecalho(entrada)).toBe(saida);
  });
});

describe('números', () => {
  it.each([
    [4.99, 4.99],
    ['4.99', 4.99],
    ['4,99', 4.99],
    ['R$ 4,99', 4.99],
    ['1.234,50', 1234.5],
    ['1,234.50', 1234.5],
    [' 120 ', 120],
  ])('%j vira %d', (entrada, saida) => {
    expect(lerNumero(entrada)).toBeCloseTo(saida, 10);
  });

  it.each([[''], ['abc'], [null], [undefined]])('%j não é número', (entrada) => {
    expect(Number.isNaN(lerNumero(entrada))).toBe(true);
  });
});

describe('leitura das linhas da planilha', () => {
  it('aceita cabeçalho com acento e maiúsculas, em qualquer ordem', () => {
    const produtos = lerProdutos([
      ['QUANTIDADE', 'Preço', 'Produto', 'VOLUME'],
      [60, '3,49', 'Alface crespa', 420],
    ]);
    expect(produtos).toEqual([{ produto: 'Alface crespa', preco: 3.49, volume: 420, quantidade: 60 }]);
  });

  it('ignora linhas totalmente vazias', () => {
    const produtos = lerProdutos([
      ['produto', 'preco', 'volume', 'quantidade'],
      ['Rúcula', 4, 100, 12],
      [],
      ['', '', '', ''],
    ]);
    expect(produtos).toHaveLength(1);
  });

  it('diz qual coluna falta', () => {
    expect(() => lerProdutos([['produto', 'preco', 'quantidade'], ['Couve', 3, 10]])).toThrow(
      'Falta a coluna obrigatória "volume" na planilha.',
    );
  });

  it('diz todas as colunas que faltam', () => {
    let erro;
    try {
      lerProdutos([['produto', 'preço'], ['Couve', 3]]);
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(ErroPlanilha);
    expect(erro.message).toBe('Faltam as colunas obrigatórias "volume" e "quantidade" na planilha.');
  });

  it('aponta a linha com número inválido', () => {
    expect(() =>
      lerProdutos([
        ['produto', 'preco', 'volume', 'quantidade'],
        ['Couve', 3, 10, 12],
        ['Salsa', 'caro', 10, 12],
      ]),
    ).toThrow('Linha 3: "preco" precisa ser um número (veio "caro").');
  });

  it('exige quantidade maior que zero', () => {
    expect(() =>
      lerProdutos([
        ['produto', 'preco', 'volume', 'quantidade'],
        ['Couve', 3, 10, 0],
      ]),
    ).toThrow('Linha 2: "quantidade" precisa ser maior que zero.');
  });

  it('reclama de planilha sem produtos', () => {
    expect(() => lerProdutos([['produto', 'preco', 'volume', 'quantidade']])).toThrow(
      'A planilha não tem nenhum produto.',
    );
    expect(() => lerProdutos([])).toThrow('A planilha está vazia.');
  });
});

describe('prioridade', () => {
  const p = (produto, preco, volume) => ({ produto, preco, volume, quantidade: 6 });

  it('menor preço e maior volume = mais prioridade', () => {
    const ordem = calcularPrioridades([p('B', 10, 10), p('C', 6, 55), p('A', 2, 100)]);
    expect(ordem.map((x) => x.produto)).toEqual(['A', 'C', 'B']);
    expect(ordem.map((x) => x.prioridade)).toEqual([1, 0.5, 0]);
  });

  it('desempata pelo maior volume', () => {
    const ordem = calcularPrioridades([p('X', 2, 10), p('Y', 10, 100)]);
    expect(ordem[0].prioridade).toBe(ordem[1].prioridade);
    expect(ordem.map((x) => x.produto)).toEqual(['Y', 'X']);
  });

  it('não gera NaN quando todos têm o mesmo preço', () => {
    const ordem = calcularPrioridades([p('X', 5, 10), p('Y', 5, 100)]);
    expect(ordem.every((x) => Number.isFinite(x.prioridade))).toBe(true);
    expect(ordem[0].produto).toBe('Y');
  });

  it('não altera a lista original', () => {
    const lista = [p('B', 10, 10), p('A', 2, 100)];
    calcularPrioridades(lista);
    expect(lista.map((x) => x.produto)).toEqual(['B', 'A']);
    expect(lista[0]).not.toHaveProperty('prioridade');
  });
});
