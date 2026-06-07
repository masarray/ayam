# Start Audio, Road Marking, and Start Tree Audit

## Problem found

After the previous audio fix, the game could freeze again when the child tapped **Mulai Main**. The regression came from the capture-phase `pointerdown` listener calling audio unlock with music enabled.

That path could create/resume audio and attempt to start the large `mushroom-dance.mp3` background track before the first gameplay frame was painted. On mobile browsers this can block the main thread long enough to feel like the game is frozen.

## Fix strategy

The Start tap must only do lightweight work:

- resume/prime Web Audio for procedural SFX,
- start the already prepared Three.js game,
- update visible React state,
- let the browser paint gameplay first.

The background music is now resumed later through a delayed idle path. The game also warms the music file best-effort after the app is ready, away from the Start button path.

## Visual changes

Road markings were retuned:

- yellow center lines are thinner,
- continuous white side lines are thinner,
- dashed lane marks are visually reduced without changing road gameplay.

Start grass rows now include decorative trees near the edges. Tree blockers still follow trunk/core tiles only, so the center start path stays open and the earlier “blocked too far from tree” problem does not return.

## Guardrails

`npm run verify` now checks that:

- capture-phase audio priming does not enable BGM,
- Start does not call `reset(true)`,
- thin road marking constants are present,
- start rows include trees,
- start row center tiles remain open.
