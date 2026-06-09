# SFX, Coin Reward, Train Horn, and Speed-Scaled Impact Audit

## Audio and reward loop
Correct revive answers now play a cheerful kid-friendly success sound. The coin reward is applied when the player taps `Lanjut`, with a coin cring SFX and HUD bump animation.

## Coin HUD
The coin HUD uses the provided SVG coin asset in `public/icons/coin.svg`, with the number placed beside it like a lightweight mobile game currency HUD.

## Train horn behavior
Train horn logic now checks the train head/front distance relative to the chicken and uses a per-approach guard so the horn is not spammed repeatedly while the same train passes.

## Collision effect scaling
Traffic/train impacts now calculate an impact speed factor from the colliding obstacle speed. Faster vehicles create more feathers/blood and stronger camera shake.
