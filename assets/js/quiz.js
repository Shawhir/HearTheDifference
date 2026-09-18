/* Hear the Difference — the listening drill.
 *
 * Behaviour is unchanged from the original single-file build; what moved is
 * where the data comes from (assets/js/deck.js) and the fact that audio is now
 * resolved asynchronously, because a card's recording may be a file on disk or
 * a draft blob held in the browser.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var DECK = window.HTD.load();
  var CARDS = [];
  var GROUPS = {};
  var player = $('player');
  var currentURL = null; // object URL in flight, revoked before the next one

  /* ---------------------------------- spaced-repetition state (persisted) */

  var KEY = 'en-srs-v2'; // unchanged key: existing learners keep their schedule
  var DAY = 86400000, MIN_EASE = 1.3, MAX_EASE = 3.0, AGAIN_GAP = 0, HARD_GAP = 2, NEW_CAP = 20;
  var SCHED = {}, NO_PERSIST = false;
  try { var raw = localStorage.getItem(KEY); if (raw) SCHED = JSON.parse(raw); } catch (e) { NO_PERSIST = true; }

  function saveSched() {
    try { localStorage.setItem(KEY, JSON.stringify(SCHED)); } catch (e) { NO_PERSIST = true; }
    updateSaveNote();
  }
  var now = function () { return Date.now(); };
  var cidOf = window.HTD.cardKey;

  function fmtDays(d) {
    if (d < 1) return '<1 d';
    if (d < 30) return Math.round(d) + ' d';
    return Math.round(d / 7) + ' wk';
  }

  // pure scheduler: entry (or null) + rating -> new entry. ivl is in DAYS for review.
  // state 'learning' = repeats within this session (Again / Hard); 'review' = days out.
  function grade(e0, rating) {
    var e = e0 ? Object.assign({}, e0) : { ivl: 0, ease: 2.5, reps: 0, lapses: 0, state: 'new' };
    var wasReview = e.state === 'review';
    if (rating === 'again') {
      if (wasReview) e.lapses = (e.lapses || 0) + 1;
      e.ease = Math.max(MIN_EASE, (e.ease || 2.5) - 0.2); e.state = 'learning'; e.ivl = 0;
    } else if (rating === 'hard') {
      if (wasReview) { e.ease = Math.max(MIN_EASE, e.ease - 0.15); e.ivl = Math.max(1, e.ivl * 1.2); e.state = 'review'; }
      else { e.state = 'learning'; e.ivl = 0; }
    } else if (rating === 'good') {
      e.ivl = wasReview ? Math.max(1, e.ivl * e.ease) : 1; e.state = 'review';
    } else { // easy
      e.ease = Math.min(MAX_EASE, (e.ease || 2.5) + 0.15);
      e.ivl = wasReview ? Math.max(2, e.ivl * e.ease * 1.3) : 4; e.state = 'review';
    }
    return e;
  }

  function previewIvl(c, rating) {
    var e = grade(SCHED[cidOf(c)], rating);
    return e.state === 'learning' ? 'soon' : fmtDays(e.ivl);
  }

  function applyRating(c, rating) {
    var id = cidOf(c), e = grade(SCHED[id], rating);
    e.reps = ((SCHED[id] && SCHED[id].reps) || 0) + 1;
    e.due = e.state === 'learning' ? now() : now() + Math.round(e.ivl * DAY);
    SCHED[id] = e; saveSched();
    if (e.state === 'learning') S.learn.push({ c: c, at: S.pos + (rating === 'again' ? AGAIN_GAP : HARD_GAP) });
  }

  /* ------------------------------------------------------------- session */

  var S = {
    srs: true, filter: 'all', pool: [], cur: null, opts: [],
    answered: false, lastCorrect: false, streak: 0,
    pos: 0, learn: [], reviewQueue: [], newQueue: [],
    deck: [], idx: 0, stats: { done: 0, correct: 0, per: {} }
  };

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.random() * (i + 1) | 0; var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function show(which) {
    ['start', 'quiz', 'results'].forEach(function (s) { $(s).classList.add('hidden'); });
    var el = $(which);
    el.classList.remove('hidden'); el.classList.remove('fade');
    void el.offsetWidth;
    el.classList.add('fade');
  }

  /* ------------------------------------------------ start screen, from data */

  function renderStart() {
    $('brand-title').textContent = DECK.title || 'Hear the Difference';
    $('brand-sub').textContent = DECK.subtitle || '';
    $('deck-size').textContent = CARDS.length;

    $('groups').innerHTML = '';
    (DECK.groups || []).forEach(function (g) {
      var card = document.createElement('div');
      card.className = 'gcard';
      card.innerHTML = '<div class="ipa"></div><h3></h3><p></p><div class="ex"></div>';
      card.querySelector('.ipa').textContent = g.ipa || '';
      if (g.ipaNote) {
        var small = document.createElement('small');
        small.textContent = ' ' + g.ipaNote;
        card.querySelector('.ipa').appendChild(small);
      }
      card.querySelector('h3').textContent = g.title || g.label || g.id;
      card.querySelector('p').textContent = g.blurb || '';
      card.querySelector('.ex').textContent = g.example || '';
      $('groups').appendChild(card);
    });

    var filter = $('filter');
    filter.innerHTML = '';
    var all = document.createElement('button');
    all.dataset.f = 'all'; all.className = 'on'; all.textContent = 'All';
    filter.appendChild(all);
    (DECK.groups || []).forEach(function (g) {
      if (!CARDS.some(function (c) { return c.group === g.id; })) return;
      var b = document.createElement('button');
      b.dataset.f = g.id;
      b.textContent = g.ipa || g.label || g.id;
      filter.appendChild(b);
    });
  }

  /* ------------------------------------------------------------- quizzing */

  function startQuiz() {
    S.srs = $('srs').checked;
    S.pool = CARDS.filter(function (c) { return S.filter === 'all' || c.group === S.filter; });
    S.streak = 0; S.pos = 0; S.learn = [];
    S.stats = { done: 0, correct: 0, per: {} };
    S.pool.forEach(function (c) { S.stats.per[c.group] = { right: 0, total: 0 }; });
    var n = now();
    S.reviewQueue = S.pool.filter(function (c) { var e = SCHED[cidOf(c)]; return e && e.due <= n; })
      .sort(function (a, b) { return SCHED[cidOf(a)].due - SCHED[cidOf(b)].due; });
    S.newQueue = shuffle(S.pool.filter(function (c) { return !SCHED[cidOf(c)]; })).slice(0, NEW_CAP);
    show('quiz');
    if (S.srs) { serveNext(); }
    else {
      S.deck = shuffle(S.pool.slice()); S.idx = 0;
      if (S.deck.length) serve(S.deck[0]); else finish();
    }
  }

  function nextCard() {
    if (S.learn.length) {
      var i = S.learn.findIndex(function (x) { return x.at <= S.pos; });
      if (i >= 0) return S.learn.splice(i, 1)[0].c;
    }
    if (S.reviewQueue.length) return S.reviewQueue.shift();
    if (S.newQueue.length) return S.newQueue.shift();
    if (S.learn.length) { S.learn.sort(function (a, b) { return a.at - b.at; }); return S.learn.shift().c; }
    return null;
  }

  function serveNext() {
    var c = nextCard();
    if (!c) { finish(); return; }
    serve(c);
  }

  function serve(c) {
    S.cur = c; S.answered = false; S.pos++;
    var opts = Math.random() < 0.5 ? [c.options[0], c.options[1]] : [c.options[1], c.options[0]];
    S.opts = opts;
    var g = GROUPS[c.group] || {};
    $('grouppill').innerHTML = '';
    var ph = document.createElement('span');
    ph.className = 'ph';
    ph.textContent = g.ipa || c.group;
    $('grouppill').appendChild(ph);
    for (var i = 0; i < 2; i++) {
      var b = $('opt' + i);
      b.className = 'opt';
      b.querySelector('.w').textContent = opts[i];
      b.querySelector('.mark').textContent = '';
    }
    $('verdict').className = 'verdict'; $('verdict').textContent = '';
    $('rate').classList.remove('show'); $('next').classList.remove('show');
    updateCounts(); updateProgress();
    loadAudio(c).then(playAudio);
  }

  function loadAudio(c) {
    return window.HTD.audioURL(c).then(function (url) {
      if (currentURL) { URL.revokeObjectURL(currentURL); currentURL = null; }
      if (!url) { player.removeAttribute('src'); return; }
      if (url.indexOf('blob:') === 0) currentURL = url;
      player.src = url;
    });
  }

  function playing(on) {
    $('play').classList.toggle('playing', on);
    $('playicon').classList.toggle('hidden', on);
    $('eq').classList.toggle('hidden', !on);
  }

  function playAudio() {
    if (!player.getAttribute('src')) return;
    player.currentTime = 0;
    var p = player.play();
    playing(true);
    if (p) p.catch(function () { playing(false); });
  }

  function choose(i) {
    if (S.answered) return;
    S.answered = true;
    var c = S.cur, picked = S.opts[i];
    var correct = picked.toLowerCase() === c.answer.toLowerCase();
    S.lastCorrect = correct;
    var per = S.stats.per[c.group] || (S.stats.per[c.group] = { right: 0, total: 0 });
    per.total++;
    if (correct) { per.right++; S.streak++; } else { S.streak = 0; }
    $('streak').textContent = S.streak;
    for (var k = 0; k < 2; k++) {
      var b = $('opt' + k);
      b.classList.add('locked');
      var isAns = S.opts[k].toLowerCase() === c.answer.toLowerCase();
      if (isAns) { b.classList.add('correct'); b.querySelector('.mark').textContent = '✓ heard'; }
      else if (k === i) { b.classList.add('wrong'); b.querySelector('.mark').textContent = '✗'; }
      else b.classList.add('dim');
    }
    var v = $('verdict');
    v.textContent = correct ? 'Yes — that’s the one. How hard was it?' : 'Not quite — it was “' + c.answer + '”.';
    v.className = 'verdict show ' + (correct ? 'ok' : 'no');
    if (S.srs) {
      [].forEach.call($('rate').children, function (b) { b.querySelector('small').textContent = previewIvl(c, b.dataset.r); });
      $('rate').classList.add('show');
      $('rate').querySelector('.r-good').focus();
    } else {
      $('next').classList.add('show');
      $('nextbtn').focus();
    }
  }

  function rate(rating) {
    if (!S.answered || !S.srs) return;
    applyRating(S.cur, rating);
    S.stats.done++; if (S.lastCorrect) S.stats.correct++;
    serveNext();
  }

  function advance() { // practice mode (no scheduling)
    S.stats.done++; if (S.lastCorrect) S.stats.correct++;
    S.idx++;
    if (S.idx >= S.deck.length) finish(); else serve(S.deck[S.idx]);
  }

  function updateCounts() {
    if (S.srs) $('counts').innerHTML = 'Due <b>' + (S.reviewQueue.length + S.learn.length) + '</b> · New <b>' + S.newQueue.length + '</b>';
    else $('counts').innerHTML = '<b>' + (S.idx + 1) + '</b> / ' + S.deck.length;
  }

  function updateProgress() {
    var frac;
    if (S.srs) {
      var m = S.pool.filter(function (c) { var e = SCHED[cidOf(c)]; return e && e.state === 'review'; }).length;
      frac = S.pool.length ? m / S.pool.length : 0;
    } else {
      frac = S.deck.length ? S.idx / S.deck.length : 0;
    }
    $('prog').style.width = (frac * 100) + '%';
  }

  function finish() {
    show('results');
    var st = S.stats, pct = st.done ? Math.round(st.correct / st.done * 100) : 0;
    animateNum($('rpct'), pct);
    var line = pct >= 90 ? 'A very fine ear — you’re catching what most people miss.'
      : pct >= 70 ? 'Solid. The contrasts are landing.'
        : st.done ? 'Early days for these sounds — repetition is the whole game.' : '';
    if (S.srs) {
      var n = now(), soonest = Infinity;
      S.pool.forEach(function (c) { var e = SCHED[cidOf(c)]; if (e && e.due > n) soonest = Math.min(soonest, e.due); });
      line += soonest < Infinity ? ' Next review in ' + fmtDays((soonest - n) / DAY) + '.' : ' Nothing queued right now.';
    }
    $('rline').textContent = (st.done ? st.done + ' cards rated. ' : '') + line;
    var bd = $('breakdown');
    bd.innerHTML = '';
    (DECK.groups || []).forEach(function (g) {
      var d = st.per[g.id];
      if (!d || d.total === 0) return;
      var p = Math.round(d.right / d.total * 100);
      var row = document.createElement('div');
      row.className = 'brow';
      row.innerHTML = '<div class="lab"><span class="name"></span><span class="ph"></span></div>' +
        '<div class="track"><i></i></div><div class="pct"></div>';
      row.querySelector('.name').textContent = g.label || g.id;
      row.querySelector('.ph').textContent = g.ipa || '';
      row.querySelector('.pct').textContent = p + '%';
      bd.appendChild(row);
      setTimeout(function () { row.querySelector('.track i').style.width = p + '%'; }, 80);
    });
  }

  function animateNum(el, target) {
    var n = 0, step = Math.max(1, Math.ceil(target / 30));
    var t = setInterval(function () {
      n += step;
      if (n >= target) { n = target; clearInterval(t); }
      el.textContent = n;
    }, 22);
  }

  /* ------------------------- progress: export / import / reset (results) */

  function updateSaveNote() {
    $('savenote').textContent = NO_PERSIST
      ? 'Saving unavailable here — open the file in a browser to keep your progress.'
      : (Object.keys(SCHED).length ? 'Progress saved on this device.' : '');
  }

  /* ------------------------------------------------------------ wiring */

  function init() {
    if (!DECK) {
      document.body.innerHTML = '<div class="wrap"><h1 class="lede">Deck missing.</h1>' +
        '<p class="blurb">data/deck.js did not load. Check that it sits next to index.html.</p></div>';
      return;
    }
    GROUPS = window.HTD.groupsById(DECK);
    CARDS = window.HTD.playable(DECK); // a card with no recording cannot be heard
    var silent = (DECK.cards || []).length - CARDS.length;

    renderStart();
    if (silent) {
      $('needsaudio').classList.remove('hidden');
      $('needsaudio-n').textContent = silent;
    }
    if (window.HTD.readDraft()) $('draftnote').classList.remove('hidden');

    $('filter').addEventListener('click', function (e) {
      if (e.target.tagName !== 'BUTTON') return;
      [].forEach.call($('filter').children, function (b) { b.classList.remove('on'); });
      e.target.classList.add('on');
      S.filter = e.target.dataset.f;
    });
    $('begin').addEventListener('click', startQuiz);
    player.addEventListener('ended', function () { playing(false); });
    $('play').addEventListener('click', playAudio);
    $('opt0').addEventListener('click', function () { choose(0); });
    $('opt1').addEventListener('click', function () { choose(1); });
    $('nextbtn').addEventListener('click', advance);
    $('rate').addEventListener('click', function (e) {
      var b = e.target.closest('.rbtn');
      if (b) rate(b.dataset.r);
    });
    $('again').addEventListener('click', startQuiz);
    $('back').addEventListener('click', function () { show('start'); });

    $('export').addEventListener('click', function () {
      window.HTD.download(new Blob([JSON.stringify(SCHED)], { type: 'application/json' }), 'progress-en.json');
    });
    $('import').addEventListener('click', function () { $('importfile').click(); });
    $('importfile').addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try { Object.assign(SCHED, JSON.parse(r.result)); saveSched(); $('savenote').textContent = 'Progress imported.'; }
        catch (err) { $('savenote').textContent = 'Could not read file.'; }
      };
      r.readAsText(f);
    });
    $('reset').addEventListener('click', function () {
      if (confirm('Erase all saved progress?')) { SCHED = {}; saveSched(); $('savenote').textContent = 'Reset.'; }
    });

    document.addEventListener('keydown', function (e) {
      if ($('quiz').classList.contains('hidden')) return;
      if (e.key === 'r' || e.key === 'R') { playAudio(); return; }
      if (!S.answered) {
        if (e.key === '1') choose(0);
        else if (e.key === '2') choose(1);
        return;
      }
      if (S.srs) {
        var map = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
        if (map[e.key]) rate(map[e.key]);
        else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); rate('good'); }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        advance();
      }
    });

    updateSaveNote();
  }

  init();
})();
