// Medidas fixas da geladeira. Unidade: 1 alface crespa = 1 u.
export const GELADEIRA = Object.freeze({
  larguraTotal: 40,
  profundidade: 2,
  altura: 3,
  // Largura de cada prateleira, de cima (1) pra baixo (5).
  larguras: Object.freeze([40, 40, 40, 30, 30]),
  // Só as prateleiras 4 e 5 (as de baixo) mudam de posição com o alinhamento.
  prateleirasAlinhaveis: Object.freeze([4, 5]),
});

export const ALINHAMENTOS = Object.freeze(['esquerda', 'centro', 'direita']);

// Todos os pesos do mapa de calor. O painel "Ajustes" edita uma cópia deste objeto.
export const CONFIG = Object.freeze({
  // Fator por prateleira, de cima (1) pra baixo (5).
  prateleiras: Object.freeze([0.75, 1.0, 0.9, 0.5, 0.3]),
  // H = base + inclinacao · xn  (a entrada da loja fica à direita).
  horizontal: Object.freeze({ base: 0.5, inclinacao: 0.5 }),
  profundidade: Object.freeze({ frente: 1.0, fundo: 0.6 }),
  camada: Object.freeze({ topo: 1.0, meio: 0.85, base: 0.7 }),
  // P = 1 − intensidade · exp(−d² / (2·sigma²)), só nas prateleiras 4 e 5.
  canto: Object.freeze({ intensidade: 0.95, sigma: 6 }),
});

export function copiarConfig(config = CONFIG) {
  return {
    prateleiras: [...config.prateleiras],
    horizontal: { ...config.horizontal },
    profundidade: { ...config.profundidade },
    camada: { ...config.camada },
    canto: { ...config.canto },
  };
}
