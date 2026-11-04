/* MonInv – Bewegung
   Ruhige, kurze Übergänge, die beim Folgen helfen: Ansicht erscheint, Listen bauen sich gestaffelt auf,
   Kennzahlen zählen hoch, Balken wachsen, Dialoge und Gerätefenster blenden weich aus.
   Wer im Betriebssystem «Bewegung reduzieren» eingestellt hat, sieht alles sofort und ohne Animation. */
(function () {
  'use strict';
  var M = window.M;
  function $(id) { return document.getElementById(id); }
  var calm = function () { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); };
  M.calm = calm;

  /* ---------- Kennzahlen hochzählen (nur ganze Zahlen, optional mit «CHF » davor) */
  var NUM = /^(CHF\s)?([\d']+)$/;
  M.countUp = function (root) {
    if (calm() || !root) return;
    root.querySelectorAll('.big-n, .tile b, .hx-sum b, .abr-kpi b, .ci-sum b').forEach(function (el) {
      var m = NUM.exec(el.textContent.trim());
      if (!m) return;
      var end = +m[2].replace(/'/g, ''), pre = m[1] || '';
      if (!end || end > 1e7) return;
      var t0 = performance.now(), dur = Math.min(900, 380 + Math.log10(end + 1) * 140);
      el.textContent = pre + '0';
      (function step(now) {
        var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = pre + M.chf(Math.round(end * e));
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    });
  };

  /* ---------- Ansicht betreten: einblenden, Listen staffeln, zählen */
  var go0 = M.go;
  M.go = function (view) {
    var prev = M.state.view;
    go0.apply(this, arguments);
    var sec = $('v-' + M.state.view);
    if (!sec || calm()) return;
    if (prev === M.state.view && view !== undefined && sec.classList.contains('entered')) return;
    sec.classList.remove('enter'); void sec.offsetWidth; sec.classList.add('enter', 'entered');
    clearTimeout(sec._enterT); sec._enterT = setTimeout(function () { sec.classList.remove('enter'); }, 900);
    M.countUp(sec);
  };
  /* Ladebildschirm weich ausblenden */
  M.hideLoading = function () {
    var ld = $('loading'); if (!ld) return;
    if (calm()) { ld.hidden = true; return; }
    ld.classList.add('out'); setTimeout(function () { ld.hidden = true; ld.classList.remove('out'); }, 380);
  };

  /* Projekt wechseln: Detail neu einblenden und zählen */
  var rp0 = M.renderProjekte;
  M.renderProjekte = function () {
    var before = M.state.projSel + '|' + M.state.projMob;
    rp0.apply(this, arguments);
    var after = M.state.projSel + '|' + M.state.projMob, d = document.querySelector('#v-projekte .pl-detail');
    if (d && before !== after && !calm()) { d.classList.remove('swap'); void d.offsetWidth; d.classList.add('swap'); M.countUp(d); }
  };

  /* Gerätefenster: Kennzahlen im Reiter zählen */
  var rd0 = M.renderDrawer;
  M.renderDrawer = function (fresh) {
    var d = $('drawer'), had = d && !d.hidden && d.firstChild;
    var ghost = had && !M.state.drawer ? d.cloneNode(true) : null;
    rd0.apply(this, arguments);
    if (fresh && !calm()) M.countUp($('dw-b'));
    // schliessen: Kopie kurz ausblenden lassen
    if (ghost && !calm()) {
      ghost.id = ''; ghost.hidden = false; ghost.classList.add('dw-out'); ghost.setAttribute('aria-hidden', 'true');
      document.body.appendChild(ghost);
      setTimeout(function () { ghost.remove(); }, 200);
    }
  };

  /* Dialog schliessen: Kopie blendet aus, der echte Platz ist sofort frei (ein neuer Dialog kann direkt folgen) */
  var cm0 = M.closeModal;
  M.closeModal = function () {
    var root = $('modal-root'), mb = root && root.firstChild;
    var ghost = mb && !calm() ? mb.cloneNode(true) : null;
    cm0.apply(this, arguments);
    if (ghost) {
      ghost.classList.add('mb-out'); ghost.setAttribute('aria-hidden', 'true');
      ghost.querySelectorAll('[id]').forEach(function (el) { el.removeAttribute('id'); });
      document.body.appendChild(ghost);
      setTimeout(function () { ghost.remove(); }, 180);
    }
  };

})();
