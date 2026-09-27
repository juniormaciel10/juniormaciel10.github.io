import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { transform, build as compileModule } from 'esbuild';

const root = await fs.realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const output = path.resolve(root, 'dist');
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Diretório de saída inválido.');
try {
  const resolved = await fs.realpath(output);
  if (resolved.toLowerCase() !== output.toLowerCase()) throw new Error('A saída não pode ser um link para outro diretório.');
} catch (error) { if (error.code !== 'ENOENT') throw error; }

const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const entries = ['index.html', ...JSON.parse(await fs.readFile(path.join(root, 'scripts/pages.json'), 'utf8'))];
if (new Set(entries).size !== entries.length || entries.some(file => !/^(?:index\.html|(?:estudos|plataforma|jogos)\/index\.html|projetos\/[a-z0-9-]+\/index\.html)$/.test(file))) throw new Error('Página pública inválida.');
const pages = await Promise.all(entries.map(async file => {
  const html = (await fs.readFile(path.join(root, file), 'utf8')).replace(/\r\n/g, '\n');
  const directory = path.posix.dirname(file);
  const styles = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)];
  const allScripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)];
  const earlyScripts = allScripts.filter(match => /\bdata-inline\b/.test(match[0]));
  const scripts = allScripts.filter(match => !earlyScripts.includes(match));
  const sceneEntries = [...html.matchAll(/\bdata-saturn-module="([^"]+)"/g)];
  return { file, directory, html, styles, scripts, earlyScripts, earlyJsBytes: 0, sceneEntries, modules: [] };
}));
function sourcePath(directory, reference) {
  const file = path.posix.normalize(path.posix.join(directory, reference));
  if (!/^assets\/(?:css|js)\/[\w.-]+$/.test(file)) throw new Error('Fonte de estilo ou script inválida.');
  return file;
}
const stylePaths = [...new Set(pages.flatMap(page => page.styles.map(match => sourcePath(page.directory, match[1]))))];
const scriptPaths = [...new Set(pages.flatMap(page => page.scripts.map(match => sourcePath(page.directory, match[1]))))];
const earlyPaths = [...new Set(pages.flatMap(page => page.earlyScripts.map(match => sourcePath(page.directory, match[1]))))];
const earlyCache = new Map();
for (const page of pages) {
  for (const match of page.earlyScripts) {
    const source = sourcePath(page.directory, match[1]);
    if (!earlyCache.has(source)) {
      const data = (await transform(await fs.readFile(path.join(root, source), 'utf8'), { loader: 'js', minify: true, charset: 'utf8', target: 'es2022' })).code;
      if (Buffer.byteLength(data) > 6000) throw new Error('Inicializador de navegação excede 6 KB.');
      earlyCache.set(source, data.replace(/<\/script/gi, '<\\/script'));
    }
    const code = earlyCache.get(source);
    const opening = match[0].slice(0, match[0].indexOf('>') + 1).replace(/\s+src="[^"]+"/, '').replace(/\s+data-inline\b/, '');
    page.html = page.html.replace(match[0], opening + code + '</script>');
    page.earlyJsBytes += Buffer.byteLength(code);
  }
}
// A theme is bundled only with the pages that use it.
const bundles = new Map();
const bundleCache = new Map();
const sceneCache = new Map();
// The WebGL renderer stays outside the small, critical interface bundle.
for (const page of pages) {
  for (const match of page.sceneEntries) {
    const source = sourcePath(page.directory, match[1]);
    if (!source.endsWith('.js')) throw new Error('Módulo de cena inválido.');
    let modulePath = sceneCache.get(source);
    if (!modulePath) {
      const result = await compileModule({
        entryPoints: [path.join(root, source)], absWorkingDir: root,
        bundle: true, write: false, minify: true, charset: 'utf8',
        format: 'esm', platform: 'browser', target: 'es2022', legalComments: 'inline'
      });
      if (result.outputFiles.length !== 1) throw new Error('Saída inesperada do módulo 3D.');
      const data = result.outputFiles[0].text;
      modulePath = 'assets/js/scene.' + sha(data).slice(0, 12) + '.js';
      bundles.set(modulePath, data);
      sceneCache.set(source, modulePath);
    }
    page.modules.push(modulePath);
    page.html = page.html.replace(match[0], 'data-saturn-module="' + path.posix.relative(page.directory, modulePath) + '"');
  }
}
async function bundle(sources, loader) {
  const key = JSON.stringify([loader, sources]);
  if (bundleCache.has(key)) return bundleCache.get(key);
  const source = (await Promise.all(sources.map(file => fs.readFile(path.join(root, file), 'utf8')))).join(loader === 'css' ? '\n' : '\n;\n');
  const data = (await transform(source, { loader, minify: true, charset: 'utf8', legalComments: 'inline', target: loader === 'css' ? ['chrome111', 'firefox113', 'safari16.4'] : 'es2022' })).code;
  const file = 'assets/' + loader + '/site.' + sha(data).slice(0, 12) + '.' + loader;
  bundles.set(file, data);
  bundleCache.set(key, file);
  return file;
}
for (const page of pages) {
  page.css = await bundle(page.styles.map(match => sourcePath(page.directory, match[1])), 'css');
  page.js = await bundle(page.scripts.map(match => sourcePath(page.directory, match[1])), 'js');
  page.styles.forEach((match, index) => { page.html = page.html.replace(match[0], index === 0 ? '<link rel="stylesheet" href="' + path.posix.relative(page.directory, page.css) + '">' : ''); });
  page.scripts.forEach((match, index) => { page.html = page.html.replace(match[0], index === 0 ? '<script src="' + path.posix.relative(page.directory, page.js) + '" defer></script>' : ''); });
}

const files = new Set([
  '.nojekyll', 'assets/img/og.png', 'assets/img/mesa-hero.png', 'assets/img/mesa-real.png',
  'assets/fonts/ClashDisplay-FFL.txt', 'assets/fonts/ClashDisplay-SOURCE.txt', ...stylePaths, ...scriptPaths, ...earlyPaths
]);
if (sceneCache.size) files.add('assets/img/saturn/Three-LICENSE.txt');
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
  if (!bundles.has(target) && !entries.includes(target)) files.add(target);
}
for (const page of pages) {
  for (const match of page.html.matchAll(/\b(?:src|href|poster)="([^"]+)"/g)) addReference(match[1], page.directory);
  for (const match of page.html.matchAll(/\bdata-saturn-(?:surface|rings)="([^"]+)"/g)) addReference(match[1], page.directory);
  for (const match of page.html.matchAll(/\bsrcset="([^"]+)"/g)) match[1].split(',').forEach(item => addReference(item.trim().split(/\s+/)[0], page.directory));
}
for (const [file, css] of bundles) {
  if (!file.endsWith('.css')) continue;
  for (const match of css.matchAll(/url\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^)]*))\s*\)/g)) addReference(match[1] ?? match[2] ?? match[3], 'assets/css');
}

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
for (const [file, data] of bundles) await fs.writeFile(path.join(output, file), data);
for (const page of pages) {
  await fs.mkdir(path.dirname(path.join(output, page.file)), { recursive: true });
  await fs.writeFile(path.join(output, page.file), page.html);
}

const commit = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const date = execFileSync('git', ['show', '-s', '--format=%cI', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const dirty = !!execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim();
const build = { commit, data: date, dirty, css: pages[0].css, js: pages[0].js, pages: Object.fromEntries(pages.map(page => [page.file, { css: page.css, js: page.js, modules: page.modules, earlyJsBytes: page.earlyJsBytes }])) };
await fs.writeFile(path.join(output, 'assets/build.json'), JSON.stringify(build, null, 2) + '\n');
const origin = 'https://juniormaciel10.github.io/';
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + entries.map(file => `  <url><loc>${origin}${file === 'index.html' ? '' : file.slice(0, -10)}</loc><lastmod>${date.slice(0, 10)}</lastmod></url>`).join('\n') + '\n</urlset>\n';
await fs.writeFile(path.join(output, 'sitemap.xml'), sitemap);
await fs.writeFile(path.join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}sitemap.xml\n`);
const outputs = [...new Set([...files, ...entries, ...bundles.keys(), 'assets/build.json', 'sitemap.xml', 'robots.txt'])];
const manifest = {};
for (const file of outputs) {
  const data = await fs.readFile(path.join(output, file));
  manifest[file] = { sha256: sha(data), bytes: data.length };
}
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({ commit, files: manifest }, null, 2) + '\n');
console.log('Build: ' + entries.length + ' páginas, ' + outputs.length + ' arquivos; ' + bundles.size + ' bundles por conjunto de fontes.');
for (const page of pages) console.log(page.file + ': CSS ' + Buffer.byteLength(bundles.get(page.css)) + ' bytes; JS ' + Buffer.byteLength(bundles.get(page.js)) + ' bytes.');
