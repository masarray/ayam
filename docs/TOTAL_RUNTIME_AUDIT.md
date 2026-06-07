# Total Runtime Audit — Tree Collision and Start Freeze

This audit fixes two user-visible regressions reported after the late-game tuning pass.

## 1. Late-game trees were still visually passable

Rows around score 80, 86, 91, and later grass rows can render decorative trees. The previous fix made the tree's exact tile solid, but the visual crown/trunk footprint still occupied neighbouring tiles in the isometric camera view. A child could stand on a neighbouring tile and visually appear to pass through the tree.

### Fix

Tree blockers now use a visual footprint:

- the tree core tile is blocked;
- adjacent visual-neighbour tiles are blocked on grass rows;
- dense forest rows keep a fallback so they do not accidentally become impossible walls;
- movement completion has a final blocked-tile guard for rapid queued input.

### Regression guard

`npm run verify` now checks generated rows up to row 180 and fails if:

- a visible tree core is not blocked;
- grass tree neighbouring footprint is not blocked;
- a generated tree row leaves too few playable open tiles.

## 2. Start button could still hitch/freeze

The previous fix removed `reset(true)` from the first Start button, but the start path could still do non-visual work on the same frame:

- audio context setup;
- sampled reward-audio preload;
- profile/localStorage badge writes;
- full restart rebuild after game over;
- heavy backdrop blur transition on weaker mobile GPUs.

### Fix

The first gameplay frame is now kept lean:

- `startGame()` starts the engine first;
- profile writes and audio unlock are deferred to idle time after the first rendered frame;
- `kids-yay.mp3` is no longer created/preloaded during Start;
- background music is not forced on the first Start frame and can resume from later user input;
- game-over restart worlds are prebuilt while the result card is open, so pressing `Main Lagi` does not synchronously rebuild the full scene;
- the renderer is warmed up after scene initialization;
- large mobile overlay backdrop blur is disabled for coarse pointer / small screens.

## Validation

```txt
npm ci                  OK
npm run verify          OK
npm run build           OK
npm audit --omit=dev    0 vulnerabilities
```

## Files changed

```txt
src/game/world.js
src/game/RoadQuestGame.js
src/game/VoxelCrossing.jsx
src/game/audio.js
src/game/VoxelCrossing.css
scripts/verify-repo.mjs
public/sw.js
package.json
package-lock.json
docs/TOTAL_RUNTIME_AUDIT.md
CHANGELOG.md
```
