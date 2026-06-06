# CSS Hygiene Notes

Ayam SD currently uses one game-scoped stylesheet: `src/game/VoxelCrossing.css`.

## Ownership rule

The latest production-critical overrides are grouped at the bottom under:

```css
/* v2.8 ownership layer */
```

This layer owns:

- fixed-height quiz chalkboard sizing
- badge board / trophy board layout
- stronger score, best score, NYARIS, HIT typography
- mobile badge board responsiveness

## Known legacy debt

Earlier prototype iterations left duplicate selectors for quiz options, quiz question sizing, and mobile breakpoints. They are harmless after the v2.8 ownership layer because the final rules are more specific and scoped under `.vc-overlay.quiz` or `.vc-shell`, but future work should split the stylesheet into:

```txt
src/game/styles/base.css
src/game/styles/hud.css
src/game/styles/menu.css
src/game/styles/quiz.css
src/game/styles/badges.css
src/game/styles/effects.css
```

Do not add new visual patches above the ownership layer unless the older duplicated blocks have been removed first.
