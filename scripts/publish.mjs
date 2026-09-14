import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = await fs.realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const env = { ...process.env };
delete env.SITE_URL;
delete env.GITHUB_SHA;
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, stdio: 'inherit', env });
const read = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, encoding: 'utf8', env }).trim();
const assertClean = () => {
  if (read('git', ['branch', '--show-current']) !== 'main') throw new Error('A publicação deve partir da branch main.');
  if (read('git', ['status', '--porcelain'])) throw new Error('Revise e commite as alterações antes de publicar.');
};
assertClean();
const sourceCommit = read('git', ['rev-parse', 'HEAD']);
const repository = read('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Repositório inválido.');

run(process.execPath, ['scripts/build.mjs']);
const cli = path.join(path.dirname(require.resolve('@playwright/test/package.json')), 'cli.js');
run(process.execPath, [cli, 'test']);
assertClean();
if (read('git', ['rev-parse', 'HEAD']) !== sourceCommit) throw new Error('O commit mudou durante os testes. Execute novamente.');

const output = path.join(root, 'dist');
const manifest = JSON.parse(await fs.readFile(path.join(output, 'manifest.json'), 'utf8'));
if (manifest.commit !== sourceCommit) throw new Error('O build não corresponde ao commit verificado.');
const files = [...new Set([...Object.keys(manifest.files), 'manifest.json'])];
if (!files.includes('index.html') || !files.includes('.nojekyll')) throw new Error('Build incompleto.');
for (const file of files) {
  if (!/^(?:assets\/[\w./-]+|index\.html|\.nojekyll|manifest\.json)$/.test(file) || file.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`Arquivo fora do pacote público: ${file}`);
  }
  const data = await fs.readFile(path.join(output, file));
  const expected = manifest.files[file];
  if (file !== 'manifest.json' && (data.length !== expected.bytes || crypto.createHash('sha256').update(data).digest('hex') !== expected.sha256)) {
    throw new Error(`Arquivo alterado após o build: ${file}`);
  }
}

const cache = path.join(root, '.cache');
await fs.mkdir(cache, { recursive: true });
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
if (!samePath(await fs.realpath(cache), cache)) throw new Error('O cache não pode apontar para outro diretório.');
const temporaryBranch = `publish-${crypto.randomUUID()}`;
const worktree = path.resolve(cache, temporaryBranch);
if (!samePath(path.dirname(worktree), cache)) throw new Error('Diretório temporário inválido.');
try {
  await fs.lstat(worktree);
  throw new Error('O diretório temporário já existe.');
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const assertWorktree = async () => {
  if (!samePath(await fs.realpath(cache), cache) || !samePath(await fs.realpath(worktree), worktree) || !samePath(path.dirname(worktree), cache)) {
    throw new Error('O diretório temporário saiu do cache do projeto.');
  }
};

let added = false;
let orphan = false;
let deploymentCommit;
try {
  const existing = read('git', ['ls-remote', '--heads', 'origin', 'refs/heads/gh-pages']);
  let base = sourceCommit;
  if (existing) {
    run('git', ['fetch', 'origin', 'refs/heads/gh-pages']);
    base = read('git', ['rev-parse', 'FETCH_HEAD']);
  }
  run('git', ['worktree', 'add', '--detach', worktree, base]);
  added = true;
  await assertWorktree();
  if (existing) run('git', ['rm', '-r', '--ignore-unmatch', '--', '.'], worktree);
  else {
    run('git', ['switch', '--orphan', temporaryBranch], worktree);
    orphan = true;
  }
  for (const file of files) {
    const target = path.join(worktree, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(output, file), target);
  }
  run('git', ['-c', 'core.autocrlf=false', 'add', '--', ...files], worktree);
  if (read('git', ['diff', '--cached', '--name-only'], worktree)) {
    run('git', ['commit', '-m', `deploy: ${sourceCommit.slice(0, 12)}`], worktree);
  }
  deploymentCommit = read('git', ['rev-parse', 'HEAD'], worktree);
  run('git', ['push', 'origin', 'main']);
  run('git', ['push', 'origin', 'HEAD:refs/heads/gh-pages'], worktree);

  const pages = JSON.parse(read('gh', ['api', `repos/${repository}/pages`]));
  if (pages.build_type !== 'legacy' || pages.source?.branch !== 'gh-pages' || pages.source?.path !== '/') {
    execFileSync('gh', ['api', '--method', 'PUT', `repos/${repository}/pages`, '--input', '-'], {
      cwd: root, env, encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit'],
      input: JSON.stringify({ build_type: 'legacy', source: { branch: 'gh-pages', path: '/' } })
    });
    // Agenda a primeira publicação após mudar a origem do Pages.
    run('gh', ['api', '--method', 'POST', `repos/${repository}/pages/builds`]);
  }
} finally {
  if (added) {
    await assertWorktree();
    run('git', ['worktree', 'remove', '--force', worktree]);
  }
  if (orphan && read('git', ['branch', '--list', temporaryBranch])) run('git', ['branch', '-D', temporaryBranch]);
}
console.log(`Fonte publicada: ${sourceCommit}`);
console.log(`Build enviado ao GitHub Pages: ${deploymentCommit}`);
console.log('O site será atualizado quando o GitHub Pages concluir a publicação.');
