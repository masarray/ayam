# PWA lifecycle hard pause fix

Version: 3.5.28

## Problem

Installed Android PWAs cannot reliably close themselves like a native APK. The bigger UX risk is that the player presses Home/Back, but the game loop or background music keeps running behind the screen.

## Fix

Ayam SD now treats Android Home/Back/background lifecycle events as a hard pause:

- `visibilitychange` hidden
- `pagehide`
- Chrome page lifecycle `freeze`
- `beforeunload` save/stop guard
- standalone PWA `popstate` back guard

The hard pause path now:

1. saves the current game state when gameplay is active,
2. cancels deferred resume/start/audio timers,
3. suspends the Three.js runtime loop via `RoadQuestGame.suspendRuntime()`,
4. force-stops BGM and media audio,
5. shows a calm pause screen when the app becomes visible again.

## Runtime ownership

`RoadQuestGame` now owns explicit runtime lifecycle methods:

- `suspendRuntime()` cancels the active `requestAnimationFrame` loop.
- `resumeRuntime()` restarts the loop without forcing gameplay.
- `start()`, `resume()`, `loadSaveState()`, and `continueAfterLife()` ensure the loop is available again after a hard pause.

This is intentionally separate from normal UI pause. Menu pause can keep a low-frequency paused render, while background pause stops the runtime completely.
