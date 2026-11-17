/** Postos (1 = menor valor); empates recebem o posto médio. */
function postos(valores) {
  const ordem = valores.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const resultado = new Array(valores.length);
  for (let i = 0; i < ordem.length; ) {
    let j = i;
    while (j + 1 < ordem.length && ordem[j + 1][0] === ordem[i][0]) j++;
    const medio = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) resultado[ordem[k][1]] = medio;
    i = j + 1;
  }
  return resultado;
}

function pearson(a, b) {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    cov += (a[i] - ma) * (b[i] - mb);
    va += (a[i] - ma) ** 2;
    vb += (b[i] - mb) ** 2;
  }
  return cov / Math.sqrt(va * vb);
}

/** Correlação de Spearman = Pearson dos postos. */
export function spearman(a, b) {
  return pearson(postos(a), postos(b));
}
