# Road Marking, Near-Miss, SFX Priority, and Plank Audit

## Road markings
Road markings were thickened again to improve readability and reduce shimmer:
- white divider: `0.86`
- white edge: `1.08`
- yellow line: `0.90`

## Train near miss
Near-miss now supports rail rows. Bullet trains trigger the `NYARIS!` warning earlier than cars because their closing speed is higher. Slow trains keep the tighter car-like near-miss feel.

## SFX before BGM
SFX lazy priming now has priority. Start still avoids AudioContext creation and does not resume background music. Gameplay primes SFX first; music resumes much later.

## Landscape controls
Landscape move-pad grid cells are now 60px x 60px.

## Plank sinking
When the chicken stays on a plank too long, the plank now gradually lowers, tilts, and compresses before the final splash impact.
