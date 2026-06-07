# Start Button Freeze Audit

## Symptom

Some testers reported that the game could freeze for several seconds immediately after pressing **Mulai Main**.

## Root cause

The first-play flow was doing more work than needed. `RoadQuestGame` already prepares the Three.js scene when the component becomes ready, but the **Mulai Main** button still called:

```js
gameRef.current?.reset(true);
```

That forced the runtime to synchronously dispose and rebuild the whole world again: rows, trees, vehicles, trains, planks, shadows, and player mesh. On desktop this can be hidden by raw CPU/GPU power. On lower-end phones it can look like a 5-10 second freeze.

A second smaller contributor was that music playback was requested before gameplay had visually resumed. Large audio should not compete with the first interactive frame.

## Fix

The start button now uses the already prepared scene:

```js
gameRef.current?.start();
```

For the first run, this only unpauses the existing world. For game-over restart, `RoadQuestGame.start()` still resets internally when needed.

Music is also deferred until after the next animation frame, so the first visual response happens before background audio work.

## Guardrail

`npm run verify` now fails if the start button flow accidentally calls `reset(true)` again.

## Expected result

- Pressing **Mulai Main** should feel immediate.
- The first frame should not wait for a full scene rebuild.
- Restart after game over still creates a fresh run.
- Font, assets, collision, surface height, and difficulty tuning remain unchanged.
