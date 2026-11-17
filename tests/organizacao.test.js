import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { spearman } from './apoio/estatistica.js';
import { importarArquivo } from '../src/planilha.js';
import { calcularPrioridades } from '../src/produtos.js';
import { criarLayout } from '../src/layout.js';
import { CONFIG } from '../src/config.js';
import { calcularVisibilidade } from '../src/visibilidade.js';
import { alocar } from '../src/alocacao.js';

describe('correlação de Spearman (apoio do teste)', () => {
  it('vale 1 para ordem igual, −1 para ordem invertida', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 12);
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1, 12);
  });

  it('bate com o valor de referência e trata empates com posto médio', () => {
    // ρ = 1 − 6·Σd²/(n(n²−1)) = 1 − 6·2/(5·24) = 0,9
    expect(spearman([1, 2, 3, 4, 5], [2, 1, 3, 4, 5])).toBeCloseTo(0.9, 12);
    expect(spearman([1, 1, 2], [1, 1, 2])).toBeCloseTo(1, 12);
  });
});

describe('organização automática com o exemplo.csv', () => {
  async function organizarExemplo(opcoes) {
    const bytes = readFileSync(new URL('../public/exemplo.csv', import.meta.url));
    const ordenados = calcularPrioridades(await importarArquivo(bytes, 'exemplo.csv'));
    const layout = criarLayout('centro');
    const vis = calcularVisibilidade(layout, CONFIG);
    return alocar(layout, vis.porColuna, ordenados, opcoes);
  }

  it('Spearman ≥ 0,9 entre prioridade e visibilidade média recebida (Lotar geladeira ligado)', async () => {
    const { resultado, naoCoube } = await organizarExemplo({ lotar: true });
    expect(resultado).toHaveLength(12);
    expect(naoCoube).toHaveLength(0);
    const rho = spearman(
      resultado.map((p) => p.prioridade),
      resultado.map((p) => p.visibilidadeMedia),
    );
    console.log(`Spearman (lotar ligado) = ${rho.toFixed(4)}`);
    expect(rho).toBeGreaterThanOrEqual(0.9);
  });

  it('Spearman ≥ 0,9 também com Lotar geladeira desligado', async () => {
    const { resultado } = await organizarExemplo({ lotar: false });
    const rho = spearman(
      resultado.map((p) => p.prioridade),
      resultado.map((p) => p.visibilidadeMedia),
    );
    console.log(`Spearman (lotar desligado) = ${rho.toFixed(4)}`);
    expect(rho).toBeGreaterThanOrEqual(0.9);
  });
});
