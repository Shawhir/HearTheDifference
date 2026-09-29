/* Study section — editor for the card decks and grammar sheets.
 *
 * Works like the listening drill's editor: changes are a draft in this
 * browser (text in localStorage, pictures, recordings and PDFs in
 * IndexedDB), and publishing writes them into study/ in the project, either
 * in place (File System Access API) or as a zip to unpack over the project.
 *
 * Borrows the zip writer and download helper from ../assets/js/deck.js.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var S = window.STUDY;
  var H = window.HTD;

  var data = S.load() || S.normalise({ version: 1 });
  var deckId = null;
  var selectedId = null;
  var staged = { image: null, audio: null }; // media refs for the card being edited
  var recorder = null;
  var projectDir = null;
  var thumbURLs = [];
  var formURL = null, previewURL = null;
  var importPics = {}; // lower-cased file name -> File, for the importer

  /* ------------------------------------------------------------- helpers */

  function msg(el, text, kind) {
    el.textContent = text || '';
    el.className = 'msg' + (kind ? ' ' + kind : '');
  }

  function touch() {
    if (!S.saveDraft(data)) {
      msg($('topmsg'), 'Could not save the draft — this browser is out of storage or in private mode. Publish now so you do not lose the work.', 'err');
    }
    render();
  }

  function deck() { return S.deckById(data, deckId); }

  function isVerb() { var d = deck(); return !!d && d.kind === 'verb'; }

  function allMedia(d) {
    var refs = [];
    (d.decks || []).forEach(function (dk) {
      (dk.cards || []).forEach(function (c) { if (c.image) refs.push(c.image); if (c.audio) refs.push(c.audio); });
    });
    (d.grammar || []).forEach(function (g) { if (g.file) refs.push(g.file); });
    return refs;
  }

  function dropIfDraft(ref) { if (S.media.isDraft(ref)) S.media.del(ref); }

  /* ------------------------------------------------------------- pictures
   *
   * Photos straight off a phone are several megabytes. Every picture is
   * scaled to at most 800px on its long side and re-encoded (WebP where the
   * browser can write it, JPEG otherwise), which usually lands at 20–80 KB.
   * SVG drawings are kept as they are. If re-encoding would make a file
   * bigger, the original is kept.
   */

  var MAX_SIDE = 800;

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var u = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(u); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(u); reject(new Error('not a picture this browser can read')); };
      img.src = u;
    });
  }

  function encode(canvas, type, quality) {
    return new Promise(function (resolve) { canvas.toBlob(resolve, type, quality); });
  }

  function preparePicture(file) {
    if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name || '')) {
      return Promise.resolve(new Blob([file], { type: 'image/svg+xml' }));
    }
    return loadImage(file).then(function (img) {
      var scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      var ctx = canvas.getContext('2d');
      return encode(canvas, 'image/webp', 0.82).then(function (webp) {
        if (webp && webp.type === 'image/webp') {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          return encode(canvas, 'image/webp', 0.82);
        }
        // No WebP encoder (older Safari): JPEG has no transparency, so paint white first.
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return encode(canvas, 'image/jpeg', 0.85);
      }).then(function (out) {
        var webReady = /^image\/(jpeg|png|webp|gif)$/.test(file.type);
        if (!out || (webReady && out.size >= file.size && scale === 1)) return file;
        return out;
      });
    });
  }

  function extFor(blob, fallback) {
    var t = (blob && blob.type) || '';
    var map = {
      'image/svg+xml': 'svg', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
      'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'm4a',
      'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/webm': 'webm',
      'application/pdf': 'pdf'
    };
    return map[t.split(';')[0]] || fallback;
  }

  /* ---------------------------------------------------------------- decks */

  var KIND_TEXT = {
    picture: 'Picture cards. The kind of a deck is fixed once it is created.',
    verb: 'Verb forms. The kind of a deck is fixed once it is created.'
  };

  function renderDeckSelect() {
    var sel = $('deck');
    sel.innerHTML = '';
    data.decks.forEach(function (d) {
      var o = document.createElement('option');
      o.value = d.id;
      o.textContent = (d.title || d.id) + ' (' + d.cards.length + ')';
      sel.appendChild(o);
    });
    if (!data.decks.length) {
      var o = document.createElement('option');
      o.textContent = 'No decks yet — create one';
      o.value = '';
      sel.appendChild(o);
    }
    if (!deck() && data.decks.length) deckId = data.decks[0].id;
    sel.value = deckId || '';
  }

  function renderSettings() {
    var d = deck();
    $('settings').classList.toggle('hidden', !d);
    $('importbox').classList.toggle('hidden', !d);
    if (!d) return;
    $('ds-title').value = d.title || '';
    $('ds-blurb').value = d.blurb || '';
    $('ds-participle-row').classList.toggle('hidden', d.kind !== 'verb');
    $('ds-participle').checked = !!d.participle;
    $('ds-kind').textContent = KIND_TEXT[d.kind] || '';
  }

  $('deck').addEventListener('change', function () {
    leaveCard();
    deckId = $('deck').value;
    $('imp-report').textContent = '';
    clearForm();
    render();
  });

  $('newdeck-open').addEventListener('click', function () {
    $('newdeck-box').open = true;
    $('nd-title').focus();
  });

  $('nd-create').addEventListener('click', function () {
    var title = $('nd-title').value.trim();
    if (!title) { msg($('topmsg'), 'Give the new deck a title.', 'err'); return; }
    var id = S.slugify(title, 'deck'), base = id;
    for (var n = 2; S.deckById(data, id); n++) id = base + '-' + n;
    var kind = $('nd-kind').value;
    var d = { id: id, kind: kind, title: title, blurb: '', cards: [] };
    if (kind === 'verb') d.participle = true;
    leaveCard();
    data.decks.push(d);
    deckId = id;
    $('nd-title').value = '';
    $('newdeck-box').open = false;
    msg($('topmsg'), 'Deck “' + title + '” created. Add cards one at a time, or import a spreadsheet below.', 'ok');
    clearForm();
    touch();
  });

  $('ds-title').addEventListener('change', function () { deck().title = $('ds-title').value.trim() || deck().id; touch(); });
  $('ds-blurb').addEventListener('change', function () { deck().blurb = $('ds-blurb').value.trim(); touch(); });
  $('ds-participle').addEventListener('change', function () { deck().participle = $('ds-participle').checked; touch(); });

  $('ds-delete').addEventListener('click', function () {
    var d = deck();
    if (!d) return;
    if (!confirm('Delete the deck “' + (d.title || d.id) + '” and all ' + d.cards.length + ' of its cards? Learners lose their progress on it.')) return;
    leaveCard();
    d.cards.forEach(function (c) { dropIfDraft(c.image); dropIfDraft(c.audio); });
    data.decks = data.decks.filter(function (x) { return x !== d; });
    deckId = data.decks.length ? data.decks[0].id : null;
    msg($('topmsg'), 'Deck deleted from the draft.', 'ok');
    clearForm();
    touch();
  });

  /* ------------------------------------------------------------ card list */

  function cardText(c) {
    if (isVerb()) {
      return { main: c.base || '—', sub: [c.past, deck().participle ? c.participle : null].filter(Boolean).join(' · ') };
    }
    return { main: c.word || '—', sub: c.hint || '' };
  }

  function renderList() {
    thumbURLs.forEach(function (u) { URL.revokeObjectURL(u); });
    thumbURLs = [];
    var list = $('cardlist');
    list.innerHTML = '';
    var d = deck();
    $('listhint').textContent = !d ? 'Create a deck first.'
      : isVerb() ? 'A card needs the base form and every form the deck asks for.'
        : 'A card needs a word, and a picture or a hint for the front. Cards missing either are kept but left out of study.';
    if (!d) return;
    var q = $('search').value.trim().toLowerCase();
    var shown = d.cards.filter(function (c) {
      if (!q) return true;
      return [c.word, c.hint, c.base, c.past, c.participle, c.meaning].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    var frag = document.createDocumentFragment();
    shown.forEach(function (c) {
      var t = cardText(c);
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'crow' + (c.id === selectedId ? ' sel' : '');
      row.setAttribute('role', 'listitem');
      row.innerHTML = '<span class="g"></span><span class="pair"><b></b> <span></span></span><span class="tick"></span>';
      var g = row.querySelector('.g');
      if (!isVerb()) {
        if (c.image) {
          var img = document.createElement('img');
          img.className = 'thumb'; img.alt = ''; img.loading = 'lazy';
          S.media.url(c.image).then(function (u) {
            if (!u) return;
            if (u.indexOf('blob:') === 0) thumbURLs.push(u);
            img.src = u;
          });
          g.appendChild(img);
        } else {
          g.innerHTML = '<span class="thumb none">no pic</span>';
        }
      } else {
        g.style.display = 'none';
      }
      row.querySelector('.pair b').textContent = t.main;
      row.querySelector('.pair span').textContent = t.sub;
      var tick = row.querySelector('.tick');
      if (!S.usable(d, c)) { tick.textContent = 'incomplete'; tick.className = 'tick none'; }
      else if (S.media.isDraft(c.image) || S.media.isDraft(c.audio)) tick.textContent = 'new';
      else if (c.audio) tick.textContent = '♪';
      row.addEventListener('click', function () { select(c.id); });
      frag.appendChild(row);
    });
    list.appendChild(frag);
    if (!shown.length) {
      var p = document.createElement('p');
      p.className = 'hint';
      p.style.padding = '14px 4px';
      p.textContent = q ? 'Nothing matches “' + $('search').value + '”.' : 'No cards yet.';
      list.appendChild(p);
    }
  }

  function renderStatus() {
    var cards = 0, incomplete = 0;
    data.decks.forEach(function (d) {
      cards += d.cards.length;
      incomplete += d.cards.filter(function (c) { return !S.usable(d, c); }).length;
    });
    var fresh = allMedia(data).filter(S.media.isDraft).length;
    var bits = [data.decks.length + ' deck' + (data.decks.length === 1 ? '' : 's'), cards + ' cards',
      data.grammar.length + ' grammar sheet' + (data.grammar.length === 1 ? '' : 's')];
    if (incomplete) bits.push(incomplete + ' incomplete');
    $('status').innerHTML = bits.join(' · ') +
      (S.readDraft() ? ' · <b>unpublished draft' + (fresh ? ', ' + fresh + ' new file' + (fresh > 1 ? 's' : '') : '') + '</b>' : '');
  }

  /* ---------------------------------------------------------------- form */

  function showFields() {
    var verb = isVerb();
    $('pic-fields').classList.toggle('hidden', verb);
    $('verb-fields').classList.toggle('hidden', !verb);
    $('f-participle-row').classList.toggle('hidden', !(verb && deck().participle));
    $('cardform').classList.toggle('hidden', !deck());
  }

  function setPicture(ref, label) {
    staged.image = ref || null;
    if (formURL) { URL.revokeObjectURL(formURL); formURL = null; }
    $('picbox').classList.toggle('has', !!ref);
    $('p-img').hidden = !ref;
    $('p-name').textContent = ref
      ? (label || (S.media.isDraft(ref) ? 'New picture (unpublished)' : ref))
      : 'No picture — drop one here, or choose a file';
    if (ref) S.media.url(ref).then(function (u) {
      if (!u || staged.image !== ref) return;
      if (u.indexOf('blob:') === 0) formURL = u;
      $('p-img').src = u;
    });
  }

  function setAudio(ref, label) {
    staged.audio = ref || null;
    $('audiobox').classList.toggle('has', !!ref);
    $('a-name').textContent = ref
      ? (label || (S.media.isDraft(ref) ? 'New recording (unpublished)' : ref))
      : 'No recording';
  }

  function savedCard() {
    var d = deck();
    return d ? d.cards.find(function (c) { return c.id === selectedId; }) : null;
  }

  /* A picture or recording staged but never saved to a card would sit in
   * IndexedDB forever; drop it when the form moves on. */
  function dropUnsaved() {
    var c = savedCard();
    ['image', 'audio'].forEach(function (k) {
      if (staged[k] && (!c || c[k] !== staged[k])) dropIfDraft(staged[k]);
    });
  }

  /* Leave the card being edited without saving what is staged, before the
   * deck changes under it (savedCard() looks in the current deck). */
  function leaveCard() {
    dropUnsaved();
    staged = { image: null, audio: null };
    selectedId = null;
  }

  function clearForm() {
    dropUnsaved();
    selectedId = null;
    $('formtitle').textContent = 'New card';
    ['f-word', 'f-hint', 'f-base', 'f-past', 'f-participle', 'f-meaning'].forEach(function (id) { $(id).value = ''; });
    setPicture(null);
    setAudio(null);
    msg($('formmsg'), '');
    $('delete').disabled = true;
    showFields();
    renderList();
  }

  function select(id) {
    var d = deck();
    var c = d.cards.find(function (x) { return x.id === id; });
    if (!c) return;
    dropUnsaved();
    selectedId = id;
    $('formtitle').textContent = 'Editing: ' + (c.word || c.base);
    $('f-word').value = c.word || '';
    $('f-hint').value = c.hint || '';
    $('f-base').value = c.base || '';
    $('f-past').value = c.past || '';
    $('f-participle').value = c.participle || '';
    $('f-meaning').value = c.meaning || '';
    staged = { image: null, audio: null };
    setPicture(c.image);
    setAudio(c.audio);
    msg($('formmsg'), '');
    $('delete').disabled = false;
    showFields();
    renderList();
  }

  $('search').addEventListener('input', renderList);
  $('newcard').addEventListener('click', function () { clearForm(); (isVerb() ? $('f-base') : $('f-word')).focus(); });
  $('cancel').addEventListener('click', clearForm);

  $('cardform').addEventListener('submit', function (e) {
    e.preventDefault();
    var d = deck();
    if (!d) return;
    var val = function (id) { return $(id).value.trim(); };
    var fields, warn = '';

    if (d.kind === 'verb') {
      if (!val('f-base') || !val('f-past')) { msg($('formmsg'), 'A verb card needs the base form and the past simple.', 'err'); return; }
      fields = { base: val('f-base'), past: val('f-past'), participle: val('f-participle'), meaning: val('f-meaning') };
      if (d.participle && !fields.participle) warn = 'Saved — but this deck asks for the past participle, so the card stays out of study until it has one.';
    } else {
      if (!val('f-word')) { msg($('formmsg'), 'A picture card needs its word.', 'err'); return; }
      fields = { word: val('f-word'), hint: val('f-hint'), image: staged.image, audio: staged.audio };
      if (!fields.image && !fields.hint) warn = 'Saved — but with no picture and no hint the front would be blank, so the card stays out of study.';
    }

    var c = savedCard();
    if (!c) {
      c = { id: S.newId(d.kind === 'verb' ? 'v' : 'w') };
      d.cards.push(c);
      selectedId = c.id;
    }
    ['image', 'audio'].forEach(function (k) { if (c[k] && c[k] !== fields[k] && d.kind !== 'verb') dropIfDraft(c[k]); });
    Object.keys(fields).forEach(function (k) { c[k] = fields[k] || (k === 'image' || k === 'audio' ? null : ''); });

    $('formtitle').textContent = 'Editing: ' + (c.word || c.base);
    $('delete').disabled = false;
    msg($('formmsg'), warn || 'Saved to the draft.', warn ? 'err' : 'ok');
    touch();
  });

  $('delete').addEventListener('click', function () {
    var d = deck(), c = savedCard();
    if (!c) return;
    if (!confirm('Delete “' + (c.word || c.base) + '”? Learners lose their progress on it.')) return;
    dropIfDraft(c.image); dropIfDraft(c.audio);
    d.cards = d.cards.filter(function (x) { return x !== c; });
    staged = { image: null, audio: null };
    clearForm();
    msg($('topmsg'), 'Card deleted from the draft.', 'ok');
    touch();
  });

  /* ------------------------------------------------------ picture + audio */

  function stagePicture(file) {
    msg($('formmsg'), 'Preparing the picture…', '');
    return preparePicture(file).then(function (blob) {
      return S.media.put(blob).then(function (key) {
        if (staged.image && staged.image !== (savedCard() || {}).image) dropIfDraft(staged.image);
        setPicture(key, file.name + ' · ' + Math.max(1, Math.round(blob.size / 1024)) + ' KB');
        msg($('formmsg'), 'Picture attached — save the card to keep it.', 'ok');
        if (!$('f-word').value.trim()) $('f-word').value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
      });
    }).catch(function (err) {
      msg($('formmsg'), 'Could not use that picture: ' + (err && err.message ? err.message : err), 'err');
    });
  }

  $('p-pick').addEventListener('click', function () { $('p-file').click(); });
  $('p-file').addEventListener('change', function (e) {
    if (e.target.files[0]) stagePicture(e.target.files[0]);
    e.target.value = '';
  });
  $('p-clear').addEventListener('click', function () {
    if (staged.image && staged.image !== (savedCard() || {}).image) dropIfDraft(staged.image);
    setPicture(null);
    msg($('formmsg'), 'Picture removed — save the card to confirm.', '');
  });
  ['dragenter', 'dragover'].forEach(function (t) {
    $('picbox').addEventListener(t, function (e) { e.preventDefault(); $('picbox').classList.add('drag'); });
  });
  ['dragleave', 'drop'].forEach(function (t) {
    $('picbox').addEventListener(t, function () { $('picbox').classList.remove('drag'); });
  });
  $('picbox').addEventListener('drop', function (e) {
    e.preventDefault();
    var f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && /^image\//.test(f.type)) stagePicture(f);
    else msg($('formmsg'), 'That is not a picture.', 'err');
  });

  function stageAudio(blob, label) {
    return S.media.put(blob).then(function (key) {
      if (staged.audio && staged.audio !== (savedCard() || {}).audio) dropIfDraft(staged.audio);
      setAudio(key, label);
      msg($('formmsg'), 'Recording attached — save the card to keep it.', 'ok');
    }).catch(function () { msg($('formmsg'), 'Could not store that audio in this browser.', 'err'); });
  }

  $('a-pick').addEventListener('click', function () { $('a-file').click(); });
  $('a-file').addEventListener('change', function (e) {
    if (e.target.files[0]) stageAudio(e.target.files[0], e.target.files[0].name);
    e.target.value = '';
  });
  $('a-clear').addEventListener('click', function () {
    if (staged.audio && staged.audio !== (savedCard() || {}).audio) dropIfDraft(staged.audio);
    setAudio(null);
    msg($('formmsg'), 'Recording removed — save the card to confirm.', '');
  });
  $('a-play').addEventListener('click', function () {
    if (!staged.audio) { msg($('formmsg'), 'Nothing to play yet.', 'err'); return; }
    S.media.url(staged.audio).then(function (u) {
      if (!u) { msg($('formmsg'), 'That recording could not be found.', 'err'); return; }
      if (previewURL) URL.revokeObjectURL(previewURL);
      previewURL = u.indexOf('blob:') === 0 ? u : null;
      $('preview').src = u;
      $('preview').play().catch(function () { msg($('formmsg'), 'The browser refused to play that file.', 'err'); });
    });
  });
  $('a-record').addEventListener('click', function () {
    if (recorder && recorder.state === 'recording') { recorder.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      msg($('formmsg'), 'This browser cannot record. Use “Choose file…” instead.', 'err');
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        $('a-record').classList.remove('rec-on');
        $('a-record').textContent = '● Record';
        if (chunks.length) stageAudio(new Blob(chunks, { type: recorder.mimeType }), 'Just recorded');
      };
      recorder.start();
      $('a-record').classList.add('rec-on');
      $('a-record').textContent = '■ Stop';
      msg($('formmsg'), 'Recording — say the word, then press stop.', '');
    }).catch(function () {
      msg($('formmsg'), 'Microphone access was refused (it also needs https or localhost).', 'err');
    });
  });

  /* ---------------------------------------------------------------- import
   *
   * One row per card, with a header row naming the columns. Rows pasted from
   * a spreadsheet arrive tab-separated; a .csv may use commas or, from a
   * French-locale Excel, semicolons. A row whose word already exists in the
   * deck updates that card rather than adding a second one, so its progress
   * survives a re-import.
   */

  var COLUMNS = {
    picture: { word: ['word', 'english', 'mot', 'anglais'], hint: ['hint', 'translation', 'french', 'français', 'francais', 'traduction', 'sentence', 'example'], image: ['image', 'picture', 'photo', 'file', 'filename', 'fichier'] },
    verb: { base: ['base', 'verb', 'infinitive', 'base form', 'verbe', 'infinitif'], past: ['past', 'past simple', 'preterit', 'prétérit', 'preterite'], participle: ['participle', 'past participle', 'pp', 'participe', 'participe passé'], meaning: ['meaning', 'translation', 'french', 'français', 'francais', 'traduction'] }
  };

  function importHint() {
    if (!deck()) return;
    $('importhint').innerHTML = isVerb()
      ? 'Columns: <b>base</b>, <b>past</b>, <b>participle</b>, <b>meaning</b> — the first row names them. Example: <code>go · went · gone · aller</code>.'
      : 'Columns: <b>word</b>, <b>hint</b>, <b>image</b> — the first row names them. <b>image</b> is the picture’s file name; leave it out and pictures are matched to words by name (<i>apple.jpg</i> → apple). Pick the pictures with <b>Add pictures…</b> before importing.';
  }

  function parseRows(text) {
    var first = text.split(/\r?\n/)[0] || '';
    var delim = first.indexOf('\t') >= 0 ? '\t'
      : (first.split(';').length > first.split(',').length ? ';' : ',');
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"' && !cell) q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.map(function (r) { return r.map(function (c) { return c.trim(); }); })
      .filter(function (r) { return r.some(Boolean); });
  }

  function mapHeader(header, kind) {
    var map = {}, spec = COLUMNS[kind];
    header.forEach(function (h, i) {
      var key = h.toLowerCase().replace(/\s+/g, ' ').trim();
      Object.keys(spec).forEach(function (field) {
        if (map[field] === undefined && spec[field].indexOf(key) >= 0) map[field] = i;
      });
    });
    return map;
  }

  function stem(name) { return S.slugify(String(name).replace(/\.[^.\/]+$/, '')); }

  $('imp-csv').addEventListener('click', function () { $('imp-csvfile').click(); });
  $('imp-csvfile').addEventListener('change', function (e) {
    var f = e.target.files[0];
    if (!f) return;
    f.text().then(function (t) { $('imp-text').value = t.replace(/^﻿/, ''); });
    e.target.value = '';
  });
  $('imp-pics').addEventListener('click', function () { $('imp-picfiles').click(); });
  $('imp-picfiles').addEventListener('change', function (e) {
    [].forEach.call(e.target.files, function (f) { importPics[stem(f.name)] = f; });
    var n = Object.keys(importPics).length;
    $('imp-picnote').textContent = n + ' picture' + (n === 1 ? '' : 's') + ' ready to match';
    e.target.value = '';
  });

  $('imp-go').addEventListener('click', function () {
    var d = deck();
    if (!d) return;
    var rows = parseRows($('imp-text').value);
    var report = $('imp-report');
    if (rows.length < 2) { report.textContent = 'Paste a header row and at least one card.'; return; }
    var cols = mapHeader(rows[0], d.kind);
    var key = d.kind === 'verb' ? 'base' : 'word';
    if (cols[key] === undefined) {
      report.textContent = 'The first row needs a “' + key + '” column. Found: ' + rows[0].join(', ');
      return;
    }
    var get = function (r, f) { return cols[f] === undefined ? undefined : (r[cols[f]] || ''); };
    var byKey = {};
    d.cards.forEach(function (c) { byKey[String(c[key] || '').toLowerCase()] = c; });

    var added = 0, updated = 0, attached = 0, skipped = [], missingPics = [], usedPics = {};
    var jobs = [];
    rows.slice(1).forEach(function (r, i) {
      var k = get(r, key);
      if (!k) { skipped.push('row ' + (i + 2)); return; }
      var c = byKey[k.toLowerCase()];
      var isNew = !c;
      if (c) updated++;
      else { c = { id: S.newId(d.kind === 'verb' ? 'v' : 'w') }; d.cards.push(c); byKey[k.toLowerCase()] = c; added++; }
      // An empty cell leaves an existing card's value alone, so a sheet with
      // a column only partly filled in cannot wipe what the editor added.
      Object.keys(COLUMNS[d.kind]).forEach(function (f) {
        if (f === 'image') return;
        var v = get(r, f);
        if (v !== undefined && (v || isNew)) c[f] = v;
      });
      if (d.kind === 'verb') {
        ['past', 'participle', 'meaning'].forEach(function (f) { if (c[f] === undefined) c[f] = ''; });
        return;
      }
      if (c.hint === undefined) c.hint = '';
      if (c.image === undefined) c.image = null;
      if (c.audio === undefined) c.audio = null;
      var named = get(r, 'image');
      var file = importPics[stem(named || k)];
      if (file) {
        usedPics[stem(file.name)] = true;
        jobs.push(function () {
          return preparePicture(file).then(S.media.put).then(function (ref) { dropIfDraft(c.image); c.image = ref; attached++; })
            .catch(function () { missingPics.push(file.name + ' (unreadable)'); });
        });
      } else if (named) missingPics.push(named);
    });

    report.textContent = 'Importing…';
    jobs.reduce(function (p, job) { return p.then(job); }, Promise.resolve()).then(function () {
      var unused = Object.keys(importPics).filter(function (s) { return !usedPics[s]; })
        .map(function (s) { return importPics[s].name; });
      var lines = [added + ' card' + (added === 1 ? '' : 's') + ' added, ' + updated + ' updated.'];
      if (jobs.length) lines.push(attached + ' picture' + (attached === 1 ? '' : 's') + ' attached.');
      if (skipped.length) lines.push('Skipped (no ' + key + '): ' + skipped.join(', ') + '.');
      if (missingPics.length) lines.push('Pictures named but not found among the ones added: ' + missingPics.join(', ') + '.');
      if (unused.length) lines.push('Pictures added but matching no word: ' + unused.join(', ') + '.');
      var incomplete = d.cards.filter(function (c) { return !S.usable(d, c); }).length;
      if (incomplete) lines.push(incomplete + ' card' + (incomplete === 1 ? ' is' : 's are') + ' incomplete — they are marked in the list.');
      report.textContent = lines.join('\n');
      $('imp-text').value = '';
      importPics = {};
      $('imp-picnote').textContent = '';
      touch();
    });
  });

  /* -------------------------------------------------------- grammar sheets */

  var sheetTarget = null;

  function renderSheets() {
    var host = $('sheetlist');
    host.innerHTML = '';
    data.grammar.forEach(function (g, i) {
      var row = document.createElement('div');
      row.className = 'sheetrow';
      row.innerHTML = '<div class="fields"><input class="t" placeholder="Title" aria-label="Title">' +
        '<input class="b" placeholder="One line on what it covers" aria-label="Description">' +
        '<div class="file"><span class="fname"></span><button type="button" class="mini pick">Choose PDF…</button>' +
        '<button type="button" class="mini open">Open</button></div></div>' +
        '<div class="btns"><button type="button" class="mini up" aria-label="Move up">↑</button>' +
        '<button type="button" class="mini down" aria-label="Move down">↓</button>' +
        '<button type="button" class="mini danger del">Delete</button></div>';
      var t = row.querySelector('.t'), b = row.querySelector('.b');
      t.value = g.title || ''; b.value = g.blurb || '';
      t.addEventListener('change', function () { g.title = t.value.trim(); touch(); });
      b.addEventListener('change', function () { g.blurb = b.value.trim(); touch(); });
      var fname = row.querySelector('.fname');
      if (!g.file) fname.innerHTML = '<b style="color:var(--bad)">No PDF yet</b> — not shown to learners';
      else fname.innerHTML = '<b></b>';
      if (g.file) fname.querySelector('b').textContent = S.media.isDraft(g.file) ? 'New PDF (unpublished)' : g.file;
      row.querySelector('.open').disabled = !g.file;
      row.querySelector('.pick').addEventListener('click', function () { sheetTarget = g; $('sheetfile').click(); });
      row.querySelector('.open').addEventListener('click', function () {
        var win = window.open('', '_blank');
        S.media.url(g.file).then(function (u) { if (win && u) win.location = new URL(u, location.href).href; });
      });
      row.querySelector('.up').disabled = i === 0;
      row.querySelector('.down').disabled = i === data.grammar.length - 1;
      row.querySelector('.up').addEventListener('click', function () { move(i, -1); });
      row.querySelector('.down').addEventListener('click', function () { move(i, 1); });
      row.querySelector('.del').addEventListener('click', function () {
        if (!confirm('Delete the sheet “' + (g.title || 'untitled') + '”?')) return;
        dropIfDraft(g.file);
        data.grammar.splice(i, 1);
        touch();
      });
      host.appendChild(row);
    });
    if (!data.grammar.length) host.innerHTML = '<p class="hint" style="padding:12px 0">No sheets yet.</p>';
  }

  function move(i, by) {
    var j = i + by, g = data.grammar;
    if (j < 0 || j >= g.length) return;
    var t = g[i]; g[i] = g[j]; g[j] = t;
    touch();
  }

  $('newsheet').addEventListener('click', function () {
    data.grammar.push({ id: S.newId('g'), title: '', blurb: '', file: null });
    touch();
    var inputs = $('sheetlist').querySelectorAll('.t');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  $('sheetfile').addEventListener('change', function (e) {
    var f = e.target.files[0], g = sheetTarget;
    e.target.value = '';
    if (!f || !g) return;
    if (f.type && f.type !== 'application/pdf') { msg($('topmsg'), 'Grammar sheets need to be PDF files.', 'err'); return; }
    S.media.put(new Blob([f], { type: 'application/pdf' })).then(function (ref) {
      dropIfDraft(g.file);
      g.file = ref;
      if (!g.title) g.title = f.name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ');
      msg($('topmsg'), 'PDF attached to “' + g.title + '”.', 'ok');
      touch();
    }).catch(function () { msg($('topmsg'), 'Could not store that PDF in this browser.', 'err'); });
  });

  /* ---------------------------------------------------------- publishing */

  var HEADER =
    '/* Study section — decks and grammar sheets.\n' +
    ' *\n' +
    ' * Plain JSON wrapped in one assignment so the pages load it with a <script>\n' +
    ' * tag and still work opened straight off disk. Edit by hand or with\n' +
    ' * study/editor.html. Paths are relative to the study/ folder.\n' +
    ' */\n';

  /* One card per line: a 750-card deck stays readable, and a change to one
   * card is a one-line diff. */
  function serialize(d) {
    var ind = function (n) { return new Array(n + 1).join('  '); };
    var decks = d.decks.map(function (dk) {
      var head = Object.keys(dk).filter(function (k) { return k !== 'cards'; }).map(function (k) {
        return ind(3) + JSON.stringify(k) + ': ' + JSON.stringify(dk[k]);
      });
      var cards = dk.cards.map(function (c) {
        return ind(4) + '{ ' + Object.keys(c).map(function (k) { return JSON.stringify(k) + ': ' + JSON.stringify(c[k]); }).join(', ') + ' }';
      });
      return ind(2) + '{\n' + head.concat([ind(3) + '"cards": [\n' + cards.join(',\n') + (cards.length ? '\n' : '') + ind(3) + ']']).join(',\n') + '\n' + ind(2) + '}';
    });
    var grammar = d.grammar.map(function (g) { return ind(2) + JSON.stringify(g, null, 2).replace(/\n/g, '\n' + ind(2)); });
    return HEADER + 'window.STUDY_DATA = {\n' +
      ind(1) + '"version": ' + JSON.stringify(d.version || 1) + ',\n' +
      ind(1) + '"decks": [\n' + decks.join(',\n') + (decks.length ? '\n' : '') + ind(1) + '],\n' +
      ind(1) + '"grammar": [\n' + grammar.join(',\n') + (grammar.length ? '\n' : '') + ind(1) + ']\n};\n';
  }

  /* Give every draft file a real path under study/, named after its card or
   * sheet, without clobbering a name already taken. */
  function prepareRelease() {
    var out = S.clone(data);
    var taken = {};
    allMedia(out).forEach(function (r) { if (!S.media.isDraft(r)) taken[r] = true; });
    var jobs = [];

    function assign(holder, field, dir, name, fallbackExt) {
      var ref = holder[field];
      if (!S.media.isDraft(ref)) return;
      jobs.push(S.media.get(ref).then(function (blob) {
        if (!blob) { holder[field] = null; return null; }
        var base = dir + '/' + S.slugify(name, 'item'), ext = '.' + extFor(blob, fallbackExt);
        var path = base + ext;
        for (var n = 2; taken[path]; n++) path = base + '-' + n + ext;
        taken[path] = true;
        holder[field] = path;
        return { path: 'study/' + path, blob: blob };
      }));
    }

    out.decks.forEach(function (dk) {
      dk.cards.forEach(function (c) {
        assign(c, 'image', 'images/' + dk.id, c.word || c.base, 'webp');
        assign(c, 'audio', 'audio/' + dk.id, c.word || c.base, 'webm');
      });
    });
    out.grammar.forEach(function (g) { assign(g, 'file', 'grammar', g.title, 'pdf'); });

    return Promise.all(jobs).then(function (files) {
      files = files.filter(Boolean);
      return Promise.all(files.map(function (f) {
        return H.blobBytes(f.blob).then(function (bytes) { return { path: f.path, bytes: bytes }; });
      })).then(function (entries) {
        return {
          data: out,
          entries: [{ path: 'study/data/study.js', bytes: new TextEncoder().encode(serialize(out)) }].concat(entries)
        };
      });
    });
  }

  /* Files the committed data uses that the new data no longer does. They are
   * left on disk (a zip cannot delete anything), so say which they are. */
  function orphans(next) {
    var before = S.published();
    if (!before) return [];
    var keep = {};
    allMedia(next).forEach(function (r) { keep[r] = true; });
    return allMedia(S.normalise(before)).filter(function (r) { return !keep[r] && !S.media.isDraft(r); })
      .map(function (r) { return 'study/' + r; });
  }

  function orphanNote(next) {
    var o = orphans(next);
    return o.length ? ' No longer used, safe to delete: ' + o.join(', ') + '.' : '';
  }

  $('downloadzip').addEventListener('click', function () {
    prepareRelease().then(function (rel) {
      H.download(H.zip(rel.entries), 'study-update.zip');
      msg($('topmsg'), 'Downloaded ' + rel.entries.length + ' file(s). Unzip over the project folder (it contains a study/ folder), then discard the draft.' + orphanNote(rel.data), 'ok');
    }).catch(function (err) { msg($('topmsg'), 'Could not build the zip: ' + err.message, 'err'); });
  });

  function writeInto(dir, path, bytes) {
    var parts = path.split('/'), name = parts.pop(), walk = Promise.resolve(dir);
    parts.forEach(function (seg) { walk = walk.then(function (d) { return d.getDirectoryHandle(seg, { create: true }); }); });
    return walk.then(function (d) { return d.getFileHandle(name, { create: true }); })
      .then(function (fh) { return fh.createWritable(); })
      .then(function (w) { return w.write(bytes).then(function () { return w.close(); }); });
  }

  function countCards(d) {
    return (d.decks || []).reduce(function (n, dk) { return n + (dk.cards || []).length; }, 0);
  }

  function readDataAt(dir) {
    return dir.getDirectoryHandle('study')
      .then(function (d) { return d.getDirectoryHandle('data'); })
      .then(function (d) { return d.getFileHandle('study.js'); })
      .then(function (fh) { return fh.getFile(); })
      .then(function (f) { return f.text(); })
      .then(function (t) {
        var a = t.indexOf('{'), b = t.lastIndexOf('}');
        try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
      })
      .catch(function () { return null; });
  }

  /* Publishing replaces study/data/study.js wholesale, so check the folder is
   * the project and warn before a write that would lose cards. */
  function confirmTarget(dir, next) {
    return dir.getFileHandle('index.html').then(function () { return true; })
      .catch(function () {
        return confirm('“' + dir.name + '” has no index.html, so it does not look like the project folder '
          + '(pick the folder that contains index.html and study/, not study/ itself). Write into it anyway?');
      })
      .then(function (ok) {
        if (!ok) return false;
        return readDataAt(dir).then(function (existing) {
          if (!existing) return true;
          var before = countCards(existing), after = countCards(next);
          if (after >= before) return true;
          return confirm('The study decks in “' + dir.name + '” have ' + before + ' cards; this publish leaves '
            + after + '. ' + (before - after) + ' card(s) would be lost. Continue?');
        });
      });
  }

  $('publish').addEventListener('click', function () {
    if (!window.showDirectoryPicker) {
      msg($('topmsg'), 'This browser cannot write to a folder directly (Brave can, once brave://flags/#file-system-access-api is enabled). Use “Download changes (.zip)” and unzip it over the project instead.', 'err');
      return;
    }
    var rel, dirName;
    prepareRelease()
      .then(function (r) { rel = r; return projectDir || window.showDirectoryPicker({ mode: 'readwrite' }); })
      .then(function (dir) {
        dirName = dir.name;
        return confirmTarget(dir, rel.data).then(function (ok) {
          if (!ok) return false;
          projectDir = dir;
          return rel.entries.reduce(function (p, e) { return p.then(function () { return writeInto(dir, e.path, e.bytes); }); }, Promise.resolve())
            .then(function () { return true; });
        });
      })
      .then(function (written) {
        if (!written) { msg($('topmsg'), 'Nothing written.', ''); return; }
        var note = orphanNote(rel.data);
        allMedia(data).forEach(dropIfDraft);
        data = rel.data;
        window.STUDY_DATA = S.clone(rel.data); // what is now on disk
        S.clearDraft();
        staged = { image: null, audio: null };
        clearForm();
        msg($('topmsg'), 'Wrote ' + rel.entries.length + ' file(s) into “' + dirName + '”. Reload the study pages to pick them up; a hosted copy changes once you commit and push.' + note, 'ok');
        render();
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return;
        msg($('topmsg'), 'Publish failed: ' + (err && err.message ? err.message : err), 'err');
      });
  });

  $('revert').addEventListener('click', function () {
    if (!S.readDraft()) { msg($('topmsg'), 'Nothing unpublished to discard.', ''); return; }
    if (!confirm('Throw away every unpublished change, including new pictures, recordings and PDFs?')) return;
    staged = { image: null, audio: null };
    allMedia(data).forEach(dropIfDraft);
    S.clearDraft();
    data = S.normalise(S.published() || { version: 1 });
    if (!deck()) deckId = data.decks.length ? data.decks[0].id : null;
    clearForm();
    msg($('topmsg'), 'Draft discarded — back to what is in study/data/study.js.', 'ok');
    render();
  });

  /* ---------------------------------------------------------------- boot */

  function render() {
    renderDeckSelect();
    renderSettings();
    showFields();
    importHint();
    renderList();
    renderSheets();
    renderStatus();
  }

  render();
  clearForm();
})();
