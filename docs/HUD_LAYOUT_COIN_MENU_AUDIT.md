# HUD Layout, Coin Styling, and Menu Placement Audit

## Goals
- Make the coin feel closer to a familiar gold game coin instead of a generic dot.
- Move the menu to the bottom corner opposite the move pad, following common mobile game thumb-zone patterns.
- Keep the HUD layout visually familiar: score and heart on the left, currency and best score on the right.

## What changed
- The coin HUD now uses the Google Material `monetization_on` glyph inside a layered gold circular coin shell.
- The coin badge moved to the top-right corner.
- The best-score HUD now sits directly below the coin badge.
- The menu button moved to the bottom opposite the move pad.
- The menu panel opens upward from that bottom corner to match the relocated menu button.

## UX rationale
This layout keeps the gameplay area cleaner near the top-center and reduces accidental taps by separating movement controls from the menu.
