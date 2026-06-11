# Revive Learning Loop Audit

## Direction change
The game no longer treats quiz as a periodic interruption. Learning is now tied to the revive moment: when the chicken fails, the child gets one clear chance to continue by answering one question.

## New loop

```text
Play -> fail -> revive quiz -> correct: continue + coins -> wrong: explanation + restart
```

## Rules
- Base heart is one.
- No 5-question interruption flow.
- Revive quiz contains one question.
- Correct answer gives coins and revives from the current score.
- Wrong answer does not shame the child; it opens a visual explanation page and then restarts.
- Answer choices must show full text. No ellipsis for long answers.

## Anti-regression notes
- Start path remains light: no direct BGM start or heavy media work in the Start click handler.
- The engine preserves current run state while revive is pending. It must not prepare a hidden restart before the revive answer.
- Water revive is moved back to the nearest safe non-water row so the player does not instantly drown after revival.
