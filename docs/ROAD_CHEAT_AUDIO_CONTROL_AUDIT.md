# Road, Cheat, Audio, and Control Audit

## No 1-lane roads
Traffic generation now clamps every road band to a minimum of 2 lanes. Verification also scans generated rows to ensure every traffic row uses only 2, 3, or 4 lanes.

## Secret cheat mode
Cheat mode was removed from the visible Settings UX. It now toggles only from the hidden shortcut `Ctrl + Alt + Shift + X`.

When active:
- the life HUD is hidden
- a `CHEAT MODE` chip appears instead

## Lazy music warm-up
The Start action now unlocks audio without starting music immediately. Then background idle work:
1. warms the music asset
2. resumes music later if allowed

This restores music playback while keeping the first visual frames lighter than direct media start in the Start click path.

## Mobile controls redesign
The arrow pad is now a set of individual circular buttons using SVG arrow icons, with larger touch targets than the visible control face.
