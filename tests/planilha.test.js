import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { importarArquivo, gerarModeloCSV, NOME_MODELO } from '../src/planilha.js';
import { ErroPlanilha } from '../src/produtos.js';

const exemploCsv = readFileSync(new URL('../public/exemplo.csv', import.meta.url));

function xlsxDe(linhas) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), 'Produtos');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

describe('modelo e exemplo', () => {
  it('o modelo baixado é igual ao public/exemplo.csv (12 itens)', async () => {
    expect(NOME_MODELO).toBe('modelo-produtos.csv');
    expect(gerarModeloCSV()).toBe(new TextDecoder().decode(exemploCsv));
    const produtos = await importarArquivo(exemploCsv, 'exemplo.csv');
    expect(produtos).toHaveLength(12);
  });

  it('o CSV do modelo carrega sem erro', async () => {
    const bytes = new TextEncoder().encode(gerarModeloCSV());
    const produtos = await importarArquivo(bytes, NOME_MODELO);
    expect(produtos[0]).toEqual({ produto: 'Alface crespa', preco: 3.49, volume: 420, quantidade: 180 });
  });

  it('o modelo salvo como .xlsx carrega sem erro', async () => {
    const linhasModelo = gerarModeloCSV()
      .replace(/^\uFEFF/, '')
      .trim()
      .split('\n')
      .map((l) => l.split(';'));
    const produtosCsv = await importarArquivo(new TextEncoder().encode(gerarModeloCSV()), 'm.csv');
    const linhasXlsx = [
      linhasModelo[0],
      ...produtosCsv.map((p) => [p.produto, p.preco, p.volume, p.quantidade]),
    ];
    const produtos = await importarArquivo(xlsxDe(linhasXlsx), 'modelo.xlsx');
    expect(produtos).toEqual(produtosCsv);
  });
});

describe('formatos de planilha', () => {
  it('lê CSV separado por vírgula com ponto decimal', async () => {
    const csv = 'Produto,Preço,Volume,Quantidade\nRúcula,3.99,240,110\n';
    const produtos = await importarArquivo(new TextEncoder().encode(csv), 'lista.csv');
    expect(produtos).toEqual([{ produto: 'Rúcula', preco: 3.99, volume: 240, quantidade: 110 }]);
  });

  it('lê CSV do Excel brasileiro (ponto e vírgula, vírgula decimal, Windows-1252)', async () => {
    // "Preço" e "Agrião" em Windows-1252: ç = 0xE7, ã = 0xE3
    const bytes = Uint8Array.from([
      ...Buffer.from('PRODUTO;PRE'),
      0xe7,
      ...Buffer.from('O;VOLUME;QUANTIDADE\r\nAgri'),
      0xe3,
      ...Buffer.from('o;3,99;150;70\r\n'),
    ]);
    const produtos = await importarArquivo(bytes, 'LISTA.CSV');
    expect(produtos).toEqual([{ produto: 'Agrião', preco: 3.99, volume: 150, quantidade: 70 }]);
  });

  it('lê .xlsx com números e com textos tipo "R$ 4,99"', async () => {
    const bytes = xlsxDe([
      ['produto', 'preco', 'volume', 'quantidade'],
      ['Couve', 'R$ 3,49', 210, 100],
      ['Salsa', 2.5, '90', '30'],
    ]);
    const produtos = await importarArquivo(bytes, 'lista.xlsx');
    expect(produtos.map((p) => p.preco)).toEqual([3.49, 2.5]);
    expect(produtos.map((p) => p.quantidade)).toEqual([100, 30]);
  });

  it('planilha .xlsx com coluna faltando diz qual coluna falta', async () => {
    const bytes = xlsxDe([
      ['produto', 'preço', 'quantidade'],
      ['Couve', 3.49, 100],
    ]);
    await expect(importarArquivo(bytes, 'faltando.xlsx')).rejects.toThrow(
      'Falta a coluna obrigatória "volume" na planilha.',
    );
  });

  it('CSV com coluna faltando diz qual coluna falta', async () => {
    const csv = 'produto;preco;volume\nCouve;3,49;100\n';
    await expect(importarArquivo(new TextEncoder().encode(csv), 'faltando.csv')).rejects.toThrow(
      'Falta a coluna obrigatória "quantidade" na planilha.',
    );
  });

  it('recusa formato que não é .xlsx nem .csv', async () => {
    await expect(importarArquivo(new Uint8Array([1, 2, 3]), 'foto.png')).rejects.toBeInstanceOf(ErroPlanilha);
    await expect(importarArquivo(new Uint8Array([1, 2, 3]), 'foto.png')).rejects.toThrow(
      'Formato não suportado. Use uma planilha .xlsx ou .csv.',
    );
  });

  it('arquivo .xlsx corrompido vira mensagem clara', async () => {
    await expect(importarArquivo(new Uint8Array([80, 75, 3, 4, 0, 0]), 'quebrado.xlsx')).rejects.toThrow(
      'Não consegui ler a planilha. Confira se o arquivo é um .xlsx ou .csv válido.',
    );
  });
});
