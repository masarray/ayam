# PWA Close + Android Haptic Fix

Version: 3.5.27

## Problem

The menu `Close` button was interpreted as closing the installed PWA app, but the web platform does not reliably allow an installed PWA to close itself. The previous button only closed the menu panel.

Android haptic feedback was also too subtle on some devices because most gameplay patterns were only 8-16ms. On MIUI/Xiaomi-class phones these short pulses may be imperceptible or suppressed.

## Fix

- Renamed the existing menu action to `Tutup Menu` to remove ambiguity.
- Added `Keluar App` for installed PWA mode.
- `Keluar App` pauses the game, saves current state where possible, stops audio, tries `window.close()`, then falls back to a clear pause screen explaining Android/Chrome behavior.
- Added a direct `Tes Getar` button inside Settings so haptic can be tested from a trusted user gesture.
- Increased haptic patterns to Android-friendly values while keeping them short and child-friendly.
- Added haptic support guard through `canUseHaptics()`.

## Notes

If `Tes Getar` reports that the command was sent but the phone still does not vibrate, check system-level settings: silent/DND mode, battery saver, haptic feedback/vibration settings, and browser-specific behavior.
