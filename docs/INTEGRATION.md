# Integration Guide

`VoxelCrossing` can run as a standalone game or as a mini-game module inside a larger app.

## Basic usage

```jsx
import VoxelCrossing from './game/VoxelCrossing.jsx';

export default function GamePage() {
  return <VoxelCrossing />;
}
```

## Educational app hook

```jsx
<VoxelCrossing
  enableMilestoneCallback
  milestoneEvery={5}
  onQuestionGate={({ score }) => {
    openQuestionModal({ source: 'ayam-sd', score });
  }}
  onGameOver={({ score, highScore, reason }) => {
    saveMiniGameResult({ score, highScore, reason });
  }}
/>
```

## Props

| Prop | Type | Default | Purpose |
|---|---:|---:|---|
| `title` | string | `Ayam SD` | Intro overlay title |
| `subtitle` | string | built-in Indonesian text | Intro description |
| `enableMilestoneCallback` | boolean | `false` | Enables periodic callback for quiz/checkpoint integration |
| `milestoneEvery` | number | `5` | Number of score steps per milestone callback |
| `onQuestionGate` | function | undefined | Called on milestone when enabled |
| `onGameOver` | function | undefined | Called after final score is computed |
| `className` | string | empty | Optional custom wrapper class |

## Design notes

Keep the game canvas inside a stable parent container. The component uses `ResizeObserver` to adapt camera and layout to portrait or landscape.


## Post-game quiz

After a run ends, the game loads `public/data/questionBanks.json` lazily and presents 5 randomized questions. Answer order is shuffled for each question. Questions already shown in the current browser session are skipped until the pool is exhausted.
