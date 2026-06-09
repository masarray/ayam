# Revive Offer Flow Audit

## Goal
Make learning feel like a reward opportunity, not a forced interruption.

## Final flow
1. The run starts with two internal lives.
2. The HUD shows one reserve heart.
3. The first impact consumes the reserve heart, blinks it, respawns the chicken, and continues the run.
4. The second impact pauses the game and shows a centered revive offer card after a short delay.
5. The quiz does not appear until the player chooses **Jawab 1 soal**.
6. A correct answer revives the chicken and awards coins.
7. A wrong answer offers a visual explanation and restart path.

## Regression guards
- No periodic 5-question quiz loop.
- No immediate question after impact.
- Start path remains media-light to avoid start freeze regression.
