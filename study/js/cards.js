/* Study section — the card player, for every deck (cards.html?deck=<id>).
 *
 * Two kinds of deck:
 *   picture — picture (or a hint) on the front, the word on the back; or the
 *             other way round.
 *   verb    — the base form on the front; the learner types the past forms,
 *             or just flips the card.
 * Either way the learner rates the card and the scheduler decides when it
 * comes back, exactly as in the listening drill.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var S = window.STUDY;
  var data = S.load();
  var deckId = new URLSearchParams(location.search).get('deck');
  var deck = data && S.deckById(data, deckId);
  var player = $('player');
  var NEW_CAP = 20, AGAIN_GAP = 0, HARD_GAP = 2;
  var liveURLs = []; // object URLs for draft media on the current card

  S.registerOffline();

  if (!deck) {
    $('lede').textContent = 'Deck not found.';
    $('deckblurb').innerHTML = 'It may have been renamed or removed. <a href="index.html">Back to all decks</a>.';
    $('begin').classList.add('hidden');
    $('mode').parentNode.classList.add('hidden');
    return;
  }

  var CARDS = S.usableCards(deck);
  var MODES = deck.kind === 'verb'
    ? [['type', 'Type the forms'], ['flip', 'Flip']]
    : [['picture', 'Picture → word'], ['word', 'Word → picture']];
  var MODE_KEY = 'study-mode-' + deck.id;

  var st = {
    mode: MODES[0][0], srs: true, pool: [], cur: null, revealed: false, ok: null,
    pos: 0, learn: [], reviewQueue: [], newQueue: [], order: [], idx: 0, done: 0
  };
  try { var m = localStorage.getItem(MODE_KEY); if (MODES.some(function (x) { return x[0] === m; })) st.mode = m; } catch (e) { /* default */ }

  function show(which) {
    ['start', 'study', 'results'].forEach(function (s) { $(s).classList.add('hidden'); });
    var el = $(which);
    el.classList.remove('hidden'); el.classList.remove('fade');
    void el.offsetWidth;
    el.classList.add('fade');
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.random() * (i + 1) | 0; var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* --------------------------------------------------------- start screen */

  function renderStart() {
    document.title = (deck.title || 'Cards') + ' — Hear the Difference';
    $('decktitle').textContent = deck.title || 'Cards';
    $('lede').textContent = deck.title || 'Cards';
    $('deckblurb').textContent = deck.blurb || '';
    var n = S.progress.counts(deck);
    $('dueline').innerHTML = '<b>' + CARDS.length + '</b> cards · Due now <b>' + n.due + '</b> · New <b>' + n.fresh + '</b>';

    var seg = $('mode');
    seg.innerHTML = '';
    MODES.forEach(function (mo) {
      var b = document.createElement('button');
      b.dataset.m = mo[0];
      b.textContent = mo[1];
      if (mo[0] === st.mode) b.className = 'on';
      seg.appendChild(b);
    });
    if (!CARDS.length) {
      $('begin').disabled = true;
      $('dueline').textContent = 'This deck has no finished cards yet.';
    }
  }

  $('mode').addEventListener('click', function (e) {
    if (e.target.tagName !== 'BUTTON') return;
    [].forEach.call($('mode').children, function (b) { b.classList.toggle('on', b === e.target); });
    st.mode = e.target.dataset.m;
    try { localStorage.setItem(MODE_KEY, st.mode); } catch (err) { /* not remembered */ }
  });

  /* -------------------------------------------------------------- session */

  function begin() {
    st.srs = $('srs').checked;
    st.pool = CARDS.slice();
    st.pos = 0; st.learn = []; st.done = 0;
    var now = Date.now();
    st.reviewQueue = st.pool.filter(function (c) { var e = S.progress.get(deck, c); return e && e.due <= now; })
      .sort(function (a, b) { return S.progress.get(deck, a).due - S.progress.get(deck, b).due; });
    st.newQueue = shuffle(st.pool.filter(function (c) { return !S.progress.get(deck, c); })).slice(0, NEW_CAP);
    st.order = shuffle(st.pool.slice()); st.idx = 0;
    $('pill').textContent = deck.title || '';
    show('study');
    prefetch();
    next();
  }

  function pick() {
    if (!st.srs) return st.idx < st.order.length ? st.order[st.idx++] : null;
    if (st.learn.length) {
      var i = st.learn.findIndex(function (x) { return x.at <= st.pos; });
      if (i >= 0) return st.learn.splice(i, 1)[0].c;
    }
    if (st.reviewQueue.length) return st.reviewQueue.shift();
    if (st.newQueue.length) return st.newQueue.shift();
    if (st.learn.length) { st.learn.sort(function (a, b) { return a.at - b.at; }); return st.learn.shift().c; }
    return null;
  }

  function next() {
    var c = pick();
    if (!c) { finish(); return; }
    serve(c);
  }

  function counts() {
    if (st.srs) $('counts').innerHTML = 'Due <b>' + (st.reviewQueue.length + st.learn.length) + '</b> · New <b>' + st.newQueue.length + '</b>';
    else $('counts').innerHTML = '<b>' + st.idx + '</b> / ' + st.order.length;
    var frac;
    if (st.srs) {
      var known = st.pool.filter(function (c) { var e = S.progress.get(deck, c); return e && e.state === 'review'; }).length;
      frac = st.pool.length ? known / st.pool.length : 0;
    } else frac = st.order.length ? (st.idx - 1) / st.order.length : 0;
    $('prog').style.width = (frac * 100) + '%';
  }

  /* ------------------------------------------------------------ one card */

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function releaseURLs() {
    liveURLs.forEach(function (u) { URL.revokeObjectURL(u); });
    liveURLs = [];
  }

  function mediaInto(ref, apply) {
    return S.media.url(ref).then(function (u) {
      if (!u) return;
      if (u.indexOf('blob:') === 0) liveURLs.push(u);
      apply(u);
    });
  }

  function picture(c) {
    var img = el('img');
    img.alt = st.revealed ? c.word : 'Picture to name';
    mediaInto(c.image, function (u) { img.src = u; });
    return img;
  }

  function sayButton(c) {
    var b = el('button', 'say', '▶ Hear it');
    b.type = 'button';
    b.addEventListener('click', function (e) { e.stopPropagation(); play(c); });
    return b;
  }

  function play(c) {
    if (!c.audio) return;
    mediaInto(c.audio, function (u) {
      player.src = u;
      player.play().catch(function () { /* the learner can press the button again */ });
    });
  }

  /* The hint is a translation or a sentence with a gap ("___"). A sentence
   * reads better set larger when it is the whole front of the card. */
  function hintEl(text, asFront) {
    return el('div', asFront && /_{2,}/.test(text) ? 'gap' : 'hint', text);
  }

  function renderPicture(face, c) {
    var pictureFirst = st.mode === 'picture';
    if (pictureFirst) {
      if (c.image) face.appendChild(picture(c)); else face.appendChild(hintEl(c.hint, true));
    } else {
      face.appendChild(el('div', 'big', c.word));
      if (c.audio) face.appendChild(sayButton(c));
    }
    if (!st.revealed) { face.appendChild(el('div', 'tap', 'Tap to show the answer')); return; }
    face.appendChild(el('hr', 'rule'));
    if (pictureFirst) {
      face.appendChild(el('div', 'big', c.word));
      if (c.image && c.hint) face.appendChild(hintEl(c.hint));
      if (c.audio) face.appendChild(sayButton(c));
    } else {
      if (c.image) face.appendChild(picture(c));
      if (c.hint) face.appendChild(hintEl(c.hint, !c.image));
    }
  }

  function forms(c) {
    var f = [['past', 'Past simple', c.past]];
    if (deck.participle) f.push(['participle', 'Past participle', c.participle]);
    return f;
  }

  /* Accept any listed spelling ("learned / learnt"), ignoring case, spacing
   * and the curly apostrophe a phone keyboard may insert. */
  function norm(s) { return String(s || '').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim(); }
  function accepts(expected, given) {
    var g = norm(given);
    return !!g && String(expected).split(/[\/,]/).some(function (x) { return norm(x) === g; });
  }

  function renderVerb(face, c) {
    face.appendChild(el('div', 'big', c.base));
    if (c.meaning) face.appendChild(el('div', 'hint', c.meaning));

    if (st.mode === 'type') {
      var box = el('div', 'forms');
      forms(c).forEach(function (f) {
        var wrap = el('div');
        var lab = el('label', '', f[1]);
        var input = el('input');
        input.id = 'in-' + f[0];
        lab.htmlFor = input.id;
        input.autocomplete = 'off'; input.autocapitalize = 'off'; input.spellcheck = false;
        input.setAttribute('autocorrect', 'off');
        input.dataset.expect = f[2];
        wrap.appendChild(lab); wrap.appendChild(input); wrap.appendChild(el('div', 'fix'));
        box.appendChild(wrap);
      });
      face.appendChild(box);
      return;
    }

    if (!st.revealed) { face.appendChild(el('div', 'tap', 'Tap to show the forms')); return; }
    face.appendChild(el('hr', 'rule'));
    var line = el('div', 'formline');
    forms(c).forEach(function (f, i) {
      if (i) line.appendChild(el('span', '', '·'));
      line.appendChild(document.createTextNode(f[2]));
    });
    face.appendChild(line);
    face.appendChild(el('div', 'formlabels', forms(c).map(function (f) { return f[1]; }).join(' · ')));
  }

  function render() {
    var c = st.cur, face = $('face');
    releaseURLs();
    face.innerHTML = '';
    face.classList.toggle('revealed', st.revealed || typing());
    if (deck.kind === 'verb') renderVerb(face, c); else renderPicture(face, c);
  }

  function typing() { return deck.kind === 'verb' && st.mode === 'type'; }

  function serve(c) {
    st.cur = c; st.revealed = false; st.ok = null; st.pos++;
    $('verdict').className = 'verdict'; $('verdict').textContent = '';
    $('rate').classList.remove('show'); $('next').classList.remove('show');
    $('reveal').classList.remove('hidden');
    $('reveal').textContent = typing() ? 'Check' : 'Show answer';
    counts();
    render();
    if (typing()) { var first = $('face').querySelector('input'); if (first) first.focus(); }
    else if (deck.kind === 'picture' && st.mode === 'word') play(c);
  }

  function reveal() {
    if (st.revealed || !st.cur) return;
    if (typing()) { check(); return; }
    st.revealed = true;
    render();
    if (deck.kind === 'picture' && st.mode === 'picture') play(st.cur);
    afterReveal();
  }

  function check() {
    var all = true;
    [].forEach.call($('face').querySelectorAll('input'), function (input) {
      var right = accepts(input.dataset.expect, input.value);
      all = all && right;
      input.classList.add(right ? 'right' : 'wrong');
      input.readOnly = true;
      input.parentNode.querySelector('.fix').textContent = right ? '' : input.dataset.expect;
    });
    st.revealed = true; st.ok = all;
    $('face').classList.add('revealed');
    var v = $('verdict');
    v.textContent = all ? 'Yes — that’s right. How hard was it?' : 'Not quite — the right forms are shown.';
    v.className = 'verdict show ' + (all ? 'ok' : 'no');
    afterReveal();
  }

  function afterReveal() {
    $('reveal').classList.add('hidden');
    if (st.srs) {
      [].forEach.call($('rate').children, function (b) { b.querySelector('small').textContent = S.progress.preview(deck, st.cur, b.dataset.r); });
      $('rate').classList.add('show');
      $('rate').querySelector(st.ok === false ? '.r-again' : '.r-good').focus();
    } else {
      $('next').classList.add('show');
      $('nextbtn').focus();
    }
  }

  function rate(r) {
    if (!st.revealed || !st.srs) return;
    var e = S.progress.rate(deck, st.cur, r);
    if (e.state === 'learning') st.learn.push({ c: st.cur, at: st.pos + (r === 'again' ? AGAIN_GAP : HARD_GAP) });
    st.done++;
    next();
  }

  function finish() {
    releaseURLs();
    show('results');
    var line = st.done ? st.done + ' card' + (st.done > 1 ? 's' : '') + ' done.' : 'Nothing was due.';
    if (st.srs) {
      var now = Date.now(), soonest = Infinity;
      st.pool.forEach(function (c) { var e = S.progress.get(deck, c); if (e && e.due > now) soonest = Math.min(soonest, e.due); });
      line += soonest < Infinity ? ' Next review in ' + S.fmtDays((soonest - now) / S.DAY) + '.' : '';
    }
    if (!S.progress.persisted) line += ' Progress could not be saved in this browser.';
    $('rline').textContent = line;
  }

  /* Once installed, pictures are saved as they are shown. Opening a deck
   * also fetches the rest of its pictures in the background, a few at a
   * time, so the whole deck works offline after one visit online. */
  function prefetch() {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller || !navigator.onLine) return;
    var queue = deck.cards.map(function (c) { return c.image; })
      .concat(deck.cards.map(function (c) { return c.audio; }))
      .filter(function (p) { return p && !S.media.isDraft(p); });
    function worker() {
      var p = queue.shift();
      if (!p) return Promise.resolve();
      return fetch(p).catch(function () {}).then(worker);
    }
    for (var i = 0; i < 4; i++) worker();
  }

  /* --------------------------------------------------------------- wiring */

  $('begin').addEventListener('click', begin);
  $('again').addEventListener('click', function () { renderStart(); begin(); });
  $('reveal').addEventListener('click', reveal);
  $('face').addEventListener('click', function (e) {
    if (e.target.tagName === 'INPUT' || typing()) return;
    reveal();
  });
  $('nextbtn').addEventListener('click', function () { st.done++; next(); });
  $('rate').addEventListener('click', function (e) {
    var b = e.target.closest('.rbtn');
    if (b) rate(b.dataset.r);
  });

  document.addEventListener('keydown', function (e) {
    if ($('study').classList.contains('hidden')) return;
    var inInput = e.target.tagName === 'INPUT' && !e.target.readOnly;
    if (inInput) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var inputs = [].slice.call($('face').querySelectorAll('input'));
        var i = inputs.indexOf(e.target);
        if (i < inputs.length - 1 && !inputs[i + 1].value) inputs[i + 1].focus(); else check();
      }
      return;
    }
    if (!st.revealed) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); reveal(); }
      return;
    }
    if (st.srs) {
      var map = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
      if (map[e.key]) rate(map[e.key]);
      else if (e.key === ' ') { e.preventDefault(); rate(st.ok === false ? 'again' : 'good'); }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); st.done++; next();
    }
  });

  renderStart();
})();
