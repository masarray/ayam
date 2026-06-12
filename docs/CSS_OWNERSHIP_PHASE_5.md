# CSS Ownership Phase 5 — PWA Install + Badge Overlays

Version: 3.5.29

## Scope

This phase moves the remaining PWA install prompt and badge overlay UI away from legacy class names into dedicated owner files.

## New owner files

- `src/game/styles/pwa.css`
  - `vc-pwa-install-overlay`
  - `vc-pwa-install-card`
  - `vc-pwa-install-orbit`
  - `vc-pwa-benefits`
  - `vc-pwa-install-actions`
  - `vc-pwa-install-primary`
  - `vc-pwa-install-later`

- `src/game/styles/badges.css`
  - `vc-badge-unlock-overlay`
  - `vc-badge-unlock-card`
  - `vc-badge-board-overlay`
  - `vc-badge-board-card`
  - `vc-badge-family-card`
  - `vc-badge-tile`

## Runtime hardening included

- Warm-caches `data/questionBanks.json`, `audio/mushroom-dance.mp3`, and `audio/kids-yay.mp3` after first idle.
- Adds a service-worker message contract: `AYAM_SD_WARM_CACHE`.
- Fixes Android background/back during impact by saving a snapshot and resuming from the safe saved state instead of returning to a stuck impact frame.
- Removes the duplicate Google Fonts import from legacy CSS. The global app shell now owns the single font import.

## Guardrail

`scripts/verify-repo.mjs` now rejects legacy PWA/badge class names in `VoxelCrossing.jsx` and checks the new owner-file imports.
