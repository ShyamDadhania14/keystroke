/* ============================================================
   Keystroke — script.js
   Typing race engine: text gen, live stats, timer, combo,
   AI ghost opponent race, results graph, leaderboard, sound
   ============================================================ */

// ─────────────────────────────────────────────
// TEXT BANKS
// ─────────────────────────────────────────────
const QUOTES = [
  "The only way to do great work is to love what you do and never settle for less than your best effort.",
  "Success is not final and failure is not fatal, it is the courage to continue that truly counts in the end.",
  "In the middle of every difficulty lies opportunity waiting patiently for someone bold enough to find it.",
  "The future belongs to those who believe in the beauty of their dreams and act on them every single day.",
  "Simplicity is the ultimate sophistication, and it takes real discipline to remove what does not matter.",
  "Whether you think you can or you think you cannot, you are absolutely right about your own potential.",
  "The journey of a thousand miles begins with a single step taken even when the path ahead is unclear.",
  "Creativity is intelligence having fun, and the best ideas often arrive when you stop trying so hard.",
  "What lies behind us and what lies before us are tiny matters compared to what lies within us today.",
  "Quality means doing it right when no one is looking and caring about details others tend to ignore.",
];

const COMMON_WORDS = [
  "the","be","to","of","and","a","in","that","have","it","for","not","on","with","he",
  "as","you","do","at","this","but","his","by","from","they","we","say","her","she","or",
  "an","will","my","one","all","would","there","their","what","so","up","out","if","about",
  "who","get","which","go","me","when","make","can","like","time","no","just","him","know",
  "take","people","into","year","your","good","some","could","them","see","other","than",
  "then","now","look","only","come","its","over","think","also","back","after","use","two",
  "how","our","work","first","well","way","even","new","want","because","any","these","give",
];

const CODE_SNIPPETS = [
  "function add(a, b) { return a + b; }",
  "const items = arr.filter(x => x > 0).map(x => x * 2);",
  "for (let i = 0; i < n; i++) { sum += i; }",
  "if (user && user.isActive) { return user.name; }",
  "const data = await fetch(url).then(r => r.json());",
  "class Node { constructor(val) { this.val = val; this.next = null; } }",
  "export default function App() { return <div>Hello</div>; }",
  "const sorted = [...arr].sort((a, b) => a - b);",
  "try { doWork(); } catch (e) { console.error(e); }",
  "const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };",
];

const PUNCT_QUOTES = [
  "\"Wait,\" she said, \"didn't you already finish that — or am I mistaken?\"",
  "Three things matter: speed, accuracy, and consistency (in that exact order).",
  "He paused; the silence said more than any words could've managed.",
  "\"It's not about perfection,\" the coach explained, \"it's about progress, day by day.\"",
  "Items needed: pens, paper, a laptop — and, most importantly, patience.",
  "Well, that's... unexpected. Didn't see that coming, did you?",
  "The recipe called for: 2 cups flour, 1 tsp salt, & a pinch of patience.",
  "\"Are you sure?\" he asked. \"Because once we start, there's no going back.\"",
];

// ─────────────────────────────────────────────
// OPPONENTS
// ─────────────────────────────────────────────
const OPPONENTS = {
  none:      { label: 'Solo',          wpm: 0,   emoji: '' },
  turtle:    { label: '🐢 Turtle',     wpm: 30,  emoji: '🐢' },
  rival:     { label: '🦊 Rival',      wpm: 60,  emoji: '🦊' },
  cyborg:    { label: '🤖 Cyborg',     wpm: 90,  emoji: '🤖' },
  lightning: { label: '⚡ Lightning',  wpm: 120, emoji: '⚡' },
  ghost:     { label: '👻 Your PB',    wpm: 0,   emoji: '👻' }, // wpm computed from history
};

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let state = {
  mode: 'quotes',
  timeLimit: 30,
  timeLeft: 30,
  opponent: 'rival',
  started: false,
  finished: false,
  text: '',
  typed: [],
  cursorIndex: 0,
  errors: 0,
  totalKeystrokes: 0,
  correctKeystrokes: 0,
  combo: 0,
  bestCombo: 0,
  startTime: null,
  timerInterval: null,
  wpmHistory: [],
  secondTick: 0,
  oppProgress: 0,     // 0-100 %
  youProgress: 0,
};

let bestWpmEver   = parseInt(localStorage.getItem('keystrokeBestWpm') || '0');
let racesPlayed   = parseInt(localStorage.getItem('keystrokeRaces') || '0');
let leaderboard   = JSON.parse(localStorage.getItem('keystrokeLB') || '[]');
let winRecord     = JSON.parse(localStorage.getItem('keystrokeWinRecord') || '{"wins":0,"losses":0}');
let pbWpmHistory  = JSON.parse(localStorage.getItem('keystrokePBHistory') || 'null'); // best run's per-second wpm
let soundOn       = localStorage.getItem('keystrokeSound') !== 'off';

// ─────────────────────────────────────────────
// AUDIO (Web Audio API — no files needed)
// ─────────────────────────────────────────────
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTick(isError) {
  if (!soundOn) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = isError ? 160 : 720;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
    osc.stop(ctx.currentTime + 0.06);
  } catch {}
}

function playFinishChime(won) {
  if (!soundOn) return;
  try {
    const ctx = getAudioCtx();
    const notes = won ? [523.25, 659.25, 784.0, 1046.5] : [392.0, 329.6, 261.6];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.value = 0.07;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.12;
      osc.start(t);
      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.stop(t + 0.3);
    });
  } catch {}
}

function toggleSound() {
  soundOn = !soundOn;
  localStorage.setItem('keystrokeSound', soundOn ? 'on' : 'off');
  const btn = document.getElementById('sound-toggle');
  btn.textContent = soundOn ? '🔊' : '🔇';
  btn.classList.toggle('muted', !soundOn);
}

// ─────────────────────────────────────────────
// DOM REFS
// ─────────────────────────────────────────────
const typeZone       = document.getElementById('type-zone');
const typeText        = document.getElementById('type-text');
const hiddenInput      = document.getElementById('hidden-input');
const typeZoneHint    = document.getElementById('type-zone-hint');
const resultsOverlay   = document.getElementById('results-overlay');
const runnerYou       = document.getElementById('runner-you');
const runnerOpp       = document.getElementById('runner-opp');
const oppLane          = document.getElementById('opp-lane');
const oppLaneLabel    = document.getElementById('opp-lane-label');
const raceTrackWrap   = document.getElementById('race-track-wrap');

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
function init() {
  document.getElementById('best-wpm').textContent = bestWpmEver;
  document.getElementById('races-played').textContent = racesPlayed;
  document.getElementById('win-record').textContent = `${winRecord.wins}–${winRecord.losses}`;

  const soundBtn = document.getElementById('sound-toggle');
  soundBtn.textContent = soundOn ? '🔊' : '🔇';
  soundBtn.classList.toggle('muted', !soundOn);

  updateOpponentLane();
  loadNewText();
  renderLeaderboard();

  typeZone.addEventListener('click', () => hiddenInput.focus());
  hiddenInput.addEventListener('input', onInput);
  hiddenInput.addEventListener('keydown', onKeyDown);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      restartRace();
    }
    if (e.key === 'Escape') {
      window._escPressed = true;
      setTimeout(() => window._escPressed = false, 1500);
    }
    if (e.key === 'Enter' && window._escPressed) {
      restartRace();
      window._escPressed = false;
    }
    if (e.key === 'Escape' && resultsOverlay.classList.contains('show')) {
      closeResults();
    }
  });

  hiddenInput.focus();
}

// ─────────────────────────────────────────────
// TEXT GENERATION
// ─────────────────────────────────────────────
function generateText(mode) {
  if (mode === 'quotes') return pickRandom(QUOTES);
  if (mode === 'words') {
    const words = [];
    for (let i = 0; i < 60; i++) words.push(pickRandom(COMMON_WORDS));
    return words.join(' ');
  }
  if (mode === 'code') {
    const snippets = [];
    for (let i = 0; i < 3; i++) snippets.push(pickRandom(CODE_SNIPPETS));
    return snippets.join('  ');
  }
  if (mode === 'punctuation') return pickRandom(PUNCT_QUOTES);
  return pickRandom(QUOTES);
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ─────────────────────────────────────────────
// LOAD NEW TEXT
// ─────────────────────────────────────────────
function loadNewText() {
  state.text = generateText(state.mode);
  state.typed = new Array(state.text.length).fill(null);
  state.cursorIndex = 0;
  renderText();
}

function renderText() {
  typeText.innerHTML = state.text.split('').map((ch, i) => {
    let cls = 't-char';
    if (state.typed[i] === 'correct') cls += ' correct';
    else if (state.typed[i] === 'incorrect') cls += ' incorrect';
    if (i === state.cursorIndex) cls += ' current';
    const displayChar = ch === ' ' ? '&nbsp;' : escHtml(ch);
    return `<span class="${cls}">${displayChar}</span>`;
  }).join('');
}

// ─────────────────────────────────────────────
// MODE / TIME / OPPONENT SWITCHING
// ─────────────────────────────────────────────
function setMode(btn) {
  document.querySelectorAll('.mode-btn[data-mode]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.mode = btn.dataset.mode;
  restartRace();
}

function setTime(btn) {
  document.querySelectorAll('.mode-btn[data-time]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.timeLimit = parseInt(btn.dataset.time);
  restartRace();
}

function setOpponent(btn) {
  document.querySelectorAll('.opp-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.opponent = btn.dataset.opp;
  updateOpponentLane();
  restartRace();
}

function updateOpponentLane() {
  if (state.opponent === 'none') {
    raceTrackWrap.classList.add('hidden');
    return;
  }
  raceTrackWrap.classList.remove('hidden');

  if (state.opponent === 'ghost') {
    if (!pbWpmHistory || !pbWpmHistory.length) {
      oppLaneLabel.textContent = '👻 No PB yet';
      oppLane.style.opacity = '0.4';
    } else {
      oppLaneLabel.textContent = '👻 Your PB';
      oppLane.style.opacity = '1';
    }
    runnerOpp.textContent = '👻';
  } else {
    const opp = OPPONENTS[state.opponent];
    oppLaneLabel.textContent = opp.label;
    oppLane.style.opacity = '1';
    runnerOpp.textContent = opp.emoji;
  }
}

// ─────────────────────────────────────────────
// INPUT HANDLING
// ─────────────────────────────────────────────
function onKeyDown(e) {
  if (e.key === 'Backspace') {
    e.preventDefault();
    handleBackspace();
  }
}

function onInput(e) {
  const val = hiddenInput.value;
  hiddenInput.value = '';
  if (!val) return;
  for (const ch of val) handleChar(ch);
}

function handleChar(ch) {
  if (state.finished) return;
  if (state.cursorIndex >= state.text.length) return;

  if (!state.started) startRace();

  const expected = state.text[state.cursorIndex];
  state.totalKeystrokes++;

  if (ch === expected) {
    state.typed[state.cursorIndex] = 'correct';
    state.correctKeystrokes++;
    state.combo++;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    playTick(false);
  } else {
    state.typed[state.cursorIndex] = 'incorrect';
    state.errors++;
    state.combo = 0;
    playTick(true);
  }

  state.cursorIndex++;
  document.getElementById('live-combo').textContent = state.combo + '×';
  document.getElementById('live-errors').textContent = state.errors;
  document.getElementById('streak-count') && (document.getElementById('streak-count').textContent = state.bestCombo);

  renderText();
  scrollToCaret();
  updateLiveAccuracy();
  updateYouRunner();

  if (state.cursorIndex >= state.text.length) extendText();
}

function handleBackspace() {
  if (state.finished || state.cursorIndex === 0) return;
  state.cursorIndex--;
  state.typed[state.cursorIndex] = null;
  renderText();
  scrollToCaret();
}

function extendText() {
  const more = generateText(state.mode);
  state.text += ' ' + more;
  state.typed = state.typed.concat(new Array(more.length + 1).fill(null));
  renderText();
}

function scrollToCaret() {
  const current = typeText.querySelector('.current');
  if (current) current.scrollIntoView({ block: 'nearest', behavior: 'auto' });
}

// ─────────────────────────────────────────────
// RACE LIFECYCLE
// ─────────────────────────────────────────────
function startRace() {
  state.started = true;
  state.startTime = Date.now();
  state.timeLeft = state.timeLimit;
  state.secondTick = 0;
  state.wpmHistory = [];

  document.getElementById('live-time').textContent = state.timeLeft;

  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    state.secondTick++;
    document.getElementById('live-time').textContent = Math.max(0, state.timeLeft);

    const elapsedMin = state.secondTick / 60;
    const wpm = elapsedMin > 0 ? Math.round((state.correctKeystrokes / 5) / elapsedMin) : 0;
    state.wpmHistory.push({ t: state.secondTick, wpm });
    document.getElementById('live-wpm').textContent = wpm;

    updateOppRunner();

    if (state.timeLeft <= 0) finishRace();
  }, 1000);
}

function updateLiveAccuracy() {
  const acc = state.totalKeystrokes > 0
    ? Math.round((state.correctKeystrokes / state.totalKeystrokes) * 100)
    : 100;
  document.getElementById('live-acc').textContent = acc + '%';
}

// Target distance for the race = a fixed word count goal so runners can reach 100%
const RACE_TARGET_WORDS = 40; // both racers aim toward this many words-equivalent

function updateYouRunner() {
  if (state.opponent === 'none') return;
  const wordsTyped = state.correctKeystrokes / 5;
  state.youProgress = Math.min(100, (wordsTyped / RACE_TARGET_WORDS) * 100);
  runnerYou.style.left = `calc(${state.youProgress}% - 14px)`;
  if (state.youProgress >= 100) runnerYou.style.left = `calc(100% - 26px)`;
}

function updateOppRunner() {
  if (state.opponent === 'none') return;

  let oppWpm;
  if (state.opponent === 'ghost') {
    if (pbWpmHistory && pbWpmHistory.length) {
      const point = pbWpmHistory[Math.min(state.secondTick - 1, pbWpmHistory.length - 1)];
      oppWpm = point ? point.wpm : 0;
    } else {
      oppWpm = 0;
    }
  } else {
    oppWpm = OPPONENTS[state.opponent].wpm;
  }

  // Opponent moves at constant wpm pace toward the same word target
  const elapsedMin = state.secondTick / 60;
  const oppWords = oppWpm * elapsedMin;
  state.oppProgress = Math.min(100, (oppWords / RACE_TARGET_WORDS) * 100);
  runnerOpp.style.left = `calc(${state.oppProgress}% - 14px)`;
  if (state.oppProgress >= 100) runnerOpp.style.left = `calc(100% - 26px)`;
}

function finishRace() {
  state.finished = true;
  clearInterval(state.timerInterval);

  const elapsedMin = state.secondTick / 60 || (1/60);
  const netWpm = Math.round((state.correctKeystrokes / 5) / elapsedMin);
  const rawWpm = Math.round((state.totalKeystrokes / 5) / elapsedMin);
  const acc = state.totalKeystrokes > 0
    ? Math.round((state.correctKeystrokes / state.totalKeystrokes) * 100)
    : 100;

  racesPlayed++;
  localStorage.setItem('keystrokeRaces', racesPlayed);
  document.getElementById('races-played').textContent = racesPlayed;

  let isNewPB = false;
  if (netWpm > bestWpmEver) {
    bestWpmEver = netWpm;
    isNewPB = true;
    localStorage.setItem('keystrokeBestWpm', bestWpmEver);
    document.getElementById('best-wpm').textContent = bestWpmEver;
    pbWpmHistory = state.wpmHistory;
    localStorage.setItem('keystrokePBHistory', JSON.stringify(pbWpmHistory));
  }

  // Determine race outcome vs opponent
  let outcome = null;
  if (state.opponent !== 'none') {
    const won = state.youProgress >= state.oppProgress;
    outcome = won ? 'win' : 'lose';
    if (state.opponent !== 'ghost') {
      if (won) winRecord.wins++; else winRecord.losses++;
      localStorage.setItem('keystrokeWinRecord', JSON.stringify(winRecord));
      document.getElementById('win-record').textContent = `${winRecord.wins}–${winRecord.losses}`;
    }
  }

  playFinishChime(outcome !== 'lose');
  if (outcome === 'win' || (outcome === null && isNewPB)) fireConfetti();

  showResults({
    netWpm, rawWpm, acc,
    errors: state.errors,
    chars: state.correctKeystrokes,
    combo: state.bestCombo,
    time: state.secondTick,
    outcome,
    isNewPB,
  });
}

function restartRace() {
  clearInterval(state.timerInterval);
  state.started = false;
  state.finished = false;
  state.errors = 0;
  state.totalKeystrokes = 0;
  state.correctKeystrokes = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.wpmHistory = [];
  state.secondTick = 0;
  state.timeLeft = state.timeLimit;
  state.youProgress = 0;
  state.oppProgress = 0;

  document.getElementById('live-wpm').textContent = '0';
  document.getElementById('live-acc').textContent = '100%';
  document.getElementById('live-time').textContent = state.timeLimit;
  document.getElementById('live-errors').textContent = '0';
  document.getElementById('live-combo').textContent = '0×';
  runnerYou.style.left = '0';
  runnerOpp.style.left = '0';

  closeResults();
  loadNewText();
  typeZoneHint.style.display = 'block';
  hiddenInput.focus();
}

// ─────────────────────────────────────────────
// RESULTS MODAL
// ─────────────────────────────────────────────
function showResults(stats) {
  document.getElementById('results-wpm').textContent = stats.netWpm;
  document.getElementById('results-raw').textContent = stats.rawWpm;
  document.getElementById('results-acc').textContent = stats.acc + '%';
  document.getElementById('results-chars').textContent = stats.chars;
  document.getElementById('results-errors').textContent = stats.errors;
  document.getElementById('results-combo').textContent = stats.combo;
  document.getElementById('results-time').textContent = stats.time + 's';

  const outcomeEl = document.getElementById('race-outcome');
  const outcomeIcon = document.getElementById('race-outcome-icon');
  const outcomeText = document.getElementById('race-outcome-text');

  if (stats.outcome) {
    outcomeEl.classList.remove('hidden', 'win', 'lose');
    outcomeEl.classList.add(stats.outcome);
    if (stats.outcome === 'win') {
      outcomeIcon.textContent = '🏆';
      outcomeText.textContent = state.opponent === 'ghost' ? 'You beat your personal best!' : 'You won the race!';
    } else {
      outcomeIcon.textContent = '💨';
      outcomeText.textContent = state.opponent === 'ghost' ? 'Your past self was faster this time.' : 'The opponent edged you out — try again!';
    }
  } else {
    outcomeEl.classList.add('hidden');
  }

  document.getElementById('results-title').textContent = stats.isNewPB ? '🎉 New personal best!' : 'Race complete';

  document.getElementById('results-save-row').classList.remove('hidden');
  document.getElementById('results-saved-msg').classList.add('hidden');

  drawWpmGraph();

  resultsOverlay.classList.add('show');
  window._lastResult = stats;
}

function closeResults() {
  resultsOverlay.classList.remove('show');
}

function drawWpmGraph() {
  const canvas = document.getElementById('wpm-graph');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const history = state.wpmHistory;
  if (!history.length) return;

  const maxWpm = Math.max(...history.map(p => p.wpm), 10);
  const padding = 10;

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = padding + (h - padding*2) * (i/3);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.strokeStyle = '#FBBF24';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';

  history.forEach((p, i) => {
    const x = padding + (w - padding*2) * (i / Math.max(history.length - 1, 1));
    const y = h - padding - (h - padding*2) * (p.wpm / maxWpm);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.lineTo(w - padding, h - padding);
  ctx.lineTo(padding, h - padding);
  ctx.closePath();
  ctx.fillStyle = 'rgba(251, 191, 36, 0.08)';
  ctx.fill();
}

// ─────────────────────────────────────────────
// CONFETTI (lightweight canvas burst)
// ─────────────────────────────────────────────
function fireConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.getElementById('confetti-canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');

  const colors = ['#FBBF24', '#4ADE80', '#F87171', '#F4F1EA'];
  const particles = [];
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 3,
      vx: (Math.random() - 0.5) * 12,
      vy: Math.random() * -10 - 4,
      size: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 12,
      life: 100,
    });
  }

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      if (p.life <= 0) return;
      alive = true;
      p.vy += 0.35;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life--;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, p.life / 30);
      ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
      ctx.restore();
    });
    if (alive) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  requestAnimationFrame(frame);
}

// ─────────────────────────────────────────────
// LEADERBOARD
// ─────────────────────────────────────────────
function saveResultToLeaderboard() {
  const nameInput = document.getElementById('results-name');
  const name = nameInput.value.trim() || 'Anonymous';
  const result = window._lastResult;
  if (!result) return;

  leaderboard.push({
    name,
    wpm: result.netWpm,
    acc: result.acc,
    mode: state.mode,
    time: state.timeLimit,
    ts: Date.now(),
  });

  leaderboard.sort((a, b) => b.wpm - a.wpm);
  leaderboard = leaderboard.slice(0, 10);
  localStorage.setItem('keystrokeLB', JSON.stringify(leaderboard));

  renderLeaderboard();
  document.getElementById('results-save-row').classList.add('hidden');
  document.getElementById('results-saved-msg').classList.remove('hidden');
  showToast('🏆 Saved to leaderboard!');
}

function renderLeaderboard() {
  const list = document.getElementById('lb-list');
  if (!leaderboard.length) {
    list.innerHTML = '<div class="lb-empty">Finish a race to claim the top spot ✦</div>';
    return;
  }

  list.innerHTML = leaderboard.map((entry, i) => `
    <div class="lb-item">
      <span class="lb-rank">${i + 1}</span>
      <div class="lb-info">
        <div class="lb-name">${escHtml(entry.name)}</div>
        <div class="lb-meta">${entry.acc}% acc · ${entry.mode} · ${entry.time}s</div>
      </div>
      <span class="lb-wpm">${entry.wpm}</span>
    </div>
  `).join('');
}

function clearLeaderboard() {
  if (!leaderboard.length) return;
  if (!confirm('Clear the entire leaderboard?')) return;
  leaderboard = [];
  localStorage.removeItem('keystrokeLB');
  renderLeaderboard();
  showToast('🗑 Leaderboard cleared');
}

function toggleLeaderboard() {
  document.getElementById('leaderboard-panel').classList.toggle('open');
}

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────
init();
