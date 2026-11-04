/* MonInv – Auslastung der Geräte (Dashboard im Inventar)
   Auslastung = Tage im Feld ÷ verfügbare Tage im Zeitraum (ab Kauf bzw. erstem Einsatz, bis heute).
   Gruppiert nach Gerätegruppe und Kategorie; je Gerät ein Monatsraster (wie viel des Monats im Feld). */
(function () {
  'use strict';
  var M = window.M, S = window.MonSym, esc = M.esc;
  function $(id) { return document.getElementById(id); }
  var MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  /* ---------- Zeitraum */
  function range() {
    var r = M.state.ausl || (M.state.ausl = { k: '12', open: {} });
    var t = M.today(), y = +t.slice(0, 4), m = +t.slice(5, 7);
    var bis = t, von;
    if (r.k === 'jahr') von = y + '-01-01';
    else if (r.k === 'vorjahr') { von = (y - 1) + '-01-01'; bis = (y - 1) + '-12-31'; }
    else if (r.k === '6') von = M.addMonths(t, -6);
    else if (r.k === '24') von = M.addMonths(t, -24);
    else von = M.addMonths(t, -12);
    return { k: r.k, von: von, bis: bis };
  }
  function monthsOf(von, bis) {
    var out = [], d = new Date(von.slice(0, 7) + '-01T00:00:00'), end = bis.slice(0, 7);
    while (M.iso(d).slice(0, 7) <= end && out.length < 40) { out.push(M.iso(d).slice(0, 7)); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
    return out;
  }
  function overlap(a1, b1, a2, b2) { var a = a1 > a2 ? a1 : a2, b = b1 < b2 ? b1 : b2; return b > a ? M.days(a, b) : 0; }

  /* ---------- Kennzahlen je Gerät */
  function deviceStats(g, R, months) {
    var I = M.idx(), es = I.ein[g.id] || [], bisX = M.addDays ? M.addDays(R.bis, 1) : R.bis;
    var first = es.reduce(function (a, e) { return !a || e.von < a ? e.von : a; }, null);
    var start = [g.kaufdatum, first].filter(Boolean).sort()[0] || R.von;
    var a = start > R.von ? start : R.von;
    var avail = Math.max(0, M.days(a, bisX));
    var feld = 0, mag = 0, res = 0, mon = months.map(function () { return 0; });
    es.forEach(function (e) {
      var eb = e.bis || bisX, d = overlap(e.von, eb, a, bisX);
      if (!d) return;
      if (e.ort === 'feld') {
        feld += d;
        months.forEach(function (mk, n) {
          var m0 = mk + '-01', m1 = M.addMonths(m0, 1);
          mon[n] += overlap(e.von, eb, m0 > a ? m0 : a, m1 < bisX ? m1 : bisX);
        });
      } else { mag += d; if (e.reserviert) res += d; }
    });
    var monPct = months.map(function (mk, n) {
      var m0 = mk + '-01', m1 = M.addMonths(m0, 1), av = overlap(m0, m1, a, bisX);
      return av ? Math.min(1, mon[n] / av) : null;
    });
    return { feld: feld, mag: mag, res: res, avail: avail, pct: avail ? Math.min(1, feld / avail) : 0, mon: monPct };
  }

  /* ---------- Darstellung */
  function pctTxt(x) { return Math.round(x * 100) + ' %'; }
  function heat(x) {
    if (x === null) return 'var(--linie-2)';
    if (x <= 0) return '#EEF0F2';
    // von hellblau (wenig) nach RISTAG-Blau (voll)
    var a = [217, 230, 244], b = [0, 70, 142], k = Math.pow(x, .8);
    return 'rgb(' + a.map(function (v, i) { return Math.round(v + (b[i] - v) * k); }).join(',') + ')';
  }
  function bar(x, g) {
    return '<span class="au-bar"><i style="width:' + (x * 100).toFixed(1) + '%;background:' + g.ink + '"></i></span><b class="au-pct">' + pctTxt(x) + '</b>';
  }

  M.renderAuslastung = function () {
    var I = M.idx(), R = range(), months = monthsOf(R.von, R.bis), st = M.state.ausl, open = st.open;
    var devs = M.state.data.geraete.filter(function (g) { return g.typ !== 'messstelle' && g.zustand !== 'ausgemustert'; });
    var rows = devs.map(function (g) { var i = M.info(g.id); return { g: g, i: i, s: deviceStats(g, R, months) }; });
    // Gesamt
    var tot = { feld: 0, avail: 0, mag: 0, n: rows.length, nFeld: 0, nMag: 0, nRes: 0, ohne: 0 };
    rows.forEach(function (r) { tot.feld += r.s.feld; tot.avail += r.s.avail; tot.mag += r.s.mag; if (r.i.isMag) { tot.nMag++; if (r.i.res) tot.nRes++; } else if (r.i.cur) tot.nFeld++; if (!r.s.feld) tot.ohne++; });
    var avg = tot.avail ? tot.feld / tot.avail : 0;
    // Monatsverlauf gesamt: Anteil der Geräte im Feld
    var monTot = months.map(function (mk, n) { var s = 0, c = 0; rows.forEach(function (r) { if (r.s.mon[n] !== null) { s += r.s.mon[n]; c++; } }); return c ? s / c : null; });

    var ranges = [['6', '6 Monate'], ['12', '12 Monate'], ['24', '24 Monate'], ['jahr', 'Dieses Jahr'], ['vorjahr', 'Letztes Jahr']];
    var h = '<div class="page au-page"><div class="page-h"><button type="button" class="pd-back au-back" data-act="ausl-back"><span aria-hidden="true">‹</span> Inventar</button>' +
      '<h1>Auslastung</h1><span class="muted">' + M.fmtDate(R.von) + ' – ' + M.fmtDate(R.bis) + '</span><span class="grow"></span>' +
      '<div class="seg au-range" role="group" aria-label="Zeitraum">' + ranges.map(function (x) { return '<button type="button" data-act="ausl-range" data-k="' + x[0] + '" class="' + (R.k === x[0] ? 'on' : '') + '" aria-pressed="' + (R.k === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div></div>';

    h += '<div class="tiles4 au-kpi">' +
      '<div class="tile t-blue"><b>' + Math.round(avg * 100) + ' %</b><span>Ø Auslastung (Tage im Feld)</span></div>' +
      '<div class="tile"><b>' + tot.nFeld + '</b><span>jetzt im Feld</span></div>' +
      '<div class="tile"><b>' + tot.nMag + '</b><span>jetzt im Magazin' + (tot.nRes ? ', davon ' + tot.nRes + ' reserviert' : '') + '</span></div>' +
      '<div class="tile' + (tot.ohne ? ' t-warn' : '') + '"><b>' + tot.ohne + '</b><span>' + (tot.ohne === 1 ? 'Gerät' : 'Geräte') + ' im Zeitraum nie im Feld</span></div></div>';

    // Verlauf gesamt
    h += '<div class="au-trend"><div class="au-th"><b>Verlauf</b><span class="muted small">Anteil der Geräte im Feld je Monat</span></div><div class="au-cols">' +
      months.map(function (mk, n) {
        var x = monTot[n] || 0;
        return '<div class="au-col" title="' + MON[+mk.slice(5) - 1] + ' ' + mk.slice(0, 4) + ': ' + pctTxt(x) + '"><span class="au-v">' + Math.round(x * 100) + '</span><span class="au-c" style="height:' + Math.max(2, x * 100).toFixed(1) + '%;--d:' + (n * 0.025).toFixed(3) + 's"></span><span class="au-m">' + MON[+mk.slice(5) - 1] + (mk.slice(5) === '01' || n === 0 ? '<br>' + mk.slice(2, 4) : '') + '</span></div>';
      }).join('') + '</div></div>';

    // Gruppen → Kategorien → Geräte
    var monHead = '<span class="au-hm au-hm-h">' + months.map(function (mk) { return '<i title="' + MON[+mk.slice(5) - 1] + ' ' + mk.slice(0, 4) + '">' + MON[+mk.slice(5) - 1].charAt(0) + '</i>'; }).join('') + '</span>';
    h += '<div class="au-legend"><span>Monatsraster:</span><i style="background:' + heat(0) + '"></i> nie im Feld <i style="background:' + heat(.5) + '"></i> halber Monat <i style="background:' + heat(1) + '"></i> ganzer Monat <i style="background:' + heat(null) + '"></i> noch nicht vorhanden</div>';
    S.GRUPPEN_ORDER.forEach(function (gk) {
      var G = S.GRUPPEN[gk], gr = rows.filter(function (r) { return r.i.gruppe === gk; });
      if (!gr.length) return;
      var gf = 0, ga = 0; gr.forEach(function (r) { gf += r.s.feld; ga += r.s.avail; });
      var gOpen = open['g:' + gk] !== false;
      h += '<section class="au-grp' + (gOpen ? ' open' : '') + '" style="--gc:' + G.ink + ';--gl:' + G.fill + '">' +
        '<button type="button" class="au-gh" data-act="ausl-tog" data-k="g:' + gk + '" aria-expanded="' + gOpen + '">' + S.symbolHtml(gk, M.GRP_PIK[gk], { size: 26 }) +
        '<span class="au-gn"><b>' + esc(G.name) + '</b><span class="muted small">' + gr.length + (gr.length === 1 ? ' Gerät' : ' Geräte') + '</span></span>' + bar(ga ? gf / ga : 0, G) + '<span class="au-chev" aria-hidden="true">›</span></button>';
      if (gOpen) {
        // Kategorien
        var cats = {};
        gr.forEach(function (r) { var k = r.i.kat ? r.i.kat.id : 'typ:' + r.g.typ; (cats[k] = cats[k] || { name: r.i.kat ? r.i.kat.name : M.typLabel[r.g.typ], list: [] }).list.push(r); });
        Object.keys(cats).sort(function (a, b) { return cats[a].name.localeCompare(cats[b].name, 'de'); }).forEach(function (ck) {
          var c = cats[ck], cf = 0, ca = 0; c.list.forEach(function (r) { cf += r.s.feld; ca += r.s.avail; });
          var cOpen = !!open['c:' + ck];
          c.list.sort(function (a, b) { return b.s.pct - a.s.pct || String(a.g.name).localeCompare(String(b.g.name), 'de', { numeric: true }); });
          h += '<div class="au-cat' + (cOpen ? ' open' : '') + '"><button type="button" class="au-ch" data-act="ausl-tog" data-k="c:' + ck + '" aria-expanded="' + cOpen + '"><span class="au-chev" aria-hidden="true">›</span><b>' + esc(c.name) + '</b><span class="muted small">' + c.list.length + '</span>' + bar(ca ? cf / ca : 0, G) + '</button>';
          if (cOpen) {
            h += '<div class="au-rows"><div class="au-row au-rh"><span>Gerät</span><span>Auslastung</span><span class="r">Feld</span><span class="r">Magazin</span>' + monHead + '<span>Jetzt</span></div>';
            c.list.forEach(function (r) {
              h += '<div class="au-row"><button type="button" class="link-btn strong au-n" data-act="open" data-id="' + r.g.id + '">' + M.symbol(r.g.id, 18) + esc(r.g.name) + '</button>' +
                '<span class="au-b">' + bar(r.s.pct, G) + '</span>' +
                '<span class="r mono small">' + r.s.feld + ' T</span><span class="r mono small muted">' + r.s.mag + ' T</span>' +
                '<span class="au-hm">' + r.s.mon.map(function (x, n) { return '<i style="background:' + heat(x) + '" title="' + MON[+months[n].slice(5) - 1] + ' ' + months[n].slice(0, 4) + ': ' + (x === null ? 'noch nicht vorhanden' : pctTxt(x) + ' im Feld') + '"></i>'; }).join('') + '</span>' +
                '<span class="au-st">' + M.stateChip(r.g.id) + '</span></div>';
            });
            h += '</div>';
          }
          h += '</div>';
        });
      }
      h += '</section>';
    });
    h += '<p class="muted small">Auslastung = Tage im Feld ÷ Tage, in denen das Gerät im Zeitraum vorhanden war (ab Kauf bzw. erstem Einsatz). Magazin und Reservation zählen nicht als Einsatz. Messstellen erscheinen nicht selbst, ihre Geräte einzeln; ausgemusterte Geräte fehlen. Kategorie antippen klappt die Geräte auf.</p></div>';
    $('v-inventar').innerHTML = h;
  };

  /* ---------- Einbindung ins Inventar */
  var ri0 = M.renderInventar;
  M.renderInventar = function () {
    if (M.state.invMode === 'ausl') return M.renderAuslastung();
    ri0.apply(this, arguments);
    var hd = document.querySelector('#v-inventar .page-h');
    if (hd && !hd.querySelector('[data-act="ausl"]')) {
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'btn ghost'; btn.setAttribute('data-act', 'ausl');
      btn.innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg> Auslastung';
      var scan = hd.querySelector('[data-act="scan-multi"]');
      hd.insertBefore(btn, scan || null);
    }
  };
  function enter() { var sec = $('v-inventar'); if (!sec || (M.calm && M.calm())) return; sec.classList.remove('enter'); void sec.offsetWidth; sec.classList.add('enter'); setTimeout(function () { sec.classList.remove('enter'); }, 900); if (M.countUp) M.countUp(sec); }
  Object.assign(M.ACT, {
    'ausl': function () { M.state.invMode = 'ausl'; M.renderInventar(); var pg = document.querySelector('#v-inventar .page'); if (pg) pg.scrollTop = 0; enter(); },
    'ausl-back': function () { M.state.invMode = null; M.renderInventar(); enter(); },
    'ausl-range': function (d) { range(); M.state.ausl.k = d.k; M.renderAuslastung(); if (M.countUp) M.countUp($('v-inventar')); },
    'ausl-tog': function (d) { range(); var o = M.state.ausl.open, k = d.k; o[k] = k.indexOf('g:') === 0 ? o[k] === false : !o[k]; M.renderAuslastung(); }
  });
  // zurück zur Liste, wenn man das Inventar über die Navigation neu öffnet
  var go0 = M.go;
  M.go = function (v) { if (v === 'inventar' && M.state.view === 'inventar' && M.state.invMode) M.state.invMode = null; return go0.apply(this, arguments); };
})();
