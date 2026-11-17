// Diagnóstico: mostra a organização do exemplo.csv (não faz parte do app).
import { readFileSync } from 'node:fs';
import { importarArquivo } from '../src/planilha.js';
import { calcularPrioridades } from '../src/produtos.js';
import { criarLayout } from '../src/layout.js';
import { CONFIG } from '../src/config.js';
import { calcularVisibilidade } from '../src/visibilidade.js';
import { alocar } from '../src/alocacao.js';

const bytes = readFileSync(new URL('../public/exemplo.csv', import.meta.url));
const ordenados = calcularPrioridades(await importarArquivo(bytes, 'exemplo.csv'));
for (const alinhamento of ['centro', 'esquerda', 'direita']) {
  for (const lotar of [true, false]) {
    const layout = criarLayout(alinhamento);
    const vis = calcularVisibilidade(layout, CONFIG);
    const r = alocar(layout, vis.porColuna, ordenados, { lotar });
    console.log(`\n== ${alinhamento} lotar=${lotar} livres=${[...r.dono].filter((d) => d < 0).length}`);
    for (const p of r.resultado) {
      const blocos = p.blocos
        .map((b) => {
          const cs = b.map((id) => layout.colunas[id]);
          const idx = cs.map((c) => c.indice);
          return `P${cs[0].prateleira}[${Math.min(...idx)}-${Math.max(...idx)}]`;
        })
        .join(' ');
      console.log(
        p.produto.padEnd(18),
        p.prioridade.toFixed(3),
        String(p.colunas).padStart(3),
        p.visibilidadeMedia.toFixed(3),
        blocos,
      );
    }
  }
}
