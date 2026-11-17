import { describe, it, expect } from 'vitest';
import { simular, coresDasAlfaces } from '../src/simulacao.js';
import { CONFIG } from '../src/config.js';
import { ITENS_EXEMPLO } from '../src/planilha.js';
import { corCalor, paletaProdutos, COR_LIVRE } from '../src/cores.js';

const exemplo = ITENS_EXEMPLO.map(([produto, preco, volume, quantidade]) => ({ produto, preco, volume, quantidade }));

describe('simulação completa', () => {
  it('junta layout, visibilidade, prioridades e alocação', () => {
    const s = simular({ alinhamento: 'centro', config: CONFIG, produtos: exemplo, lotar: true });
    expect(s.layout.alfaces).toHaveLength(1080);
    expect(s.visibilidade.porColuna).toHaveLength(180);
    expect(s.alocacao.resultado).toHaveLength(12);
    expect([...s.alocacao.dono].every((d) => d >= 0)).toBe(true);
    expect(s.alocacao.resultado[0].produto).toBe('Alface crespa');
  });

  it('pinta pelo mapa de calor ou por produto (livre = cinza)', () => {
    const s = simular({ alinhamento: 'centro', config: CONFIG, produtos: exemplo.slice(0, 1), lotar: false });
    const calor = coresDasAlfaces(s, 'calor');
    expect(calor).toHaveLength(1080 * 3);
    const id = 123;
    expect([...calor.slice(id * 3, id * 3 + 3)]).toEqual(
      corCalor(s.visibilidade.normalizado[id]).map((c) => Math.fround(c)),
    );

    const produtos = coresDasAlfaces(s, 'produtos');
    const ocupada = s.alocacao.resultado[0].colunaIds[0];
    const alfaceOcupada = s.layout.colunas[ocupada].alfaces[0];
    expect([...produtos.slice(alfaceOcupada * 3, alfaceOcupada * 3 + 3)]).toEqual(
      paletaProdutos(1)[0].map((c) => Math.fround(c)),
    );
    const livre = [...s.alocacao.dono].indexOf(-1);
    const alfaceLivre = s.layout.colunas[livre].alfaces[0];
    expect([...produtos.slice(alfaceLivre * 3, alfaceLivre * 3 + 3)]).toEqual(COR_LIVRE.map((c) => Math.fround(c)));
  });
});
