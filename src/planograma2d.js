import { GELADEIRA } from './config.js';

const MARGEM_LADO = 8;
const CALHA = 22; // coluna dos números das prateleiras
const VAO_LINHAS = 0.6; // espaço entre prateleiras, em alturas de célula
const ALONGAMENTO_MAX = 1.8; // célula pode ser mais alta que larga pra facilitar o toque

const rgb = (cores, i) =>
  `rgb(${Math.round(cores[i] * 255)},${Math.round(cores[i + 1] * 255)},${Math.round(cores[i + 2] * 255)})`;

/**
 * Planograma frontal em grade (canvas 2D): 1 célula = coluna × camada, cor da alface da frente.
 * É o modo leve e o plano B quando o aparelho não tem WebGL.
 * `reservas()` diz quantos px no topo e na base estão cobertos pelos painéis flutuantes.
 */
export class Planograma2D {
  constructor(canvas, { aoTocar, reservas = () => ({ topo: 64, base: 60 }) }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.aoTocar = aoTocar;
    this.reservas = reservas;
    this.selecionada = null;
    canvas.addEventListener('click', (e) => {
      this.aoTocar(this.acharAlface(e.clientX, e.clientY));
    });
    this.observador = new ResizeObserver(() => this.desenhar());
    this.observador.observe(canvas);
  }

  atualizar(layout, cores) {
    this.layout = layout;
    this.cores = cores;
    this.desenhar();
  }

  selecionar(alfaceId) {
    this.selecionada = alfaceId;
    this.desenhar();
  }

  medidas() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const linhas = 5 * GELADEIRA.altura + 4 * VAO_LINHAS;
    const { topo: reservaTopo, base: reservaBase } = this.reservas();
    const alturaUtil = Math.max(40, h - reservaTopo - reservaBase);
    const cw = Math.max(2, (w - 2 * MARGEM_LADO - CALHA) / GELADEIRA.larguraTotal);
    const ch = Math.max(2, Math.min(cw * ALONGAMENTO_MAX, alturaUtil / linhas));
    const esquerda = (w - (CALHA + cw * GELADEIRA.larguraTotal)) / 2 + CALHA;
    const topo = reservaTopo + (alturaUtil - ch * linhas) / 2;
    return { w, h, cw, ch, esquerda, topo };
  }

  topoDaPrateleira(numero, m) {
    return m.topo + (numero - 1) * (GELADEIRA.altura + VAO_LINHAS) * m.ch;
  }

  desenhar() {
    if (!this.layout || this.canvas.hidden) return;
    const m = this.medidas();
    if (!m.w || !m.h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(m.w * dpr) || this.canvas.height !== Math.round(m.h * dpr)) {
      this.canvas.width = Math.round(m.w * dpr);
      this.canvas.height = Math.round(m.h * dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#e4e9e6';
    ctx.fillRect(0, 0, m.w, m.h);

    const { cw, ch } = m;
    const folga = cw > 6 ? 1 : 0.5;
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const pr of this.layout.prateleiras) {
      const y0 = this.topoDaPrateleira(pr.numero, m);
      ctx.fillStyle = '#1c2321';
      ctx.fillText(String(pr.numero), m.esquerda + pr.x0 * cw - CALHA / 2, y0 + (GELADEIRA.altura * ch) / 2);
      ctx.fillStyle = '#8aa096';
      ctx.fillRect(m.esquerda + pr.x0 * cw, y0 + GELADEIRA.altura * ch, pr.largura * cw, Math.max(2, ch * 0.15));
    }

    for (const a of this.layout.alfaces) {
      if (a.profundidade !== 0) continue; // vista frontal: só a alface da frente
      const { x, y } = this.retangulo(a, m);
      ctx.fillStyle = rgb(this.cores, a.id * 3);
      ctx.fillRect(x + folga / 2, y + folga / 2, cw - folga, ch - folga);
    }

    if (this.selecionada != null) {
      const a = this.layout.alfaces[this.selecionada];
      const pr = this.layout.prateleiras[a.prateleira - 1];
      const x = m.esquerda + (pr.x0 + a.indiceColuna) * cw;
      const y = this.topoDaPrateleira(a.prateleira, m);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 1.5, y - 1.5, cw + 3, GELADEIRA.altura * ch + 3);
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 1.5, y - 1.5, cw + 3, GELADEIRA.altura * ch + 3);
      const celula = this.retangulo(a, m);
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(celula.x + 1, celula.y + 1, cw - 2, ch - 2);
    }
  }

  retangulo(alface, m) {
    const pr = this.layout.prateleiras[alface.prateleira - 1];
    return {
      x: m.esquerda + (pr.x0 + alface.indiceColuna) * m.cw,
      y: this.topoDaPrateleira(alface.prateleira, m) + (GELADEIRA.altura - 1 - alface.camada) * m.ch,
    };
  }

  /** Alface da frente sob o ponto tocado, ou null. */
  acharAlface(clienteX, clienteY) {
    if (!this.layout) return null;
    const r = this.canvas.getBoundingClientRect();
    const px = clienteX - r.left;
    const py = clienteY - r.top;
    const m = this.medidas();
    for (const pr of this.layout.prateleiras) {
      const y0 = this.topoDaPrateleira(pr.numero, m);
      if (py < y0 || py >= y0 + GELADEIRA.altura * m.ch) continue;
      const indice = Math.floor((px - m.esquerda) / m.cw - pr.x0);
      if (indice < 0 || indice >= pr.largura) return null;
      const camada = GELADEIRA.altura - 1 - Math.floor((py - y0) / m.ch);
      const coluna = this.layout.colunas[pr.colunas[indice]];
      return coluna.alfaces.find((id) => {
        const a = this.layout.alfaces[id];
        return a.profundidade === 0 && a.camada === camada;
      });
    }
    return null;
  }

  /** Centro, em coordenadas de tela, da célula (prateleira, índice, camada). */
  celula(numero, indice, camada) {
    const m = this.medidas();
    const pr = this.layout.prateleiras[numero - 1];
    const coluna = this.layout.colunas[pr.colunas[indice]];
    const id = coluna.alfaces.find(
      (i) => this.layout.alfaces[i].profundidade === 0 && this.layout.alfaces[i].camada === camada,
    );
    const { x, y } = this.retangulo(this.layout.alfaces[id], m);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + x + m.cw / 2, y: r.top + y + m.ch / 2 };
  }
}
