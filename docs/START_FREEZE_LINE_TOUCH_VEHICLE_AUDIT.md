# Start Freeze, Line Stability, Touch Target, and Vehicle Stance Audit

## 1) Freeze after a few steps
The hitch returned because gameplay movement still triggered delayed audio unlock / delayed music resume. Those delayed tasks could fire 1–2 seconds after movement began, causing a visible pause a few steps after Start.

### Fix
- Removed automatic `deferAudioUnlock()` and `deferMusicResume()` from gameplay `move()`.
- Disabled automatic global gameplay audio priming from control/canvas pointerdown and keydown.

## 2) Thin-line shimmer
Thin bright lines on dark asphalt can shimmer due to sub-pixel aliasing and depth competition. In addition to the earlier render-order / polygon-offset work, the lines were thickened slightly:
- white divider line: `0.58 -> 0.66`
- white edge line: `0.68 -> 0.82`
- yellow line: `0.58 -> 0.68`

## 3) Larger touch target without ugly large buttons
The control button hit area remains large, but the visible white button is smaller and centered inside that hit area. This follows the common mobile best-practice direction of keeping generous touch targets while allowing a smaller visual control.

## 4) Vehicle body above wheels
Wheel centers were lowered slightly:
- normal wheel Z offset: `0.35 -> 0.05`
- wide wheel Z offset: `0.75 -> 0.18`

This makes the vehicle bodies sit a bit more clearly above the wheels.
