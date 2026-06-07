# Menu Freeze Audit

## Symptom

After the Start freeze was fixed, opening the in-game Menu during an active run could still freeze the visual layer for several seconds on some mobile devices.

## Root cause

The Menu button path was not a pure UI transition. It still called `unlockAudio()` directly inside the click handler. On mobile browsers this can create or resume `AudioContext`, prepare media playback, and start background music in the same interaction where React is mounting the menu overlay. That is exactly the kind of main-thread / presentation-delay pattern that makes an interaction feel frozen.

The menu also sat above a continuously rendered WebGL canvas. Heavy glass blur over a live canvas can add GPU compositing pressure on weaker devices.

## Fix

- Removed direct audio unlock from `openMenu()`.
- Menu open now only pauses gameplay state and mounts the menu UI.
- `pauseGame({ keepStarted: true })` keeps the run state stable while the menu is open, avoiding unnecessary start-overlay churn.
- Audio unlock after resume/continue is deferred through `requestAnimationFrame` + idle task.
- `RoadQuestGame.pause()` now marks a UI-paused state so the engine throttles WebGL rendering behind the menu.
- Menu backdrop blur is disabled and replaced with a solid premium translucent panel to avoid expensive blur compositing over WebGL.

## Regression guard

`npm run verify` fails if `openMenu()` directly calls `unlockAudio()` again, or if the UI pause throttle is removed from the engine.
