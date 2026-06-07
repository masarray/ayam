# Juicy Blocker Bounce Fix

## Issue
The blocker bounce was not visible in normal play because the engine did not actually contain the `_triggerBlockedBump()` method implementation even though the UI callback and SFX wiring existed.

## Fix
- Added `_triggerBlockedBump()` to the engine.
- Blocked movement now creates a temporary non-scoring movement state.
- The chicken moves partway toward the blocked tile, rebounds back, and returns to the original tile.
- Added squash/stretch scale changes during the bump.
- Strengthened the procedural `blockedBounce()` SFX into a more obvious cartoon doeng.

## Freeze guard
The Start handler was not changed. No new heavy work was added to the Start path.
