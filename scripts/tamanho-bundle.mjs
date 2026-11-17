// Soma o tamanho gzip de tudo que vai pro ar (dist/) e falha se passar de 1,5 MB.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const LIMITE = 1.5 * 1024 * 1024;
const raiz = new URL('../dist/', import.meta.url).pathname;

function arquivos(pasta) {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho];
  });
}

let total = 0;
for (const caminho of arquivos(raiz).sort()) {
  const bruto = readFileSync(caminho);
  const gz = gzipSync(bruto, { level: 9 }).length;
  total += gz;
  console.log(`${relative(raiz, caminho).padEnd(36)} ${(bruto.length / 1024).toFixed(1).padStart(8)} kB  gzip ${(gz / 1024).toFixed(1).padStart(7)} kB`);
}
const mb = (total / 1024 / 1024).toFixed(3);
console.log(`\nTotal gzip: ${(total / 1024).toFixed(1)} kB (${mb} MB) — limite 1,5 MB`);
if (total >= LIMITE) {
  console.error('FALHOU: bundle acima de 1,5 MB gzip');
  process.exit(1);
}
console.log('PASSOU: bundle abaixo de 1,5 MB gzip');
