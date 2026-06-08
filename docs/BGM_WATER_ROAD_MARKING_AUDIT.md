# BGM, Water Foam, Road Marking, and Lane Audit

## Road marking thickness
Road marking constants are now:
- `ROAD_WHITE_LINE_WIDTH = 1.24`
- `ROAD_EDGE_WHITE_LINE_WIDTH = 2.2`
- `ROAD_YELLOW_LINE_WIDTH = 2.5`

## Smart BGM context
Background music is treated as lazy, low-priority media. It is only allowed when the game context is actively playing and not in quiz, game-over, impact, or menu states. Delayed resume timers are cancelled safely.

## SFX priority
SFX is mixed louder than BGM. Music volume was reduced and the SFX gain bus was increased so gameplay feedback remains dominant.

## Water foam boundary
Floating foam now stores its water row index, stays visible only while that row is still a water row, and has a stricter Y clamp to prevent drifting into grass.

## No score-99 orphan road
Rows 96-99 are now a complete 4-lane road band, and verification checks both forward and backward lane continuity.
