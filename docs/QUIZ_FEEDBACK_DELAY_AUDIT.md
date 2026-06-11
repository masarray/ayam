# Quiz Feedback Delay Audit

Version: 3.5.25

## Problem

The correct/wrong modal appeared immediately after an answer tap. On mobile, this covered the answer options too quickly, so the child could not observe which answer turned green and which selected answer turned red.

## Fix

The answer state is now split into two phases:

1. `selectedKey` is applied immediately.
   - The selected answer is locked.
   - The correct answer is marked green.
   - The wrong selected answer is marked red.

2. `feedbackVisible` is shown after `QUIZ_FEEDBACK_DELAY_MS`.
   - Current value: `2000ms`.
   - The modal `Yey Benar` / `Belum tepat` appears only after the child has had time to read the marked options.

## Ownership

The delay is owned by `VoxelCrossing.jsx` state logic, not CSS animation delay. CSS only styles the feedback modal when `feedbackVisible` becomes true.
