# Road Width Alignment Audit

## Goal
Make the paved road feel wider so vehicle wheels remain visually inside the white edge markings.

## Fix
- Moved `ROAD_EDGE_LINE_INSET` from `4.25` to `2.7`.
- Moved `ROAD_EDGE_SHOULDER_INSET` from `1.65` to `0.95`.
- Kept all lane-count road-marking rules unchanged.

## Result
The drivable asphalt area inside the white boundary line is wider, so cars, pickups, buses, and trucks sit more naturally inside the road.
