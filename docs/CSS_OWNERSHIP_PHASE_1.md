# CSS Ownership Phase 1

Version: 3.5.21

## What changed

The menu and bottom movement controls now have dedicated CSS ownership instead of receiving more patch rules at the bottom of the old stylesheet.

New CSS entry point:

```txt
src/game/styles/index.css
```

Current import order:

```txt
legacy.css       # old skin, quarantined; do not add new rules here
tokens.css       # shared sizing/z-index/radius/spacing tokens
controls.css     # bottom dock, hamburger trigger, movement pad
menu.css         # centered menu modal, menu actions, settings rows
```

`src/game/VoxelCrossing.css` is now only a compatibility shim.

## Ownership contract

| Area | Owner file |
|---|---|
| `.vc-control-dock` | `src/game/styles/controls.css` |
| `.vc-dock-button` / `.vc-dock-visual` | `src/game/styles/controls.css` |
| `.vc-menu-trigger` | `src/game/styles/controls.css` |
| `.vc-move-pad` / `.vc-move-control` | `src/game/styles/controls.css` |
| `.vc-menu-panel` | `src/game/styles/menu.css` |
| `.vc-menu-action` / icon wrappers | `src/game/styles/menu.css` |
| `.vc-menu-settings` / setting rows | `src/game/styles/menu.css` |
| shared control/menu size tokens | `src/game/styles/tokens.css` |

## Regression guard

Do not reintroduce these old selectors in JSX for the menu/control area:

```txt
.menu-button
.menu-panel
.menu-action
.menu-actions
.menu-head
.settings-section
.setting-row
.vc-controls
.control
.control-visual
```

Those names still exist inside `legacy.css` for old historical styling, but the active menu/control JSX no longer depends on them.

## Why this fixes the hamburger alignment issue

The hamburger and arrow buttons now share the same primitive:

```txt
.vc-dock-button   = same invisible hit area
.vc-dock-visual   = same visible circle size
.vc-control-dock  = one flex layout baseline
```

Because the hamburger and the lower arrow row are now in the same dock and both align with `align-items: flex-end`, their visual circles stay on the same baseline without bottom-position hacks.

## Rules for future CSS edits

1. New work must not be added to `legacy.css`.
2. Menu changes go only to `menu.css`.
3. Bottom control changes go only to `controls.css`.
4. Shared sizes go to `tokens.css`.
5. Avoid `!important` for layout. The few remaining `!important` rules in the new owner files only neutralize broad legacy button-active rules during the transition.
