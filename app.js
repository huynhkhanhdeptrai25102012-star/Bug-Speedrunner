(() => {
  'use strict';

  const STORAGE = {
    geminiKey: 'bugSpeedrunnerGeminiKeyV3',
    geminiModel: 'bugSpeedrunnerGeminiModelV3',
    legacyUsers: 'bugSpeedrunnerUsersV3',
    legacySession: 'bugSpeedrunnerSessionV3'
  };

  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyD8oVU3fD95eSae0pd3P82fvbB8QXzVKZk',
    authDomain: 'bug-speedrunner.firebaseapp.com',
    projectId: 'bug-speedrunner',
    storageBucket: 'bug-speedrunner.firebasestorage.app',
    messagingSenderId: '1079984432984',
    appId: '1:1079984432984:web:2b3f69236b39c844d1672d',
    measurementId: 'G-LNDGH073BF'
  };

  const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
  const DEFAULT_TIME_MS = 180000;
  const MAX_HISTORY = 100;
  const MIN_CLOUD_RUN_GAP_MS = 1500;
  const APP_VERSION = 'firebase-v2-hardened';

  const LANGUAGES = {
    javascript: { label: 'JavaScript', monaco: 'javascript', ext: 'js' },
    html: { label: 'HTML', monaco: 'html', ext: 'html' },
    cpp: { label: 'C++', monaco: 'cpp', ext: 'cpp' },
    csharp: { label: 'C#', monaco: 'csharp', ext: 'cs' }
  };

  const RANKS = [
    { id: 'bronze', name: 'Đồng', threshold: 0, lucide: 'medal', description: 'Rank khởi đầu. Mọi runner đều bắt đầu từ đây.' },
    { id: 'silver', name: 'Bạc', threshold: 5, lucide: 'shield', description: 'Đạt sau 5 speedrun đúng.' },
    { id: 'gold', name: 'Vàng', threshold: 8, lucide: 'trophy', description: 'Đạt sau 8 speedrun đúng.' },
    { id: 'platinum', name: 'Bạch kim', threshold: 15, lucide: 'gem', description: 'Đạt sau 15 speedrun đúng.' },
    { id: 'legendary', name: 'Huyền thoại', threshold: 25, lucide: 'crown', description: 'Đạt sau 25 speedrun đúng.' },
    { id: 'god', name: 'GOD', threshold: 40, lucide: 'flame', description: 'Đạt sau 40 speedrun đúng.' },
    { id: 'emperor', name: 'Đế vương', threshold: 60, lucide: 'crown', description: 'Rank tối cao. Đạt sau 60 speedrun đúng.' }
  ];

  const state = {
    route: 'menu', language: 'javascript', challengeIndex: 0,
    challengeBase: null, challenge: null, challengeVariantSeed: null,
    editor: null, monacoReady: false, running: false, finishing: false,
    activeRunId: 0, finalizedRunId: 0, startAt: 0, elapsedMs: 0, rafId: null,
    currentUser: null, activePanel: 'log', pendingAi: false, practice: false,
    panelCollapsed: false, aiRequestId: 0,
    firebaseReady: false, authReady: false, leaderboardUsers: new Map(),
    unsubscribeProfile: null, unsubscribeLeaderboard: null,
    cloudStatus: 'offline', sessionId: (window.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    lastCloudWriteAt: 0
  };

  let fbAuth = null;
  let fbDb = null;
  let fbProvider = null;
  const profileCreationTasks = new Map();

  const $ = id => document.getElementById(id);
  const view = $('appView');
  const toast = $('toast');

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function formatMs(ms) {
    const n = Math.max(0, Math.floor(Number(ms) || 0));
    const m = Math.floor(n / 60000), s = Math.floor((n % 60000) / 1000), x = n % 1000;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(x).padStart(3, '0')}`;
  }

  function normalizeCode(code) {
    return String(code || '').replace(/\r\n?/g, '\n').split('\n').map(line => line.trimEnd()).join('\n').trim();
  }

  function showToast(message, type = '') {
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toast.className = 'toast'; }, 2800);
  }

  function safeJsonGet(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
  }

  function normalizeUsername(name) { return String(name || '').trim().toLowerCase(); }
  function makeUserKey(name) { return normalizeUsername(name); }

  function ensureUserShape(user) {
    const u = user || {};
    const stats = u.stats || {};
    return {
      displayName: String(u.displayName || u.name || u.email?.split('@')[0] || '').trim(),
      email: String(u.email || ''),
      photoURL: String(u.photoURL || ''),
      createdAt: u.createdAt || Date.now(),
      records: u.records && typeof u.records === 'object' ? u.records : {},
      history: Array.isArray(u.history) ? u.history.slice(0, 200) : [],
      stats: {
        totalRuns: Number(u.totalRuns ?? stats.totalRuns ?? 0),
        totalCorrect: Number(u.totalCorrect ?? stats.totalCorrect ?? 0)
      },
      bestTimeMs: Number.isFinite(Number(u.bestTimeMs)) && Number(u.bestTimeMs) > 0 ? Number(u.bestTimeMs) : null,
      hasClear: Boolean(u.hasClear ?? Number(u.totalCorrect ?? stats.totalCorrect ?? 0) > 0)
    };
  }

  function currentUser() { return state.currentUser; }

  function totalCorrect(user) {
    return Number(user?.totalCorrect ?? user?.stats?.totalCorrect ?? 0);
  }

  function authEnvironmentMessage() {
    if (location.protocol === 'file:') {
      return 'Firebase Authentication cần mở app qua http:// hoặc https://, không thể đăng nhập khi mở trực tiếp file HTML.';
    }
    return '';
  }

  function cachedUsersObject() {
    const out = {};
    for (const [uid, user] of state.leaderboardUsers.entries()) out[uid] = user;
    if (state.currentUser?.key && !out[state.currentUser.key]) out[state.currentUser.key] = ensureUserShape(state.currentUser);
    return out;
  }

  function initFirebase() {
    const fb = window.firebase;
    if (!fb || typeof fb.initializeApp !== 'function') throw new Error('Firebase Core chưa tải được.');
    if (typeof fb.auth !== 'function') throw new Error('Firebase Auth SDK chưa tải được.');
    if (typeof fb.firestore !== 'function') throw new Error('Firebase Firestore SDK chưa tải được.');
    if (!fb.apps.length) fb.initializeApp(FIREBASE_CONFIG);
    fbAuth = fb.auth();
    fbDb = fb.firestore();
    fbProvider = new fb.auth.GoogleAuthProvider();
    fbProvider.setCustomParameters({ prompt: 'select_account' });
    state.firebaseReady = true;
    state.cloudStatus = 'connecting';

    state.unsubscribeLeaderboard?.();
    state.unsubscribeLeaderboard = fbDb.collection('users').onSnapshot(snapshot => {
      state.cloudStatus = 'online';
      state.leaderboardUsers = new Map(snapshot.docs.map(doc => [doc.id, ensureUserShape({ key: doc.id, ...doc.data() })]));
      if (state.route === 'leaderboard') renderLeaderboard();
      if (state.route === 'menu') renderMenu();
      if (state.route === 'rank') renderRank();
      updateSpeedrunStats();
    }, error => {
      state.cloudStatus = 'error';
      console.warn('Leaderboard listener failed:', error);
      if (state.route === 'menu') renderMenu();
      if (state.route === 'leaderboard') renderLeaderboard();
    });

    fbAuth.onAuthStateChanged(async user => {
      state.authReady = true;
      state.unsubscribeProfile?.();
      state.unsubscribeProfile = null;
      state.currentUser = null;
      if (!user) {
        state.cloudStatus = state.firebaseReady ? 'online' : 'offline';
        renderHeader();
        if (state.route === 'menu') renderMenu();
        else if (state.route === 'rank') renderRank();
        else if (state.route === 'leaderboard') renderLeaderboard();
        updateSpeedrunStats();
        return;
      }

      const uid = user.uid;
      const ref = fbDb.collection('users').doc(uid);
      state.unsubscribeProfile = ref.onSnapshot(async doc => {
        if (fbAuth.currentUser?.uid !== uid) return;
        try {
          if (!doc.exists) {
            await createCloudProfile(user);
            return;
          }
          const shaped = ensureUserShape({ key: uid, email: user.email || '', ...doc.data() });
          state.currentUser = { key: uid, uid, name: shaped.displayName, ...shaped };
          state.cloudStatus = 'online';
          state.leaderboardUsers.set(uid, ensureUserShape({ key: uid, ...doc.data() }));
          renderHeader();
          if (state.route === 'menu') renderMenu();
          else if (state.route === 'rank') renderRank();
          else if (state.route === 'leaderboard') renderLeaderboard();
          updateSpeedrunStats();
        } catch (error) {
          console.error(error);
          state.cloudStatus = 'error';
          showToast(`Không tải được cloud profile: ${error.message}`, 'error');
        }
      }, error => {
        state.cloudStatus = 'error';
        console.error('Profile listener failed:', error);
        showToast(`Firebase profile lỗi: ${error.message}`, 'error');
      });
    });
  }

  async function createCloudProfile(user, displayNameOverride = '') {
    if (!fbDb || !user) return;
    const taskKey = user.uid;
    if (profileCreationTasks.has(taskKey)) {
      const profile = await profileCreationTasks.get(taskKey);
      if (displayNameOverride && profile?.displayName !== displayNameOverride.slice(0, 20)) {
        await fbDb.collection('users').doc(user.uid).update({ displayName: displayNameOverride.slice(0, 20), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      }
      return profile;
    }
    const ref = fbDb.collection('users').doc(user.uid);
    const task = (async () => {
      const existing = await ref.get();
      if (existing.exists) {
        if (displayNameOverride && existing.data()?.displayName !== displayNameOverride.slice(0, 20)) {
          await ref.update({ displayName: displayNameOverride.slice(0, 20), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
        return (await ref.get()).data();
      }
      const displayName = (displayNameOverride || user.displayName || user.email?.split('@')[0] || 'Runner').trim().slice(0, 20);
      const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
      const profile = {
        displayName,
        email: user.email || '',
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp,
        totalRuns: 0, totalCorrect: 0, bestTimeMs: null, hasClear: false,
        records: {}, history: [], updatedAt: serverTimestamp
      };
      await ref.set(profile);
      return profile;
    })();
    profileCreationTasks.set(taskKey, task);
    try {
      return await task;
    } finally {
      profileCreationTasks.delete(taskKey);
    }
  }

  async function getCloudProfile() {
    if (!fbAuth?.currentUser || !fbDb) return null;
    const snap = await fbDb.collection('users').doc(fbAuth.currentUser.uid).get();
    if (!snap.exists) return null;
    const data = ensureUserShape({ key: snap.id, ...snap.data() });
    return { key: snap.id, uid: snap.id, name: data.displayName, ...data };
  }

  function getRank(user) {
    const clears = totalCorrect(user);
    let result = RANKS[0];
    for (const rank of RANKS) if (clears >= rank.threshold) result = rank;
    return result;
  }

  function rankProgress(user) {
    const clears = totalCorrect(user);
    const current = getRank(user);
    if (current.id === 'emperor') return { current, next: null, pct: 100, remaining: 0 };
    const idx = RANKS.findIndex(rank => rank.id === current.id);
    const next = RANKS[idx + 1];
    const span = Math.max(1, next.threshold - current.threshold);
    return { current, next, pct: Math.max(0, Math.min(100, ((clears - current.threshold) / span) * 100)), remaining: Math.max(0, next.threshold - clears) };
  }

  function rankIconSvg(rank, size = 'normal') {
    const id = rank?.id || 'bronze';
    const css = `rank-symbol ${size} ${id}`;
    const common = `class="${css}" viewBox="0 0 64 64" aria-hidden="true" focusable="false"`;
    const shapes = {
      bronze: `<circle cx="32" cy="32" r="23"/><path d="M22 21h20l5 8-15 21-15-21 5-8Z"/><path d="M27 25h10"/>`,
      silver: `<path d="M32 6 51 15 46 48H18L13 15 32 6Z"/><path d="M21 24h22M24 33h16M28 42h8"/>`,
      gold: `<path d="M11 16h13l8-9 8 9h13l-5 13a17 17 0 0 1-16 12 17 17 0 0 1-16-12l-5-13Z"/><path d="M24 48h16M19 56h26"/>`,
      platinum: `<path d="m32 5 22 16-9 28-13 11-13-11-9-28L32 5Z"/><path d="m10 21 22 8 22-8M19 49l13-20 13 20M32 29v31"/>`,
      legendary: `<path d="M10 13h12l10 12 10-12h12l-4 18c-2 10-9 15-18 15s-16-5-18-15l-4-18Z"/><path d="M18 13V7h8l6 8 6-8h8v6M21 52h22M17 58h30"/>`,
      god: `<path d="M36 4 18 31h12L23 60l23-32H34L36 4Z"/><path d="M10 40c5 3 8 9 8 17M54 40c-5 3-8 9-8 17"/>`,
      emperor: `<path d="m8 18 10 27h28l10-27-14 9-10-17-10 17-14-9Z"/><path d="M15 53h34M20 59h24"/>`
    };
    return `<svg ${common}><g fill="none" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round">${shapes[id] || shapes.bronze}</g></svg>`;
  }

  function allChallenges() { return window.BUG_SPEEDRUNNER_CHALLENGES || []; }
  function challengeSet(language) { return allChallenges().filter(challenge => challenge.language === language); }

  function randomSeed() {
    const cryptoObj = window.crypto;
    if (cryptoObj?.getRandomValues) { const buf = new Uint32Array(2); cryptoObj.getRandomValues(buf); return `${buf[0].toString(36)}${buf[1].toString(36)}`; }
    return `${Date.now().toString(36)}${Math.floor(Math.random() * 0xffffff).toString(36)}`;
  }

  function replaceIdentifierPair(code, replacements) {
    let result = String(code);
    for (const [from, to] of replacements) {
      const pattern = new RegExp(`(^|[^A-Za-z0-9_$])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^A-Za-z0-9_$])`, 'g');
      result = result.replace(pattern, (_, prefix) => `${prefix}${to}`);
    }
    return result;
  }

  function getRank(user) {
    const clears = totalCorrect(user);
    let result = RANKS[0];
    for (const rank of RANKS) if (clears >= rank.threshold) result = rank;
    return result;
  }

  function rankProgress(user) {
    const clears = totalCorrect(user);
    const current = getRank(user);
    if (current.id === 'emperor') return { current, next: null, pct: 100, remaining: 0 };
    const idx = RANKS.findIndex(rank => rank.id === current.id);
    const next = RANKS[idx + 1];
    const span = Math.max(1, next.threshold - current.threshold);
    return {
      current,
      next,
      pct: Math.max(0, Math.min(100, ((clears - current.threshold) / span) * 100)),
      remaining: Math.max(0, next.threshold - clears)
    };
  }

  function rankIconSvg(rank, size = 'normal') {
    const id = rank?.id || 'bronze';
    const css = `rank-symbol ${size} ${id}`;
    const common = `class="${css}" viewBox="0 0 64 64" aria-hidden="true" focusable="false"`;
    const shapes = {
      bronze: `<circle cx="32" cy="32" r="23"/><path d="M22 21h20l5 8-15 21-15-21 5-8Z"/><path d="M27 25h10"/>`,
      silver: `<path d="M32 6 51 15 46 48H18L13 15 32 6Z"/><path d="M21 24h22M24 33h16M28 42h8"/>`,
      gold: `<path d="M11 16h13l8-9 8 9h13l-5 13a17 17 0 0 1-16 12 17 17 0 0 1-16-12l-5-13Z"/><path d="M24 48h16M19 56h26"/>`,
      platinum: `<path d="m32 5 22 16-9 28-13 11-13-11-9-28L32 5Z"/><path d="m10 21 22 8 22-8M19 49l13-20 13 20M32 29v31"/>`,
      legendary: `<path d="M10 13h12l10 12 10-12h12l-4 18c-2 10-9 15-18 15s-16-5-18-15l-4-18Z"/><path d="M18 13V7h8l6 8 6-8h8v6M21 52h22M17 58h30"/>`,
      god: `<path d="M36 4 18 31h12L23 60l23-32H34L36 4Z"/><path d="M10 40c5 3 8 9 8 17M54 40c-5 3-8 9-8 17"/>`,
      emperor: `<path d="m8 18 10 27h28l10-27-14 9-10-17-10 17-14-9Z"/><path d="M15 53h34M20 59h24"/>`
    };
    return `<svg ${common}><g fill="none" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round">${shapes[id] || shapes.bronze}</g></svg>`;
  }

  function allChallenges() { return window.BUG_SPEEDRUNNER_CHALLENGES || []; }
  function challengeSet(language) { return allChallenges().filter(challenge => challenge.language === language); }

  function randomSeed() {
    const cryptoObj = window.crypto;
    if (cryptoObj?.getRandomValues) {
      const buf = new Uint32Array(2);
      cryptoObj.getRandomValues(buf);
      return `${buf[0].toString(36)}${buf[1].toString(36)}`;
    }
    return `${Date.now().toString(36)}${Math.floor(Math.random() * 0xffffff).toString(36)}`;
  }

  function replaceIdentifierPair(code, replacements) {
    let result = String(code);
    for (const [from, to] of replacements) {
      const pattern = new RegExp(`(^|[^A-Za-z0-9_$])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^A-Za-z0-9_$])`, 'g');
      result = result.replace(pattern, (_, prefix) => `${prefix}${to}`);
    }
    return result;
  }

  function createVariant(base) {
    const seed = randomSeed();
    const suffix = seed.replace(/[^a-z0-9]/gi, '').slice(0, 7) || 'run';
    const variant = { ...base, seed, variantId: `${base.id}:${seed}` };
    const replacements = {
      'js-inventory-01': [
        ['calculateSubtotal', `calculateSubtotal_${suffix}`],
        ['calculateDiscount', `calculateDiscount_${suffix}`],
        ['buildReceipt', `buildReceipt_${suffix}`],
        ['formatMoney', `formatMoney_${suffix}`],
        ['cart', `cart_${suffix}`]
      ],
      'js-login-02': [
        ['countFailedAttempts', `countFailedAttempts_${suffix}`],
        ['attempts', `attempts_${suffix}`],
        ['events', `events_${suffix}`],
        ['username', `username_${suffix}`],
        ['failed', `failed_${suffix}`]
      ],
      'cpp-average-01': [
        ['average', `average_${suffix}`],
        ['expected', `expected_${suffix}`],
        ['difference', `difference_${suffix}`],
        ['temperatures', `temperatures_${suffix}`]
      ],
      'cpp-stack-02': [
        ['popScore', `popScore_${suffix}`],
        ['safeScore', `safeScore_${suffix}`],
        ['scores', `scores_${suffix}`],
        ['first', `first_${suffix}`],
        ['second', `second_${suffix}`],
        ['third', `third_${suffix}`],
        ['fourth', `fourth_${suffix}`]
      ],
      'csharp-grade-01': [
        ['Grade', `Grade_${suffix}`],
        ['scores', `scores_${suffix}`],
        ['expected', `expected_${suffix}`],
        ['pass', `pass_${suffix}`]
      ],
      'csharp-null-02': [
        ['Greeting', `Greeting_${suffix}`],
        ['displayName', `displayName_${suffix}`],
        ['names', `names_${suffix}`],
        ['expected', `expected_${suffix}`],
        ['actual', `actual_${suffix}`],
        ['pass', `pass_${suffix}`]
      ]
    };

    if (replacements[base.id]) {
      variant.broken = replaceIdentifierPair(base.broken, replacements[base.id]);
      variant.solution = replaceIdentifierPair(base.solution, replacements[base.id]);
    }

    const marker = base.language === 'html'
      ? `\n<!-- SPEEDRUN VARIANT: ${seed} -->`
      : base.language === 'python'
        ? `\n# SPEEDRUN VARIANT: ${seed}`
        : `\n// SPEEDRUN VARIANT: ${seed}`;

    variant.broken = `${variant.broken}${marker}`;
    variant.solution = `${variant.solution}${marker}`;
    return variant;
  }

  function routeFromHash() {
    const raw = location.hash.replace(/^#/, '');
    return ['menu', 'speedrun', 'rank', 'leaderboard', 'academy'].includes(raw) ? raw : 'menu';
  }

  function go(route) {
    const target = ['menu', 'speedrun', 'rank', 'leaderboard', 'academy'].includes(route) ? route : 'menu';
    if (location.hash !== `#${target}`) location.hash = target;
    else renderRoute();
  }

  function renderHeader() {
    const btn = $('userBtn');
    if (!btn) return;
    if (state.currentUser) {
      btn.innerHTML = `<span class="header-user-dot"></span><span>${escapeHtml(state.currentUser.name)}</span>`;
      btn.title = 'Mở profile / đăng xuất';
    } else {
      btn.textContent = 'Đăng nhập';
      btn.title = 'Đăng nhập / Đăng ký';
    }
  }

  function renderMenu() {
    const user = state.currentUser;
    const progress = rankProgress(user);
    view.innerHTML = `
      <section class="view menu-view">
        <div class="menu-inner">
          <div class="hero">
            <div class="hero-copy">
              <span class="eyebrow">CLOUD ARENA • HK1413</span>
              <h1>HUNT THE BUG.<br><span style="color:var(--mint)">BEAT THE CLOCK.</span></h1>
              <p>Bug Speedrunner là đấu trường sửa code tốc độ. Chọn bài, vào run, tìm bug và leo rank bằng số lần giải đúng.</p>
              <div class="hero-cta"><button class="primary-btn" id="heroSpeedrunBtn">▶ Bắt đầu Speedrun</button><button class="secondary-btn" id="heroRankBtn">🏆 Xem Rank</button></div>
            </div>
            <div class="hero-panel">
              <div class="hero-panel-top"><span class="eyebrow">RUNNER STATUS</span><span class="online-dot"></span></div>
              <div class="menu-stats">
                <div class="menu-stat"><small>RANK</small><strong class="menu-rank-value ${progress.current.id}">${rankIconSvg(progress.current, 'mini')} ${escapeHtml(progress.current.name)}</strong></div>
                <div class="menu-stat"><small>ĐÚNG</small><strong>${user ? totalCorrect(user) : 0}</strong></div>
                <div class="menu-stat"><small>BEST TIME</small><strong>${user ? bestOverall(user) : '—'}</strong></div>
                <div class="menu-stat"><small>RUNS</small><strong>${user ? user.stats.totalRuns : 0}</strong></div>
              </div>
            </div>
          </div>
          <div class="menu-grid">
            <button class="feature-card" id="menuSpeedrunBtn"><div class="feature-icon">⚡</div><h3>Speedrun</h3><p>Vào IDE, sửa bug trong giới hạn thời gian và ghi kỷ lục cá nhân.</p><span class="feature-arrow">→</span></button>
            <button class="feature-card" id="menuRankBtn"><div class="feature-icon">🏆</div><h3>Rank</h3><p>Tìm hiểu 7 nấc rank, icon vector và tiến trình từ Đồng tới Đế vương.</p><span class="feature-arrow">→</span></button>
            <button class="feature-card" id="menuLeaderboardBtn"><div class="feature-icon">📊</div><h3>Leaderboard</h3><p>Hai bảng cạnh tranh: runner nhanh nhất và runner giải đúng nhiều nhất.</p><span class="feature-arrow">→</span></button>
            <button class="feature-card" id="menuAcademyBtn"><div class="feature-icon">🎓</div><h3>Beginner Academy</h3><p>Học cách nhìn bug nhanh, phím tắt IDE và tài nguyên lập trình miễn phí.</p><span class="feature-arrow">→</span></button>
          </div>
          <div class="menu-bottom">
            <div class="daily-strip"><strong>💡 Quick Tip</strong><br><span>Mỗi lượt chơi chọn một challenge ngẫu nhiên trong ngôn ngữ đang dùng.</span></div>
            <div class="menu-footer-note">Developed by HK1413</div>
          </div>
        </div>
      </section>`;
    $('heroSpeedrunBtn').onclick = () => go('speedrun');
    $('heroRankBtn').onclick = () => go('rank');
    $('menuSpeedrunBtn').onclick = () => go('speedrun');
    $('menuRankBtn').onclick = () => go('rank');
    $('menuLeaderboardBtn').onclick = () => go('leaderboard');
    $('menuAcademyBtn').onclick = () => go('academy');
  }

  function renderSpeedrun() {
    view.innerHTML = `
      <section class="view speedrun-view">
        <div class="speed-status"><div class="status-left"><span class="status-badge">CLOUD ARENA</span><span id="challengeStatusText">Select a challenge.</span></div><div class="status-right"><span>FAIR PLAY</span><span>Copy / Paste blocked</span><span id="cloudStatusBadge" class="cloud-status">Cloud: connecting</span></div></div>
        <div class="speed-workspace">
          <aside class="speed-sidebar left">
            <div class="section-label">LANGUAGE</div>
            <div class="field-block"><div class="select-wrap"><select id="languageSelect"></select><i data-lucide="chevron-down"></i></div></div>
            <div class="section-label" style="display:flex;justify-content:space-between"><span>CHALLENGES</span><span id="challengeCount">0/0</span></div>
            <div class="challenge-tools"><button id="randomBtn" class="small-tool">🎲 Random challenge</button></div>
            <input id="challengeSearch" class="challenge-search" placeholder="Search challenge..." autocomplete="off">
            <div id="challengeList" class="challenge-list"></div>
            <div class="side-card" style="margin-top:14px"><h3>SPEEDRUN RULE</h3><p class="run-note">Không thể chỉnh code trước khi Start Match. Mỗi match sinh một variant mới. Kết thúc run sẽ tự sinh board mới.</p></div>
          </aside>
          <section class="editor-area">
            <div class="editor-toolbar">
              <div class="file-pill"><strong id="editorFileLabel">challenge.js</strong><span class="file-state">LIVE</span></div>
              <div class="language-name" id="languageLabel">JavaScript</div>
              <div class="timer-box"><span id="runState" class="run-state">READY</span><div id="timer" class="timer">03:00.000</div></div>
              <div class="editor-actions"><button id="menuBtn" class="secondary-btn">☰ Menu</button><button id="practiceBtn" class="secondary-btn practice-btn">◇ Practice</button><button id="resetBtn" class="secondary-btn">↻ Reset</button><button id="startBtn" class="start-btn">▶ Start Match</button><button id="submitBtn" class="submit-btn" disabled>⚑ Submit</button></div>
            </div>
            <div class="editor-wrap"><div id="editor" class="editor"></div><div id="editorUnavailable" class="editor-unavailable hidden"><div class="editor-unavailable-box"><h3>Monaco Editor unavailable</h3><p>Không tải được Monaco từ CDN. Kiểm tra mạng rồi reload.</p></div></div></div>
            <div id="bottomPanel" class="bottom-panel">
              <div class="panel-tabs"><button class="panel-tab active" data-tab="log">Run Log</button><button class="panel-tab" data-tab="results">Results</button><button class="panel-tab" data-tab="ai">AI Support</button><button id="toggleBottomBtn" class="panel-collapse-btn" type="button">⌃ Thu gọn</button></div>
              <div id="logPanel" class="panel-body"><div id="outputBody" class="log-line">Ready. Chọn challenge và nhấn Start Match.</div></div>
              <div id="resultsPanel" class="panel-body hidden"><div id="resultsBody"></div></div>
              <div id="aiPanel" class="panel-body hidden"><div id="aiOutput" class="ai-empty">AI analysis sẽ xuất hiện sau Submit/Timeout khi bạn đã cấu hình Gemini.</div></div>
            </div>
          </section>
          <aside class="speed-sidebar right">
            <div class="side-card"><h3>CURRENT RUN</h3><div class="side-main-stat" id="currentStat">READY</div><div class="side-substat" id="challengeMeta">—</div><div class="progress-track"><span id="progressBar"></span></div><p id="challengeDescription" class="run-note">Choose a challenge from the left.</p></div>
            <div class="side-card"><h3>YOUR RANK</h3><div id="rankChip" class="rank-chip" style="margin-top:10px"></div><p id="rankProgressText" class="run-note"></p></div>
            <div class="side-card"><h3>PERSONAL BEST</h3><div id="bestStat" class="side-main-stat">—</div><div id="runsStat" class="side-substat">0 correct clears</div></div>
            <div class="side-actions"><button id="leaderboardSideBtn" class="secondary-btn">🏆 Rank Board</button><button id="settingsSideBtn" class="secondary-btn">⚙ Settings</button></div>
          </aside>
        </div>
      </section>`;

    bindSpeedrunControls();
    populateSpeedrunSelectors();
    state.activePanel = 'log';
    loadChallenge(true);
    initMonacoIfNeeded();
  }

  function renderRank() {
    const user = state.currentUser;
    const progress = rankProgress(user);
    view.innerHTML = `
      <section class="view page-shell">
        <div class="page-head"><div class="page-title"><button class="nav-btn back-btn" id="rankBackBtn">← Menu</button><div><h2>Rank System</h2><div class="page-subtitle">7 nấc tiến trình của Bug Speedrunner</div></div></div><button id="rankSpeedrunBtn" class="primary-btn">⚡ Speedrun</button></div>
        <div class="page-content">
          <div class="rank-hero"><div class="rank-progress-card"><div class="rank-progress-head"><span class="eyebrow">YOUR CURRENT RANK</span><strong>${user ? `${totalCorrect(user)} clears` : 'Guest'}</strong></div><div class="rank-progress-main"><span class="big-icon ${progress.current.id}">${rankIconSvg(progress.current, 'normal')}</span><div><strong class="rank-text-${progress.current.id}">${escapeHtml(progress.current.name)}</strong><br><span>${escapeHtml(progress.current.description)}</span></div></div><div class="progress-track"><span style="width:${progress.pct}%"></span></div><div class="rank-progress-note">${progress.next ? `Còn ${progress.remaining} clear để lên ${progress.next.name}.` : 'Bạn đã đạt Đế vương — 60 speedrun đúng.'}</div></div><div class="rank-tip-card"><h3>🏁 Rank Rules</h3><p>Chỉ speedrun đúng mới cộng rank. Thua, timeout và practice không cộng. Đế vương mở khóa từ 60 clear.</p></div></div>
          <div class="rank-grid">${RANKS.map(rank => `<article class="rank-card ${rank.id}${rank.id === progress.current.id ? ' current' : ''}"><div class="rank-top"><div class="rank-icon ${rank.id}">${rankIconSvg(rank, 'normal')}</div><div><div class="rank-name">${escapeHtml(rank.name)}</div><div class="rank-requirement">${rank.threshold === 0 ? 'Bắt đầu' : `${rank.threshold} speedrun đúng`}</div></div></div>${rank.id === progress.current.id ? '<span class="rank-current-tag">CURRENT</span>' : ''}<p class="rank-copy">${escapeHtml(rank.description)}</p><div class="rank-bar"><span style="width:${user ? Math.min(100, (totalCorrect(user) / Math.max(1, rank.threshold || 1)) * 100) : 0}%"></span></div></article>`).join('')}</div>
          <div class="achievement-grid">${[
            ['⚡', 'First Blood', '1 clear', 1], ['🔥', 'Heat Up', '5 clears', 5], ['🏆', 'Gold Rush', '8 clears', 8], ['💎', 'Diamond Hands', '15 clears', 15], ['👑', 'Legendary', '25 clears', 25], ['⚡', 'GOD MODE', '40 clears', 40], ['♛', 'Đế vương', '60 clears', 60], ['☠️', 'No Quit', '10 attempts', 10], ['🎯', 'Clean Run', '1 PB', -1]
          ].map(a => `<div class="achievement ${(user && (a[3] < 0 ? Object.keys(user.records).length > 0 : a[1] === 'No Quit' ? user.stats.totalRuns >= a[3] : totalCorrect(user) >= a[3])) ? 'unlocked' : ''}"><div class="a-icon">${a[0]}</div><strong>${a[1]}</strong><small>${a[2]}</small></div>`).join('')}</div>
        </div>
      </section>`;
    $('rankBackBtn').onclick = () => go('menu');
    $('rankSpeedrunBtn').onclick = () => go('speedrun');
  }

  function bestOverallMs(user) {
    const times = Object.values(user?.records || {}).map(Number).filter(value => value > 0);
    return times.length ? Math.min(...times) : null;
  }

  function bestOverall(user) {
    const best = bestOverallMs(user);
    return best ? formatMs(best) : '—';
  }

  function buildRunnerStats() {
    return Array.from(state.leaderboardUsers.entries()).map(([key, raw]) => {
      const user = { key, ...ensureUserShape(raw) };
      const name = user.displayName || user.email?.split('@')[0] || 'Runner';
      return { key, name, user, rank: getRank(user), bestMs: bestOverallMs(user), best: bestOverall(user), clears: totalCorrect(user), runs: Number(user.stats.totalRuns || 0) };
    });
  }

  function renderLeaderboard() {
    const runners = buildRunnerStats();
    const fastest = runners.filter(runner => Number.isFinite(runner.bestMs)).sort((a, b) => a.bestMs - b.bestMs || b.clears - a.clears).slice(0, 100);
    const most = [...runners].sort((a, b) => b.clears - a.clears || (a.bestMs ?? Infinity) - (b.bestMs ?? Infinity) || a.name.localeCompare(b.name)).slice(0, 100);
    const loading = state.firebaseReady && !state.leaderboardUsers.size ? '<tr><td colspan="4">Đang đồng bộ leaderboard từ Firebase…</td></tr>' : '';
    const row = (runner, index, mode) => `<tr class="${state.currentUser?.key === runner.key ? 'current ' : ''}rank-row-${runner.rank.id}"><td>${index + 1}</td><td><button class="runner-profile-btn" data-profile-key="${escapeHtml(runner.key)}"><span class="rank-mini ${runner.rank.id}">${rankIconSvg(runner.rank, 'mini')}</span><span class="runner-name rank-text-${runner.rank.id}">${escapeHtml(runner.name)}</span><span class="runner-rank-chip">${rankIconSvg(runner.rank, 'mini')} ${escapeHtml(runner.rank.name)}</span></button></td><td>${mode === 'speed' ? `<span class="time-code">${runner.best}</span>` : `<span class="count-code">${runner.clears}</span>`}</td><td>${runner.runs}</td></tr>`;
    view.innerHTML = `
      <section class="view page-shell"><div class="page-head"><div class="page-title"><button class="nav-btn back-btn" id="leaderBackBtn">← Menu</button><div><h2>Leaderboard</h2><div class="page-subtitle">Global Firebase leaderboard • click runner để xem profile</div></div></div><button id="leaderSpeedrunBtn" class="primary-btn">⚡ Speedrun</button></div>
        <div class="page-content"><div class="leader-grid"><section class="leader-section"><div class="leader-section-head"><div><h3>⚡ Fastest Runners</h3><p>Best time thấp nhất sẽ đứng đầu.</p></div></div><div class="leader-table-wrap"><table class="leader-table"><thead><tr><th>#</th><th>Runner</th><th>Best Time</th><th>Runs</th></tr></thead><tbody>${fastest.length ? fastest.map((runner, index) => row(runner, index, 'speed')).join('') : (loading || '<tr><td colspan="4">Chưa có kỷ lục.</td></tr>')}</tbody></table></div></section>
          <section class="leader-section"><div class="leader-section-head"><div><h3>🏆 Most Clears</h3><p>Tổng số speedrun đúng sẽ quyết định thứ hạng.</p></div></div><div class="leader-table-wrap"><table class="leader-table"><thead><tr><th>#</th><th>Runner</th><th>Correct</th><th>Runs</th></tr></thead><tbody>${most.length ? most.map((runner, index) => row(runner, index, 'count')).join('') : (loading || '<tr><td colspan="4">Chưa có dữ liệu.</td></tr>')}</tbody></table></div></section></div></div>
      </section>`;
    $('leaderBackBtn').onclick = () => go('menu');
    $('leaderSpeedrunBtn').onclick = () => go('speedrun');
    document.querySelectorAll('.runner-profile-btn').forEach(button => button.onclick = () => openProfile(button.dataset.profileKey));
  }

  function renderAcademy() {
    view.innerHTML = `<section class="view page-shell"><div class="page-head"><div class="page-title"><button class="nav-btn back-btn" id="academyBackBtn">← Menu</button><div><h2>Beginner Academy</h2><div class="page-subtitle">Học cách nhìn bug nhanh hơn</div></div></div><button id="academySpeedrunBtn" class="primary-btn">⚡ Try a Run</button></div><div class="page-content"><div class="academy-grid"><article class="academy-card"><h3>01 — Luật chơi</h3><p>Chọn language → challenge → Start Match → sửa code → Submit. Chỉ clear đúng trước timeout mới được lưu.</p></article><article class="academy-card"><h3>02 — Soi syntax</h3><ul><li>Đếm cặp ngoặc và quote.</li><li>HTML: tìm tag mở thiếu tag đóng.</li><li>Kiểm tra <code>=</code> và <code>==/===</code>.</li><li>Để ý semicolon, comma, brace.</li></ul></article><article class="academy-card"><h3>03 — Soi logic</h3><ul><li>Đọc input/output trước.</li><li>Kiểm tra boundary <code>&lt;</code> hay <code>&lt;=</code>.</li><li>Kiểm tra null trước khi gọi method.</li><li>Kiểm tra giá trị có bị bỏ qua không.</li></ul></article><article class="academy-card"><h3>04 — Fair Play</h3><ul><li>Copy/Cut/Paste/Drop bị chặn.</li><li>Code bị khóa trước Start Match.</li><li>Mỗi match có variant mới.</li><li>Finish sẽ lập tức sinh board mới.</li></ul></article></div><div class="resource-grid"><a class="resource-link" target="_blank" rel="noopener" href="https://www.freecodecamp.org/">freeCodeCamp</a><a class="resource-link" target="_blank" rel="noopener" href="https://javascript.info/">javascript.info</a><a class="resource-link" target="_blank" rel="noopener" href="https://www.geeksforgeeks.org/">GeeksforGeeks</a><a class="resource-link" target="_blank" rel="noopener" href="https://developer.mozilla.org/">MDN Web Docs</a><a class="resource-link" target="_blank" rel="noopener" href="https://learn.microsoft.com/dotnet/csharp/">Microsoft Learn — C#</a></div></div></section>`;
    $('academyBackBtn').onclick = () => go('menu');
    $('academySpeedrunBtn').onclick = () => go('speedrun');
  }

  function parseFormatted(value) {
    const match = String(value).match(/^(\d+):(\d+)\.(\d+)$/);
    return match ? Number(match[1]) * 60000 + Number(match[2]) * 1000 + Number(match[3]) : Infinity;
  }

  function openModal(id) {
    const el = $(id);
    if (el) { el.classList.add('show'); el.setAttribute('aria-hidden', 'false'); }
  }

  function closeModal(id) {
    const el = $(id);
    if (el) { el.classList.remove('show'); el.setAttribute('aria-hidden', 'true'); }
  }

  function bindGlobalButtons() {
    $('homeBrandBtn').onclick = () => go('menu');
    $('topRankBtn').onclick = () => go('rank');
    $('topLeaderboardBtn').onclick = () => go('leaderboard');
    $('topSettingsBtn').onclick = () => openSettings();
    $('userBtn').onclick = () => state.currentUser ? openProfile(state.currentUser.key, true) : openAuth('login');
    $('zipBtn').onclick = downloadProjectZip;
  }

  function renderRoute() {
    if (state.route === 'speedrun' && state.running) stopRun(false);
    state.route = routeFromHash();
    state.currentUser = currentUser();
    renderHeader();
    if (state.route !== 'speedrun' && state.editor) { state.editor.dispose(); state.editor = null; state.monacoReady = false; state.challenge = null; }
    if (state.route === 'menu') renderMenu();
    else if (state.route === 'speedrun') renderSpeedrun();
    else if (state.route === 'rank') renderRank();
    else if (state.route === 'leaderboard') renderLeaderboard();
    else renderAcademy();
    if (window.lucide) window.lucide.createIcons();
  }

  function bindSpeedrunControls() {
    $('menuBtn').onclick = () => go('menu');
    $('resetBtn').onclick = resetChallenge;
    $('practiceBtn').onclick = togglePractice;
    $('toggleBottomBtn').onclick = toggleBottomPanel;
    $('startBtn').onclick = startRun;
    $('submitBtn').onclick = () => { if (state.running) finishRun('Manual submission.', false); };
    $('leaderboardSideBtn').onclick = () => go('leaderboard');
    $('settingsSideBtn').onclick = openSettings;
    $('randomBtn').onclick = () => selectRandomChallenge();
    $('challengeSearch').addEventListener('input', renderChallengeList);
    document.querySelectorAll('.panel-tab').forEach(btn => btn.onclick = () => switchPanel(btn.dataset.tab));
    $('languageSelect').onchange = () => { if (state.running) return; state.language = $('languageSelect').value; state.challengeIndex = 0; loadChallenge(); };
  }

  function populateSpeedrunSelectors() {
    const select = $('languageSelect');
    select.innerHTML = Object.entries(LANGUAGES).map(([key, meta]) => `<option value="${key}">${meta.label}</option>`).join('');
    select.value = state.language;
    renderChallengeList();
  }

  function renderChallengeList() {
    const query = ($('challengeSearch')?.value || '').trim().toLowerCase();
    const set = challengeSet(state.language);
    const list = set.filter(challenge => !query || challenge.title.toLowerCase().includes(query) || challenge.id.toLowerCase().includes(query));
    $('challengeCount').textContent = `${list.length}/${set.length}`;
    $('challengeList').innerHTML = list.map(challenge => `<button class="challenge-card ${state.challengeBase?.id === challenge.id ? 'active' : ''}" data-challenge-id="${escapeHtml(challenge.id)}"><div class="line"><span class="challenge-title">${escapeHtml(challenge.title)}</span><span class="difficulty ${challenge.difficulty.toLowerCase()}">${escapeHtml(challenge.difficulty)}</span></div><div class="challenge-meta">${formatMs(challenge.timeLimitMs)} limit · ${escapeHtml(challenge.id)}</div></button>`).join('') || '<div class="ai-empty">No challenge found.</div>';
    document.querySelectorAll('[data-challenge-id]').forEach(btn => btn.onclick = () => { if (state.running || state.finishing) return; const index = set.findIndex(challenge => challenge.id === btn.dataset.challengeId); state.challengeIndex = index; loadChallenge(); });
  }

  function selectChallengeObject(challenge) {
    if (!challenge || state.running || state.finishing) return;
    state.language = challenge.language;
    state.challengeIndex = Math.max(0, challengeSet(state.language).findIndex(item => item.id === challenge.id));
    if ($('languageSelect')) $('languageSelect').value = state.language;
    loadChallenge();
  }

  function selectRandomChallenge(excludeId = state.challengeBase?.id) {
    const list = challengeSet(state.language);
    if (!list.length) return;
    const choices = list.length > 1 ? list.filter(challenge => challenge.id !== excludeId) : list;
    const challenge = choices[Math.floor(Math.random() * choices.length)];
    selectChallengeObject(challenge);
  }

  function setReadOnly(value) {
    if (state.editor) state.editor.updateOptions({ readOnly: Boolean(value), contextmenu: false });
    document.body.classList.toggle('editor-locked', Boolean(value));
  }

  function configureCurrentEditor() {
    if (!state.editor || !state.challenge) return;
    const meta = LANGUAGES[state.challenge.language];
    state.editor.setValue(state.challenge.broken);
    monaco.editor.setModelLanguage(state.editor.getModel(), meta.monaco);
    setReadOnly(!state.running && !state.practice);
  }

  function loadChallenge(first = false) {
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = null;
    state.running = false;
    state.finishing = false;
    state.elapsedMs = 0;
    state.practice = false;
    const set = challengeSet(state.language);
    if (!set.length) return;
    if (state.challengeIndex >= set.length) state.challengeIndex = 0;
    state.challengeBase = set[state.challengeIndex];
    state.challenge = createVariant(state.challengeBase);
    state.challengeVariantSeed = state.challenge.seed;
    updateChallengeUi();
    updateTimer();
    updateActionButtons();
    configureCurrentEditor();
    setOutput(`Loaded: ${state.challengeBase.title}\nNew random variant generated.\nCode is locked until Start Match.`);
    if ($('resultsBody')) $('resultsBody').innerHTML = '<div class="ai-empty">No run result yet.</div>';
    if ($('aiOutput')) $('aiOutput').innerHTML = getGeminiKey() ? '<div class="ai-empty">AI ready. Analysis appears after Submit/Timeout.</div>' : '<div class="ai-empty">Add a Gemini API Key in Settings to enable post-run analysis.</div>';
    state.activePanel = 'log';
    switchPanel('log');
    renderChallengeList();
    updateSpeedrunStats();
    if (first) syncPracticeUi();
  }

  function updateChallengeUi() {
    const base = state.challengeBase;
    const variant = state.challenge;
    if (!base) return;
    const meta = LANGUAGES[base.language];
    if ($('languageLabel')) $('languageLabel').textContent = meta.label;
    if ($('editorFileLabel')) $('editorFileLabel').textContent = `challenge.${meta.ext}`;
    if ($('challengeStatusText')) $('challengeStatusText').textContent = `${base.title} · ${meta.label} · variant ${variant?.seed ? variant.seed.slice(0, 7) : '—'}`;
    if ($('challengeMeta')) $('challengeMeta').textContent = `${meta.label} · ${base.difficulty}`;
    if ($('challengeDescription')) $('challengeDescription').textContent = base.description || 'Repair the broken code before the clock reaches zero.';
  }

  function prepareFreshVariantAfterFinish() {
    if (!state.challengeBase) return;
    const completedId = state.challengeBase.id;
    const list = challengeSet(state.language);
    const choices = list.length > 1 ? list.filter(challenge => challenge.id !== completedId) : list;
    const nextChallenge = choices[Math.floor(Math.random() * choices.length)];
    state.challengeIndex = Math.max(0, list.findIndex(challenge => challenge.id === nextChallenge.id));
    state.challengeBase = nextChallenge;
    state.challenge = createVariant(nextChallenge);
    state.challengeVariantSeed = state.challenge.seed;
    state.elapsedMs = 0;
    state.running = false;
    state.practice = false;
    updateChallengeUi();
    updateTimer();
    configureCurrentEditor();
    updateActionButtons();
    setOutput(`Previous run finished.\nNEW RANDOM CHALLENGE: ${state.challengeBase.title}\nVariant: ${state.challenge.seed.slice(0, 9)}\nPress Start Match when ready.`);
    updateSpeedrunStats();
    renderChallengeList();
  }

  function updateTimer() {
    if (!$('timer')) return;
    $('timer').textContent = formatMs(state.elapsedMs);
    $('timer').classList.toggle('hot', state.elapsedMs >= (state.challenge?.timeLimitMs || DEFAULT_TIME_MS) * 0.75);
  }

  function updateActionButtons() {
    const start = $('startBtn');
    const submit = $('submitBtn');
    const practice = $('practiceBtn');
    if (!start || !submit) return;
    start.disabled = state.running || state.finishing;
    start.textContent = state.running ? '⏱ Match Live' : '▶ Start Match';
    submit.disabled = !state.running || state.finishing;
    if ($('runState')) $('runState').textContent = state.running ? 'RUNNING' : (state.practice ? 'PRACTICE' : 'READY');
    if (practice) practice.classList.toggle('active', state.practice);
  }

  function timerFrame(now, runId) {
    if (!state.running || runId !== state.activeRunId) return;
    state.elapsedMs = Math.min(now - state.startAt, state.challenge.timeLimitMs);
    updateTimer();
    if (state.elapsedMs >= state.challenge.timeLimitMs) {
      finishRun('Time limit reached.', true, runId);
      return;
    }
    state.rafId = requestAnimationFrame(timestamp => timerFrame(timestamp, runId));
  }

  function startRun() {
    if (!state.currentUser) { showToast('Đăng nhập Firebase để chạy ranked speedrun.', 'error'); openAuth('login'); return; }
    if (!state.editor || !state.challengeBase || state.running || state.finishing) return;
    selectRandomChallenge();
    if (!state.challengeBase) return;
    state.practice = false;
    state.challenge = createVariant(state.challengeBase);
    state.challengeVariantSeed = state.challenge.seed;
    state.elapsedMs = 0;
    configureCurrentEditor();
    state.activeRunId += 1;
    state.finalizedRunId = 0;
    state.finishing = false;
    state.running = true;
    state.startAt = performance.now();
    setReadOnly(false);
    updateChallengeUi();
    updateTimer();
    updateActionButtons();
    setOutput(`RUN STARTED\nVariant: ${state.challenge.seed}\nTimer is live. Find the bug.\nCopy / Cut / Paste are disabled.`);
    state.rafId = requestAnimationFrame(timestamp => timerFrame(timestamp, state.activeRunId));
  }

  function stopRun(log = true) {
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = null;
    state.running = false;
    setReadOnly(!state.practice);
    updateActionButtons();
    if (log && $('outputBody')) setOutput('Run stopped. No clear recorded.');
  }

  async function finishRun(reason, timedOut = false, explicitRunId = state.activeRunId) {
    if (!state.challenge || !state.editor || !state.running) return;
    if (state.finishing || explicitRunId !== state.activeRunId || state.finalizedRunId === explicitRunId) return;
    state.finishing = true;
    state.running = false;
    state.finalizedRunId = explicitRunId;
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = null;
    state.elapsedMs = timedOut ? state.challenge.timeLimitMs : Math.max(0, performance.now() - state.startAt);
    updateTimer();
    setReadOnly(true);
    updateActionButtons();

    const runSnapshot = {
      challenge: { ...state.challenge },
      challengeBase: { ...state.challengeBase },
      player: state.editor.getValue(),
      elapsedMs: state.elapsedMs,
      timedOut,
      reason,
      runId: explicitRunId
    };

    const correct = normalizeCode(runSnapshot.player) === normalizeCode(runSnapshot.challenge.solution);
    const outcome = correct && !timedOut ? 'PASS' : (timedOut ? 'TIMEOUT' : 'FAIL');

    const score = await recordRunCloud({
      correct: correct && !timedOut, timedOut, ms: runSnapshot.elapsedMs,
      challengeId: runSnapshot.challengeBase.id, title: runSnapshot.challengeBase.title,
      language: runSnapshot.challengeBase.language, variantId: runSnapshot.challenge.variantId, runId: explicitRunId
    });

    setOutput(`${timedOut ? 'TIMEOUT' : 'SUBMITTED'}\nTime: ${formatMs(runSnapshot.elapsedMs)}\nResult: ${outcome}\n${reason}`);
    renderResult(correct, timedOut, score, runSnapshot.challengeBase);
    switchPanel('results');

    // The editor gets a guaranteed fresh board immediately after the run is finalized.
    prepareFreshVariantAfterFinish();
    state.finishing = false;
    updateActionButtons();
    updateSpeedrunStats();
    state.currentUser = currentUser();
    renderHeader();

    // AI is deliberately detached from the new board: it analyzes only the completed run snapshot.
    const aiRequestId = ++state.aiRequestId;
    await requestAiAnalysis({ challenge: runSnapshot.challenge, original: runSnapshot.challenge.broken, player: runSnapshot.player, answer: runSnapshot.challenge.solution, result: outcome, timedOut, aiRequestId });
  }

  function renderResult(correct, timedOut, score, base) {
    const user = state.currentUser || currentUser();
    const displayedClears = score?.totalCorrect ?? totalCorrect(user);
    const resultUser = user ? { ...user, totalCorrect: displayedClears } : user;
    const rank = getRank(resultUser);
    const rp = rankProgress(resultUser);
    $('resultsBody').innerHTML = `<div class="result-card"><div class="result-stat"><small>RESULT</small><strong class="${correct && !timedOut ? 'result-good' : 'result-bad'}">${correct && !timedOut ? 'PASS' : timedOut ? 'TIMEOUT' : 'FAIL'}</strong></div><div class="result-stat"><small>TIME</small><strong>${formatMs(state.elapsedMs)}</strong></div><div class="result-stat"><small>RANK</small><strong class="result-rank ${rank.id}">${rankIconSvg(rank, 'mini')} ${escapeHtml(rank.name)}</strong></div><div class="result-stat"><small>CLEARS</small><strong>${displayedClears}</strong></div></div><p class="run-note">${correct && !timedOut ? `Solution accepted. ${score.newBest ? 'NEW PERSONAL BEST!' : 'Clear recorded.'}` : timedOut ? 'Timeout: no clear was added.' : 'The submitted code does not match the expected solution.'} ${rp.next ? `Còn ${rp.remaining} clear để lên ${rp.next.name}.` : ''}</p><div class="result-next-note"><span>NEW BOARD READY</span><strong>${escapeHtml(base.title)}</strong><small>Một variant khác đã được sinh ra cho lượt tiếp theo.</small></div>`;
    showToast(correct && !timedOut ? (score.newBest ? `NEW PB · ${formatMs(state.elapsedMs)}` : `CLEAR · ${formatMs(state.elapsedMs)}`) : timedOut ? 'TIMEOUT' : 'RUN FAILED', correct && !timedOut ? 'success' : 'error');
  }

  async function recordRunCloud({ correct, timedOut, ms, challengeId, title, language, variantId, runId }) {
    const user = state.currentUser;
    if (!user || !fbDb || !fbAuth?.currentUser) {
      showToast('Hãy đăng nhập Firebase để lưu run.', 'error');
      return { newBest: false, totalCorrect: totalCorrect(user) };
    }

    const uid = fbAuth.currentUser.uid;
    const cleanMs = Math.max(0, Math.min(DEFAULT_TIME_MS, Math.floor(ms)));
    const now = performance.now();
    if (now - state.lastCloudWriteAt < MIN_CLOUD_RUN_GAP_MS) {
      await new Promise(resolve => setTimeout(resolve, MIN_CLOUD_RUN_GAP_MS - (now - state.lastCloudWriteAt)));
    }
    state.lastCloudWriteAt = performance.now();

    // The run id is unique per browser session + finalized run, so two tabs cannot overwrite each other.
    const cloudRunId = `${state.sessionId}_${runId}`;
    const userRef = fbDb.collection('users').doc(uid);
    const runRef = fbDb.collection('runs').doc(cloudRunId);
    let result = { newBest: false, totalCorrect: totalCorrect(user) };

    try {
      await fbDb.runTransaction(async tx => {
        const snap = await tx.get(userRef);
        if (!snap.exists) throw new Error('Cloud profile chưa tồn tại. Hãy đăng nhập lại.');
        const existing = ensureUserShape({ key: uid, ...snap.data() });
        const records = { ...(existing.records || {}) };
        const history = Array.isArray(existing.history) ? existing.history.slice(0, MAX_HISTORY - 1) : [];
        const previous = Number(records[challengeId] || 0);
        const newBest = Boolean(correct) && (!previous || cleanMs < previous);
        if (newBest) records[challengeId] = cleanMs;

        const totalRuns = existing.stats.totalRuns + 1;
        const totalCorrect = existing.stats.totalCorrect + (correct ? 1 : 0);
        const bestValues = Object.values(records).map(Number).filter(value => value > 0);
        const bestTimeMs = bestValues.length ? Math.min(...bestValues) : null;
        const historyItem = {
          runId: cloudRunId, challengeId, title, language, ms: cleanMs,
          correct: Boolean(correct), timedOut: Boolean(timedOut), at: Date.now()
        };
        history.unshift(historyItem);

        tx.set(runRef, {
          uid,
          displayName: existing.displayName || user.name || 'Runner',
          challengeId,
          challengeTitle: title,
          language,
          timeMs: cleanMs,
          correct: Boolean(correct),
          timedOut: Boolean(timedOut),
          variantId: String(variantId || ''),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        tx.set(userRef, {
          displayName: existing.displayName || user.name || 'Runner',
          email: existing.email || fbAuth.currentUser.email || '',
          photoURL: existing.photoURL || fbAuth.currentUser.photoURL || '',
          totalRuns,
          totalCorrect,
          bestTimeMs,
          hasClear: totalCorrect > 0,
          records,
          history,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        result = { newBest, totalCorrect };
      });
      state.currentUser = await getCloudProfile();
      if (state.currentUser) state.leaderboardUsers.set(uid, ensureUserShape(state.currentUser));
      state.cloudStatus = 'online';
      return result;
    } catch (error) {
      console.error('Cloud run save failed:', error);
      state.cloudStatus = 'error';
      showToast(`Không lưu được run lên Firebase: ${error.message}`, 'error');
      return result;
    }
  }

  function updateSpeedrunStats() {
    const user = currentUser();
    const badge = $('cloudStatusBadge');
    if (badge) {
      const labels = { online: 'Cloud: online', connecting: 'Cloud: connecting…', error: 'Cloud: error', offline: 'Cloud: offline' };
      badge.textContent = labels[state.cloudStatus] || 'Cloud: —';
      badge.dataset.state = state.cloudStatus;
    }
    state.currentUser = user;
    const bestForChallenge = state.challengeBase && user?.records?.[state.challengeBase.id] ? formatMs(user.records[state.challengeBase.id]) : (user ? bestOverall(user) : '—');
    if ($('bestStat')) $('bestStat').textContent = bestForChallenge;
    if ($('runsStat')) $('runsStat').textContent = `${user ? totalCorrect(user) : 0} correct clears`;
    const rank = getRank(user);
    const rp = rankProgress(user);
    if ($('rankChip')) $('rankChip').innerHTML = `<div class="rank-chip-left ${rank.id}"><span class="rank-chip-icon">${rankIconSvg(rank, 'mini')}</span><div><div class="rank-chip-name">${escapeHtml(rank.name)}</div><div class="rank-chip-count">${user ? totalCorrect(user) : 0} clears</div></div></div><span>→</span>`;
    if ($('rankProgressText')) $('rankProgressText').textContent = rp.next ? `${rp.remaining} clears to ${rp.next.name}` : 'Max rank.';
    if ($('progressBar')) $('progressBar').style.width = `${Math.min(100, (state.elapsedMs / (state.challenge?.timeLimitMs || DEFAULT_TIME_MS)) * 100)}%`;
    if ($('currentStat')) $('currentStat').textContent = state.running ? 'RUNNING' : (state.elapsedMs ? formatMs(state.elapsedMs) : 'READY');
  }

  function switchPanel(panel) {
    if (panel !== 'log' && state.panelCollapsed) {
      state.panelCollapsed = false;
      applyPanelCollapse();
    }
    state.activePanel = panel;
    document.querySelectorAll('.panel-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === panel));
    $('logPanel')?.classList.toggle('hidden', panel !== 'log');
    $('resultsPanel')?.classList.toggle('hidden', panel !== 'results');
    $('aiPanel')?.classList.toggle('hidden', panel !== 'ai');
  }

  function setOutput(message) {
    if ($('outputBody')) {
      $('outputBody').textContent = message;
      $('outputBody').scrollTop = $('outputBody').scrollHeight;
    }
  }

  function applyPanelCollapse() {
    const editorArea = document.querySelector('.editor-area');
    const panel = $('bottomPanel');
    const btn = $('toggleBottomBtn');
    if (editorArea) editorArea.classList.toggle('panel-collapsed', state.panelCollapsed);
    if (panel) panel.classList.toggle('collapsed', state.panelCollapsed);
    if (btn) btn.textContent = state.panelCollapsed ? '⌄ Mở bảng' : '⌃ Thu gọn';
  }

  function toggleBottomPanel() {
    state.panelCollapsed = !state.panelCollapsed;
    applyPanelCollapse();
  }

  function syncPracticeUi() {
    const btn = $('practiceBtn');
    if (btn) {
      btn.classList.toggle('active', state.practice);
      btn.textContent = state.practice ? '◇ Practice: ON' : '◇ Practice';
    }
    setReadOnly(!state.running && !state.practice);
    updateActionButtons();
  }

  function togglePractice() {
    if (state.running || state.finishing) {
      showToast('Không thể đổi Practice khi match đang/đang chốt.', 'error');
      return;
    }
    state.practice = !state.practice;
    state.challenge = createVariant(state.challengeBase);
    state.challengeVariantSeed = state.challenge.seed;
    state.elapsedMs = 0;
    configureCurrentEditor();
    setReadOnly(!state.practice);
    updateChallengeUi();
    updateTimer();
    syncPracticeUi();
    setOutput(state.practice ? 'PRACTICE MODE\nBạn có thể sửa code tự do. Không tính timer, rank hoặc leaderboard.' : 'Practice OFF\nCode đã khóa. Press Start Match để bắt đầu ranked run.');
  }

  function resetChallenge() {
    if (!state.challengeBase || !state.editor) return;
    if (state.running) {
      state.activeRunId += 1;
      if (state.rafId) cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    state.running = false;
    state.finishing = false;
    state.finalizedRunId = 0;
    state.practice = false;
    state.elapsedMs = 0;
    state.challenge = createVariant(state.challengeBase);
    state.challengeVariantSeed = state.challenge.seed;
    configureCurrentEditor();
    updateChallengeUi();
    updateTimer();
    updateActionButtons();
    setOutput('Reset complete. New random board generated.\nPress Start Match.');
    switchPanel('log');
    updateSpeedrunStats();
  }

  function wireKeyboard() {
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && state.route === 'speedrun') {
        event.preventDefault();
        if (state.running) finishRun('Keyboard submission.', false);
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'r' && state.route === 'speedrun') {
        event.preventDefault();
        resetChallenge();
      }
      if (event.key === 'Escape') document.querySelectorAll('.modal-backdrop.show').forEach(modal => closeModal(modal.id));
    });
  }

  function wireEditorAntiCheat() {
    const host = $('editor');
    if (!host || host.dataset.antiCheatWired) return;
    host.dataset.antiCheatWired = '1';
    const block = event => {
      event.preventDefault();
      event.stopPropagation();
      showToast('Copy / Cut / Paste / Drop are disabled for fair play.');
      return false;
    };
    ['paste', 'copy', 'cut', 'drop', 'contextmenu'].forEach(type => host.addEventListener(type, block, true));
    host.addEventListener('dragover', event => event.preventDefault(), true);
    host.addEventListener('beforeinput', event => {
      if (['insertFromPaste', 'insertFromDrop'].includes(event.inputType)) block(event);
    }, true);
    host.addEventListener('keydown', event => {
      const key = String(event.key).toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ['c', 'x', 'v'].includes(key)) block(event);
    }, true);
  }

  function initMonacoIfNeeded() {
    if (state.editor) {
      loadChallenge();
      return;
    }
    if (!window.require) {
      $('editorUnavailable')?.classList.remove('hidden');
      return;
    }
    const base = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.56.0/min/';
    const workerCode = `self.MonacoEnvironment={baseUrl:'${base}'};importScripts('${base}vs/base/worker/workerMain.js');`;
    const workerUrl = URL.createObjectURL(new Blob([workerCode], { type: 'text/javascript' }));
    window.MonacoEnvironment = { getWorkerUrl: () => workerUrl };
    require.config({ paths: { vs: `${base}vs` } });
    require(['vs/editor/editor.main'], () => {
      state.monacoReady = true;
      state.editor = monaco.editor.create($('editor'), { value: 'Loading…', language: 'javascript', theme: 'vs-dark', automaticLayout: true, minimap: { enabled: false }, fontSize: 14, lineHeight: 21, tabSize: 2, insertSpaces: true, wordWrap: 'off', smoothScrolling: false, scrollBeyondLastLine: false, padding: { top: 10 }, contextmenu: false, readOnly: true });
      wireEditorAntiCheat();
      loadChallenge(true);
    }, () => $('editorUnavailable')?.classList.remove('hidden'));
  }

  function getGeminiKey() { return localStorage.getItem(STORAGE.geminiKey) || ''; }
  function getGeminiModel() { return localStorage.getItem(STORAGE.geminiModel) || DEFAULT_MODEL; }

  async function requestAiAnalysis(payload) {
    const key = getGeminiKey();
    const output = $('aiOutput');
    if (!output) return;
    switchPanel('ai');
    if (!key) {
      output.innerHTML = '<div class="ai-empty">Chưa cấu hình Gemini API Key. Vào Cài đặt để bật AI Support.</div>';
      return;
    }
    state.pendingAi = true;
    const requestId = payload.aiRequestId || 0;
    output.innerHTML = '<div class="ai-loading"><span class="spinner"></span> Gemini đang phân tích run vừa hoàn thành…</div>';
    const model = getGeminiModel();
    const prompt = `You are the post-run code coach for Bug Speedrunner. Analyze only the supplied material. Return compact JSON exactly in this shape: {"summary":"...","errors":[{"line":0,"reason":"...","knowledge":"..."}],"memoryTip":"..."}. Line refers to PLAYER CODE. If the run is correct, errors can be empty. Never invent compiler diagnostics. Challenge: ${payload.challenge.title}. Language: ${LANGUAGES[payload.challenge.language].label}. Result: ${payload.result}.\nORIGINAL BROKEN CODE:\n${payload.original}\n\nPLAYER CODE:\n${payload.player}\n\nEXPECTED ANSWER:\n${payload.answer}`;
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.15, responseMimeType: 'application/json' } }) });
      if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = { summary: text || 'Gemini không trả về nội dung.', errors: [], memoryTip: '' }; }
      if (requestId && requestId !== state.aiRequestId) return;
      output.innerHTML = `<div class="ai-summary"><strong>${escapeHtml(parsed.summary || 'Analysis complete.')}</strong></div>${Array.isArray(parsed.errors) && parsed.errors.length ? `<div class="ai-table-wrap"><table class="ai-table"><thead><tr><th>Line</th><th>Why</th><th>Remember</th></tr></thead><tbody>${parsed.errors.map(error => `<tr><td>${escapeHtml(error.line)}</td><td>${escapeHtml(error.reason)}</td><td>${escapeHtml(error.knowledge)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="ai-empty">Không phát hiện lỗi cụ thể từ dữ liệu được cung cấp.</div>'}<div class="ai-memory"><span>MEMORY TIP</span>${escapeHtml(parsed.memoryTip || 'Đọc input/output trước rồi mới nhìn từng dòng.')}</div>`;
    } catch (error) {
      if (requestId && requestId !== state.aiRequestId) return;
      output.innerHTML = `<div class="ai-error"><strong>AI Support failed.</strong><br>${escapeHtml(error.message)}<br><small>Run vẫn đã được chấm và lưu độc lập với Gemini.</small></div>`;
    } finally {
      state.pendingAi = false;
    }
  }

  function openSettings() {
    $('geminiKeyInput').value = getGeminiKey();
    $('geminiModelInput').value = getGeminiModel();
    $('settingsStatus').textContent = '';
    openModal('settingsModal');
  }

  function saveSettings() {
    const key = $('geminiKeyInput').value.trim();
    const model = $('geminiModelInput').value.trim() || DEFAULT_MODEL;
    if (key) localStorage.setItem(STORAGE.geminiKey, key); else localStorage.removeItem(STORAGE.geminiKey);
    localStorage.setItem(STORAGE.geminiModel, model);
    $('settingsStatus').textContent = `Đã lưu. Model: ${model}`;
    showToast('Đã lưu Settings.', 'success');
    closeModal('settingsModal');
  }

  function openAuth(mode = 'login') {
    $('loginTab').classList.toggle('active', mode === 'login');
    $('registerTab').classList.toggle('active', mode === 'register');
    $('loginForm').classList.toggle('hidden', mode !== 'login');
    $('registerForm').classList.toggle('hidden', mode === 'login');
    $('authStatus').className = 'form-status';
    $('authStatus').textContent = authEnvironmentMessage() || (state.firebaseReady ? '' : 'Firebase chưa sẵn sàng. Kiểm tra kết nối/CDN.');
    if (authEnvironmentMessage()) $('authStatus').className = 'form-status error';
    openModal('authModal');
  }

  async function logout() {
    try {
      if (fbAuth) await fbAuth.signOut();
      state.currentUser = null;
      closeProfile();
      renderHeader();
      showToast('Đã đăng xuất.');
      renderRoute();
    } catch (error) { showToast(`Đăng xuất thất bại: ${error.message}`, 'error'); }
  }

  function firebaseAuthError(error) {
    const map = {
      'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
      'auth/invalid-login-credentials': 'Email hoặc mật khẩu không đúng.',
      'auth/email-already-in-use': 'Email này đã có tài khoản.',
      'auth/weak-password': 'Mật khẩu quá yếu (Firebase yêu cầu tối thiểu 6 ký tự).',
      'auth/invalid-email': 'Email không hợp lệ.',
      'auth/api-key-not-valid': 'Firebase Web API key trong app.js không hợp lệ. Hãy lấy lại firebaseConfig của Web App đúng project từ Firebase Console → Project settings → Your apps và thay apiKey.',
      'auth/invalid-api-key': 'Firebase Web API key trong app.js không hợp lệ. Hãy lấy lại firebaseConfig của Web App đúng project từ Firebase Console → Project settings → Your apps và thay apiKey.',
      'auth/popup-closed-by-user': 'Cửa sổ Google đã được đóng.',
      'auth/popup-blocked': 'Trình duyệt đã chặn popup Google.',
      'auth/unauthorized-domain': 'Domain hiện tại chưa được thêm vào Firebase → Authentication → Settings → Authorized domains.'
    };
    return map[error?.code] || error?.message || 'Firebase Authentication error.';
  }

  async function login(event) {
    event.preventDefault();
    const status = $('authStatus');
    if (authEnvironmentMessage()) { status.className = 'form-status error'; status.textContent = authEnvironmentMessage(); return; }
    if (!fbAuth) { status.className = 'form-status error'; status.textContent = 'Firebase Auth chưa sẵn sàng.'; return; }
    const email = $('loginUser').value.trim();
    const pass = $('loginPass').value;
    status.className = 'form-status'; status.textContent = 'Đang đăng nhập…';
    try {
      const credential = await fbAuth.signInWithEmailAndPassword(email, pass);
      await createCloudProfile(credential.user);
      closeModal('authModal');
      showToast(`Welcome back, ${credential.user.displayName || credential.user.email}.`, 'success');
    } catch (error) { status.className = 'form-status error'; status.textContent = firebaseAuthError(error); }
  }

  async function register(event) {
    event.preventDefault();
    const displayName = $('registerUser').value.trim();
    const email = $('registerEmail').value.trim();
    const pass = $('registerPass').value;
    const status = $('authStatus');
    if (authEnvironmentMessage()) { status.className = 'form-status error'; status.textContent = authEnvironmentMessage(); return; }
    if (!/^[\p{L}\p{N}_-]{3,20}$/u.test(displayName)) { status.className = 'form-status error'; status.textContent = 'Tên hiển thị 3–20 ký tự, không chứa ký tự lạ.'; return; }
    if (pass.length < 6) { status.className = 'form-status error'; status.textContent = 'Password tối thiểu 6 ký tự.'; return; }
    if (!fbAuth) { status.className = 'form-status error'; status.textContent = 'Firebase Auth chưa sẵn sàng.'; return; }
    status.className = 'form-status'; status.textContent = 'Đang tạo tài khoản…';
    try {
      const credential = await fbAuth.createUserWithEmailAndPassword(email, pass);
      await credential.user.updateProfile({ displayName });
      await createCloudProfile(credential.user, displayName);
      closeModal('authModal');
      showToast(`Account created: ${displayName}`, 'success');
    } catch (error) { status.className = 'form-status error'; status.textContent = firebaseAuthError(error); }
  }

  async function googleSignIn() {
    const status = $('authStatus');
    if (authEnvironmentMessage()) { status.className = 'form-status error'; status.textContent = authEnvironmentMessage(); return; }
    if (!fbAuth) { status.className = 'form-status error'; status.textContent = 'Firebase Auth chưa sẵn sàng.'; return; }
    status.className = 'form-status'; status.textContent = 'Đang mở Google…';
    try {
      const credential = await fbAuth.signInWithPopup(fbProvider);
      await createCloudProfile(credential.user);
      closeModal('authModal');
      showToast(`Signed in as ${credential.user.displayName || credential.user.email}.`, 'success');
    } catch (error) { status.className = 'form-status error'; status.textContent = firebaseAuthError(error); }
  }

  function profileHtml(profile) {
    const user = profile.user;
    const rank = profile.rank;
    const history = Array.isArray(user.history) ? user.history.slice(0, 8) : [];
    const best = bestOverall(user);
    const clears = totalCorrect(user);
    const successRate = user.stats.totalRuns ? Math.round((clears / user.stats.totalRuns) * 100) : 0;
    return `<div class="profile-backdrop" id="profileBackdrop"><div class="profile-modal" role="dialog" aria-modal="true"><div class="profile-topline"><span class="eyebrow">RUNNER PROFILE</span><button class="close-btn" id="profileCloseBtn">✕</button></div><div class="profile-hero ${rank.id}"><div class="profile-rank-icon">${rankIconSvg(rank, 'normal')}</div><div><div class="profile-name rank-text-${rank.id}">${escapeHtml(profile.name)}</div><div class="profile-rank-label">${rankIconSvg(rank, 'mini')} ${escapeHtml(rank.name)}</div></div></div><div class="profile-grid"><div><small>CLEARS</small><strong>${clears}</strong></div><div><small>RUNS</small><strong>${user.stats.totalRuns}</strong></div><div><small>SUCCESS RATE</small><strong>${successRate}%</strong></div><div><small>BEST TIME</small><strong>${best}</strong></div></div><div class="profile-progress"><div><span>RANK PROGRESS</span><strong>${rankProgress(user).next ? `${rankProgress(user).remaining} to ${rankProgress(user).next.name}` : 'MAX RANK'}</strong></div><div class="progress-track"><span style="width:${rankProgress(user).pct}%"></span></div></div><div class="profile-history"><div class="profile-section-title">RECENT RUNS</div>${history.length ? history.map(item => `<div class="profile-history-row"><span class="history-result ${item.correct ? 'ok' : 'bad'}">${item.correct ? 'CLEAR' : item.timedOut ? 'TIMEOUT' : 'FAIL'}</span><span>${escapeHtml(item.title)}</span><span>${formatMs(item.ms)}</span></div>`).join('') : '<div class="ai-empty">Chưa có run nào.</div>'}</div>${state.currentUser?.key === profile.key ? '<div class="profile-actions"><button class="secondary-btn" id="profileSettingsBtn">⚙ Settings</button><button class="danger-btn" id="profileLogoutBtn">Đăng xuất</button></div>' : ''}</div></div>`;
  }

  function openProfile(key, self = false) {
    const raw = state.leaderboardUsers.get(key) || (state.currentUser?.key === key ? state.currentUser : null);
    if (!raw) return showToast('Profile chưa được tải từ Firebase.', 'error');
    document.getElementById('profileRoot')?.remove();
    const user = ensureUserShape(raw);
    const profile = { key, name: user.displayName || user.email?.split('@')[0] || 'Runner', user, rank: getRank(user) };
    const root = document.createElement('div');
    root.id = 'profileRoot';
    root.innerHTML = profileHtml(profile);
    document.body.appendChild(root);
    $('profileCloseBtn').onclick = closeProfile;
    $('profileBackdrop').onclick = event => { if (event.target.id === 'profileBackdrop') closeProfile(); };
    if (self || state.currentUser?.key === profile.key) {
      $('profileSettingsBtn')?.addEventListener('click', () => { closeProfile(); openSettings(); });
      $('profileLogoutBtn')?.addEventListener('click', logout);
    }
  }

  function closeProfile() { document.getElementById('profileRoot')?.remove(); }

  function exportAccountBackup() {
    if (!state.currentUser) { showToast('Đăng nhập để export profile.', 'error'); return; }
    const payload = {
      app: 'Bug Speedrunner', version: 5, exportedAt: new Date().toISOString(),
      uid: state.currentUser.uid, account: state.currentUser
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    saveAs(blob, `bug-speedrunner-cloud-profile-${state.currentUser.uid}.json`);
    showToast('Cloud profile backup exported.', 'success');
  }

  function downloadProjectZip() {
    if (typeof JSZip === 'undefined' || typeof saveAs === 'undefined') { showToast('ZIP library chưa tải xong. Kiểm tra mạng.', 'error'); return; }
    getEmbeddedSources().then(source => {
      const zip = new JSZip();
      zip.file('bug-speedrunner/index.html', '<!doctype html>\n' + document.documentElement.outerHTML);
      zip.file('bug-speedrunner/style.css', source.style);
      zip.file('bug-speedrunner/app.js', source.app);
      zip.file('bug-speedrunner/challenges.js', source.challenges);
      zip.file('bug-speedrunner/firestore.rules', source.rules || '');
      zip.file('bug-speedrunner/README.md', buildReadme());
      return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    }).then(blob => { saveAs(blob, 'bug-speedrunner.zip'); showToast('Source ZIP exported.', 'success'); }).catch(error => showToast(`Không thể tạo ZIP: ${error.message}`, 'error'));
  }

  function getEmbeddedSources() {
    const paths = ['style.css', 'app.js', 'challenges.js', 'firestore.rules'];
    const fetchCurrentSources = () => Promise.all(paths.map(path => fetch(path, { cache: 'no-store' }).then(response => { if (!response.ok) throw new Error(`Cannot read ${path}`); return response.text(); }))).then(([style, app, challenges, rules]) => ({ style, app, challenges, rules }));
    return fetchCurrentSources().catch(error => {
      const node = $('embeddedSource');
      if (!node?.textContent.trim()) throw error;
      try { return JSON.parse(decodeURIComponent(escape(atob(node.textContent.trim())))); } catch { throw error; }
    });
  }

  function buildReadme() {
    return [
      '# Bug Speedrunner — Firebase V2 Hardened Cloud Edition',
      '',
      'Browser-only coding speedrun game by HK1413.',
      '',
      '## Stack',
      '- Plain HTML5 / CSS3 / ES6+ JavaScript',
      '- Monaco Editor via CDN',
      '- Firebase Authentication + Cloud Firestore via CDN (no npm / Node / build step required)',
      '- JSZip + FileSaver.js for source export',
      '',
      '## Firebase setup',
      '1. Open Firebase Console → Authentication → Sign-in method and enable Email/Password + Google.',
      '2. Use the existing (default) Cloud Firestore database.',
      '3. Paste the included firestore.rules into Firestore → Rules and publish.',
      '4. Add the exact GitHub Pages domain in Authentication → Settings → Authorized domains.',
      '5. Test register/login, Google login, ranked run, logout/login and leaderboard from a second browser profile.',
      '',
      '## V2 cloud model',
      'Firebase Authentication owns identity. Public users/{uid} documents contain leaderboard/profile data. Immutable runs/{runId} documents are private to their owner. A ranked transaction writes the run and updates the user stats atomically; Firestore Rules cross-check the user update against the run created in the same transaction with getAfter().',
      '',
      '## Ranked run rules',
      'Bronze = 0 clears',
      'Silver = 5 correct speedruns',
      'Gold = 8 correct speedruns',
      'Platinum = 15 correct speedruns',
      'Legendary = 25 correct speedruns',
      'GOD = 40 correct speedruns',
      '',
      'Practice mode is not ranked. Ranked Start Match requires Firebase login. Every Start Match creates a fresh randomized variant; every finalized run immediately gets another fresh board. Duplicate finish attempts are blocked by a run-id guard.',
      '',
      '## Fair-play / security boundary',
      'The browser blocks copy/cut/paste/drop/context-menu in Monaco and locks the code before a ranked run. V2 hardens Firestore access, makes run documents immutable, ties stats updates to the same transaction, uses server timestamps for cloud writes, and keeps run documents private. However, this is still a browser-scored game: challenge code and correctness logic are delivered to the client, so DevTools can bypass the client and forge a logically valid-looking score. A truly cheat-resistant competitive leaderboard requires trusted server-side validation. Firebase App Check can further reduce abuse from untrusted clients but does not replace server-side score validation.',
      '',
      '## Gemini',
      `Configure API key + model in Cài đặt. Default model: ${DEFAULT_MODEL}. The Gemini key is kept in localStorage and is not uploaded to Firebase.`,
      '',
      '## Existing local V3 accounts',
      'Older localStorage-only accounts are not automatically converted into Firebase credentials because Firebase Auth owns password credentials. Create or sign into a Firebase account to use cloud ranking.',
      '',
      `Build: ${APP_VERSION}`,
      'Developed by HK1413',
      ''
    ].join('\n');
  }

  function wireModals() {
    document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => closeModal(button.dataset.close));
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(backdrop.id); }));
    $('saveSettingsBtn').onclick = saveSettings;
    $('clearSettingsBtn').onclick = () => { $('geminiKeyInput').value = ''; localStorage.removeItem(STORAGE.geminiKey); $('settingsStatus').textContent = 'API Key cleared.'; };
    $('exportProfileBtn').onclick = exportAccountBackup;
    $('loginTab').onclick = () => openAuth('login');
    $('registerTab').onclick = () => openAuth('register');
    $('googleSignInBtn').onclick = googleSignIn;
    $('loginForm').onsubmit = login;
    $('registerForm').onsubmit = register;
  }

  function seed() {
    if (!localStorage.getItem(STORAGE.geminiModel)) localStorage.setItem(STORAGE.geminiModel, DEFAULT_MODEL);
  }

  window.addEventListener('beforeunload', () => { if (state.rafId) cancelAnimationFrame(state.rafId); });

  async function boot() {
    seed();
    state.currentUser = null;
    renderHeader();
    bindGlobalButtons();
    wireModals();
    wireKeyboard();
    window.addEventListener('hashchange', renderRoute);
    renderRoute();
    try {
      if (window.__FIREBASE_SDK_PROMISE__) {
        await window.__FIREBASE_SDK_PROMISE__;
      }
      initFirebase();
    } catch (error) {
      console.error('Firebase bootstrap failed:', error);
      state.firebaseReady = false;
      state.authReady = false;
      state.cloudStatus = 'error';
      showToast(`Firebase init failed: ${error.message}`, 'error');
      const authStatus = $('authStatus');
      if (authStatus && !authStatus.textContent) {
        authStatus.className = 'form-status error';
        authStatus.textContent = error.message;
      }
      renderHeader();
    }
  }

  boot();
})();
