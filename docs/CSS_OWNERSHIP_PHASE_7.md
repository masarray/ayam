# CSS Ownership Phase 7 — Celebration Burst Ownership

Version: 3.5.31

## Problem fixed

The active reward burst still used legacy class names (`confetti-layer`, `confetti-piece`, and `piece-*`). That meant the confetti animation depended on historical CSS rules inside `legacy.css`, including older `!important` overrides and mixed top-fall/bottom-cannon implementations.

## Scope

This phase gives confetti and reward burst animation a dedicated owner file without touching the quiz, PWA lifecycle, gameplay engine, or revive flow.

## Changes

- Added `src/game/styles/celebrations.css`.
- Imported it from `src/game/styles/index.css`.
- Added `--vc-celebration-z` to `tokens.css`.
- Replaced active JSX classes:
  - `confetti-layer` → `vc-confetti-layer`
  - `confetti-piece` → `vc-confetti-piece`
  - `piece-*` → `vc-confetti-piece-*`
- Removed unused `CoinIcon()` helper that still carried the old `coin-icon-glyph` class.
- Added `npm run verify` guards so legacy confetti names cannot return to active JSX.
- Pruned the retired legacy confetti/coin-glyph selectors from `legacy.css` after moving the active implementation into the owner file.

## Ownership rule

Future celebration work belongs only in `celebrations.css`. Do not add confetti rules to `legacy.css`, `effects.css`, `hud.css`, or quiz/menu owner files.

## Next safe phase

The next cleanup should be a measured legacy deletion pass for retired confetti/PWA/badge/quiz selectors after screenshot validation, not another visual override layer.
