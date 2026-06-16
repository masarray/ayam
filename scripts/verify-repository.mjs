import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readText(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function requireFile(relativePath) {
  if (!existsSync(path.join(root, relativePath))) {
    fail(`Missing required file: ${relativePath}`);
  }
}

function requireScript(packageJson, scriptName) {
  if (!packageJson.scripts?.[scriptName]) {
    fail(`package.json is missing scripts.${scriptName}`);
  }
}

function walkFiles(directory, collected = []) {
  const absoluteDirectory = path.join(root, directory);
  if (!existsSync(absoluteDirectory)) return collected;

  for (const entry of readdirSync(absoluteDirectory)) {
    const absolute = path.join(absoluteDirectory, entry);
    const relative = path.relative(root, absolute).replace(/\\/g, '/');
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
    const stat = statSync(absolute);
    if (stat.isDirectory()) walkFiles(relative, collected);
    else collected.push(relative);
  }
  return collected;
}

function verifyNoConflictMarkers() {
  const textExtensions = new Set(['.js', '.jsx', '.mjs', '.json', '.html', '.css', '.md', '.yml', '.yaml', '.svg', '.webmanifest']);
  const files = [
    ...walkFiles('src'),
    ...walkFiles('public'),
    ...walkFiles('.github'),
    ...walkFiles('scripts'),
    'package.json',
    'index.html',
    'README.md'
  ].filter((file, index, list) => list.indexOf(file) === index);

  for (const file of files) {
    if (!existsSync(path.join(root, file))) continue;
    if (!textExtensions.has(path.extname(file)) && !file.endsWith('.webmanifest')) continue;
    const content = readText(file);
    if (/^(<<<<<<<|=======|>>>>>>>)/m.test(content)) {
      fail(`Merge conflict marker found in ${file}`);
    }
  }
}

const packageJson = JSON.parse(readText('package.json'));

[
  'index.html',
  'package.json',
  'package-lock.json',
  'src/main.jsx',
  'src/App.jsx',
  'src/game/RoadQuestGame.js',
  'src/game/runtimeFixes.js',
  'public/sw.js',
  'public/site.webmanifest',
  '.github/workflows/ci.yml',
  '.github/workflows/deploy-pages.yml'
].forEach(requireFile);

['dev', 'build', 'preview', 'check', 'verify'].forEach((scriptName) => requireScript(packageJson, scriptName));

const swSource = readText('public/sw.js');
const cacheVersion = swSource.match(/CACHE_VERSION\s*=\s*['"]v([^'"]+)['"]/u)?.[1];
if (!cacheVersion) {
  fail('public/sw.js is missing CACHE_VERSION.');
} else if (cacheVersion !== packageJson.version) {
  fail(`public/sw.js CACHE_VERSION v${cacheVersion} does not match package.json version ${packageJson.version}.`);
}

const ciWorkflow = readText('.github/workflows/ci.yml');
const pagesWorkflow = readText('.github/workflows/deploy-pages.yml');
if (!ciWorkflow.includes('npm run verify')) warn('CI workflow does not run npm run verify.');
if (!ciWorkflow.includes('npm run build')) warn('CI workflow does not run npm run build.');
if (!pagesWorkflow.includes('npm run verify')) warn('Deploy workflow does not run npm run verify.');
if (!pagesWorkflow.includes('npm run build')) warn('Deploy workflow does not run npm run build.');

verifyNoConflictMarkers();

warnings.forEach((message) => console.warn(`Warning: ${message}`));

if (errors.length > 0) {
  console.error('Repository verification failed:');
  errors.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log('Repository verification passed.');
