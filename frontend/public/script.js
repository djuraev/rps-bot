(() => {
  'use strict';

  const MOVES = ['rock', 'paper', 'scissors'];
  const EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' };
  const NAME = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (id) => document.getElementById(id);
  const el = {
    tagline: $('tagline'), banner: $('banner'), thought: $('thought'),
    handYou: $('hand-you'), handBot: $('hand-bot'), sideYou: $('side-you'), sideBot: $('side-bot'),
    wins: $('s-wins'), draws: $('s-draws'), losses: $('s-losses'),
    history: $('history'), bars: $('bars'), fav: $('fav'),
    ring: $('ring'), ringPct: $('ring-pct'), winrate: $('winrate'),
    spark: $('spark'), sparkHint: $('spark-hint'),
    wipe: $('wipe'), confetti: $('confetti'), host: $('host'), dbver: $('dbver'),
  };
  const buttons = Array.from(document.querySelectorAll('.move'));
  let busy = false;

  // --------------------------------------------------------------- helpers
  async function api(path, options) {
    const res = await fetch(path, Object.assign({ cache: 'no-store' }, options));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }
  const pct = (x) => Math.round(x * 100);
  const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

  // ------------------------------------------- status lights (every 4 s)
  function setLight(id, state, title) {
    const li = $(id);
    li.className = 'light ' + state;
    li.title = title || '';
  }
  async function checkHealth() {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const j = await res.json().catch(() => null);
      if (j && j.status === 'ok') {
        setLight('light-backend', 'ok', 'Backend container: ' + j.host);
        setLight('light-db', 'ok', j.dbVersion);
        el.host.textContent = j.host;
        el.dbver.textContent = j.dbVersion;
      } else if (j && j.status === 'degraded') {
        setLight('light-backend', 'ok', 'Backend answers');
        setLight('light-db', 'bad', 'The backend cannot reach the database');
        el.host.textContent = j.host;
      } else {
        setLight('light-backend', 'bad', 'The frontend cannot reach the backend');
        setLight('light-db', 'unknown', 'Unknown while the backend is down');
      }
    } catch (err) {
      setLight('light-backend', 'bad', 'The frontend cannot reach the backend');
      setLight('light-db', 'unknown', 'Unknown while the backend is down');
    }
  }

  // ------------------------------------------------------------ rendering
  function bump(node, value) {
    if (node.textContent === String(value)) return;
    node.textContent = value;
    node.classList.add('bump');
    setTimeout(() => node.classList.remove('bump'), 250);
  }

  function renderBars(s) {
    const top = MOVES.reduce((a, b) => (s.moves[b] > s.moves[a] ? b : a), 'rock');
    el.bars.querySelectorAll('.bar').forEach((row) => {
      const m = row.dataset.move;
      const p = s.total ? pct(s.moves[m] / s.total) : 0;
      row.querySelector('.fill').style.width = p + '%';
      row.querySelector('.pct').textContent = p + '%';
      row.classList.toggle('leader', s.total >= 3 && m === top && s.moves[m] > s.total / 3);
    });
    if (s.total < 3) {
      el.fav.innerHTML = 'Play a few rounds and I will start to read you.';
    } else if (s.moves[top] <= s.total / 3 + 0.0001 && MOVES.every((m) => s.moves[m] === s.moves[top])) {
      el.fav.innerHTML = 'Perfectly balanced. Nothing to learn from you!';
    } else {
      el.fav.innerHTML = 'You play ' + EMOJI[top] + ' <b>' + NAME[top] + '</b> most often (' + pct(s.moves[top] / s.total) + '%). Try to be unpredictable!';
    }
  }

  function renderRing(s) {
    if (s.botAccuracy == null) {
      el.ring.style.setProperty('--p', 0);
      el.ringPct.textContent = '–';
    } else {
      el.ring.style.setProperty('--p', pct(s.botAccuracy));
      el.ringPct.textContent = pct(s.botAccuracy) + '%';
    }
    el.winrate.textContent = s.winRate == null ? '–' : pct(s.winRate) + '%';
  }

  function renderHistory(s) {
    const last = s.recent.slice(-10);
    el.history.innerHTML = '';
    if (!last.length) {
      el.history.innerHTML = '<span class="hint" style="margin:0">No rounds yet.</span>';
      return;
    }
    last.forEach((r) => {
      const chip = document.createElement('span');
      chip.className = 'chip ' + r.result;
      chip.title = 'You: ' + NAME[r.player_move] + ' · Bot: ' + NAME[r.bot_move] + ' · ' + r.result;
      chip.innerHTML = EMOJI[r.player_move] + '<span class="vsm">vs</span>' + EMOJI[r.bot_move];
      el.history.appendChild(chip);
    });
  }

  function renderSpark(s) {
    const data = s.recent;
    const X0 = 36, X1 = 292, Y0 = 12, Y1 = 78;
    const y = (rate) => Y1 - rate * (Y1 - Y0);
    const NS = 'http://www.w3.org/2000/svg';
    el.spark.innerHTML =
      '<defs>' +
      '<linearGradient id="sg" x1="0" x2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#22d3ee"/></linearGradient>' +
      '<linearGradient id="sa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22d3ee" stop-opacity="0.35"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient>' +
      '</defs>' +
      '<line class="base" x1="' + X0 + '" x2="' + X1 + '" y1="' + y(1 / 3) + '" y2="' + y(1 / 3) + '"/>' +
      '<text x="' + X1 + '" y="' + (y(1 / 3) - 4) + '" text-anchor="end">33% = pure luck</text>' +
      '<text x="2" y="' + (Y0 + 3) + '">100%</text>' +
      '<text x="2" y="' + (Y1 + 3) + '">0%</text>';
    if (data.length < 3) {
      el.sparkHint.textContent = 'Needs a few rounds to draw.';
      return;
    }
    const rolling = data.map((_, i) => {
      const win = data.slice(Math.max(0, i - 9), i + 1);
      return win.filter((r) => r.result === 'win').length / win.length;
    });
    const n = rolling.length;
    const pts = rolling.map((v, i) => [X0 + (n === 1 ? 0 : (i / (n - 1)) * (X1 - X0)), y(v)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = line + ' L' + pts[n - 1][0].toFixed(1) + ' ' + Y1 + ' L' + pts[0][0].toFixed(1) + ' ' + Y1 + ' Z';
    const end = pts[n - 1];
    el.spark.insertAdjacentHTML('beforeend',
      '<path class="area" d="' + area + '"/><path class="line" d="' + line + '"/>' +
      '<circle cx="' + end[0].toFixed(1) + '" cy="' + end[1].toFixed(1) + '" r="4.5" fill="#fff" stroke="#22d3ee" stroke-width="2"/>');
    const lastRate = rolling[n - 1];
    if (n < 10) el.sparkHint.textContent = 'The dashed line is what pure luck gives you.';
    else if (lastRate < 0.28) el.sparkHint.textContent = 'Below the dashed line: the bot is reading you!';
    else if (lastRate > 0.42) el.sparkHint.textContent = 'You are beating the bot. Can you keep it up?';
    else el.sparkHint.textContent = 'Close to luck. The bot is still learning.';
  }

  function renderStats(s) {
    bump(el.wins, s.wins);
    bump(el.draws, s.draws);
    bump(el.losses, s.losses);
    el.tagline.textContent = s.total === 0
      ? 'I know nothing about you yet.'
      : 'I remember ' + plural(s.total, 'round') + ' of you.';
    renderBars(s);
    renderRing(s);
    renderHistory(s);
    renderSpark(s);
  }

  // --------------------------------------------------------- one round
  function setBanner(text, kind) {
    el.banner.textContent = text;
    el.banner.className = 'banner ' + kind + (kind === 'idle' || kind === 'error' ? '' : ' pulse');
  }

  function explain(d) {
    if (d.predicted == null) return '🧠 I am still collecting data about you, so I just <b>guessed</b>.';
    const why = d.strategy === 'pattern'
      ? 'after ' + EMOJI[d.context] + ' you play it ' + pct(d.confidence) + '% of the time'
      : 'it is your favorite: ' + pct(d.confidence) + '% of your recent moves';
    const verdict = d.predicted === d.player ? ' <b>I read you!</b>' : ' <b>You fooled me!</b>';
    return '🧠 I expected ' + EMOJI[d.predicted] + ' <b>' + NAME[d.predicted] + '</b> (' + why + ').' + verdict;
  }

  function confetti() {
    if (reduceMotion) return;
    const icons = ['🎉', '✨', '⭐', '💫'];
    for (let i = 0; i < 18; i++) {
      const c = document.createElement('span');
      c.className = 'confetto';
      c.textContent = icons[i % icons.length];
      c.style.left = '50%';
      c.style.top = '42%';
      c.style.setProperty('--x', Math.round(Math.random() * 380 - 190) + 'px');
      c.style.setProperty('--y', Math.round(-60 - Math.random() * 180) + 'px');
      c.style.setProperty('--r', Math.round(Math.random() * 540 - 270) + 'deg');
      el.confetti.appendChild(c);
      setTimeout(() => c.remove(), 1300);
    }
  }

  function setBusy(on) {
    busy = on;
    buttons.forEach((b) => { b.disabled = on; });
  }

  async function play(move) {
    if (busy) return;
    setBusy(true);
    buttons.forEach((b) => b.classList.toggle('picked', b.dataset.move === move));

    // reset the stage and start the "Rock... Paper... Scissors... Shoot!" countdown
    [el.sideYou, el.sideBot].forEach((s) => s.classList.remove('winner', 'loser', 'drawn'));
    el.handYou.textContent = EMOJI.rock;
    el.handBot.textContent = EMOJI.rock;
    const hands = [el.handYou.parentElement, el.handBot.parentElement];
    hands.forEach((h) => { h.classList.remove('pop'); h.classList.add('shake'); });
    el.thought.innerHTML = '&nbsp;';
    const steps = ['Rock…', 'Paper…', 'Scissors…', 'Shoot!'];
    let i = 0;
    setBanner(steps[0], 'idle');
    const timer = setInterval(() => { i = Math.min(i + 1, steps.length - 1); setBanner(steps[i], 'idle'); }, 250);
    const minWait = new Promise((r) => setTimeout(r, reduceMotion ? 200 : 1000));

    let data = null;
    try {
      data = await api('/api/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ move }),
      });
    } catch (err) {
      data = null;
    }
    await minWait;
    clearInterval(timer);
    hands.forEach((h) => h.classList.remove('shake'));

    if (!data) {
      setBanner('The bot is sleeping 😴', 'error');
      el.thought.innerHTML = 'The backend is not answering. Check <b>docker compose ps</b> and <b>docker compose logs backend</b>.';
      buttons.forEach((b) => b.classList.remove('picked'));
      checkHealth();
      setBusy(false);
      return;
    }

    // reveal both hands
    el.handYou.textContent = EMOJI[data.player];
    el.handBot.textContent = EMOJI[data.bot];
    hands.forEach((h) => h.classList.add('pop'));
    if (data.result === 'win') {
      el.sideYou.classList.add('winner'); el.sideBot.classList.add('loser');
      setBanner('You win! 🎉', 'win');
      confetti();
    } else if (data.result === 'lose') {
      el.sideBot.classList.add('winner'); el.sideYou.classList.add('loser');
      setBanner('Bot wins 🤖', 'lose');
    } else {
      el.sideYou.classList.add('drawn'); el.sideBot.classList.add('drawn');
      setBanner('It is a draw 🤝', 'draw');
    }
    el.thought.innerHTML = explain(data);
    renderStats(data.stats);
    setBusy(false);
  }

  // ------------------------------------------------------------- events
  buttons.forEach((b) => b.addEventListener('click', () => play(b.dataset.move)));

  const KEYS = { r: 'rock', p: 'paper', s: 'scissors', 1: 'rock', 2: 'paper', 3: 'scissors' };
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const m = KEYS[e.key.toLowerCase()];
    if (m) play(m);
  });

  // "Wipe the bot's memory" needs two clicks, so nobody does it by accident.
  let armedTimer = null;
  const wipeLabel = el.wipe.textContent;
  function disarm() {
    clearTimeout(armedTimer);
    el.wipe.classList.remove('armed');
    el.wipe.textContent = wipeLabel;
  }
  el.wipe.addEventListener('click', async () => {
    if (!el.wipe.classList.contains('armed')) {
      el.wipe.classList.add('armed');
      el.wipe.textContent = 'Click again to confirm';
      armedTimer = setTimeout(disarm, 3000);
      return;
    }
    disarm();
    try {
      await api('/api/reset', { method: 'POST' });
      renderStats(await api('/api/stats'));
      [el.sideYou, el.sideBot].forEach((s) => s.classList.remove('winner', 'loser', 'drawn'));
      el.handYou.textContent = EMOJI.rock;
      el.handBot.textContent = EMOJI.rock;
      setBanner('Memory wiped. I know nothing about you again!', 'idle');
      el.thought.innerHTML = '&nbsp;';
    } catch (err) {
      setBanner('Could not wipe the memory 😴', 'error');
    }
  });

  // -------------------------------------------------------------- start
  async function loadStats() {
    try {
      renderStats(await api('/api/stats'));
      setBanner('Pick your move', 'idle');
    } catch (err) {
      el.tagline.textContent = 'Waiting for the bot to wake up…';
      setTimeout(loadStats, 3000);
    }
  }

  loadStats();
  checkHealth();
  setInterval(checkHealth, 4000);
})();
