import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { coverageForDay, storyStateForProgress } from '../src/math.js';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const run = (command, args = []) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exit(result.status ?? 1);
  }
};

assert.equal(coverageForDay(29), 0.5);
assert.equal(coverageForDay(30), 1);
assert.ok(Math.abs(storyStateForProgress(0.82).coverage - 0.5) < 1e-6);
assert.ok(Math.abs(storyStateForProgress(0.91).coverage - 1) < 1e-6);

run(process.execPath, ['checks/story-check.mjs']);
run(process.execPath, ['checks/style-check.mjs']);
run(process.execPath, ['checks/webgl-check.mjs']);
run(process.execPath, ['checks/webgl-check.mjs', '--water']);
run(process.execPath, ['--check', 'src/app.bundle.js']);

for (const file of ['index.html', 'src/style.css', 'src/math.js', 'src/story.js', 'src/webgl.js', 'src/app.js', 'src/app.bundle.js']) {
  assert.ok(fs.existsSync(path.join(root, file)), `missing ${file}`);
  const source = read(file);
  assert.doesNotMatch(source, /https?:\/\//i, `${file} contains a remote runtime URL`);
  assert.doesNotMatch(source, /javascript\s*:/i, `${file} contains an unsafe URL`);
  assert.doesNotMatch(source, /(api[_-]?key|client[_-]?secret|private[_-]?key)\s*[:=]\s*['\"][^'\"]+/i, `${file} may contain a secret`);
}

for (const file of ['dist/index.html', 'dist/src/style.css', 'dist/src/app.bundle.js', 'dist/.nojekyll']) {
  assert.ok(fs.existsSync(path.join(root, file)), `build output missing ${file}`);
}

const html = read('index.html');
assert.match(html, /class="thinking-space"/);
assert.doesNotMatch(html, /data-answer=/);
assert.doesNotMatch(html, /<nav\b|<header\b|<footer\b/i);
assert.match(html, /<script defer src="\.\/src\/app\.bundle\.js"><\/script>/);
assert.doesNotMatch(read('src/app.bundle.js'), /^\s*(import|export)\s/m);

console.log('repository verification passed');
