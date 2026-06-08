# Music Context, Road Marking, Water Flow, and Road-Band Audit

## Background music context

BGM is now treated as context-aware lazy media, not a normal always-on sound.

Music is allowed only when all conditions are true:

- music setting is enabled
- game has started
- game is not over
- player is not in impact animation
- menu is not open
- quiz is not due / loading / running / complete

The game now uses `syncBackgroundMusicContext()` in `VoxelCrossing.jsx` and `musicContext` in `GameAudio` so a delayed BGM play promise cannot randomly start during quiz or game-over.

## SFX priority

SFX remains the first priority. Gameplay input unlocks/uses procedural SFX first. Background music resumes only after a trusted gameplay gesture and only if the context still allows it.

## Road markings

Road marking widths were increased:

- `ROAD_WHITE_LINE_WIDTH = 1.02`
- `ROAD_EDGE_WHITE_LINE_WIDTH = 1.24`
- `ROAD_YELLOW_LINE_WIDTH = 1.08`

## Water flow particles

Water foam / white floating line particles now store per-row min/max river bounds and are clamped during movement. They should no longer drift into grass rows.

## Road-band continuity

Row 99 could start a 4-lane road band immediately before the deterministic row-100 late-game section, causing a visual orphan lane. Rows 96-99 now use a curated bridge sequence and verification checks every traffic band for continuity.
