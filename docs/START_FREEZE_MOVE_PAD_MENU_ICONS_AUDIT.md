# Start Freeze, Move Pad, and Menu Icon Audit

## Start freeze root cause
Version 3.4.0 reintroduced `audio.unlock({ allowMusic: false })` inside Start. That created/resumed AudioContext in the same interaction path as the intro overlay removal and WebGL start. On weaker mobile devices this can block the next paint and appear as a 4-second freeze.

## Fix
- Replaced Start audio unlock with `markUserInteracted()` only.
- No AudioContext creation happens in Start.
- Music warm/resume stays delayed inside idle/background work.

## Move pad side
Added a visible Settings option:
- Move pad: Left / Right

The shell receives `move-pad-left` or `move-pad-right`, and CSS moves the control pad accordingly.

## Menu icons
Added inline SVG icons for menu actions so the menu feels more polished and consistent without adding external dependencies.
