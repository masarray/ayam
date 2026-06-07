# Mobile haptic, start frame, road, rail, and camera audit

This release is a targeted runtime-feel pass. It avoids changing the Sniglet typography, the main game identity, or the existing educational loop.

## What changed

### Mobile haptic feedback

- Added optional haptic vibration for mobile devices using `navigator.vibrate`.
- Haptics are deliberately short and restrained:
  - start tap
  - jump
  - blocked move
  - near miss
  - impact by traffic, train, or water
  - quiz correct/wrong
  - reward moment
- Added a Settings toggle: **Haptic vibration**.
- Unsupported browsers simply ignore the call, so desktop and unsupported iOS/Safari paths stay safe.

### Start button freeze path

The Start button must only do visual-first work:

1. trigger a tiny haptic pulse,
2. call `game.start()` on the already prepared scene,
3. hide overlays and enter gameplay.

It must not directly unlock audio, preload sampled media, fetch quiz data, rebuild the world, or show install prompts. Those jobs are deferred to movement/menu/idle moments so the first mobile gameplay frame is not blocked. Restart scene preparation is also moved behind the result card with a short idle timeout, so pressing **Mulai Main** after game over does not become the expensive rebuild moment.

### Tree blockers restored to trunk/core tiles

The previous wide visual footprint blocker was too aggressive. It made empty tiles beside a crown feel blocked even when the chicken was visibly far from the trunk.

Current rule:

- visible tree trunk/core tile = blocked,
- neighbouring crown-only tiles = decorative, not blocked.

This keeps movement fair and readable.

### Road generation

Single-lane roads are removed from the generated world. Traffic roads now use only:

- 2-lane road,
- 3-lane road,
- 4-lane road.

The verification script now fails if a generated traffic row has an unsupported lane count.

### Rail height

The white rail block was too tall and visually intersected train cars. Rail geometry was lowered to a low-profile track:

- rail mesh height reduced,
- sleeper mesh height reduced,
- rail z position lowered,
- player rail standing z retuned.

The train cars now read as sitting above the track instead of being cut by it.

### Camera mode B

Camera feel was moved from the previous row-locked/snappy mode to a softer child-friendly follow mode:

- `MOVE_DURATION = 166ms`
- `CAMERA_FOLLOW_STIFFNESS = 12.5`
- `CAMERA_TARGET_STIFFNESS = 13.5`

The camera follows the chicken smoothly with gentle lateral drift and less harsh row snapping.

## Guardrails added

`npm run verify` now checks:

- Start flow does not call `reset(true)`.
- Start flow does not call `unlockAudio()` directly.
- Haptic support exists behind a safe feature check.
- Traffic rows only use lane counts 2, 3, or 4.
- Camera mode B constants stay in the intended range.
- Rail geometry stays low-profile.
- Visible tree trunk tiles remain blocked.
