/* Study section — shared layer for the menu, the card player and the editor.
 *
 * Everything the study section needs lives in study/, and nothing outside it
 * depends on anything in here. Deleting the folder (and the one link on the
 * drill's start page) removes the section without a trace.
 *
 * Responsibilities:
 *   - read the published decks (study/data/study.js) or an unpublished draft
 *   - store draft pictures, recordings and PDFs in the browser until published
 *   - the spaced-repetition scheduler and the learner's progress
 *   - register the app's service worker, so these pages work offline too
 *
 * Classic script, not an ES module, so the pages still work off disk.
 */
(function (global) {
  'use strict';

  var DRAFT_KEY = 'study-draft-v1';
  var SRS_KEY = 'study-srs-v1';
  var IDB_NAME = 'study-media';
  var IDB_STORE = 'blobs';
  var IDB_PREFIX = 'idb:';

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function slugify(text, fallback) {
    var s = String(text || '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return (s || fallback || 'item').slice(0, 60);
  }

  function newId(prefix) {
    return (prefix || 'c') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  /* ---------------------------------------------------- draft media store
   *
   * Pictures, recordings and PDFs added in the editor live in IndexedDB until
   * they are published into study/. A field that holds "idb:…" points here;
   * anything else is a path relative to study/.
   */

  function openDB() {
    return new Promise(function (resolve, reject) {
      if (!global.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
      var req = global.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function tx(mode, run) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(IDB_STORE, mode);
        var out = run(t.objectStore(IDB_STORE));
        t.oncomplete = function () { db.close(); resolve(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { db.close(); reject(t.error); };
      });
    });
  }

  var media = {
    isDraft: function (ref) { return typeof ref === 'string' && ref.indexOf(IDB_PREFIX) === 0; },
    put: function (blob) {
      var key = IDB_PREFIX + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      return tx('readwrite', function (s) { s.put(blob, key); }).then(function () { return key; });
    },
    get: function (key) { return tx('readonly', function (s) { return s.get(key); }); },
    del: function (key) { return tx('readwrite', function (s) { s.delete(key); }).catch(function () {}); },
    /* Something an <img>, <audio> or link can use. Draft blobs become object
     * URLs; the caller revokes them when done (see urls.release). */
    url: function (ref) {
      if (!ref) return Promise.resolve(null);
      if (!media.isDraft(ref)) return Promise.resolve(ref);
      return media.get(ref).then(function (blob) { return blob ? URL.createObjectURL(blob) : null; })
        .catch(function () { return null; });
    }
  };

  /* ------------------------------------------------------------- the data */

  function published() {
    return global.STUDY_DATA ? clone(global.STUDY_DATA) : null;
  }

  function readDraft() {
    try {
      var raw = global.localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveDraft(data) {
    try { global.localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  }

  function clearDraft() {
    try { global.localStorage.removeItem(DRAFT_KEY); } catch (e) { /* nothing to undo */ }
  }

  function normalise(data) {
    data = data || {};
    data.decks = data.decks || [];
    data.grammar = data.grammar || [];
    data.decks.forEach(function (d) { d.cards = d.cards || []; });
    return data;
  }

  /* What the learner pages run on: the editor's draft in this browser if
   * there is one, otherwise the published file. Same rule as the drill. */
  function load() {
    var d = readDraft() || published();
    return d ? normalise(d) : null;
  }

  function deckById(data, id) {
    return data.decks.find(function (d) { return d.id === id; }) || null;
  }

  /* A card the player can actually show. A picture card needs something on
   * the front (picture or hint) and a word on the back; a verb card needs the
   * base form and every form the deck asks for. */
  function usable(deck, c) {
    if (deck.kind === 'verb') {
      return !!(c.base && c.past && (!deck.participle || c.participle));
    }
    return !!(c.word && (c.image || c.hint));
  }

  function usableCards(deck) {
    return deck.cards.filter(function (c) { return usable(deck, c); });
  }

  /* ------------------------------------------------- spaced repetition
   *
   * The drill's scheduler, kept separately so the two sections share no
   * state: progress here is keyed "<deck>|<card>" under its own storage key.
   */

  var DAY = 86400000, MIN_EASE = 1.3, MAX_EASE = 3.0;

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
    } else {
      e.ease = Math.min(MAX_EASE, (e.ease || 2.5) + 0.15);
      e.ivl = wasReview ? Math.max(2, e.ivl * e.ease * 1.3) : 4; e.state = 'review';
    }
    return e;
  }

  function fmtDays(d) {
    if (d < 0.99) return '<1 d';
    if (d < 30) return Math.round(d) + ' d';
    return Math.round(d / 7) + ' wk';
  }

  var progress = {
    persisted: true,
    all: {},
    key: function (deck, card) { return deck.id + '|' + card.id; },
    load: function () {
      try { var raw = global.localStorage.getItem(SRS_KEY); progress.all = raw ? JSON.parse(raw) : {}; }
      catch (e) { progress.all = {}; progress.persisted = false; }
      return progress.all;
    },
    save: function () {
      try { global.localStorage.setItem(SRS_KEY, JSON.stringify(progress.all)); }
      catch (e) { progress.persisted = false; }
    },
    get: function (deck, card) { return progress.all[progress.key(deck, card)] || null; },
    rate: function (deck, card, rating) {
      var k = progress.key(deck, card), prev = progress.all[k];
      var e = grade(prev, rating);
      e.reps = ((prev && prev.reps) || 0) + 1;
      e.due = e.state === 'learning' ? Date.now() : Date.now() + Math.round(e.ivl * DAY);
      progress.all[k] = e;
      progress.save();
      return e;
    },
    preview: function (deck, card, rating) {
      var e = grade(progress.get(deck, card), rating);
      return e.state === 'learning' ? 'soon' : fmtDays(e.ivl);
    },
    counts: function (deck) {
      var n = Date.now(), due = 0, fresh = 0;
      usableCards(deck).forEach(function (c) {
        var e = progress.get(deck, c);
        if (!e) fresh++; else if (e.due <= n) due++;
      });
      return { due: due, fresh: fresh };
    }
  };
  progress.load();

  /* ------------------------------------------------------ offline support
   *
   * The service worker is the drill's (../sw.js); it covers this folder when
   * the folder exists. Off disk there is no service worker and nothing to do.
   */
  function registerOffline() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    global.addEventListener('load', function () {
      navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(function () {});
    });
  }

  global.STUDY = {
    clone: clone,
    slugify: slugify,
    newId: newId,
    media: media,
    load: load,
    published: published,
    readDraft: readDraft,
    saveDraft: saveDraft,
    clearDraft: clearDraft,
    normalise: normalise,
    deckById: deckById,
    usable: usable,
    usableCards: usableCards,
    progress: progress,
    fmtDays: fmtDays,
    DAY: DAY,
    registerOffline: registerOffline
  };
})(window);
