// YC Roulette — Game Engine
// Loads after yc_dataset.js (provides YC_STARTUPS global)

// ── CONSTANTS ─────────────────────────────────────────────────────────────

const ANCHORS = ['Airbnb','Stripe','Dropbox','DoorDash','Reddit','Coinbase','Twitch','Instacart','GitLab','Gusto'];

const FUNDING_ORDER = ['seed','<5m','5-50m','50m+'];

const FUND_VAL_MAP = {
  'seed': 'seed',
  'lt5m': '<5m',
  '5to50m': '5-50m',
  '50mplus': '50m+'
};

const FUND_DISPLAY = {
  'seed': 'Seed only',
  '<5m': 'Less than $5M',
  '5-50m': '$5M–$50M',
  '50m+': '$50M+'
};

const IND_VAL_MAP = {
  'consumer':  'Consumer',
  'fintech':   'Fintech',
  'health':    'Healthtech',
  'devtools':  'Dev Tools',
  'ecomm':     'E-commerce',
  'saas':      'Enterprise SaaS',
  'logistics': 'Logistics',
  'ai':        'AI/ML'
};

// Industry adjacency — symmetric pairs
const IND_ADJACENT = {
  'Fintech':         ['Enterprise SaaS'],
  'Enterprise SaaS': ['Fintech', 'Healthtech'],
  'Dev Tools':       ['AI/ML'],
  'AI/ML':           ['Dev Tools'],
  'E-commerce':      ['Consumer', 'Logistics'],
  'Consumer':        ['E-commerce'],
  'Logistics':       ['E-commerce'],
  'Healthtech':      ['Enterprise SaaS'],
  'Other':           []
};

const TIERS = [
  { min: 135, letter: 'S', label: 'YC partner energy' },
  { min: 105, letter: 'A', label: 'TechCrunch power reader' },
  { min: 75,  letter: 'B', label: 'VC dinner survivor' },
  { min: 0,   letter: 'C', label: 'Startup world tourist' }
];

const ONE_LINERS = {
  S: [
    "You could write the YC application for any of these.",
    "Strong Partner material. Have you considered applying to YC?",
    "This is what a good memory and bad FOMO look like.",
    "You've read every TechCrunch article from 2012 to 2018.",
    "150/150 would be suspicious. 135+ means you actually paid attention."
  ],
  A: [
    "Sharp instincts. You'd hold your own at Demo Day.",
    "Not bad. A few more reps and you're in Partner territory.",
    "You've read enough startup postmortems to be dangerous.",
    "Solid. Probably follows a few YC founders on Twitter.",
    "You know your way around a cap table."
  ],
  B: [
    "You survive the VC dinner, you just don't dominate it.",
    "Respectable. Most people can't even name 5 YC companies.",
    "Startup-adjacent. You've been to a pitch competition at least once.",
    "You know enough to be dangerous at a hackathon.",
    "Middle of the pack isn't bad when the pack is this niche."
  ],
  C: [
    "First time in the startup world? No shame.",
    "A tourist, not a local. The food's still great.",
    "The fact you finished puts you ahead of most people.",
    "You've definitely met a founder. Once. At a party.",
    "The good news: you can only go up from here."
  ]
};

// ── STATE ─────────────────────────────────────────────────────────────────

let state = {
  startups: [],
  currentIdx: 0,
  guesses: { year: null, funding: null, industry: null },
  scores: [],       // [{ year, funding, industry, total }, ...]
  totalScore: 0
};

let currentGuessStep = 0;
let html2canvasLoaded = false;
let html2canvasFailed = false;

// ── SESSION CONSTRUCTION ──────────────────────────────────────────────────

function getFoundingYear(batch) {
  return 2000 + parseInt(batch.slice(1), 10);
}

function buildSession() {
  const anchorPool = YC_STARTUPS.filter(s => ANCHORS.includes(s.name));
  const nonAnchorPool = YC_STARTUPS.filter(s => !ANCHORS.includes(s.name));

  // Shuffle helpers
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

  // Pick 1–2 anchors
  const anchorCount = Math.random() < 0.5 ? 1 : 2;
  const selectedAnchors = shuffle(anchorPool).slice(0, anchorCount);

  let session = [...selectedAnchors];
  const shuffledPool = shuffle(nonAnchorPool);

  let tries = 0;
  for (const candidate of shuffledPool) {
    if (session.length >= 5) break;
    if (++tries > 100) break;

    // Count industries already in session
    const indCount = {};
    session.forEach(s => { indCount[s.industry] = (indCount[s.industry] || 0) + 1; });

    // Industry constraint: ≤2 per industry
    if ((indCount[candidate.industry] || 0) >= 2) continue;

    // Alive/dead mix: 2–3 alive (lastActiveYear === 2025)
    const aliveCount = session.filter(s => s.lastActiveYear === 2025).length;
    const isAlive = candidate.lastActiveYear === 2025;
    if (isAlive && aliveCount >= 3) continue;
    if (!isAlive && (session.length - aliveCount) >= 3) continue;

    session.push(candidate);
  }

  // Retry exhaustion: fill remaining slots without constraints
  if (session.length < 5) {
    const used = new Set(session.map(s => s.name));
    for (const candidate of shuffledPool) {
      if (session.length >= 5) break;
      if (!used.has(candidate.name)) {
        session.push(candidate);
        used.add(candidate.name);
      }
    }
  }

  return shuffle(session).slice(0, 5);
}

// ── SCORING ENGINE ────────────────────────────────────────────────────────

function scoreYear(guess, actual) {
  const diff = Math.abs(guess - actual);
  if (diff === 0) return 10;
  if (diff <= 1) return 8;
  if (diff <= 3) return 5;
  return 1;
}

function scoreFunding(guess, actual) {
  const gi = FUNDING_ORDER.indexOf(guess);
  const ai = FUNDING_ORDER.indexOf(actual);
  if (gi === -1 || ai === -1) return 0;
  const diff = Math.abs(gi - ai);
  if (diff === 0) return 10;
  if (diff === 1) return 5;
  return 0;
}

function scoreIndustry(guess, actual) {
  if (guess === actual) return 10;
  const adjacents = IND_ADJACENT[actual] || [];
  if (adjacents.includes(guess)) return 3;
  return 0;
}

function scoreStartup(guesses, startup) {
  const year     = scoreYear(guesses.year, startup.lastActiveYear);
  const funding  = scoreFunding(guesses.funding, startup.funding);
  const industry = scoreIndustry(guesses.industry, startup.industry);
  return { year, funding, industry, total: year + funding + industry };
}

// ── DOM HELPERS ───────────────────────────────────────────────────────────

function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function updateProgressBar(screenId, doneCount) {
  const screen = document.getElementById(screenId);
  if (!screen) return;
  screen.querySelectorAll('.prog-seg').forEach((seg, i) => {
    seg.className = 'prog-seg';
    if (i < doneCount) seg.classList.add('done');
    else if (i === doneCount) seg.classList.add('partial');
  });
}

function updateRoundPill(screenId, roundNum) {
  const el = document.querySelector(`#${screenId} .round-pill`);
  if (el) el.textContent = `Round ${roundNum} / 5`;
}

function showToast(msg) {
  let toast = document.getElementById('game-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'game-toast';
    toast.style.cssText = [
      'position:fixed','bottom:24px','left:50%','transform:translateX(-50%)',
      'background:var(--ink)','color:#fff','font-family:Nunito,sans-serif',
      'font-size:13px','font-weight:700','padding:10px 20px',
      'border-radius:99px','z-index:9999','pointer-events:none',
      'transition:opacity 0.3s'
    ].join(';');
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

// ── HOME SCREEN ───────────────────────────────────────────────────────────

function initHome() {
  let highScore = null;
  try { highScore = localStorage.getItem('yc_roulette_high_score'); } catch (e) {}

  const existing = document.getElementById('home-best');
  if (existing) existing.remove();

  if (highScore !== null) {
    const el = document.createElement('div');
    el.id = 'home-best';
    el.style.cssText = 'font-size:13px;font-weight:700;color:var(--muted);text-align:center;margin-top:12px;letter-spacing:0.2px';
    el.textContent = `Your best: ${highScore} / 150 pts`;
    const hero = document.querySelector('#s-home .home-hero');
    if (hero) hero.appendChild(el);
  }
}

// ── STARTUP CARD ──────────────────────────────────────────────────────────

function showCard() {
  const startup = state.startups[state.currentIdx];
  const roundNum = state.currentIdx + 1;

  document.querySelector('#s-card .company-name').textContent = startup.name;
  document.querySelector('#s-card .company-blurb').textContent = startup.blurb;
  document.querySelector('#s-card .batch-tag').innerHTML =
    `<span class="batch-tag-label">YC Batch</span> ${startup.batch}`;

  updateRoundPill('s-card', roundNum);
  updateProgressBar('s-card', state.currentIdx);

  // Score footer
  const sfVals = document.querySelectorAll('#s-card .sf-val');
  if (sfVals[0]) sfVals[0].textContent = `${roundNum} / 5`;
  if (sfVals[1]) sfVals[1].textContent = `${state.totalScore} pts`;

  goTo('s-card');
}

// ── GUESSES ───────────────────────────────────────────────────────────────

function startGuesses() {
  const startup = state.startups[state.currentIdx];
  const foundingYear = getFoundingYear(startup.batch);
  const midYear = Math.round((foundingYear + 2025) / 2);

  // Reset guesses — year pre-set to slider default
  state.guesses = { year: midYear, funding: null, industry: null };

  // Year slider
  const slider = document.getElementById('yr-slider');
  const display = document.getElementById('yr-display');
  slider.min = foundingYear;
  slider.max = 2025;
  slider.value = midYear;
  display.textContent = midYear;

  // Year range labels
  const labels = document.querySelectorAll('.year-range-labels span');
  if (labels.length === 3) {
    labels[0].textContent = foundingYear;
    labels[1].textContent = midYear;
    labels[2].textContent = '2025';
  }

  // Mini company context in each step
  document.querySelectorAll('.context-mini .company-name').forEach(el => {
    el.textContent = startup.name;
  });
  document.querySelectorAll('.context-mini .context-batch').forEach(el => {
    el.textContent = startup.batch;
  });

  // Clear chip selections
  document.querySelectorAll('#fund-grid .fund-option').forEach(o => o.classList.remove('selected'));
  document.querySelectorAll('#ind-grid .ind-option').forEach(o => o.classList.remove('selected'));

  // Reset step
  currentGuessStep = 0;
  showStep(0);
  updateSubmitGate();

  updateRoundPill('s-guess', state.currentIdx + 1);
  updateProgressBar('s-guess', state.currentIdx);

  goTo('s-guess');
}

function showStep(idx) {
  const stepIds = ['step-year', 'step-fund', 'step-ind'];
  stepIds.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('active', 'exit');
    if (i === idx) {
      el.classList.add('active');
      el.removeAttribute('inert');
    } else {
      if (i < idx) el.classList.add('exit');
      el.setAttribute('inert', '');
    }
  });
  const btn = document.getElementById('guess-next-btn');
  if (btn) btn.textContent = idx === 2 ? 'Submit guesses →' : 'Next →';
  updateSubmitGate();
}

function nextGuessStep() {
  if (currentGuessStep < 2) {
    currentGuessStep++;
    showStep(currentGuessStep);
  } else {
    buildReveal();
  }
}

function selectFund(el) {
  document.querySelectorAll('#fund-grid .fund-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  state.guesses.funding = FUND_VAL_MAP[el.dataset.val] || null;
  updateSubmitGate();
}

function selectInd(el) {
  document.querySelectorAll('#ind-grid .ind-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  state.guesses.industry = IND_VAL_MAP[el.dataset.val] || null;
  updateSubmitGate();
}

function updateSubmitGate() {
  const btn = document.getElementById('guess-next-btn');
  if (!btn) return;
  if (currentGuessStep === 0) {
    btn.disabled = false; // year always has slider default
  } else if (currentGuessStep === 1) {
    btn.disabled = state.guesses.funding === null;
  } else {
    btn.disabled = state.guesses.industry === null;
  }
}

// ── REVEAL ────────────────────────────────────────────────────────────────

function buildReveal() {
  const startup = state.startups[state.currentIdx];
  const result = scoreStartup(state.guesses, startup);

  state.scores.push(result);
  state.totalScore += result.total;

  // Lazy-load html2canvas on first reveal
  injectHtml2canvas();

  // Populate reveal rows
  const yearDiff = Math.abs(state.guesses.year - startup.lastActiveYear);
  const yearAnswer = startup.lastActiveYear === 2025
    ? 'Still active in 2025'
    : `Shut down in ${startup.lastActiveYear}`;
  const yearGuessText = yearDiff === 0
    ? `You guessed: ${state.guesses.year} ✓`
    : `You guessed: ${state.guesses.year} (${yearDiff === 1 ? '1 yr off' : `${yearDiff} yrs off`})`;

  const fundAnswer = FUND_DISPLAY[startup.funding] || startup.funding;
  const fundGuessLabel = FUND_DISPLAY[state.guesses.funding] || state.guesses.funding || '—';
  const fundGuessText = state.guesses.funding === startup.funding
    ? `You guessed: ${fundGuessLabel} ✓`
    : `You guessed: ${fundGuessLabel}`;

  const indGuessText = state.guesses.industry === startup.industry
    ? `You guessed: ${state.guesses.industry} ✓`
    : `You guessed: ${state.guesses.industry || '—'}`;

  function classify(pts, maxPts) {
    if (pts === maxPts) return 'correct';
    if (pts > 0) return 'partial';
    return 'wrong';
  }

  function fillRow(id, cls, icon, category, answer, guessText, pts) {
    const row = document.getElementById(id);
    if (!row) return;
    row.className = `reveal-row ${cls}`;
    row.classList.remove('shown');
    row.querySelector('.reveal-icon').textContent = icon;
    row.querySelector('.reveal-category').textContent = category;
    row.querySelector('.reveal-answer').textContent = answer;
    row.querySelector('.reveal-guess').textContent = guessText;
    row.querySelector('.reveal-pts').textContent = `+${pts}`;
  }

  fillRow('rv-year', classify(result.year, 10),     '📅', 'Last active year', yearAnswer, yearGuessText, result.year);
  fillRow('rv-fund', classify(result.funding, 10),  '💰', 'Total funding',    fundAnswer, fundGuessText, result.funding);
  fillRow('rv-ind',  classify(result.industry, 10), '🏭', 'Industry',         startup.industry, indGuessText, result.industry);

  // Company name + batch on reveal screen
  const revealName = document.querySelector('#s-reveal .reveal-name');
  const revealBatch = document.querySelector('#s-reveal .reveal-batch');
  if (revealName) revealName.textContent = startup.name;
  if (revealBatch) revealBatch.textContent = startup.batch;

  updateRoundPill('s-reveal', state.currentIdx + 1);
  updateProgressBar('s-reveal', state.currentIdx + 1);

  // Round score footer
  const rtScores = document.querySelectorAll('.rt-score');
  if (rtScores[0]) rtScores[0].textContent = `${result.total} / 30 pts`;
  if (rtScores[1]) rtScores[1].textContent = `${state.totalScore} pts`;

  // Continue / final button
  const continueBtn = document.querySelector('#s-reveal .primary-btn');
  if (continueBtn) {
    if (state.currentIdx < 4) {
      continueBtn.textContent = 'Continue →';
      continueBtn.onclick = function () {
        state.currentIdx++;
        showCard();
      };
    } else {
      continueBtn.textContent = 'See final score →';
      continueBtn.onclick = function () {
        saveHighScore();
        buildFinal();
        goTo('s-final');
        spawnConfetti();
      };
    }
  }

  goTo('s-reveal');
  revealRows();
}

function countUp(el, target, duration) {
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.textContent = `+${Math.round(ease * target)}`;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function revealRows() {
  ['rv-year', 'rv-fund', 'rv-ind'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('shown');
    setTimeout(() => {
      el.classList.add('shown');
      const ptsEl = el.querySelector('.reveal-pts');
      if (ptsEl) {
        const target = parseInt(ptsEl.textContent.replace('+', ''), 10) || 0;
        ptsEl.textContent = '+0';
        countUp(ptsEl, target, 400);
      }
    }, 300 + i * 400);
  });
}

// ── FINAL SCORE CARD ──────────────────────────────────────────────────────

function buildFinal() {
  const score = state.totalScore;
  const tier = TIERS.find(t => score >= t.min) || TIERS[TIERS.length - 1];
  const lines = ONE_LINERS[tier.letter];
  const oneliner = lines[Math.floor(Math.random() * lines.length)];

  const yearTotal  = state.scores.reduce((a, s) => a + s.year, 0);
  const fundTotal  = state.scores.reduce((a, s) => a + s.funding, 0);
  const indTotal   = state.scores.reduce((a, s) => a + s.industry, 0);

  document.querySelector('.tier-letter').textContent = tier.letter;
  document.querySelector('.tier-score').textContent = score;
  const tierLabelEl = document.querySelector('.tier-label');
  if (tierLabelEl) tierLabelEl.textContent = tier.label;
  document.querySelector('.final-quip-text').textContent = oneliner;

  const fbPts = document.querySelectorAll('.fb-pts');
  if (fbPts[0]) fbPts[0].textContent = yearTotal;
  if (fbPts[1]) fbPts[1].textContent = fundTotal;
  if (fbPts[2]) fbPts[2].textContent = indTotal;

  // Date stamp
  const dateEl = document.querySelector('#s-final [style*="letter-spacing"]');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  }

  // Wire share buttons
  document.querySelector('.btn-save').onclick = saveImage;
  document.querySelector('.btn-share').onclick = shareScore;
}

function saveHighScore() {
  try {
    const prev = parseInt(localStorage.getItem('yc_roulette_high_score') || '0', 10);
    if (state.totalScore > prev) {
      localStorage.setItem('yc_roulette_high_score', state.totalScore);
    }
  } catch (e) {}
}

// ── SHARE CARD ────────────────────────────────────────────────────────────

function injectHtml2canvas() {
  if (html2canvasLoaded || html2canvasFailed) return;
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  script.onload = () => { html2canvasLoaded = true; };
  script.onerror = () => {
    html2canvasFailed = true;
    console.warn('html2canvas failed to load');
  };
  document.head.appendChild(script);
}

function isCanvasBlank(canvas) {
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const total = canvas.width * canvas.height;
  const step = Math.max(1, Math.floor(total / 100));
  let blankCount = 0;
  for (let i = 0; i < total; i += step) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
    if (a === 0 || (r > 250 && g > 250 && b > 250)) blankCount++;
  }
  return blankCount / Math.ceil(total / step) > 0.9;
}

function saveImage() {
  if (html2canvasFailed || !window.html2canvas) {
    showToast('Screenshot this to save your score');
    return;
  }
  if (!html2canvasLoaded) {
    showToast('Loading… try again in a moment');
    return;
  }

  const target = document.querySelector('#s-final .final-content');
  if (!target) { showToast('Screenshot this to save your score'); return; }

  html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#1A1410' })
    .then(canvas => {
      if (isCanvasBlank(canvas)) {
        showToast('Screenshot this to save your score');
        return;
      }
      canvas.toBlob(blob => {
        if (!blob) { showToast('Screenshot this to save your score'); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'yc-roulette-score.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }, 'image/png');
    })
    .catch(() => showToast('Screenshot this to save your score'));
}

function shareScore() {
  const score = state.totalScore;
  const tier = TIERS.find(t => score >= t.min) || TIERS[TIERS.length - 1];
  const text = `I scored ${score}/150 on YC Roulette — ${tier.label}. Can you beat it?`;
  const url = 'https://lkpvignesh.github.io/ycroulette';

  const target = document.querySelector('#s-final .final-content');
  const canShare = navigator.share && navigator.canShare;

  if (!target || html2canvasFailed || !window.html2canvas || !html2canvasLoaded) {
    // Fallback: share text + link only
    if (navigator.share) {
      navigator.share({ title: 'YC Roulette', text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${text} ${url}`)
        .then(() => showToast('Copied to clipboard — paste to share'))
        .catch(() => showToast('Screenshot this to share your score'));
    }
    return;
  }

  html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#1A1410' })
    .then(canvas => {
      if (isCanvasBlank(canvas)) {
        navigator.share
          ? navigator.share({ title: 'YC Roulette', text, url }).catch(() => {})
          : showToast('Screenshot this to share your score');
        return;
      }
      canvas.toBlob(blob => {
        if (!blob) {
          navigator.share
            ? navigator.share({ title: 'YC Roulette', text, url }).catch(() => {})
            : showToast('Screenshot this to share your score');
          return;
        }
        const file = new File([blob], 'yc-roulette-score.png', { type: 'image/png' });
        if (canShare && navigator.canShare({ files: [file] })) {
          // Share image + text (works on mobile)
          navigator.share({ title: 'YC Roulette', text, files: [file] }).catch(() => {
            // If image share fails, fall back to link share
            navigator.share({ title: 'YC Roulette', text, url }).catch(() => {});
          });
        } else if (navigator.share) {
          // Desktop or browser without file share — share text + link
          navigator.share({ title: 'YC Roulette', text, url }).catch(() => {});
        } else {
          // No Web Share API — download the image instead
          const imgUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = imgUrl;
          a.download = 'yc-roulette-score.png';
          a.click();
          setTimeout(() => URL.revokeObjectURL(imgUrl), 5000);
          showToast('Image saved — share it anywhere!');
        }
      }, 'image/png');
    })
    .catch(() => {
      if (navigator.share) {
        navigator.share({ title: 'YC Roulette', text, url }).catch(() => {});
      } else {
        navigator.clipboard.writeText(`${text} ${url}`)
          .then(() => showToast('Copied to clipboard — paste to share'))
          .catch(() => showToast('Screenshot this to share your score'));
      }
    });
}

// ── CONFETTI ──────────────────────────────────────────────────────────────

function spawnConfetti() {
  const colors = ['#E8703A','#3BAD7A','#F0C040','#E85050','#7B61FF','#fff'];
  const phone = document.querySelector('.phone');
  if (!phone) return;
  for (let i = 0; i < 32; i++) {
    const c = document.createElement('div');
    c.className = 'confetti-piece';
    c.style.left   = Math.random() * 360 + 'px';
    c.style.top    = '0px';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.width  = (6 + Math.random() * 6) + 'px';
    c.style.height = (6 + Math.random() * 6) + 'px';
    c.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    c.style.animation = `confetti-fall ${1.2 + Math.random() * 1.4}s ease-in ${Math.random() * 0.5}s forwards`;
    phone.appendChild(c);
    setTimeout(() => c.remove(), 3000);
  }
}

// ── RESET / PLAY AGAIN ────────────────────────────────────────────────────

function resetGame() {
  state = {
    startups: buildSession(),
    currentIdx: 0,
    guesses: { year: null, funding: null, industry: null },
    scores: [],
    totalScore: 0
  };
  currentGuessStep = 0;
  document.querySelectorAll('.reveal-row').forEach(r => r.classList.remove('shown'));
  initHome();
  goTo('s-home');
}

// ── ENTRY POINT ───────────────────────────────────────────────────────────

function handleStartPlaying() {
  state = {
    startups: buildSession(),
    currentIdx: 0,
    guesses: { year: null, funding: null, industry: null },
    scores: [],
    totalScore: 0
  };
  showCard();
}

// Wire slider live update
const _slider = document.getElementById('yr-slider');
const _display = document.getElementById('yr-display');
if (_slider && _display) {
  _slider.addEventListener('input', () => {
    _display.textContent = _slider.value;
    state.guesses.year = parseInt(_slider.value, 10);
  });
}

// Debug test harness — only available with ?debug=1
if (new URLSearchParams(window.location.search).get('debug') === '1') {
  window.runTests = function () {
    let pass = 0, fail = 0;
    function assert(label, got, expected) {
      if (got === expected) { console.log(`✅ ${label}`); pass++; }
      else { console.error(`❌ ${label}: got ${got}, expected ${expected}`); fail++; }
    }
    // Year scoring
    assert('Year exact',      scoreYear(2020, 2020), 10);
    assert('Year ±1',         scoreYear(2019, 2020), 8);
    assert('Year ±3',         scoreYear(2017, 2020), 5);
    assert('Year ±4+',        scoreYear(2015, 2020), 1);
    // Funding scoring
    assert('Fund exact',      scoreFunding('seed', 'seed'), 10);
    assert('Fund off by 1',   scoreFunding('seed', '<5m'), 5);
    assert('Fund off by 2',   scoreFunding('seed', '5-50m'), 0);
    assert('Fund off by 3',   scoreFunding('seed', '50m+'), 0);
    // Industry scoring
    assert('Ind exact',       scoreIndustry('Fintech', 'Fintech'), 10);
    assert('Ind adjacent 1',  scoreIndustry('Fintech', 'Enterprise SaaS'), 3);
    assert('Ind adjacent 2',  scoreIndustry('Dev Tools', 'AI/ML'), 3);
    assert('Ind adjacent 3',  scoreIndustry('E-commerce', 'Consumer'), 3);
    assert('Ind adjacent 4',  scoreIndustry('Logistics', 'E-commerce'), 3);
    assert('Ind adjacent 5',  scoreIndustry('Healthtech', 'Enterprise SaaS'), 3);
    assert('Ind miss',        scoreIndustry('Fintech', 'Consumer'), 0);
    assert('Other exact',     scoreIndustry('Other', 'Other'), 10);
    assert('Other miss',      scoreIndustry('Fintech', 'Other'), 0);
    console.log(`\n${pass} passed, ${fail} failed`);
  };
  console.log('🔧 Debug mode — run runTests() to validate scoring');
}

// Boot
initHome();
