const { test, expect } = require('@playwright/test');
const names = ['disponibilidade', 'disciplinas', 'formatos', 'retomada', 'tarefas', 'revisoes'];
const src = index => `assets/img/estudo-galeria-${names[index]}.png`;
async function openGallery(page, width = 1440) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/'); await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('#quem-sou')).toHaveAttribute('data-entrada', 'concluida');
  await page.locator('#ci-galeria').evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.mouse.move(5, 400);
  await expect(page.locator('#ci-galeria-imagem')).toHaveJSProperty('complete', true);
}
async function screen(page, index) {
  await expect(page.locator('#ci-galeria-imagem')).toHaveAttribute('src', src(index));
  await expect(page.locator('[data-ci-tela][aria-current]')).toHaveAttribute('href', src(index));
  await expect.poll(() => page.locator('#ci-galeria-imagem').evaluate(e => e.naturalWidth)).toBeGreaterThan(900);
}

test('Miniaturas leves e imagens completas preparadas apenas quando necessárias', async ({ page, request }) => {
  const full = new Set();
  page.on('request', r => { if (/estudo-galeria-.*\.png$/.test(r.url())) full.add(r.url().split('/').pop()); });
  await openGallery(page);
  const thumbs = await page.locator('[data-ci-tela] img').evaluateAll(es => es.map(e => e.getAttribute('src')));
  expect(thumbs.every(url => /estudo-thumb-.*\.webp$/.test(url))).toBe(true);
  let total = 0;
  for (const file of thumbs) total += (await (await request.get('/' + file)).body()).length;
  expect(total).toBeLessThan(30000);
  expect([...full].every(file => /disponibilidade|disciplinas/.test(file))).toBe(true);
  await page.locator('#ci-rotacao').click();
  await page.locator('[data-ci-tela]').nth(4).click();
  await screen(page, 4);
  await page.locator('#ci-ampliar').click();
  await expect(page.locator('#ci-dialog')).toBeVisible();
  await expect(page.locator('.ci-dialog-tela:not([aria-hidden]) img')).toHaveAttribute('src', src(4));
  await page.keyboard.press('ArrowLeft');
  await screen(page, 3);
  await page.keyboard.press('Escape');
  await expect(page.locator('#ci-ampliar')).toBeFocused();
});

test('Uma escolha posterior vence um carregamento anterior mais lento', async ({ page }) => {
  await page.route('**/estudo-galeria-retomada.png', async route => { await new Promise(r => setTimeout(r, 650)); await route.continue(); });
  await openGallery(page);
  await page.locator('[data-ci-tela]').nth(3).click();
  await page.locator('[data-ci-tela]').nth(5).click();
  await screen(page, 5);
  await page.waitForTimeout(800);
  await screen(page, 5);
  await expect(page.locator('#ci-galeria')).not.toHaveAttribute('aria-busy', 'true');
});

test('Falha de imagem é anunciada e a mesma miniatura permite tentar novamente', async ({ page }) => {
  await openGallery(page);
  await page.locator('#ci-rotacao').click();
  await page.route('**/estudo-galeria-retomada.png', route => route.abort('internetdisconnected'));
  await page.locator('[data-ci-tela]').nth(3).click();
  await expect(page.locator('#ci-galeria-status')).toContainText('Não foi possível carregar');
  await expect(page.locator('#ci-galeria-arquivo')).toHaveAttribute('href', src(3));
  await page.unroute('**/estudo-galeria-retomada.png');
  await page.locator('[data-ci-tela]').nth(3).click();
  await screen(page, 3);
  await expect(page.locator('#ci-galeria-status')).not.toContainText('Não foi possível');
});

for (const width of [390, 1440]) {
  test(`Autoplay, pausa, retomada e estabilidade da página em ${width}px`, async ({ page }) => {
    await openGallery(page, width);
    await expect(page.locator('#ci-galeria')).toHaveAttribute('data-rotacao', 'ativa');
    const y = await page.evaluate(() => scrollY);
    await screen(page, 1);
    expect(Math.abs(await page.evaluate(() => scrollY) - y)).toBeLessThan(2);
    await page.locator('#ci-rotacao').click();
    const paused = await page.locator('#ci-galeria-imagem').getAttribute('src');
    await page.waitForTimeout(5500);
    await expect(page.locator('#ci-galeria-imagem')).toHaveAttribute('src', paused);
    await page.locator('#ci-rotacao').click();
    await page.mouse.move(5, 400);
    await screen(page, 2);
    await page.locator('[data-ci-tela]').nth(5).click();
    await screen(page, 5);
    await page.locator('#ci-rotacao').focus();
    await page.mouse.move(5, 400);
    await screen(page, 0);
  });
}

test('Títulos e textura de projetos distantes não são construídos na abertura', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/'); await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('#quem-sou')).toHaveAttribute('data-entrada', 'concluida');
  expect(await page.locator('.linha-titulo-mask').count()).toBeLessThan(8);
  expect(await page.locator('#projetos .gutter span').count()).toBe(0);
  await page.getByRole('link', { name: 'Ver projetos', exact: true }).click();
  await expect(page.locator('#titulo-projetos')).toHaveAttribute('data-entrada', 'concluida');
  await expect.poll(() => page.locator('#projetos .gutter span').count()).toBeGreaterThan(0);
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.locator('#p-resumos').evaluate(e => e.scrollIntoView({ behavior: 'instant', block: 'start' }));
  await expect(page.locator('#p-resumos > h3')).toHaveAttribute('data-entrada', 'concluida');
  await expect(page.locator('#p-resumos .linha-titulo-mask')).toHaveCount(0);
});

test('Toque emulado: miniatura, ampliação, navegação e fechamento', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.goto('/'); await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('#quem-sou')).toHaveAttribute('data-entrada', 'concluida');
    await page.locator('#ci-rotacao').tap();
    await page.locator('[data-ci-tela]').nth(3).tap();
    await screen(page, 3);
    await page.locator('#ci-ampliar').tap();
    await expect(page.locator('#ci-dialog')).toBeVisible();
    await page.locator('#ci-proxima').tap();
    await screen(page, 4);
    await page.locator('#ci-dialog').getByRole('button', { name: 'Fechar', exact: true }).tap();
    await expect(page.locator('#ci-dialog')).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  } finally { await context.close(); }
});
