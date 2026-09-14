const { test, expect } = require('@playwright/test');
const crypto = require('node:crypto');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const titles = ['#titulo-trabalho', '#titulo-metodo', '#titulo-pratica', '#titulo-projetos', '#titulo-ciclo', '#p-resumos > h3', '#p-funil > h3', '#p-transcricao > h3', '#p-copy > h3', '#titulo-experiencia', '#titulo-contato'];
async function open(page, width = 1440) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('#quem-sou')).toHaveAttribute('data-entrada', 'concluida');
}
async function settle(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('lenis-smooth'))).toBe(false);
  await page.evaluate(() => new Promise(resolve => {
    let previous = scrollY, since = performance.now();
    (function frame() {
      if (Math.abs(scrollY - previous) > .5) { previous = scrollY; since = performance.now(); }
      if (performance.now() - since >= 150) resolve(); else requestAnimationFrame(frame);
    })();
  }));
}
async function jump(page, selector) {
  await settle(page);
  await page.locator(selector).evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
}

test('Build restrito ao site, com CSS e JS identificados por hash', async ({ page, request }) => {
  const manifest = await (await request.get('/manifest.json')).json();
  const files = Object.keys(manifest.files);
  expect(files.some(f => /^(?:scripts|tests|tools|node_modules|\.github)\//.test(f))).toBe(false);
  expect(files.some(f => /package(?:-lock)?\.json|\.md$|\.env/.test(f))).toBe(false);
  for (const file of ['/package.json', '/scripts/build.mjs', '/tests/site.spec.js', '/README.md']) expect((await request.get(file)).status()).toBe(404);
  await open(page);
  const css = await page.locator('link[rel="stylesheet"]').evaluateAll(es => es.map(e => e.getAttribute('href')));
  const js = await page.locator('script[src]').evaluateAll(es => es.map(e => e.getAttribute('src')));
  expect(css).toHaveLength(1); expect(js).toHaveLength(1);
  expect(css[0]).toMatch(/^assets\/css\/site\.[0-9a-f]{12}\.css$/);
  expect(js[0]).toMatch(/^assets\/js\/site\.[0-9a-f]{12}\.js$/);
  for (const file of [...css, ...js]) {
    const response = await request.get('/' + file);
    expect(response.ok()).toBe(true);
    expect(sha(await response.body())).toBe(manifest.files[file].sha256);
  }
  const ids = await page.locator('[id]').evaluateAll(es => es.map(e => e.id));
  expect(new Set(ids).size).toBe(ids.length);
  expect(await page.locator('a[href^="#"]').evaluateAll(es => es.map(e => e.hash).filter(hash => !document.getElementById(hash.slice(1))))).toEqual([]);
});

test('Perfil, ordem dos projetos e acesso direto às entregas', async ({ page }) => {
  await open(page);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://juniormaciel10.github.io/');
  const profile = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  expect(profile['@type']).toBe('ProfilePage');
  expect(profile.mainEntity.name).toBe('Franklin Junior Maciel');
  expect(profile.mainEntity.sameAs).toHaveLength(2);
  expect(await page.locator('#projetos > article').evaluateAll(es => es.map(e => e.id))).toEqual(['p-ciclo', 'p-resumos', 'p-funil', 'p-transcricao', 'p-copy', 'experimentos']);
  await page.getByRole('link', { name: 'Ver projetos', exact: true }).click();
  await settle(page);
  await expect(page).toHaveURL(/#projetos$/);
  await expect(page.locator('#projetos')).toBeFocused();
  expect(await page.locator('#p-ciclo').evaluate(e => e.getBoundingClientRect().top + scrollY)).toBeLessThan(5200);
});

for (const width of [320, 390, 768, 1024, 1440, 1920]) {
  test(`Leitura e títulos progressivos sem overflow em ${width}px`, async ({ page }) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await open(page, width);
    for (const selector of titles) {
      await jump(page, selector);
      await expect(page.locator(selector)).toHaveAttribute('data-entrada', 'concluida');
      expect(await page.locator(selector).evaluate(e => getComputedStyle(e).visibility)).toBe('visible');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const rect = await page.locator(selector).boundingBox();
      expect(rect.x).toBeGreaterThanOrEqual(-1);
      expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1);
    }
    for (const selector of ['#p-ciclo .projeto-detalhes', '#p-resumos .projeto-detalhes', '#p-funil .projeto-detalhes']) {
      await jump(page, selector);
      await page.locator(selector + ' > summary').click();
      await expect(page.locator(selector)).toHaveJSProperty('open', true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    await jump(page, '#resumo-pdf');
    for (const selector of ['#resumo-pdf', '#resumo-download', '.projeto-detalhes > summary']) {
      const sizes = await page.locator(selector).evaluateAll(es => es.filter(e => e.getClientRects().length).map(e => e.getBoundingClientRect().height));
      expect(sizes.every(h => h >= 44)).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

test('Texto ampliado mantém leitura e controles', async ({ page }) => {
  await open(page, 390);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  for (const selector of ['#titulo', '#titulo-metodo', '#resumo-pdf', '#contato']) {
    await jump(page, selector);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test('PDF e DOCX corretos, com download por ação do visitante', async ({ page, request }) => {
  const pdf = await request.get('/assets/downloads/resumo-inteligencia-artificial.pdf');
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');
  expect(sha(await pdf.body())).toBe('0cb787ab5c935a464a85a11b66aeec8798e8cf464ab96be9186a0a4cc1eb3c3c');
  await open(page);
  await jump(page, '#resumo-download');
  const waiting = page.waitForEvent('download');
  await page.locator('#resumo-download').click();
  const download = await waiting;
  expect(download.suggestedFilename()).toBe('Resumo-Inteligencia-Artificial.docx');
  const docx = await request.get('/assets/downloads/resumo-inteligencia-artificial.docx');
  expect(sha(await docx.body())).toBe('3fdfc0a0def3e8e62299fc1ac91ff628c23433e83b684a2d4f96c73c48a44699');
});

test('Sem JavaScript: conteúdo, detalhes e arquivos permanecem disponíveis', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await expect(page.locator('#ci-rotacao')).not.toBeVisible();
    await page.locator('#p-resumos .projeto-detalhes > summary').click();
    await expect(page.locator('#p-resumos .projeto-detalhes')).toHaveJSProperty('open', true);
    await expect(page.locator('#resumo-pdf')).toHaveAttribute('href', /\.pdf$/);
    await expect(page.locator('[data-ci-tela]')).toHaveCount(6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  } finally { await context.close(); }
});
