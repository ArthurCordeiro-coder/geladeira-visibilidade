import { ErroPlanilha, lerProdutos, COLUNAS_OBRIGATORIAS } from './produtos.js';

export const NOME_MODELO = 'modelo-produtos.csv';

// 12 itens de hortifrúti refrigerado. preco em R$ por unidade, volume = vendas por semana (u),
// quantidade = unidades para expor. É o mesmo conteúdo de public/exemplo.csv.
export const ITENS_EXEMPLO = Object.freeze([
  ['Alface crespa', 3.49, 420, 180],
  ['Alface americana', 4.99, 260, 120],
  ['Alface roxa', 4.49, 120, 60],
  ['Rúcula', 3.99, 240, 110],
  ['Agrião', 3.99, 150, 70],
  ['Couve manteiga', 3.49, 210, 100],
  ['Cheiro-verde', 2.99, 380, 150],
  ['Espinafre', 5.49, 110, 50],
  ['Brócolis ninja', 8.99, 130, 60],
  ['Couve-flor', 7.99, 90, 40],
  ['Repolho verde', 5.99, 140, 60],
  ['Acelga', 6.49, 70, 30],
]);

/** CSV no padrão do Excel brasileiro: ";" separa colunas e "," é a vírgula decimal. */
export function gerarModeloCSV() {
  const linhas = [COLUNAS_OBRIGATORIAS.join(';')];
  for (const [produto, preco, volume, quantidade] of ITENS_EXEMPLO) {
    linhas.push([produto, preco.toFixed(2).replace('.', ','), volume, quantidade].join(';'));
  }
  return `${linhas.join('\n')}\n`;
}

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function formatoDo(nome, tipo) {
  const n = String(nome ?? '').toLowerCase();
  if (n.endsWith('.csv') || tipo === 'text/csv') return 'csv';
  if (n.endsWith('.xlsx') || tipo === TIPO_XLSX) return 'xlsx';
  return null;
}

// Excel no Windows costuma salvar CSV em Windows-1252; o resto do mundo usa UTF-8.
function decodificarTexto(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/**
 * Lê um .xlsx ou .csv (bytes) e devolve a lista de produtos.
 * Erros viram ErroPlanilha com mensagem pronta pra tela.
 */
export async function importarArquivo(bytes, nome, tipo = '') {
  const formato = formatoDo(nome, tipo);
  if (!formato) throw new ErroPlanilha('Formato não suportado. Use uma planilha .xlsx ou .csv.');

  const XLSX = await import('xlsx');
  let linhas;
  try {
    const dados = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const pasta =
      formato === 'csv'
        ? XLSX.read(decodificarTexto(dados).replace(/^\uFEFF/, ''), { type: 'string', raw: true })
        : XLSX.read(dados, { type: 'array' });
    const aba = pasta.Sheets[pasta.SheetNames[0]];
    linhas = XLSX.utils.sheet_to_json(aba, { header: 1, blankrows: true, defval: '', raw: true });
  } catch {
    throw new ErroPlanilha('Não consegui ler a planilha. Confira se o arquivo é um .xlsx ou .csv válido.');
  }
  return lerProdutos(linhas);
}
