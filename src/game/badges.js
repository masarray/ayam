const PROFILE_KEY = 'ayam-sd-player-profile-v1';

export const BADGE_FAMILIES = Object.freeze([
  {
    family: 'grit',
    label: 'Kegigihan',
    counter: 'restartsAfterGameOver',
    copy: 'Terus mencoba walau gagal. Ini mental juara.',
    tiers: [
      { id: 'grit-1', tier: 1, name: 'Pantang Menyerah', threshold: 3, emoji: '🔥' },
      { id: 'grit-2', tier: 2, name: 'Pejuang Sejati', threshold: 10, emoji: '🛡️' },
      { id: 'grit-3', tier: 3, name: 'Tak Kenal Mundur', threshold: 25, emoji: '⚡' },
      { id: 'grit-4', tier: 4, name: 'Mental Baja', threshold: 50, emoji: '💎' },
      { id: 'grit-5', tier: 5, name: 'Legenda Nggak Kapok', threshold: 100, emoji: '👑' }
    ]
  },
  {
    family: 'nearMiss',
    label: 'Keberanian',
    counter: 'nearMisses',
    copy: 'Berani ambil timing, tapi tetap selamat.',
    tiers: [
      { id: 'near-1', tier: 1, name: 'Ayam Slamet', threshold: 3, emoji: '🐔' },
      { id: 'near-2', tier: 2, name: 'Pemberani', threshold: 10, emoji: '🚦' },
      { id: 'near-3', tier: 3, name: 'Nyawa 9', threshold: 25, emoji: '✨' },
      { id: 'near-4', tier: 4, name: 'Langkah Dewa', threshold: 50, emoji: '⚡' },
      { id: 'near-5', tier: 5, name: 'Master Lintas Jalan', threshold: 100, emoji: '🌟' }
    ]
  },
  {
    family: 'learning',
    label: 'Belajar',
    counter: 'totalCorrectAnswers',
    copy: 'Jawaban benar terkumpul. Otak makin panas.',
    tiers: [
      { id: 'learn-1', tier: 1, name: 'Anak Pintar', threshold: 5, emoji: '📘' },
      { id: 'learn-2', tier: 2, name: 'Super Cerdas', threshold: 20, emoji: '🧠' },
      { id: 'learn-3', tier: 3, name: 'Sang Jenius', threshold: 50, emoji: '🏆' },
      { id: 'learn-4', tier: 4, name: 'Otak AI', threshold: 100, emoji: '🤖' },
      { id: 'learn-5', tier: 5, name: 'Profesor Cilik', threshold: 200, emoji: '🎓' }
    ]
  },
  {
    family: 'quizStars',
    label: 'Bintang Quiz',
    counter: 'quizThreeStarCount',
    copy: 'Quiz bukan gangguan. Ini tempat naik level.',
    tiers: [
      { id: 'quiz-1', tier: 1, name: 'Bintang Belajar', threshold: 1, emoji: '⭐', counter: 'quizTwoStarCount' },
      { id: 'quiz-2', tier: 2, name: 'Jawara Quiz', threshold: 1, emoji: '🌟', counter: 'quizThreeStarCount' },
      { id: 'quiz-3', tier: 3, name: 'Konsisten Hebat', threshold: 3, emoji: '💫', counter: 'quizThreeStarCount' },
      { id: 'quiz-4', tier: 4, name: 'Raja Jawaban', threshold: 10, emoji: '👑', counter: 'quizThreeStarCount' }
    ]
  },
  {
    family: 'survival',
    label: 'Survival',
    counter: 'bestRunScore',
    copy: 'Makin jauh, makin tenang membaca bahaya.',
    tiers: [
      { id: 'score-1', tier: 1, name: 'Lintas Aman', threshold: 25, emoji: '✅' },
      { id: 'score-2', tier: 2, name: 'Penyeberang Hebat', threshold: 50, emoji: '🚗' },
      { id: 'score-3', tier: 3, name: 'Raja Jalan Raya', threshold: 100, emoji: '🛣️' },
      { id: 'score-4', tier: 4, name: 'Master Rel & Sungai', threshold: 150, emoji: '🚄' },
      { id: 'score-5', tier: 5, name: 'Legenda Ayam SD', threshold: 250, emoji: '🏅' }
    ]
  }
]);

export const BADGES = Object.freeze(BADGE_FAMILIES.flatMap((family) => family.tiers.map((tier) => ({ ...tier, family: family.family, label: family.label, copy: family.copy }))));

const BADGE_BY_ID = new Map(BADGES.map((badge) => [badge.id, badge]));

export function createDefaultProfile() {
  return {
    version: 1,
    runsStarted: 0,
    gameOvers: 0,
    restartsAfterGameOver: 0,
    nearMisses: 0,
    totalCorrectAnswers: 0,
    totalQuizCompleted: 0,
    quizTwoStarCount: 0,
    quizThreeStarCount: 0,
    bestRunScore: 0,
    unlockedBadges: []
  };
}

export function loadPlayerProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return createDefaultProfile();
    const parsed = JSON.parse(raw);
    const base = createDefaultProfile();
    return {
      ...base,
      ...parsed,
      unlockedBadges: Array.isArray(parsed.unlockedBadges) ? parsed.unlockedBadges.filter((id) => BADGE_BY_ID.has(id)) : []
    };
  } catch {
    return createDefaultProfile();
  }
}

export function savePlayerProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Storage is optional; badge progress still works for this session.
  }
}

function findNewBadges(profile) {
  const unlocked = new Set(profile.unlockedBadges || []);
  const newBadges = [];

  BADGE_FAMILIES.forEach((family) => {
    family.tiers.forEach((tier) => {
      if (unlocked.has(tier.id)) return;
      const counterName = tier.counter || family.counter;
      const value = Number(profile[counterName] || 0);
      if (value >= tier.threshold) {
        unlocked.add(tier.id);
        newBadges.push({ ...tier, family: family.family, label: family.label, copy: family.copy, progress: value });
      }
    });
  });

  return {
    profile: { ...profile, unlockedBadges: Array.from(unlocked) },
    newBadges
  };
}

export function trackBadgeEvent(currentProfile, eventName, payload = {}) {
  const profile = { ...createDefaultProfile(), ...currentProfile, unlockedBadges: [...(currentProfile?.unlockedBadges || [])] };

  switch (eventName) {
    case 'run_started':
      profile.runsStarted += 1;
      break;
    case 'restart_after_game_over':
      profile.restartsAfterGameOver += 1;
      break;
    case 'near_miss':
      profile.nearMisses += 1;
      break;
    case 'quiz_correct':
      profile.totalCorrectAnswers += 1;
      break;
    case 'quiz_finished': {
      const stars = Number(payload.stars || 0);
      profile.totalQuizCompleted += 1;
      if (stars >= 2) profile.quizTwoStarCount += 1;
      if (stars >= 3) profile.quizThreeStarCount += 1;
      break;
    }
    case 'game_over': {
      const score = Number(payload.score || 0);
      profile.gameOvers += 1;
      profile.bestRunScore = Math.max(profile.bestRunScore, score);
      break;
    }
    default:
      break;
  }

  return findNewBadges(profile);
}

export function getUnlockedBadges(profile) {
  const unlocked = new Set(profile?.unlockedBadges || []);
  return BADGES.filter((badge) => unlocked.has(badge.id));
}

export function getBadgeCount() {
  return BADGES.length;
}
