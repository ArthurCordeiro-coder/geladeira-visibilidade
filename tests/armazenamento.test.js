import { describe, it, expect } from 'vitest';
import { salvarLista, carregarLista, CHAVE_LISTA } from '../src/armazenamento.js';

function armazenamentoFalso() {
  const dados = new Map();
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    dados,
  };
}

const quebrado = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

const lista = [{ produto: 'Rúcula', preco: 3.99, volume: 240, quantidade: 110 }];

describe('lista salva no navegador', () => {
  it('salva e recupera a última lista importada', () => {
    const s = armazenamentoFalso();
    expect(salvarLista(lista, s)).toBe(true);
    expect(s.dados.has(CHAVE_LISTA)).toBe(true);
    expect(carregarLista(s)).toEqual(lista);
  });

  it('devolve null quando não tem nada salvo', () => {
    expect(carregarLista(armazenamentoFalso())).toBeNull();
  });

  it('não quebra quando o localStorage falha (modo privado, cota cheia)', () => {
    expect(salvarLista(lista, quebrado)).toBe(false);
    expect(carregarLista(quebrado)).toBeNull();
    expect(salvarLista(lista, undefined)).toBe(false);
    expect(carregarLista(undefined)).toBeNull();
  });

  it('ignora conteúdo corrompido ou fora do formato', () => {
    const s = armazenamentoFalso();
    s.setItem(CHAVE_LISTA, '{isso não é json');
    expect(carregarLista(s)).toBeNull();
    s.setItem(CHAVE_LISTA, JSON.stringify([{ produto: 'X', preco: 'caro' }]));
    expect(carregarLista(s)).toBeNull();
    s.setItem(CHAVE_LISTA, JSON.stringify([]));
    expect(carregarLista(s)).toBeNull();
  });
});
