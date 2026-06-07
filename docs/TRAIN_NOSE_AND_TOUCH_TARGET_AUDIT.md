# Train Nose and Touch Target Audit

## High-speed train shape
The bullet train nose and tail were rebuilt from stepped rounded box volumes instead of the old cone spike. This creates a broader aerodynamic silhouette closer to real modern high-speed trains.

## Yellow lines
The paired yellow center lines were moved closer together by reducing `yellowGap` from `3.5` to `2.4`.

## Mobile controls
Touch targets were enlarged to make the arrow pad easier for children to hit:
- base grid: 70×60 px per cell
- portrait mobile: 76×66 px per cell
- landscape mobile: 58×48 px per cell
- touch-action: manipulation

This follows the general best-practice direction of generous touch targets on mobile UI.
