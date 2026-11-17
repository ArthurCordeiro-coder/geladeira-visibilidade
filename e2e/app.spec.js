import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

const PASTA_SHOTS = path.resolve('screenshots');
mkdirSync(PASTA_SHOTS, { recursive: true });

async function abrir(page) {
  await page.goto('./');
  await page.waitForFunction(() => window.__geladeira?.pronto === true, null, { timeout: 30_000 });
}

async function foto(page, testInfo, nome) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(PASTA_SHOTS, `${testInfo.project.name}-${nome}.png`) });
}

async function semRolagemHorizontal(page) {
  const sobra = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sobra).toBeLessThanOrEqual(0);
}

/** Elementos interativos visíveis menores que 44×44 px. */
async function alvosPequenos(page) {
  return page.evaluate(() => {
    const seletor = 'button, a[href], input:not([type=file]), select, textarea, label.botao, [role=tab]';
    return [...document.querySelectorAll(seletor)]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !el.closest('[hidden]');
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { el: el.id || el.textContent.trim().slice(0, 30) || el.outerHTML.slice(0, 60), w: r.width, h: r.height };
      })
      .filter((a) => a.w < 44 || a.h < 44);
  });
}

/** Textos visíveis com fonte menor que 14 px. */
async function textosPequenos(page) {
  return page.evaluate(() => {
    const pequenos = [];
    const caminhante = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (caminhante.nextNode()) {
      const no = caminhante.currentNode;
      if (!no.textContent.trim()) continue;
      const el = no.parentElement;
      if (!el || el.closest('[hidden], script, style')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const tamanho = parseFloat(getComputedStyle(el).fontSize);
      if (tamanho < 14) pequenos.push({ texto: no.textContent.trim().slice(0, 30), tamanho });
    }
    return pequenos;
  });
}

async function conferirLayoutMovel(page) {
  await semRolagemHorizontal(page);
  expect(await alvosPequenos(page)).toEqual([]);
  expect(await textosPequenos(page)).toEqual([]);
}

async function toque(cdp, pontosPorPasso) {
  const [primeiro, ...resto] = pontosPorPasso;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: primeiro });
  for (const pontos of resto) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pontos });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

function passos(n, fn) {
  return Array.from({ length: n + 1 }, (_, i) => fn(i / n));
}

async function centroDoPalco(page) {
  const caixa = await page.locator('#palco').boundingBox();
  return { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2, caixa };
}

function arquivoXlsx(testInfo, nome, linhas) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), 'Produtos');
  const caminho = testInfo.outputPath(nome);
  mkdirSync(path.dirname(caminho), { recursive: true });
  writeFileSync(caminho, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  return caminho;
}

// Cada teste roda num contexto novo do navegador, então o localStorage começa vazio.
test.describe('geladeira no celular', () => {
  test('abre lotada com o exemplo: 1080 alfaces numa InstancedMesh, 1 draw call, pixelRatio ≤ 2', async ({
    page,
  }, testInfo) => {
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    page.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
    await abrir(page);

    const malha = await page.evaluate(() => window.__geladeira.malhaAlfaces());
    expect(malha).toEqual({ instanciada: true, quantidade: 1080, malhasDeAlface: 1 });
    expect(await page.evaluate(() => window.__geladeira.drawCallsAlfaces())).toBe(1);
    const pr = await page.evaluate(() => window.__geladeira.pixelRatio());
    expect(pr).toBeLessThanOrEqual(2);
    expect(pr).toBe(Math.min(testInfo.project.use.deviceScaleFactor, 2));

    await expect(page.locator('#fonte')).toContainText('exemplo.csv');
    await expect(page.locator('#tabela-resultado tbody tr')).toHaveCount(12);
    expect(erros).toEqual([]);
    await foto(page, testInfo, '01-mapa-de-calor-3d');
  });

  test('layout mobile: vista ~60% da altura, sem rolagem horizontal, toques ≥ 44px e texto ≥ 14px', async ({
    page,
  }, testInfo) => {
    await abrir(page);
    const { visor, janela } = await page.evaluate(() => ({
      visor: document.querySelector('#visor').getBoundingClientRect().height,
      janela: window.innerHeight,
    }));
    expect(visor / janela).toBeGreaterThan(0.55);
    expect(visor / janela).toBeLessThan(0.65);

    await conferirLayoutMovel(page);
    for (const aba of ['Resultado', 'Ajustes', 'Planilha']) {
      await page.getByRole('tab', { name: aba }).click();
      await conferirLayoutMovel(page);
    }
    await page.getByRole('button', { name: 'Produtos', exact: true }).click();
    await conferirLayoutMovel(page);
    await page.getByRole('button', { name: '2D', exact: true }).click();
    await conferirLayoutMovel(page);
  });

  test('a gaveta de controles recolhe e a vista cresce', async ({ page }, testInfo) => {
    await abrir(page);
    const alca = page.locator('#alca');
    await expect(alca).toHaveAttribute('aria-expanded', 'true');
    await alca.click();
    await expect(alca).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#gaveta-conteudo')).toBeHidden();
    await page.waitForTimeout(400);
    const proporcao = await page.evaluate(
      () => document.querySelector('#visor').getBoundingClientRect().height / window.innerHeight,
    );
    expect(proporcao).toBeGreaterThan(0.85);
    await conferirLayoutMovel(page);
    await foto(page, testInfo, '06-gaveta-recolhida');
    await alca.click();
    await expect(page.locator('#gaveta-conteudo')).toBeVisible();
  });

  test('gestos de toque no 3D: girar com 1 dedo, pinça pra zoom, arrastar com 2 dedos', async ({ page }) => {
    await abrir(page);
    const cdp = await page.context().newCDPSession(page);
    const { x, y } = await centroDoPalco(page);
    const camera = () => page.evaluate(() => window.__geladeira.camera());

    const antes = await camera();
    await toque(cdp, passos(10, (t) => [{ x: x - 60 + 120 * t, y, id: 1 }]));
    await page.waitForTimeout(600);
    const depoisGiro = await camera();
    const deslocou = Math.hypot(...depoisGiro.posicao.map((v, i) => v - antes.posicao[i]));
    expect(deslocou).toBeGreaterThan(1);
    expect(depoisGiro.distancia).toBeCloseTo(antes.distancia, 0);

    await toque(
      cdp,
      passos(10, (t) => [
        { x: x - 30 - 70 * t, y, id: 1 },
        { x: x + 30 + 70 * t, y, id: 2 },
      ]),
    );
    await page.waitForTimeout(600);
    const depoisPinca = await camera();
    expect(depoisPinca.distancia).toBeLessThan(depoisGiro.distancia * 0.9);

    await toque(
      cdp,
      passos(10, (t) => [
        { x: x - 40, y: y - 60 * t, id: 1 },
        { x: x + 40, y: y - 60 * t, id: 2 },
      ]),
    );
    await page.waitForTimeout(600);
    const depoisArraste = await camera();
    const moveuAlvo = Math.hypot(...depoisArraste.alvo.map((v, i) => v - depoisPinca.alvo[i]));
    expect(moveuAlvo).toBeGreaterThan(0.5);
  });

  test('tocar numa alface mostra prateleira, posição, visibilidade e produto', async ({ page }, testInfo) => {
    await abrir(page);
    // a coluna mais visível: ponta direita da prateleira 2
    const alvo = await page.evaluate(() => window.__geladeira.projetarColuna(2, 39));
    await page.touchscreen.tap(alvo.x, alvo.y);
    const info = page.locator('#info');
    await expect(info).toBeVisible();
    await expect(info).toContainText('Prateleira 2');
    await expect(info).toContainText('Coluna 40 de 40');
    await expect(info).toContainText('Visibilidade');
    await expect(info).toContainText('%');
    await expect(info).toContainText('Alface crespa');
    await foto(page, testInfo, '02-toque-na-alface');
  });

  test('modo Produtos pinta uma cor por produto com legenda', async ({ page }, testInfo) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Produtos', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Produtos', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const itens = page.locator('#legenda .item-legenda');
    await expect(itens).toHaveCount(12);
    const cores = await itens.evaluateAll((els) =>
      els.map((el) => getComputedStyle(el.querySelector('.amostra')).backgroundColor),
    );
    expect(new Set(cores).size).toBe(12);
    await foto(page, testInfo, '03-produtos-3d');
  });

  test('vista 2D frontal funciona e responde ao toque', async ({ page }, testInfo) => {
    await abrir(page);
    await page.getByRole('button', { name: '2D', exact: true }).click();
    await expect(page.locator('#vista-2d')).toBeVisible();
    await expect(page.locator('#vista-3d')).toBeHidden();
    const alvo = await page.evaluate(() => window.__geladeira.celula2D(5, 0, 2));
    await page.touchscreen.tap(alvo.x, alvo.y);
    await expect(page.locator('#info')).toContainText('Prateleira 5');
    await expect(page.locator('#info')).toContainText('Coluna 1 de 30');
    await foto(page, testInfo, '04-planograma-2d');
    await page.getByRole('button', { name: 'Produtos', exact: true }).click();
    await foto(page, testInfo, '05-planograma-2d-produtos');
  });

  test('cartão de info e legenda não cobrem a geladeira (2D e 3D, modo Produtos)', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Produtos', exact: true }).click();
    const caixa = (sel) => page.locator(sel).boundingBox();

    // 3D: alface mais alta (prateleira 1, topo) e mais baixa (prateleira 5, base) entre a barra e a legenda
    const barra = await caixa('.barra-topo');
    let legenda = await caixa('#legenda');
    const alto = await page.evaluate(() => window.__geladeira.projetar(1, 0, 2));
    const baixo = await page.evaluate(() => window.__geladeira.projetar(5, 29, 0));
    expect(alto.y).toBeGreaterThan(barra.y + barra.height);
    expect(baixo.y).toBeLessThan(legenda.y);

    // 2D com o cartão aberto
    await page.getByRole('button', { name: '2D', exact: true }).click();
    const alvo = await page.evaluate(() => window.__geladeira.celula2D(3, 10, 1));
    await page.touchscreen.tap(alvo.x, alvo.y);
    await expect(page.locator('#info')).toBeVisible();
    const info = await caixa('#info');
    legenda = await caixa('#legenda');
    const topo2D = await page.evaluate(() => window.__geladeira.celula2D(1, 0, 2));
    const base2D = await page.evaluate(() => window.__geladeira.celula2D(5, 29, 0));
    expect(topo2D.y).toBeGreaterThan(info.y + info.height);
    expect(base2D.y).toBeLessThan(legenda.y);
  });

  test('alinhamento das prateleiras 4 e 5: esquerda | centro | direita', async ({ page }) => {
    await abrir(page);
    await page.getByRole('tab', { name: 'Ajustes' }).click();
    const x0 = () => page.evaluate(() => window.__geladeira.estado().x0Prateleira4);
    expect(await x0()).toBe(5);
    await page.getByRole('button', { name: 'Direita', exact: true }).click();
    expect(await x0()).toBe(10);
    await page.getByRole('button', { name: 'Esquerda', exact: true }).click();
    expect(await x0()).toBe(0);
  });

  test('o painel Ajustes recalcula o mapa ao vivo', async ({ page }, testInfo) => {
    await abrir(page);
    const vis = () => page.evaluate(() => window.__geladeira.visibilidadeColuna(5, 29));
    const antes = await vis();
    await page.getByRole('tab', { name: 'Ajustes' }).click();
    const controle = page.locator('#ajuste-canto-intensidade');
    await controle.fill('0');
    await expect.poll(vis).toBeGreaterThan(antes + 0.05);
    await expect(page.locator('#saida-canto-intensidade')).toHaveText('0,00');
    await foto(page, testInfo, '07-ajustes');
    await page.getByRole('button', { name: 'Restaurar padrão' }).click();
    await expect.poll(vis).toBeCloseTo(antes, 6);
  });

  test('Lotar geladeira desligado deixa de fora quem não cabe', async ({ page }, testInfo) => {
    await abrir(page);
    const caminho = arquivoXlsx(testInfo, 'grande.xlsx', [
      ['Produto', 'Preço', 'Volume', 'Quantidade'],
      ['Alface crespa', 3.49, 420, 600],
      ['Rúcula', 3.99, 240, 480],
      ['Acelga', 6.49, 70, 60],
    ]);
    await page.locator('#arquivo').setInputFiles(caminho);
    await expect(page.locator('#mensagem')).toContainText('3 produtos');
    await page.getByLabel('Lotar geladeira').uncheck();
    await page.getByRole('tab', { name: 'Resultado' }).click();
    await expect(page.locator('#nao-coube')).toBeVisible();
    await expect(page.locator('#nao-coube')).toContainText('Acelga');
    await expect(page.locator('#tabela-resultado tbody tr')).toHaveCount(2);
    await page.getByRole('tab', { name: 'Planilha' }).click();
    await page.getByLabel('Lotar geladeira').check();
    await page.getByRole('tab', { name: 'Resultado' }).click();
    await expect(page.locator('#nao-coube')).toBeHidden();
    await expect(page.locator('#tabela-resultado tbody tr')).toHaveCount(3);
  });

  test('importa .xlsx e .csv do modelo, lembra a lista e explica coluna faltando', async ({ page }, testInfo) => {
    await abrir(page);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Baixar modelo' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('modelo-produtos.csv');
    const caminhoCsv = testInfo.outputPath('modelo-produtos.csv');
    await download.saveAs(caminhoCsv);

    await page.locator('#arquivo').setInputFiles(caminhoCsv);
    await expect(page.locator('#mensagem')).toHaveText('Planilha "modelo-produtos.csv" carregada: 12 produtos.');

    const caminhoXlsx = arquivoXlsx(testInfo, 'modelo.xlsx', [
      ['PRODUTO', 'PREÇO', 'VOLUME', 'QUANTIDADE'],
      ['Alface crespa', 3.49, 420, 180],
      ['Rúcula', 3.99, 240, 110],
      ['Agrião', 3.99, 150, 70],
    ]);
    await page.locator('#arquivo').setInputFiles(caminhoXlsx);
    await expect(page.locator('#mensagem')).toHaveText('Planilha "modelo.xlsx" carregada: 3 produtos.');
    await expect(page.locator('#tabela-resultado tbody tr')).toHaveCount(3);

    const caminhoRuim = arquivoXlsx(testInfo, 'sem-volume.xlsx', [
      ['produto', 'preco', 'quantidade'],
      ['Couve', 3.49, 100],
    ]);
    await page.locator('#arquivo').setInputFiles(caminhoRuim);
    await expect(page.locator('#mensagem')).toHaveText('Falta a coluna obrigatória "volume" na planilha.');
    await expect(page.locator('#mensagem')).toHaveClass(/erro/);
    await expect(page.locator('#tabela-resultado tbody tr')).toHaveCount(3);
    await foto(page, testInfo, '08-erro-coluna-faltando');

    await page.reload();
    await page.waitForFunction(() => window.__geladeira?.pronto === true);
    await expect(page.locator('#tabela-resultado tbody tr')).toHaveCount(3);
    await expect(page.locator('#fonte')).toContainText('salva neste aparelho');
  });
});
