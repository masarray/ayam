# Audio Compression Audit

## Problem

`public/audio/mushroom-dance.mp3` was the largest user-facing media asset in the repository. The original file was about 2.2 MB for an 82-second stereo MP3 track. Even when audio playback is delayed away from the Start button, a large music file still increases runtime fetch/cache work on mobile devices.

## Fix

The background music was recompressed as MP3 while keeping the same filename and duration:

```txt
public/audio/mushroom-dance.mp3
Original: about 2.2 MB
Optimized: about 619 KB
Duration: 82.285714 seconds
Codec: MP3 stereo
```

The filename is unchanged so the game code, attribution notice, and deployment paths stay stable. The service worker cache version was bumped so browsers do not keep serving the old larger file after GitHub Pages deployment.

## Quality choice

The selected encode is intentionally conservative for a children's browser game background track: small enough for faster mobile load, but not pushed down to the most aggressive size where cymbals, transients, or looping background music can start to sound obviously thin.

## Guardrail

`npm run verify` checks that the music file remains present and below a practical public-repo budget.
