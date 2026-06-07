import { existsSync, statSync } from 'node:fs';

const requiredFiles = [
  'README.md',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'index.html',
  'vite.config.js',
  'src/game/VoxelCrossing.jsx',
  'src/game/RoadQuestGame.js',
  'src/game/audio.js',
  'public/favicon.svg',
  'public/sw.js',
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
  'public/audio/mushroom-dance.ogg',
  '.github/workflows/deploy-pages.yml'
];

const missing = requiredFiles.filter((file) => !existsSync(file));
if (missing.length > 0) {
  console.error(`Missing required repository files:\n${missing.map((file) => `- ${file}`).join('\n')}`);
  process.exit(1);
}

const musicSize = statSync('public/audio/mushroom-dance.ogg').size;
if (musicSize < 1024) {
  console.error('Background music file looks too small or empty.');
  process.exit(1);
}

console.log('Repository verification passed.');
