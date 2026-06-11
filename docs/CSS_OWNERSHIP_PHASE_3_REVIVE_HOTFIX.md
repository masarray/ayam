# CSS Ownership Phase 3 Hotfix - Revive Offer

Version: 3.5.24

## Problem

The Phase 3 quiz ownership migration renamed the revive offer selectors, but the compact revive offer UI still depended on the old legacy selector chain for its premium glass card, pill buttons, and blur backdrop. The result looked visually unowned: default-looking buttons, weak card hierarchy, and poor modal separation.

## Fix

`src/game/styles/quiz.css` is now the explicit owner of the compact revive offer state:

- `.vc-revive-offer-overlay`
- `.vc-revive-offer-card`
- `.vc-revive-offer-icon`
- `.vc-revive-offer-copy`
- `.vc-revive-offer-actions`
- `.vc-revive-offer-actions .vc-quiz-button`

The rescue layer restores:

- centered modal card
- strong blurry/dim background
- premium dark glass card
- rounded gold badge
- full-width pill action buttons
- correct button visual hierarchy

## Ownership rule

Do not restore old JSX class names such as `.revive-offer-card` or `.quiz-next-button`. Future edits for this revive offer must stay in `quiz.css` under the `vc-revive-offer-*` selectors.
