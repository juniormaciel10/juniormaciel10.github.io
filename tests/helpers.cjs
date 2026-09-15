const { expect } = require('@playwright/test');
async function open(page, width = 1440) {
  await page.setViewportSize({ width, height: 960 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('body')).toHaveClass(/\bjs\b/);
  await expect(page.getByRole('heading', {level:1})).toBeVisible();
}
async function settle(page) {
  await page.waitForFunction(() => new Promise(resolve => {
    let last=scrollY, since=performance.now();
    function frame(){if(Math.abs(scrollY-last)>.5){last=scrollY;since=performance.now()}if(performance.now()-since>180)resolve(true);else requestAnimationFrame(frame)}
    frame();
  }));
}
async function jump(page, selector, block = 'center') {
  // O destino só deve ser alinhado depois que seu contêiner tiver a altura final.
  await page.waitForFunction(selector => !document.querySelector(selector)?.closest('[data-motion-changing]'), selector);
  await page.locator(selector).evaluate((element, block) => element.scrollIntoView({block,behavior:'instant'}), block);
  await settle(page);
  await page.waitForFunction(selector => {
    const element = document.querySelector(selector);
    const scene = element?.closest('[data-motion-scene]');
    return scene?.dataset.motionScene !== 'playing' && !element?.closest('[data-motion-changing]');
  }, selector);
}
module.exports = { open, settle, jump };
