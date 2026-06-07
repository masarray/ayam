# Camera and Difficulty Tuning Audit

This pass focuses on user feedback that the map movement felt less smooth and that the score 82–86 section had too many fast trains.

## Camera movement

The camera now uses a Crossy-style row-locked follow model:

- the forward/back camera target follows the logical row instead of every sub-frame of the hop animation;
- horizontal camera movement is intentionally damped so left/right hops do not drag the whole map too much;
- row movement uses a slightly stronger target stiffness so progress feels snappier;
- hop duration is tuned to 150 ms for a more arcade-like response without making the game feel twitchy.

This should make the map feel more anchored, especially on mobile swipe input.

## Score 82–86 difficulty

The previous deterministic row generation around score 82–86 could stack rail rows too tightly. In one audit run, rows 81, 83, and 85 were all rail rows, all using bullet train profiles, and row 81 could spawn two bullet trains. That was too punishing for a kids learning game.

The generator now includes a mid-game rail relief window around rows 80–92:

- rail cooldown prevents repeated rail rows within a short lookback window;
- bullet train probability is heavily reduced in this band;
- bullet train speed is capped in this band if one appears;
- double-train spawn chance is reduced in this band.

The target is not to remove challenge, but to avoid a difficulty spike that feels unfair after a long successful run.

## Verification

Validated with:

```bash
npm ci
npm run verify
npm run build
npm audit --omit=dev
```

All checks passed in this tuning pass.
