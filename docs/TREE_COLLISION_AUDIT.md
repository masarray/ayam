# Tree Collision Audit

## Issue

A visible tree on decorated grass rows could be crossed by the player.

Forest rows already used tree positions as movement blockers, but decorated grass
rows rendered trees while keeping `blockers` empty. This created a visual/logic
mismatch: the tree looked solid, but `_canMoveTo()` still allowed the chicken to
enter the same tile.

## Fix

`generateGrassRow()` now mirrors visible tree positions into the row blocker set:

```js
const blockers = new Set(trees);
```

This keeps collision behavior consistent:

- visible tree = blocked tile
- no visible tree = passable tile
- central safe tiles remain excluded when grass decoration is generated

## Regression guard

`npm run verify` now checks generated rows up to row 140 and fails if any visible
tree tile is not included in the row blocker set.

## Gameplay impact

The fix only affects solid obstacle passability. It does not change camera tuning,
player height, train difficulty, audio, assets, or font.
