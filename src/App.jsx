import VoxelCrossing from './game/VoxelCrossing.jsx';

export default function App() {
  return (
    <main className="app-shell clean-game-shell">
      <section className="game-stage" aria-label="Ayam SD playable game">
        <VoxelCrossing />
      </section>
    </main>
  );
}
