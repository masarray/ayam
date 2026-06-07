# Audio, Road Marking, Wheel, Train Flicker, and Life HUD Audit

This patch keeps the gameplay logic intact and focuses on small but important production-feel fixes.

## 1. Mobile audio not playing

The previous freeze-prevention patch moved audio unlock to idle work. That was too defensive for mobile browsers: sound playback and `AudioContext.resume()` need to be tied to a trusted user gesture. The fix keeps Start/Menu visually light but primes audio from a capture-phase `pointerdown` / `keydown` event before React state transitions.

What changed:

- `GameAudio.unlock()` no longer awaits `AudioContext.resume()` before starting music.
- Audio now records `userInteracted` before allowing music autoplay attempts.
- A capture listener primes audio from trusted pointer/key gestures.
- Scene rebuild, quiz fetch, localStorage writes, and media preload are still kept out of the Start/Menu critical visual path.

## 2. Road markings

The yellow center separator and continuous white road-side lines were visually too thick for the voxel scale. They are now thinner, cleaner, and less dominant.

## 3. Vehicle and train wheels

Wheels were slightly too small and looked visually attached to the body rather than carrying it.

What changed:

- Road vehicle wheels are slightly larger.
- Wheel center height is lifted so the tire bottom sits above the road surface.
- Grounding shadow/underbody strip is slightly raised.
- Train wheels are larger and aligned to the rail-head top surface.
- Rail head is slimmer and moved inward so it visually sits under the train wheels instead of cutting the side body.

## 4. Modern train flicker

The modern box/commuter train had small side elements close to rail and skirt surfaces. This can create visual fighting on mobile GPUs. Side accent strips were moved slightly outward and separated in Z, while the rail head was narrowed and moved under the wheels.

## 5. Life HUD

The life HUD now uses bare large hearts:

- no panel background,
- no border,
- no blur,
- 40px heart size.

This makes the HUD cleaner and lighter over WebGL.
