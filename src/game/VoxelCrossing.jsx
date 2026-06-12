import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RoadQuestGame } from './RoadQuestGame.js';
import { GameAudio } from './audio.js';
import { BADGE_FAMILIES, getBadgeCount, loadPlayerProfile, savePlayerProfile, trackBadgeEvent } from './badges.js';
import './styles/index.css';

const SETTINGS_KEY = 'ayam-sd-settings';
const SAVE_GAME_KEY = 'ayam-sd-save-game-v1';
const COINS_KEY = 'ayam-sd-coins-v1';
const INSTALL_PROMPT_KEY = 'ayam-sd-install-prompt-v1';
const SEEN_QUESTIONS_KEY = 'ayam-sd-seen-questions-v1';
const QUIZ_SIZE = 1;
const REVIVE_COIN_REWARD = 5;
const QUIZ_FEEDBACK_DELAY_MS = 2000;
const QUIZ_APPEAR_DELAY_MS = 220;
const REVIVE_OFFER_DELAY_MS = 460;
const HAPTIC_TEST_NOTICE_MS = 1900;
const APP_EXIT_FALLBACK_DELAY_MS = 260;
const APP_BACKGROUND_PAUSE_REASONS = new Set(['background', 'pagehide', 'freeze', 'back']);
const OFFLINE_WARM_ASSET_PATHS = Object.freeze([
  'data/questionBanks.json',
  'audio/mushroom-dance.mp3',
  'audio/kids-yay.mp3'
]);
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
  lastCorrect: null,
  explanationOpen: false,
  feedbackVisible: false,
  reviveAwarded: false
};

function isPlayKey(event) {
  const key = event.key.toLowerCase();
  return PLAY_KEYS.has(key) || event.code === 'Space';
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { musicEnabled: true, sfxEnabled: true, hapticsEnabled: true, cheatMode: false, movePadSide: 'right' };
    const parsed = JSON.parse(raw);
    return {
      musicEnabled: parsed.musicEnabled !== false,
      sfxEnabled: parsed.sfxEnabled !== false,
      hapticsEnabled: parsed.hapticsEnabled !== false,
      cheatMode: parsed.cheatMode === true,
      movePadSide: parsed.movePadSide === 'left' ? 'left' : 'right'
    };
  } catch {
    return { musicEnabled: true, sfxEnabled: true, hapticsEnabled: true, cheatMode: false, movePadSide: 'right' };
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

function loadCoins() {
  try {
    const value = Number(localStorage.getItem(COINS_KEY) || 0);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

function saveCoins(value) {
  try {
    localStorage.setItem(COINS_KEY, String(Math.max(0, Math.floor(Number(value) || 0))));
  } catch {
    // Coins are a reward layer only; gameplay still works when storage is blocked.
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
    const board = textNode.closest('.vc-quiz-question');
    if (!board) return undefined;

    const fit = () => {
      const countNode = board.querySelector('.vc-quiz-question-count');
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


// Google Material Icons SVG path data (Apache-2.0) used inline for an
// offline-safe public game build. Do not replace with hand-drawn paths.
const MATERIAL_ICON_PATHS = Object.freeze({
  menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  close: 'M18.3 5.71 12 12l6.3 6.29-1.41 1.41L10.59 13.41 4.29 19.71 2.88 18.3 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.29-6.3z',
  keyboard_arrow_up: 'M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z',
  keyboard_arrow_down: 'M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z',
  keyboard_arrow_left: 'M15.41 7.41 10.83 12l4.58 4.59L14 18l-6-6 6-6z',
  keyboard_arrow_right: 'M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z',
  play_arrow: 'M8 5v14l11-7z',
  refresh: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8S7.58 20 12 20c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h8V3z',
  save: 'M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10z',
  restore: 'M13 3c-4.97 0-9 4.03-9 9H1l4 4 4-4H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.78-4.95-2.05l-1.42 1.42C8.27 20 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.25 2.52.75-1.23-3.5-2.08V8z',
  workspace_premium: 'M12 3 14.39 8.26 20 8.91 15.86 12.7 16.97 18.25 12 15.46 7.03 18.25 8.14 12.7 4 8.91 9.61 8.26zM9 19.39 12 18l3 1.39V22l-3-1.4L9 22z',
  download: 'M5 20h14v-2H5zm14-9h-4V3H9v8H5l7 7z',
  settings: 'M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.37-.31-.6-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98L14.5 2.42C14.47 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.5.42L9.12 5.07c-.61.25-1.18.59-1.69.98l-2.49-1c-.23-.08-.48 0-.6.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.08.65-.08.98s.03.66.08.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.37.31.6.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.38-2.65c.61-.25 1.18-.59 1.69-.98l2.49 1c.23.08.48 0 .6-.22l2-3.46c.12-.22.07-.49-.12-.64zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z',
  logout: 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
  vibration: 'M0 15h2V9H0v6zm3 3h2V6H3v12zm19-9v6h2V9h-2zm-3 9h2V6h-2v12zM16 1H8C6.9 1 6 1.9 6 3v18c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 18H8V5h8v14z',
  monetization_on: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 15.09V19h-2.67v-1.93c-1.76-.36-3.18-1.51-3.26-3.67h1.96c.1 1.05.82 1.87 2.64 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V5h2.67v1.95c1.92.46 2.88 1.9 2.94 3.45H14.4c-.05-1.11-.64-1.87-2.33-1.87-1.61 0-2.4.73-2.4 1.56 0 .72.54 1.35 2.67 1.9 2.13.54 4.18 1.43 4.18 3.91 0 1.83-1.38 2.91-3.11 3.19z',
  favorite: 'M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z',
  check_circle: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8z',
  cancel: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12z',
  school: 'M12 3 1 9l4 2.18v6L12 21l7-3.82v-6L21 10.09V17h2V9zM5.18 9 12 5.28 18.82 9 12 12.72z',
  menu_book: 'M21 4.5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5C10.55 4.4 8.45 4 6.5 4 4.55 4 2.45 4.4 1 5.5v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 19.95 5.05 19.5 6.5 19.5c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V5.5c-.6-.45-1.25-.75-2-1zM21 18c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V7.5C13.35 6.65 15.8 6 17.5 6c1.2 0 2.4.15 3.5.5z',
  arrow_back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z'
});

function MaterialIcon({ name, size = 24, className = '' }) {
  const path = MATERIAL_ICON_PATHS[name] || MATERIAL_ICON_PATHS.menu;
  return (
    <svg className={className} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

function ActionIcon({ name }) {
  return <MaterialIcon name={name} size={18} className="vc-action-icon" />;
}

function MenuIcon() {
  return <MaterialIcon name="menu" />;
}

function CloseIcon() {
  return <MaterialIcon name="close" size={22} />;
}

function ControlArrowIcon({ direction }) {
  const iconName = {
    up: 'keyboard_arrow_up',
    down: 'keyboard_arrow_down',
    left: 'keyboard_arrow_left',
    right: 'keyboard_arrow_right'
  }[direction] || 'keyboard_arrow_up';
  return <MaterialIcon name={iconName} size={32} />;
}

function MenuActionIcon({ name }) {
  const iconName = {
    play: 'play_arrow',
    restart: 'refresh',
    save: 'save',
    continue: 'restore',
    badge: 'workspace_premium',
    install: 'download',
    settings: 'settings',
    close: 'close',
    exit: 'logout',
    haptic: 'vibration'
  }[name] || 'settings';
  return (
    <span className={`vc-menu-action-icon-wrap ${name}`} aria-hidden="true">
      <MaterialIcon name={iconName} size={18} className="vc-menu-action-icon" />
    </span>
  );
}

function ProgressDots({ total, current }) {
  return (
    <div className="vc-quiz-dots" aria-label={`Soal ${current + 1} dari ${total}`}>
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
    <div key={burst.id} className={`vc-confetti-layer ${burst.level || 'rainbow'}`} aria-hidden="true">
      {Array.from({ length: pieces }, (_, index) => {
        const side = index % 2 === 0 ? 0 : 1;
        const origin = side === 0 ? 18 + ((index * 7) % 12) : 82 - ((index * 11) % 12);
        const dxBase = side === 0 ? 90 + ((index * 29) % 220) : -90 - ((index * 31) % 220);
        return (
          <span
            key={index}
            className={`vc-confetti-piece vc-confetti-piece-${index % 8}`}
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
    <div className="vc-pwa-install-overlay" role="dialog" aria-modal="true" aria-label="Install Ayam SD">
      <div className="vc-pwa-install-card">
        <div className="vc-pwa-install-orbit" aria-hidden="true">
          <span className="vc-pwa-chicken">🐔</span>
          <i className="vc-pwa-spark s1">★</i>
          <i className="vc-pwa-spark s2">✓</i>
          <i className="vc-pwa-spark s3">🏅</i>
        </div>
        <div className="vc-mini-badge gold">Bisa Offline</div>
        <h2>Install Ayam SD</h2>
        <p>Main lebih cepat, skor dan badge tersimpan, lalu bisa dimainkan lagi walau internet sedang tidak stabil.</p>
        <div className="vc-pwa-benefits" aria-label="Manfaat install">
          <span>🏆 Skor tersimpan</span>
          <span>📴 Offline setelah dibuka</span>
          <span>🎮 Buka seperti aplikasi</span>
        </div>
        {isManual && (
          <small className="vc-pwa-install-help">Gunakan menu browser lalu pilih <strong>Install app</strong> atau <strong>Add to Home Screen</strong>.</small>
        )}
        <div className="vc-pwa-install-actions">
          <button type="button" className="vc-pwa-install-primary" onClick={onInstall}>{canInstall ? 'Install Sekarang' : 'Oke, Saya Mengerti'}</button>
          <button type="button" className="vc-pwa-install-later" onClick={onDismiss}>Nanti Saja</button>
        </div>
      </div>
    </div>
  );
}

function BadgeUnlockOverlay({ badge, onClose }) {
  if (!badge) return null;
  const tierLabel = `Tier ${badge.tier}`;
  return (
    <div className={`vc-badge-unlock-overlay tier-${badge.tier}`} role="dialog" aria-live="polite" aria-label="Badge baru terbuka">
      <div className="vc-badge-unlock-card">
        <div className="vc-badge-aura" aria-hidden="true" />
        <div className="vc-badge-emblem" aria-hidden="true">
          <span>{badge.emoji}</span>
        </div>
        <div className="vc-mini-badge gold">Badge Baru</div>
        <h2>{badge.name}</h2>
        <p>{badge.copy}</p>
        <div className="vc-badge-meta">
          <span>{badge.label}</span>
          <span>{tierLabel}</span>
        </div>
        <button type="button" className="vc-badge-continue" onClick={onClose}>Lanjut Game</button>
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
    <div className="vc-badge-board-overlay" role="dialog" aria-label="Papan badge Ayam SD">
      <div className="vc-badge-board-card">
        <div className="vc-badge-board-head">
          <div>
            <span className="vc-mini-badge gold">Papan Badge</span>
            <h2>Koleksi Prestasimu</h2>
            <p>{unlockedCount} dari {totalCount} badge terbuka. Badge gelap berarti masih terkunci.</p>
          </div>
          <button type="button" className="vc-icon-button" onClick={onClose} aria-label="Tutup papan badge">×</button>
        </div>

        <div className="vc-badge-board-summary">
          <div><strong>{profile?.bestRunScore || 0}</strong><span>Best Score</span></div>
          <div><strong>{profile?.nearMisses || 0}</strong><span>Nyaris</span></div>
          <div><strong>{profile?.totalCorrectAnswers || 0}</strong><span>Jawaban Benar</span></div>
          <div><strong>{unlockedCount}</strong><span>Badge</span></div>
        </div>

        <div className="vc-badge-family-list">
          {BADGE_FAMILIES.map((family) => {
            const progress = getFamilyProgress(profile, family);
            return (
              <section className="vc-badge-family-card" key={family.family}>
                <div className="vc-badge-family-title">
                  <div>
                    <strong>{family.label}</strong>
                    <small>{progress.unlockedCount}/{progress.total} terbuka</small>
                  </div>
                  <span>{progress.nextTier ? `${progress.currentValue}/${progress.nextTier.threshold}` : 'Selesai'}</span>
                </div>
                <div className="vc-badge-family-progress" aria-hidden="true"><i style={{ width: `${progress.percent}%` }} /></div>
                <div className="vc-badge-grid">
                  {family.tiers.map((badge) => {
                    const isUnlocked = unlocked.has(badge.id);
                    const counterValue = Number(profile?.[badge.counter || family.counter] || 0);
                    const pct = Math.min(100, Math.round((counterValue / badge.threshold) * 100));
                    return (
                      <div className={`vc-badge-tile ${isUnlocked ? 'unlocked' : 'locked'} tier-${badge.tier}`} key={badge.id}>
                        <div className="vc-badge-tile-medal"><span>{badge.emoji}</span></div>
                        <strong>{badge.name}</strong>
                        <small>{isUnlocked ? 'Terbuka' : `${counterValue}/${badge.threshold}`}</small>
                        {!isUnlocked && <div className="vc-badge-tile-lock"><i style={{ width: `${pct}%` }} /></div>}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <div className="vc-badge-board-actions">
          <button type="button" className="vc-badge-share-button" onClick={shareBoard}>{shareState === 'done' ? 'Teks Disalin!' : 'Bagikan Progress'}</button>
          <button type="button" className="vc-badge-continue" onClick={onClose}>Kembali</button>
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

function explanationTextFitStyle(text = '') {
  const length = String(text || '').length;
  const size = Math.max(19, Math.min(28, Math.round(620 / Math.max(18, Math.sqrt(length) * 2.75))));
  return { '--explain-fit-size': `${size}px` };
}

function ChalkboardExplanationText({ question }) {
  const correctText = question?.options?.find((option) => option.key === question.answerKey)?.text || question?.answerKey || '';
  const explanation = question?.explanationText || 'Gunakan cara singkat, lalu cocokkan dengan jawaban yang benar.';
  const text = `Jawaban benar: ${correctText}\n\n${explanation}`;
  return (
    <div className="vc-explain-board" style={explanationTextFitStyle(text)} aria-label="Papan pembahasan jawaban">
      <div className="vc-explain-board-label"><MaterialIcon name="menu_book" size={17} /> Pembahasan</div>
      <p>{text}</p>
    </div>
  );
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

function getAppBaseUrl() {
  return (import.meta.env?.BASE_URL || '/').replace(/\/?$/, '/');
}

async function warmOfflineAsset(path) {
  const baseUrl = getAppBaseUrl();
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response || !response.ok) throw new Error(`Offline warm cache failed for ${path}`);
  return response;
}

const HAPTIC_PATTERNS = Object.freeze({
  // Short 8-16ms pulses are too subtle on several Android phones. These values
  // stay kid-friendly, but are long enough to be felt on Xiaomi/MIUI devices.
  start: 38,
  jump: 30,
  blocked: [36, 34, 42],
  nearMiss: 44,
  traffic: [62, 42, 76],
  train: [88, 48, 112],
  water: [54, 38, 64],
  reward: [48, 34, 48],
  quizCorrect: [34, 28, 42],
  quizWrong: [56, 38, 76],
  menu: 28,
  exit: [42, 36, 42],
  test: [80, 55, 95, 55, 120]
});

function canUseHaptics() {
  return typeof navigator !== 'undefined'
    && typeof navigator.vibrate === 'function'
    && (typeof document === 'undefined' || document.visibilityState !== 'hidden');
}

function runHaptic(patternName, enabled = true) {
  if (!enabled || !canUseHaptics()) return false;
  const pattern = HAPTIC_PATTERNS[patternName] ?? patternName;
  try {
    navigator.vibrate(0);
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
  const reviveOfferTimerRef = useRef(null);
  const quizFeedbackTimerRef = useRef(null);
  const confettiTimerRef = useRef(null);
  const nearMissTimerRef = useRef(null);
  const hapticNoticeTimerRef = useRef(null);
  const appExitFallbackTimerRef = useRef(null);
  const appExitWasRunningRef = useRef(false);
  const appPauseRestoreSnapshotRef = useRef(false);
  const appBackgroundPausedRef = useRef(false);
  const appExitHintOpenRef = useRef(false);
  const badgeQueueRef = useRef([]);
  const badgeTimerRef = useRef(null);
  const pendingBadgeShowTimerRef = useRef(null);
  const badgePausedGameRef = useRef(false);
  const startMusicTimerRef = useRef(null);
  const restartPrepareTaskRef = useRef(null);
  const deferredAudioTaskRef = useRef(null);
  const deferredAudioTimerRef = useRef(null);
  const deferredAudioFrameRef = useRef(null);
  const sfxPrimeTaskRef = useRef(null);
  const sfxPrimedRef = useRef(false);
  const resumeFramesRef = useRef([]);
  const startFramesRef = useRef([]);
  const startedRef = useRef(false);
  const gameOverRef = useRef(false);
  const impactingRef = useRef(false);
  const menuOpenRef = useRef(false);
  const quizDueRef = useRef(false);
  const quizStatusRef = useRef(QUIZ_INITIAL.status);
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
  const [coins, setCoins] = useState(() => loadCoins());
  const [coinBurst, setCoinBurst] = useState(null);
  const [lifeBlinkIndex, setLifeBlinkIndex] = useState(null);
  const [orientationHint, setOrientationHint] = useState('landscape');
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(() => loadSettings());
  const settingsRef = useRef(settings);
  const [savedGame, setSavedGame] = useState(() => loadSavedGame());
  const [saveNotice, setSaveNotice] = useState('');
  const [quizDue, setQuizDue] = useState(false);
  const [reviveOfferOpen, setReviveOfferOpen] = useState(false);
  const [reviveOfferPending, setReviveOfferPending] = useState(false);
  const [quizReveal, setQuizReveal] = useState(false);
  const [quiz, setQuiz] = useState(QUIZ_INITIAL);
  const [confettiBurst, setConfettiBurst] = useState(null);
  const [nearMissBurst, setNearMissBurst] = useState(null);
  const [playerProfile, setPlayerProfile] = useState(() => loadPlayerProfile());
  const [activeBadge, setActiveBadge] = useState(null);
  const [badgeBoardOpen, setBadgeBoardOpen] = useState(false);
  const playerProfileRef = useRef(playerProfile);
  const deferredInstallPromptRef = useRef(null);
  const pwaPromptTimerRef = useRef(null);
  const offlineWarmTaskRef = useRef(null);
  const offlineWarmStartedRef = useRef(false);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [pwaPromptVisible, setPwaPromptVisible] = useState(false);
  const [pwaPromptStatus, setPwaPromptStatus] = useState('ready');
  const [standalonePwa, setStandalonePwa] = useState(() => isStandaloneDisplay());
  const [hapticNotice, setHapticNotice] = useState('');
  const [appExitHintOpen, setAppExitHintOpen] = useState(false);
  const [appPauseReason, setAppPauseReason] = useState('exit');

  const livesRef = useRef(MAX_LIVES);
  const lifeBlinkTimerRef = useRef(null);

  const clearQuizFeedbackTimer = () => {
    if (!quizFeedbackTimerRef.current) return;
    window.clearTimeout(quizFeedbackTimerRef.current);
    quizFeedbackTimerRef.current = null;
  };

  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);

  useEffect(() => {
    startedRef.current = started;
  }, [started]);

  useEffect(() => {
    gameOverRef.current = gameOver;
    impactingRef.current = impacting;
    menuOpenRef.current = menuOpen;
    quizDueRef.current = quizDue;
    quizStatusRef.current = quiz.status;
  }, [gameOver, impacting, menuOpen, quizDue, quiz.status]);

  useEffect(() => {
    appExitHintOpenRef.current = appExitHintOpen;
  }, [appExitHintOpen]);

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

  useEffect(() => {
    if (offlineWarmStartedRef.current) return undefined;
    offlineWarmStartedRef.current = true;

    offlineWarmTaskRef.current = runWhenIdle(() => {
      offlineWarmTaskRef.current = null;
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'AYAM_SD_WARM_CACHE',
          paths: OFFLINE_WARM_ASSET_PATHS
        });
      }
      Promise.allSettled(OFFLINE_WARM_ASSET_PATHS.map((path) => warmOfflineAsset(path))).catch(() => {});
    }, 2600);

    return () => {
      if (offlineWarmTaskRef.current) {
        cancelIdleTask(offlineWarmTaskRef.current);
        offlineWarmTaskRef.current = null;
      }
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
    syncBackgroundMusicContext('settings');
  }, [settings]);

  useEffect(() => {
    const handleSecretCheatToggle = (event) => {
      const key = String(event.key || '').toLowerCase();
      if (!(event.ctrlKey && event.altKey && event.shiftKey && key === 'x')) return;
      if (event.repeat) return;
      event.preventDefault();
      setSettings((current) => ({ ...current, cheatMode: !current.cheatMode }));
    };

    window.addEventListener('keydown', handleSecretCheatToggle);
    return () => window.removeEventListener('keydown', handleSecretCheatToggle);
  }, []);

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


  const cancelDeferredMusicResume = () => {
    if (startMusicTimerRef.current) {
      window.clearTimeout(startMusicTimerRef.current);
      startMusicTimerRef.current = null;
    }
  };

  const isQuizMusicLocked = () => quizDueRef.current || ACTIVE_QUIZ_STATES.has(quizStatusRef.current);
  const shouldAllowBackgroundMusic = () => (
    settingsRef.current.musicEnabled &&
    startedRef.current &&
    !gameOverRef.current &&
    !impactingRef.current &&
    !menuOpenRef.current &&
    !appBackgroundPausedRef.current &&
    !appExitHintOpenRef.current &&
    !isQuizMusicLocked()
  );

  const syncBackgroundMusicContext = (reason = 'sync') => {
    const allowed = shouldAllowBackgroundMusic();
    audioRef.current?.setMusicContext?.(allowed ? 'playing' : reason);
    if (!allowed) {
      cancelDeferredMusicResume();
      audioRef.current?.forceStopMusic?.();
    }
    return allowed;
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
    if (offlineWarmTaskRef.current) {
      cancelIdleTask(offlineWarmTaskRef.current);
      offlineWarmTaskRef.current = null;
    }
    if (hapticNoticeTimerRef.current) window.clearTimeout(hapticNoticeTimerRef.current);
    if (appExitFallbackTimerRef.current) window.clearTimeout(appExitFallbackTimerRef.current);
    if (reviveOfferTimerRef.current) window.clearTimeout(reviveOfferTimerRef.current);
    clearQuizFeedbackTimer();
    cancelDeferredMusicResume();
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

  const awardCoins = (amount, { animate = false } = {}) => {
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    if (!value) return;
    setCoins((current) => {
      const next = current + value;
      saveCoins(next);
      return next;
    });
    if (animate) {
      setCoinBurst({ id: Date.now(), amount: value });
      window.setTimeout(() => setCoinBurst(null), 980);
    }
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
    primeSfxAudio();
    runHaptic('nearMiss', settingsRef.current.hapticsEnabled);
    audioRef.current?.nearMiss?.();
    trackProfileEvent('near_miss');
    nearMissTimerRef.current = window.setTimeout(() => setNearMissBurst(null), 980);
  };

  const unlockAudio = ({ allowMusic = true } = {}) => {
    const musicAllowedNow = allowMusic && syncBackgroundMusicContext('unlock-audio');
    audioRef.current?.unlock({ allowMusic: musicAllowedNow });
  };

  const primeSfxAudio = () => {
    if (sfxPrimedRef.current || !audioRef.current) return;
    if (sfxPrimeTaskRef.current) return;
    sfxPrimeTaskRef.current = runWhenIdle(() => {
      sfxPrimeTaskRef.current = null;
      unlockAudio({ allowMusic: false });
      sfxPrimedRef.current = true;
    }, 650);
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
    cancelDeferredMusicResume();
    startMusicTimerRef.current = window.setTimeout(() => {
      startMusicTimerRef.current = null;
      window.requestAnimationFrame(() => {
        runWhenIdle(() => {
          if (!syncBackgroundMusicContext('deferred-blocked')) return;
          audioRef.current?.resumeMusic?.();
        }, 1800);
      });
    }, delayMs);
  };

  useEffect(() => {
    const isGameplayPointerTarget = (target) => {
      if (!target?.closest) return false;
      if (target.closest('.vc-primary-button, .vc-menu-action, .vc-icon-button, .vc-menu-settings, .vc-pwa-install-overlay, .vc-badge-board-overlay, .vc-badge-unlock-overlay, input, textarea, select')) {
        return false;
      }
      return Boolean(target.closest('.vc-move-pad, .vc-canvas'));
    };

    const primeGameplayAudioFromTrustedGesture = (event) => {
      if (!ready || !startedRef.current || !audioRef.current) return;
      if (event.type === 'keydown') {
        if (!isPlayKey(event)) return;
        return;
      }
      if (!isGameplayPointerTarget(event.target)) return;
      // Intentionally no deferred audio unlock here. Earlier delayed priming
      // could still hitch a few steps after Start on weaker phones.
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
    const baseUrl = getAppBaseUrl();
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
    quizDueRef.current = true;
    quizStatusRef.current = 'loading';
    syncBackgroundMusicContext('quiz-loading');
    setQuiz({ ...QUIZ_INITIAL, status: 'loading', loading: true });

    try {
      const pool = await loadQuestionPool();
      const questions = prepareQuizQuestions(pool, seenQuestionIdsRef.current, QUIZ_SIZE);
      quizStatusRef.current = 'running';
      syncBackgroundMusicContext('quiz-running');
      setQuiz({
        ...QUIZ_INITIAL,
        status: 'running',
        loading: false,
        questions,
        index: 0
      });
    } catch (error) {
      quizStatusRef.current = 'error';
      syncBackgroundMusicContext('quiz-error');
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
        primeSfxAudio();
        setImpactReason(reason);
        setImpacting(true);
        runHaptic(reason === 'train' ? 'train' : reason === 'water' ? 'water' : 'traffic', settingsRef.current.hapticsEnabled);
        audioRef.current?.hit(reason);
      },
      onMoveStart: () => {
        primeSfxAudio();
        runHaptic('jump', settingsRef.current.hapticsEnabled);
        audioRef.current?.jump();
        if (syncBackgroundMusicContext('move')) audioRef.current?.resumeMusicFromTrustedGesture?.();
        deferMusicResume(5200);
      },
      onBlocked: () => {
        primeSfxAudio();
        runHaptic('blocked', settingsRef.current.hapticsEnabled);
        audioRef.current?.blockedBounce?.();
        if (syncBackgroundMusicContext('blocked')) audioRef.current?.resumeMusicFromTrustedGesture?.();
      },
      onHazardSound: ({ kind }) => {
        if (kind === 'carHorn') audioRef.current?.carHorn();
        if (kind === 'truckHorn') audioRef.current?.truckHorn();
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
        // Native-game style learning loop:
        // 1st impact consumes the reserve heart and respawns silently.
        // 2nd impact pauses the game, then shows a centered revive offer card.
        // Quiz is never shown until the player chooses it.
        if (livesRef.current > 1) {
          const nextLives = 1;
          livesRef.current = nextLives;
          setLives(nextLives);
          setLifeBlinkIndex(0);
          if (lifeBlinkTimerRef.current) window.clearTimeout(lifeBlinkTimerRef.current);
          lifeBlinkTimerRef.current = window.setTimeout(() => {
            setLifeBlinkIndex(null);
            lifeBlinkTimerRef.current = null;
          }, 920);

          const revived = gameRef.current?.continueAfterLife?.(1250) === true;
          setImpacting(false);
          setGameOver(false);
          setStarted(true);
          setResult(null);
          setQuizDue(false);
          setReviveOfferOpen(false);
          setReviveOfferPending(false);
          setQuizReveal(false);
          setQuiz(QUIZ_INITIAL);
          gameOverRef.current = false;
          startedRef.current = true;
          quizDueRef.current = false;
          quizStatusRef.current = QUIZ_INITIAL.status;
          trackProfileEvent('reserve_heart_used', { score: nextResult.score, reason: nextResult.reason });
          if (revived) {
            setSaveNotice('Hati cadangan terpakai · lanjut!');
            window.setTimeout(() => setSaveNotice(''), 1350);
            deferMusicResume(3600);
          } else {
            startGame();
          }
          return;
        }

        gameOverCycleRef.current = 0;
        livesRef.current = 0;
        setLives(0);
        setLifeBlinkIndex(null);
        if (lifeBlinkTimerRef.current) {
          window.clearTimeout(lifeBlinkTimerRef.current);
          lifeBlinkTimerRef.current = null;
        }

        setImpacting(false);
        setGameOver(true);
        gameOverRef.current = true;
        startedRef.current = false;
        quizDueRef.current = false;
        quizStatusRef.current = QUIZ_INITIAL.status;
        syncBackgroundMusicContext('revive-offer-pending');
        setStarted(false);
        setMenuOpen(false);
        setSettingsOpen(false);
        setResult(nextResult);
        setScore(nextResult.score);
        setLastRunScore(nextResult.score);
        setQuizDue(false);
        setReviveOfferOpen(false);
        setReviveOfferPending(true);
        setQuizReveal(false);
        setQuiz(QUIZ_INITIAL);
        if (reviveOfferTimerRef.current) window.clearTimeout(reviveOfferTimerRef.current);
        reviveOfferTimerRef.current = window.setTimeout(() => {
          reviveOfferTimerRef.current = null;
          setReviveOfferPending(false);
          setReviveOfferOpen(true);
        }, REVIVE_OFFER_DELAY_MS);
        trackProfileEvent('revive_offer_pending', { score: nextResult.score, reason: nextResult.reason });
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
    quizDueRef.current = quizDue;
    quizStatusRef.current = quiz.status;
    syncBackgroundMusicContext('quiz');
  }, [quiz.status, quizDue]);

  useEffect(() => {
    if (!quizDue || gameOver || menuOpen) return;

    // Stale-state repair: quiz flags are only allowed to dim/disable gameplay
    // while the game-over revive modal is mounted. If a flag leaks back into
    // live gameplay, either restore the revive modal context or clear the leak.
    if (result) {
      setGameOver(true);
      gameOverRef.current = true;
      setStarted(false);
      startedRef.current = false;
      return;
    }

    setQuizDue(false);
    setQuizReveal(false);
    setQuiz(QUIZ_INITIAL);
    quizDueRef.current = false;
    quizStatusRef.current = QUIZ_INITIAL.status;
    syncBackgroundMusicContext('quiz-stale-repair');
  }, [quizDue, gameOver, menuOpen, result]);

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
    cancelDeferredMusicResume();
    if (reviveOfferTimerRef.current) {
      window.clearTimeout(reviveOfferTimerRef.current);
      reviveOfferTimerRef.current = null;
    }
    setReviveOfferPending(false);

    // Start must stay frame-safe. Do not unlock audio, fetch media, start music,
    // or even resume the WebGL engine in this click handler. First paint the
    // game screen, then start the engine two animation frames later.
    menuPausedRef.current = false;
    appBackgroundPausedRef.current = false;
    setAppPauseReason('exit');
    setStarted(true);
    setPwaPromptVisible(false);
    setAppExitHintOpen(false);
    setMenuOpen(false);
    setSettingsOpen(false);
    setBadgeBoardOpen(false);
    setAppExitHintOpen(false);
    setImpacting(false);
    setGameOver(false);
    setResult(null);
    setReviveOfferOpen(false);
    setReviveOfferPending(false);
    livesRef.current = MAX_LIVES;
    setLives(MAX_LIVES);
    setLifeBlinkIndex(null);
    setQuizDue(false);
    setQuizReveal(false);
    setQuiz(QUIZ_INITIAL);
    gameOverRef.current = false;
    impactingRef.current = false;
    quizDueRef.current = false;
    quizStatusRef.current = QUIZ_INITIAL.status;
    menuOpenRef.current = false;
    setScore(0);
    setLastRunScore(0);
    startEngineAfterIntroPaint();

    // Keep the Start tap visually light. Mark the page as user-interacted
    // without creating/resuming AudioContext; that work caused recurring Start freezes.
    audioRef.current?.markUserInteracted?.();
    audioRef.current?.setMusicContext?.('starting');

    // Background music is warmed and resumed only on idle work after gameplay has
    // already painted, so it should not steal the first rendered frames.
    window.requestAnimationFrame(() => {
      runWhenIdle(() => {
        if (wasGameOver) trackProfileEvent('restart_after_game_over');
        trackProfileEvent('run_started');
        schedulePendingBadgeCelebration();
        audioRef.current?.warmMusic?.();
        // SFX gets priority over BGM. Music is not resumed from Start; it is
        // resumed later from gameplay after SFX audio has had time to prime.
      }, 1000);
    });
  };

  const saveCurrentGameSnapshot = (extra = {}) => {
    const saveState = gameRef.current?.getSaveState?.({ lives: livesRef.current, ...extra });
    if (!saveState) return null;
    writeSavedGame(saveState);
    setSavedGame(saveState);
    return saveState;
  };

  const saveGame = () => {
    const saveState = saveCurrentGameSnapshot();
    if (!saveState) return;
    setSaveNotice(`Tersimpan di score ${saveState.score}`);
    window.setTimeout(() => setSaveNotice(''), 1500);
  };


  const showHapticNotice = (message) => {
    setHapticNotice(message);
    if (hapticNoticeTimerRef.current) window.clearTimeout(hapticNoticeTimerRef.current);
    hapticNoticeTimerRef.current = window.setTimeout(() => {
      hapticNoticeTimerRef.current = null;
      setHapticNotice('');
    }, HAPTIC_TEST_NOTICE_MS);
  };

  const testHaptic = () => {
    const supported = canUseHaptics();
    const sent = runHaptic('test', true);
    showHapticNotice(
      !supported
        ? 'Browser/perangkat tidak membuka API getar.'
        : sent
          ? 'Tes getar dikirim. Jika belum terasa, cek Silent/DND, Battery Saver, dan pengaturan getar sistem.'
          : 'Perintah getar ditolak oleh browser/perangkat.'
    );
  };

  const exitApp = () => {
    appExitWasRunningRef.current = Boolean(startedRef.current && !gameOverRef.current);
    appPauseRestoreSnapshotRef.current = false;
    runHaptic('exit', settingsRef.current.hapticsEnabled);
    setAppPauseReason('exit');
    appBackgroundPausedRef.current = true;
    if (ready && !gameOver) saveCurrentGameSnapshot({ pausedBy: 'exit' });
    gameRef.current?.suspendRuntime?.();
    audioRef.current?.forceStopMusic?.();
    audioRef.current?.stopAll?.();
    setMenuOpen(false);
    setSettingsOpen(false);
    setBadgeBoardOpen(false);
    setPwaPromptVisible(false);
    setAppExitHintOpen(false);

    try {
      window.close();
    } catch {
      // Most installed PWAs are not script-closable. Fall back to a proper pause screen.
    }

    if (appExitFallbackTimerRef.current) window.clearTimeout(appExitFallbackTimerRef.current);
    appExitFallbackTimerRef.current = window.setTimeout(() => {
      appExitFallbackTimerRef.current = null;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      setAppExitHintOpen(true);
    }, APP_EXIT_FALLBACK_DELAY_MS);
  };

  const continueSavedGame = () => {
    const saveState = savedGame || loadSavedGame();
    if (!saveState) return;
    appBackgroundPausedRef.current = false;
    appPauseRestoreSnapshotRef.current = false;
    setAppPauseReason('exit');
    gameRef.current?.loadSaveState?.(saveState, true);
    menuPausedRef.current = false;
    setMenuOpen(false);
    setSettingsOpen(false);
    setBadgeBoardOpen(false);
    setAppExitHintOpen(false);
    setImpacting(false);
    setGameOver(false);
    setResult(null);
    setReviveOfferOpen(false);
    setReviveOfferPending(false);
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
    startedRef.current = true;
    gameOverRef.current = false;
    quizDueRef.current = false;
    quizStatusRef.current = QUIZ_INITIAL.status;
    syncBackgroundMusicContext('continue');
    deferMusicResume(3800);
  };


  const continueFromAppPause = () => {
    appBackgroundPausedRef.current = false;
    setAppExitHintOpen(false);

    if (appPauseRestoreSnapshotRef.current) {
      appPauseRestoreSnapshotRef.current = false;
      continueSavedGame();
      return;
    }

    if (appExitWasRunningRef.current) resumeGame({ deferEngine: true });
    else setMenuOpen(true);
  };

  const resumeGame = ({ deferEngine = false } = {}) => {
    if (impacting) return;
    appBackgroundPausedRef.current = false;
    setAppPauseReason('exit');
    menuPausedRef.current = false;
    setMenuOpen(false);
    setSettingsOpen(false);
    setBadgeBoardOpen(false);
    setAppExitHintOpen(false);
    setStarted(true);
    startedRef.current = true;
    syncBackgroundMusicContext('resume');
    deferMusicResume(3600);

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

  const hardPauseAppRuntime = (reason = 'background') => {
    const reasonKey = APP_BACKGROUND_PAUSE_REASONS.has(reason) ? reason : 'background';
    const wasActive = Boolean(startedRef.current && !gameOverRef.current);
    const suspendedDuringImpact = impactingRef.current === true;
    const wasRunning = wasActive && !suspendedDuringImpact;
    const shouldShowPauseScreen = wasActive || menuOpenRef.current || reasonKey === 'back';
    appExitWasRunningRef.current = wasActive;
    appPauseRestoreSnapshotRef.current = suspendedDuringImpact;
    appBackgroundPausedRef.current = shouldShowPauseScreen;
    menuPausedRef.current = wasRunning;

    cancelDeferredResume();
    cancelDeferredStart();
    cancelDeferredMusicResume();
    cancelDeferredAudioUnlock();
    clearQuizFeedbackTimer();

    if (wasActive || gameRef.current?.isPlaying) {
      saveCurrentGameSnapshot({ pausedBy: reasonKey, suspendedDuringImpact });
    }

    gameRef.current?.suspendRuntime?.();
    audioRef.current?.forceStopMusic?.();
    audioRef.current?.stopAll?.();

    setAppPauseReason(reasonKey);
    setMenuOpen(false);
    setSettingsOpen(false);
    setBadgeBoardOpen(false);
    setPwaPromptVisible(false);
    if (suspendedDuringImpact) {
      impactingRef.current = false;
      setImpacting(false);
    }

    if (shouldShowPauseScreen && (typeof document === 'undefined' || document.visibilityState !== 'hidden')) {
      setAppExitHintOpen(true);
    }
  };

  useEffect(() => {
    const pauseFromLifecycle = (reason) => hardPauseAppRuntime(reason);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        pauseFromLifecycle('background');
        return;
      }
      if (appBackgroundPausedRef.current) {
        setAppPauseReason('background');
        setAppExitHintOpen(true);
      }
    };

    const handlePageHide = () => pauseFromLifecycle('pagehide');
    const handleFreeze = () => pauseFromLifecycle('freeze');
    const handleBeforeUnload = () => {
      if (startedRef.current && !gameOverRef.current) saveCurrentGameSnapshot({ pausedBy: 'beforeunload' });
      audioRef.current?.forceStopMusic?.();
      audioRef.current?.stopAll?.();
      gameRef.current?.suspendRuntime?.();
    };

    const installBackGuard = () => {
      try {
        if (!history.state?.ayamPauseGuard) history.pushState({ ...(history.state || {}), ayamPauseGuard: true }, '', window.location.href);
      } catch {
        // History guard is best-effort only. Page lifecycle events still protect audio/game state.
      }
    };

    const handlePopState = () => {
      if (appExitHintOpenRef.current || appBackgroundPausedRef.current) return;
      if (!standalonePwa && !startedRef.current && !menuOpenRef.current) return;
      pauseFromLifecycle('back');
      if (standalonePwa) window.setTimeout(installBackGuard, 0);
    };

    if (standalonePwa) installBackGuard();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener?.('freeze', handleFreeze);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener?.('freeze', handleFreeze);
    };
    // The handler reads live refs so it can react to Android Home/Back without
    // being rebuilt for every score/menu/quiz state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standalonePwa]);

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
    setAppExitHintOpen(false);
    runHaptic('menu', settingsRef.current.hapticsEnabled);
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
    if (key !== 'movePadSide') {
      deferAudioUnlock({ allowMusic: !ACTIVE_QUIZ_STATES.has(quiz.status) && !quizDue }, 1400);
    }
    setSettings((current) => ({
      ...current,
      [key]: key === 'movePadSide' ? (value === 'left' ? 'left' : 'right') : Boolean(value)
    }));
  };

  const move = (direction) => {
    if (impacting || menuOpen || gameOver || activeBadge) return false;
    if (!started && !gameOver) resumeGame();
    const accepted = gameRef.current?.queueMove(direction) === true;
    if (!accepted) runHaptic('blocked', settingsRef.current.hapticsEnabled);
    return accepted;
  };

  const handleControlPointer = (event, direction) => {
    event.preventDefault();
    const accepted = move(direction);
    if (accepted && syncBackgroundMusicContext('trusted-control')) {
      audioRef.current?.resumeMusicFromTrustedGesture?.();
    }
  };


  const openReviveQuiz = () => {
    if (!gameOver || !result) return;
    if (reviveOfferTimerRef.current) {
      window.clearTimeout(reviveOfferTimerRef.current);
      reviveOfferTimerRef.current = null;
    }

    cancelDeferredResume();
    cancelDeferredStart();
    cancelDeferredMusicResume();
    gameRef.current?.suspendRuntime?.();

    // Force a real modal context before async question loading. This prevents
    // the second revive cycle from leaking into a blurred gameplay state with
    // no visible dialog.
    quizStartingRef.current = false;
    setImpacting(false);
    setStarted(false);
    setGameOver(true);
    setReviveOfferOpen(false);
    setReviveOfferPending(false);
    setQuizReveal(false);
    setQuizDue(true);
    startedRef.current = false;
    gameOverRef.current = true;
    quizDueRef.current = true;
    quizStatusRef.current = 'loading';
    setQuiz({ ...QUIZ_INITIAL, status: 'loading', loading: true });
    audioRef.current?.setMusicSuppressed?.(true);
    audioRef.current?.forceStopMusic?.();

    window.requestAnimationFrame(() => {
      void beginQuizSession();
    });

    // Watchdog: if a stale async flag blocks the loader, retry while keeping
    // the visible revive loading card mounted.
    window.setTimeout(() => {
      if (!gameOverRef.current || !quizDueRef.current) return;
      if (quizStatusRef.current !== 'loading') return;
      quizStartingRef.current = false;
      void beginQuizSession();
    }, 900);

    trackProfileEvent('revive_quiz_chosen', { score: result.score });
  };

  const restartFromReviveOffer = () => {
    if (reviveOfferTimerRef.current) {
      window.clearTimeout(reviveOfferTimerRef.current);
      reviveOfferTimerRef.current = null;
    }
    quizStartingRef.current = false;
    setReviveOfferOpen(false);
    setReviveOfferPending(false);
    setQuizDue(false);
    setQuizReveal(false);
    setQuiz(QUIZ_INITIAL);
    quizDueRef.current = false;
    quizStatusRef.current = QUIZ_INITIAL.status;
    trackProfileEvent('revive_offer_restart', { score: result?.score || lastRunScore });
    startGame();
  };

  const answerCurrentQuestion = (answerKey) => {
    if (quiz.status !== 'running' || quiz.selectedKey) return;
    unlockAudio({ allowMusic: false });
    audioRef.current?.setMusicSuppressed?.(true);
    audioRef.current?.forceStopMusic?.();
    clearQuizFeedbackTimer();
    const question = quiz.questions[quiz.index];
    const isCorrect = answerKey === question.answerKey;
    if (isCorrect) {
      runHaptic('quizCorrect', settingsRef.current.hapticsEnabled);
      audioRef.current?.yayKids?.();
      audioRef.current?.kidsYayReward?.(3);
      audioRef.current?.reviveCorrect?.();
      audioRef.current?.quizCorrect?.();
      triggerConfetti('gold');
      trackProfileEvent('revive_quiz_correct', { reward: REVIVE_COIN_REWARD });
    } else {
      runHaptic('quizWrong', settingsRef.current.hapticsEnabled);
      audioRef.current?.reviveWrong?.();
      trackProfileEvent('revive_quiz_wrong');
    }
    setQuiz((current) => ({
      ...current,
      selectedKey: answerKey,
      correctCount: isCorrect ? 1 : 0,
      lastCorrect: isCorrect,
      feedbackVisible: false,
      reviveAwarded: isCorrect
    }));

    quizFeedbackTimerRef.current = window.setTimeout(() => {
      quizFeedbackTimerRef.current = null;
      setQuiz((current) => {
        if (current.status !== 'running' || current.selectedKey !== answerKey || current.explanationOpen) return current;
        return { ...current, feedbackVisible: true };
      });
    }, QUIZ_FEEDBACK_DELAY_MS);
  };

  const reviveFromQuiz = () => {
    audioRef.current?.setMusicSuppressed?.(true);
    if (quiz.reviveAwarded) {
      audioRef.current?.coinCring?.();
      awardCoins(REVIVE_COIN_REWARD, { animate: true });
    }
    const revived = gameRef.current?.continueAfterLife?.(1550) === true;
    if (!revived) {
      startGame();
      return;
    }
    livesRef.current = MAX_LIVES;
    setLives(MAX_LIVES);
    setLifeBlinkIndex(null);
    setImpacting(false);
    setGameOver(false);
    setStarted(true);
    setResult(null);
    if (reviveOfferTimerRef.current) {
      window.clearTimeout(reviveOfferTimerRef.current);
      reviveOfferTimerRef.current = null;
    }
    quizStartingRef.current = false;
    setReviveOfferOpen(false);
    setReviveOfferPending(false);
    setQuizDue(false);
    setQuizReveal(false);
    setQuiz(QUIZ_INITIAL);
    gameOverRef.current = false;
    startedRef.current = true;
    quizDueRef.current = false;
    quizStatusRef.current = QUIZ_INITIAL.status;
    setSaveNotice(`+${REVIVE_COIN_REWARD} koin · hidup lagi!`);
    window.setTimeout(() => setSaveNotice(''), 1500);
    trackProfileEvent('revived_by_quiz');
    deferMusicResume(3200);
  };

  const showQuizExplanation = () => {
    setQuiz((current) => ({ ...current, explanationOpen: true }));
  };

  const hideQuizExplanation = () => {
    setQuiz((current) => ({ ...current, explanationOpen: false }));
  };

  const nextQuizStep = () => {
    audioRef.current?.setMusicSuppressed?.(true);
    audioRef.current?.forceStopMusic?.();
    if (quiz.status !== 'running' || !quiz.selectedKey) return;
    if (quiz.lastCorrect) {
      reviveFromQuiz();
      return;
    }
    showQuizExplanation();
  };

  useEffect(() => {
    const handler = (event) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select';
      if (isTyping || menuOpen || !ready || impacting || activeBadge) return;
      if (gameOver && (reviveOfferOpen || quizDue || ACTIVE_QUIZ_STATES.has(quiz.status))) return;
      if ((gameOver || !started) && isPlayKey(event)) {
        event.preventDefault();
        startGame();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [gameOver, impacting, menuOpen, quiz.status, quizDue, reviveOfferOpen, ready, started]);

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

  useEffect(() => {
    const quizRuntimeLockActive = gameOver && !menuOpen && (quizDue || ACTIVE_QUIZ_STATES.has(quiz.status) || quiz.status === 'error');
    if (!quizRuntimeLockActive) return;

    // Revive quiz is a hard modal: freeze the 3D runtime and stop BGM so the
    // child is reading a calm full-screen learning page, not a moving game.
    cancelDeferredResume();
    cancelDeferredStart();
    cancelDeferredMusicResume();
    gameRef.current?.suspendRuntime?.();
    audioRef.current?.forceStopMusic?.();
    audioRef.current?.setMusicSuppressed?.(true);
  }, [gameOver, menuOpen, quizDue, quiz.status]);

  const visibleScore = gameOver ? (result?.score ?? lastRunScore) : score;
  const resultScore = result?.score ?? lastRunScore;
  const resultReasonText = result?.reason === 'water'
    ? 'Ayam tercebur sungai. Tunggu plank berikutnya dan jangan terlalu lama berdiri di atas plank.'
    : result?.reason === 'train'
      ? 'Kereta melintas sangat cepat. Amati ritmenya sebelum menyeberang rel.'
      : 'Tertabrak kendaraan. Perhatikan jarak dan kecepatan lane sebelum melompat.';

  const currentQuizQuestion = quiz.questions[quiz.index];
  const quizAnswered = Boolean(quiz.selectedKey);
  const quizFeedbackVisible = quizAnswered && quiz.feedbackVisible;
  const quizTotal = 1;
  const modalOverlayActive = appExitHintOpen || (gameOver && !menuOpen && (reviveOfferPending || reviveOfferOpen || quizDue || ACTIVE_QUIZ_STATES.has(quiz.status) || quiz.status === 'error'));
  const appPauseTitle = appPauseReason === 'exit' ? 'Ayam SD masih terbuka' : 'Game sudah dijeda total';
  const appPauseCopy = appPauseReason === 'exit'
    ? 'Android/Chrome biasanya tidak mengizinkan PWA menutup dirinya sendiri. Score sudah disimpan bila game sedang berjalan. Tekan Back/Home dari HP untuk keluar.'
    : appPauseReason === 'back'
      ? 'Tombol Back sudah menghentikan engine game dan audio agar tidak berjalan di background. Pilih Lanjutkan untuk main lagi, atau tekan Back/Home sekali lagi untuk keluar dari PWA.'
      : 'Ayam SD otomatis pause saat aplikasi masuk background. Engine game, musik, dan efek suara sudah dihentikan agar tidak tetap berjalan di belakang layar.';

  return (
    <section className={`vc-shell vc-app-shell ${orientationHint} move-pad-${settings.movePadSide === 'left' ? 'left' : 'right'} ${menuOpen ? 'vc-menu-open' : ''} ${modalOverlayActive ? 'quiz-active' : ''} ${impacting ? `impact ${impactReason}` : ''} ${className}`}>
      <div ref={hostRef} className="vc-host vc-game-host" />
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
        <div key={nearMissBurst.id} className="vc-near-miss-stinger" aria-hidden="true">
          <span>NYARIS!</span>
        </div>
      )}

      {!ready && (
        <div className="vc-loading-overlay" aria-live="polite">
          <div className="vc-loader-orb" aria-hidden="true" />
          <span>Menyiapkan arena…</span>
        </div>
      )}

      <div className="vc-game-hud vc-score-hud" aria-live="polite">
        <div className="vc-score-value">{visibleScore}</div>
        <div className="vc-score-label">score</div>
      </div>

      <div className={`vc-coin-hud ${coinBurst ? 'is-bursting' : ''}`} aria-label={`Koin ${coins}`}>
        <img className="vc-coin-icon" src={`${import.meta.env.BASE_URL}icons/coin.svg`} alt="" aria-hidden="true" />
        <strong className="vc-coin-value">{coins}</strong>
        {coinBurst && <span key={coinBurst.id} className="vc-coin-plus" aria-hidden="true">+{coinBurst.amount}</span>}
      </div>

      <div className="vc-game-hud vc-best-hud">
        <div className="vc-best-label">best</div>
        <div className="vc-best-value">{highScore}</div>
      </div>

      {settings.cheatMode ? (
        <div className="vc-cheat-chip" role="status" aria-label="Cheat mode aktif">CHEAT MODE</div>
      ) : (
        <div className="vc-life-hud" aria-label={lives > 1 ? 'Hati cadangan tersedia' : 'Hati cadangan habis'}>
          <span className={lifeBlinkIndex === 0 ? 'lost' : lives > 1 ? 'active' : 'spent'} aria-hidden="true">♥</span>
        </div>
      )}

      <div className="vc-control-dock" aria-label="Kontrol game">
        <button
          type="button"
          className={`vc-dock-button vc-menu-trigger ${menuOpen ? 'active' : ''} ${modalOverlayActive ? 'disabled-underlay' : ''}`}
          aria-label="Buka menu"
          aria-expanded={menuOpen}
          disabled={modalOverlayActive}
          onPointerDown={(event) => {
            event.preventDefault();
            if (menuOpen) closeMenu({ resume: menuPausedRef.current });
            else openMenu();
          }}
        >
          <span className="vc-dock-visual vc-menu-trigger-visual" aria-hidden="true"><MenuIcon /></span>
        </button>

        <div className="vc-move-pad" aria-label="Kontrol gerak">
          <button type="button" className="vc-dock-button vc-move-control up" aria-label="Maju" onPointerDown={(event) => handleControlPointer(event, 'forward')} disabled={impacting || menuOpen || gameOver || Boolean(activeBadge)}><span className="vc-dock-visual vc-move-visual" aria-hidden="true"><ControlArrowIcon direction="up" /></span></button>
          <button type="button" className="vc-dock-button vc-move-control left" aria-label="Kiri" onPointerDown={(event) => handleControlPointer(event, 'left')} disabled={impacting || menuOpen || gameOver || Boolean(activeBadge)}><span className="vc-dock-visual vc-move-visual" aria-hidden="true"><ControlArrowIcon direction="left" /></span></button>
          <button type="button" className="vc-dock-button vc-move-control down" aria-label="Mundur" onPointerDown={(event) => handleControlPointer(event, 'backward')} disabled={impacting || menuOpen || gameOver || Boolean(activeBadge)}><span className="vc-dock-visual vc-move-visual" aria-hidden="true"><ControlArrowIcon direction="down" /></span></button>
          <button type="button" className="vc-dock-button vc-move-control right" aria-label="Kanan" onPointerDown={(event) => handleControlPointer(event, 'right')} disabled={impacting || menuOpen || gameOver || Boolean(activeBadge)}><span className="vc-dock-visual vc-move-visual" aria-hidden="true"><ControlArrowIcon direction="right" /></span></button>
        </div>
      </div>

      {menuOpen && (
        <div className="vc-menu-panel" role="dialog" aria-label="Menu game">
          <div className="vc-menu-head">
            <div>
              <strong>Menu</strong>
              <span>{menuPausedRef.current ? 'Game dijeda' : 'Atur game'}</span>
            </div>
            <button type="button" className="vc-icon-button vc-menu-close" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); closeMenu({ resume: menuPausedRef.current }); }} aria-label="Tutup menu"><CloseIcon /></button>
          </div>

          <div className="vc-badge-progress-pill" aria-label={`Badge terbuka ${playerProfile.unlockedBadges.length} dari ${getBadgeCount()}`}>
            <span>🏅</span>
            <strong>{playerProfile.unlockedBadges.length}/{getBadgeCount()}</strong>
            <small>Badge terbuka</small>
          </div>

          <div className="vc-menu-actions">
            {menuPausedRef.current ? (
              <button type="button" className="vc-menu-action primary" onClick={() => resumeGame({ deferEngine: true })}><MenuActionIcon name="play" />Lanjutkan</button>
            ) : (
              <button type="button" className="vc-menu-action primary" onClick={startGame} disabled={!ready}><MenuActionIcon name="play" />Mulai Main</button>
            )}
            <button type="button" className="vc-menu-action" onClick={startGame} disabled={!ready}><MenuActionIcon name="restart" />Restart</button>
            <button type="button" className="vc-menu-action" onClick={saveGame} disabled={!ready || gameOver}><MenuActionIcon name="save" />Save</button>
            <button type="button" className="vc-menu-action" onClick={continueSavedGame} disabled={!ready || !savedGame}><MenuActionIcon name="continue" />Continue</button>
            <button type="button" className={`vc-menu-action ${badgeBoardOpen ? 'active' : ''}`} onClick={() => { setSettingsOpen(false); setBadgeBoardOpen(true); }}><MenuActionIcon name="badge" />Papan Badge</button>
            {!standalonePwa && <button type="button" className="vc-menu-action install" onClick={() => { setSettingsOpen(false); setBadgeBoardOpen(false); setPwaPromptVisible(true); }}><MenuActionIcon name="install" />Install App</button>}
            <button type="button" className={`vc-menu-action ${settingsOpen ? 'active' : ''}`} onClick={() => { setBadgeBoardOpen(false); setSettingsOpen((open) => !open); }}><MenuActionIcon name="settings" />Settings</button>
            <button type="button" className="vc-menu-action" onClick={() => closeMenu({ resume: menuPausedRef.current })}><MenuActionIcon name="close" />Tutup Menu</button>
            {standalonePwa && <button type="button" className="vc-menu-action danger" onClick={exitApp}><MenuActionIcon name="exit" />Keluar App</button>}
          </div>

          {saveNotice && <div className="vc-menu-save-note" role="status">{saveNotice}</div>}

          {settingsOpen && (
            <div className="vc-menu-settings">
              <label className="vc-menu-setting-row">
                <span>
                  <strong>Background music</strong>
                  <small>Musik ringan saat bermain</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.musicEnabled}
                  onChange={(event) => updateSetting('musicEnabled', event.target.checked)}
                />
                <i className="vc-menu-switch" aria-hidden="true" />
              </label>

              <label className="vc-menu-setting-row">
                <span>
                  <strong>Sound effect</strong>
                  <small>Lompat, klakson, kereta, splash, dan hit</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.sfxEnabled}
                  onChange={(event) => updateSetting('sfxEnabled', event.target.checked)}
                />
                <i className="vc-menu-switch" aria-hidden="true" />
              </label>

              <label className="vc-menu-setting-row">
                <span>
                  <strong>Haptic vibration</strong>
                  <small>Getar halus untuk lompat, hampir tertabrak, hit, dan reward di HP Android</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.hapticsEnabled}
                  onChange={(event) => updateSetting('hapticsEnabled', event.target.checked)}
                />
                <i className="vc-menu-switch" aria-hidden="true" />
              </label>
              <button type="button" className="vc-menu-haptic-test" onClick={testHaptic}><MenuActionIcon name="haptic" />Tes Getar</button>
              {hapticNotice && <div className="vc-menu-haptic-note" role="status">{hapticNotice}</div>}

              <div className="vc-menu-setting-row vc-menu-move-pad-setting">
                <span>
                  <strong>Move pad</strong>
                  <small>Pilih posisi tombol gerak sesuai tangan yang nyaman</small>
                </span>
                <div className="vc-menu-move-pad-toggle" role="group" aria-label="Pilih posisi move pad">
                  <button type="button" className={settings.movePadSide === 'left' ? 'active' : ''} onClick={() => updateSetting('movePadSide', 'left')}>Left</button>
                  <button type="button" className={settings.movePadSide === 'right' ? 'active' : ''} onClick={() => updateSetting('movePadSide', 'right')}>Right</button>
                </div>
              </div>

              <button type="button" className="vc-menu-reset-score" onClick={resetHighScore}>Reset high score</button>
            </div>
          )}
        </div>
      )}

      {appExitHintOpen && (
        <div className="vc-screen-overlay vc-app-exit-overlay" role="dialog" aria-label="Game dijeda">
          <div className="vc-glass-card vc-app-exit-card">
            <div className="vc-mini-badge">Game dijeda</div>
            <h2>{appPauseTitle}</h2>
            <p>{appPauseCopy}</p>
            <div className="vc-app-exit-actions">
              <button type="button" className="vc-primary-button" onClick={continueFromAppPause}>Lanjutkan</button>
              <button type="button" className="vc-primary-button ghost" onClick={() => { appBackgroundPausedRef.current = false; setAppPauseReason('exit'); setAppExitHintOpen(false); setMenuOpen(true); }}>Menu</button>
            </div>
          </div>
        </div>
      )}

      {badgeBoardOpen && (
        <BadgeBoardOverlay profile={playerProfile} onClose={() => setBadgeBoardOpen(false)} />
      )}

      {impacting && (
        <div className={`vc-impact-stinger ${impactReason}`} aria-hidden="true">
          <span>{impactReason === 'train' ? 'KERETA!' : impactReason === 'water' ? 'JEBURR!' : 'TUBRUK!'}</span>
        </div>
      )}

      {!started && !gameOver && !impacting && !menuOpen && (
        <div className="vc-screen-overlay vc-intro-overlay">
          <div className="vc-glass-card">
            <div className="vc-mini-badge">Mini Game</div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
            <div className="vc-hint-row">
              <span>Space / Enter untuk mulai</span>
              <span>Arrow / WASD untuk bergerak</span>
              <span>Swipe atau tombol untuk mobile</span>
            </div>
            <button type="button" className="vc-primary-button" onClick={startGame} disabled={!ready}>
              {ready ? 'Mulai Main' : 'Loading…'}
            </button>
          </div>
        </div>
      )}

      {gameOver && !menuOpen && reviveOfferPending && quiz.status === 'idle' && (
        <div className="vc-screen-overlay vc-revive-pending" aria-hidden="true" />
      )}

      {gameOver && !menuOpen && reviveOfferOpen && quiz.status === 'idle' && (
        <div className="vc-screen-overlay vc-revive-offer-overlay" role="presentation">
          <div className="vc-revive-offer-card" role="dialog" aria-label="Tawaran hidup lagi">
            <div className="vc-revive-offer-icon" aria-hidden="true"><MaterialIcon name="favorite" size={30} /></div>
            <div className="vc-mini-badge gold">Kesempatan Kedua</div>
            <h2>Lanjut?</h2>
            <p className="vc-revive-offer-copy">Score <strong>{resultScore}</strong></p>
            <div className="vc-revive-offer-actions">
              <button type="button" className="vc-quiz-button primary" onClick={openReviveQuiz}><ActionIcon name="school" />Jawab soal</button>
              <button type="button" className="vc-quiz-button secondary" onClick={restartFromReviveOffer}><ActionIcon name="refresh" />Ulang</button>
            </div>
          </div>
        </div>
      )}

      {gameOver && !menuOpen && (quizDue || ACTIVE_QUIZ_STATES.has(quiz.status) || quiz.status === 'error') && (
        <div className={`vc-screen-overlay vc-quiz-overlay vc-revive-quiz-overlay ${(quizDue && quiz.status === 'idle') ? 'loading' : quiz.status} ${quizReveal ? 'reveal' : ''} ${quiz.explanationOpen ? 'explain-open' : ''}`}>
          <div className={`vc-quiz-card vc-revive-card ${quizFeedbackVisible && !quiz.explanationOpen ? 'feedback-open' : ''} ${quizFeedbackVisible && quiz.lastCorrect ? 'feedback-good' : ''} ${quizFeedbackVisible && quiz.lastCorrect === false ? 'feedback-try' : ''}`} role="dialog" aria-label="Kesempatan hidup lagi">
            <div className="vc-quiz-glow" aria-hidden="true" />
            {(quiz.status === 'loading' || (quizDue && quiz.status === 'idle')) && (
              <div className="vc-quiz-loading" aria-live="polite">
                <div className="vc-quiz-loader-ring" aria-hidden="true" />
                <h2>Kesempatan Hidup Lagi</h2>
                <p>Jawab satu soal. Benar = lanjut dari skor ini dan dapat koin.</p>
              </div>
            )}

            {quiz.status === 'running' && !currentQuizQuestion && !quiz.explanationOpen && (
              <div className="vc-quiz-loading" aria-live="polite">
                <div className="vc-quiz-loader-ring" aria-hidden="true" />
                <h2>Menyiapkan soal…</h2>
                <p>Sebentar ya.</p>
              </div>
            )}

            {quiz.status === 'running' && currentQuizQuestion && !quiz.explanationOpen && (
              <>
                <div className={`vc-quiz-question ${questionLengthClass(currentQuizQuestion.questionText)}`} style={questionFitStyle(currentQuizQuestion.questionText)}>
                  <div className="vc-quiz-question-count">Satu soal untuk revive</div>
                  <FittedQuestionText text={currentQuizQuestion.questionText} />
                </div>

                <div className="vc-quiz-options vc-revive-options">
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
                        className={`vc-quiz-option option-${optionIndex + 1} ${stateClass} ${isSelected ? 'selected' : ''}`}
                        onClick={() => answerCurrentQuestion(option.key)}
                        disabled={quizAnswered}
                      >
                        <span className="vc-quiz-option-key">{String.fromCharCode(65 + optionIndex)}</span>
                        <span className="vc-quiz-option-text">{option.text}</span>
                        {quizAnswered && isCorrect && <span className="vc-quiz-mark"><MaterialIcon name="check_circle" size={20} /></span>}
                        {quizAnswered && isSelected && !isCorrect && <span className="vc-quiz-mark"><MaterialIcon name="cancel" size={20} /></span>}
                      </button>
                    );
                  })}
                </div>

                {!quizAnswered && (
                  <div className="vc-revive-actions pre-answer">
                    <button type="button" className="vc-quiz-button secondary" onClick={restartFromReviveOffer}><ActionIcon name="refresh" />Ulang</button>
                  </div>
                )}

                {quizFeedbackVisible && (
                  <div className={`vc-quiz-feedback vc-revive-feedback ${quiz.lastCorrect ? 'good' : 'try'}`} aria-live="polite">
                    <div className="vc-quiz-feedback-title">
                      {quiz.lastCorrect ? (
                        <span className="vc-correct-coin-reward">
                          <span>Yey Benar! +{REVIVE_COIN_REWARD}</span>
                          <img className="vc-inline-coin-icon" src={`${import.meta.env.BASE_URL}icons/coin.svg`} alt="" aria-hidden="true" />
                        </span>
                      ) : 'Belum tepat'}
                    </div>
                    
                    <div className="vc-revive-actions">
                      {quiz.lastCorrect ? (
                        <>
                          <button type="button" className="vc-quiz-button" onClick={showQuizExplanation}><ActionIcon name="menu_book" />Pembahasan</button>
                          <button type="button" className="vc-quiz-button primary" onClick={reviveFromQuiz}><ActionIcon name="favorite" />Lanjut</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="vc-quiz-button" onClick={showQuizExplanation}><ActionIcon name="menu_book" />Pembahasan</button>
                          <button type="button" className="vc-quiz-button secondary" onClick={restartFromReviveOffer}><ActionIcon name="refresh" />Ulang</button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {quiz.status === 'running' && currentQuizQuestion && quiz.explanationOpen && (
              <div className="vc-explanation-page" aria-live="polite">
                <div className="vc-mini-badge">Pembahasan</div>
                <h2>Pembahasan</h2>
                <div className="vc-explain-question">{currentQuizQuestion.questionText}</div>
                <ChalkboardExplanationText question={currentQuizQuestion} />
                <div className="vc-revive-actions vc-explanation-actions">
                  <button type="button" className="vc-quiz-button secondary" onClick={hideQuizExplanation}><ActionIcon name="arrow_back" />Kembali</button>
                </div>
              </div>
            )}

            {quiz.status === 'complete' && (
              <div className="vc-quiz-complete" aria-live="polite">
                <div className="vc-mini-badge gold">Revive Berhasil</div>
                <h2>Ayam hidup lagi!</h2>
                <p>+{REVIVE_COIN_REWARD} koin. Lanjutkan dari skor terakhir.</p>
                <div className="vc-quiz-complete-actions">
                  <button type="button" className="vc-quiz-button primary" onClick={reviveFromQuiz}>Lanjut</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {gameOver && !menuOpen && !reviveOfferPending && !reviveOfferOpen && !quizDue && quiz.status === 'idle' && (
        <div className={`vc-screen-overlay vc-result-overlay ${result?.isNewHighScore ? 'new-record' : ''}`}>
          <div className="vc-glass-card vc-card-compact vc-result-card">
            {result?.isNewHighScore ? (
              <>
                <div className="vc-reward-aura" aria-hidden="true" />
                <div className="vc-mini-badge gold">Rekor Baru</div>
                <div className="vc-star-reward" aria-hidden="true">
                  <span className="vc-gold-star s1">★</span>
                  <span className="vc-gold-star s2">★</span>
                  <span className="vc-gold-star s3">★</span>
                </div>
                <h2>Score {resultScore}</h2>
                <p className="vc-reward-copy">Tiga bintang untuk rekor terbaikmu. Pertahankan fokus dan cari jalur paling aman.</p>
              </>
            ) : (
              <>
                <div className="vc-mini-badge danger">Game Over</div>
                <h2>Score {resultScore}</h2>
                <p>{resultReasonText}</p>
              </>
            )}
            <button type="button" className="vc-primary-button" onClick={startGame}>Main Lagi</button>
          </div>
        </div>
      )}

      {gameOver && !menuOpen && quiz.status === 'error' && (
        <div className={`vc-screen-overlay vc-result-overlay ${result?.isNewHighScore ? 'new-record' : ''}`}>
          <div className="vc-glass-card vc-card-compact vc-result-card">
            {result?.isNewHighScore ? (
              <>
                <div className="vc-reward-aura" aria-hidden="true" />
                <div className="vc-mini-badge gold">Rekor Baru</div>
                <div className="vc-star-reward" aria-hidden="true">
                  <span className="vc-gold-star s1">★</span>
                  <span className="vc-gold-star s2">★</span>
                  <span className="vc-gold-star s3">★</span>
                </div>
                <h2>Score {resultScore}</h2>
                <p className="vc-reward-copy">Tiga bintang untuk rekor terbaikmu. Pertahankan fokus dan coba menyeberang lebih jauh.</p>
              </>
            ) : (
              <>
                <div className="vc-mini-badge danger">Game Over</div>
                <h2>Score {resultScore}</h2>
                <p>{resultReasonText} Best score: {highScore}.</p>
              </>
            )}
            <button type="button" className="vc-primary-button" onClick={startGame}>Main Lagi</button>
          </div>
        </div>
      )}
    </section>
  );
}
