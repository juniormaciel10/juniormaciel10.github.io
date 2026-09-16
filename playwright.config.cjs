const { defineConfig } = require('@playwright/test');
const baseURL = process.env.SITE_URL || 'http://127.0.0.1:4175';
module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', testMatch: /marker-mobile\.spec\.js$/, use: { browserName: 'webkit' } }
  ],
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, browserName: 'chromium', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: process.env.SITE_URL ? undefined : { command: 'node scripts/serve.mjs --port 4175', url: baseURL, reuseExistingServer: false, timeout: 10000 }
});
