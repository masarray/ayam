# Voxel Crossing Game

A lightweight Three.js crossing mini-game with voxel visuals, smarter traffic, 3-lane/4-lane road bands, trains, rivers, sinking planks, sound effects, lazy-loaded background music, high-score rewards, and responsive portrait/landscape play.

## Play

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Controls

- Start / restart: `Space`, `Enter`, `WASD`, or arrow keys
- Move: `WASD`, arrow keys, swipe, or on-screen buttons
- Menu: tap the three-line menu button

## Game features

- Voxel chicken character with road, rail, river, and plank hazards
- Smart lane spacing so vehicles slow down instead of stacking on each other
- 3-lane and 4-lane road bands for a more natural road-crossing feel
- More readable vehicle silhouettes with dark flush windows instead of protruding pale cabin blocks
- Multiple vehicle styles: sedan, taxi, pickup, van, bus, trucks, and trains
- Modern fast train, classic train, freight train, and bullet train variation
- River rows with moving wood planks that sink after being used too long
- Dramatic hit, splash, screen shake, and Game Over sequence
- High-score reward with three spinning gold stars
- In-game menu with Restart, Settings, high-score reset, music toggle, and sound-effect toggle
- Lazy-loaded OGG background music supplied in `public/audio/mushroom-dance.ogg` so the game opens quickly and remains playable before music streaming starts
- Web Audio sound effects for jump, horn, train, splash, hit, and reward impacts
- Responsive camera and HUD for portrait and landscape screens

## Build

```bash
npm run build
npm run preview
```

## Integration props

```jsx
<VoxelCrossing
  enableMilestoneCallback
  milestoneEvery={5}
  onQuestionGate={({ score }) => openQuestion(score)}
  onGameOver={({ score, highScore, reason }) => saveResult(score, highScore, reason)}
/>
```

## Project structure

```txt
src/game/VoxelCrossing.jsx      React wrapper, HUD, menu, settings, keyboard start/restart
src/game/RoadQuestGame.js      Three.js engine, camera, movement, collision, scoring
src/game/renderers.js          Voxel player, vehicles, trains, rivers, planks, map objects
src/game/world.js              Procedural row generation and difficulty progression
src/game/audio.js              Lazy-loaded OGG music player and procedural sound effects
src/game/VoxelCrossing.css     HUD, controls, menu, overlays, reward animations
```

## License notes

This project uses procedural geometry and a user-supplied OGG background track. It does not bundle Crossy Road assets, names, logos, images, or audio.
