# Performance Audit

Ayam SD uses a small custom Three.js engine. The current runtime is safe for public use, but mobile performance depends on keeping GPU quality adaptive.

## Current production size

Approximate production build output:

- Total `dist`: about 3.5 MB
- Three.js chunk: about 511 KB uncompressed / 128 KB gzip
- React vendor chunk: about 190 KB uncompressed / 60 KB gzip
- Game app chunk: about 124 KB uncompressed / 36 KB gzip
- CSS: about 72 KB uncompressed / 16 KB gzip
- Question bank: about 1.9 MB
- Background music: about 619 KB after Vorbis recompression

## Engine profile

The game now detects a practical render profile at runtime:

- `mobile-light`: lower DPR cap, smaller shadow map, no antialias on low-end mobile devices
- `mobile-balanced`: moderate DPR cap and shadow map for normal mobile devices
- `desktop-premium`: premium but capped quality for desktop

This protects frame rate and battery while preserving the polished voxel look.

## First-load strategy

The service worker precaches only shell assets and icons. Large files such as the quiz bank and audio are cached on first use, not during initial install. This keeps first load lighter and avoids forcing several megabytes of network/cache work before the child can start playing.

## Notes for future changes

- Do not increase shadow map size casually. High shadow quality is expensive on mobile GPUs.
- Do not precache large audio or data files unless offline-first behavior is more important than first-load speed.
- Keep generated effects short-lived and disposed.
- Avoid adding image textures to the 3D world unless they are compressed and necessary.
