const { test, expect } = require('@playwright/test');

async function ready(page) {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('html')).toHaveAttribute('data-intro-state', 'complete');
  await expect(page.locator('.route-guide')).toHaveAttribute('data-motion', /settled|held/, { timeout: 10000 });
}

async function visit(page, selector) {
  await page.locator(selector).evaluate(element => element.scrollIntoView({ behavior: 'instant', block: 'center' }));
  await expect(page.locator('.route-guide')).toHaveAttribute('data-motion', /settled|held/, { timeout: 10000 });
}

  test.describe('Indicador móvel', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test('As cores acompanham as superfícies e a localização continua acessível', async ({ page }) => {
      await ready(page);
      await expect(page.locator('.route-guide-symbol')).toHaveCSS('background-color', 'rgb(20, 33, 58)');
      for (const [selector, color, label] of [
        ['.document-copy', 'rgb(52, 83, 245)', 'Resumos'],
        ['.contact-surface', 'rgb(233, 238, 245)', 'Contato'],
      ]) {
        await visit(page, selector);
        await expect(page.locator('.route-guide-symbol')).toHaveCSS('background-color', color);
        await expect(page.locator('.route-guide-button')).toHaveAccessibleName('Localização na página: ' + label);
        await page.locator('.route-guide-button').tap();
        await expect(page.locator('.route-guide-tooltip')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('.route-guide-tooltip')).toBeHidden();
      }
      await expect(page.locator('.color-review-panel,[data-marker-choice]')).toHaveCount(0);
    });

    test('As imagens cobrem o quadrado, e o foco de teclado o traz à frente', async ({ page }) => {
      await ready(page);
      await page.keyboard.press('Tab');
      for (const selector of ['.art-screen-front img', '.main-screen img', '.sheet-front img']) {
        await visit(page, selector);
        const scene = page.locator(selector).locator('xpath=ancestor::*[@data-motion-scene][1]');
        if (await scene.count()) await expect(scene).toHaveAttribute('data-motion-scene', 'complete');
        const state = await page.locator(selector).evaluate(photo => {
          const guide = document.querySelector('.route-guide'), symbol = guide.querySelector('.route-guide-symbol');
          const image = photo.getBoundingClientRect(), main = document.querySelector('main').getBoundingClientRect();
          const x = image.left + image.width / 2, y = image.top + image.height / 2;
          const before = { transform: guide.style.transform, photoPointer: photo.style.pointerEvents, symbolPointer: symbol.style.pointerEvents };
          // Put the actual marker over the image to exercise paint order at an
          // overlap, independently of the current scroll target or easing.
          guide.style.transform = `translate3d(${x - main.left}px,${y - main.top}px,0)`;
          symbol.style.pointerEvents = 'auto'; photo.style.pointerEvents = 'auto';
          const covered = document.elementFromPoint(x, y) === photo;
          guide.querySelector('button').focus({ preventScroll: true });
          const focusedInFront = symbol.contains(document.elementFromPoint(x, y));
          guide.querySelector('button').blur();
          guide.style.transform = before.transform; photo.style.pointerEvents = before.photoPointer; symbol.style.pointerEvents = before.symbolPointer;
          return { covered, focusedInFront };
        });
        expect(state.covered, selector + ' deve cobrir o quadrado durante a passagem').toBe(true);
        expect(state.focusedInFront, 'O foco deve continuar visível sobre ' + selector).toBe(true);
      }
    });

    test('A iluminação fica limitada à tela e preserva o percurso ao rolar', async ({ page }) => {
      await ready(page);
      for (const selector of ['.hero', '.document-copy', '.contact-surface']) {
        await visit(page, selector);
        const result = await page.evaluate(() => {
          const windowSvg = document.querySelector('.story-thread-window');
          const local = windowSvg.querySelector('.story-window-progress');
          const original = document.querySelector('.story-thread-line');
          const origin = parseFloat(windowSvg.style.getPropertyValue('--window-origin'));
          const length = local.getTotalLength();
          let error = 0;
          for (let index = 0; index <= 20; index++) {
            const offset = length * index / 20;
            const a = local.getPointAtLength(offset), b = original.getPointAtLength(origin + offset);
            error = Math.max(error, Math.hypot(a.x - b.x, a.y - b.y));
          }
          return { height: windowSvg.getBoundingClientRect().height, maximum: innerHeight + 384, error };
        });
        expect(result.height).toBeLessThanOrEqual(result.maximum + 1);
        expect(result.error).toBeLessThan(1);
        const light = page.locator('.story-window-light');
        const before = await light.evaluate(element => getComputedStyle(element).strokeDashoffset);
        await page.waitForTimeout(300);
        expect(await light.evaluate(element => getComputedStyle(element).strokeDashoffset)).not.toBe(before);
      }
    });
  });
