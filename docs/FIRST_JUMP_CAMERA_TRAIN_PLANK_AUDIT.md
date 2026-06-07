# First Jump, Camera, Train Body, and Plank Audit

This patch keeps Start visual-only and also keeps the first movement frame safe.

## Changes

- Audio unlock is no longer executed immediately from the first gameplay pointer/key event.
- AudioContext setup is delayed until after the hop has painted and the browser has idle time.
- Camera mode B is now calmer: the camera follows the logical row/tile anchor instead of the chicken's vertical hop arc.
- Impact words are localized: TUBRUK!, KERETA!, and JEBURR!.
- Train bodies are lifted into a separate raised body group while wheels/bogies remain on the rail head.
- Water rows now spawn more planks with slightly slower movement.

## Design note

The chicken still hops, but the camera should not bob with every jump. That keeps the game more comfortable for children and reduces dizziness on mobile screens.
