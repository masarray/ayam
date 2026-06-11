# Revive Second-Cycle Stuck Fix

## Problem
After the first revive cycle, a later `Jawab soal` click could leave the game blurred and controls disabled without showing the revive quiz card.

## Root cause
The shell could enter `quiz-active` from leaked `quizDue`/quiz status flags even when no game-over modal was mounted. That made gameplay controls disabled while the revive UI was not visible.

## Fix
- `quiz-active` is now tied to `modalOverlayActive`, not raw quiz flags.
- `openReviveQuiz()` explicitly restores the game-over revive context before loading questions.
- A watchdog retries question loading if the async loader remains stuck in `loading`.
- A stale-state repair effect clears leaked quiz flags or restores the revive modal context.
