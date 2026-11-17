export const COLUNAS_OBRIGATORIAS = Object.freeze(['produto', 'preco', 'volume', 'quantidade']);

export class ErroPlanilha extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroPlanilha';
  }
}

/** "Preço " → "preco": sem acento, sem espaços nas pontas, minúsculo. */
export function normalizarCabecalho(texto) {
  return String(texto ?? '')
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/** Aceita 4.99, "4,99", "R$ 4,99", "1.234,50" e "1,234.50". Devolve NaN se não for número. */
export function lerNumero(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : NaN;
  if (typeof valor !== 'string') return NaN;
  let s = valor.replace(/R\$/gi, '').replace(/\s/g, '');
  if (!s) return NaN;
  const ultimaVirgula = s.lastIndexOf(',');
  const ultimoPonto = s.lastIndexOf('.');
  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    s = ultimaVirgula > ultimoPonto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (ultimaVirgula >= 0) {
    s = s.replace(',', '.');
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
  return Number(s);
}

function listarEmPortugues(itens) {
  const aspas = itens.map((i) => `"${i}"`);
  if (aspas.length === 1) return aspas[0];
  return `${aspas.slice(0, -1).join(', ')} e ${aspas[aspas.length - 1]}`;
}

function celulaVazia(valor) {
  return valor === undefined || valor === null || String(valor).trim() === '';
}

/**
 * Converte as linhas cruas da planilha (primeira linha = cabeçalho) em produtos.
 * Lança ErroPlanilha com uma mensagem pronta pra mostrar na tela.
 */
export function lerProdutos(linhas) {
  const inicio = linhas.findIndex((linha) => Array.isArray(linha) && linha.some((c) => !celulaVazia(c)));
  if (inicio < 0) throw new ErroPlanilha('A planilha está vazia.');

  const cabecalho = linhas[inicio].map(normalizarCabecalho);
  const faltando = COLUNAS_OBRIGATORIAS.filter((nome) => !cabecalho.includes(nome));
  if (faltando.length === 1) {
    throw new ErroPlanilha(`Falta a coluna obrigatória ${listarEmPortugues(faltando)} na planilha.`);
  }
  if (faltando.length > 1) {
    throw new ErroPlanilha(`Faltam as colunas obrigatórias ${listarEmPortugues(faltando)} na planilha.`);
  }
  const posicao = Object.fromEntries(COLUNAS_OBRIGATORIAS.map((nome) => [nome, cabecalho.indexOf(nome)]));

  const produtos = [];
  for (let i = inicio + 1; i < linhas.length; i++) {
    const linha = linhas[i] ?? [];
    const numeroLinha = i + 1;
    if (COLUNAS_OBRIGATORIAS.every((nome) => celulaVazia(linha[posicao[nome]]))) continue;

    const nome = String(linha[posicao.produto] ?? '').trim();
    if (!nome) throw new ErroPlanilha(`Linha ${numeroLinha}: "produto" está vazio.`);

    const produto = { produto: nome };
    for (const campo of ['preco', 'volume', 'quantidade']) {
      const bruto = linha[posicao[campo]];
      const numero = lerNumero(bruto);
      if (Number.isNaN(numero)) {
        throw new ErroPlanilha(
          `Linha ${numeroLinha}: "${campo}" precisa ser um número (veio "${String(bruto ?? '').trim()}").`,
        );
      }
      if (numero < 0) throw new ErroPlanilha(`Linha ${numeroLinha}: "${campo}" não pode ser negativo.`);
      produto[campo] = numero;
    }
    if (produto.quantidade <= 0) {
      throw new ErroPlanilha(`Linha ${numeroLinha}: "quantidade" precisa ser maior que zero.`);
    }
    produtos.push(produto);
  }

  if (produtos.length === 0) throw new ErroPlanilha('A planilha não tem nenhum produto.');
  return produtos;
}

function normalizadorMinMax(valores) {
  const min = Math.min(...valores);
  const faixa = Math.max(...valores) - min;
  return (v) => (faixa > 0 ? (v - min) / faixa : 0);
}

const EMPATE = 1e-12;

/**
 * Prioridade = 0,5·(1 − preço normalizado) + 0,5·(volume normalizado).
 * Devolve cópias ordenadas da maior pra menor prioridade; empate → maior volume.
 */
export function calcularPrioridades(produtos) {
  const normPreco = normalizadorMinMax(produtos.map((p) => p.preco));
  const normVolume = normalizadorMinMax(produtos.map((p) => p.volume));
  return produtos
    .map((p, indice) => ({
      ...p,
      indice,
      prioridade: 0.5 * (1 - normPreco(p.preco)) + 0.5 * normVolume(p.volume),
    }))
    .sort((a, b) => {
      if (Math.abs(b.prioridade - a.prioridade) > EMPATE) return b.prioridade - a.prioridade;
      if (b.volume !== a.volume) return b.volume - a.volume;
      return a.indice - b.indice;
    });
}
