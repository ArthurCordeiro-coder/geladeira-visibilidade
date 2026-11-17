import './style.css';
import { CONFIG, copiarConfig } from './config.js';
import { simular, coresDasAlfaces } from './simulacao.js';
import { importarArquivo, gerarModeloCSV, NOME_MODELO, ITENS_EXEMPLO } from './planilha.js';
import { ErroPlanilha } from './produtos.js';
import { salvarLista, carregarLista } from './armazenamento.js';
import { corCalor, hexDe } from './cores.js';
import { Planograma2D } from './planograma2d.js';

const $ = (id) => document.getElementById(id);
const fmt = (v, casas = 2) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const pct = (v) => `${Math.round(v * 100)}%`;
const NOMES_CAMADA = ['base', 'meio', 'topo'];

const estado = {
  modo: 'calor',
  vista: '3d',
  alinhamento: 'centro',
  lotar: true,
  config: copiarConfig(CONFIG),
  produtos: [],
  fonte: '',
  selecionada: null,
};
let sim = null;
let cores = null;
let cena = null;

// ---------- painel Ajustes (gerado a partir do CONFIG) ----------

const faixa = (min, max, passo, casas = 2) => ({ min, max, passo, casas });
const GRUPOS_AJUSTE = [
  {
    titulo: 'Fator por prateleira',
    itens: [1, 2, 3, 4, 5].map((n) => ({
      id: `prateleira-${n}`,
      rotulo: `Prateleira ${n}`,
      ...faixa(0, 1.5, 0.05),
      ler: (c) => c.prateleiras[n - 1],
      gravar: (c, v) => (c.prateleiras[n - 1] = v),
    })),
  },
  {
    titulo: 'Fator horizontal: H = base + inclinação · x/40',
    itens: [
      { id: 'horizontal-base', rotulo: 'Base', ...faixa(0, 1, 0.05), chave: ['horizontal', 'base'] },
      { id: 'horizontal-inclinacao', rotulo: 'Inclinação', ...faixa(0, 1, 0.05), chave: ['horizontal', 'inclinacao'] },
    ],
  },
  {
    titulo: 'Profundidade',
    itens: [
      { id: 'profundidade-frente', rotulo: 'Frente', ...faixa(0, 1.5, 0.05), chave: ['profundidade', 'frente'] },
      { id: 'profundidade-fundo', rotulo: 'Fundo', ...faixa(0, 1.5, 0.05), chave: ['profundidade', 'fundo'] },
    ],
  },
  {
    titulo: 'Camada (altura dentro da prateleira)',
    itens: [
      { id: 'camada-topo', rotulo: 'Topo', ...faixa(0, 1.5, 0.05), chave: ['camada', 'topo'] },
      { id: 'camada-meio', rotulo: 'Meio', ...faixa(0, 1.5, 0.05), chave: ['camada', 'meio'] },
      { id: 'camada-base', rotulo: 'Base', ...faixa(0, 1.5, 0.05), chave: ['camada', 'base'] },
    ],
  },
  {
    titulo: 'Canto inferior direito (prateleiras 4 e 5)',
    itens: [
      { id: 'canto-intensidade', rotulo: 'Intensidade', ...faixa(0, 1, 0.01), chave: ['canto', 'intensidade'] },
      { id: 'canto-sigma', rotulo: 'Alcance σ (u)', ...faixa(1, 20, 0.5, 1), chave: ['canto', 'sigma'] },
    ],
  },
];
for (const grupo of GRUPOS_AJUSTE) {
  for (const item of grupo.itens) {
    if (item.chave) {
      const [a, b] = item.chave;
      item.ler = (c) => c[a][b];
      item.gravar = (c, v) => (c[a][b] = v);
    }
  }
}

function montarAjustes() {
  const raiz = $('ajustes');
  for (const grupo of GRUPOS_AJUSTE) {
    const fs = document.createElement('fieldset');
    fs.className = 'grupo';
    fs.innerHTML = `<legend>${grupo.titulo}</legend>`;
    for (const item of grupo.itens) {
      const linha = document.createElement('div');
      linha.className = 'ajuste';
      linha.innerHTML = `
        <label for="ajuste-${item.id}">${item.rotulo}</label>
        <input type="range" id="ajuste-${item.id}" min="${item.min}" max="${item.max}" step="${item.passo}">
        <output id="saida-${item.id}" for="ajuste-${item.id}"></output>`;
      const entrada = linha.querySelector('input');
      entrada.addEventListener('input', () => {
        item.gravar(estado.config, Number(entrada.value));
        $(`saida-${item.id}`).textContent = fmt(Number(entrada.value), item.casas);
        agendarRecalculo();
      });
      fs.appendChild(linha);
    }
    raiz.appendChild(fs);
  }
}

function sincronizarAjustes() {
  for (const grupo of GRUPOS_AJUSTE) {
    for (const item of grupo.itens) {
      const v = item.ler(estado.config);
      $(`ajuste-${item.id}`).value = String(v);
      $(`saida-${item.id}`).textContent = fmt(v, item.casas);
    }
  }
}

// ---------- cálculo e desenho ----------

let recalculoPendente = false;
function agendarRecalculo() {
  if (recalculoPendente) return;
  recalculoPendente = true;
  requestAnimationFrame(() => {
    recalculoPendente = false;
    recalcular();
  });
}

function recalcular() {
  sim = simular(estado);
  pintar();
  desenharResultado();
}

function pintar() {
  cores = coresDasAlfaces(sim, estado.modo);
  desenharLegenda();
  desenharInfo();
  cena?.atualizar(sim.layout, cores);
  cena?.reenquadrar();
  plano.atualizar(sim.layout, cores);
}

function desenharLegenda() {
  const legenda = $('legenda');
  if (estado.modo === 'calor') {
    const paradas = [0, 0.25, 0.5, 0.75, 1].map((v) => `${hexDe(corCalor(v))} ${v * 100}%`).join(', ');
    legenda.innerHTML = `
      <div class="escala">
        <span>Menos visão</span>
        <span class="barra" style="background: linear-gradient(90deg, ${paradas})"></span>
        <span>Mais visão</span>
      </div>`;
    return;
  }
  const itens = sim.alocacao.resultado
    .map(
      (p, i) =>
        `<li class="item-legenda"><span class="amostra" style="background:${hexDe(sim.paleta[i])}"></span>${escapar(p.produto)}</li>`,
    )
    .join('');
  const livres = [...sim.alocacao.dono].some((d) => d < 0)
    ? '<li class="item-legenda"><span class="amostra livre"></span>Livre</li>'
    : '';
  legenda.innerHTML = `<ul>${itens}${livres}</ul>`;
}

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function desenharResultado() {
  const { resultado, naoCoube, dono } = sim.alocacao;
  const ocupadas = [...dono].filter((d) => d >= 0).length;
  $('resumo').textContent = `${ocupadas} de ${dono.length} colunas ocupadas · ${resultado.length} ${
    resultado.length === 1 ? 'produto' : 'produtos'
  } na geladeira`;
  $('tabela-resultado').tBodies[0].innerHTML = resultado
    .map(
      (p, i) => `<tr>
        <td><span class="amostra" style="background:${hexDe(sim.paleta[i])}"></span>${escapar(p.produto)}</td>
        <td class="num">${fmt(p.prioridade)}</td>
        <td class="num">${p.colunas}</td>
        <td class="num">${pct(p.visibilidadeMedia)}</td>
      </tr>`,
    )
    .join('');
  $('nao-coube').hidden = naoCoube.length === 0;
  $('lista-nao-coube').innerHTML = naoCoube
    .map((p) => `<li>${escapar(p.produto)} — ${p.quantidade} u (${Math.ceil(p.quantidade / 6)} colunas)</li>`)
    .join('');
  $('dica-lotar').textContent = estado.lotar
    ? 'Ligado: as 180 colunas são divididas na proporção das quantidades (mínimo de 1 por produto).'
    : 'Desligado: cada produto ocupa quantidade ÷ 6 colunas; o que passar de 180 fica de fora.';
}

function desenharInfo() {
  const info = $('info');
  if (estado.selecionada == null || !sim) {
    info.hidden = true;
    return;
  }
  const a = sim.layout.alfaces[estado.selecionada];
  const pr = sim.layout.prateleiras[a.prateleira - 1];
  const dono = sim.alocacao.dono[a.coluna];
  const produto = dono >= 0 ? sim.alocacao.resultado[dono].produto : 'Livre (sem produto)';
  $('info-texto').innerHTML = `
    <p><strong>Prateleira ${a.prateleira}</strong> · Coluna ${a.indiceColuna + 1} de ${pr.largura} · ${
      a.profundidade === 0 ? 'frente' : 'fundo'
    }, camada ${NOMES_CAMADA[a.camada]}</p>
    <p>Visibilidade: <strong>${pct(sim.visibilidade.normalizado[a.id])}</strong> (média da coluna: ${pct(
      sim.visibilidade.porColuna[a.coluna],
    )}) · x = ${fmt(a.x, 1)} u</p>
    <p>Produto: <strong>${escapar(produto)}</strong></p>`;
  info.hidden = false;
}

function selecionar(alfaceId) {
  estado.selecionada = alfaceId ?? null;
  desenharInfo();
  cena?.selecionar(estado.selecionada);
  plano.selecionar(estado.selecionada);
}

// ---------- controles ----------

function marcarGrupo(seletor, atributo, valor) {
  document.querySelectorAll(seletor).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[atributo] === valor)));
}

function definirModo(modo) {
  estado.modo = modo;
  marcarGrupo('[data-modo]', 'modo', modo);
  pintar();
}

function definirVista(vista) {
  if (vista === '3d' && !cena) return;
  estado.vista = vista;
  marcarGrupo('[data-vista]', 'vista', vista);
  $('vista-3d').hidden = vista !== '3d';
  $('vista-2d').hidden = vista !== '2d';
  cena?.definirAtiva(vista === '3d');
  if (vista === '2d') plano.desenhar();
}

function definirAlinhamento(alinhamento) {
  estado.alinhamento = alinhamento;
  marcarGrupo('[data-alinhamento]', 'alinhamento', alinhamento);
  recalcular();
  cena?.selecionar(estado.selecionada);
}

function abrirAba(aba) {
  document.querySelectorAll('[role=tab]').forEach((t) => {
    const ativa = t === aba;
    t.setAttribute('aria-selected', String(ativa));
    t.tabIndex = ativa ? 0 : -1;
    $(t.getAttribute('aria-controls')).hidden = !ativa;
  });
}

function alternarGaveta() {
  const alca = $('alca');
  const abrir = alca.getAttribute('aria-expanded') !== 'true';
  alca.setAttribute('aria-expanded', String(abrir));
  $('alca-texto').textContent = abrir ? 'Recolher controles' : 'Abrir controles';
  $('gaveta-conteudo').hidden = !abrir;
  $('app').classList.toggle('recolhida', !abrir);
}

function mostrarMensagem(texto, erro = false) {
  const m = $('mensagem');
  m.textContent = texto;
  m.classList.toggle('erro', erro);
  m.hidden = !texto;
}

function definirProdutos(produtos, fonte) {
  estado.produtos = produtos;
  estado.fonte = fonte;
  $('fonte').textContent = `Lista atual: ${fonte} · ${produtos.length} ${produtos.length === 1 ? 'produto' : 'produtos'}.`;
  recalcular();
}

async function aoEscolherArquivo(e) {
  const entrada = e.target;
  const arquivo = entrada.files?.[0];
  if (!arquivo) return;
  mostrarMensagem('Lendo a planilha…');
  try {
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const produtos = await importarArquivo(bytes, arquivo.name, arquivo.type);
    const salvou = salvarLista(produtos);
    definirProdutos(produtos, `${arquivo.name} (${salvou ? 'salva neste aparelho' : 'não foi possível salvar neste aparelho'})`);
    mostrarMensagem(`Planilha "${arquivo.name}" carregada: ${produtos.length} ${produtos.length === 1 ? 'produto' : 'produtos'}.`);
  } catch (erro) {
    mostrarMensagem(
      erro instanceof ErroPlanilha ? erro.message : 'Não consegui ler a planilha. Tente salvar de novo como .xlsx ou .csv.',
      true,
    );
  } finally {
    entrada.value = '';
  }
}

function baixarModelo() {
  const blob = new Blob(['\uFEFF', gerarModeloCSV()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = NOME_MODELO;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function carregarListaInicial() {
  const salva = carregarLista();
  if (salva) return definirProdutos(salva, 'última lista importada (salva neste aparelho)');
  try {
    const resposta = await fetch(`${import.meta.env.BASE_URL}exemplo.csv`);
    if (!resposta.ok) throw new Error(String(resposta.status));
    const produtos = await importarArquivo(new Uint8Array(await resposta.arrayBuffer()), 'exemplo.csv');
    definirProdutos(produtos, 'exemplo.csv (lista de exemplo)');
  } catch {
    const produtos = ITENS_EXEMPLO.map(([produto, preco, volume, quantidade]) => ({ produto, preco, volume, quantidade }));
    definirProdutos(produtos, 'lista de exemplo');
  }
}

// ---------- início ----------

/** Pixels do visor cobertos pela barra de cima (e pelo cartão de info) e pela legenda. */
function reservasDoVisor({ comInfo }) {
  const visor = $('visor').getBoundingClientRect();
  let topo = document.querySelector('.barra-topo').getBoundingClientRect().bottom - visor.top + 8;
  const info = $('info');
  if (comInfo && !info.hidden) topo = Math.max(topo, info.getBoundingClientRect().bottom - visor.top + 8);
  const legenda = $('legenda').getBoundingClientRect();
  const base = legenda.height > 0 ? visor.bottom - legenda.top + 8 : 16;
  return { topo, base };
}

const plano = new Planograma2D($('vista-2d'), {
  aoTocar: selecionar,
  reservas: () => reservasDoVisor({ comInfo: true }),
});

async function iniciar() {
  montarAjustes();
  sincronizarAjustes();

  document.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => definirModo(b.dataset.modo)));
  document.querySelectorAll('[data-vista]').forEach((b) => b.addEventListener('click', () => definirVista(b.dataset.vista)));
  document
    .querySelectorAll('[data-alinhamento]')
    .forEach((b) => b.addEventListener('click', () => definirAlinhamento(b.dataset.alinhamento)));
  document.querySelectorAll('[role=tab]').forEach((t) => t.addEventListener('click', () => abrirAba(t)));
  $('alca').addEventListener('click', alternarGaveta);
  $('fechar-info').addEventListener('click', () => selecionar(null));
  $('arquivo').addEventListener('change', aoEscolherArquivo);
  $('baixar-modelo').addEventListener('click', baixarModelo);
  $('lotar').addEventListener('change', (e) => {
    estado.lotar = e.target.checked;
    recalcular();
  });
  $('restaurar').addEventListener('click', () => {
    estado.config = copiarConfig(CONFIG);
    sincronizarAjustes();
    recalcular();
  });

  try {
    const { Cena3D } = await import('./cena3d.js');
    cena = new Cena3D($('vista-3d'), {
      aoTocar: selecionar,
      reservas: () => reservasDoVisor({ comInfo: false }),
    });
  } catch (erro) {
    console.warn('3D indisponível, usando o planograma 2D:', erro);
    const botao = document.querySelector('[data-vista="3d"]');
    botao.disabled = true;
    botao.title = 'Este aparelho não tem WebGL; usando a vista 2D';
    definirVista('2d');
  }

  await carregarListaInicial();
  expor();
}

/** Ganchos de leitura pros testes de navegador (Playwright). */
function expor() {
  const colunaId = (p, i) => sim.layout.prateleiras[p - 1].colunas[i];
  const alfaceFrente = (p, i, camada) =>
    sim.layout.colunas[colunaId(p, i)].alfaces.find((id) => {
      const a = sim.layout.alfaces[id];
      return a.profundidade === 0 && a.camada === camada;
    });
  window.__geladeira = {
    pronto: true,
    malhaAlfaces: () => cena?.diagnostico() ?? null,
    drawCallsAlfaces: () => cena?.drawCallsAlfaces() ?? null,
    pixelRatio: () => cena?.renderer.getPixelRatio() ?? null,
    camera: () => cena?.estadoCamera() ?? null,
    projetarColuna: (p, i) => cena.projetarAlface(alfaceFrente(p, i, 2)),
    projetar: (p, i, camada) => cena.projetarAlface(alfaceFrente(p, i, camada)),
    celula2D: (p, i, camada) => plano.celula(p, i, camada),
    visibilidadeColuna: (p, i) => sim.visibilidade.porColuna[colunaId(p, i)],
    estado: () => ({
      modo: estado.modo,
      vista: estado.vista,
      alinhamento: estado.alinhamento,
      lotar: estado.lotar,
      produtos: estado.produtos.length,
      x0Prateleira4: sim.layout.prateleiras[3].x0,
    }),
  };
}

iniciar();
