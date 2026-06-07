import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RoadQuestGame } from './RoadQuestGame.js';
import { GameAudio } from './audio.js';
import { BADGE_FAMILIES, getBadgeCount, loadPlayerProfile, savePlayerProfile, trackBadgeEvent } from './badges.js';
import './VoxelCrossing.css';

const SETTINGS_KEY = 'ayam-sd-settings';
const SAVE_GAME_KEY = 'ayam-sd-save-game-v1';
const INSTALL_PROMPT_KEY = 'ayam-sd-install-prompt-v1';
const SEEN_QUESTIONS_KEY = 'ayam-sd-seen-questions-v1';
const QUIZ_SIZE = 5;
const GAME_OVERS_BEFORE_QUIZ = 3;
const QUIZ_APPEAR_DELAY_MS = 300;
const MAX_LIVES = 2;
const PLAY_KEYS = new Set([' ', 'spacebar', 'enter', 'w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
const ACTIVE_QUIZ_STATES = new Set(['loading', 'running', 'complete']);

const QUIZ_INITIAL = {
  status: 'idle',
  loading: false,
  error: null,
  questions: [],
  index: 0,
  selectedKey: null,
  correctCount: 0,
  lastCorrect: null
};

function isPlayKey(event) {
  const key = event.key.toLowerCase();
  return PLAY_KEYS.has(key) || event.code === 'Space';
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { musicEnabled: true, sfxEnabled: true, hapticsEnabled: true, cheatMode: false };
    const parsed = JSON.parse(raw);
    return {
      musicEnabled: parsed.musicEnabled !== false,
      sfxEnabled: parsed.sfxEnabled !== false,
      hapticsEnabled: parsed.hapticsEnabled !== false,
      cheatMode: parsed.cheatMode === true
    };
  } catch {
    return { musicEnabled: true, sfxEnabled: true, hapticsEnabled: true, cheatMode: false };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Browser storage is optional. The game still runs when storage is blocked.
  }
}

function loadSavedGame() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_GAME_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Number.isFinite(Number(parsed.row)) || !Number.isFinite(Number(parsed.tile))) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSavedGame(saveState) {
  try {
    localStorage.setItem(SAVE_GAME_KEY, JSON.stringify(saveState));
  } catch {
    // Save is optional; gameplay continues even when storage is blocked.
  }
}

function normalizeLives(value) {
  if (!Number.isFinite(Number(value))) return MAX_LIVES;
  return Math.max(0, Math.min(MAX_LIVES, Math.floor(Number(value))));
}

function loadSeenQuestionIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEEN_QUESTIONS_KEY) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function saveSeenQuestionIds(seenIds) {
  try {
    localStorage.setItem(SEEN_QUESTIONS_KEY, JSON.stringify(Array.from(seenIds)));
  } catch {
    // Fresh-question memory is a convenience only; quiz still works without storage.
  }
}

function normalizeQuestionSignature(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true;
}

function readInstallPromptState() {
  try {
    return localStorage.getItem(INSTALL_PROMPT_KEY) || 'fresh';
  } catch {
    return 'fresh';
  }
}

function writeInstallPromptState(value) {
  try {
    localStorage.setItem(INSTALL_PROMPT_KEY, value);
  } catch {
    // Optional only. The install prompt still works without persistent storage.
  }
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalizeDifficulty(value) {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('hard')) return 'Sulit';
  if (raw.includes('medium')) return 'Sedang';
  if (raw.includes('easy')) return 'Mudah';
  return 'Latihan';
}

function cleanQuestionText(text) {
  return String(text || '')
    .replace(/^\s*bacalah\s+stimulus\s+berikut\s*[.:!\-–—]*\s*/i, '')
    .replace(/^\s*stimulus\s*[.:!\-–—]*\s*/i, '')
    .replace(/\n\s*bacalah\s+stimulus\s+berikut\s*[.:!\-–—]*\s*/gi, '\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function flattenQuestionBanks(data) {
  const banks = Array.isArray(data) ? data : [data];
  const seenSignatures = new Set();
  const flattened = banks.flatMap((bank) => {
    const bankId = bank?.bankId || 'bank';
    const subject = bank?.subject || 'Latihan';
    const questions = Array.isArray(bank?.questions) ? bank.questions : [];

    return questions
      .filter((question) => {
        return question?.questionType === 'single-choice'
          && typeof question?.questionText === 'string'
          && question.questionText.trim().length > 0
          && Array.isArray(question?.options)
          && question.options.length >= 2
          && typeof question?.answer === 'string';
      })
      .map((question) => ({
        id: `${bankId}:${question.id || question.questionText}`,
        rawId: question.id,
        subject: question.subject || subject,
        topic: question.topic || question.subtopic || 'Campuran',
        difficulty: normalizeDifficulty(question.difficulty),
        questionText: cleanQuestionText(question.questionText),
        explanationText: question.explanationText || 'Jawaban benar sudah ditandai hijau.',
        answerKey: question.answer,
        options: question.options
          .filter((option) => typeof option?.key === 'string' && typeof option?.text === 'string')
          .map((option) => ({
            key: option.key,
            text: option.text,
            image: option.image || null
          }))
      }))
      .filter((question) => question.options.some((option) => option.key === question.answerKey));
  });

  return flattened.filter((question) => {
    const signature = normalizeQuestionSignature(`${question.questionText} ${question.options.map((option) => option.text).join(' ')}`);
    if (!signature || seenSignatures.has(signature)) return false;
    seenSignatures.add(signature);
    return true;
  });
}


function prepareQuizQuestions(pool, seenIds, count = QUIZ_SIZE) {
  if (!pool.length) return [];

  // Keep questions fresh for as long as possible. When the child has already seen
  // almost the whole bank, old questions may reappear so the game never gets stuck.
  const fresh = pool.filter((question) => !seenIds.has(question.id));
  const freshSelection = shuffle(fresh).slice(0, count);
  const selectedIds = new Set(freshSelection.map((question) => question.id));
  const repeatSelection = freshSelection.length < count
    ? shuffle(pool.filter((question) => !selectedIds.has(question.id))).slice(0, count - freshSelection.length)
    : [];
  const selected = [...freshSelection, ...repeatSelection].map((question) => {
    seenIds.add(question.id);
    return {
      ...question,
      options: shuffle(question.options)
    };
  });

  if (seenIds.size >= Math.floor(pool.length * 0.92)) {
    const keepRecent = selected.map((question) => question.id);
    seenIds.clear();
    keepRecent.forEach((id) => seenIds.add(id));
  }
  saveSeenQuestionIds(seenIds);
  return selected;
}

function FittedQuestionText({ text }) {
  const textRef = useRef(null);

  useLayoutEffect(() => {
    const textNode = textRef.current;
    if (!textNode) return undefined;
    const board = textNode.closest('.quiz-question');
    if (!board) return undefined;

    const fit = () => {
      const countNode = board.querySelector('.quiz-question-count');
      const boardStyle = window.getComputedStyle(board);
      const paddingX = parseFloat(boardStyle.paddingLeft) + parseFloat(boardStyle.paddingRight);
      const paddingY = parseFloat(boardStyle.paddingTop) + parseFloat(boardStyle.paddingBottom);
      const availableWidth = Math.max(120, board.clientWidth - paddingX);
      const availableHeight = Math.max(90, board.clientHeight - paddingY - (countNode?.offsetHeight || 0) - 12);
      const textLength = String(text || '').length;
      const mobile = window.matchMedia('(max-width: 620px)').matches;
      const landscapeShort = window.matchMedia('(max-height: 560px)').matches;
      const minSize = mobile ? 18 : 20;
      const maxSize = mobile ? (textLength > 185 ? 30 : 39) : (textLength > 220 ? 34 : 48);
      let low = minSize;
      let high = landscapeShort ? Math.min(maxSize, 32) : maxSize;

      textNode.style.width = `${availableWidth}px`;
      textNode.style.maxWidth = `${availableWidth}px`;
      textNode.style.maxHeight = `${availableHeight}px`;
      textNode.style.overflow = 'hidden';

      for (let i = 0; i < 12; i += 1) {
        const mid = (low + high) / 2;
        textNode.style.setProperty('font-size', `${mid}px`, 'important');
        textNode.style.setProperty('line-height', textLength > 170 ? '1.08' : '1.1', 'important');
        const fits = textNode.scrollHeight <= availableHeight + 1 && textNode.scrollWidth <= availableWidth + 1;
        if (fits) low = mid;
        else high = mid;
      }

      textNode.style.setProperty('font-size', `${Math.floor(low)}px`, 'important');
    };

    const raf = window.requestAnimationFrame(fit);
    const resizeObserver = new ResizeObserver(() => window.requestAnimationFrame(fit));
    resizeObserver.observe(board);
    window.addEventListener('resize', fit);
    return () => {
      window.cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [text]);

  return <h2 ref={textRef}>{text}</h2>;
}


function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d="M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z" fill="currentColor" />
    </svg>
  );
}

function ProgressDots({ total, current }) {
  return (
    <div className="quiz-dots" aria-label={`Soal ${current + 1} dari ${total}`}>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={index <= current ? 'active' : ''} />
      ))}
    </div>
  );
}

function ConfettiBurst({ burst }) {
  if (!burst) return null;
  const pieces = burst.level === 'gold' ? 84 : 68;
  return (
    <div key={burst.id} className={`confetti-layer ${burst.level || 'rainbow'}`} aria-hidden="true">
      {Array.from({ length: pieces }, (_, index) => {
        const side = index % 2 === 0 ? 0 : 1;
        const origin = side === 0 ? 18 + ((index * 7) % 12) : 82 - ((index * 11) % 12);
        const dxBase = side === 0 ? 90 + ((index * 29) % 220) : -90 - ((index * 31) % 220);
        return (
          <span
            key={index}
            className={`confetti-piece piece-${index % 8}`}
            style={{
              '--origin-x': `${origin}vw`,
              '--dx': `${dxBase}px`,
              '--dx2': `${Math.round(dxBase * 1.25)}px`,
              '--apex': `${52 + ((index * 13) % 30)}dvh`,
              '--delay': `${(index % 14) * 16}ms`,
              '--dur': `${1180 + (index % 8) * 78}ms`,
              '--rot': `${(index * 41) % 360}deg`,
              '--spin': `${540 + (index % 5) * 180}deg`
            }}
          />
        );
      })}
    </div>
  );
}



function PwaInstallPrompt({ canInstall, status, onInstall, onDismiss }) {
  const isManual = status === 'manual' || !canInstall;
  return (
    <div className="pwa-install-overlay" role="dialog" aria-modal="true" aria-label="Install Ayam SD">
      <div className="pwa-install-card">
        <div className="pwa-install-orbit" aria-hidden="true">
          <span className="pwa-chicken">🐔</span>
          <i className="spark s1">★</i>
          <i className="spark s2">✓</i>
          <i className="spark s3">🏅</i>
        </div>
        <div className="mini-badge gold">Bisa Offline</div>
        <h2>Install Ayam SD</h2>
        <p>Main lebih cepat, skor dan badge tersimpan, lalu bisa dimainkan lagi walau internet sedang tidak stabil.</p>
        <div className="pwa-benefits" aria-label="Manfaat install">
          <span>🏆 Skor tersimpan</span>
          <span>📴 Offline setelah dibuka</span>
          <span>🎮 Buka seperti aplikasi</span>
        </div>
        {isManual && (
          <small className="pwa-install-help">Gunakan menu browser lalu pilih <strong>Install app</strong> atau <strong>Add to Home Screen</strong>.</small>
        )}
        <div className="pwa-install-actions">
          <button type="button" className="pwa-install-primary" onClick={onInstall}>{canInstall ? 'Install Sekarang' : 'Oke, Saya Mengerti'}</button>
          <button type="button" className="pwa-install-later" onClick={onDismiss}>Nanti Saja</button>
        </div>
      </div>
    </div>
  );
}

function BadgeUnlockOverlay({ badge, onClose }) {
  if (!badge) return null;
  const tierLabel = `Tier ${badge.tier}`;
  return (
    <div className={`badge-unlock-overlay tier-${badge.tier}`} role="dialog" aria-live="polite" aria-label="Badge baru terbuka">
      <div className="badge-unlock-card">
        <div className="badge-aura" aria-hidden="true" />
        <div className="badge-emblem" aria-hidden="true">
          <span>{badge.emoji}</span>
        </div>
        <div className="mini-badge gold">Badge Baru</div>
        <h2>{badge.name}</h2>
        <p>{badge.copy}</p>
        <div className="badge-meta">
          <span>{badge.label}</span>
          <span>{tierLabel}</span>
        </div>
        <button type="button" className="badge-continue" onClick={onClose}>Lanjut Game</button>
      </div>
    </div>
  );
}


function getFamilyProgress(profile, family) {
  const tiers = family.tiers || [];
  const counterName = family.counter;
  const unlocked = new Set(profile?.unlockedBadges || []);
  const currentValue = Math.max(...tiers.map((tier) => Number(profile?.[tier.counter || counterName] || 0)), 0);
  const unlockedCount = tiers.filter((tier) => unlocked.has(tier.id)).length;
  const nextTier = tiers.find((tier) => !unlocked.has(tier.id));
  return {
    currentValue,
    unlockedCount,
    total: tiers.length,
    nextTier,
    percent: nextTier ? Math.min(100, Math.round((Number(profile?.[nextTier.counter || counterName] || 0) / nextTier.threshold) * 100)) : 100
  };
}

function buildShareText(profile) {
  const unlocked = profile?.unlockedBadges?.length || 0;
  const total = getBadgeCount();
  return `Aku sudah buka ${unlocked}/${total} badge di Ayam SD. Score terbaikku ${profile?.bestRunScore || 0}. Yuk main dan belajar bareng!`;
}

function BadgeBoardOverlay({ profile, onClose }) {
  const [shareState, setShareState] = useState('idle');
  const unlocked = new Set(profile?.unlockedBadges || []);
  const unlockedCount = profile?.unlockedBadges?.length || 0;
  const totalCount = getBadgeCount();

  const shareBoard = async () => {
    const textToShare = buildShareText(profile);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Ayam SD - Papan Badge', text: textToShare });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToShare);
      }
      setShareState('done');
      window.setTimeout(() => setShareState('idle'), 1400);
    } catch {
      setShareState('idle');
    }
  };

  return (
    <div className="badge-board-overlay" role="dialog" aria-label="Papan badge Ayam SD">
      <div className="badge-board-card">
        <div className="badge-board-head">
          <div>
            <span className="mini-badge gold">Papan Badge</span>
            <h2>Koleksi Prestasimu</h2>
            <p>{unlockedCount} dari {totalCount} badge terbuka. Badge gelap berarti masih terkunci.</p>
          </div>
          <button type="button" className="icon-close" onClick={onClose} aria-label="Tutup papan badge">×</button>
        </div>

        <div className="badge-board-summary">
          <div><strong>{profile?.bestRunScore || 0}</strong><span>Best Score</span></div>
          <div><strong>{profile?.nearMisses || 0}</strong><span>Nyaris</span></div>
          <div><strong>{profile?.totalCorrectAnswers || 0}</strong><span>Jawaban Benar</span></div>
          <div><strong>{unlockedCount}</strong><span>Badge</span></div>
        </div>

        <div className="badge-family-list">
          {BADGE_FAMILIES.map((family) => {
            const progress = getFamilyProgress(profile, family);
            return (
              <section className="badge-family-card" key={family.family}>
                <div className="badge-family-title">
                  <div>
                    <strong>{family.label}</strong>
                    <small>{progress.unlockedCount}/{progress.total} terbuka</small>
                  </div>
                  <span>{progress.nextTier ? `${progress.currentValue}/${progress.nextTier.threshold}` : 'Selesai'}</span>
                </div>
                <div className="badge-family-progress" aria-hidden="true"><i style={{ width: `${progress.percent}%` }} /></div>
                <div className="badge-grid">
                  {family.tiers.map((badge) => {
                    const isUnlocked = unlocked.has(badge.id);
                    const counterValue = Number(profile?.[badge.counter || family.counter] || 0);
                    const pct = Math.min(100, Math.round((counterValue / badge.threshold) * 100));
                    return (
                      <div className={`badge-tile ${isUnlocked ? 'unlocked' : 'locked'} tier-${badge.tier}`} key={badge.id}>
                        <div className="badge-tile-medal"><span>{badge.emoji}</span></div>
                        <strong>{badge.name}</strong>
                        <small>{isUnlocked ? 'Terbuka' : `${counterValue}/${badge.threshold}`}</small>
                        {!isUnlocked && <div className="badge-tile-lock"><i style={{ width: `${pct}%` }} /></div>}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <div className="badge-board-actions">
          <button type="button" className="badge-share-button" onClick={shareBoard}>{shareState === 'done' ? 'Teks Disalin!' : 'Bagikan Progress'}</button>
          <button type="button" className="badge-continue" onClick={onClose}>Kembali</button>
        </div>
      </div>
    </div>
  );
}

function questionLengthClass(questionText = '') {
  const length = String(questionText || '').length;
  if (length > 190) return 'q-xxlong';
  if (length > 145) return 'q-xlong';
  if (length > 105) return 'q-long';
  if (length > 72) return 'q-medium';
  return 'q-short';
}

function questionFitStyle(questionText = '') {
  const length = String(questionText || '').length;
  const size = Math.max(17, Math.min(44, Math.round(560 / Math.max(13, Math.sqrt(length) * 3.25))));
  return { '--question-fit-size': `${size}px` };
}

function runWhenIdle(callback, timeout = 900) {
  if (typeof window === 'undefined') return 0;
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, { timeout });
  }
  return window.setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 0 }), 32);
}

function cancelIdleTask(id) {
  if (!id || typeof window === 'undefined') return;
  if ('cancelIdleCallback' in window) window.cancelIdleCallback(id);
  else window.clearTimeout(id);
}

const HAPTIC_PATTERNS = Object.freeze({
  start: 12,
  jump: 8,
  blocked: [10, 24, 10],
  nearMiss: 16,
  traffic: [28, 32, 34],
  train: [45, 38, 58],
  water: [22, 30, 28],
  reward: [18, 35, 18],
  quizCorrect: 10,
  quizWrong: [18, 38, 24]
});

function runHaptic(patternName, enabled = true) {
  if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
  const pattern = HAPTIC_PATTERNS[patternName] ?? patternName;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}


export default function VoxelCrossing({
  title = 'Ayam SD',
  subtitle = 'Menyeberang, belajar, dan buka badge keren. Main terus, jawab soal, dan jadikan ayam kecilmu makin jago.',
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
  const questionPoolRef = useRef(null);
  const seenQuestionIdsRef = useRef(loadSeenQuestionIds());
  const quizStartingRef = useRef(false);
  const gameOverCycleRef = useRef(0);
  const quizActiveMountedRef = useRef(false);
  const confettiTimerRef = useRef(null);
  const nearMissTimerRef = useRef(null);
  const badgeQueueRef = useRef([]);
  const badgeTimerRef = useRef(null);
  const pendingBadgeShowTimerRef = useRef(null);
  const badgePausedGameRef = useRef(false);
  const startMusicTimerRef = useRef(null);
  const restartPrepareTaskRef = useRef(null);
  const deferredAudioTaskRef = useRef(null);
  const deferredAudioTimerRef = useRef(null);
  const deferredAudioFrameRef = useRef(null);
  const resumeFramesRef = useRef([]);
  const startFramesRef = useRef([]);
  const startedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [impacting, setImpacting] = useState(false);
  const [impactReason, setImpactReason] = useState('traffic');
  const [result, setResult] = useState(null);
  const [score, setScore] = useState(0);
  const [lastRunScore, setLastRunScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [lifeBlinkIndex, setLifeBlinkIndex] = useState(null);
  const [orientationHint, setOrientationHint] = useState('landscape');
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(() => loadSettings());
  const settingsRef = useRef(settings);
  const [savedGame, setSavedGame] = useState(() => loadSavedGame());
  const [saveNotice, setSaveNotice] = useState('');
  const [quizDue, setQuizDue] = useState(false);
  const [quizReveal, setQuizReveal] = useState(false);
  const [gameOversUntilQuiz, setGameOversUntilQuiz] = useState(GAME_OVERS_BEFORE_QUIZ);
  const [quiz, setQuiz] = useState(QUIZ_INITIAL);
  const [confettiBurst, setConfettiBurst] = useState(null);
  const [nearMissBurst, setNearMissBurst] = useState(null);
  const [playerProfile, setPlayerProfile] = useState(() => loadPlayerProfile());
  const [activeBadge, setActiveBadge] = useState(null);
  const [badgeBoardOpen, setBadgeBoardOpen] = useState(false);
  const playerProfileRef = useRef(playerProfile);
  const deferredInstallPromptRef = useRef(null);
  const pwaPromptTimerRef = useRef(null);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [pwaPromptVisible, setPwaPromptVisible] = useState(false);
  const [pwaPromptStatus, setPwaPromptStatus] = useState('ready');
  const [standalonePwa, setStandalonePwa] = useState(() => isStandaloneDisplay());

  const livesRef = useRef(MAX_LIVES);
  const lifeBlinkTimerRef = useRef(null);

  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);

  useEffect(() => {
    startedRef.current = started;
  }, [started]);

  useEffect(() => {
    if (isStandaloneDisplay()) {
      setStandalonePwa(true);
      return undefined;
    }

    const installState = readInstallPromptState();
    const shouldInvite = installState !== 'dismissed' && installState !== 'installed';

    const showPromptSoon = (delay = 950) => {
      if (!shouldInvite) return;
      if (pwaPromptTimerRef.current) window.clearTimeout(pwaPromptTimerRef.current);
      pwaPromptTimerRef.current = window.setTimeout(() => {
        // Never compete with the first gameplay frame. Install prompts can wait
        // until the player opens menu or reaches a calm state.
        if (gameRef.current?.isPlaying && !gameRef.current?.isGameOver) return;
        setPwaPromptVisible(true);
      }, delay);
    };

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      deferredInstallPromptRef.current = event;
      setCanInstallPwa(true);
      setPwaPromptStatus('ready');
      showPromptSoon(560);
    };

    const handleAppInstalled = () => {
      deferredInstallPromptRef.current = null;
      setCanInstallPwa(false);
      setStandalonePwa(true);
      setPwaPromptVisible(false);
      writeInstallPromptState('installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    showPromptSoon(1350);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (pwaPromptTimerRef.current) window.clearTimeout(pwaPromptTimerRef.current);
    };
  }, []);

  const installPwa = async () => {
    if (!canInstallPwa || !deferredInstallPromptRef.current) {
      setPwaPromptStatus('manual');
      writeInstallPromptState('dismissed');
      if (!canInstallPwa) window.setTimeout(() => setPwaPromptVisible(false), 1400);
      return;
    }

    const promptEvent = deferredInstallPromptRef.current;
    deferredInstallPromptRef.current = null;
    setPwaPromptStatus('installing');
    promptEvent.prompt();
    const choice = await promptEvent.userChoice.catch(() => ({ outcome: 'dismissed' }));
    if (choice?.outcome === 'accepted') {
      writeInstallPromptState('installed');
      setStandalonePwa(true);
    }
    setCanInstallPwa(false);
    setPwaPromptVisible(false);
  };

  const dismissPwaPrompt = () => {
    writeInstallPromptState('dismissed');
    setPwaPromptVisible(false);
  };

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
    settingsRef.current = settings;
    saveSettings(settings);
    audioRef.current?.setMusicEnabled(settings.musicEnabled);
    audioRef.current?.setSfxEnabled(settings.sfxEnabled);
    gameRef.current?.setCheatMode?.(settings.cheatMode);
  }, [settings]);

  const cancelDeferredResume = () => {
    if (!resumeFramesRef.current.length) return;
    resumeFramesRef.current.forEach((frameId) => window.cancelAnimationFrame(frameId));
    resumeFramesRef.current = [];
  };

  const resumeEngineAfterMenuPaint = () => {
    cancelDeferredResume();
    cancelDeferredStart();
    const firstFrame = window.requestAnimationFrame(() => {
      const secondFrame = window.requestAnimationFrame(() => {
        resumeFramesRef.current = [];
        if (gameOver || impacting || !gameRef.current) return;
        gameRef.current.resume();
      });
      resumeFramesRef.current = [secondFrame];
    });
    resumeFramesRef.current = [firstFrame];
  };

  const cancelDeferredStart = () => {
    if (!startFramesRef.current.length) return;
    startFramesRef.current.forEach((frameId) => window.cancelAnimationFrame(frameId));
    startFramesRef.current = [];
  };

  const cancelDeferredAudioUnlock = () => {
    if (deferredAudioTimerRef.current) {
      window.clearTimeout(deferredAudioTimerRef.current);
      deferredAudioTimerRef.current = null;
    }
    if (deferredAudioFrameRef.current) {
      window.cancelAnimationFrame(deferredAudioFrameRef.current);
      deferredAudioFrameRef.current = null;
    }
    if (deferredAudioTaskRef.current) {
      cancelIdleTask(deferredAudioTaskRef.current);
      deferredAudioTaskRef.current = null;
    }
  };

  const startEngineAfterIntroPaint = () => {
    cancelDeferredStart();
    const firstFrame = window.requestAnimationFrame(() => {
      const secondFrame = window.requestAnimationFrame(() => {
        startFramesRef.current = [];
        if (!gameRef.current || menuOpen) return;
        gameRef.current.start();
        runHaptic('start', settingsRef.current.hapticsEnabled);
      });
      startFramesRef.current = [secondFrame];
    });
    startFramesRef.current = [firstFrame];
  };

  useEffect(() => () => {
    if (confettiTimerRef.current) window.clearTimeout(confettiTimerRef.current);
    if (nearMissTimerRef.current) window.clearTimeout(nearMissTimerRef.current);
    if (lifeBlinkTimerRef.current) window.clearTimeout(lifeBlinkTimerRef.current);
    if (badgeTimerRef.current) window.clearTimeout(badgeTimerRef.current);
    if (pendingBadgeShowTimerRef.current) window.clearTimeout(pendingBadgeShowTimerRef.current);
    if (pwaPromptTimerRef.current) window.clearTimeout(pwaPromptTimerRef.current);
    if (startMusicTimerRef.current) window.clearTimeout(startMusicTimerRef.current);
    if (restartPrepareTaskRef.current) cancelIdleTask(restartPrepareTaskRef.current);
    cancelDeferredAudioUnlock();
    cancelDeferredResume();
    cancelDeferredStart();
  }, []);

  const triggerConfetti = (level = 'rainbow') => {
    if (confettiTimerRef.current) window.clearTimeout(confettiTimerRef.current);
    setConfettiBurst({ id: Date.now(), level });
    confettiTimerRef.current = window.setTimeout(() => setConfettiBurst(null), 2100);
  };

  const showNextBadge = () => {
    if (badgeQueueRef.current.length === 0) return;
    if (pendingBadgeShowTimerRef.current) {
      window.clearTimeout(pendingBadgeShowTimerRef.current);
      pendingBadgeShowTimerRef.current = null;
    }

    const [nextBadge, ...remaining] = badgeQueueRef.current;
    badgeQueueRef.current = remaining;
    badgePausedGameRef.current = Boolean(started && !gameOver && !impacting);
    if (badgePausedGameRef.current) gameRef.current?.pause();

    setActiveBadge(nextBadge);
    triggerConfetti(nextBadge.tier >= 3 ? 'gold' : 'rainbow');
    audioRef.current?.kidsYayReward?.(nextBadge.tier >= 3 ? 3 : 2);
  };

  const enqueueBadges = (badges) => {
    if (!badges?.length) return;
    badgeQueueRef.current = [...badgeQueueRef.current, ...badges];
  };

  const schedulePendingBadgeCelebration = () => {
    if (badgeQueueRef.current.length === 0) return;
    if (pendingBadgeShowTimerRef.current) window.clearTimeout(pendingBadgeShowTimerRef.current);
    pendingBadgeShowTimerRef.current = window.setTimeout(() => {
      pendingBadgeShowTimerRef.current = null;
      showNextBadge();
    }, 500);
  };

  const closeBadge = () => {
    setActiveBadge(null);
    if (badgeTimerRef.current) window.clearTimeout(badgeTimerRef.current);
    badgeTimerRef.current = window.setTimeout(() => {
      if (badgeQueueRef.current.length > 0) {
        showNextBadge();
        return;
      }

      if (badgePausedGameRef.current && !gameOver && !impacting && !menuOpen) {
        gameRef.current?.resume();
      }
      badgePausedGameRef.current = false;
    }, 500);
  };

  const trackProfileEvent = (eventName, payload = {}) => {
    const next = trackBadgeEvent(playerProfileRef.current, eventName, payload);
    playerProfileRef.current = next.profile;
    savePlayerProfile(next.profile);
    setPlayerProfile(next.profile);
    if (next.newBadges.length) enqueueBadges(next.newBadges);
  };

  const triggerNearMiss = () => {
    if (nearMissTimerRef.current) window.clearTimeout(nearMissTimerRef.current);
    setNearMissBurst({ id: Date.now() });
    runHaptic('nearMiss', settingsRef.current.hapticsEnabled);
    audioRef.current?.nearMiss?.();
    trackProfileEvent('near_miss');
    nearMissTimerRef.current = window.setTimeout(() => setNearMissBurst(null), 980);
  };

  const unlockAudio = ({ allowMusic = true } = {}) => {
    const quizMusicLocked = quizDue || ACTIVE_QUIZ_STATES.has(quiz.status);
    audioRef.current?.setMusicSuppressed?.(!allowMusic || quizMusicLocked);
    audioRef.current?.unlock({ allowMusic: allowMusic && !quizMusicLocked });
  };

  const deferAudioUnlock = (options = {}, delayMs = 1600, idleTimeout = 2400) => {
    cancelDeferredAudioUnlock();

    // Keep the first movement visually sacred. AudioContext creation/resume is
    // useful for later SFX, but on some mobile browsers it can still block the
    // first active WebGL frame. We delay it until after the hop has painted.
    deferredAudioTimerRef.current = window.setTimeout(() => {
      deferredAudioTimerRef.current = null;
      deferredAudioFrameRef.current = window.requestAnimationFrame(() => {
        deferredAudioFrameRef.current = null;
        deferredAudioTaskRef.current = runWhenIdle(() => {
          deferredAudioTaskRef.current = null;
          unlockAudio({ ...options, allowMusic: false });
        }, idleTimeout);
      });
    }, delayMs);
  };

  const deferMusicResume = (delayMs = 1800) => {
    if (startMusicTimerRef.current) {
      window.clearTimeout(startMusicTimerRef.current);
      startMusicTimerRef.current = null;
    }
    startMusicTimerRef.current = window.setTimeout(() => {
      startMusicTimerRef.current = null;
      window.requestAnimationFrame(() => {
        runWhenIdle(() => {
          if (!gameRef.current || gameOver || impacting) return;
          if (quizDue || ACTIVE_QUIZ_STATES.has(quiz.status)) return;
          audioRef.current?.setMusicSuppressed?.(false);
          audioRef.current?.resumeMusic?.();
        }, 1800);
      });
    }, delayMs);
  };

  useEffect(() => {
    const isGameplayPointerTarget = (target) => {
      if (!target?.closest) return false;
      if (target.closest('.start-button, .menu-action, .icon-close, .settings-section, .pwa-install-overlay, .badge-board-overlay, .badge-unlock-overlay, input, textarea, select')) {
        return false;
      }
      return Boolean(target.closest('.vc-controls, .vc-canvas'));
    };

    const primeGameplayAudioFromTrustedGesture = (event) => {
      if (!ready || !startedRef.current || !audioRef.current) return;

      if (event.type === 'keydown') {
        if (!isPlayKey(event)) return;
        deferAudioUnlock({ allowMusic: false }, 2200, 2600);
        return;
      }

      if (!isGameplayPointerTarget(event.target)) return;
      deferAudioUnlock({ allowMusic: false }, 2200, 2600);
    };

    // Important: do not prime audio from the Start/Menu buttons. Creating or
    // resuming an AudioContext from the same tap that removes the intro overlay
    // can still block weaker mobile browsers for a few seconds. Audio is only
    // unlocked lazily after real gameplay controls have already painted.
    window.addEventListener('pointerdown', primeGameplayAudioFromTrustedGesture, { capture: true, passive: true });
    window.addEventListener('keydown', primeGameplayAudioFromTrustedGesture, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', primeGameplayAudioFromTrustedGesture, { capture: true });
      window.removeEventListener('keydown', primeGameplayAudioFromTrustedGesture, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, quiz.status, quizDue]);

  async function loadQuestionPool() {
    if (questionPoolRef.current) return questionPoolRef.current;
    const baseUrl = (import.meta.env?.BASE_URL || '/').replace(/\/?$/, '/');
    const response = await fetch(`${baseUrl}data/questionBanks.json`, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Question bank failed to load: ${response.status}`);
    const data = await response.json();
    const pool = flattenQuestionBanks(data);
    if (!pool.length) throw new Error('Question bank is empty.');
    questionPoolRef.current = pool;
    return pool;
  }

  async function beginQuizSession() {
    if (quizStartingRef.current) return;
    quizStartingRef.current = true;
    setQuiz({ ...QUIZ_INITIAL, status: 'loading', loading: true });

    try {
      const pool = await loadQuestionPool();
      const questions = prepareQuizQuestions(pool, seenQuestionIdsRef.current, QUIZ_SIZE);
      setQuiz({
        ...QUIZ_INITIAL,
        status: 'running',
        loading: false,
        questions,
        index: 0
      });
    } catch (error) {
      setQuiz({
        ...QUIZ_INITIAL,
        status: 'error',
        error: error instanceof Error ? error.message : 'Quiz belum bisa dimuat.'
      });
    } finally {
      quizStartingRef.current = false;
    }
  }

  useEffect(() => {
    if (!hostRef.current) return undefined;

    const game = new RoadQuestGame(hostRef.current, {
      enableMilestoneCallback,
      milestoneEvery,
      cheatMode: settings.cheatMode,
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
        runHaptic(reason === 'train' ? 'train' : reason === 'water' ? 'water' : 'traffic', settingsRef.current.hapticsEnabled);
        audioRef.current?.hit(reason);
      },
      onMoveStart: () => {
        runHaptic('jump', settingsRef.current.hapticsEnabled);
        audioRef.current?.jump();
        deferMusicResume(7000);
      },
      onHazardSound: ({ kind }) => {
        if (kind === 'carHorn') audioRef.current?.carHorn();
        if (kind === 'train') audioRef.current?.trainPass(false);
        if (kind === 'bulletTrain') audioRef.current?.trainPass(true);
        if (kind === 'trainHorn') audioRef.current?.trainHorn();
      },
      onNearMiss: triggerNearMiss,
      onRespawn: () => {
        setImpacting(false);
        setGameOver(false);
        setStarted(true);
        setResult(null);
      },
      onGameOver: (nextResult) => {
        if (livesRef.current > 0 && game.continueAfterLife?.()) {
          const nextLives = Math.max(0, livesRef.current - 1);
          livesRef.current = nextLives;
          setLives(nextLives);
          setLifeBlinkIndex(nextLives);
          if (lifeBlinkTimerRef.current) window.clearTimeout(lifeBlinkTimerRef.current);
          lifeBlinkTimerRef.current = window.setTimeout(() => {
            setLifeBlinkIndex(null);
            lifeBlinkTimerRef.current = null;
          }, 920);
          setImpacting(false);
          setGameOver(false);
          setStarted(true);
          setResult(null);
          setQuizDue(false);
          setQuizReveal(false);
          setSaveNotice(nextLives > 0 ? `Nyawa tersisa ${nextLives}` : 'Kesempatan terakhir');
          window.setTimeout(() => setSaveNotice(''), 1200);
          return;
        }

        const nextCycleCount = gameOverCycleRef.current + 1;
        const shouldStartQuiz = nextCycleCount >= GAME_OVERS_BEFORE_QUIZ;
        gameOverCycleRef.current = shouldStartQuiz ? 0 : nextCycleCount;

        setImpacting(false);
        setGameOver(true);
        setStarted(false);
        setMenuOpen(false);
        setSettingsOpen(false);
        setResult(nextResult);
        setScore(nextResult.score);
        setLastRunScore(nextResult.score);
        setQuizDue(shouldStartQuiz);
        setQuizReveal(false);
        setGameOversUntilQuiz(shouldStartQuiz ? 0 : GAME_OVERS_BEFORE_QUIZ - nextCycleCount);
        trackProfileEvent('game_over', { score: nextResult.score });
        if (restartPrepareTaskRef.current) cancelIdleTask(restartPrepareTaskRef.current);
        // Prepare the next run behind the result card, not when the child taps
        // Mulai Main. A short idle timeout avoids restart-button freezes while the
        // visible result overlay masks the rebuild cost on weaker phones.
        restartPrepareTaskRef.current = runWhenIdle(() => {
          restartPrepareTaskRef.current = null;
          gameRef.current?.prepareRestart?.();
        }, 180);
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

  useEffect(() => {
    if (!gameOver || !result || menuOpen || !quizDue) return undefined;
    if (quiz.status !== 'idle') return undefined;

    const timer = window.setTimeout(() => {
      beginQuizSession();
    }, QUIZ_APPEAR_DELAY_MS);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, result, menuOpen, quizDue, quiz.status]);

  useEffect(() => {
    const quizMusicLocked = quizDue || ACTIVE_QUIZ_STATES.has(quiz.status);
    audioRef.current?.setMusicSuppressed?.(quizMusicLocked);
    if (quizMusicLocked) audioRef.current?.forceStopMusic?.();
  }, [quiz.status, quizDue]);

  useEffect(() => {
    const quizIsActive = ACTIVE_QUIZ_STATES.has(quiz.status);

    if (quizIsActive && !quizActiveMountedRef.current) {
      quizActiveMountedRef.current = true;
      setQuizReveal(false);
      const frame = window.requestAnimationFrame(() => setQuizReveal(true));
      return () => window.cancelAnimationFrame(frame);
    }

    if (!quizIsActive) {
      quizActiveMountedRef.current = false;
      setQuizReveal(false);
    }

    return undefined;
  }, [quiz.status]);

  const startGame = () => {
    const wasGameOver = gameOver && Boolean(result);

    if (restartPrepareTaskRef.current) {
      cancelIdleTask(restartPrepareTaskRef.current);
      restartPrepareTaskRef.current = null;
    }
    if (startMusicTimerRef.current) {
      window.clearTimeout(startMusicTimerRef.current);
      startMusicTimerRef.current = null;
    }

    // Start must stay frame-safe. Do not unlock audio, fetch media, start music,
    // or even resume the WebGL engine in this click handler. First paint the
    // game screen, then start the engine two animation frames later.
    menuPausedRef.current = false;
    setStarted(true);
    setPwaPromptVisible(false);
    setMenuOpen(false);
    setSettingsOpen(false);
    setBadgeBoardOpen(false);
    setImpacting(false);
    setGameOver(false);
    setResult(null);
    livesRef.current = MAX_LIVES;
    setLives(MAX_LIVES);
    setLifeBlinkIndex(null);
    setQuizDue(false);
    setQuizReveal(false);
    setQuiz(QUIZ_INITIAL);
    setScore(0);
    setLastRunScore(0);
    startEngineAfterIntroPaint();

    // BGM is intentionally not started inside the Start click/pointerdown path.
    // The MP3 music file is started later, after the child makes a movement, so
    // the Start tap stays a pure visual transition with no media fetch/decode.

    // Keep storage/profile work off the first visual frame. Audio is unlocked
    // later on an idle task after movement/resume/settings, never on Start/Menu open.
    window.requestAnimationFrame(() => {
      runWhenIdle(() => {
        if (wasGameOver) trackProfileEvent('restart_after_game_over');
        trackProfileEvent('run_started');
        schedulePendingBadgeCelebration();
      }, 1000);
    });
  };

  const saveGame = () => {
    const saveState = gameRef.current?.getSaveState?.({ lives });
    if (!saveState) return;
    writeSavedGame(saveState);
    setSavedGame(saveState);
    setSaveNotice(`Tersimpan di score ${saveState.score}`);
    window.setTimeout(() => setSaveNotice(''), 1500);
  };

  const continueSavedGame = () => {
    const saveState = savedGame || loadSavedGame();
    if (!saveState) return;
    gameRef.current?.loadSaveState?.(saveState, true);
    menuPausedRef.current = false;
    setMenuOpen(false);
    setSettingsOpen(false);
    setBadgeBoardOpen(false);
    setImpacting(false);
    setGameOver(false);
    setResult(null);
    setQuizDue(false);
    setQuizReveal(false);
    setQuiz(QUIZ_INITIAL);
    setStarted(true);
    const restoredLives = normalizeLives(saveState.lives);
    livesRef.current = restoredLives;
    setLives(restoredLives);
    setLifeBlinkIndex(null);
    setScore(saveState.score || saveState.row || 0);
    setLastRunScore(saveState.score || saveState.row || 0);
    deferAudioUnlock({ allowMusic: false }, 1400);
    deferMusicResume(1800);
  };

  const resumeGame = ({ deferEngine = false } = {}) => {
    if (impacting) return;
    menuPausedRef.current = false;
    setMenuOpen(false);
    setSettingsOpen(false);
    setBadgeBoardOpen(false);
    setStarted(true);

    // Closing the menu must paint first, then resume WebGL. Running the engine
    // in the same input handler as the React menu unmount can make mobile
    // browsers show a frozen frame for several seconds on weaker GPUs.
    if (deferEngine) resumeEngineAfterMenuPaint();
    else gameRef.current?.resume();
  };

  const pauseGame = ({ keepStarted = false } = {}) => {
    if (impacting) return;
    cancelDeferredResume();
    gameRef.current?.pause();
    if (!keepStarted) setStarted(false);
  };

  const openMenu = () => {
    if (impacting) return;
    // Menu must be a pure UI transition. Do not unlock audio, preload media,
    // write storage, or rebuild scene here; those can create long tasks on
    // mobile and make the menu appear frozen.
    menuPausedRef.current = Boolean(started && !gameOver);
    if (started && !gameOver) pauseGame({ keepStarted: true });
    setSettingsOpen(false);
    setBadgeBoardOpen(false);
    setPwaPromptVisible(false);
    setMenuOpen(true);
  };

  const closeMenu = ({ resume = false } = {}) => {
    if (resume && menuPausedRef.current && !gameOver && ready && !impacting) {
      resumeGame({ deferEngine: true });
      return;
    }
    menuPausedRef.current = false;
    setMenuOpen(false);
    setSettingsOpen(false);
    setBadgeBoardOpen(false);
  };

  const resetHighScore = () => {
    const next = gameRef.current?.resetHighScore?.() ?? 0;
    setHighScore(next);
    setResult((current) => current ? { ...current, highScore: next, previousHighScore: 0, isNewHighScore: false } : current);
  };

  const updateSetting = (key, value) => {
    deferAudioUnlock({ allowMusic: !ACTIVE_QUIZ_STATES.has(quiz.status) && !quizDue }, 1400);
    setSettings((current) => ({ ...current, [key]: Boolean(value) }));
  };

  const move = (direction) => {
    if (impacting || menuOpen || gameOver || activeBadge) return;
    if (!started && !gameOver) resumeGame();
    const accepted = gameRef.current?.queueMove(direction) === true;
    if (!accepted) runHaptic('blocked', settingsRef.current.hapticsEnabled);
    deferAudioUnlock({ allowMusic: false }, 1400);
    deferMusicResume(1800);
  };

  const handleControlPointer = (event, direction) => {
    event.preventDefault();
    move(direction);
  };

  const answerCurrentQuestion = (answerKey) => {
    if (quiz.status !== 'running' || quiz.selectedKey) return;
    unlockAudio({ allowMusic: false });
    audioRef.current?.setMusicSuppressed?.(true);
    audioRef.current?.forceStopMusic?.();
    const question = quiz.questions[quiz.index];
    const isCorrect = answerKey === question.answerKey;
    if (isCorrect) {
      runHaptic('quizCorrect', settingsRef.current.hapticsEnabled);
      audioRef.current?.quizCorrect();
      trackProfileEvent('quiz_correct');
    } else {
      runHaptic('quizWrong', settingsRef.current.hapticsEnabled);
      audioRef.current?.quizWrong();
    }
    setQuiz((current) => ({
      ...current,
      selectedKey: answerKey,
      correctCount: current.correctCount + (isCorrect ? 1 : 0),
      lastCorrect: isCorrect
    }));
  };

  const nextQuizStep = () => {
    audioRef.current?.setMusicSuppressed?.(true);
    audioRef.current?.forceStopMusic?.();
    if (quiz.status !== 'running' || !quiz.selectedKey) return;
    if (quiz.index >= quiz.questions.length - 1) {
      const stars = quiz.correctCount >= 5 ? 3 : quiz.correctCount >= 3 ? 2 : quiz.correctCount >= 1 ? 1 : 0;
      audioRef.current?.quizComplete(quiz.correctCount);
      if (stars >= 2) {
        runHaptic('reward', settingsRef.current.hapticsEnabled);
        audioRef.current?.kidsYayReward(stars);
        triggerConfetti(stars >= 3 ? 'gold' : 'rainbow');
      }
      trackProfileEvent('quiz_finished', { stars });
      setQuiz((current) => ({ ...current, status: 'complete', selectedKey: null, lastCorrect: null }));
      return;
    }
    setQuiz((current) => ({
      ...current,
      index: current.index + 1,
      selectedKey: null,
      lastCorrect: null
    }));
  };

  useEffect(() => {
    const handler = (event) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select';
      if (isTyping || menuOpen || !ready || impacting || activeBadge) return;
      if (gameOver && (quizDue || ACTIVE_QUIZ_STATES.has(quiz.status))) return;
      if ((gameOver || !started) && isPlayKey(event)) {
        event.preventDefault();
        startGame();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [gameOver, impacting, menuOpen, quiz.status, quizDue, ready, started]);

  useEffect(() => {
    if (!gameOver || !result?.isNewHighScore) return undefined;
    const timers = [0, 1, 2].map((index) => window.setTimeout(() => {
      audioRef.current?.rewardStar(index);
    }, 420 + index * 360));
    timers.push(window.setTimeout(() => {
      audioRef.current?.rewardComplete();
      audioRef.current?.kidsYayReward(3);
      triggerConfetti('gold');
    }, 1630));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [gameOver, result?.isNewHighScore]);

  const visibleScore = gameOver ? (result?.score ?? lastRunScore) : score;
  const resultScore = result?.score ?? lastRunScore;
  const resultReasonText = result?.reason === 'water'
    ? 'Ayam tercebur sungai. Tunggu plank berikutnya dan jangan terlalu lama berdiri di atas plank.'
    : result?.reason === 'train'
      ? 'Kereta melintas sangat cepat. Amati ritmenya sebelum menyeberang rel.'
      : 'Tertabrak kendaraan. Perhatikan jarak dan kecepatan lane sebelum melompat.';

  const currentQuizQuestion = quiz.questions[quiz.index];
  const quizAnswered = Boolean(quiz.selectedKey);
  const quizTotal = quiz.questions.length || QUIZ_SIZE;
  const learningStars = quiz.correctCount >= 5 ? 3 : quiz.correctCount >= 3 ? 2 : quiz.correctCount >= 1 ? 1 : 0;

  return (
    <section className={`vc-shell ${orientationHint} ${menuOpen ? 'menu-open' : ''} ${impacting ? `impact ${impactReason}` : ''} ${className}`}>
      <div ref={hostRef} className="vc-host" />
      <ConfettiBurst burst={confettiBurst} />
      <BadgeUnlockOverlay badge={activeBadge} onClose={closeBadge} />
      {pwaPromptVisible && !standalonePwa && (
        <PwaInstallPrompt
          canInstall={canInstallPwa}
          status={pwaPromptStatus}
          onInstall={installPwa}
          onDismiss={dismissPwaPrompt}
        />
      )}
      {nearMissBurst && (
        <div key={nearMissBurst.id} className="near-miss-stinger" aria-hidden="true">
          <span>NYARIS!</span>
        </div>
      )}

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

      <div className="life-hud" aria-label={`Nyawa tersisa ${lives} dari ${MAX_LIVES}`}>
        {Array.from({ length: MAX_LIVES }, (_, index) => {
          const stateClass = index < lives ? 'active' : index === lifeBlinkIndex ? 'lost' : 'spent';
          return <span key={index} className={stateClass} aria-hidden="true">♥</span>;
        })}
      </div>

      <button
        type="button"
        className={`menu-button ${menuOpen ? 'active' : ''}`}
        aria-label="Buka menu"
        aria-expanded={menuOpen}
        onPointerDown={(event) => {
          event.preventDefault();
          if (menuOpen) closeMenu({ resume: menuPausedRef.current });
          else openMenu();
        }}
      >
        <MenuIcon />
      </button>

      {menuOpen && (
        <div className="menu-panel" role="dialog" aria-label="Menu game">
          <div className="menu-head">
            <div>
              <strong>Menu</strong>
              <span>{menuPausedRef.current ? 'Game dijeda' : 'Atur game'}</span>
            </div>
            <button type="button" className="icon-close" onClick={() => closeMenu({ resume: menuPausedRef.current })} aria-label="Tutup menu">×</button>
          </div>

          <div className="badge-progress-pill" aria-label={`Badge terbuka ${playerProfile.unlockedBadges.length} dari ${getBadgeCount()}`}>
            <span>🏅</span>
            <strong>{playerProfile.unlockedBadges.length}/{getBadgeCount()}</strong>
            <small>Badge terbuka</small>
          </div>

          <div className="menu-actions">
            {menuPausedRef.current ? (
              <button type="button" className="menu-action primary" onClick={() => resumeGame({ deferEngine: true })}>Lanjutkan</button>
            ) : (
              <button type="button" className="menu-action primary" onClick={startGame} disabled={!ready}>Mulai Main</button>
            )}
            <button type="button" className="menu-action" onClick={startGame} disabled={!ready}>Restart</button>
            <button type="button" className="menu-action" onClick={saveGame} disabled={!ready || gameOver}>Save</button>
            <button type="button" className="menu-action" onClick={continueSavedGame} disabled={!ready || !savedGame}>Continue</button>
            <button type="button" className={`menu-action ${badgeBoardOpen ? 'active' : ''}`} onClick={() => { setSettingsOpen(false); setBadgeBoardOpen(true); }}>Papan Badge</button>
            {!standalonePwa && <button type="button" className="menu-action install" onClick={() => { setSettingsOpen(false); setBadgeBoardOpen(false); setPwaPromptVisible(true); }}>Install App</button>}
            <button type="button" className={`menu-action ${settingsOpen ? 'active' : ''}`} onClick={() => { setBadgeBoardOpen(false); setSettingsOpen((open) => !open); }}>Settings</button>
          </div>

          {saveNotice && <div className="menu-save-note" role="status">{saveNotice}</div>}

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

              <label className="setting-row">
                <span>
                  <strong>Haptic vibration</strong>
                  <small>Getar halus untuk lompat, hampir tertabrak, hit, dan reward di HP Android</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.hapticsEnabled}
                  onChange={(event) => updateSetting('hapticsEnabled', event.target.checked)}
                />
                <i aria-hidden="true" />
              </label>

              <label className="setting-row">
                <span>
                  <strong>QA cheat mode</strong>
                  <small>Impact respawn di posisi sama, ghost 1 detik</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.cheatMode}
                  onChange={(event) => updateSetting('cheatMode', event.target.checked)}
                />
                <i aria-hidden="true" />
              </label>

              <button type="button" className="reset-score-button" onClick={resetHighScore}>Reset high score</button>
            </div>
          )}
        </div>
      )}

      {badgeBoardOpen && (
        <BadgeBoardOverlay profile={playerProfile} onClose={() => setBadgeBoardOpen(false)} />
      )}

      <div className="vc-controls" aria-label="Kontrol game">
        <button type="button" className="control up" aria-label="Maju" onPointerDown={(event) => handleControlPointer(event, 'forward')} disabled={impacting || menuOpen || gameOver || Boolean(activeBadge)}>▲</button>
        <button type="button" className="control left" aria-label="Kiri" onPointerDown={(event) => handleControlPointer(event, 'left')} disabled={impacting || menuOpen || gameOver || Boolean(activeBadge)}>◀</button>
        <button type="button" className="control down" aria-label="Mundur" onPointerDown={(event) => handleControlPointer(event, 'backward')} disabled={impacting || menuOpen || gameOver || Boolean(activeBadge)}>▼</button>
        <button type="button" className="control right" aria-label="Kanan" onPointerDown={(event) => handleControlPointer(event, 'right')} disabled={impacting || menuOpen || gameOver || Boolean(activeBadge)}>▶</button>
      </div>

      {impacting && (
        <div className={`impact-stinger ${impactReason}`} aria-hidden="true">
          <span>{impactReason === 'train' ? 'KERETA!' : impactReason === 'water' ? 'JEBURR!' : 'TUBRUK!'}</span>
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

      {gameOver && !menuOpen && ACTIVE_QUIZ_STATES.has(quiz.status) && (
        <div className={`vc-overlay quiz ${quiz.status} ${quizReveal ? 'reveal' : ''} ${result?.isNewHighScore ? 'new-record' : ''}`}>
          <div className="quiz-card" role="dialog" aria-label="Quiz latihan">
            <div className="quiz-glow" aria-hidden="true" />
            <div className="quiz-topline" aria-label={`Progress quiz. Score ${resultScore}, best ${highScore}`}>
              <span className="quiz-score-pill"><strong>{resultScore}</strong><small>Score</small></span>
              <ProgressDots total={quizTotal} current={Math.min(quiz.index, quizTotal - 1)} />
              <span className="quiz-score-pill"><strong>{highScore}</strong><small>Best</small></span>
            </div>

            {result?.isNewHighScore && (
              <div className="quiz-record-banner" aria-live="polite">
                <div className="quiz-record-stars" aria-hidden="true"><span>★</span><span>★</span><span>★</span></div>
                <strong>Rekor Baru!</strong>
                <small>Fokusmu makin tajam.</small>
              </div>
            )}

            {quiz.status === 'loading' && (
              <div className="quiz-loading" aria-live="polite">
                <div className="quiz-loader-ring" aria-hidden="true" />
                <h2>Quiz siap dimulai</h2>
                <p>Jawab 5 soal. Lihat jawaban benar langsung setelah memilih.</p>
              </div>
            )}

            {quiz.status === 'running' && currentQuizQuestion && (
              <>
                <div className={`quiz-question ${questionLengthClass(currentQuizQuestion.questionText)}`} style={questionFitStyle(currentQuizQuestion.questionText)}>
                  <div className="quiz-question-count">Soal {quiz.index + 1} dari {quizTotal}</div>
                  <FittedQuestionText text={currentQuizQuestion.questionText} />
                </div>

                <div className="quiz-options">
                  {currentQuizQuestion.options.map((option, optionIndex) => {
                    const isCorrect = option.key === currentQuizQuestion.answerKey;
                    const isSelected = option.key === quiz.selectedKey;
                    const stateClass = quizAnswered
                      ? isCorrect
                        ? 'correct'
                        : isSelected
                          ? 'wrong'
                          : 'dimmed'
                      : '';
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`quiz-option option-${optionIndex + 1} ${stateClass} ${isSelected ? 'selected' : ''}`}
                        onClick={() => answerCurrentQuestion(option.key)}
                        disabled={quizAnswered}
                      >
                        <span className="quiz-option-key">{String.fromCharCode(65 + optionIndex)}</span>
                        <span className="quiz-option-text">{option.text}</span>
                        {quizAnswered && isCorrect && <span className="quiz-mark">✓</span>}
                        {quizAnswered && isSelected && !isCorrect && <span className="quiz-mark">×</span>}
                      </button>
                    );
                  })}
                </div>

                {quizAnswered && (
                  <div className={`quiz-feedback ${quiz.lastCorrect ? 'good' : 'try'}`} aria-live="polite">
                    <div className="quiz-feedback-title">
                      {quiz.lastCorrect ? 'Hebat! Jawabanmu benar.' : 'Belum tepat. Jawaban benar sudah ditandai hijau.'}
                    </div>
                    <p>{currentQuizQuestion.explanationText}</p>
                    <button type="button" className="quiz-next-button" onClick={nextQuizStep}>
                      {quiz.index >= quiz.questions.length - 1 ? 'Lihat Hasil' : 'Soal Berikutnya'}
                    </button>
                  </div>
                )}
              </>
            )}

            {quiz.status === 'complete' && (
              <div className="quiz-complete" aria-live="polite">
                <div className="quiz-complete-stars" aria-hidden="true">
                  {[0, 1, 2].map((star) => <span key={star} className={star < learningStars ? 'active' : ''}>★</span>)}
                </div>
                <div className="mini-badge gold">Misi Belajar Selesai</div>
                <h2>{quiz.correctCount} dari {quizTotal} benar</h2>
                <p>{quiz.correctCount >= 4 ? 'Keren. Main lagi dan pertahankan streak belajarmu.' : 'Bagus. Main lagi, baca pelan-pelan, dan kumpulkan bintang lebih banyak.'}</p>
                <div className="quiz-complete-actions">
                  <button type="button" className="quiz-next-button primary" onClick={startGame}>Lanjut Game</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {gameOver && !menuOpen && !quizDue && quiz.status === 'idle' && (
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
                <p className="reward-copy">Tiga bintang untuk rekor terbaikmu. Pertahankan fokus dan cari jalur paling aman.</p>
              </>
            ) : (
              <>
                <div className="mini-badge danger">Game Over</div>
                <h2>Score {resultScore}</h2>
                <p>{resultReasonText}</p>
              </>
            )}
            <button type="button" className="start-button" onClick={startGame}>Main Lagi</button>
          </div>
        </div>
      )}

      {gameOver && !menuOpen && quiz.status === 'error' && (
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
                <p className="reward-copy">Tiga bintang untuk rekor terbaikmu. Pertahankan fokus dan coba menyeberang lebih jauh.</p>
              </>
            ) : (
              <>
                <div className="mini-badge danger">Game Over</div>
                <h2>Score {resultScore}</h2>
                <p>{resultReasonText} Best score: {highScore}.</p>
              </>
            )}
            <button type="button" className="start-button" onClick={startGame}>Main Lagi</button>
          </div>
        </div>
      )}
    </section>
  );
}
