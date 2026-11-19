#!/usr/bin/env node
/* Build the Capacitor web payload into www/.
 * The repo root stays the single source of truth; www/ is generated and git-ignored.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'www');

const FILES = [
  'index.html',
  'styles.css',
  'app.js',
  'filters.js',
  'text-features.js',
  'presets-data.js',
  'sw.js',
  'manifest.json',
  'icon.svg'
];
const DIRS = ['icons'];

for (const f of [...FILES, ...DIRS.map(d => d + '/')]) {
  if (!fs.existsSync(path.join(ROOT, f))) {
    console.error(`Missing required asset: ${f}`);
    process.exit(1);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const f of FILES) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
for (const d of DIRS) {
  fs.cpSync(path.join(ROOT, d), path.join(OUT, d), { recursive: true });
}

const files = fs.readdirSync(OUT, { recursive: true });
let bytes = 0;
for (const f of files) {
  const p = path.join(OUT, f);
  if (fs.statSync(p).isFile()) bytes += fs.statSync(p).size;
}
console.log(`Built www/ — ${files.length} files, ${(bytes / 1024).toFixed(1)} KB`);
