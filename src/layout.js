import { GELADEIRA, ALINHAMENTOS } from './config.js';

const CAMADAS = 3; // base (0), meio (1), topo (2)
const PROFUNDIDADES = 2; // frente (0), fundo (1)
export const ALFACES_POR_COLUNA = CAMADAS * PROFUNDIDADES;

function deslocamento(alinhamento, largura) {
  const sobra = GELADEIRA.larguraTotal - largura;
  if (alinhamento === 'esquerda') return 0;
  if (alinhamento === 'centro') return sobra / 2;
  return sobra; // direita
}

/**
 * Monta a geladeira lotada: prateleiras, colunas (1 u de largura × 2 × 3) e alfaces.
 * Coordenadas em u: x de 0 (borda esquerda) a 40 (direita); y = 0 no piso da prateleira 5.
 */
export function criarLayout(alinhamento = 'centro') {
  if (!ALINHAMENTOS.includes(alinhamento)) {
    throw new Error(`Alinhamento desconhecido: ${alinhamento}`);
  }
  const total = GELADEIRA.larguras.length;
  const prateleiras = [];
  const colunas = [];
  const alfaces = [];

  GELADEIRA.larguras.forEach((largura, i) => {
    const numero = i + 1;
    const alinhavel = GELADEIRA.prateleirasAlinhaveis.includes(numero);
    const prateleira = {
      numero,
      largura,
      profundidade: GELADEIRA.profundidade,
      altura: GELADEIRA.altura,
      x0: alinhavel ? deslocamento(alinhamento, largura) : 0,
      y0: (total - numero) * GELADEIRA.altura,
      colunas: [],
    };
    prateleiras.push(prateleira);

    for (let indice = 0; indice < largura; indice++) {
      const coluna = {
        id: colunas.length,
        prateleira: numero,
        indice,
        x: prateleira.x0 + indice + 0.5,
        alfaces: [],
      };
      for (let profundidade = 0; profundidade < PROFUNDIDADES; profundidade++) {
        for (let camada = 0; camada < CAMADAS; camada++) {
          const alface = {
            id: alfaces.length,
            coluna: coluna.id,
            prateleira: numero,
            indiceColuna: indice,
            profundidade,
            camada,
            x: coluna.x,
            y: prateleira.y0 + camada + 0.5,
          };
          alfaces.push(alface);
          coluna.alfaces.push(alface.id);
        }
      }
      colunas.push(coluna);
      prateleira.colunas.push(coluna.id);
    }
  });

  return { alinhamento, prateleiras, colunas, alfaces };
}
