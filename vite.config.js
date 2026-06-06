import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';
const isUserOrOrgSite = repoName.endsWith('.github.io');
const githubPagesBase = process.env.GITHUB_ACTIONS && repoName && !isUserOrOrgSite ? `/${repoName}/` : '/';
const base = process.env.VITE_BASE_PATH || githubPagesBase;

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    open: true
  },
  preview: {
    open: true
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three';
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react-vendor';
          return undefined;
        }
      }
    }
  }
});
