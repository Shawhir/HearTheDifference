/* Hear the Difference — makes the drill an installable app.
 *
 * Registers sw.js, which keeps a copy of the drill and its recordings so it
 * runs offline once installed. Loaded by index.html only: the editor is not
 * part of the app.
 *
 * Service workers need http(s), so opened straight off disk this does
 * nothing and the drill runs exactly as it always has.
 */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function (err) {
      console.warn('Hear the Difference: offline support unavailable', err);
    });
  });
})();
