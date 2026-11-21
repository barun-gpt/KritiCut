#!/usr/bin/env node
/* Collect the Gradle outputs into dist/ with predictable file names.
 *
 * Gradle writes to android/app/build/outputs/{apk,bundle}/…; those paths and
 * names differ slightly between AGP versions and between signed and unsigned
 * release builds. This script finds whatever was produced and copies it to
 *   dist/kriticut-<version>-debug.apk
 *   dist/kriticut-<version>-release.apk            (signed)
 *   dist/kriticut-<version>-release-unsigned.apk   (no signing secrets)
 *   dist/kriticut-<version>-release.aab
 * The unsigned suffix matters: Android refuses to install an unsigned APK,
 * so the name should not look like a drop-in replacement for the signed one.
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join('android', 'app', 'build', 'outputs');
const DIST = 'dist';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = String(pkg.version || '1.0').trim();

const walk = dir =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
      })
    : [];

if (!fs.existsSync(OUT)) {
  console.error(`No build output at ${OUT} — did Gradle run?`);
  process.exit(1);
}

const apks = walk(path.join(OUT, 'apk'));
const bundles = walk(path.join(OUT, 'bundle'));

const first = (files, re) => files.find(f => re.test(f.split(path.sep).join('/')));
const debugApk = first(apks, /app-debug\.apk$/);
const signedApk = first(apks, /app-release\.apk$/);
const unsignedApk = first(apks, /app-release-unsigned\.apk$/);
const releaseApk = signedApk || unsignedApk;
const aab = first(bundles, /\.aab$/);

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

const copied = [];
const copy = (src, name) => {
  const dest = path.join(DIST, name);
  fs.copyFileSync(src, dest);
  copied.push({ name, size: fs.statSync(dest).size });
};

const releaseName = signedApk ? 'release' : 'release-unsigned';

if (debugApk) copy(debugApk, `kriticut-${version}-debug.apk`);
if (releaseApk) copy(releaseApk, `kriticut-${version}-${releaseName}.apk`);
if (aab) copy(aab, `kriticut-${version}-release.aab`);

if (!copied.length) {
  console.error(`No .apk or .aab found under ${OUT}.`);
  process.exit(1);
}

for (const file of copied) {
  console.log(`${file.name.padEnd(36)} ${(file.size / 1048576).toFixed(1)} MB`);
}
console.log(`release APK signed: ${signedApk ? 'yes' : 'no'}`);
