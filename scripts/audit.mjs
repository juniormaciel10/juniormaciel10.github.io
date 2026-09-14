import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
const url = process.argv[2] || 'http://127.0.0.1:4175/';
const port = await new Promise((resolve, reject) => {
  const server = net.createServer(); server.on('error', reject);
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
});
const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1'] });
try {
  const result = await lighthouse(url, { port, logLevel: 'error', output: ['json', 'html'], onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] });
  await fs.mkdir('artifacts', { recursive: true });
  await fs.writeFile(path.join('artifacts', 'lighthouse.json'), result.report[0]);
  await fs.writeFile(path.join('artifacts', 'lighthouse.html'), result.report[1]);
  console.log(JSON.stringify(Object.fromEntries(Object.entries(result.lhr.categories).map(([k,v]) => [k, v.score * 100]))));
} finally { await browser.close(); }
