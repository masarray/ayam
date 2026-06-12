# CSS Ownership Phase 6 — Revive Quiz Fullscreen + Legacy Overlay Detach

Version: 3.5.30

## Problem fixed

Phase 5 moved PWA and badge overlays, but the revive quiz still shared the legacy `vc-overlay` primitive and the fullscreen rule only activated below `560px` width. On a portrait browser/PWA viewport around tablet-like CSS widths, the quiz fell back to a centered card with an internal scrollbar instead of a true fullscreen learning screen.

## Scope

This phase locks the revive quiz as a hard fullscreen modal and detaches active React overlays from the legacy `vc-overlay` class.

## Changes

- Removed `vc-overlay` from active overlay roots in `VoxelCrossing.jsx`.
- Kept active overlays on explicit owner classes such as:
  - `vc-screen-overlay`
  - `vc-revive-quiz-overlay`
  - `vc-revive-offer-overlay`
  - `vc-result-overlay`
- Changed revive quiz fullscreen behavior from narrow-width only to portrait-owned behavior.
- Added `vc-shell.portrait .vc-revive-quiz-overlay` rules so the quiz stays fullscreen even when the portrait viewport is wider than 560px.
- Removed visible quiz card/page scrollbars in portrait mode.
- Added a React runtime lock that calls `gameRef.current.suspendRuntime()` while the revive quiz is active.
- Added an immediate runtime suspend in `openReviveQuiz()` before async question loading begins.

## Ownership rule

`vc-overlay` is now treated as a legacy primitive only. New overlay JSX must not use it.

Use specific owner classes instead:

```txt
vc-screen-overlay
vc-quiz-overlay
vc-revive-quiz-overlay
vc-revive-offer-overlay
vc-result-overlay
vc-pwa-install-overlay
vc-badge-board-overlay
vc-badge-unlock-overlay
```

## Guardrail

`npm run verify` now rejects:

- `vc-overlay` usage in active `VoxelCrossing.jsx` overlay markup.
- revive quiz CSS that does not include the v3.5.30 fullscreen owner block.
- revive quiz code that does not hard-suspend the 3D runtime.
