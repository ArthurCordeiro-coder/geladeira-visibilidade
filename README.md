# Geladeira · mapa de visibilidade

Simulador 3D de geladeira aberta de supermercado: mapa de calor de visibilidade e organização
automática de produtos a partir de uma planilha. Site 100% estático (Vite + JavaScript + Three.js +
SheetJS); tudo é calculado no navegador e nenhum dado sai do aparelho.

## Comandos

```bash
npm ci
npm run dev          # servidor local de desenvolvimento
npm test             # testes de lógica (Vitest)
npm run build        # gera dist/
npm run tamanho      # soma o gzip de dist/ e falha se passar de 1,5 MB
npm run test:e2e     # Playwright em 375×812 e 412×915 (gera screenshots/)
```

Se o Playwright não tiver o próprio Chromium baixado, use o do sistema:
`PW_CHROMIUM=/usr/bin/chromium npm run test:e2e`.

## Onde está cada regra

- `src/config.js` — medidas da geladeira e o objeto `CONFIG` com todos os pesos do mapa de calor.
- `src/layout.js` — prateleiras, 180 colunas e 1080 alfaces (coordenadas em u).
- `src/visibilidade.js` — fórmula V e normalização min-max.
- `src/produtos.js` — leitura das linhas da planilha, mensagens de erro e prioridade.
- `src/alocacao.js` — "Lotar geladeira" (maiores restos) e alocação gulosa em blocos contíguos.
- `src/planilha.js` — .xlsx/.csv via SheetJS, modelo CSV e os 12 itens do exemplo.
- `src/cena3d.js` — Three.js: uma `InstancedMesh` com as 1080 alfaces, OrbitControls, toque.
- `src/planograma2d.js` — vista frontal em grade (canvas 2D), também usada sem WebGL.

## Observações

- O SheetJS (`xlsx` 0.20.3) vem do CDN oficial da SheetJS e está em `vendor/`; a versão do
  registro npm (0.18.5) está desatualizada e tem falhas de segurança conhecidas.
- `window.__geladeira` expõe leituras (câmera, contagem de draw calls, posições na tela) usadas
  pelos testes de navegador. Não altera nada na tela.
- Na distância até o canto inferior direito, `d` é medida no plano frontal (x, y), do centro da
  alface até o canto de baixo à direita da prateleira 5.
