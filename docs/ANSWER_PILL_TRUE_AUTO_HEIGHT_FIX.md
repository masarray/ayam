# Answer Pill True Auto-Height Fix

## Problem
Older quiz CSS still forced answer options into fixed rows and applied a two-line clamp. This made long answers appear clipped even after the revive quiz tried to set `height:auto`.

## Fix
The revive quiz now owns its answer layout completely:
- answer list uses auto rows
- no fixed row height
- answer buttons have no max-height
- answer text has no ellipsis or line clamp
- A/B/C/D badges and feedback icons remain vertically centered
