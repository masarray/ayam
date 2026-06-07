# Road Marking Stability Audit

## Problem
Thin yellow center separators and white continuous edge lines could shimmer during camera movement, especially on mobile. The issue was not the road logic; it was render stability. Very thin, high-contrast voxel boxes can alias and appear to vibrate when the camera moves across sub-pixel boundaries.

## Fix
Road markings are now rendered as dedicated flat mark planes instead of tiny raised voxel boxes. They also use shadowless marking materials with polygon offset and fixed render order. This keeps the markings visually narrow while reducing z-fighting, side-face aliasing, and high-contrast shimmer.

## Preserved behavior
- Two-lane roads still use a white dashed divider only.
- Three- and four-lane roads keep their yellow separator logic.
- White edge lines remain close to the black asphalt edge so vehicles sit inside the road boundary.
- Gameplay and collision logic are unchanged.

## Guardrails
`npm run verify` checks that road marks use stable plane geometry, polygon offset, render order, and the 2-lane no-yellow rule.
