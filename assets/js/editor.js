/* Hear the Difference — deck editor.
 *
 * Edits a draft of the deck held in the browser (text in localStorage, audio
 * blobs in IndexedDB), then publishes it back into the project as data/deck.js
 * plus files under audio/.
 *
 * Two ways out, because browsers differ:
 *   - File System Access API: pick the project folder once, write in place.
 *   - Everywhere else: download a zip laid out exactly like the project.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var H = window.HTD;

  var deck = H.load();
  var selectedId = null;
  var draftAudio = null;   // audio ref staged for the card being edited
  var previewURL = null;
  var recorder = null;
  var projectDir = null;   // FileSystemDirectoryHandle, once granted

  if (!deck) {
    document.body.innerHTML = '<div class="wrap"><h1 class="lede">Deck missing.</h1>' +
      '<p class="blurb">data/deck.js did not load. Check that it sits next to editor.html.</p></div>';
    return;
  }
  deck.groups = deck.groups || [];
  deck.cards = deck.cards || [];

  /* ------------------------------------------------------------- helpers */

  function msg(el, text, kind) {
    el.textContent = text || '';
    el.className = 'msg' + (kind ? ' ' + kind : '');
  }

  function touch() {
    var saved = H.saveDraft(deck);
    if (!saved) msg($('topmsg'), 'Could not save the draft — this browser is out of storage or in private mode. Publish now so you do not lose the work.', 'err');
    render();
  }

  function groupLabel(id) {
    var g = H.groupsById(deck)[id];
    return g ? (g.ipa || g.label || g.id) : id;
  }

  function isDirty() {
    return !!H.readDraft();
  }

  /* --------------------------------------------------------- card list */

  function sortedCards() {
    var order = {};
    deck.groups.forEach(function (g, i) { order[g.id] = i; });
    return deck.cards.slice().sort(function (a, b) {
      var d = (order[a.group] === undefined ? 99 : order[a.group]) - (order[b.group] === undefined ? 99 : order[b.group]);
      return d || a.options[0].localeCompare(b.options[0]);
    });
  }

  function renderList() {
    var q = $('search').value.trim().toLowerCase();
    var list = $('cardlist');
    list.innerHTML = '';
    var shown = sortedCards().filter(function (c) {
      if (!q) return true;
      return (c.options.join(' ') + ' ' + c.answer + ' ' + c.group).toLowerCase().indexOf(q) >= 0;
    });

    shown.forEach(function (c) {
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'crow' + (c.id === selectedId ? ' sel' : '');
      row.setAttribute('role', 'listitem');
      row.innerHTML = '<span class="g"></span><span class="pair"><b></b><span></span></span><span class="tick"></span>';
      row.querySelector('.g').textContent = groupLabel(c.group);
      row.querySelector('.pair b').textContent = c.answer;
      row.querySelector('.pair span').textContent = ' vs ' + c.options.filter(function (o) { return o !== c.answer; }).join(', ');
      var tick = row.querySelector('.tick');
      if (!c.audio) { tick.textContent = 'no audio'; tick.className = 'tick none'; }
      else tick.textContent = H.audio.isDraftRef(c.audio) ? 'new' : '♪';
      row.addEventListener('click', function () { select(c.id); });
      list.appendChild(row);
    });

    if (!shown.length) {
      var p = document.createElement('p');
      p.className = 'hint';
      p.style.padding = '14px 4px';
      p.textContent = q ? 'Nothing matches “' + $('search').value + '”.' : 'No cards yet.';
      list.appendChild(p);
    }
  }

  function renderStatus() {
    var missing = deck.cards.filter(function (c) { return !c.audio; }).length;
    var fresh = deck.cards.filter(function (c) { return H.audio.isDraftRef(c.audio); }).length;
    var bits = [deck.cards.length + ' cards', deck.groups.length + ' groups'];
    if (missing) bits.push(missing + ' without audio');
    $('status').innerHTML = bits.join(' · ') +
      (isDirty() ? ' · <b>unpublished draft' + (fresh ? ', ' + fresh + ' new recording' + (fresh > 1 ? 's' : '') : '') + '</b>' : '');
  }

  /* -------------------------------------------------------------- groups */

  function renderGroupOptions() {
    var sel = $('f-group');
    var keep = sel.value;
    sel.innerHTML = '';
    deck.groups.forEach(function (g) {
      var o = document.createElement('option');
      o.value = g.id;
      o.textContent = (g.label || g.id) + ' ' + (g.ipa || '');
      sel.appendChild(o);
    });
    if (keep) sel.value = keep;
  }

  var GROUP_FIELDS = [
    ['label', 'Short label'], ['ipa', 'IPA'], ['ipaNote', 'IPA note'],
    ['title', 'Heading'], ['blurb', 'One-line description'], ['example', 'Example pair']
  ];

  function renderGroups() {
    var host = $('grouplist');
    host.innerHTML = '';
    deck.groups.forEach(function (g) {
      var row = document.createElement('div');
      row.className = 'gedit';
      var id = document.createElement('input');
      id.value = g.id; id.disabled = true; id.title = 'Fixed: cards reference this id';
      row.appendChild(id);
      GROUP_FIELDS.forEach(function (f) {
        var input = document.createElement('input');
        input.value = g[f[0]] || '';
        input.placeholder = f[1];
        input.setAttribute('aria-label', f[1] + ' for ' + g.id);
        input.addEventListener('change', function () { g[f[0]] = input.value.trim(); touch(); });
        row.appendChild(input);
      });
      host.appendChild(row);
    });
  }

  $('newgroup').addEventListener('click', function () {
    var name = prompt('Id for the new group (short, lowercase — cards store this and it cannot be renamed later):');
    if (!name) return;
    var id = H.slugify(name);
    if (!id) { msg($('topmsg'), 'That id reduces to nothing usable.', 'err'); return; }
    if (deck.groups.some(function (g) { return g.id === id; })) {
      msg($('topmsg'), 'A group with id “' + id + '” already exists.', 'err');
      return;
    }
    deck.groups.push({ id: id, label: name, ipa: '', ipaNote: '', title: name, blurb: '', example: '' });
    msg($('topmsg'), 'Group “' + id + '” added — fill in its labels below.', 'ok');
    touch();
  });

  /* ---------------------------------------------------------------- form */

  function optionValues() {
    return [$('f-o1').value.trim(), $('f-o2').value.trim()];
  }

  function renderAnswerPicker() {
    var opts = optionValues();
    [].forEach.call($('f-answer').children, function (b, i) {
      b.textContent = opts[i] || '—';
      b.disabled = !opts[i];
    });
  }

  function answerIndex() {
    var on = $('f-answer').querySelector('.on');
    return on ? Number(on.dataset.i) : -1;
  }

  function setAnswerIndex(i) {
    [].forEach.call($('f-answer').children, function (b, k) { b.classList.toggle('on', k === i); });
  }

  function setAudio(ref, label) {
    draftAudio = ref || null;
    $('audiobox').classList.toggle('has', !!draftAudio);
    $('a-name').textContent = draftAudio
      ? (label || (H.audio.isDraftRef(draftAudio) ? 'New recording (unpublished)' : draftAudio))
      : 'No recording yet';
  }

  function clearForm() {
    selectedId = null;
    $('formtitle').textContent = 'New card';
    $('f-o1').value = '';
    $('f-o2').value = '';
    if (deck.groups.length) $('f-group').value = deck.groups[0].id;
    setAnswerIndex(-1);
    renderAnswerPicker();
    setAudio(null);
    msg($('formmsg'), '');
    $('delete').disabled = true;
    renderCardWords();
    renderList();
  }

  function select(id) {
    var card = deck.cards.find(function (c) { return c.id === id; });
    if (!card) return;
    selectedId = id;
    $('formtitle').textContent = 'Editing: ' + card.answer;
    $('f-group').value = card.group;
    $('f-o1').value = card.options[0];
    $('f-o2').value = card.options[1];
    renderAnswerPicker();
    setAnswerIndex(card.options.indexOf(card.answer));
    setAudio(card.audio);
    msg($('formmsg'), '');
    $('delete').disabled = false;
    renderCardWords();
    renderList();
  }

  $('f-o1').addEventListener('input', renderAnswerPicker);
  $('f-o2').addEventListener('input', renderAnswerPicker);
  $('f-answer').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b && !b.disabled) setAnswerIndex(Number(b.dataset.i));
  });
  $('search').addEventListener('input', renderList);
  $('newcard').addEventListener('click', clearForm);
  $('cancel').addEventListener('click', clearForm);

  $('cardform').addEventListener('submit', function (e) {
    e.preventDefault();
    var opts = optionValues();
    var ai = answerIndex();
    if (!opts[0] || !opts[1]) { msg($('formmsg'), 'Both options need text — the learner is choosing between them.', 'err'); return; }
    if (opts[0].toLowerCase() === opts[1].toLowerCase()) { msg($('formmsg'), 'The two options are identical, so there is nothing to tell apart.', 'err'); return; }
    if (ai < 0) { msg($('formmsg'), 'Mark which option the recording actually says.', 'err'); return; }
    if (!$('f-group').value) { msg($('formmsg'), 'Pick a contrast group.', 'err'); return; }

    var card = deck.cards.find(function (c) { return c.id === selectedId; });
    if (!card) {
      card = { id: H.newCardId(), group: '', options: ['', ''], answer: '', audio: null };
      deck.cards.push(card);
      selectedId = card.id;
    }
    // Drop an orphaned draft recording so IndexedDB does not accumulate blobs
    // no card points at any more.
    if (card.audio && card.audio !== draftAudio && H.audio.isDraftRef(card.audio)) H.audio.del(card.audio);

    card.group = $('f-group').value;
    card.options = opts;
    card.answer = opts[ai];
    card.audio = draftAudio;

    msg($('formmsg'), card.audio ? 'Saved to the draft.' : 'Saved — but with no recording it stays out of the drill.', card.audio ? 'ok' : 'err');
    $('formtitle').textContent = 'Editing: ' + card.answer;
    $('delete').disabled = false;
    touch();
  });

  $('delete').addEventListener('click', function () {
    var i = deck.cards.findIndex(function (c) { return c.id === selectedId; });
    if (i < 0) return;
    var card = deck.cards[i];
    if (!confirm('Delete “' + card.answer + '”? Its spaced-repetition history goes with it.')) return;
    if (H.audio.isDraftRef(card.audio)) H.audio.del(card.audio);
    deck.cards.splice(i, 1);
    clearForm();
    msg($('topmsg'), 'Card deleted from the draft.', 'ok');
    touch();
  });

  /* --------------------------------------------------------------- audio */

  function stageBlob(blob, label) {
    return H.audio.put(blob).then(function (key) {
      setAudio(key, label);
      msg($('formmsg'), 'Recording attached — save the card to keep it.', 'ok');
    }).catch(function () {
      msg($('formmsg'), 'Could not store that audio in this browser.', 'err');
    });
  }

  $('a-pick').addEventListener('click', function () { $('a-file').click(); });
  $('a-file').addEventListener('change', function (e) {
    var f = e.target.files[0];
    if (!f) return;
    stageBlob(f, f.name);
    e.target.value = '';
  });

  $('a-clear').addEventListener('click', function () {
    setAudio(null);
    msg($('formmsg'), 'Recording detached — save the card to confirm.', '');
  });

  $('a-play').addEventListener('click', function () {
    if (!draftAudio) { msg($('formmsg'), 'Nothing to play yet.', 'err'); return; }
    H.audioURL({ audio: draftAudio }).then(function (url) {
      if (!url) { msg($('formmsg'), 'That recording could not be found.', 'err'); return; }
      if (previewURL) URL.revokeObjectURL(previewURL);
      previewURL = url.indexOf('blob:') === 0 ? url : null;
      $('preview').src = url;
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
        if (chunks.length) stageBlob(new Blob(chunks, { type: recorder.mimeType }), 'Just recorded');
      };
      recorder.start();
      $('a-record').classList.add('rec-on');
      $('a-record').textContent = '■ Stop';
      msg($('formmsg'), 'Recording — say the answer word, then press stop.', '');
    }).catch(function () {
      msg($('formmsg'), 'Microphone access was refused.', 'err');
    });
  });

  /* ------------------------------------------ word recordings (comparing)
   *
   * deck.words maps a word, as the drill keys it, to a recording made for
   * comparing the pair. Words with none fall back to their card's recording,
   * then to the device's computer voice.
   */

  var wordRecorder = null, wordRecKey = null, wordFileKey = null;

  function wordStatus(key) {
    var own = deck.words && deck.words[key];
    if (own && H.isStandIn(own)) return { cls: 'tts ai', text: 'AI stand-in — record over it' };
    if (own) return { cls: 'own', text: H.audio.isDraftRef(own) ? 'new recording (unpublished)' : 'own recording' };
    var src = H.wordAudio(deck)[key];
    if (src) return { cls: '', text: 'uses its card’s recording' };
    return { cls: 'tts', text: 'computer voice' };
  }

  function setWord(key, ref) {
    deck.words = deck.words || {};
    var old = deck.words[key];
    if (old && old !== ref && H.audio.isDraftRef(old)) H.audio.del(old);
    if (ref) deck.words[key] = ref; else delete deck.words[key];
    if (!Object.keys(deck.words).length) delete deck.words;
    touch();
  }

  function playWord(key, text) {
    var src = H.wordAudio(deck)[key];
    if (!src) {
      if (!H.speak(text)) msg($('topmsg'), 'This browser has no built-in voice to play.', 'err');
      return;
    }
    H.audioURL({ audio: src.ref }).then(function (url) {
      if (!url) { msg($('topmsg'), 'That recording could not be found.', 'err'); return; }
      if (previewURL) URL.revokeObjectURL(previewURL);
      previewURL = url.indexOf('blob:') === 0 ? url : null;
      $('preview').src = url;
      $('preview').play().catch(function () { msg($('topmsg'), 'The browser refused to play that file.', 'err'); });
    });
  }

  function recordWord(key, button) {
    if (wordRecorder && wordRecorder.state === 'recording') {
      var same = wordRecKey === key;
      wordRecorder.stop();
      if (same) return;
    }
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      msg($('topmsg'), 'This browser cannot record. Use “Choose file…” instead.', 'err');
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [];
      var rec = new MediaRecorder(stream);
      wordRecorder = rec; wordRecKey = key;
      rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
      rec.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        wordRecKey = null;
        if (!chunks.length) { renderWords(); return; }
        H.audio.put(new Blob(chunks, { type: rec.mimeType })).then(function (ref) {
          setWord(key, ref);
          msg($('topmsg'), 'Recorded “' + key + '”. Publish to keep it.', 'ok');
        }).catch(function () { msg($('topmsg'), 'Could not store that recording in this browser.', 'err'); });
      };
      rec.start();
      button.classList.add('rec-on');
      button.textContent = '■ Stop';
      msg($('topmsg'), 'Recording “' + key + '” — say it once, then press stop.', '');
    }).catch(function () {
      msg($('topmsg'), 'Microphone access was refused (it also needs https, localhost or a file opened from disk).', 'err');
    });
  }

  $('w-file').addEventListener('change', function (e) {
    var f = e.target.files[0], key = wordFileKey;
    e.target.value = '';
    if (!f || !key) return;
    H.audio.put(f).then(function (ref) {
      setWord(key, ref);
      msg($('topmsg'), 'Recording attached to “' + key + '”. Publish to keep it.', 'ok');
    }).catch(function () { msg($('topmsg'), 'Could not store that audio in this browser.', 'err'); });
  });

  $('w-only').addEventListener('change', renderWords);

  /* One word: its text, where its sound comes from, and the buttons to hear
   * or replace it. Used by the list at the bottom and by the card form. */
  function wordRow(w, showGroup) {
    var st = wordStatus(w.key);
    var row = document.createElement('div');
    row.className = 'wrow';
    row.innerHTML = '<div class="wt"><span></span><small></small></div><div class="btns">' +
      '<button type="button" class="mini play">▶ Play</button>' +
      '<button type="button" class="mini rec">● Record</button>' +
      '<button type="button" class="mini pick">Choose file…</button>' +
      '<button type="button" class="mini danger del">Remove</button></div>';
    row.querySelector('.wt span').textContent = w.text;
    var small = row.querySelector('.wt small');
    small.textContent = (showGroup ? groupLabel(w.group) + ' · ' : '') + st.text;
    small.className = st.cls.split(' ')[0];
    row.querySelector('.del').hidden = !(deck.words && deck.words[w.key]);
    row.querySelector('.play').addEventListener('click', function () { playWord(w.key, w.text); });
    row.querySelector('.rec').addEventListener('click', function (e) { recordWord(w.key, e.currentTarget); });
    row.querySelector('.pick').addEventListener('click', function () { wordFileKey = w.key; $('w-file').click(); });
    row.querySelector('.del').addEventListener('click', function () {
      if (!confirm('Remove the recording made for “' + w.text + '”? It goes back to ' +
        (H.wordAudio({ cards: deck.cards })[w.key] ? 'its card’s recording.' : 'the computer voice.'))) return;
      setWord(w.key, null);
    });
    return row;
  }

  function renderWords() {
    var host = $('wordlist');
    host.innerHTML = '';
    var all = H.pairWords(deck);
    var need = function (w) { return wordStatus(w.key).cls.indexOf('tts') === 0; };
    var ai = all.filter(function (w) { return wordStatus(w.key).cls === 'tts ai'; }).length;
    var tts = all.filter(need).length - ai;
    $('w-count').textContent = all.length + ' words · ' + ai + ' on an AI stand-in · ' + tts + ' on the computer voice';
    var only = $('w-only').checked;
    var frag = document.createDocumentFragment();
    all.forEach(function (w) {
      if (only && !need(w)) return;
      var row = wordRow(w, true);
      frag.appendChild(row);
    });
    host.appendChild(frag);
    if (!host.children.length) {
      var p = document.createElement('p');
      p.className = 'hint';
      p.style.padding = '14px 4px';
      p.textContent = only ? 'Every word has a real recording.' : 'No pairs yet.';
      host.appendChild(p);
    }
  }

  /* The two words of the card in the form, as currently typed. */
  function renderCardWords() {
    var host = $('cardwords');
    host.innerHTML = '';
    var seen = {};
    optionValues().forEach(function (text) {
      var key = H.wordKey(text);
      if (!key || seen[key]) return;
      seen[key] = true;
      host.appendChild(wordRow({ key: key, text: text.trim() }, false));
    });
    if (!host.children.length) {
      var p = document.createElement('p');
      p.className = 'hint';
      p.style.padding = '10px 4px';
      p.textContent = 'Type the two options above and their words appear here.';
      host.appendChild(p);
    }
  }

  $('f-o1').addEventListener('input', renderCardWords);
  $('f-o2').addEventListener('input', renderCardWords);

  /* ---------------------------------------------------------- publishing */

  function releaseFiles() {
    return H.prepareRelease(deck).then(function (rel) {
      return Promise.all(rel.files.map(function (f) {
        return H.blobBytes(f.blob).then(function (bytes) { return { path: f.path, bytes: bytes }; });
      })).then(function (audioFiles) {
        return {
          deck: rel.deck,
          entries: [{ path: 'data/deck.js', bytes: new TextEncoder().encode(H.serialize(rel.deck)) }].concat(audioFiles)
        };
      });
    });
  }

  $('downloadzip').addEventListener('click', function () {
    releaseFiles().then(function (rel) {
      H.download(H.zip(rel.entries), 'hear-the-difference-update.zip');
      msg($('topmsg'), 'Downloaded ' + rel.entries.length + ' file(s). Unzip over the project folder, then discard the draft.', 'ok');
    }).catch(function (err) {
      msg($('topmsg'), 'Could not build the zip: ' + err.message, 'err');
    });
  });

  function writeInto(dir, path, bytes) {
    var parts = path.split('/');
    var name = parts.pop();
    var walk = Promise.resolve(dir);
    parts.forEach(function (segment) {
      walk = walk.then(function (d) { return d.getDirectoryHandle(segment, { create: true }); });
    });
    return walk
      .then(function (d) { return d.getFileHandle(name, { create: true }); })
      .then(function (fh) { return fh.createWritable(); })
      .then(function (w) { return w.write(bytes).then(function () { return w.close(); }); });
  }

  /* Why writing in place might be unavailable. Brave ships the File System
   * Access API behind a flag rather than not implementing it, so say that
   * rather than the useless "this browser cannot". */
  var ZIP_FALLBACK = 'Use “Download changes (.zip)” and unzip it over the project instead.';

  function noPickerReason() {
    var generic = 'This browser cannot write to a folder directly. ' + ZIP_FALLBACK;
    var brave = 'Brave disables the File System Access API by default. Enable it at '
      + 'brave://flags/#file-system-access-api (set to Enabled, then relaunch) and this will work. '
      + 'Otherwise: ' + ZIP_FALLBACK;
    if (navigator.brave && typeof navigator.brave.isBrave === 'function') {
      return navigator.brave.isBrave().then(function (yes) { return yes ? brave : generic; })
        .catch(function () { return generic; });
    }
    return Promise.resolve(generic);
  }

  /* Read a deck.js already sitting in the target folder, so we can see what
   * this publish would replace. Returns null if it is absent or unreadable. */
  function readDeckAt(dir) {
    return dir.getDirectoryHandle('data')
      .then(function (d) { return d.getFileHandle('deck.js'); })
      .then(function (fh) { return fh.getFile(); })
      .then(function (file) { return file.text(); })
      .then(function (text) {
        var start = text.indexOf('{'), end = text.lastIndexOf('}');
        if (start < 0 || end < start) return null;
        try { return JSON.parse(text.slice(start, end + 1)); } catch (e) { return null; }
      })
      .catch(function () { return null; });
  }

  /* Publishing overwrites the deck wholesale, so refuse to do it silently when
   * the folder is not the project, or when the write would drop cards. Both
   * mistakes are easy to make and neither is obvious afterwards. */
  function confirmTarget(dir, next) {
    return dir.getFileHandle('index.html').then(function () { return true; })
      .catch(function () {
        return confirm('“' + dir.name + '” has no index.html, so it does not look like the '
          + 'project folder. Write data/deck.js and the audio into it anyway?');
      })
      .then(function (ok) {
        if (!ok) return false;
        return readDeckAt(dir).then(function (existing) {
          if (!existing || !existing.cards) return true;
          var before = existing.cards.length, after = next.cards.length;
          if (after >= before) return true;
          return confirm('This would replace the deck in “' + dir.name + '”, which has '
            + before + ' cards, with one that has ' + after + '. '
            + (before - after) + ' card(s) would be lost. Continue?');
        });
      });
  }

  $('publish').addEventListener('click', function () {
    if (!window.showDirectoryPicker) {
      noPickerReason().then(function (text) { msg($('topmsg'), text, 'err'); });
      return;
    }
    var files, dirName;
    releaseFiles()
      .then(function (rel) {
        files = rel;
        return projectDir || window.showDirectoryPicker({ mode: 'readwrite' });
      })
      .then(function (dir) {
        dirName = dir.name;
        return confirmTarget(dir, files.deck).then(function (ok) {
          if (!ok) return null;
          projectDir = dir;
          return files.entries.reduce(function (chain, entry) {
            return chain.then(function () { return writeInto(dir, entry.path, entry.bytes); });
          }, Promise.resolve()).then(function () { return true; });
        });
      })
      .then(function (written) {
        if (!written) { msg($('topmsg'), 'Nothing written.', ''); return; }
        // The draft is now on disk; clearing it means both pages read the
        // published deck again and the two cannot drift apart.
        deck = files.deck;
        H.clearDraft();
        msg($('topmsg'), 'Wrote ' + files.entries.length + ' file(s) into “' + dirName + '”: '
          + files.entries.map(function (e) { return e.path; }).join(', ')
          + '. Reload the drill to pick them up (Ctrl/Cmd+Shift+R if it still looks unchanged). '
          + 'A hosted copy only changes once you commit and push.', 'ok');
        render();
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return;
        msg($('topmsg'), 'Publish failed: ' + (err && err.message ? err.message : err), 'err');
      });
  });

  $('revert').addEventListener('click', function () {
    if (!isDirty()) { msg($('topmsg'), 'Nothing unpublished to discard.', ''); return; }
    if (!confirm('Throw away every unpublished change, including new recordings?')) return;
    deck.cards.forEach(function (c) { if (H.audio.isDraftRef(c.audio)) H.audio.del(c.audio); });
    Object.keys(deck.words || {}).forEach(function (k) { if (H.audio.isDraftRef(deck.words[k])) H.audio.del(deck.words[k]); });
    H.clearDraft();
    deck = H.published();
    clearForm();
    msg($('topmsg'), 'Draft discarded — back to what is committed in data/deck.js.', 'ok');
    render();
  });

  /* ---------------------------------------------------------------- boot */

  function render() {
    renderGroupOptions();
    renderGroups();
    renderList();
    renderWords();
    renderCardWords();
    renderStatus();
  }

  render();
  clearForm();
})();
