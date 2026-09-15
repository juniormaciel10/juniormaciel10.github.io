import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { transform } from 'esbuild';

const root = await fs.realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const output = path.resolve(root, 'dist');
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Diretório de saída inválido.');
try {
  const resolved = await fs.realpath(output);
  if (resolved.toLowerCase() !== output.toLowerCase()) throw new Error('A saída não pode ser um link para outro diretório.');
} catch (error) { if (error.code !== 'ENOENT') throw error; }

const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const entries = ['index.html', ...JSON.parse(await fs.readFile(path.join(root, 'scripts/pages.json'), 'utf8'))];
if (new Set(entries).size !== entries.length || entries.some(file => !/^(?:index\.html|projetos\/[a-z0-9-]+\/index\.html)$/.test(file))) throw new Error('Página pública inválida.');
const pages = await Promise.all(entries.map(async file => {
  const html = (await fs.readFile(path.join(root, file), 'utf8')).replace(/\r\n/g, '\n');
  const directory = path.posix.dirname(file);
  const styles = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)];
  const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)];
  return { file, directory, html, styles, scripts };
}));
function sourcePath(directory, reference) {
  const file = path.posix.normalize(path.posix.join(directory, reference));
  if (!/^assets\/(?:css|js)\/[\w.-]+$/.test(file)) throw new Error('Fonte de estilo ou script inválida.');
  return file;
}
const stylePaths = [...new Set(pages.flatMap(page => page.styles.map(match => sourcePath(page.directory, match[1]))))];
const scriptPaths = [...new Set(pages.flatMap(page => page.scripts.map(match => sourcePath(page.directory, match[1]))))];
const sourceCss = (await Promise.all(stylePaths.map(file => fs.readFile(path.join(root, file), 'utf8')))).join('\n');
const sourceJs = (await Promise.all(scriptPaths.map(file => fs.readFile(path.join(root, file), 'utf8')))).join('\n;\n');
const css = (await transform(sourceCss, { loader: 'css', minify: true, charset: 'utf8', legalComments: 'inline', target: ['chrome111', 'firefox113', 'safari16.4'] })).code;
const js = (await transform(sourceJs, { loader: 'js', minify: true, charset: 'utf8', legalComments: 'inline', target: 'es2022' })).code;
const cssPath = `assets/css/site.${sha(css).slice(0, 12)}.css`;
const jsPath = `assets/js/site.${sha(js).slice(0, 12)}.js`;
for (const page of pages) {
  page.styles.forEach((match, index) => { page.html = page.html.replace(match[0], index === 0 ? `<link rel="stylesheet" href="${path.posix.relative(page.directory, cssPath)}">` : ''); });
  page.scripts.forEach((match, index) => { page.html = page.html.replace(match[0], index === 0 ? `<script src="${path.posix.relative(page.directory, jsPath)}" defer></script>` : ''); });
}

const files = new Set([
  '.nojekyll', 'assets/img/og.png', 'assets/img/mesa-hero.png', 'assets/img/mesa-real.png',
  'assets/fonts/ClashDisplay-FFL.txt', 'assets/fonts/ClashDisplay-SOURCE.txt', ...stylePaths, ...scriptPaths
]);
for (const file of JSON.parse(await fs.readFile(path.join(root, 'scripts/public-assets.json'), 'utf8'))) {
  if (!/^assets\/[\w./-]+$/.test(file) || file.split('/').some(part => part === '..' || part === '.')) throw new Error('Arquivo de compatibilidade inválido.');
  files.add(file);
}
function addReference(reference, relativeTo = '') {
  if (!reference || /^(?:[a-z]+:|\/\/|#)/i.test(reference)) return;
  const clean = decodeURIComponent(reference.split(/[?#]/)[0]);
  if (!clean) return;
  let target = path.posix.normalize(path.posix.join(relativeTo, clean));
  if (target.startsWith('../') || target.startsWith('/') || target.includes('\\')) throw new Error(`Referência fora do site: ${target}`);
  if (target === '.' || target === './') target = 'index.html';
  else if (clean.endsWith('/')) target = path.posix.join(target, 'index.html');
  if (target !== cssPath && target !== jsPath && !entries.includes(target)) files.add(target);
}
for (const page of pages) {
  for (const match of page.html.matchAll(/\b(?:src|href|poster)="([^"]+)"/g)) addReference(match[1], page.directory);
  for (const match of page.html.matchAll(/\bsrcset="([^"]+)"/g)) match[1].split(',').forEach(item => addReference(item.trim().split(/\s+/)[0], page.directory));
}
for (const match of css.matchAll(/url\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^)]*))\s*\)/g)) addReference(match[1] ?? match[2] ?? match[3], 'assets/css');

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
for (const file of files) {
  const source = path.resolve(root, file);
  if (!source.startsWith(root + path.sep)) throw new Error(`Arquivo fora do projeto: ${file}`);
  const target = path.join(output, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  if (/\.(?:css|js|json|txt|vtt)$/.test(file)) await fs.writeFile(target, (await fs.readFile(source, 'utf8')).replace(/\r\n/g, '\n'));
  else await fs.copyFile(source, target);
}
await fs.mkdir(path.join(output, 'assets/css'), { recursive: true });
await fs.mkdir(path.join(output, 'assets/js'), { recursive: true });
await fs.writeFile(path.join(output, cssPath), css);
await fs.writeFile(path.join(output, jsPath), js);
for (const page of pages) {
  await fs.mkdir(path.dirname(path.join(output, page.file)), { recursive: true });
  await fs.writeFile(path.join(output, page.file), page.html);
}

const commit = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const date = execFileSync('git', ['show', '-s', '--format=%cI', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const dirty = !!execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim();
const build = { commit, data: date, dirty, css: cssPath, js: jsPath };
await fs.writeFile(path.join(output, 'assets/build.json'), JSON.stringify(build, null, 2) + '\n');
const origin = 'https://juniormaciel10.github.io/';
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + entries.map(file => `  <url><loc>${origin}${file === 'index.html' ? '' : file.slice(0, -10)}</loc><lastmod>${date.slice(0, 10)}</lastmod></url>`).join('\n') + '\n</urlset>\n';
await fs.writeFile(path.join(output, 'sitemap.xml'), sitemap);
await fs.writeFile(path.join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}sitemap.xml\n`);
const outputs = [...files, ...entries, cssPath, jsPath, 'assets/build.json', 'sitemap.xml', 'robots.txt'];
const manifest = {};
for (const file of outputs) {
  const data = await fs.readFile(path.join(output, file));
  manifest[file] = { sha256: sha(data), bytes: data.length };
}
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({ commit, files: manifest }, null, 2) + '\n');
console.log(`Build: ${entries.length} páginas, ${outputs.length} arquivos; CSS ${Buffer.byteLength(css)} bytes; JS ${Buffer.byteLength(js)} bytes.`);
