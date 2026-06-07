# Road Edge Line Regression Audit

## Problem

After the first road-marking stability pass, the yellow lane divider became more stable, but continuous white edge lines still shimmered and could appear missing while the camera moved.

## Root cause

The continuous white line was rendered as a very thin flat plane near a raised dark shoulder voxel strip. On an isometric moving camera, that combination can create visible sub-pixel shimmer and occasional apparent dropout:

- the white edge line was thinner than the yellow divider,
- the adjacent dark shoulder was still a raised box,
- the shoulder side face could visually compete with the white edge line,
- the edge line lived near the road boundary where perspective aliasing is most visible.

## Fix

- Keep yellow center markings as flat polygon-offset planes.
- Render continuous white edge lines using dedicated low-profile raised geometry.
- Convert dark road shoulder strips from raised voxel boxes into flat shoulder planes.
- Lift edge lines slightly above the road surface with fixed render order and no shadows.
- Keep the visual line narrow, but give it enough physical footprint to survive mobile/desktop camera motion.

## Rules preserved

- 2-lane road: white dashed divider only, no yellow center marking.
- 3-lane and 4-lane road: existing yellow divider logic preserved.
- Vehicles remain visually inside the white road-edge boundaries.
