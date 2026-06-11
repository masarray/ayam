# CSS Ownership Phase 3 — Revive Quiz

Version: 3.5.23

## Scope

Phase 3 moves the active revive quiz and revive offer UI into a dedicated owner file:

```txt
src/game/styles/quiz.css
```

This file owns the user-facing revive learning loop:

- pending revive dim overlay
- revive offer card
- revive quiz fullscreen overlay
- loading state
- question chalkboard
- answer option rows
- correct / wrong marks
- feedback modal
- explanation chalkboard
- quiz action buttons

## New class contract

Active JSX must use the `vc-*` quiz contract:

```txt
.vc-revive-pending
.vc-revive-offer-overlay
.vc-revive-offer-card
.vc-quiz-overlay
.vc-revive-quiz-overlay
.vc-quiz-card
.vc-revive-card
.vc-quiz-question
.vc-quiz-question-count
.vc-quiz-options
.vc-quiz-option
.vc-quiz-option-key
.vc-quiz-option-text
.vc-quiz-mark
.vc-quiz-button
.vc-quiz-feedback
.vc-revive-feedback
.vc-explanation-page
.vc-explain-question
.vc-explain-board
.vc-explain-board-label
```

## Legacy selectors no longer allowed in JSX

Do not reintroduce these selectors in `VoxelCrossing.jsx`:

```txt
.quiz-card
.revive-card
.quiz-question
.quiz-question-count
.quiz-options
.revive-options
.quiz-option
.quiz-option-key
.quiz-option-text
.quiz-mark
.quiz-next-button
.quiz-feedback
.quiz-feedback-title
.revive-actions
.explanation-page
.explain-question
.explain-board
.revive-offer-card
.revive-offer-actions
```

They still exist inside `legacy.css` only because the old skin is quarantined there during the staged refactor.

## Ownership rule

Any future revive quiz layout or visual fix must be made in `quiz.css`, not at the bottom of `legacy.css`.

Use tokens in `tokens.css` for geometry that may affect more than one selector:

```css
--vc-quiz-z
--vc-quiz-outer-pad
--vc-quiz-card-width
--vc-quiz-explain-width
--vc-quiz-card-pad
--vc-quiz-card-radius
```

## Why this phase matters

Before Phase 3, the revive quiz was controlled by many historical patches across `legacy.css`, including `.quiz-card`, `.quiz-option`, `.quiz-next-button`, `.revive-offer-card`, and `.explain-board`. The same visual bugs kept returning because fixes were stacked under older fixes.

After Phase 3, the JSX points to a clean owner contract. Legacy quiz CSS can stay quarantined until a later delete phase, but it no longer owns the active revive flow.
