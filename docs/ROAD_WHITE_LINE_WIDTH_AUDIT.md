# ROAD_WHITE_LINE_WIDTH Audit

## Problem
`ROAD_WHITE_LINE_WIDTH` looked ineffective because the dashed white center/divider line used a fixed `roadDashMark` geometry height and a separate `ROAD_DASH_SCALE_Y` multiplier. Changing `ROAD_WHITE_LINE_WIDTH` therefore did not affect the dashed white road marking.

## Fix
The dashed white road mark geometry now uses:

```js
roadDashMark: new THREE.PlaneGeometry(22, ROAD_WHITE_LINE_WIDTH)
```

and the dash scale stays neutral:

```js
stripe.scale.set(0.86, 1, 1)
```

Now editing `ROAD_WHITE_LINE_WIDTH` directly changes the visible dashed white line thickness.
