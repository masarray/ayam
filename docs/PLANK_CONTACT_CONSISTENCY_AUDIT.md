# Plank Contact Consistency Audit

## Problem
A player could sometimes appear to land on a plank and still splash immediately. This happened because contact detection was checked on a single frame while planks were moving, and sinking planks were no longer treated as valid support.

## Fix
- Added a short landing grace window before water splash can trigger after landing on a water row.
- Added slightly wider plank contact tolerance on landing.
- Kept the active plank as support while it is visibly sinking.
- Delayed the water splash until the active plank has actually sunk far enough / long enough.

## Rule
Landing on a plank must never cause an instant splash. The sequence should be:

1. land on plank
2. ride plank
3. plank warns / sinks
4. chicken falls into water
