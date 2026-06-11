# HUD Layout Reset Audit

## Problem
The previous HUD implementation had multiple ownership layers. Older CSS still forced the menu button toward the center, causing it to overlap the move pad. Coin and best score also competed for space in the top-right corner.

## Fix
A final HUD ownership layer now explicitly controls the layout:

- Score: top-left.
- Reserve heart: beside the score, not inside the score card.
- Coin: compact top-right gold coin badge.
- Best: compact card below coin.
- Move pad: user-selected side.
- Menu: bottom corner opposite the move pad.
- Menu panel: opens above the bottom menu button.

## Rule
Move pad and menu must never share the same bottom corner. HUD currency should remain secondary and must not dominate the gameplay view.
