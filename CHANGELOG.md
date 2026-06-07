# Changelog

## 3.3.7 - Menu resume and rail visual fix

- Fixed close-menu resume jank by closing the React menu first, letting the browser paint, then resuming the Three.js engine on the next frame.
- Removed audio unlock/resume from the menu-close path so the interaction remains visual-only.
- Reworked the train rail visual relationship so wheels align to the raised white rail-head surface.
- Moved rail heads outward to the wheel track line so the rail no longer reads as cutting through the train body.
- Retuned rail standing height for the raised rail-head profile.
- Added `docs/MENU_RESUME_AND_RAIL_VISUAL_AUDIT.md`.

## 3.3.6 - Menu Freeze Audit

- Fixed a mobile freeze when opening the in-game menu after gameplay had started.
- Removed direct audio unlock/music start from the menu-open click handler.
- Kept the game in a started state while menu-paused to avoid overlay churn.
- Added engine-side UI pause throttling so the live WebGL scene does not keep full-rate rendering behind the menu.
- Simplified menu blur compositing to avoid expensive backdrop-filter work over the WebGL canvas.

## 3.3.5 - Haptic, start-frame, road, rail, and camera-B tuning

- Added optional mobile haptic vibration for jump, blocked move, near miss, impact, quiz, reward, and Start.
- Kept Start frame lighter by preventing direct audio unlock, media preload, quiz fetch, scene rebuild, and install prompt work during the first gameplay frame.
- Moved restart scene preparation behind the result card with a short idle timeout so replay does not rebuild on the button tap.
- Restored tree blockers to trunk/core tiles only so decorative crowns do not block far-away tiles.
- Removed 1-lane road generation; traffic rows now use only 2-lane, 3-lane, and 4-lane roads.
- Lowered rail/sleeper geometry and retuned rail standing height so train cars are not visually cut by high white rail blocks.
- Switched camera feel to softer child-friendly mode B: `MOVE_DURATION = 166ms`, `CAMERA_FOLLOW_STIFFNESS = 12.5`, and `CAMERA_TARGET_STIFFNESS = 13.5`.
- Expanded `npm run verify` guardrails for start freeze, haptics, lane count, tree blockers, camera constants, and rail geometry.
- Added `docs/MOBILE_HAPTIC_START_ROAD_RAIL_CAMERA_AUDIT.md`.

## 3.3.4 - Total runtime audit

- Fixed late-game visual tree collision around score 80, 86, 91, and later grass rows by using expanded tree visual footprints.
- Added final blocked-tile guard after queued/rapid movement completes.
- Reduced Start/Main Lagi hitch by keeping the first gameplay frame lightweight.
- Deferred audio/profile non-visual work off the first Start frame.
- Prevented kids-yay sampled audio from preloading during Start.
- Added restart prebuild while the result card is open so replay does not rebuild the scene on button press.
- Added renderer warm-up and mobile overlay blur reduction for weaker devices.
- Expanded `npm run verify` with late-game tree collision regression checks.


## 3.3.3 - Start Button Freeze Fix

- Fixed a start-button freeze caused by rebuilding the full Three.js world on the first play tap.
- Changed the first-play flow to use the already prepared scene via `game.start()`.
- Deferred background music resume until after the next animation frame so gameplay responds first.
- Added `npm run verify` guardrail to prevent `reset(true)` from returning to the start button flow.
- Added `docs/START_FREEZE_AUDIT.md`.

## 3.3.2 - Tree collision consistency

- Fixed decorated grass trees being visually solid but passable.
- Added a verification guard so every generated visible tree tile must also be a movement blocker.
- No gameplay identity, font, asset, audio, camera, or surface-height changes.

## 3.3.1 - Camera and difficulty tuning

- Tuned the game camera toward a more row-locked Crossy-style follow model.
- Reduced horizontal camera drag so side hops no longer make the map feel floaty.
- Adjusted hop duration to a snappier 150 ms.
- Added mid-game rail relief around score 80-92 to avoid repeated bullet train rows.
- Reduced bullet train probability, double-train chance, and peak bullet speed in the score 80-92 band.
- Added `docs/CAMERA_AND_DIFFICULTY_AUDIT.md`.

## 3.3.1 - Movement feel refinement

- Improved camera follow smoothing for more stable map movement.
- Changed hop travel easing for a softer, more natural step.
- Added early touch swipe commit so mobile controls feel more responsive.
- Added movement audit documentation in `docs/MOVEMENT_AUDIT.md`.



## 3.3.1 - Engine performance audit

- Added adaptive Three.js render profiles for mobile-light, mobile-balanced, and desktop-premium devices.
- Reduced mobile GPU pressure by capping pixel ratio and shadow map size based on device capability.
- Removed per-frame camera vector allocation and unnecessary shadow projection updates.
- Kept first install lighter by caching large quiz/audio files on first use instead of service-worker precache.
- Added `docs/PERFORMANCE_AUDIT.md` for repo-public performance notes.

## 3.3.0

- Prepared repository metadata for the public `masarray/ayam` repository.
- Converted documentation screenshots from PNG to optimized WebP.
- Updated README, GitHub setup guide, deployment docs, sitemap, robots, manifest, and package metadata for `https://masarray.github.io/ayam/`.
- Moved Vite build tooling to `devDependencies`.
- Preserved the original Sniglet game typography.
- Documented Mushroom Dance audio attribution: OpenGameArt.org, author bart, CC BY 3.0.
- Bumped service worker cache version to refresh deployed PWA assets.

## 3.2.0

- Added public repository hygiene docs, CI, GitHub Pages deployment, PWA assets, reward audio, badges, and quiz polish.
