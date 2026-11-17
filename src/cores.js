// Cores como [r, g, b] de 0 a 1 (o formato que o Three.js usa).
export const VERMELHO = Object.freeze([0.84, 0.15, 0.12]);
export const AMARELO = Object.freeze([0.98, 0.84, 0.16]);
export const VERDE = Object.freeze([0.1, 0.62, 0.24]);
export const COR_LIVRE = Object.freeze([0.8, 0.8, 0.8]);

const misturar = (a, b, t) => a.map((c, i) => c + (b[i] - c) * t);

/** 0 = vermelho (menos visão) → 0,5 = amarelo → 1 = verde (máxima visão). */
export function corCalor(valor) {
  const v = Math.min(1, Math.max(0, valor));
  if (v <= 0) return [...VERMELHO];
  if (v >= 1) return [...VERDE];
  return v < 0.5 ? misturar(VERMELHO, AMARELO, v / 0.5) : misturar(AMARELO, VERDE, (v - 0.5) / 0.5);
}

export function hexDe(cor) {
  return `#${cor
    .map((c) =>
      Math.round(Math.min(1, Math.max(0, c)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function deHex(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}

function deHsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))));
}

// 12 cores de alto contraste (base: cores de Kelly), alternando famílias de matiz pra que
// produtos vizinhos na prateleira não se confundam; daí em diante, ângulo áureo no matiz.
const BASE = [
  '#0067a5', // azul
  '#f38400', // laranja
  '#008856', // verde
  '#be0032', // vermelho
  '#875692', // roxo
  '#f3c300', // amarelo
  '#a1caf1', // azul-claro
  '#882d17', // marrom
  '#e68fac', // rosa
  '#2b3d26', // verde-escuro
  '#8db600', // verde-limão
  '#00b5c7', // ciano
].map(deHex);

/** Uma cor distinta por produto, sempre na mesma ordem. */
export function paletaProdutos(n) {
  const cores = [];
  for (let i = 0; i < n; i++) {
    if (i < BASE.length) {
      cores.push([...BASE[i]]);
    } else {
      const j = i - BASE.length;
      cores.push(deHsl((j * 137.508 + 20) % 360, 0.65, 0.35 + (j % 3) * 0.15));
    }
  }
  return cores;
}
