# CSS Ownership Phase 2

Version: 3.5.22

## Scope

Phase 2 moves the top gameplay HUD out of legacy selectors and into a dedicated owner file.

New owner file:

```txt
src/game/styles/hud.css
```

Updated import order:

```txt
legacy.css       # old skin, quarantined; do not add new rules here
tokens.css       # shared sizing/z-index/radius/spacing tokens
hud.css          # score, coin, best, life, cheat HUD
controls.css     # bottom dock, hamburger trigger, movement pad
menu.css         # centered menu modal, menu actions, settings rows
```

## Ownership contract

| Area | Owner file |
|---|---|
| `.vc-game-hud` | `src/game/styles/hud.css` |
| `.vc-score-hud` / `.vc-score-value` / `.vc-score-label` | `src/game/styles/hud.css` |
| `.vc-coin-hud` / `.vc-coin-icon` / `.vc-coin-value` / `.vc-coin-plus` | `src/game/styles/hud.css` |
| `.vc-best-hud` / `.vc-best-value` / `.vc-best-label` | `src/game/styles/hud.css` |
| `.vc-life-hud` | `src/game/styles/hud.css` |
| `.vc-cheat-chip` | `src/game/styles/hud.css` |
| HUD geometry tokens | `src/game/styles/tokens.css` |

## Deprecated HUD selectors

Do not reintroduce these class names in `VoxelCrossing.jsx`:

```txt
.vc-hud
.score-value
.score-label
.high-value
.high-label
.coin-hud
.coin-svg-icon
.coin-plus
.best-hud
.life-hud
.cheat-chip
```

They still exist inside `legacy.css` only as historical quarantine. Active JSX should use the `vc-*` HUD ownership classes.

## Why this matters

Before Phase 2, the score, coin, best, heart, and cheat chip were controlled by several historical rules and many `!important` overrides. That made the top-right coin/best stack fragile and made quiz/menu dimming depend on old class names.

Now the HUD has one active source of truth:

- top-left score card
- top-right coin stack
- best score card under the coin
- reserve-heart position beside the score
- cheat chip replacing the heart
- quiz-active dim/blur state
- menu-open backdrop optimization

## Next recommended phase

Phase 3 should move the shell/canvas/boot-loader and global overlay primitives out of `legacy.css` into dedicated owner files:

```txt
shell.css
overlays.css
```

Do not start quiz/revive ownership before shell and overlay primitives are stable.
