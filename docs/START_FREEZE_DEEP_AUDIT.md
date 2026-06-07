# Start freeze deep audit

## Symptom

On some mobile browsers, pressing **Mulai Main** can visually freeze the game for several seconds even though the scene has already been prepared.

## Root cause found

The freeze was not only the background music file. The heavier issue was the **Start interaction path** still doing work that can block the first visual frame:

- global `pointerdown` audio priming also fired for the Start button;
- this could create/resume `AudioContext` during the same trusted tap that removes the intro overlay;
- the engine was resumed inside the same click handler that changed React overlay state;
- BGM was delayed, but the audio context itself could still be enough to cause mobile jank.

## Fix strategy

The Start button is now a pure visual transition:

1. It does not unlock audio.
2. It does not start, warm, preload, or play BGM.
3. It does not fetch quiz/audio/media.
4. It does not rebuild the Three.js scene.
5. It paints the game screen first.
6. The engine starts two `requestAnimationFrame()` ticks later.

Audio is now gated behind real gameplay input only:

- Start/Menu buttons are ignored by audio priming.
- Audio unlock only runs after the game has already started and the target is the canvas or the movement controls.
- BGM resume is pushed much later after gameplay has begun.

## Why this is safer

Mobile browsers are sensitive to main-thread work inside the same input event that must update the screen. Even small media initialization can delay the next paint. This patch keeps the Start tap lightweight and moves non-visual work outside the first frame.

## Files changed

- `src/game/VoxelCrossing.jsx`
- `scripts/verify-repo.mjs`
- `public/sw.js`
- `package.json`
- `package-lock.json`
