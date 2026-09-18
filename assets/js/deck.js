/* Hear the Difference — shared deck layer.
 *
 * Sits between the two pages and the data. Responsibilities:
 *   - read the published deck (data/deck.js) and any unpublished editor draft
 *   - hand out a playable URL for a card, whether its audio lives on disk or
 *     in the browser as a not-yet-published recording
 *   - serialise a deck back into data/deck.js, and zip up a release
 *
 * Classic script, not an ES module, on purpose: modules are blocked by CORS on
 * file:// and this app is meant to survive being double-clicked.
 */
(function (global) {
  'use strict';

  var DRAFT_KEY = 'htd-deck-draft-v1';
  var IDB_NAME = 'htd-audio';
  var IDB_STORE = 'blobs';
  var IDB_PREFIX = 'idb:';

  /* ---------------------------------------------------------------- utils */

  function slugify(text, fallback) {
    var s = String(text || '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return (s || fallback || 'card').slice(0, 60);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  /* Card identity. The original single-file build keyed spaced-repetition
   * progress on this string, so it stays the id for every migrated card and
   * never changes when the text is edited — otherwise an edit would silently
   * reset the learner's schedule for that card. */
  function legacyKey(card) {
    return card.group + '|' + card.options[0] + '|' + card.options[1] + '>' + card.answer;
  }

  function cardKey(card) {
    return card.id || legacyKey(card);
  }

  function newCardId() {
    return 'card-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  /* ------------------------------------------------------ audio blob store
   *
   * IndexedDB rather than localStorage: recordings are megabytes, and
   * localStorage is a ~5 MB synchronous string store that throws once it is
   * full. Draft audio lives here until it is published to audio/ on disk.
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

  var audioStore = {
    isDraftRef: function (ref) { return typeof ref === 'string' && ref.indexOf(IDB_PREFIX) === 0; },
    put: function (blob) {
      var key = IDB_PREFIX + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      return tx('readwrite', function (store) { store.put(blob, key); }).then(function () { return key; });
    },
    get: function (key) { return tx('readonly', function (store) { return store.get(key); }); },
    del: function (key) { return tx('readwrite', function (store) { store.delete(key); }); }
  };

  /* ------------------------------------------------------------- the deck */

  function published() {
    return global.HTD_DECK ? clone(global.HTD_DECK) : null;
  }

  function readDraft() {
    try {
      var raw = global.localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveDraft(deck) {
    try {
      global.localStorage.setItem(DRAFT_KEY, JSON.stringify(deck));
      return true;
    } catch (e) {
      return false; // quota or private mode; caller surfaces it
    }
  }

  function clearDraft() {
    try { global.localStorage.removeItem(DRAFT_KEY); } catch (e) { /* nothing to undo */ }
  }

  /* The deck both pages actually run on: the draft if the editor has one,
   * otherwise whatever is committed in data/deck.js. */
  function load() {
    return readDraft() || published();
  }

  function groupsById(deck) {
    var map = {};
    (deck.groups || []).forEach(function (g) { map[g.id] = g; });
    return map;
  }

  /* Resolve a card to something <audio> can play. Draft recordings become
   * object URLs, which the caller must revoke; disk paths are returned as-is. */
  function audioURL(card) {
    if (!card || !card.audio) return Promise.resolve(null);
    if (!audioStore.isDraftRef(card.audio)) return Promise.resolve(card.audio);
    return audioStore.get(card.audio).then(function (blob) {
      return blob ? URL.createObjectURL(blob) : null;
    });
  }

  function playable(deck) {
    return (deck.cards || []).filter(function (c) { return !!c.audio; });
  }

  /* ---------------------------------------------------------- publishing */

  var DECK_HEADER =
    '/* Hear the Difference — deck data.\n' +
    ' *\n' +
    ' * Plain JSON wrapped in one assignment so the app loads with a <script> tag and\n' +
    ' * therefore works when index.html is opened straight off disk (file:// blocks\n' +
    ' * fetch() of a sibling .json). Edit by hand or with editor.html.\n' +
    ' */\n';

  function serialize(deck) {
    return DECK_HEADER + 'window.HTD_DECK = ' + JSON.stringify(deck, null, 2) + ';\n';
  }

  /* Turn a draft into a releasable deck: every draft recording gets a real
   * path under audio/<group>/<slug>.mp3, deduped against names already taken.
   * Returns { deck, files } where files are the blobs to write. */
  function prepareRelease(draft) {
    var deck = clone(draft);
    var taken = {};
    deck.cards.forEach(function (c) {
      if (c.audio && !audioStore.isDraftRef(c.audio)) taken[c.audio] = true;
    });

    var pending = deck.cards.filter(function (c) { return audioStore.isDraftRef(c.audio); });
    return Promise.all(pending.map(function (card) {
      return audioStore.get(card.audio).then(function (blob) {
        var base = 'audio/' + slugify(card.group, 'misc') + '/' + slugify(card.answer, 'card');
        var path = base + '.mp3';
        for (var n = 2; taken[path]; n++) path = base + '-' + n + '.mp3';
        taken[path] = true;
        card.audio = path;
        return { path: path, blob: blob };
      });
    })).then(function (files) {
      return { deck: deck, files: files.filter(function (f) { return !!f.blob; }) };
    });
  }

  /* -------------------------------------------------------------- zipping
   *
   * Minimal store-only (no deflate) ZIP writer. MP3 is already compressed, so
   * storing costs nothing, and it keeps this file dependency-free.
   */

  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function zip(entries) {
    var encoder = new TextEncoder();
    var parts = [];
    var central = [];
    var offset = 0;

    function u32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }
    function u16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }

    entries.forEach(function (entry) {
      var name = encoder.encode(entry.path);
      var data = entry.bytes;
      var sum = crc32(data);
      var local = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(sum), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(new Uint8Array(local), name, data);
      central.push([].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(sum), u32(data.length), u32(data.length), u16(name.length),
        u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset)).concat(Array.from(name)));
      offset += local.length + name.length + data.length;
    });

    var dirBytes = [];
    central.forEach(function (rec) { dirBytes = dirBytes.concat(rec); });
    var end = [].concat(u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
      u32(dirBytes.length), u32(offset), u16(0));

    return new Blob(parts.concat([new Uint8Array(dirBytes), new Uint8Array(end)]),
      { type: 'application/zip' });
  }

  function blobBytes(blob) {
    return blob.arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
  }

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  global.HTD = {
    slugify: slugify,
    clone: clone,
    cardKey: cardKey,
    legacyKey: legacyKey,
    newCardId: newCardId,
    audio: audioStore,
    audioURL: audioURL,
    load: load,
    published: published,
    readDraft: readDraft,
    saveDraft: saveDraft,
    clearDraft: clearDraft,
    groupsById: groupsById,
    playable: playable,
    serialize: serialize,
    prepareRelease: prepareRelease,
    zip: zip,
    blobBytes: blobBytes,
    download: download
  };
})(window);
