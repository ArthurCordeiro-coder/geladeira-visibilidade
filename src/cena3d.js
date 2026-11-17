import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { GELADEIRA } from './config.js';

const VAO = 0.45; // espaço visual entre prateleiras (a "tábua"); não entra no cálculo
const COR_FUNDO = 0xe4e9e6;
const MEIO_X = GELADEIRA.larguraTotal / 2;
const ALTURA_TOTAL = 5 * GELADEIRA.altura + 4 * VAO;

function aleatorio(semente) {
  let t = (semente + 0x6d2b79f5) >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Esfera achatada com rugas: lembra um pé de alface crespa. */
function criarGeometriaAlface() {
  let g = new THREE.IcosahedronGeometry(0.5, 3);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.attributes.position;
  const tons = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const ruga = Math.sin(11 * v.x + 1.3) * Math.sin(11 * v.y + 0.7) * Math.sin(11 * v.z + 2.1);
    const franja = Math.sin(23 * v.x) * Math.sin(19 * v.z + 0.5);
    const raio = 0.44 * (1 + 0.1 * ruga + 0.04 * franja);
    let y = v.y * raio * 0.86;
    if (y < -0.3) y = -0.3 + (y + 0.3) * 0.25; // base apoiada na prateleira
    pos.setXYZ(i, v.x * raio, y, v.z * raio);
    const claro = 0.72 + 0.28 * (0.5 + 0.5 * ruga);
    tons.set([claro, claro, claro], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(tons, 3));
  g.computeVertexNormals();
  return g;
}

export function baseDaPrateleira(numero) {
  return (5 - numero) * (GELADEIRA.altura + VAO);
}

function posicaoNoMundo(alface, alvo = new THREE.Vector3()) {
  return alvo.set(
    alface.x - MEIO_X,
    baseDaPrateleira(alface.prateleira) + alface.camada + 0.5,
    0.5 - alface.profundidade,
  );
}

function rotulo(texto) {
  const tela = document.createElement('canvas');
  tela.width = 128;
  tela.height = 128;
  const ctx = tela.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1c2321';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(64, 64, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1c2321';
  ctx.font = '700 76px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, 64, 69);
  const textura = new THREE.CanvasTexture(tela);
  textura.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura, depthWrite: false }));
  sprite.scale.set(1.7, 1.7, 1);
  return sprite;
}

export class Cena3D {
  constructor(container, { aoTocar, reservas = () => ({ topo: 64, base: 64 }) }) {
    this.container = container;
    this.aoTocar = aoTocar;
    this.reservas = reservas;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(COR_FUNDO);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', 'Geladeira em 3D: arraste pra girar, pinça pra zoom');

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.5, 600);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const sol = new THREE.DirectionalLight(0xffffff, 2.2);
    sol.position.set(14, 30, 26);
    this.scene.add(sol);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 8;
    this.controls.maxPolarAngle = Math.PI * 0.9;
    this.controls.target.set(0, ALTURA_TOTAL / 2, 0);
    this.controls.addEventListener('start', () => {
      this.interagiu = true;
    });
    this.controls.addEventListener('change', () => {
      this.sujo = true;
    });

    const total = 1080;
    this.malha = new THREE.InstancedMesh(
      criarGeometriaAlface(),
      new THREE.MeshLambertMaterial({ vertexColors: true }),
      total,
    );
    this.malha.name = 'alfaces';
    this.malha.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3);
    this.scene.add(this.malha);

    this.estrutura = new THREE.Group();
    this.scene.add(this.estrutura);

    // Destaque da coluna tocada: caixa branca translúcida + moldura azul grossa na face da frente.
    const caixaDestaque = new THREE.BoxGeometry(1.08, GELADEIRA.altura + 0.08, GELADEIRA.profundidade + 0.08);
    const azul = new THREE.MeshBasicMaterial({ color: 0x0b57d0 });
    const barra = (w, h, x, y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), azul);
      m.position.set(x, y, GELADEIRA.profundidade / 2 + 0.1);
      return m;
    };
    const e = 0.14; // espessura da moldura
    const meiaL = 0.54 + e / 2;
    const meiaA = GELADEIRA.altura / 2 + 0.04 + e / 2;
    this.destaque = new THREE.Group();
    this.destaque.add(
      new THREE.Mesh(
        caixaDestaque,
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }),
      ),
      barra(2 * meiaL + e, e, 0, meiaA),
      barra(2 * meiaL + e, e, 0, -meiaA),
      barra(e, 2 * meiaA, -meiaL, 0),
      barra(e, 2 * meiaA, meiaL, 0),
    );
    this.destaque.visible = false;
    this.scene.add(this.destaque);

    this.raycaster = new THREE.Raycaster();
    this.cor = new THREE.Color();
    this.alinhamento = null;
    this.ativa = true;
    this.sujo = true;
    this.interagiu = false;
    this.ligarToque();

    this.observador = new ResizeObserver(() => this.redimensionar());
    this.observador.observe(container);
    this.redimensionar();
    this.laco = this.laco.bind(this);
    this.raf = requestAnimationFrame(this.laco);
  }

  ligarToque() {
    const tela = this.renderer.domElement;
    const ativos = new Set();
    let inicio = null;
    let maxDedos = 0;
    tela.addEventListener('pointerdown', (e) => {
      ativos.add(e.pointerId);
      maxDedos = Math.max(maxDedos, ativos.size);
      if (ativos.size === 1) {
        inicio = { x: e.clientX, y: e.clientY, t: performance.now() };
        maxDedos = 1;
      }
    });
    const soltar = (e) => {
      ativos.delete(e.pointerId);
      if (e.type === 'pointerup' && inicio && ativos.size === 0 && maxDedos === 1) {
        const andou = Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y);
        if (andou < 8 && performance.now() - inicio.t < 600) this.tocar(e.clientX, e.clientY);
      }
      if (ativos.size === 0) inicio = null;
    };
    tela.addEventListener('pointerup', soltar);
    tela.addEventListener('pointercancel', soltar);
  }

  tocar(clienteX, clienteY) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clienteX - r.left) / r.width) * 2 - 1, -((clienteY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const [acerto] = this.raycaster.intersectObject(this.malha, false);
    this.aoTocar(acerto ? acerto.instanceId : null);
  }

  /** Posiciona as 1080 instâncias (uma vez por alinhamento) e aplica as cores. */
  atualizar(layout, cores) {
    if (layout.alinhamento !== this.alinhamento) {
      this.alinhamento = layout.alinhamento;
      this.layout = layout;
      const m = new THREE.Matrix4();
      const p = new THREE.Vector3();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const s = new THREE.Vector3();
      for (const a of layout.alfaces) {
        const rnd = aleatorio(a.id * 7919 + 17);
        posicaoNoMundo(a, p);
        e.set((rnd() - 0.5) * 0.25, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.25);
        q.setFromEuler(e);
        const largura = 0.95 + rnd() * 0.1;
        s.set(largura, 0.9 + rnd() * 0.12, largura);
        m.compose(p, q, s);
        this.malha.setMatrixAt(a.id, m);
      }
      this.malha.instanceMatrix.needsUpdate = true;
      this.malha.computeBoundingSphere();
      this.montarEstrutura(layout);
    }
    const destino = this.malha.instanceColor.array;
    for (let i = 0; i < cores.length; i += 3) {
      this.cor.setRGB(cores[i], cores[i + 1], cores[i + 2], THREE.SRGBColorSpace);
      destino[i] = this.cor.r;
      destino[i + 1] = this.cor.g;
      destino[i + 2] = this.cor.b;
    }
    this.malha.instanceColor.needsUpdate = true;
    this.sujo = true;
  }

  montarEstrutura(layout) {
    for (const filho of [...this.estrutura.children]) {
      filho.geometry?.dispose();
      filho.material?.map?.dispose();
      filho.material?.dispose();
      this.estrutura.remove(filho);
    }
    const linha = new THREE.LineBasicMaterial({ color: 0x4f6159, transparent: true, opacity: 0.35 });
    const tabua = new THREE.MeshBasicMaterial({ color: 0x8aa096, transparent: true, opacity: 0.3, depthWrite: false });
    const fundo = new THREE.MeshBasicMaterial({ color: 0xb9c8c1, transparent: true, opacity: 0.25, depthWrite: false });
    const { altura, profundidade } = GELADEIRA;
    for (const pr of layout.prateleiras) {
      const cx = pr.x0 + pr.largura / 2 - MEIO_X;
      const base = baseDaPrateleira(pr.numero);
      const caixa = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(pr.largura, altura, profundidade)),
        linha.clone(),
      );
      caixa.position.set(cx, base + altura / 2, 0);
      const chao = new THREE.Mesh(new THREE.BoxGeometry(pr.largura + 0.2, 0.12, profundidade + 0.3), tabua.clone());
      chao.position.set(cx, base - 0.07, 0.05);
      const costas = new THREE.Mesh(new THREE.PlaneGeometry(pr.largura, altura), fundo.clone());
      costas.position.set(cx, base + altura / 2, -profundidade / 2 - 0.02);
      const numero = rotulo(String(pr.numero));
      numero.position.set(pr.x0 - MEIO_X - 1.1, base + altura / 2, 0.6);
      this.estrutura.add(caixa, chao, costas, numero);
    }
    linha.dispose();
    tabua.dispose();
    fundo.dispose();
  }

  selecionar(alfaceId) {
    if (alfaceId == null || !this.layout) {
      this.destaque.visible = false;
    } else {
      const a = this.layout.alfaces[alfaceId];
      this.destaque.position.set(a.x - MEIO_X, baseDaPrateleira(a.prateleira) + GELADEIRA.altura / 2, 0);
      this.destaque.visible = true;
    }
    this.sujo = true;
  }

  /**
   * Câmera um pouco à direita e acima (o cliente chega pela direita), na menor distância
   * em que a geladeira inteira cabe entre a barra de cima e a legenda.
   */
  enquadrar() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    const alvo = new THREE.Vector3(0, ALTURA_TOTAL / 2, 0);
    const direcao = new THREE.Vector3(0.3, 0.18, 1).normalize();
    const cantos = [];
    for (const x of [-MEIO_X - 2.2, MEIO_X + 0.3]) {
      for (const y of [-0.2, ALTURA_TOTAL + 0.2]) {
        for (const z of [-1.1, 1.1]) cantos.push(new THREE.Vector3(x, y, z));
      }
    }
    const limiteX = 1 - 16 / w;
    const { topo, base } = this.reservas();
    const limiteY = 1 - (2 * Math.max(topo, base)) / h;
    const ponto = new THREE.Vector3();
    const cabe = (d) => {
      this.camera.position.copy(alvo).addScaledVector(direcao, d);
      this.camera.lookAt(alvo);
      this.camera.updateMatrixWorld();
      return cantos.every((c) => {
        ponto.copy(c).project(this.camera);
        return Math.abs(ponto.x) <= limiteX && Math.abs(ponto.y) <= Math.max(limiteY, 0.3) && ponto.z < 1;
      });
    };
    let perto = 5;
    let longe = 400;
    for (let i = 0; i < 32; i++) {
      const meio = (perto + longe) / 2;
      if (cabe(meio)) longe = meio;
      else perto = meio;
    }
    this.controls.target.copy(alvo);
    this.camera.position.copy(alvo).addScaledVector(direcao, longe);
    this.controls.maxDistance = longe * 2.5;
    this.controls.update();
  }

  /** Reenquadra (ex.: a legenda mudou de tamanho), a menos que a pessoa já tenha mexido na câmera. */
  reenquadrar() {
    if (this.interagiu) return;
    this.enquadrar();
    this.sujo = true;
  }

  redimensionar() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this.interagiu) this.enquadrar();
    this.sujo = true;
  }

  definirAtiva(ativa) {
    this.ativa = ativa;
    if (ativa) {
      this.redimensionar();
      if (!this.raf) this.raf = requestAnimationFrame(this.laco);
    } else if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  laco() {
    this.raf = requestAnimationFrame(this.laco);
    const mexeu = this.controls.update();
    if (mexeu || this.sujo) {
      this.renderer.render(this.scene, this.camera);
      this.sujo = false;
    }
  }

  // ---- diagnóstico (usado pelos testes de navegador) ----

  diagnostico() {
    let malhasDeAlface = 0;
    this.scene.traverse((o) => {
      if (o.isMesh && o.name === 'alfaces') malhasDeAlface++;
    });
    return { instanciada: this.malha.isInstancedMesh === true, quantidade: this.malha.count, malhasDeAlface };
  }

  /** Renderiza só as alfaces e conta os draw calls. */
  drawCallsAlfaces() {
    const visiveis = [this.estrutura.visible, this.destaque.visible];
    this.estrutura.visible = false;
    this.destaque.visible = false;
    this.renderer.render(this.scene, this.camera);
    const chamadas = this.renderer.info.render.calls;
    [this.estrutura.visible, this.destaque.visible] = visiveis;
    this.sujo = true;
    return chamadas;
  }

  estadoCamera() {
    return {
      posicao: this.camera.position.toArray(),
      alvo: this.controls.target.toArray(),
      distancia: this.camera.position.distanceTo(this.controls.target),
    };
  }

  /** Coordenadas de tela da alface da frente, no topo, de uma coluna. */
  projetarAlface(alfaceId) {
    const p = posicaoNoMundo(this.layout.alfaces[alfaceId]).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }
}
