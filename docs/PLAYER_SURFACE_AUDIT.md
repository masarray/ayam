# Player Surface Height Audit

This patch prevents the chicken model from visually sinking into raised track and plank geometry.

## Root cause

The player group previously used `z = 0` for every terrain type. This works on grass and road, but rail and wood planks are raised voxel objects:

- rail top is roughly around z 10
- plank details are roughly around z 11-12
- the chicken foot mesh is modeled very close to the player origin

Because the player origin stayed at ground level, the chicken feet looked embedded inside rails or wooden planks.

## Fix

The engine now uses terrain-aware standing offsets:

- grass / road: default ground z
- rail: raised player z using `PLAYER_RAIL_STAND_Z`
- water plank: raised player z using `PLAYER_PLANK_STAND_Z`, following the plank while riding

Player hop animation now interpolates between the source and target surface heights, so movement from grass to rail or plank does not snap vertically at landing.

## Files changed

- `src/game/constants.js`
- `src/game/RoadQuestGame.js`

## Notes

Collision is still based on x/y gameplay position. The z offset is visual only, so it should not make the game easier or harder.
