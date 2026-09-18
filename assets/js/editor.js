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

  $('publish').addEventListener('click', function () {
    if (!window.showDirectoryPicker) {
      msg($('topmsg'), 'This browser cannot write to a folder. Use “Download deck.zip” and unzip it over the project instead.', 'err');
      return;
    }
    var files;
    releaseFiles()
      .then(function (rel) {
        files = rel;
        return projectDir || window.showDirectoryPicker({ mode: 'readwrite' });
      })
      .then(function (dir) {
        projectDir = dir;
        return files.entries.reduce(function (chain, entry) {
          return chain.then(function () { return writeInto(dir, entry.path, entry.bytes); });
        }, Promise.resolve());
      })
      .then(function () {
        // The draft is now on disk; clearing it means both pages read the
        // published deck again and the two cannot drift apart.
        deck = files.deck;
        H.clearDraft();
        msg($('topmsg'), 'Published ' + files.entries.length + ' file(s) into the project. Commit them when you are happy.', 'ok');
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
    renderStatus();
  }

  render();
  clearForm();
})();
