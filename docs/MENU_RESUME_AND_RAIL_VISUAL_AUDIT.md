# Menu Resume and Rail Visual Audit

## Scope

This patch fixes two runtime/visual issues reported after the previous menu-freeze patch:

1. Opening the menu works, but closing it can leave the game screen visually frozen for several seconds.
2. Train wheels should visually sit on the raised white rail surface instead of looking detached or being cut by the rail block.

## Menu resume root cause

The previous fix made menu opening lighter, but menu closing still resumed the Three.js engine inside the same input handler that unmounted the React menu panel. On mobile browsers, that means the browser may need to process React layout/paint, WebGL rendering, and possibly audio scheduling in one interaction frame.

That can show up as a frozen game frame after the menu disappears.

## Menu resume fix

Menu close now uses a two-frame resume strategy:

1. Close the menu and remove the React overlay first.
2. Let the browser commit at least one paint.
3. Resume the WebGL engine on the next animation frame.

The resume path no longer unlocks or resumes audio. Audio remains lazy and is handled by movement/settings flows so the close-menu interaction stays visual-only.

## Rail visual root cause

The rail lane is a stylized voxel rail, not a physically scaled railway model. The old rail/wheel relationship had two problems:

- Rail heads were too close to the centerline of the train, so the white rail blocks could visually cut through the train body or lower skirt.
- Train wheels were not vertically aligned to the top of the raised rail head.

## Rail visual fix

The renderer now defines an explicit wheel-rail contact model:

- `RAIL_HEAD_Y_OFFSET = 19.5`
- `RAIL_HEAD_CENTER_Z = 5.6`
- `RAIL_HEAD_HEIGHT = 3.4`
- `TRAIN_WHEEL_CENTER_Z = railHeadTop + wheelHalfHeight`

This keeps the wheel blocks visually seated on top of the rail head. The rail stays raised and readable, while the wheels and bogies follow its surface instead of floating or being intersected by it.

## Guardrails

`npm run verify` now checks that:

- menu resume defers WebGL resume until after UI paint;
- menu resume does not directly unlock audio;
- raised rail-head geometry is used;
- train wheel contact constants are present;
- camera mode B constants remain unchanged;
- tree blockers remain proportional;
- road rows do not generate 1-lane traffic.

## Validation

```txt
npm ci                 OK
npm run verify         OK
npm run build          OK
npm audit --omit=dev   0 vulnerabilities
```
