# Road Marking Alignment Audit

This pass keeps the road visual language closer to a real road while preserving the existing Ayam SD gameplay rhythm.

## What changed

- Two-lane roads now use a white dashed lane divider only.
- Two-lane roads no longer render yellow center markings.
- Three-lane and four-lane roads keep the existing yellow opposing-traffic divider logic.
- Continuous white edge lines have been moved closer to the asphalt edge.
- Road edge shoulder bands have been made slightly slimmer so the white edge line reads as the actual driving boundary.

## Design intent

Vehicles should read as driving inside the white edge lines, not floating outside the road boundary. The asphalt still has a dark visual edge, but the continuous white edge line now sits nearer that edge so the lane area feels wider and more natural.

## Guardrails

`npm run verify` now checks that:

- two-lane roads do not use yellow markings;
- two-lane roads have a white dashed center divider;
- road edge line inset constants stay near the asphalt edge;
- supported road bands remain limited to 2, 3, and 4 lanes.
