import { useEffect, useRef, useState } from 'react';
import { RoadQuestGame } from './RoadQuestGame.js';
import { GameAudio } from './audio.js';
import './VoxelCrossing.css';

const SETTINGS_KEY = 'voxel-crossing-settings';
const PLAY_KEYS = new Set([' ', 'spacebar', 'enter', 'w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);

function isPlayKey(event) {
  const key = event.key.toLowerCase();
  return PLAY_KEYS.has(key) || event.code === 'Space';
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { musicEnabled: true, sfxEnabled: true };
    const parsed = JSON.parse(raw);
    return {
      musicEnabled: parsed.musicEnabled !== false,
      sfxEnabled: parsed.sfxEnabled !== false
    };
  } catch {
    return { musicEnabled: true, sfxEnabled: true };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage is optional. The game still runs when browser storage is blocked.
  }
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d="M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z" fill="currentColor" />
    </svg>
  );
}

export default function VoxelCrossing({
  title = 'Voxel Crossing',
  subtitle = 'Bantu ayam menyeberang jalan, rel kereta, dan sungai. Hindari kendaraan, pilih timing yang tepat, dan kejar skor terbaik.',
  enableMilestoneCallback = false,
  milestoneEvery = 5,
  onQuestionGate,
  onGameOver,
  className = ''
}) {
  const hostRef = useRef(null);
  const gameRef = useRef(null);
  const audioRef = useRef(null);
  const menuPausedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [impacting, setImpacting] = useState(false);
  const [impactReason, setImpactReason] = useState('traffic');
  const [result, setResult] = useState(null);
  const [score, setScore] = useState(0);
  const [lastRunScore, setLastRunScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [orientationHint, setOrientationHint] = useState('landscape');
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(() => loadSettings());

  useEffect(() => {
    audioRef.current = new GameAudio({
      volume: 0.58,
      musicEnabled: settings.musicEnabled,
      sfxEnabled: settings.sfxEnabled
    });
    return () => {
      audioRef.current?.stopAll();
      audioRef.current = null;
    };
    // Initialize once. Setting changes below are pushed to the same audio instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveSettings(settings);
    audioRef.current?.setMusicEnabled(settings.musicEnabled);
    audioRef.current?.setSfxEnabled(settings.sfxEnabled);
  }, [settings]);

  const unlockAudio = () => {
    audioRef.current?.unlock();
  };

  useEffect(() => {
    if (!hostRef.current) return undefined;

    const game = new RoadQuestGame(hostRef.current, {
      enableMilestoneCallback,
      milestoneEvery,
      onReady: ({ highScore: initialHighScore }) => {
        setHighScore(initialHighScore);
        setReady(true);
      },
      onScore: (nextScore) => {
        setScore(nextScore);
        setLastRunScore(nextScore);
      },
      onHighScore: (nextHighScore) => setHighScore(nextHighScore),
      onImpact: ({ reason }) => {
        setImpactReason(reason);
        setImpacting(true);
        audioRef.current?.hit(reason);
      },
      onMoveStart: () => audioRef.current?.jump(),
      onHazardSound: ({ kind }) => {
        if (kind === 'carHorn') audioRef.current?.carHorn();
        if (kind === 'train') audioRef.current?.trainPass(false);
        if (kind === 'bulletTrain') audioRef.current?.trainPass(true);
        if (kind === 'trainHorn') audioRef.current?.trainHorn();
      },
      onGameOver: (nextResult) => {
        setImpacting(false);
        setGameOver(true);
        setStarted(false);
        setMenuOpen(false);
        setSettingsOpen(false);
        setResult(nextResult);
        setScore(nextResult.score);
        setLastRunScore(nextResult.score);
        onGameOver?.(nextResult);
      },
      onMilestone: (payload) => onQuestionGate?.(payload)
    });

    gameRef.current = game;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setOrientationHint(height > width ? 'portrait' : 'landscape');
    });
    observer.observe(hostRef.current);

    return () => {
      observer.disconnect();
      game.destroy();
      gameRef.current = null;
    };
  }, [enableMilestoneCallback, milestoneEvery, onGameOver, onQuestionGate]);

  const startGame = () => {
    unlockAudio();
    gameRef.current?.reset(true);
    menuPausedRef.current = false;
    setMenuOpen(false);
    setSettingsOpen(false);
    setImpacting(false);
    setGameOver(false);
    setResult(null);
    setStarted(true);
    setScore(0);
    setLastRunScore(0);
  };

  const resumeGame = () => {
    if (impacting) return;
    unlockAudio();
    gameRef.current?.resume();
    menuPausedRef.current = false;
    setMenuOpen(false);
    setSettingsOpen(false);
    setStarted(true);
  };

  const pauseGame = () => {
    if (impacting) return;
    gameRef.current?.pause();
    setStarted(false);
  };

  const openMenu = () => {
    if (impacting) return;
    unlockAudio();
    menuPausedRef.current = Boolean(started && !gameOver);
    if (started && !gameOver) pauseGame();
    setSettingsOpen(false);
    setMenuOpen(true);
  };

  const closeMenu = ({ resume = false } = {}) => {
    if (resume && menuPausedRef.current && !gameOver && ready && !impacting) {
      resumeGame();
      return;
    }
    menuPausedRef.current = false;
    setMenuOpen(false);
    setSettingsOpen(false);
  };

  const resetHighScore = () => {
    const next = gameRef.current?.resetHighScore?.() ?? 0;
    setHighScore(next);
    setResult((current) => current ? { ...current, highScore: next, previousHighScore: 0, isNewHighScore: false } : current);
  };

  const updateSetting = (key, value) => {
    unlockAudio();
    setSettings((current) => ({ ...current, [key]: Boolean(value) }));
  };

  const move = (direction) => {
    if (impacting || menuOpen) return;
    unlockAudio();
    if (!started && !gameOver) resumeGame();
    gameRef.current?.queueMove(direction);
  };

  useEffect(() => {
    const handler = (event) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select';
      if (isTyping || menuOpen || !ready || impacting) return;
      if ((gameOver || !started) && isPlayKey(event)) {
        event.preventDefault();
        startGame();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [gameOver, impacting, menuOpen, ready, started]);

  useEffect(() => {
    if (!gameOver || !result?.isNewHighScore) return undefined;
    const timers = [0, 1, 2].map((index) => window.setTimeout(() => {
      audioRef.current?.rewardStar(index);
    }, 420 + index * 360));
    timers.push(window.setTimeout(() => audioRef.current?.rewardComplete(), 1630));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [gameOver, result?.isNewHighScore]);

  const visibleScore = gameOver ? (result?.score ?? lastRunScore) : score;
  const resultScore = result?.score ?? lastRunScore;
  const resultReasonText = result?.reason === 'water'
    ? 'Ayam tercebur sungai. Tunggu plank berikutnya dan jangan terlalu lama berdiri di atas plank.'
    : result?.reason === 'train'
      ? 'Kereta melintas sangat cepat. Amati ritmenya sebelum menyeberang rel.'
      : 'Tertabrak kendaraan. Perhatikan jarak dan kecepatan lane sebelum melompat.';

  const restartHint = 'Tekan Space, Enter, WASD, atau Arrow untuk mulai lagi.';

  return (
    <section className={`vc-shell ${orientationHint} ${impacting ? `impact ${impactReason}` : ''} ${className}`}>
      <div ref={hostRef} className="vc-host" />

      {!ready && (
        <div className="vc-boot-loader" aria-live="polite">
          <div className="loader-orb" aria-hidden="true" />
          <span>Menyiapkan arena…</span>
        </div>
      )}

      <div className="vc-hud top-left" aria-live="polite">
        <div className="score-value">{visibleScore}</div>
        <div className="score-label">score</div>
      </div>

      <div className="vc-hud top-right">
        <div className="high-label">best</div>
        <div className="high-value">{highScore}</div>
      </div>

      <button
        type="button"
        className={`menu-button ${menuOpen ? 'active' : ''}`}
        aria-label="Open game menu"
        aria-expanded={menuOpen}
        onClick={() => {
          if (menuOpen) closeMenu({ resume: menuPausedRef.current });
          else openMenu();
        }}
      >
        <MenuIcon />
      </button>

      {menuOpen && (
        <div className="menu-panel" role="dialog" aria-label="Game menu">
          <div className="menu-head">
            <div>
              <strong>Menu</strong>
              <span>{menuPausedRef.current ? 'Game dijeda' : 'Pengaturan game'}</span>
            </div>
            <button type="button" className="icon-close" onClick={() => closeMenu({ resume: menuPausedRef.current })} aria-label="Close menu">×</button>
          </div>

          <div className="menu-actions">
            {menuPausedRef.current ? (
              <button type="button" className="menu-action primary" onClick={resumeGame}>Lanjutkan</button>
            ) : (
              <button type="button" className="menu-action primary" onClick={startGame} disabled={!ready}>Mulai Main</button>
            )}
            <button type="button" className="menu-action" onClick={startGame} disabled={!ready}>Restart</button>
            <button type="button" className={`menu-action ${settingsOpen ? 'active' : ''}`} onClick={() => setSettingsOpen((open) => !open)}>Settings</button>
          </div>

          {settingsOpen && (
            <div className="settings-section">
              <label className="setting-row">
                <span>
                  <strong>Background music</strong>
                  <small>Musik ringan saat bermain</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.musicEnabled}
                  onChange={(event) => updateSetting('musicEnabled', event.target.checked)}
                />
                <i aria-hidden="true" />
              </label>

              <label className="setting-row">
                <span>
                  <strong>Sound effect</strong>
                  <small>Lompat, klakson, kereta, splash, dan hit</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.sfxEnabled}
                  onChange={(event) => updateSetting('sfxEnabled', event.target.checked)}
                />
                <i aria-hidden="true" />
              </label>

              <button type="button" className="reset-score-button" onClick={resetHighScore}>Reset high score</button>
            </div>
          )}
        </div>
      )}

      <div className="vc-controls" aria-label="Game controls">
        <button type="button" className="control up" aria-label="Move forward" onClick={() => move('forward')} disabled={impacting || menuOpen}>▲</button>
        <button type="button" className="control left" aria-label="Move left" onClick={() => move('left')} disabled={impacting || menuOpen}>◀</button>
        <button type="button" className="control down" aria-label="Move backward" onClick={() => move('backward')} disabled={impacting || menuOpen}>▼</button>
        <button type="button" className="control right" aria-label="Move right" onClick={() => move('right')} disabled={impacting || menuOpen}>▶</button>
      </div>

      {impacting && (
        <div className={`impact-stinger ${impactReason}`} aria-hidden="true">
          <span>{impactReason === 'train' ? 'TRAIN!' : impactReason === 'water' ? 'SPLASH!' : 'HIT!'}</span>
        </div>
      )}

      {!started && !gameOver && !impacting && !menuOpen && (
        <div className="vc-overlay intro">
          <div className="glass-card">
            <div className="mini-badge">Mini Game</div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
            <div className="hint-row">
              <span>Space / Enter untuk mulai</span>
              <span>Arrow / WASD untuk bergerak</span>
              <span>Swipe atau tombol untuk mobile</span>
            </div>
            <button type="button" className="start-button" onClick={startGame} disabled={!ready}>
              {ready ? 'Mulai Main' : 'Loading…'}
            </button>
          </div>
        </div>
      )}

      {gameOver && !menuOpen && (
        <div className={`vc-overlay result ${result?.isNewHighScore ? 'new-record' : ''}`}>
          <div className="glass-card compact result-card">
            {result?.isNewHighScore ? (
              <>
                <div className="reward-aura" aria-hidden="true" />
                <div className="mini-badge gold">Rekor Baru</div>
                <div className="star-reward" aria-hidden="true">
                  <span className="gold-star s1">★</span>
                  <span className="gold-star s2">★</span>
                  <span className="gold-star s3">★</span>
                </div>
                <h2>Score {resultScore}</h2>
                <p className="reward-copy">Tiga bintang untuk rekor terbaikmu. Pertahankan fokus, baca ritme lane, dan coba menyeberang lebih jauh.</p>
              </>
            ) : (
              <>
                <div className="mini-badge danger">Game Over</div>
                <h2>Score {resultScore}</h2>
                <p>{resultReasonText} Best score: {highScore}. {restartHint}</p>
              </>
            )}
            <button type="button" className="start-button" onClick={startGame}>Main Lagi</button>
          </div>
        </div>
      )}
    </section>
  );
}
