# Movement Feel Audit

This audit focuses on map/camera feel, player hop timing, and touch responsiveness.

## Findings

- The camera target used to follow the player immediately while the camera position itself used frame-based lerp. On fast repeated moves, this could feel slightly floaty or uneven because the view direction snapped faster than the camera body.
- The movement easing used `easeOutCubic`, which starts very fast and slows near landing. It is responsive, but it can feel less natural for a hopping character because acceleration is not balanced.
- Touch input was committed on `pointerup` only. On mobile, this adds perceived delay because a swipe only becomes a move after the finger is released.

## Changes

- Added delta-time based camera smoothing using separate raw and smoothed camera targets.
- Smoothed both camera position and camera look target so the world scroll feels more stable.
- Changed player travel easing to `easeInOutCubic` for a more even hop arc.
- Slightly increased hop duration from `145ms` to `158ms` to reduce twitchiness without making the game feel slow.
- Added early swipe commit on `pointermove` once the swipe threshold is passed, while keeping `pointerup` as fallback.
- Added `pointercancel` cleanup to avoid stuck gesture state on mobile browsers.

## Expected feel

- Less map wobble during repeated forward movement.
- More stable camera scroll.
- Swipe response should feel earlier on touch screens.
- Movement remains grid-based and predictable for collision timing.

## Guardrails

- Gameplay logic remains tile-based.
- Collision timing still uses the existing player position and movement state.
- Font remains Sniglet.
- Asset and repo public-readiness work remains unchanged.
