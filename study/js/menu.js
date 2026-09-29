/* Study section — the menu: decks to study and grammar sheets to open. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var S = window.STUDY;
  var data = S.load();
  S.registerOffline();

  if (!data) {
    $('decks').innerHTML = '<p class="empty">study/data/study.js did not load.</p>';
    return;
  }

  var KIND = { picture: 'Picture cards', verb: 'Verb forms' };

  function renderDecks() {
    var host = $('decks');
    host.innerHTML = '';
    data.decks.forEach(function (deck) {
      var total = S.usableCards(deck).length;
      if (!total) return; // an empty or unfinished deck is the editor's business
      var n = S.progress.counts(deck);
      var a = document.createElement('a');
      a.className = 'dcard';
      a.href = 'cards.html?deck=' + encodeURIComponent(deck.id);
      a.innerHTML = '<div class="kind"></div><h3></h3><p></p><div class="counts"></div>';
      a.querySelector('.kind').textContent = KIND[deck.kind] || 'Cards';
      a.querySelector('h3').textContent = deck.title || deck.id;
      a.querySelector('p').textContent = deck.blurb || '';
      a.querySelector('.counts').innerHTML = '<b>' + total + '</b> cards · Due <b>' + n.due +
        '</b> · New <b>' + n.fresh + '</b>';
      host.appendChild(a);
    });
    if (!host.children.length) host.innerHTML = '<p class="empty">No decks yet.</p>';
  }

  /* A published sheet is a plain link. A sheet still in the editor's draft
   * lives in this browser's storage, so it is opened from there on click. */
  function renderSheets() {
    var host = $('sheets');
    host.innerHTML = '';
    data.grammar.forEach(function (g) {
      if (!g.file) return;
      var draft = S.media.isDraft(g.file);
      var el = document.createElement(draft ? 'button' : 'a');
      el.className = 'sheet';
      if (!draft) { el.href = g.file; el.target = '_blank'; el.rel = 'noopener'; }
      el.innerHTML = '<span class="ico">PDF</span><span><b></b><span class="d"></span></span><span class="go">→</span>';
      el.querySelector('b').textContent = g.title || 'Untitled sheet';
      el.querySelector('.d').textContent = g.blurb || '';
      if (draft) {
        el.type = 'button';
        el.addEventListener('click', function () {
          var win = window.open('', '_blank');
          S.media.url(g.file).then(function (u) {
            if (!u) { if (win) win.close(); return; }
            u = new URL(u, location.href).href;
            if (win) win.location = u; else location.href = u;
          });
        });
      }
      host.appendChild(el);
    });
    if (!host.children.length) host.innerHTML = '<p class="empty">No grammar sheets yet.</p>';
  }

  function note(text) { $('savenote').textContent = text; }

  $('export').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(S.progress.all)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'progress-study.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  $('import').addEventListener('click', function () { $('importfile').click(); });
  $('importfile').addEventListener('change', function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try { Object.assign(S.progress.all, JSON.parse(r.result)); S.progress.save(); note('Progress imported.'); renderDecks(); }
      catch (err) { note('Could not read file.'); }
    };
    r.readAsText(f);
    e.target.value = '';
  });
  $('reset').addEventListener('click', function () {
    if (!confirm('Erase all saved vocabulary and verb progress? The listening drill is not affected.')) return;
    S.progress.all = {}; S.progress.save(); note('Reset.'); renderDecks();
  });

  renderDecks();
  renderSheets();
  if (!S.progress.persisted) note('Saving unavailable here — progress will not be kept.');
})();
