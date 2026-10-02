import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dist = path.join(root, 'dist');

const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run(process.execPath, ['scripts/build-bundle.mjs']);
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'src'), { recursive: true });
fs.copyFileSync(path.join(root, 'index.html'), path.join(dist, 'index.html'));
fs.copyFileSync(path.join(root, 'src', 'style.css'), path.join(dist, 'src', 'style.css'));
fs.copyFileSync(path.join(root, 'src', 'app.bundle.js'), path.join(dist, 'src', 'app.bundle.js'));
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log('production site built in dist/');
