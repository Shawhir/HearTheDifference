/* Hear the Difference — service worker.
 *
 * What makes the drill installable and lets it run with no connection. It
 * keeps a copy of the drill and every recording the deck names, and answers
 * from that copy whenever the network cannot.
 *
 *   - Pages, scripts, styles and the deck: network first, so a pushed update
 *     shows up on the next launch; the saved copy only when offline.
 *   - Recordings, fonts and images: saved copy first, since they are the
 *     bulk and rarely change; refreshed in the background after each use.
 *
 * The editor is left alone. Its files are never saved or served from here,
 * so it keeps working exactly as it does without the app. The same goes for
 * the study section's editor.
 *
 * The study section (study/) is optional: its pages are saved when the
 * folder exists and silently skipped when it does not, so deleting the
 * folder needs no change here. Its pictures are saved as they are viewed
 * (study/js/cards.js fetches a deck's pictures when it is opened), its
 * grammar PDFs as soon as the data naming them arrives.
 *
 * Bump VERSION to throw every saved copy away and start again.
 */
'use strict';

var VERSION = 'htd-v2';

var CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'data/deck.js',
  'assets/js/deck.js',
  'assets/js/quiz.js',
  'assets/js/app.js',
  'assets/css/app.css',
  'assets/css/fonts.css',
  'assets/cg-langues-logo.png',
  'assets/icons/cg-favicon-64.png',
  'assets/icons/cg-icon-192.png',
  'assets/icons/cg-icon-512.png',
  'assets/icons/cg-icon-maskable-512.png',
  'assets/icons/cg-apple-touch-icon.png',
  'assets/fonts/manrope-latin-wght-normal.woff2',
  'assets/fonts/manrope-latin-ext-wght-normal.woff2',
  'assets/fonts/poppins-latin-400-normal.woff2',
  'assets/fonts/poppins-latin-500-normal.woff2',
  'assets/fonts/poppins-latin-600-normal.woff2',
  'assets/fonts/poppins-latin-700-normal.woff2',
  'assets/fonts/poppins-latin-ext-400-normal.woff2',
  'assets/fonts/poppins-latin-ext-500-normal.woff2',
  'assets/fonts/poppins-latin-ext-600-normal.woff2',
  'assets/fonts/poppins-latin-ext-700-normal.woff2',
];

/* Study section: saved if present, skipped if not. */
var STUDY_CORE = [
  'study/',
  'study/index.html',
  'study/cards.html',
  'study/data/study.js',
  'study/js/study.js',
  'study/js/menu.js',
  'study/js/cards.js',
  'study/css/study.css',
];

var EDITOR_ONLY = /\/(editor\.html|assets\/js\/editor\.js|assets\/css\/editor\.css|study\/js\/editor\.js)$/;
var SAVED_FIRST = /\/(audio|assets\/fonts|assets\/icons|study\/images|study\/audio|study\/grammar)\/|\.(mp3|m4a|ogg|wav|webm|png|svg|webp|jpe?g|gif|pdf|woff2)$/;
var NETWORK_TIMEOUT_MS = 4000;

function url(path) { return new URL(path, self.registration.scope).href; }

/* The deck is a script, not JSON (see data/deck.js), so the recordings it
 * names are pulled out of its text rather than parsed. */
function audioPaths(deckText) {
  // Card recordings ("audio": "audio/…") and recordings made for comparing
  // the pair ("words": { "hair": "audio/words/hair.mp3" }) alike.
  var paths = [], re = /"(audio\/[^"]+)"/g, m;
  while ((m = re.exec(deckText))) paths.push(m[1]);
  return paths;
}

/* The study data names its grammar sheets as "file" paths relative to
 * study/. They are small and meant to be read offline, so save them all. */
function saveStudyFiles(cache, dataText) {
  var re = /"file"\s*:\s*"([^"]+)"/g, m, paths = [];
  while ((m = re.exec(dataText))) if (m[1].indexOf('idb:') !== 0) paths.push('study/' + m[1]);
  return Promise.all(paths.map(function (p) {
    var u = url(p);
    return cache.match(u).then(function (hit) {
      if (hit) return;
      return fetch(u).then(function (res) { if (res.ok) return cache.put(u, res); }).catch(function () {});
    });
  }));
}

function saveStudy(cache) {
  return Promise.all(STUDY_CORE.map(function (p) {
    return fetch(url(p)).then(function (res) {
      if (!res.ok) return;
      var copy = res.clone();
      return cache.put(url(p), res).then(function () {
        if (p === 'study/data/study.js') return copy.text().then(function (t) { return saveStudyFiles(cache, t); });
      });
    }).catch(function () { /* no study section, or offline: skip */ });
  }));
}

/* Save any recording the deck names that is not saved yet. Runs at install
 * and again whenever a newer deck arrives, so cards added later still play
 * offline without having been played online first. */
function saveRecordings(cache, deckText) {
  return Promise.all(audioPaths(deckText).map(function (p) {
    var u = url(p);
    return cache.match(u).then(function (hit) {
      if (hit) return;
      return fetch(u).then(function (res) { if (res.ok) return cache.put(u, res); })
        .catch(function () { /* try again next time the deck loads */ });
    });
  }));
}

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(VERSION).then(function (cache) {
    return cache.addAll(CORE.map(url)).then(function () {
      return cache.match(url('data/deck.js'));
    }).then(function (res) {
      return res.text();
    }).then(function (text) {
      return saveRecordings(cache, text);
    }).then(function () {
      return saveStudy(cache);
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function timeout(ms) {
  return new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, ms); });
}

function networkFirst(event, key) {
  /* Copy the response as it arrives, before the page can start reading it. */
  var got = fetch(event.request).then(function (res) {
    return { res: res, copy: res.ok ? res.clone() : null };
  });
  var fresh = got.then(function (g) { return g.res; });
  event.waitUntil(got.then(function (g) {
    if (!g.copy) return;
    return caches.open(VERSION).then(function (cache) {
      var text = key === url('data/deck.js') || key === url('study/data/study.js') ? g.copy.clone().text() : null;
      return cache.put(key, g.copy).then(function () {
        if (!text) return;
        return text.then(function (t) {
          return key === url('data/deck.js') ? saveRecordings(cache, t) : saveStudyFiles(cache, t);
        });
      });
    });
  }).catch(function () { /* offline: the saved copy answers below */ }));
  return Promise.race([fresh, timeout(NETWORK_TIMEOUT_MS)]).catch(function () {
    return caches.match(key).then(function (hit) { return hit || fresh; });
  });
}

/* <audio> asks for byte ranges, and Safari will not play a recording served
 * whole in answer to one, so a saved copy is cut to the range asked for. */
function ranged(request, res) {
  var range = request.headers.get('range');
  var m = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (!m) return Promise.resolve(res);
  return res.blob().then(function (blob) {
    var start = m[1] ? parseInt(m[1], 10) : Math.max(0, blob.size - parseInt(m[2], 10));
    var end = m[1] && m[2] ? Math.min(parseInt(m[2], 10), blob.size - 1) : blob.size - 1;
    return new Response(blob.slice(start, end + 1), {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
        'Content-Length': String(end - start + 1),
        'Content-Range': 'bytes ' + start + '-' + end + '/' + blob.size,
        'Accept-Ranges': 'bytes'
      }
    });
  });
}

function savedFirst(event, key) {
  return caches.open(VERSION).then(function (cache) {
    return cache.match(key).then(function (hit) {
      /* Refresh from a plain request: a range request comes back 206, which
       * the cache refuses to store. */
      var refresh = fetch(key).then(function (res) {
        if (res.ok) return cache.put(key, res.clone()).then(function () { return res; });
        return res;
      });
      if (hit) {
        event.waitUntil(refresh.catch(function () {}));
        return ranged(event.request, hit);
      }
      return refresh.then(function (res) { return res.ok ? ranged(event.request, res) : res; });
    });
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var u = new URL(req.url);
  if (u.origin !== self.location.origin) return;
  if (EDITOR_ONLY.test(u.pathname)) return;

  var key = u.origin + u.pathname;
  if (req.mode === 'navigate') key = u.pathname.endsWith('/') ? url('./') : key;

  event.respondWith(SAVED_FIRST.test(u.pathname) ? savedFirst(event, key) : networkFirst(event, key));
});
