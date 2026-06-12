# CSS Ownership Phase 4 — Shell, Overlay, Button, and Effects Primitives

Version: 3.5.26

## Goal

Move high-risk shared primitives out of the legacy CSS timeline so menu, revive, intro, and result overlays do not keep depending on generic legacy selectors.

## New owner files

- `src/game/styles/shell.css`
  - Owns `vc-app-shell`, `vc-game-host`, `vc-loading-overlay`, and `vc-loader-orb`.
- `src/game/styles/buttons.css`
  - Owns `vc-primary-button` and `vc-icon-button`.
- `src/game/styles/overlays.css`
  - Owns `vc-screen-overlay`, `vc-glass-card`, `vc-mini-badge`, `vc-intro-overlay`, and `vc-result-overlay`.
- `src/game/styles/effects.css`
  - Owns `vc-impact-stinger`, `vc-near-miss-stinger`, `vc-reward-aura`, `vc-star-reward`, and `vc-gold-star`.

## JSX ownership changes

Old primitive classes are no longer used by the main game overlay flow:

- `glass-card` → `vc-glass-card`
- `mini-badge` → `vc-mini-badge`
- `start-button` → `vc-primary-button`
- `icon-close` → `vc-icon-button`
- `impact-stinger` → `vc-impact-stinger`
- `near-miss-stinger` → `vc-near-miss-stinger`
- `vc-boot-loader` → `vc-loading-overlay`
- `loader-orb` → `vc-loader-orb`

`vc-overlay` remains temporarily as a legacy compatibility class, but new overlays now also use `vc-screen-overlay` as the owned primitive.

## Why this phase matters

The revive card regression happened because card-specific classes were migrated but the primitive overlay/card/button layer was still inherited from legacy CSS. This phase makes the shared primitives explicit so future quiz/menu/result fixes do not accidentally fight old selector history.

## Rule after this phase

Do not add new rules to `legacy.css`. If a shell, overlay, button, badge, loader, or result effect needs adjustment, edit the owner file only.
