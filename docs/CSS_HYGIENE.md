# CSS Hygiene Notes

Ayam SD currently uses one game-scoped stylesheet:

```txt
src/game/VoxelCrossing.css
```

## Ownership rule

The final production-critical overrides are grouped at the bottom under:

```css
/* v2.8 ownership layer */
```

This layer owns:

- fixed-height quiz chalkboard sizing
- badge board / trophy board layout
- stronger score, best score, NYARIS, and HIT typography
- mobile badge board responsiveness
- kid-friendly Sniglet typography overrides

## Patch rule

Do not add random CSS patches in the middle of the file. For small urgent fixes, add them to the ownership layer and explain the selector ownership in the comment. For larger work, split the stylesheet first.

Recommended future split:

```txt
src/game/styles/base.css
src/game/styles/hud.css
src/game/styles/menu.css
src/game/styles/quiz.css
src/game/styles/badges.css
src/game/styles/effects.css
```

## Known legacy debt

Earlier prototype iterations left duplicate selectors for quiz options, quiz question sizing, and mobile breakpoints. They are currently contained by the final scoped overrides, but the next visual refactor should remove duplicates instead of stacking more overrides.
