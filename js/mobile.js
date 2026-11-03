/* MonInv – Bedienung auf dem Handy
   Detailblatt der Karte (antippen / wischen), Ränder für die Karte, Höhe der Bildschirmtastatur.
   Gilt nur unterhalb von 760 px Breite (M.isMobile); auf dem PC ändert sich nichts. */
(function () {
  'use strict';
  var M = window.M;
  function $(id) { return document.getElementById(id); }
  var body = document.body;

  /* ---------- Ränder der Karte: Werkzeuge oben, Blatt unten */
  function sheetH() {
    var p = $('panel');
    if (!p || !M.isMobile() || M.state.view !== 'karte' || M.state.placing || M.state.drawing) return 0;
    return p.getBoundingClientRect().height;
  }
  M.mapEdges = function () {
    if (!M.isMobile()) return null;
    var t = $('map-tools'), top = t ? Math.max(0, t.querySelector('.seg') ? 52 : 0) : 0;
    return { top: top, bottom: sheetH() };
  };
  M.mapOffsetY = function () { return M.isMobile() ? Math.round(sheetH() / 2) : 0; };

  /* Höhe des Blatts als CSS-Variable: Massstab, Quellenangabe und Knöpfe bleiben darüber */
  function syncSheet() {
    var v = $('v-karte'); if (!v) return;
    v.style.setProperty('--sheet-h', Math.round(sheetH()) + 'px');
  }
  var p0 = $('panel');
  if (p0 && window.ResizeObserver) new ResizeObserver(syncSheet).observe(p0);
  window.addEventListener('resize', syncSheet);

  /* ---------- Blatt öffnen und schliessen */
  function hasSel() { return !!(M.state.sel || M.state.selKabel || (M.state.stack && M.state.stack.length)); }
  M.sheetToggle = function (open) {
    if (open === undefined) open = !body.classList.contains('sheet-open');
    body.classList.toggle('sheet-open', open);
    var p = $('panel'); if (p && !open) p.scrollTop = 0;
    setTimeout(syncSheet, 260);
  };

  /* Griff oben am Blatt: antippen = auf/zu, nach oben/unten wischen = öffnen/schliessen bzw. Auswahl aufheben */
  var drag = null;
  document.addEventListener('pointerdown', function (e) {
    if (!M.isMobile()) return;
    var g = e.target.closest && e.target.closest('.pn-grab, .pn-sum > .sec-h, .pn-sum > .big');
    if (!g) return;
    drag = { y: e.clientY, t: Date.now(), id: e.pointerId };
  }, { passive: true });
  document.addEventListener('pointerup', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dy = e.clientY - drag.y, quick = Date.now() - drag.t < 600, open = body.classList.contains('sheet-open');
    drag = null;
    if (Math.abs(dy) < 8) { M.sheetToggle(); return; }       // Tipp
    if (dy < -24 && quick) { M.sheetToggle(true); return; }   // nach oben
    if (dy > 24 && quick) {                                    // nach unten
      if (open) M.sheetToggle(false);
      else if (hasSel()) M.ACT.desel();
    }
  }, { passive: true });
  document.addEventListener('pointercancel', function () { drag = null; }, { passive: true });

  /* Nach dem Antippen eines Geräts: Symbol über dem Blatt halten */
  var sel0 = M.select;
  M.select = function (gid) {
    sel0.apply(this, arguments);
    if (gid && M.isMobile() && M.state.view === 'karte' && M.mapKeepVisible) setTimeout(function () { syncSheet(); M.mapKeepVisible(gid); }, 280);
    else setTimeout(syncSheet, 260);
  };
  var rp0 = M.renderPanel;
  M.renderPanel = function () {
    rp0.apply(this, arguments);
    var p = $('panel'); if (!p) return;
    if (!p.querySelector('.pn-grab')) p.insertAdjacentHTML('afterbegin', '<button type="button" class="pn-grab" aria-label="Blatt auf- oder zuklappen"><span></span></button>');
    setPeek(p);
    setTimeout(syncSheet, 0);
  };
  /* Höhe im zugeklappten Zustand: genau bis unter Kopf bzw. Übersichtszahl, nichts angeschnitten */
  function setPeek(p) {
    if (!M.isMobile()) return;
    var end = p.querySelector('.pn-sum > .big') || p.querySelector(':scope > .dt-loc') || p.querySelector(':scope > .dt-head');
    if (!end) { p.style.removeProperty('--peek'); return; }
    var y = end.offsetTop + end.offsetHeight + 10;
    p.style.setProperty('--peek', Math.max(80, Math.min(220, y)) + 'px');
  }

  /* ---------- Bildschirmtastatur (iOS): Dialoge nicht unter der Tastatur verstecken */
  if (window.visualViewport) {
    var vv = window.visualViewport;
    var kb = function () {
      var h = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb', (h > 80 ? h : 0) + 'px');
      body.classList.toggle('kb-open', h > 80);
    };
    vv.addEventListener('resize', kb); vv.addEventListener('scroll', kb);
  }

  /* Fokussiertes Feld in einem Dialog sichtbar halten */
  document.addEventListener('focusin', function (e) {
    if (!M.isMobile()) return;
    var t = e.target;
    if (!t || !t.matches || !t.matches('input, select, textarea') || !t.closest('.md-b, .dw-b, .placing')) return;
    setTimeout(function () { try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) { /* alt */ } }, 320);
  });
})();
