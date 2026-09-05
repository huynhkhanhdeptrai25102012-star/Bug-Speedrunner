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
  const APP_VERSION = 'v5-event-forge';

  const LANGUAGES = {
    javascript: { label: 'JavaScript', monaco: 'javascript', ext: 'js' },
    html: { label: 'HTML', monaco: 'html', ext: 'html' },
    cpp: { label: 'C++', monaco: 'cpp', ext: 'cpp' },
    csharp: { label: 'C#', monaco: 'csharp', ext: 'cs' }
  };

  const RANKS = [
    { id: 'bronze', name: 'Đồng', threshold: 0, lucide: 'medal', description: 'Rank khởi đầu. Mọi runner đều bắt đầu từ đây.', effect: 'none', power: 0, color: '#d9945f' },
    { id: 'silver', name: 'Bạc', threshold: 5, lucide: 'shield', description: 'Đạt sau 5 speedrun đúng.', effect: 'none', power: 1, color: '#dce7f1' },
    { id: 'gold', name: 'Vàng', threshold: 8, lucide: 'trophy', description: 'Đạt sau 8 speedrun đúng.', effect: 'none', power: 2, color: '#ffd666' },
    { id: 'platinum', name: 'Bạch kim', threshold: 15, lucide: 'gem', description: 'Bắt đầu mở khóa aura và profile glow.', effect: 'glow', power: 3, color: '#8cecff' },
    { id: 'diamond', name: 'Kim cương', threshold: 20, lucide: 'diamond', description: 'Aura kim cương với các tia sáng ổn định quanh avatar.', effect: 'diamond', power: 4, color: '#8ff4ff' },
    { id: 'legendary', name: 'Huyền thoại', threshold: 25, lucide: 'crown', description: 'Aura huyền thoại, particle và pulse mạnh.', effect: 'legendary', power: 5, color: '#ff637d' },
    { id: 'ascendant', name: 'Thăng hoa', threshold: 32, lucide: 'sparkles', description: 'Aura nhiều lớp, particle dày hơn Huyền thoại.', effect: 'ascendant', power: 6, color: '#d3a9ff' },
    { id: 'god', name: 'GOD', threshold: 40, lucide: 'zap', description: 'Năng lượng vàng, tia điện và halo mạnh.', effect: 'god', power: 7, color: '#fff1ad' },
    { id: 'immortal', name: 'Bất tử', threshold: 55, lucide: 'infinity', description: 'Cosmic aura, stars và glow đa lớp.', effect: 'immortal', power: 8, color: '#c2e7ff' },
    { id: 'orbit', name: 'Orbit', threshold: 72, lucide: 'orbit', description: 'Thiên thể quỹ đạo quay quanh avatar. Chỉ dưới Đế vương.', effect: 'orbit', power: 9, color: '#b896ff' },
    { id: 'emperor', name: 'Đế vương', threshold: 90, lucide: 'crown', description: 'Rank tối cao. Royal aura, starfall và Sovereign theme.', effect: 'emperor', power: 10, color: '#e8c8ff' }
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
    lastCloudWriteAt: 0,
    sessionRuns: 0, sessionClears: 0, streak: 0, bestStreak: 0, hintsUsed: 0,
    runFeed: [], soundEnabled: true, lastOutcome: 'READY', dailySeed: new Date().toISOString().slice(0,10),
    adminRole: 'user', achievements: [], equippedTitle: '', eventSession: null, eventHistory: [], eventCloudSynced: false
  };

  let fbAuth = null;
  let fbDb = null;
  let fbProvider = null;

  const RANK_AUDIO = { emperor: 'assets/audio/sovereign.mp3', orbit: 'assets/audio/orbitsong.mp3' };
  let rankAudio = null;

  function stopRankAudio() {
    if (!rankAudio) return;
    try { rankAudio.pause(); rankAudio.currentTime = 0; } catch {}
    rankAudio = null;
  }

  function playRankAudio(rankId) {
    stopRankAudio();
    const src = RANK_AUDIO[rankId];
    if (!src) return;
    rankAudio = new Audio(src);
    rankAudio.loop = true;
    rankAudio.volume = 0.45;
    rankAudio.play().catch(() => { /* browser autoplay policy; user interaction will retry */ });
  }

  function audioForRank(rankId) { return RANK_AUDIO[rankId] || ''; }

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

  function getTotalRuns(user) {
    return Number(user?.totalRuns ?? user?.stats?.totalRuns ?? 0);
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
      diamond: `<path d="M12 24 22 9h20l10 15-20 31L12 24Z"/><path d="M12 24h40M22 9l10 15 10-15M22 39l10-15 10 15"/>`,
      platinum: `<path d="m32 5 22 16-9 28-13 11-13-11-9-28L32 5Z"<path d="m10 21 22 8 22-8M19 49l13-20 13 20M32 29v31"/>`,
      legendary: `<path d="M10 13h12l10 12 10-12h12l-4 18c-2 10-9 15-18 15s-16-5-18-15l-4-18Z"/><path d="M18 13V7h8l6 8 6-8h8v6M21 52h22M17 58h30"/>`,
      ascendant: `<path d="M32 5 40 23 59 32 40 41 32 59 24 41 5 32 24 23 32 5Z"/><circle cx="32" cy="32" r="9"/>`,
      god: `<path d="M36 4 18 31h12L23 60l23-32H34L36 4Z"/><path d="M10 40c5 3 8 9 8 17M54 40c-5 3-8 9-8 17"/>`,
      immortal: `<circle cx="32" cy="32" r="24"/><circle cx="32" cy="32" r="11"/><path d="M14 20c10-7 26-7 36 0M14 44c10 7 26 7 36 0"/>`,
      orbit: `<circle cx="32" cy="32" r="8"/><ellipse cx="32" cy="32" rx="25" ry="11"/><ellipse cx="32" cy="32" rx="11" ry="25"/><circle cx="54" cy="27" r="3"/>`,
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

  // Pool of independent extra-bug injections per base challenge. Each entry
  // targets a snippet that is correct/shared in the broken source (i.e. NOT
  // the challenge's headline bug) so several entries can be combined freely
  // without colliding. More entries per challenge + combining 1-2 of them
  // per run (see createVariant) means the number of distinct boards grows
  // combinatorially instead of being capped at "2 fixed variants".
  const VARIANT_MUTATIONS = {
    'js-inventory-01': [
      ['const shipping = subtotal >= 200 ? 0 : 12;', 'const shipping = subtotal >= 600 ? 0 : 12;', 'Ngưỡng miễn phí vận chuyển đã bị đổi.'],
      ['return 0;\n}\n\nfunction buildReceipt', 'return subtotal * 0.02;\n}\n\nfunction buildReceipt', 'Hàm giảm giá trả về một khoản giảm giá giả khi không đạt ngưỡng.'],
      ['if (subtotal >= 300) {\n    return subtotal * 0.15;\n  }', 'if (subtotal >= 300) {\n    return subtotal * 0.05;\n  }', 'Mức giảm giá cao nhất bị hạ thấp sai.'],
      ['if (subtotal >= 150) {\n    return subtotal * 0.08;\n  }', 'if (subtotal >= 150) {\n    return subtotal * 0.03;\n  }', 'Mức giảm giá bậc hai bị hạ thấp sai.'],
      ['return `$${value.toFixed(2)}`;', 'return `$${value.toFixed(0)}`;', 'Định dạng tiền tệ bị mất phần thập phân.']
    ],
    'js-login-02': [
      ['failed++;', 'failed += 2;', 'Bộ đếm thất bại tăng sai hai lần cho mỗi event.'],
      ['event.user === username', 'event.user !== username', 'Điều kiện đang đếm nhầm user khác thay vì user cần kiểm tra.'],
      ['return failed >= 3;', 'return failed >= 5;', 'Ngưỡng khóa tài khoản bị nâng sai.'],
      ['neo.failed === 3 && neo.locked === true && smith.failed === 1', 'neo.failed === 3 && neo.locked === true && smith.failed === 2', 'Điều kiện kiểm tra tổng kết không khớp dữ liệu thực tế.']
    ],
    'html-profile-01': [
      ['</ul>', '</section>', 'Danh sách đang đóng sai thẻ HTML.'],
      ['<h2>About</h2>', '<h3>About</h3>', 'Tiêu đề About bị đổi cấp heading.'],
      ['<a href="#contact">Contact runner</a>', '<a href="#contact">Contact runner', 'Thẻ liên kết <a> không được đóng đúng.'],
      ['<meta charset="utf-8">', '<meta charset="utf8">', 'Giá trị charset bị viết sai chuẩn.']
    ],
    'html-form-02': [
      ['<input id="email" name="email" type="email" required>', '<input id="email" name="email" type="text" required>', 'Ô email bị đổi sang kiểu text.'],
      ['<button type="submit">Create Account</button>', '<button type="button">Create Account</button>', 'Nút gửi form không còn submit form.'],
      ['<label for="handle">Handle</label>', '<label for="Handle">Handle</label>', 'Thuộc tính for không khớp với id do sai chữ hoa.'],
      ['<option value="csharp">C#</option>', '<option>C#</option>', 'Option bị thiếu thuộc tính value.']
    ],
    'cpp-average-01': [
      ['peak == 24.00)', 'peak == 25.00)', 'Ngưỡng so sánh nhiệt độ cao nhất bị đổi sai.'],
      ['return sum / values.size();', 'return sum / (values.size() - 1);', 'Mẫu số của phép tính trung bình bị giảm đi một.'],
      ['double best = values.front();', 'double best = 0;', 'Giá trị khởi tạo của biến tìm max không lấy từ dữ liệu đầu vào.'],
      ['cout << fixed << setprecision(2);', 'cout << fixed << setprecision(0);', 'Độ chính xác hiển thị bị đổi, làm sai định dạng số thập phân.']
    ],
    'cpp-stack-02': [
      ['if (stack.empty()) {', 'if (!stack.empty()) {', 'Điều kiện kiểm tra stack rỗng bị đảo.'],
      ['stack.pop_back();\n    return value;', 'return value;', 'Hàm pop thiếu bước loại bỏ phần tử khỏi stack.'],
      ['vector<int> scores{10, 20};', 'vector<int> scores{20, 10};', 'Dữ liệu đầu vào ban đầu bị đổi thứ tự.'],
      ['int value = stack.back();', 'int value = stack.front();', 'Hàm đọc nhầm đầu stack thay vì đỉnh stack.']
    ],
    'csharp-grade-01': [
      ['if (score >= 60)', 'if (score > 60)', 'Điều kiện biên điểm D bị đổi từ >= sang >.'],
      ['if (score >= 90)', 'if (score > 90)', 'Điều kiện biên điểm A bị đổi từ >= sang >.'],
      ['if (score >= 80)', 'if (score > 80)', 'Điều kiện biên điểm B bị đổi từ >= sang >.'],
      ['if (score >= 70)', 'if (score > 70)', 'Điều kiện biên điểm C bị đổi từ >= sang >.']
    ],
    'csharp-null-02': [
      ['for (int i = 0; i < names.Length; i++)', 'for (int i = 0; i <= names.Length; i++)', 'Vòng lặp truy cập vượt quá phần tử cuối.'],
      ['if (displayName.Length == 0)', 'if (displayName.Length > 0)', 'Điều kiện kiểm tra chuỗi rỗng bị đảo ngược.'],
      ['return $"Hello, {displayName}!";', 'return $"Hi, {displayName}!";', 'Câu chào bị đổi sai so với yêu cầu đầu ra.']
    ],
    'js-cart-average-03': [
      ['return sum / values.length;', 'return sum / (values.length - 1);', 'Mẫu số trung bình bị trừ mất một phần tử.'],
      ['Math.abs(result - 26) < 0.001', 'Math.abs(result - 25) < 0.001', 'Ngưỡng kiểm tra output bị thay đổi.']
    ],
    'js-titlecase-04': [
      ['charAt(0).toUpperCase()', 'charAt(0).toLowerCase()', 'Ký tự đầu bị chuyển sai về lowercase.'],
      ["const cleaned = name.trim();", "const cleaned = name.trim().toLowerCase();", 'Input bị lowercase quá sớm và làm mất thông tin chữ hoa.']
    ],
    'html-table-03': [
      ['scope="col"', 'scope="row"', 'Scope của header bị dùng sai loại.'],
      ['<caption>Speedrun Scores</caption>', '<p>Speedrun Scores</p>', 'Caption ngữ nghĩa của bảng bị thay bằng paragraph.']
    ],
    'html-navigation-04': [
      ['<nav aria-label="Primary">', '<div aria-label="Primary">', 'Landmark nav bị thay bằng div.'],
      ['</nav>', '</div>', 'Phần điều hướng đóng sai phần tử.']
    ],
    'cpp-even-sum-03': [
      ['value % 2 == 0', 'value % 2 != 0', 'Điều kiện lọc số chẵn bị đảo thành số lẻ.'],
      ['sum == 30', 'sum == 39', 'Giá trị kiểm tra tổng bị thay đổi.']
    ],
    'cpp-palindrome-04': [
      ['text[i] != text[text.size() - 1 - i]', 'text[i] == text[text.size() - 1 - i]', 'Điều kiện xác định cặp ký tự sai bị đảo ngược.']
    ],
    'csharp-invoice-03': [
      ['return subtotal + subtotal * tax;', 'return subtotal - subtotal * tax;', 'Thuế bị trừ thay vì cộng vào hóa đơn.'],
      ['total == 132m', 'total == 108m', 'Output kiểm tra bị đổi.']
    ],
    'csharp-temperature-04': [
      ['(fahrenheit - 32.0) * 5.0 / 9.0', '(fahrenheit * 9.0 / 5.0) + 32.0', 'Công thức chuyển đổi bị đảo chiều.']
    ]
  };

  // Picks 1-2 independent mutations (seeded, non-overlapping) and applies
  // them on top of the base broken code, returning every reason so the
  // in-game failure guide can explain each injected bug.
  function addVariantBugs(id, code, rng) {
    let result = String(code);
    const reasons = [];
    const pool = shuffleWithRng(VARIANT_MUTATIONS[id] || [], rng);
    const available = pool.filter(([from]) => result.includes(from));
    if (!available.length) return { code: result, reasons };
    const maxCombine = Math.min(available.length, available.length >= 4 ? 3 : 2);
    const count = 1 + rngInt(rng, maxCombine); // combine up to 3 independent bugs when the pool allows it
    for (let i = 0; i < count && i < available.length; i++) {
      const [from, to, reason] = available[i];
      if (!result.includes(from)) continue; // guard against any accidental overlap
      result = result.replace(from, to);
      reasons.push(reason);
    }
    return { code: result, reasons };
  }

  // --- Seeded PRNG -----------------------------------------------------
  // Every variant is derived from one seed via mulberry32, so the mutation
  // engine below always makes deterministic-but-unpredictable choices: same
  // seed => same variant (useful for debugging/replays), a fresh random
  // seed (every Start Match / every finished run) => a practically unique
  // board every time, instead of picking from a tiny fixed pool.
  function seedToInt(seed) {
    let h = 2166136261;
    const s = String(seed);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(intSeed) {
    let a = intSeed >>> 0;
    return function next() {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rngInt(rng, maxExclusive) { return Math.floor(rng() * maxExclusive); }

  function shuffleWithRng(list, rng) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = rngInt(rng, i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function codeComment(language, text) {
    if (language === 'html') return `<!-- ${text} -->`;
    return `// ${text}`;
  }

  function randomPick(rng, values) { return values[Math.max(0, Math.min(values.length - 1, rngInt(rng, values.length)))]; }

  function injectRunHeader(code, language, rng, seed) {
    const lines = String(code).replace(/\r/g, '').split('\n');
    const count = 1 + rngInt(rng, 5);
    const labels = ['telemetry', 'edge-case audit', 'runner checkpoint', 'staging note', 'diagnostic pulse', 'integrity marker'];
    const block = Array.from({ length: count }, (_, i) => codeComment(language, `RUN ${seed.slice(0, 8)} · ${randomPick(rng, labels)} ${i + 1}`));
    let index = 0;
    if (language === 'html') index = Math.min(1, lines.length);
    else index = Math.min(4 + rngInt(rng, 4), lines.length);
    lines.splice(index, 0, ...block);
    return lines.join('\n');
  }

  function primaryMutation(base) {
    const brokenLines = String(base.broken || '').replace(/\r/g, '').split('\n');
    const solutionLines = String(base.solution || '').replace(/\r/g, '').split('\n');
    const max = Math.max(brokenLines.length, solutionLines.length);
    for (let i = 0; i < max; i++) {
      const from = solutionLines[i] ?? '';
      const to = brokenLines[i] ?? '';
      if (from !== to && from.trim() && to.trim()) {
        return [from, to, base.bugs?.[0]?.reason || 'Một dòng logic/syntax đã bị thay đổi.'];
      }
    }
    return null;
  }

  function diffLines(solution, broken) {
    const a = String(solution || '').split('\n');
    const b = String(broken || '').split('\n');
    const out = [];
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) if ((a[i] ?? '') !== (b[i] ?? '')) out.push(i + 1);
    return out;
  }

  function createVariant(base) {
    const seed = randomSeed();
    const rng = mulberry32(seedToInt(seed));
    const suffix = seed.replace(/[^a-z0-9]/gi, '').slice(0, 7) || 'run';
    const variant = { ...base, seed, variantId: `${base.id}:${seed}` };

    const replacements = {
      'js-inventory-01': [
        ['calculateSubtotal', `calculateSubtotal_${suffix}`], ['calculateDiscount', `calculateDiscount_${suffix}`],
        ['buildReceipt', `buildReceipt_${suffix}`], ['formatMoney', `formatMoney_${suffix}`], ['cart', `cart_${suffix}`]
      ],
      'js-login-02': [
        ['countFailedAttempts', `countFailedAttempts_${suffix}`], ['attempts', `attempts_${suffix}`],
        ['events', `events_${suffix}`], ['username', `username_${suffix}`], ['failed', `failed_${suffix}`]
      ],
      'cpp-average-01': [
        ['average', `average_${suffix}`], ['expected', `expected_${suffix}`], ['difference', `difference_${suffix}`], ['temperatures', `temperatures_${suffix}`]
      ],
      'cpp-stack-02': [
        ['popScore', `popScore_${suffix}`], ['safeScore', `safeScore_${suffix}`], ['scores', `scores_${suffix}`],
        ['first', `first_${suffix}`], ['second', `second_${suffix}`], ['third', `third_${suffix}`], ['fourth', `fourth_${suffix}`]
      ],
      'csharp-grade-01': [
        ['Grade', `Grade_${suffix}`], ['scores', `scores_${suffix}`], ['expected', `expected_${suffix}`], ['pass', `pass_${suffix}`]
      ],
      'csharp-null-02': [
        ['Greeting', `Greeting_${suffix}`], ['displayName', `displayName_${suffix}`], ['names', `names_${suffix}`],
        ['expected', `expected_${suffix}`], ['actual', `actual_${suffix}`], ['pass', `pass_${suffix}`]
      ]
    };

    const fromSolution = rng() < 0.68;
    let broken = fromSolution ? String(base.solution) : String(base.broken);
    let solution = String(base.solution);
    const selectedReasons = [];
    const selectedSources = [];

    if (fromSolution) {
      const primary = primaryMutation(base);
      if (primary) {
        const [from, to, reason] = primary;
        if (broken.includes(from)) {
          broken = broken.replace(from, to);
          selectedReasons.push(reason);
          selectedSources.push(to);
        }
      }
    } else if (base.bugs?.[0]?.reason) {
      selectedReasons.push(base.bugs[0].reason);
      selectedSources.push(base.broken);
    }

    const pool = shuffleWithRng(VARIANT_MUTATIONS[base.id] || [], rng);
    const available = pool.filter(([from]) => broken.includes(from) && !selectedSources.includes(from));
    const maxExtra = Math.min(available.length, 1 + rngInt(rng, Math.min(4, available.length) + 1));
    for (let i = 0; i < maxExtra; i++) {
      const [from, to, reason] = available[i];
      if (!broken.includes(from)) continue;
      broken = broken.replace(from, to);
      selectedReasons.push(reason);
      selectedSources.push(to);
    }

    if (!selectedReasons.length && base.bugs?.[0]?.reason) selectedReasons.push(base.bugs[0].reason);

    if (replacements[base.id]) {
      broken = replaceIdentifierPair(broken, replacements[base.id]);
      solution = replaceIdentifierPair(solution, replacements[base.id]);
    }

    // The board shape itself changes every run: different identifier suffixes,
    // different diagnostic header length and a different combination of bug operators.
    const modeNames = ['EDGE HUNT', 'LOGIC STORM', 'SYNTAX MINE', 'STACK TRACE', 'DATA SHIFT', 'NIGHTMARE PATCH'];
    variant.mode = randomPick(rng, modeNames);
    const timeJitter = (rngInt(rng, 7) - 3) * 5000;
    variant.timeLimitMs = Math.max(90000, Math.min(DEFAULT_TIME_MS, Number(base.timeLimitMs || DEFAULT_TIME_MS) + timeJitter));
    variant.seedFlavor = `${base.language.toUpperCase()} / ${variant.mode}`;
    variant.bugReasons = selectedReasons.slice(0, 5);
    const decorSeed = seedToInt(seed) ^ 0x9e3779b9;
    const brokenDecorRng = mulberry32(decorSeed);
    const solutionDecorRng = mulberry32(decorSeed);
    variant.broken = injectRunHeader(broken, base.language, brokenDecorRng, seed);
    variant.solution = injectRunHeader(solution, base.language, solutionDecorRng, seed);
    variant.bugLines = diffLines(variant.solution, variant.broken);
    variant.extraBugReasons = selectedReasons.slice(1);
    variant.bugCount = Math.max(1, Math.min(6, selectedReasons.length || variant.bugLines.length || 1));
    variant.layoutSalt = `${rngInt(rng, 1_000_000)}`;
    variant.variantDescriptor = `${variant.mode} · ${variant.bugCount} bug${variant.bugCount > 1 ? 's' : ''} · ${variant.bugLines.slice(0, 4).map(n => `L${n}`).join(', ')}`;
    return variant;
  }

  function variantBugNote(base, completedChallenge) {
    const reasons = completedChallenge?.bugReasons?.length ? completedChallenge.bugReasons : [];
    const lines = completedChallenge?.bugLines || [];
    if (reasons.length) {
      return reasons.slice(0, 6).map((reason, i) => lines[i] ? `Dòng ${lines[i]}: ${reason}` : reason);
    }
    return (base.bugs || []).map(bug => `Dòng ${bug.line}: ${bug.reason}`);
  }

  function variantFixGuide(base, completedChallenge) {
    const notes = variantBugNote(base, completedChallenge);
    return notes.length ? `Board này được sinh độc lập cho run hiện tại. Ưu tiên kiểm tra các dòng ${completedChallenge?.bugLines?.slice(0, 6).join(', ') || 'được nêu ở trên'} rồi mới chạm vào phần còn lại. ${notes.join(' ')}` : 'Kiểm tra lại output mong đợi và các điều kiện biên.';
  }

  function routeFromHash() {
    const raw = location.hash.replace(/^#/, '');
    return ['menu', 'speedrun', 'rank', 'leaderboard', 'academy', 'achievements', 'events', 'admin'].includes(raw) ? raw : 'menu';
  }

  function go(route) {
    const target = ['menu', 'speedrun', 'rank', 'leaderboard', 'academy', 'achievements', 'events', 'admin'].includes(route) ? route : 'menu';
    if (location.hash !== `#${target}`) location.hash = target;
    else renderRoute();
  }

  function renderHeader() {
    const btn = $('userBtn');
    if (!btn) return;
    if (state.currentUser) {
      btn.innerHTML = `${state.currentUser.photoURL ? `<img class="header-avatar" src="${escapeHtml(state.currentUser.photoURL)}" alt="" referrerpolicy="no-referrer">` : '<span class="header-user-dot"></span>'}<span>${escapeHtml(state.currentUser.name)}</span>`;
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
            <button class="feature-card" id="menuSpeedrunBtn"><div class="feature-icon">⚡</div><h3>Speedrun</h3><p>Board mới ở từng trận, nhiều lỗi độc lập và đường lỗi thay đổi theo seed.</p><span class="feature-arrow">→</span></button>
            <button class="feature-card" id="menuRankBtn"><div class="feature-icon">🏆</div><h3>Rank</h3><p>Leo 10 bậc bằng clear thật, xem progress, Rank Review và hiệu ứng profile.</p><span class="feature-arrow">→</span></button>
            <button class="feature-card" id="menuLeaderboardBtn"><div class="feature-icon">📊</div><h3>Leaderboard</h3><p>Theo dõi runner nhanh nhất, nhiều clear nhất và profile kèm hiệu ứng rank.</p><span class="feature-arrow">→</span></button>
            <button class="feature-card" id="menuAcademyBtn"><div class="feature-icon">🎓</div><h3>Beginner Academy</h3><p>Học syntax, logic, edge-case và mẹo đọc bug dưới áp lực thời gian.</p><span class="feature-arrow">→</span></button>
            <button class="feature-card" id="menuGauntletBtn"><div class="feature-icon">☄</div><h3>Gauntlet</h3><p>Chuỗi run liên tục với streak cao hơn, không đoán trước bài kế tiếp.</p><span class="feature-arrow">→</span></button>
            <button class="feature-card" id="menuProfileBtn"><div class="feature-icon">◎</div><h3>Runner Profile</h3><p>Mở thẳng profile, PB, lịch sử gần đây và tiến trình rank cloud.</p><span class="feature-arrow">→</span></button>
          </div>
          <div class="menu-bottom">
            <div class="daily-strip"><strong>💡 Run Tip</strong><br><span>Seed mới → layout mới → bug mới → dòng lỗi mới. Đừng học thuộc vị trí.</span></div>
            <div class="menu-session"><span>SESSION</span><strong>${state.sessionRuns} runs · ${state.sessionClears} clears · streak ${state.streak}</strong></div>
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
    $('menuGauntletBtn').onclick = () => go('speedrun');
    $('menuProfileBtn').onclick = () => state.currentUser ? openProfile(state.currentUser.key, true) : openAuth('login');
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
              <div class="editor-actions"><button id="menuBtn" class="secondary-btn compact-btn">☰ Menu</button><button id="practiceBtn" class="secondary-btn compact-btn practice-btn">◇ Practice</button><button id="resetBtn" class="secondary-btn compact-btn">↻ Reset</button><button id="hintBtn" class="secondary-btn compact-btn">💡 Hint</button><button id="soundBtn" class="secondary-btn compact-btn">🔊 Sound</button><button id="aiChallengeBtn" class="secondary-btn compact-btn">✦ AI</button><button id="startBtn" class="start-btn">▶ Start</button><button id="submitBtn" class="submit-btn" disabled>⚑ Submit</button></div>
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
            <div class="side-card run-intel-card"><div class="card-title-row"><h3>CURRENT RUN</h3><span class="micro-pill" id="runModeBadge">RANDOM</span></div><div class="side-main-stat" id="currentStat">READY</div><div class="side-substat" id="challengeMeta">—</div><div class="progress-track"><span id="progressBar"></span></div><p id="challengeDescription" class="run-note">Choose a challenge from the left.</p><div class="intel-grid"><div><small>SEED</small><strong id="seedBadge">—</strong></div><div><small>BOARD</small><strong id="bugCountBadge">—</strong></div><div><small>STREAK</small><strong id="streakBadge">STREAK 0</strong></div><div><small>HINTS</small><strong id="hintCountBadge">0 HINT</strong></div></div></div><div class="side-card"><div class="card-title-row"><h3>LIVE FEED</h3><span class="micro-pill">SESSION</span></div><div id="runFeed" class="run-feed"><div class="feed-item"><span></span>Ready for your next hunt.</div></div></div>
            <div class="side-card"><h3>YOUR RANK</h3><div id="rankChip" class="rank-chip" style="margin-top:10px"></div><p id="rankProgressText" class="run-note"></p></div>
            <div class="side-card"><h3>PERSONAL BEST</h3><div id="bestStat" class="side-main-stat">—</div><div id="runsStat" class="side-substat">0 correct clears</div></div>
            <div class="side-actions"><button id="leaderboardSideBtn" class="secondary-btn">🏆 Rank Board</button><button id="settingsSideBtn" class="secondary-btn">⚙ Settings</button></div>
          </aside>
        </div>
      </section>`;

    bindSpeedrunControls();
    populateSpeedrunSelectors();
    state.activePanel = 'log';
    if (!$('runFeed')?.children.length) pushRunFeed('Arena booted · procedural generator armed', 'info');
    loadChallenge(true);
    initMonacoIfNeeded();
  }

  function renderRank() {
    const user = state.currentUser;
    const progress = rankProgress(user);
    view.innerHTML = `
      <section class="view page-shell">
        <div class="page-head"><div class="page-title"><button class="nav-btn back-btn" id="rankBackBtn">← Menu</button><div><h2>Rank System</h2><div class="page-subtitle">10 nấc tiến trình • hiệu ứng tăng dần • Rank Review</div></div></div><button id="rankSpeedrunBtn" class="primary-btn">⚡ Speedrun</button></div>
        <div class="page-content">
          <div class="rank-hero"><div class="rank-progress-card"><div class="rank-progress-head"><span class="eyebrow">YOUR CURRENT RANK</span><strong>${user ? `${totalCorrect(user)} clears` : 'Guest'}</strong></div><div class="rank-progress-main"><span class="big-icon ${progress.current.id}">${rankIconSvg(progress.current, 'normal')}</span><div><strong class="rank-text-${progress.current.id}">${escapeHtml(progress.current.name)}</strong><br><span>${escapeHtml(progress.current.description)}</span></div></div><div class="progress-track"><span style="width:${progress.pct}%"></span></div><div class="rank-progress-note">${progress.next ? `Còn ${progress.remaining} clear để lên ${progress.next.name}.` : 'Bạn đã đạt Đế vương — MAX RANK.'}</div></div><div class="rank-tip-card"><h3>🏁 Rank Rules</h3><p>Chỉ speedrun đúng mới cộng rank. Thua, timeout và practice không cộng.</p><p class="run-note">Bấm vào một rank để mở Rank Review và xem chính xác icon, màu tên, aura và animation.</p></div></div>
          <div class="rank-grid rank-grid-v5">${RANKS.map(rank => `<button type="button" class="rank-card rank-review-trigger ${rank.id}${rank.id === progress.current.id ? ' current' : ''}" data-rank-id="${rank.id}"><div class="rank-top"><div class="rank-icon ${rank.id}">${rankIconSvg(rank, 'normal')}</div><div><div class="rank-name rank-text-${rank.id}">${escapeHtml(rank.name)}</div><div class="rank-requirement">${rank.threshold === 0 ? 'Bắt đầu' : `${rank.threshold} speedrun đúng`}</div></div></div>${rank.id === progress.current.id ? '<span class="rank-current-tag">CURRENT</span>' : ''}<p class="rank-copy">${escapeHtml(rank.description)}</p><div class="rank-bar"><span style="width:${user ? Math.min(100, Math.max(0, ((totalCorrect(user)-rank.threshold+1)/(Math.max(1, (RANKS[RANKS.indexOf(rank)+1]?.threshold || rank.threshold+1)-rank.threshold)))*100)) : 0}%"></span></div><span class="rank-review-label">VIEW REVIEW ↗</span></button>`).join('')}</div>
          <div class="achievement-grid">${[
            ['⚡', 'First Blood', '1 clear', 1], ['🔥', 'Heat Up', '5 clears', 5], ['🏆', 'Gold Rush', '8 clears', 8], ['💎', 'Diamond Hands', '15 clears', 15], ['👑', 'Legendary', '25 clears', 25], ['✨', 'Thăng hoa', '32 clears', 32], ['⚡', 'GOD MODE', '40 clears', 40], ['♾️', 'Bất tử', '55 clears', 55], ['🪐', 'Orbit', '72 clears', 72], ['♛', 'Đế vương', '90 clears', 90]
          ].map(a => `<div class="achievement ${(user && totalCorrect(user) >= a[3]) ? 'unlocked' : ''}"><div class="a-icon">${a[0]}</div><strong>${a[1]}</strong><small>${a[2]}</small></div>`).join('')}</div>
          <div class="rank-review-note">Click bất kỳ rank nào để preview hiệu ứng. Emperor và Orbit có audio riêng khi review.</div>
        </div>
      </section>`;
    $('rankBackBtn').onclick = () => { stopRankAudio(); go('menu'); };
    $('rankSpeedrunBtn').onclick = () => { stopRankAudio(); go('speedrun'); };
    document.querySelectorAll('.rank-review-trigger').forEach(btn => btn.onclick = () => openRankReview(btn.dataset.rankId));
  }

  function openRankReview(rankId) {
    const rank = RANKS.find(r => r.id === rankId) || RANKS[0];
    const viewer = state.currentUser;
    stopRankAudio();
    const displayName = viewer?.displayName || viewer?.name || viewer?.email?.split('@')[0] || 'Your Runner';
    const photo = viewer?.photoURL || '';
    const avatar = photo ? `<img src="${escapeHtml(photo)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar-fallback">${escapeHtml(displayName.slice(0,1).toUpperCase())}</span>`;
    const root = document.createElement('div');
    root.id = 'rankReviewRoot';
    root.innerHTML = `<div class="rank-review-backdrop"><div class="rank-review-modal ${rank.id}"><div class="profile-topline"><span class="eyebrow">RANK REVIEW</span><button class="close-btn" id="rankReviewClose">✕</button></div><div class="rank-review-stage ${rank.id}"><div class="review-avatar ${rank.id}">${avatar}<span class="review-rank-aura">${rank.id === 'orbit' ? '<i class="orbit-body"></i><i class="orbit-ring ring-a"></i><i class="orbit-ring ring-b"></i><i class="orbit-ring ring-c"></i>' : ''}</span></div><div class="review-player"><div class="review-player-name rank-text-${rank.id}">${escapeHtml(displayName)}</div><div class="review-player-rank">${rankIconSvg(rank, 'mini')} ${escapeHtml(rank.name)}</div></div></div><div class="rank-review-grid"><div><small>ICON</small><div class="review-icon ${rank.id}">${rankIconSvg(rank, 'normal')}</div></div><div><small>NAME COLOR</small><div class="review-name-sample rank-text-${rank.id}">${escapeHtml(displayName)}</div></div><div><small>EFFECT</small><div class="review-effect-badge ${rank.id}">${escapeHtml(rank.effect || 'none')}</div></div><div><small>THRESHOLD</small><div class="review-threshold">${rank.threshold} clears</div></div></div><div class="rank-review-footer"><span>${escapeHtml(rank.description)}</span>${audioForRank(rank.id) ? `<span class="audio-note">♫ ${rank.id === 'emperor' ? 'sovereign.mp3' : 'orbitsong.mp3'}</span>` : ''}</div></div></div>`;
    document.body.appendChild(root);
    $('rankReviewClose').onclick = closeRankReview;
    root.querySelector('.rank-review-backdrop').onclick = e => { if (e.target.classList.contains('rank-review-backdrop')) closeRankReview(); };
    if (audioForRank(rank.id)) playRankAudio(rank.id);
  }

  function closeRankReview() { stopRankAudio(); document.getElementById('rankReviewRoot')?.remove(); }

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
    stopRankAudio();
    document.getElementById('rankReviewRoot')?.remove();
    document.getElementById('profileRoot')?.remove();
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

  function giveRunHint() {
    if (!state.challenge || !state.editor) return;
    if (!state.running) {
      showToast('Hint chỉ dùng trong match đang chạy.', 'error');
      return;
    }
    const reasons = state.challenge.bugReasons || state.challenge.extraBugReasons || state.challengeBase?.bugs?.map(b => b.reason) || [];
    const line = state.challenge.bugLines?.[Math.min(state.hintsUsed, Math.max(0, state.challenge.bugLines.length - 1))];
    const hint = reasons[Math.min(state.hintsUsed, Math.max(0, reasons.length - 1))] || 'Kiểm tra điều kiện, giá trị biên và trạng thái dữ liệu.';
    state.hintsUsed += 1;
    if ($('hintCountBadge')) $('hintCountBadge').textContent = `${state.hintsUsed} HINT`;
    setOutput(`HINT #${state.hintsUsed}\n${line ? `Tập trung quanh dòng ${line}. ` : ''}${hint}\nKhông tiết lộ trực tiếp đáp án.`);
    switchPanel('log');
    pushRunFeed(`Hint used${line ? ` · line ${line}` : ''}`, 'hint');
  }

  function bindSpeedrunControls() {
    $('menuBtn').onclick = () => go('menu');
    $('resetBtn').onclick = resetChallenge;
    $('aiChallengeBtn').onclick = generateAiChallenge;
    $('practiceBtn').onclick = togglePractice;
    $('toggleBottomBtn').onclick = toggleBottomPanel;
    $('startBtn').onclick = startRun;
    $('submitBtn').onclick = () => { if (state.running) finishRun('Manual submission.', false); };
    $('leaderboardSideBtn').onclick = () => go('leaderboard');
    $('settingsSideBtn').onclick = openSettings;
    $('randomBtn').onclick = () => { selectRandomChallenge(); pushRunFeed('Manual randomizer: new board prepared', 'info'); };
    $('hintBtn').onclick = giveRunHint;
    $('soundBtn').onclick = () => { state.soundEnabled = !state.soundEnabled; $('soundBtn').textContent = state.soundEnabled ? '🔊 Sound' : '🔇 Silent'; };
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
    $('challengeList').innerHTML = list.map(challenge => `<button class="challenge-card ${state.challengeBase?.id === challenge.id ? 'active' : ''}" data-challenge-id="${escapeHtml(challenge.id)}"><div class="line"><span class="challenge-title">${escapeHtml(challenge.title)}</span><span class="difficulty ${challenge.difficulty.toLowerCase()}">${escapeHtml(challenge.difficulty)}</span></div><div class="challenge-meta">${formatMs(challenge.timeLimitMs)} · ${(challenge.bugs?.length || 1)} base bug · ${escapeHtml(challenge.id)}</div></button>`).join('') || '<div class="ai-empty">No challenge found.</div>';
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
    const bugCount = Math.max(1, Number(variant?.bugCount || (base.bugs?.length || 0) + (variant?.extraBugReasons?.length || 0)));
    if ($('challengeStatusText')) $('challengeStatusText').textContent = `${base.title} · ${meta.label} · ${variant?.mode || 'RANDOM'} · ${bugCount} bug${bugCount > 1 ? 's' : ''}`;
    if ($('challengeMeta')) $('challengeMeta').textContent = `${meta.label} · ${base.difficulty} · ${bugCount} bugs · ${variant?.bugLines?.slice(0,4).map(n => `L${n}`).join(' / ') || 'line drift'}`;
    if ($('challengeDescription')) $('challengeDescription').textContent = `${base.description || 'Repair the broken code before the clock reaches zero.'} ${variant?.seedFlavor ? `Mode: ${variant.seedFlavor}.` : ''}`;
    if ($('runModeBadge')) $('runModeBadge').textContent = variant?.mode || 'RANDOM';
    if ($('seedBadge')) $('seedBadge').textContent = variant?.seed ? variant.seed.slice(0, 10) : '—';
    if ($('bugCountBadge')) $('bugCountBadge').textContent = `${bugCount} BUG${bugCount > 1 ? 'S' : ''}`;
    if ($('hintCountBadge')) $('hintCountBadge').textContent = `${state.hintsUsed} HINT`;
    if ($('streakBadge')) $('streakBadge').textContent = `STREAK ${state.streak}`;
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

  function pushRunFeed(message, type = 'info') {
    state.runFeed.unshift({ message, type, at: Date.now() });
    state.runFeed = state.runFeed.slice(0, 8);
    const el = $('runFeed');
    if (el) el.innerHTML = state.runFeed.map(item => `<div class="feed-item ${escapeHtml(item.type)}"><span></span>${escapeHtml(item.message)}</div>`).join('');
  }

  function runBeep(kind = 'tick') {
    if (!state.soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = runBeep.ctx || (runBeep.ctx = new AudioContext());
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const freq = kind === 'pass' ? 880 : kind === 'fail' ? 180 : kind === 'start' ? 520 : 320;
      osc.type = kind === 'fail' ? 'sawtooth' : 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.04, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.11);
      osc.connect(gain).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.12);
    } catch {}
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
    state.sessionRuns += 1;
    state.hintsUsed = 0;
    setOutput(`RUN STARTED\nMode: ${state.challenge.mode}\nSeed: ${state.challenge.seed}\nBug lines are randomized this run: ${state.challenge.bugLines.join(', ') || 'dynamic'}\nTimer is live. Find the bug.\nCopy / Cut / Paste are disabled.`);
    pushRunFeed(`Match #${state.sessionRuns}: ${state.challenge.mode} · ${state.challenge.bugCount} bug${state.challenge.bugCount > 1 ? 's' : ''}`, 'live');
    runBeep('start');
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

    if (correct && !timedOut) {
      state.sessionClears += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      runBeep('pass');
      pushRunFeed(`CLEAR · ${formatMs(runSnapshot.elapsedMs)} · streak ${state.streak}`, 'success');
    } else {
      state.streak = 0;
      runBeep('fail');
      pushRunFeed(`${timedOut ? 'TIMEOUT' : 'FAIL'} · streak reset`, 'error');
    }
    setOutput(`${timedOut ? 'TIMEOUT' : 'SUBMITTED'}\nTime: ${formatMs(runSnapshot.elapsedMs)}\nResult: ${outcome}\nMode: ${runSnapshot.challenge.mode || 'RANDOM'}\nBug lines: ${(runSnapshot.challenge.bugLines || []).join(', ') || 'dynamic'}\n${reason}`);
    renderResult(correct, timedOut, score, runSnapshot.challengeBase, runSnapshot.challenge);
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

  function renderResult(correct, timedOut, score, base, completedChallenge) {
    const user = state.currentUser || currentUser();
    const displayedClears = score?.totalCorrect ?? totalCorrect(user);
    const resultUser = user ? { ...user, totalCorrect: displayedClears } : user;
    const rank = getRank(resultUser);
    const rp = rankProgress(resultUser);
    const failureGuide = !correct || timedOut ? `<details class="failure-guide"><summary>Những lỗi cần kiểm tra và cách giải</summary><ul>${variantBugNote(base, completedChallenge).map(note => `<li>${escapeHtml(note)}</li>`).join('')}</ul><p>${escapeHtml(variantFixGuide(base, completedChallenge))}</p></details>` : '';
    $('resultsBody').innerHTML = `<div class="result-card"><div class="result-stat"><small>RESULT</small><strong class="${correct && !timedOut ? 'result-good' : 'result-bad'}">${correct && !timedOut ? 'PASS' : timedOut ? 'TIMEOUT' : 'FAIL'}</strong></div><div class="result-stat"><small>TIME</small><strong>${formatMs(state.elapsedMs)}</strong></div><div class="result-stat"><small>RANK</small><strong class="result-rank ${rank.id}">${rankIconSvg(rank, 'mini')} ${escapeHtml(rank.name)}</strong></div><div class="result-stat"><small>CLEARS</small><strong>${displayedClears}</strong></div></div><p class="run-note">${correct && !timedOut ? `Solution accepted. ${score.newBest ? 'NEW PERSONAL BEST!' : 'Clear recorded.'}` : timedOut ? 'Timeout: no clear was added.' : 'The submitted code does not match the expected solution.'} ${rp.next ? `Còn ${rp.remaining} clear để lên ${rp.next.name}.` : ''}</p>${failureGuide}<div class="result-next-note"><span>NEW BOARD READY</span><strong>Procedural board queued</strong><small>Bài nền, seed, tổ hợp lỗi và dòng lỗi đã được random hóa cho lượt tiếp theo.</small></div>`;
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
    let result = { newBest: false, totalRuns: getTotalRuns(user), totalCorrect: totalCorrect(user) };

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

        const nextTotalRuns = getTotalRuns(existing) + 1;
        const totalCorrect = totalCorrect(existing) + (correct ? 1 : 0);
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
          totalRuns: nextTotalRuns,
          totalCorrect,
          bestTimeMs,
          hasClear: totalCorrect > 0,
          records,
          history,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        result = { newBest, totalRuns: nextTotalRuns, totalCorrect };
      });
      const savedProfile = await getCloudProfile();
      if (savedProfile) {
        state.currentUser = savedProfile;
        state.leaderboardUsers.set(uid, ensureUserShape(savedProfile));
      } else {
        state.currentUser = {
          ...user,
          totalRuns: result.totalRuns,
          totalCorrect: result.totalCorrect,
          stats: { ...user.stats, totalRuns: result.totalRuns, totalCorrect: result.totalCorrect }
        };
        state.leaderboardUsers.set(uid, ensureUserShape(state.currentUser));
      }
      if (state.route === 'leaderboard') renderLeaderboard();
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
    setOutput(`Reset complete. New random board generated.\nMode: ${state.challenge.mode || 'RANDOM'}\nSeed: ${state.challenge.seed}.\nPress Start Match.`); pushRunFeed('Manual reset → fresh procedural board', 'info');
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

  function parseAiJson(text) {
    const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  }

  async function generateAiChallenge() {
    const button = $('aiChallengeBtn');
    const key = getGeminiKey();
    if (!key) {
      showToast('Hãy nhập Gemini API Key trong Cài đặt trước.', 'error');
      openSettings();
      return;
    }
    if (state.running || state.finishing || !state.editor) {
      showToast('Hãy chờ run hiện tại kết thúc trước khi tạo bài mới.', 'error');
      return;
    }
    if (button) { button.disabled = true; button.textContent = '✦ Đang tạo...'; }
    const language = state.language;
    const languageLabel = LANGUAGES[language].label;
    const prompt = `Create one original debugging challenge for a timed coding game in ${languageLabel}. Return JSON only, no markdown, exactly with: {"title":"...","difficulty":"Easy|Medium|Hard","broken":"...","solution":"...","bugs":[{"reason":"...","concept":"..."},{"reason":"...","concept":"..."}]}. The broken code must contain at least two independent real bugs. The solution must fix every bug. Keep the code self-contained, deterministic, runnable, and 20-80 lines. Include a final CHECK: PASS condition or equivalent test. Do not use network, browser APIs, filesystem, randomness, infinite loops, or external packages. Make the bugs different from simple variable renaming.`;
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(getGeminiModel())}:generateContent?key=${encodeURIComponent(key)}`;
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.85, responseMimeType: 'application/json' } }) });
      if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('');
      const generated = parseAiJson(text);
      if (!generated || typeof generated.broken !== 'string' || typeof generated.solution !== 'string' || generated.broken === generated.solution) throw new Error('Gemini trả về challenge không hợp lệ.');
      if (!Array.isArray(generated.bugs) || generated.bugs.length < 2) throw new Error('Challenge phải có ít nhất 2 lỗi.');
      if (generated.broken.length < 40 || generated.solution.length < 40 || generated.broken.length > 20000) throw new Error('Code challenge có độ dài không hợp lệ.');
      const generatedChallenge = {
        id: `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        language,
        title: String(generated.title || 'AI Debugging Lab').slice(0, 80),
        difficulty: ['Easy', 'Medium', 'Hard'].includes(generated.difficulty) ? generated.difficulty : 'Medium',
        timeLimitMs: 180000,
        broken: generated.broken,
        solution: generated.solution,
        bugs: generated.bugs.slice(0, 6).map(bug => ({ reason: String(bug.reason || 'Bug generated by Gemini.'), concept: String(bug.concept || 'Debugging') })),
        source: 'gemini'
      };
      window.BUG_SPEEDRUNNER_CHALLENGES.push(generatedChallenge);
      selectChallengeObject(generatedChallenge);
      showToast('Gemini đã tạo challenge mới.', 'success');
      setOutput(`AI CHALLENGE READY\n${generatedChallenge.title}\n${generatedChallenge.bugs.length} bugs detected by the challenge author.\nPress Start Match.`);
    } catch (error) {
      console.error('AI challenge generation failed:', error);
      showToast(`Không tạo được challenge: ${error.message}`, 'error');
    } finally {
      if (button) { button.disabled = false; button.textContent = '✦ AI Challenge'; }
    }
  }

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
    const photo = user.photoURL || '';
    const avatar = photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(profile.name)}" referrerpolicy="no-referrer">` : `<span class="avatar-fallback">${escapeHtml(profile.name.slice(0,1).toUpperCase())}</span>`;
    const orbit = rank.id === 'orbit' ? '<span class="profile-orbit-system"><i class="profile-orbit o1"></i><i class="profile-orbit o2"></i><i class="profile-orbit o3"></i><i class="profile-orbit-star s1"></i><i class="profile-orbit-star s2"></i><i class="profile-orbit-star s3"></i></span>' : '';
    return `<div class="profile-backdrop" id="profileBackdrop"><div class="profile-modal" role="dialog" aria-modal="true"><div class="profile-topline"><span class="eyebrow">RUNNER PROFILE</span><button class="close-btn" id="profileCloseBtn">✕</button></div><div class="profile-hero ${rank.id}"><div class="profile-avatar ${rank.id}">${avatar}${orbit}</div><div class="profile-rank-icon">${rankIconSvg(rank, 'normal')}</div><div><div class="profile-name rank-text-${rank.id}">${escapeHtml(profile.name)}</div><div class="profile-rank-label">${rankIconSvg(rank, 'mini')} ${escapeHtml(rank.name)}</div></div></div><div class="profile-grid"><div><small>CLEARS</small><strong>${clears}</strong></div><div><small>RUNS</small><strong>${user.stats.totalRuns}</strong></div><div><small>SUCCESS RATE</small><strong>${successRate}%</strong></div><div><small>BEST TIME</small><strong>${best}</strong></div></div><div class="profile-progress"><div><span>RANK PROGRESS</span><strong>${rankProgress(user).next ? `${rankProgress(user).remaining} to ${rankProgress(user).next.name}` : 'MAX RANK'}</strong></div><div class="progress-track"><span style="width:${rankProgress(user).pct}%"></span></div></div><div class="profile-history"><div class="profile-section-title">RECENT RUNS</div>${history.length ? history.map(item => `<div class="profile-history-row"><span class="history-result ${item.correct ? 'ok' : 'bad'}">${item.correct ? 'CLEAR' : item.timedOut ? 'TIMEOUT' : 'FAIL'}</span><span>${escapeHtml(item.title)}</span><span>${formatMs(item.ms)}</span></div>`).join('') : '<div class="ai-empty">Chưa có run nào.</div>'}</div>${state.currentUser?.key === profile.key ? '<div class="profile-actions"><button class="secondary-btn" id="profileSettingsBtn">⚙ Settings</button><button class="danger-btn" id="profileLogoutBtn">Đăng xuất</button></div>' : ''}</div></div>`;
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
    if (audioForRank(profile.rank.id) && (self || state.currentUser?.key === profile.key)) playRankAudio(profile.rank.id);
    if (self || state.currentUser?.key === profile.key) {
      $('profileSettingsBtn')?.addEventListener('click', () => { closeProfile(); openSettings(); });
      $('profileLogoutBtn')?.addEventListener('click', logout);
    }
  }

  function closeProfile() { stopRankAudio(); document.getElementById('profileRoot')?.remove(); }

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
      '# Bug Speedrunner — Procedural Arena Edition',
      '',
      'Browser-only coding speedrun game by HK1413. Procedural Arena build: 16 base challenges + deterministic per-run procedural mutation.',
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
      'Practice mode is not ranked. Ranked Start Match requires Firebase login. Every Start Match creates a fresh procedural board with a new seed, independent bug operators, randomized diagnostic padding, and shifted bug lines; every finalized run immediately gets another fresh board. Duplicate finish attempts are blocked by a run-id guard.',
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


  /* ==================== V5 EVENT + ACHIEVEMENT ENGINE ==================== */
  const V5_STORAGE={achievements:'bugSpeedrunnerV5Achievements',titles:'bugSpeedrunnerV5Titles',events:'bugSpeedrunnerV5Events'};
  const ACHIEVEMENT_DEFS=[
    {id:'first-blood',icon:'⚡',name:'First Blood',desc:'Hoàn thành clear đầu tiên.',target:1,metric:'clears',title:'Bug Hunter',rarity:'common'},
    {id:'speed-demon',icon:'💨',name:'Speed Demon',desc:'Có clear dưới 30 giây.',target:1,metric:'sub30',title:'Speed Demon',rarity:'rare'},
    {id:'streak-10',icon:'🔥',name:'Unstoppable',desc:'Đạt streak 10.',target:10,metric:'bestStreak',title:'Unstoppable',rarity:'epic'},
    {id:'bug-exterminator',icon:'🐛',name:'Bug Exterminator',desc:'Đạt 50 clear.',target:50,metric:'clears',title:'Bug Exterminator',rarity:'rare'},
    {id:'perfect-10',icon:'✦',name:'Perfect Machine',desc:'10 run clear không dùng hint.',target:10,metric:'perfects',title:'Flawless',rarity:'legendary'},
    {id:'ishow',icon:'⚡',name:'IShow⚡',desc:'Hoàn thành IShow⚡ dưới 5 phút.',target:1,metric:'ishow',title:'IShow⚡',rarity:'event'}
  ];
  const DEFAULT_EVENTS=[{id:'ishow-v1',name:'IShow⚡',icon:'⚡',status:'LIVE',version:1,description:'10 challenge liên tục, càng về sau càng khó. Dưới 5 phút để nhận title.',challengeCount:10,timeLimitMs:300000,titleReward:'IShow⚡',achievementReward:'ishow',medalThresholds:{bronze:420000,silver:360000,gold:300000,lightning:270000},difficulty:'rising',boss:true}];
  function v5Read(k,f){try{const r=localStorage.getItem(k);return r?JSON.parse(r):f}catch{return f}}
  function v5Write(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
  function v5Uid(){return state.currentUser?.uid||state.currentUser?.key||'guest'}
  function v5Progress(){const a=v5Read(V5_STORAGE.achievements,{});return a[v5Uid()]||{unlocked:[],stats:{perfects:0,sub30:0,ishow:0}}}
  function v5SaveProgress(p){const a=v5Read(V5_STORAGE.achievements,{});a[v5Uid()]=p;v5Write(V5_STORAGE.achievements,a)}
  function v5Titles(){const a=v5Read(V5_STORAGE.titles,{});return a[v5Uid()]||[]}
  function unlockTitle(title,source,rarity='common'){if(!title||!state.currentUser)return;const t=v5Titles();if(!t.some(x=>x.name===title)){t.push({name:title,source,rarity,at:Date.now()});const all=v5Read(V5_STORAGE.titles,{});all[v5Uid()]=t;v5Write(V5_STORAGE.titles,all);showToast(`🏷️ Title unlocked: ${title}`,'success')}}
  function updateAchievements(){if(!state.currentUser)return;const p=v5Progress(),u=state.currentUser,m={clears:totalCorrect(u),bestStreak:state.bestStreak,perfects:p.stats.perfects||0,sub30:p.stats.sub30||0,ishow:p.stats.ishow||0};ACHIEVEMENT_DEFS.forEach(a=>{if((m[a.metric]||0)>=a.target&&!p.unlocked.includes(a.id)){p.unlocked.push(a.id);unlockTitle(a.title,a.id,a.rarity);showToast(`🏆 Achievement: ${a.name}`,'success')}});v5SaveProgress(p)}
  function updateAchievementForRun(correct,ms){if(!correct||!state.currentUser)return;const p=v5Progress();if(ms<30000)p.stats.sub30=(p.stats.sub30||0)+1;if(state.hintsUsed===0)p.stats.perfects=(p.stats.perfects||0)+1;v5SaveProgress(p);updateAchievements()}
  function rankNameClass(id){return `rank-text-${id}`}
  function renderRankV5(){const user=state.currentUser,pr=rankProgress(user),cur=pr.current,p=v5Progress();const cards=RANKS.map((r,i)=>{const n=RANKS[i+1],pct=user?(r.id==='emperor'?100:Math.max(0,Math.min(100,((totalCorrect(user)-r.threshold)/Math.max(1,(n?.threshold||r.threshold+1)-r.threshold))*100))):0;return `<button class="rank-card ${r.id} rank-power-${r.power||0} rank-review-trigger ${r.id===cur.id?'current':''}" data-rank-id="${r.id}" type="button"><div class="rank-card-aura"></div><div class="rank-top"><div class="rank-icon ${r.id}">${rankIconSvg(r,'normal')}</div><div><div class="rank-name ${rankNameClass(r.id)}">${escapeHtml(r.name)}</div><div class="rank-requirement">${r.threshold===0?'Bắt đầu':r.threshold+' speedrun đúng'}</div></div></div>${r.id===cur.id?'<span class="rank-current-tag">CURRENT</span>':''}<p class="rank-copy">${escapeHtml(r.description)}</p><div class="rank-bar"><span style="width:${pct}%"></span></div><span class="rank-review-label">REVIEW ↗</span></button>`}).join('');const mini=ACHIEVEMENT_DEFS.slice(0,4).map(a=>{const v=a.metric==='clears'?totalCorrect(user):a.metric==='bestStreak'?state.bestStreak:(p.stats[a.metric]||0);return `<div class="achievement ${p.unlocked.includes(a.id)?'unlocked':''}"><div class="a-icon">${a.icon}</div><strong>${a.name}</strong><small>${Math.min(a.target,v)}/${a.target}</small></div>`}).join('');view.innerHTML=`<section class="view page-shell"><div class="page-head"><div class="page-title"><button class="nav-btn back-btn" id="rankBackBtn">← Menu</button><div><h2>Rank System</h2><div class="page-subtitle">11 bậc · hiệu ứng tăng dần · Rank Review</div></div></div><div class="page-head-actions"><button class="secondary-btn" id="rankAchievementBtn">🏅 Achievements</button><button class="primary-btn" id="rankSpeedrunBtn">⚡ Speedrun</button></div></div><div class="page-content"><div class="rank-hero"><div class="rank-progress-card ${cur.id}"><div class="rank-progress-head"><span class="eyebrow">YOUR CURRENT RANK</span><strong>${user?totalCorrect(user)+' clears':'Guest'}</strong></div><div class="rank-progress-main"><span class="big-icon ${cur.id}">${rankIconSvg(cur,'normal')}</span><div><strong class="${rankNameClass(cur.id)}">${escapeHtml(cur.name)}</strong><br><span>${escapeHtml(cur.description)}</span></div></div><div class="progress-track"><span style="width:${pr.pct}%"></span></div><div class="rank-progress-note">${pr.next?`Còn ${pr.remaining} clear để lên ${pr.next.name}.`:'👑 Đế vương — MAX RANK.'}</div></div><div class="rank-tip-card"><h3>✨ Rank Review</h3><p>Click một rank để xem icon, màu tên, aura và nhạc đặc biệt.</p><button class="secondary-btn" id="openCurrentReview">Review ${escapeHtml(cur.name)}</button></div></div><div class="rank-grid rank-grid-v5">${cards}</div><div class="rank-section-head"><div><span class="eyebrow">ACHIEVEMENTS</span><h3>Thành tựu</h3></div><button class="link-btn" id="openAllAchievements">Xem tất cả →</button></div><div class="achievement-grid">${mini}</div></div></section>`;$('rankBackBtn').onclick=()=>go('menu');$('rankSpeedrunBtn').onclick=()=>go('speedrun');$('rankAchievementBtn').onclick=()=>go('achievements');$('openAllAchievements').onclick=()=>go('achievements');$('openCurrentReview').onclick=()=>openRankReview(cur.id);document.querySelectorAll('.rank-review-trigger').forEach(b=>b.onclick=()=>openRankReview(b.dataset.rankId))}
  renderRank=renderRankV5;
  function openRankReviewV5(rankId){const rank=RANKS.find(r=>r.id===rankId)||RANKS[0],v=state.currentUser;stopRankAudio();const name=v?.name||v?.displayName||v?.email?.split('@')[0]||'Your Runner',photo=v?.photoURL||'';const avatar=photo?`<img src="${escapeHtml(photo)}" alt="" referrerpolicy="no-referrer">`:`<span class="avatar-fallback">${escapeHtml(name.slice(0,1).toUpperCase())}</span>`;const orbit=rank.id==='orbit'?'<span class="profile-orbit-system"><i class="profile-orbit o1"></i><i class="profile-orbit o2"></i><i class="profile-orbit o3"></i><i class="profile-orbit-star s1">✦</i><i class="profile-orbit-star s2">·</i><i class="profile-orbit-star s3">✦</i></span>':'';const root=document.createElement('div');root.id='rankReviewRoot';root.innerHTML=`<div class="rank-review-backdrop"><div class="rank-review-modal ${rank.id}"><div class="profile-topline"><span class="eyebrow">RANK REVIEW</span><button class="close-btn" id="rankReviewClose">✕</button></div><div class="rank-review-stage ${rank.id}"><div class="review-avatar ${rank.id}"><div class="review-avatar-core">${avatar}</div>${orbit}</div><div class="review-player"><div class="review-player-name ${rankNameClass(rank.id)}">${escapeHtml(name)}</div><div class="review-player-rank">${rankIconSvg(rank,'mini')} ${escapeHtml(rank.name)}</div></div></div><div class="rank-review-grid"><div><small>ICON</small><div class="review-icon ${rank.id}">${rankIconSvg(rank,'normal')}</div></div><div><small>NAME COLOR</small><div class="review-name-sample ${rankNameClass(rank.id)}">${escapeHtml(name)}</div></div><div><small>EFFECT</small><div class="review-effect-badge ${rank.id}">POWER ${rank.power||0}/10 · ${escapeHtml(rank.effect||'none')}</div></div><div><small>THRESHOLD</small><div class="review-threshold">${rank.threshold} clears</div></div></div><div class="rank-review-footer"><span>${escapeHtml(rank.description)}</span>${audioForRank(rank.id)?`<span class="audio-note">♫ ${rank.id==='emperor'?'sovereign.mp3':'orbitsong.mp3'}</span>`:''}</div></div></div>`;document.body.appendChild(root);$('rankReviewClose').onclick=closeRankReview;root.querySelector('.rank-review-backdrop').onclick=e=>{if(e.target.classList.contains('rank-review-backdrop'))closeRankReview()};if(audioForRank(rank.id))playRankAudio(rank.id)}
  openRankReview=openRankReviewV5;
  function renderAchievements(){const p=v5Progress(),u=state.currentUser,ts=v5Titles(),html=ACHIEVEMENT_DEFS.map(a=>{let v=a.metric==='clears'?totalCorrect(u):a.metric==='bestStreak'?state.bestStreak:(p.stats[a.metric]||0);const unlocked=p.unlocked.includes(a.id);return `<article class="achievement-detail ${unlocked?'unlocked':''}"><div class="achievement-badge">${a.icon}</div><div class="achievement-main"><div class="achievement-rarity ${a.rarity}">${a.rarity}</div><h3>${escapeHtml(a.name)}</h3><p>${escapeHtml(a.desc)}</p><div class="achievement-progress"><span style="width:${Math.min(100,(v/a.target)*100)}%"></span></div><small>${Math.min(v,a.target)}/${a.target} · Reward: <strong>${escapeHtml(a.title)}</strong></small></div>${unlocked?'<div class="achievement-unlocked">UNLOCKED</div>':''}</article>`}).join('');const titles=ts.length?ts.map(t=>`<div class="title-card ${t.rarity}"><span>🏷️</span><div><strong>${escapeHtml(t.name)}</strong><small>${escapeHtml(t.rarity)}</small></div><button class="small-tool equip-title" data-title="${escapeHtml(t.name)}">${state.equippedTitle===t.name?'Equipped':'Equip'}</button></div>`).join(''):'<div class="ai-empty">Chưa có title.</div>';view.innerHTML=`<section class="view page-shell"><div class="page-head"><div class="page-title"><button class="nav-btn back-btn" id="achBackBtn">← Menu</button><div><h2>Achievements & Titles</h2><div class="page-subtitle">Hoàn thành thành tựu → nhận title → trang bị.</div></div></div><button class="primary-btn" id="achEventBtn">⚡ Events</button></div><div class="page-content"><div class="achievement-detail-grid">${html}</div><div class="section-divider"></div><div class="rank-section-head"><div><span class="eyebrow">TITLE COLLECTION</span><h3>Title collection</h3></div></div><div class="title-grid">${titles}</div></div></section>`;$('achBackBtn').onclick=()=>go('menu');$('achEventBtn').onclick=()=>go('events');document.querySelectorAll('.equip-title').forEach(b=>b.onclick=()=>{state.equippedTitle=b.dataset.title;localStorage.setItem(`bugSpeedrunnerEquippedTitle_${v5Uid()}`,state.equippedTitle);renderAchievements();showToast(`🏷️ Đã trang bị ${state.equippedTitle}`,'success')})}
  function eventStore(){return v5Read(V5_STORAGE.events,DEFAULT_EVENTS)}function saveEventStore(v){v5Write(V5_STORAGE.events,v)}
  async function syncCloudEvents(){if(!fbDb||state.eventCloudSynced)return;state.eventCloudSynced=true;try{const snap=await fbDb.collection('events').limit(50).get();if(!snap.size)return;const cloud=snap.docs.map(d=>d.data());const map=new Map(eventStore().map(e=>[e.id,e]));cloud.forEach(e=>map.set(e.id,e));saveEventStore(Array.from(map.values()));if(state.route==='events'){const hash=location.hash;renderEvents();if(location.hash!==hash)location.hash=hash}}catch(err){state.eventCloudSynced=false;console.warn('cloud event sync failed',err)}}
  async function eventLeaderboard(eventId){if(!fbDb)return[];try{const s=await fbDb.collection('eventResults').where('eventId','==',eventId).orderBy('timeMs','asc').limit(100).get();return s.docs.map(d=>d.data())}catch{return[]}}
  function eventMedal(e,t,c){if(!c)return null;if(t<e.medalThresholds.lightning)return'lightning';if(t<e.medalThresholds.gold)return'gold';if(t<e.medalThresholds.silver)return'silver';return'bronze'}
  async function recordEventResult(e,t,splits,completed){const uid=fbAuth?.currentUser?.uid;if(!uid||!fbDb)return;const ref=fbDb.collection('eventResults').doc(`${e.id}_${uid}`),payload={eventId:e.id,uid,displayName:state.currentUser?.name||'Runner',photoURL:state.currentUser?.photoURL||'',timeMs:Math.floor(t),completed:Boolean(completed),challenges:state.eventSession?.stage+1||e.challengeCount,splits:(splits||[]).slice(0,12),updatedAt:firebase.firestore.FieldValue.serverTimestamp()};try{const old=await ref.get();if(old.exists&&old.data().completed&&old.data().timeMs<=payload.timeMs)return;await ref.set(payload,{merge:true})}catch(err){console.warn(err)}}
  function renderEvents(){syncCloudEvents();const es=eventStore(),live=es.filter(e=>e.status==='LIVE');const cards=es.map(e=>`<article class="event-card ${e.status.toLowerCase()}"><div class="event-card-hero"><div class="event-icon">${e.icon}</div><div><span class="event-status ${e.status.toLowerCase()}">${e.status}</span><h3>${escapeHtml(e.name)}</h3><p>${escapeHtml(e.description)}</p></div></div><div class="event-meta"><span>${e.challengeCount} CHALLENGES</span><span>${formatMs(e.timeLimitMs)} LIMIT</span><span>v${e.version}</span></div><div class="event-reward"><strong>🏷️ ${escapeHtml(e.titleReward)}</strong><span>⚡ Event Exclusive</span></div><div class="event-actions">${e.status==='LIVE'?`<button class="primary-btn start-event-btn" data-event="${e.id}">▶ Start Event</button>`:'<button class="secondary-btn">🏆 Archived</button>'}<button class="secondary-btn event-board-btn" data-event="${e.id}">📊 Leaderboard</button></div></article>`).join('');view.innerHTML=`<section class="view page-shell"><div class="page-head"><div class="page-title"><button class="nav-btn back-btn" id="eventsBackBtn">← Menu</button><div><h2>Event Center</h2><div class="page-subtitle">Live Event → Close → Announce → Archive</div></div></div>${state.adminRole!=='user'?'<button class="primary-btn" id="eventAdminBtn">🛡️ Event Manager</button>':''}</div><div class="page-content"><div class="event-feature-strip"><span class="eyebrow">LIVE EVENTS</span><strong>${live.length}</strong><span>Event đang mở</span><span class="event-rule-chip">Leaderboard riêng từng Event</span></div><div class="event-grid">${cards||'<div class="ai-empty">Chưa có Event.</div>'}</div><div id="eventBoardMount"></div></div></section>`;$('eventsBackBtn').onclick=()=>go('menu');$('eventAdminBtn')?.addEventListener('click',()=>go('admin'));document.querySelectorAll('.start-event-btn').forEach(b=>b.onclick=()=>startEvent(b.dataset.event));document.querySelectorAll('.event-board-btn').forEach(b=>b.onclick=()=>showEventBoard(b.dataset.event))}
  async function showEventBoard(id){const e=eventStore().find(x=>x.id===id),m=$('eventBoardMount');if(!e||!m)return;m.innerHTML='<div class="loading-card">Loading leaderboard…</div>';const rows=await eventLeaderboard(id);const finalRows=rows.length?rows:(e.finalTop||[]);m.innerHTML=`<section class="event-leaderboard"><div class="rank-section-head"><div><span class="eyebrow">EVENT LEADERBOARD</span><h3>${escapeHtml(e.icon+' '+e.name)}</h3></div></div><table><thead><tr><th>#</th><th>Runner</th><th>Time</th><th>Progress</th></tr></thead><tbody>${finalRows.length?finalRows.map((r,i)=>`<tr><td>${i<3?['🥇','🥈','🥉'][i]:i+1}</td><td><div class="runner-cell"><img src="${escapeHtml(r.photoURL||'')}" referrerpolicy="no-referrer"><strong>${escapeHtml(r.displayName||'Runner')}</strong></div></td><td>${r.completed?formatMs(r.timeMs):'DNF'}</td><td>${r.challenges}/${e.challengeCount}</td></tr>`).join(''):'<tr><td colspan="4">Chưa có kết quả.</td></tr>'}</tbody></table></section>`}
  function startEvent(id){const e=eventStore().find(x=>x.id===id);if(!e||e.status!=='LIVE'){showToast('Event hiện không mở.','error');return}if(!state.currentUser){openAuth('login');return}state.eventSession={eventId:id,event:e,stage:0,totalStartAt:0,splits:[],lastStageStart:0};stopRankAudio();go('speedrun');setTimeout(startEventRunInternal,80)}
  function pickEventChallenge(){const all=allChallenges(),choices=all.filter(c=>c.id!==state.challengeBase?.id),c=choices[Math.floor(Math.random()*Math.max(1,choices.length))]||all[0];state.language=c.language;state.challengeIndex=Math.max(0,challengeSet(state.language).findIndex(x=>x.id===c.id));state.challengeBase=c;state.challenge=createVariant(c);
    const stage=state.eventSession?.stage||0, pool=(VARIANT_MUTATIONS[c.id]||[]).filter(([from])=>state.challenge.broken.includes(from));
    const extraCount=Math.min(pool.length, stage<2?0:stage<5?1:stage<8?2:3);
    for(let i=0;i<extraCount;i++){const entry=pool[Math.floor(Math.random()*pool.length)];if(entry&&state.challenge.broken.includes(entry[0])){state.challenge.broken=state.challenge.broken.replace(entry[0],entry[1]);state.challenge.bugReasons=(state.challenge.bugReasons||[]).concat(entry[2])}}
    state.challenge.bugLines=diffLines(state.challenge.solution,state.challenge.broken);state.challenge.bugCount=Math.max(1,Math.min(7,state.challenge.bugLines.length||state.challenge.bugCount||1));state.challengeVariantSeed=state.challenge.seed;state.challenge.eventStage=stage+1;state.challenge.eventDifficulty=stage<2?'WARMUP':stage<5?'RISING':stage<8?'EXPERT':'FINAL BOSS';configureCurrentEditor();updateChallengeUi();updateTimer();renderChallengeList()}
  function startEventRunInternal(){if(!state.eventSession||!state.editor)return;pickEventChallenge();state.eventSession.totalStartAt=performance.now();state.eventSession.lastStageStart=state.eventSession.totalStartAt;state.running=true;state.finishing=false;state.activeRunId+=1;state.finalizedRunId=0;setReadOnly(false);updateActionButtons();setOutput(`⚡ ${state.eventSession.event.name}
CHALLENGE 1/${state.eventSession.event.challengeCount}
ONE CONTINUOUS RUN · 5:00 LIMIT`);pushRunFeed('EVENT START · '+state.eventSession.event.name,'info');state.rafId=requestAnimationFrame(ts=>timerFrame(ts,state.activeRunId))}
  function timerFrameV5(now,runId){if(!state.running||runId!==state.activeRunId)return;if(state.eventSession){state.elapsedMs=Math.min(now-state.eventSession.totalStartAt,state.eventSession.event.timeLimitMs);updateTimer();if(state.elapsedMs>=state.eventSession.event.timeLimitMs){finishRun('Event timeout.',true,runId);return}state.rafId=requestAnimationFrame(ts=>timerFrameV5(ts,runId));return}state.elapsedMs=Math.min(now-state.startAt,state.challenge.timeLimitMs);updateTimer();if(state.elapsedMs>=state.challenge.timeLimitMs){finishRun('Time limit reached.',true,runId);return}state.rafId=requestAnimationFrame(ts=>timerFrameV5(ts,runId))}
  timerFrame=timerFrameV5;
  const legacyFinishRunV5=finishRun;
  finishRun=async function(reason,timedOut=false,runId=state.activeRunId){if(!state.eventSession){const h=state.hintsUsed;await legacyFinishRunV5(reason,timedOut,runId);updateAchievements();if(state.elapsedMs<30000&&!timedOut)updateAchievementForRun(true,state.elapsedMs);state.hintsUsed=h;return}if(!state.running||state.finishing||runId!==state.activeRunId)return;state.finishing=true;state.running=false;state.finalizedRunId=runId;if(state.rafId)cancelAnimationFrame(state.rafId);state.rafId=null;const now=performance.now(),total=timedOut?state.eventSession.event.timeLimitMs:now-state.eventSession.totalStartAt,stageTime=now-state.eventSession.lastStageStart,correct=!timedOut&&normalizeCode(state.editor.getValue())===normalizeCode(state.challenge.solution);if(correct){state.eventSession.splits.push({stage:state.eventSession.stage+1,totalMs:total,stageMs:stageTime,challengeId:state.challengeBase.id});state.eventSession.stage++;runBeep('pass');pushRunFeed(`EVENT CLEAR ${state.eventSession.stage}/${state.eventSession.event.challengeCount} · ${formatMs(total)}`,'success');if(state.eventSession.stage>=state.eventSession.event.challengeCount){const e=state.eventSession.event,medal=eventMedal(e,total,true);await recordEventResult(e,total,state.eventSession.splits,true);if(e.id==='ishow-v1'&&total<300000){const p=v5Progress();p.stats.ishow=(p.stats.ishow||0)+1;v5SaveProgress(p);updateAchievements()}renderEventFinishCard(e,total,medal,true);setOutput(`⚡ EVENT CLEARED!
${e.name}
10/${e.challengeCount}
TIME ${formatMs(total)}`);showToast(total<300000?'🏆 SUB-5:00 · IShow⚡ title unlocked!':'EVENT CLEAR','success');state.eventSession=null;state.finishing=false;setReadOnly(true);updateActionButtons();return}pickEventChallenge();state.eventSession.lastStageStart=performance.now();state.running=true;state.finishing=false;state.activeRunId+=1;setReadOnly(false);setOutput(`⚡ ${state.eventSession.event.name}
CHALLENGE ${state.eventSession.stage+1}/${state.eventSession.event.challengeCount}
TIME ${formatMs(total)}`);updateActionButtons();state.rafId=requestAnimationFrame(ts=>timerFrameV5(ts,state.activeRunId));return}const e=state.eventSession;await recordEventResult(e,total,e.splits,false);renderEventFinishCard(e,total,null,false,e.stage);runBeep('fail');setOutput(`${timedOut?'TIMEOUT':'EVENT FAILED'}
PROGRESS ${e.stage}/${e.event.challengeCount}
TIME ${formatMs(total)}`);state.eventSession=null;state.finishing=false;setReadOnly(true);updateActionButtons()}
  function renderEventFinishCard(e,t,medal,completed,count){if(!$('resultsBody'))return;const splits=(state.eventSession?.splits||[]).map(s=>`<div><span>CH${s.stage}</span><strong>${formatMs(s.stageMs)}</strong></div>`).join('');$('resultsBody').innerHTML=`<div class="event-finish-card ${completed?'completed':'failed'}"><span class="eyebrow">${completed?'EVENT CLEARED':'EVENT OVER'}</span><h3>${escapeHtml(e.icon+' '+e.name)}</h3><strong>${completed?formatMs(t):`${count||0}/${e.challengeCount}`}</strong><p>${completed?(t<300000?'🏆 Lightning condition reached.':'Run complete.'):'Try again and beat your PB.'}</p>${medal?`<div class="event-medal ${medal}">${medal.toUpperCase()} MEDAL</div>`:''}${completed&&splits?`<div class="event-splits">${splits}</div>`:''}</div>`;switchPanel('results')}
  const legacyRenderMenuV5=renderMenu;renderMenu=function(){legacyRenderMenuV5();const grid=document.querySelector('.menu-grid');if(!grid)return;const add=(id,icon,title,text,route)=>{if(document.getElementById(id))return;const b=document.createElement('button');b.id=id;b.className='feature-card';b.innerHTML=`<div class="feature-icon">${icon}</div><h3>${title}</h3><p>${text}</p><span class="feature-arrow">→</span>`;b.onclick=()=>go(route);grid.appendChild(b)};add('menuEventsBtn','🎪','Events','Event giới hạn thời gian, leaderboard riêng và reward độc quyền.','events');add('menuAchievementsBtn','🏅','Achievements','Unlock thành tựu để nhận và trang bị title.','achievements');if(state.adminRole!=='user')add('menuAdminBtn','🛡️','Admin Control','Quản lý Event và nội dung game.','admin')}
  const legacyRenderHeaderV5=renderHeader;renderHeader=function(){if(state.currentUser)state.equippedTitle=localStorage.getItem(`bugSpeedrunnerEquippedTitle_${v5Uid()}`)||'';legacyRenderHeaderV5();const top=document.querySelector('.top-actions');if(!top)return;if(!document.getElementById('topEventsBtn')){const b=document.createElement('button');b.id='topEventsBtn';b.className='nav-btn';b.textContent='Events';b.onclick=()=>go('events');top.appendChild(b)}if(!document.getElementById('topAchievementsBtn')){const b=document.createElement('button');b.id='topAchievementsBtn';b.className='nav-btn';b.textContent='🏅 Ach';b.onclick=()=>go('achievements');top.appendChild(b)}if(state.adminRole!=='user'){let b=document.getElementById('topAdminBtn');if(!b){b=document.createElement('button');b.id='topAdminBtn';b.className='nav-btn admin-nav-btn';b.textContent='🛡️ Admin';b.onclick=()=>go('admin');top.appendChild(b)}}else document.getElementById('topAdminBtn')?.remove()}
  function renderAdmin(){if(state.adminRole==='user'){showToast('Bạn không có quyền Admin.','error');go('menu');return}const es=eventStore();view.innerHTML=`<section class="view page-shell"><div class="page-head"><div class="page-title"><button class="nav-btn back-btn" id="adminBackBtn">← Menu</button><div><h2>Admin Control Center</h2><div class="page-subtitle">Draft → Publish → Live → Close → Announce → Archive</div></div></div><span class="admin-role-chip">${escapeHtml(state.adminRole.toUpperCase())}</span></div><div class="page-content"><div class="admin-dashboard"><div class="admin-stat"><small>EVENTS</small><strong>${es.length}</strong></div><div class="admin-stat"><small>LIVE</small><strong>${es.filter(e=>e.status==='LIVE').length}</strong></div><div class="admin-stat"><small>ACHIEVEMENTS</small><strong>${ACHIEVEMENT_DEFS.length}</strong></div><div class="admin-stat"><small>TITLES</small><strong>${new Set(ACHIEVEMENT_DEFS.map(a=>a.title)).size}</strong></div></div><div class="admin-toolbar"><button class="primary-btn" id="newEventBtn">＋ New Event</button><button class="secondary-btn" id="refreshAdminBtn">↻ Refresh</button></div><div class="admin-event-list">${es.map(e=>`<article class="admin-event-card"><div><span class="event-status ${e.status.toLowerCase()}">${e.status}</span><h3>${escapeHtml(e.icon+' '+e.name)} <small>v${e.version}</small></h3><p>${escapeHtml(e.description)}</p></div><div class="admin-event-actions">${e.status==='DRAFT'?'<button class="secondary-btn edit-event">✏️ Edit</button><button class="secondary-btn publish-event">📢 Publish</button>':''}${e.status==='LIVE'?'<button class="danger-btn close-event">🔒 Close</button>':''}${e.status==='CLOSED'?'<button class="primary-btn announce-event">📣 Announce</button>':''}${e.status==='ANNOUNCED'?'<button class="secondary-btn archive-event">📦 Archive</button>':''}<button class="secondary-btn duplicate-event">♻ Duplicate</button></div><div class="admin-event-meta" data-event="${e.id}">ID ${escapeHtml(e.id)} · ${e.challengeCount} challenges · reward ${escapeHtml(e.titleReward)}</div></article>`).join('')}</div></div></section>`;$('adminBackBtn').onclick=()=>go('menu');$('newEventBtn').onclick=()=>adminCreateEvent();$('refreshAdminBtn').onclick=renderAdmin;document.querySelectorAll('.edit-event').forEach(b=>b.onclick=()=>adminEditEvent(b));document.querySelectorAll('.publish-event').forEach(b=>b.onclick=()=>adminTransition(b,'LIVE'));document.querySelectorAll('.close-event').forEach(b=>b.onclick=()=>adminTransition(b,'CLOSED'));document.querySelectorAll('.announce-event').forEach(b=>b.onclick=()=>adminTransition(b,'ANNOUNCED'));document.querySelectorAll('.archive-event').forEach(b=>b.onclick=()=>adminTransition(b,'ARCHIVED'));document.querySelectorAll('.duplicate-event').forEach(b=>b.onclick=()=>adminDuplicate(b))}
  async function saveCloudEvent(e){if(!fbDb||state.adminRole==='user')return;try{await fbDb.collection('events').doc(e.id).set(e,{merge:true})}catch(err){console.warn('event cloud save failed',err);showToast(`Cloud Event: ${err.message}`,'error')}}
  function adminCreateEvent(){const name=prompt('Tên Event mới:','NEW EVENT');if(!name)return;const e={id:'event-'+Date.now().toString(36),name:name.trim().slice(0,60),icon:'🎪',status:'DRAFT',version:1,description:'Custom event',challengeCount:10,timeLimitMs:300000,titleReward:name.trim().slice(0,30),achievementReward:null,medalThresholds:{bronze:420000,silver:360000,gold:300000,lightning:270000},difficulty:'rising',boss:true};const es=eventStore();es.push(e);saveEventStore(es);saveCloudEvent(e);renderAdmin();showToast('Draft Event đã tạo.','success')}
  function adminEditEvent(btn){const id=btn.closest('.admin-event-card').querySelector('.admin-event-meta').dataset.event,es=eventStore(),e=es.find(x=>x.id===id);if(!e)return;const name=prompt('Tên Event:',e.name);if(name===null)return;const desc=prompt('Mô tả:',e.description);if(desc===null)return;const count=Number(prompt('Số challenge:',e.challengeCount));if(!Number.isFinite(count)||count<1||count>30)return showToast('Số challenge phải từ 1 đến 30.','error');const limit=Number(prompt('Tổng thời gian (giây):',Math.round(e.timeLimitMs/1000)));if(!Number.isFinite(limit)||limit<30||limit>3600)return showToast('Thời gian phải từ 30 đến 3600 giây.','error');const reward=prompt('Title reward:',e.titleReward);if(reward===null)return;e.name=name.trim().slice(0,60)||e.name;e.description=desc.trim().slice(0,240);e.challengeCount=Math.floor(count);e.timeLimitMs=Math.floor(limit*1000);e.titleReward=reward.trim().slice(0,40)||e.titleReward;saveEventStore(es);saveCloudEvent(e);renderAdmin();showToast('Event Draft đã cập nhật.','success')}
  async function adminTransition(btn,status){const id=btn.closest('.admin-event-card').querySelector('.admin-event-meta').dataset.event,es=eventStore(),e=es.find(x=>x.id===id);if(!e)return;if(status==='CLOSED'&&!confirm(`Đóng Event ${e.name}? Leaderboard sẽ freeze.`))return;if(status==='CLOSED'){try{const top=await eventLeaderboard(e.id);e.finalTop=top.slice(0,10);e.finalizedAt=Date.now()}catch{e.finalTop=[]}}e.status=status;if(status==='ARCHIVED')e.archivedAt=Date.now();if(status==='ANNOUNCED')e.resultsAnnouncedAt=Date.now();saveEventStore(es);await saveCloudEvent(e);renderAdmin();showToast(`${e.name}: ${status}`,'success')}
  function adminDuplicate(btn){const id=btn.closest('.admin-event-card').querySelector('.admin-event-meta').dataset.event,e=eventStore().find(x=>x.id===id);if(!e)return;const copy={...e,id:`${e.id}-v${(e.version||1)+1}-${Date.now().toString(36).slice(-4)}`,version:(e.version||1)+1,name:e.name+' II',status:'DRAFT',resultsAnnouncedAt:null,archivedAt:null,finalTop:null};const es=eventStore();es.push(copy);saveEventStore(es);saveCloudEvent(copy);renderAdmin();showToast('Đã clone Event thành Draft mới.','success')}
  const legacyOpenProfileV5=openProfile;openProfile=function(key,self=false){legacyOpenProfileV5(key,self);setTimeout(()=>{const host=document.querySelector('#profileRoot .profile-modal');if(host&&!host.querySelector('.profile-title-showcase')){const t=state.equippedTitle||localStorage.getItem(`bugSpeedrunnerEquippedTitle_${v5Uid()}`)||'';const d=document.createElement('div');d.className='profile-title-showcase';d.innerHTML=`<span class="eyebrow">EQUIPPED TITLE</span><strong>${escapeHtml(t||'No title equipped')}</strong>`;host.querySelector('.profile-grid')?.after(d)}},0)};
  state.equippedTitle=localStorage.getItem(`bugSpeedrunnerEquippedTitle_${v5Uid()}`)||'';

  const oldAuthEnv=authEnvironmentMessage;
  // Admin role is derived from Firebase ID token custom claims, never localStorage.
  const oldInitFirebase=initFirebase;
  initFirebase=function(){oldInitFirebase();if(fbAuth)fbAuth.onAuthStateChanged(async u=>{state.adminRole='user';if(u){try{const t=await u.getIdTokenResult();state.adminRole=t.claims.role||'user'}catch{} }renderHeader()})};
  const oldRoute=renderRoute;
  renderRoute=function(){stopRankAudio();document.getElementById('rankReviewRoot')?.remove();document.getElementById('profileRoot')?.remove();if(state.route==='speedrun'&&state.running)stopRun(false);if(state.eventSession&&state.route!=='speedrun')state.eventSession=null;state.route=routeFromHash();state.currentUser=currentUser();renderHeader();if(state.route!=='speedrun'&&state.editor){state.editor.dispose();state.editor=null;state.monacoReady=false;state.challenge=null}if(state.route==='menu')renderMenu();else if(state.route==='speedrun')renderSpeedrun();else if(state.route==='rank')renderRank();else if(state.route==='leaderboard')renderLeaderboard();else if(state.route==='academy')renderAcademy();else if(state.route==='achievements')renderAchievements();else if(state.route==='events')renderEvents();else if(state.route==='admin')renderAdmin();if(window.lucide)window.lucide.createIcons()};
  updateAchievements();

  boot();
})();