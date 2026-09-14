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
let html = (await fs.readFile(path.join(root, 'index.html'), 'utf8')).replace(/\r\n/g, '\n');
const styles = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)];
const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)];
const sourceCss = (await Promise.all(styles.map(m => fs.readFile(path.join(root, m[1]), 'utf8')))).join('\n');
const sourceJs = (await Promise.all(scripts.map(m => fs.readFile(path.join(root, m[1]), 'utf8')))).join('\n;\n');
const css = (await transform(sourceCss, { loader: 'css', minify: true, charset: 'utf8', legalComments: 'inline', target: ['chrome111', 'firefox113', 'safari16.4'] })).code;
const js = (await transform(sourceJs, { loader: 'js', minify: true, charset: 'utf8', legalComments: 'inline', target: 'es2022' })).code;
const cssPath = `assets/css/site.${sha(css).slice(0, 12)}.css`;
const jsPath = `assets/js/site.${sha(js).slice(0, 12)}.js`;
styles.forEach((match, index) => { html = html.replace(match[0], index === 0 ? `<link rel="stylesheet" href="${cssPath}">` : ''); });
scripts.forEach((match, index) => { html = html.replace(match[0], index === 0 ? `<script src="${jsPath}" defer></script>` : ''); });

const files = new Set([
  '.nojekyll', 'assets/img/og.png',
  'assets/img/mesa-hero.png', 'assets/img/mesa-real.png',
  'assets/fonts/ClashDisplay-FFL.txt', 'assets/fonts/ClashDisplay-SOURCE.txt',
  ...styles.map(m => m[1]), ...scripts.map(m => m[1])
]);
// URLs públicas da versão anterior, inclusive seus bundles, continuam válidas
// para visitantes com uma página anterior ainda em cache.
for (const file of JSON.parse(await fs.readFile(path.join(root, 'scripts/public-assets.json'), 'utf8'))) {
  if (!/^assets\/[\w./-]+$/.test(file) || file.split('/').some(part => part === '..' || part === '.')) throw new Error('Arquivo de compatibilidade inválido.');
  files.add(file);
}
function addReference(reference, relativeTo = '') {
  if (!reference || /^(?:[a-z]+:|\/\/|#)/i.test(reference)) return;
  const clean = decodeURIComponent(reference.split(/[?#]/)[0]);
  if (!clean || clean.startsWith('#')) return;
  const target = path.posix.normalize(path.posix.join(relativeTo, clean));
  if (target.startsWith('../') || target.startsWith('/') || target.includes('\\')) throw new Error(`Referência fora do site: ${target}`);
  if (target !== cssPath && target !== jsPath) files.add(target);
}
for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) addReference(match[1]);
for (const match of html.matchAll(/\bsrcset="([^"]+)"/g)) match[1].split(',').forEach(item => addReference(item.trim().split(/\s+/)[0]));
for (const match of css.matchAll(/url\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^)]*))\s*\)/g)) addReference(match[1] ?? match[2] ?? match[3], 'assets/css');

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
for (const file of files) {
  const source = path.resolve(root, file);
  if (!source.startsWith(root + path.sep)) throw new Error(`Arquivo fora do projeto: ${file}`);
  const target = path.join(output, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  if (/\.(?:css|js|json|txt)$/.test(file)) await fs.writeFile(target, (await fs.readFile(source, 'utf8')).replace(/\r\n/g, '\n'));
  else await fs.copyFile(source, target);
}
await fs.mkdir(path.join(output, 'assets/css'), { recursive: true });
await fs.mkdir(path.join(output, 'assets/js'), { recursive: true });
await fs.writeFile(path.join(output, cssPath), css);
await fs.writeFile(path.join(output, jsPath), js);
await fs.writeFile(path.join(output, 'index.html'), html);

const commit = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const date = execFileSync('git', ['show', '-s', '--format=%cI', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const dirty = !!execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim();
const build = { commit, data: date, dirty, css: cssPath, js: jsPath };
await fs.writeFile(path.join(output, 'assets/build.json'), JSON.stringify(build, null, 2) + '\n');
const outputs = [...files, 'index.html', cssPath, jsPath, 'assets/build.json'];
const manifest = {};
for (const file of outputs) {
  const data = await fs.readFile(path.join(output, file));
  manifest[file] = { sha256: sha(data), bytes: data.length };
}
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({ commit, files: manifest }, null, 2) + '\n');
console.log(`Build: ${outputs.length} arquivos; CSS ${Buffer.byteLength(css)} bytes; JS ${Buffer.byteLength(js)} bytes.`);
