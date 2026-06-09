# Revive Quiz UX Bugfix Audit

## Fixed issues
- Opening explanation no longer crashes to a blank page. The explanation view now uses a safe fallback visual renderer.
- Revive-offer actions no longer overlap on desktop; the card uses a locked one-column button layout.
- The menu button is disabled during revive/quiz overlays and sits below the modal layer like the move pad.
- Raw check/cross/heart text markers were replaced with Google Material icon paths for consistency.
- Excess wording was removed from revive/quiz UI to reduce visual noise.

## Flow ownership
- Revive offer: short decision card.
- Revive quiz: one question, complete answers, minimal instructions.
- Wrong answer: compact feedback, explanation button, restart option.
- Explanation: full page inside the modal with safe visual support.
