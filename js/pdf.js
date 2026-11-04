/* MonInv – Abrechnung als PDF (A4 quer, RISTAG-Gestaltung)
   Gleiche Tabelle wie in der App: je Position die Summe, darunter jedes Gerät bzw. Set
   mit abgerechneten Monaten, Ansatz pro Monat und Beträgen. */
(function () {
  'use strict';
  var M = window.M;

  var MON_BG = [253, 236, 221], MON_BG2 = [249, 216, 190], MON_HEAD = [178, 86, 22], MON_TXT = [122, 52, 8];
  var BLAU = [0, 70, 142], NACHT = [0, 21, 42], STEIN = [94, 92, 91], LINIE = [226, 225, 224], NEBEL = [244, 244, 243];
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function chf(n) { return n ? M.chf(Math.round(n * 100) / 100) : '–'; }
  function ans(n) { return n ? M.chf(n) : '–'; }
  function mlabel(mk) { return mk.slice(5, 7) + '.' + mk.slice(2, 4); }
  function dat(iso) { return M.fmtDate(iso); }

  M.abrechnungPdf = function (pid) {
    var I = M.idx(), p = I.proj[pid], r = M.state.abr, A = M.abrechnung(pid, r.von, r.bis), G = M.ABR_GRUPPEN, posten = M.abrPosten(A);
    return Promise.all([M.loadScript('vendor/jspdf/jspdf.umd.min.js'), M.loadScript('vendor/fonts/exo2-800.js'), M.loadScript('assets/etikett-logo.js')]).then(function () {
      var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });
      doc.addFileToVFS('Exo2-ExtraBold.ttf', window.MONINV_FONT_EXO2_800);
      doc.addFont('Exo2-ExtraBold.ttf', 'Exo2', 'bold');
      var W = 297, H = 210, ML = 12, MR = 12, MT = 12, MB = 14, X1 = W - MR;
      var mons = A.monate, nm = mons.length, showM = nm <= 18;
      // Spalten: Name | Monate … | Anz. | Ansatz V B W | Betrag V B W Total
      var wAnz = 16, wAns = 15, wBet = 19, fixed = wAnz + 3 * wAns + 4 * wBet;
      var wName = showM ? (nm > 12 ? 58 : 72) : 110;
      var wMon = showM && nm ? (X1 - ML - fixed - wName) / nm : 0;
      if (!showM) wName = X1 - ML - fixed;
      var cols = [{ k: 'name', w: wName, al: 'left', t: 'Offertposition / Gerät' }];
      if (showM) mons.forEach(function (mk) { cols.push({ k: 'm', mk: mk, w: wMon, al: 'right', t: mlabel(mk) }); });
      cols.push({ k: 'n', w: wAnz, al: 'right', t: 'Monate' });
      cols.push({ k: 'av', w: wAns, al: 'right', t: 'Vorh.', g: 'ans' }, { k: 'ab', w: wAns, al: 'right', t: 'Betr.', g: 'ans' }, { k: 'aw', w: wAns, al: 'right', t: 'Wart.', g: 'ans' });
      cols.push({ k: 'v', w: wBet, al: 'right', t: 'Vorhalten', g: 'bet' }, { k: 'b', w: wBet, al: 'right', t: 'Betrieb', g: 'bet' }, { k: 'w', w: wBet, al: 'right', t: 'Wartung', g: 'bet' }, { k: 't', w: wBet, al: 'right', t: 'Total', g: 'bet' });
      var x = ML; cols.forEach(function (c) { c.x = x; x += c.w; });
      var PAD = 1.6, y = 0, page = 0;

      function font(style, size, col) { doc.setFont(style === 'head' ? 'Exo2' : 'helvetica', style === 'head' ? 'bold' : style); doc.setFontSize(size); var c = col || NACHT; doc.setTextColor(c[0], c[1], c[2]); }
      function txt(s, c, yy) {
        if (s === '' || s === null || s === undefined) return;
        s = String(s);
        if (c.al === 'right') doc.text(s, c.x + c.w - PAD, yy, { align: 'right' }); else doc.text(s, c.x + PAD, yy);
      }
      function fill(col, x0, y0, w, h) { doc.setFillColor(col[0], col[1], col[2]); doc.rect(x0, y0, w, h, 'F'); }
      function line(col, x0, y0, x1, y1, lw) { doc.setDrawColor(col[0], col[1], col[2]); doc.setLineWidth(lw || 0.2); doc.line(x0, y0, x1, y1); }
      var nX0 = cols.find(function (c) { return c.k === 'n'; }).x;
      function monCol(yy, h, dark) { fill(dark ? MON_BG2 : MON_BG, nX0, yy, wAnz, h); }
      var ansX0 = cols.find(function (c) { return c.g === 'ans'; }).x, betX0 = cols.find(function (c) { return c.g === 'bet'; }).x;

      function kopf(first) {
        page++;
        if (!first) doc.addPage();
        var L = window.MONINV_ETIKETT_LOGO;
        var lw = first ? 38 : 21;
        if (L) doc.addImage(L.png, 'PNG', X1 - lw, MT - 1, lw, lw / L.ratio, 'logo', 'FAST');
        if (first) {
          font('head', 20, NACHT); doc.text('Abrechnung ' + M.projName(p), ML, MT + 7);
          font('normal', 10, STEIN);
          var von = mons[0] || r.von, bis = mons[nm - 1] || r.bis;
          doc.text('Zeitraum ' + M.monLabel(von, true) + (nm > 1 ? ' bis ' + M.monLabel(bis, true) : '') + '   ·   erstellt am ' + dat(M.today()) + (M.userKuerzel() ? ' von ' + M.userKuerzel() : '') + '   ·   alle Beträge in CHF ohne MWST', ML, MT + 13);
          line(BLAU, ML, MT + 17, X1, MT + 17, 0.8);
          y = MT + 23;
        } else {
          font('head', 11, NACHT); doc.text('Abrechnung ' + M.projName(p) + ' (Fortsetzung)', ML, MT + 5);
          line(BLAU, ML, MT + 9, X1, MT + 9, 0.6);
          y = MT + 14;
        }
        // Tabellenkopf
        var hh = 10;
        fill(NACHT, ML, y, X1 - ML, hh);
        fill([31, 58, 92], ansX0, y, 3 * wAns, hh);
        fill(MON_HEAD, nX0, y, wAnz, hh);
        font('head', 6.4, [185, 195, 207]);
        doc.text('ANSATZ CHF PRO MONAT', ansX0 + PAD, y + 3.4);
        doc.text('BETRAG CHF (ANSATZ × MONATE)', betX0 + PAD, y + 3.4);
        if (showM && nm) doc.text('ABGERECHNETE MONATE', cols[1].x + PAD, y + 3.4);
        font('head', 7, [255, 255, 255]);
        var narrow = wMon && wMon < 9.5;
        cols.forEach(function (c) {
          if (c.k === 'm' && narrow) {   // schmale Monatsspalten: Monat und Jahr zweizeilig
            var mm = +c.mk.slice(5, 7) - 1;
            font('head', 6.2, [255, 255, 255]); txt(['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][mm], c, y + 6.2);
            font('head', 5.6, [185, 195, 207]); txt(c.mk.slice(2, 4), c, y + 9);
            font('head', 7, [255, 255, 255]);
            return;
          }
          txt(c.k === 'name' ? 'OFFERTPOSITION / GERÄT' : c.t.toUpperCase(), c, y + 8);
        });
        y += hh;
      }
      function need(h) { if (y + h > H - MB) kopf(false); }

      function rowCells(o, yy, opt) {
        cols.forEach(function (c) {
          if (c.k === 'name') return;
          if (o.flags === null && (c.k === 'm' || c.k === 'n')) return;   // Positionszeile: keine Monate
          var v;
          if (c.k === 'm') { var i = mons.indexOf(c.mk); v = o.flags[i] ? String(o.flags[i]) : '·'; }
          else if (c.k === 'n') { font('bold', opt.fs + 0.4, MON_TXT); txt(String(o.n), c, yy); font(opt.st, opt.fs, opt.col); return; }
          else if (c.g === 'ans') v = o[c.k] === null ? '' : ans(o[c.k]);
          else v = chf(o[c.k]);
          if (c.k === 'm' && v === '·') { font('normal', opt.fs, [180, 178, 176]); txt(v, c, yy); font(opt.st, opt.fs, opt.col); }
          else txt(v, c, yy);
        });
      }

      kopf(true);
      if (!posten.length) { font('normal', 11, STEIN); doc.text('In diesem Zeitraum lief kein abgerechnetes Gerät in diesem Projekt.', ML, y + 10); }
      M.ABR_ORDER.forEach(function (g) {
        var ps = posten.filter(function (x) { return x.g === g; }); if (!ps.length) return;
        var gc = hex(G[g].c), gl = hex(G[g].l), gt = hex(G[g].t);
        var gs = { n: 0, v: 0, b: 0, w: 0, t: 0 };
        need(7 + 12);
        fill(gl, ML, y, X1 - ML, 6.5); fill(gc, ML + 1.6, y + 2.1, 2.3, 2.3); monCol(y, 6.5);
        font('head', 9.5, gt); doc.text(G[g].n, ML + 5.6, y + 4.6);
        y += 6.5;
        ps.forEach(function (xp) {
          var P = xp.P, S = xp.sum;
          ['n', 'v', 'b', 'w', 't'].forEach(function (k) { gs[k] += S[k]; });
          // Positionszeile
          font('bold', 8.2, NACHT);
          var title = P ? ((P.nr ? P.nr + '  ' : '') + P.text) : 'Ohne Offertposition';
          var tl = doc.splitTextToSize(title, wName - 2 * PAD - 1.5);
          var sub = P ? [(P.art === 'set' ? 'Set-Preis' : 'Stückpreis'), xp.rows.length + (P.art === 'set' ? (xp.rows.length === 1 ? ' Set' : ' Sets') : (xp.rows.length === 1 ? ' Gerät' : ' Geräte'))].filter(Boolean).join(' · ') : 'Einzelansatz je Gerät (zählt als Vorhalten)';
          var wp = 0;
          var rh = Math.max(3.6 * tl.length + 4.4, wp ? 8.6 : 0);
          need(rh + 5.5);
          line([213, 212, 211], ML, y, X1, y, 0.35);
          fill(gc, ML, y, 1, rh);
          doc.text(tl, ML + PAD + 1.2, y + 3.6);
          font('normal', 6.6, STEIN); doc.text(sub, ML + PAD + 1.2, y + 3.6 * tl.length + 2.9);
          var o = { flags: null, n: S.n, av: P ? M.num(P.V) || 0 : null, ab: P ? M.num(P.B) || 0 : null, aw: P ? M.num(P.W) || 0 : null, v: S.v, b: S.b, w: S.w, t: S.t };
          fill([238, 243, 250], ansX0, y, 3 * wAns, rh);
          monCol(y, rh);
          font('bold', 8, NACHT); rowCells(o, y + 3.6, { st: 'bold', fs: 8, col: NACHT });
          if (wp) { font('normal', 6, STEIN); txt('+' + M.chf(wp) + ' einmalig', cols.find(function (c) { return c.k === 'aw'; }), y + 7); }
          y += rh;
          // Geräte
          xp.rows.forEach(function (u, idx) {
            font('normal', 7.6, NACHT);
            var label = (u.set ? u.set + ': ' : '') + u.label;
            var ll = doc.splitTextToSize(label, wName - 2 * PAD - 5);
            var mt = M.montageText(u);
            var dh = 3.4 * ll.length + 1.8 + (mt ? 2.7 : 0) + (u.ohne && u.modus === 'pauschal' ? 2 : 0);
            need(dh);
            if (idx % 2) fill(NEBEL, ML + 1, y, X1 - ML - 1, dh);
            fill([238, 243, 250], ansX0, y, 3 * wAns, dh);
            monCol(y, dh);
            fill(LINIE, ML, y, 1, dh);
            font('normal', 7.6, BLAU); doc.text(ll, ML + PAD + 4.5, y + 3.3);
            if (mt) { font('normal', 6, u.bis ? [154, 98, 6] : STEIN); doc.text('(' + mt + ')', ML + PAD + 4.5, y + 3.3 + 3.4 * (ll.length - 1) + 2.8); }
            var ou = { flags: u.flags, n: u.n, av: u.av, ab: u.ohne ? null : u.ab, aw: u.ohne ? null : u.aw, v: u.v, b: u.b, w: u.w, t: u.t };
            font('normal', 7.6, NACHT); rowCells(ou, y + 3.3, { st: 'normal', fs: 7.6, col: NACHT });
            if (u.ohne && u.modus === 'pauschal') { font('normal', 5.8, STEIN); txt('pauschal', cols.find(function (c) { return c.k === 'av'; }), y + 3.3 + 2.4); }
            y += dh;
          });
        });
        // Total der Gruppe
        need(7);
        fill(gl, ML, y, X1 - ML, 6.5);
        monCol(y, 6.5, true);
        font('head', 8.2, gt); doc.text('Total ' + G[g].n, ML + PAD + 1.2, y + 4.5);
        font('bold', 8, NACHT);
        rowCells({ flags: A.G[g].per.map(function (c) { return c.n; }), n: gs.n, av: null, ab: null, aw: null, v: gs.v, b: gs.b, w: gs.w, t: gs.t }, y + 4.5, { st: 'bold', fs: 8, col: NACHT });
        y += 8;
      });
      if (posten.length) {
        // Total Projekt
        need(16);
        monCol(y, 8, true);
        line(BLAU, ML, y, X1, y, 0.8);
        font('head', 10, NACHT); doc.text('Total Projekt', ML + PAD, y + 5.6);
        var tn = posten.reduce(function (a, x) { return a + x.sum.n; }, 0);
        font('bold', 8.6, NACHT);
        rowCells({ flags: mons.map(function (mk, i) { return M.ABR_ORDER.reduce(function (a, g) { return a + A.G[g].per[i].n; }, 0); }), n: tn, av: null, ab: null, aw: null, v: A.total.v, b: A.total.b, w: A.total.w, t: A.total.t }, y + 5.6, { st: 'bold', fs: 8.6, col: NACHT });
        y += 9;
        // Zusammenfassung je Gruppe
        need(26);
        var bx = X1 - 4 * wBet - 34, by = y + 2;
        font('head', 7, STEIN); doc.text('ZUSAMMENFASSUNG CHF', bx, by + 3);
        var sc = [{ t: 'Vorhalten', k: 'v' }, { t: 'Betrieb', k: 'b' }, { t: 'Wartung', k: 'w' }, { t: 'Total', k: 't' }];
        sc.forEach(function (c, i) { doc.text(c.t.toUpperCase(), bx + 34 + (i + 1) * wBet - PAD, by + 3, { align: 'right' }); });
        by += 4.5;
        M.ABR_ORDER.forEach(function (g) {
          var Sg = A.G[g].sum; if (!Sg.t) return;
          fill(hex(G[g].c), bx, by + 1.1, 2.2, 2.2);
          font('normal', 8, NACHT); doc.text(G[g].n, bx + 4, by + 3.2);
          sc.forEach(function (c, i) { doc.text(chf(Sg[c.k]), bx + 34 + (i + 1) * wBet - PAD, by + 3.2, { align: 'right' }); });
          by += 4.6;
        });
        line(NACHT, bx, by + 0.4, X1, by + 0.4, 0.3);
        font('bold', 8.6, NACHT); doc.text('Total', bx + 4, by + 4.2);
        sc.forEach(function (c, i) { doc.text(chf(A.total[c.k]), bx + 34 + (i + 1) * wBet - PAD, by + 4.2, { align: 'right' }); });
        // Hinweis links daneben
        font('normal', 7, STEIN);
        doc.text(doc.splitTextToSize('Abgerechnet wird pro Kalendermonat: mehr als 10 Tage in Betrieb = ganzer Monat (1), sonst nicht (·). «Monate» = Anzahl abgerechneter Monate des Geräts bzw. Sets. Ansatz in CHF pro Monat, Betrag in CHF = Ansatz × Monate. Ein Set hat einen gemeinsamen Preis und läuft, solange eines seiner Geräte im Projekt steht.', bx - ML - 10), ML, y + 5);
      }
      // Fusszeilen
      var n = doc.getNumberOfPages();
      for (var i = 1; i <= n; i++) {
        doc.setPage(i);
        line(LINIE, ML, H - 9, X1, H - 9, 0.3);
        font('normal', 7, STEIN);
        doc.text('RISTAG Ingenieure AG · MonInv ' + M.VERSION + ' · ' + M.projName(p), ML, H - 5.5);
        doc.text('Seite ' + i + ' von ' + n, X1, H - 5.5, { align: 'right' });
      }
      doc.setProperties({ title: 'Abrechnung ' + M.projName(p) + ' ' + M.monLabel(r.von, true) + ' bis ' + M.monLabel(r.bis, true), creator: 'MonInv ' + M.VERSION, author: 'RISTAG Ingenieure AG' });
      return doc.output('blob');
    });
  };

  /* PDF in neuem Tab: Tab sofort beim Klick öffnen (sonst blockt der Browser das Popup), Inhalt nachladen */
  M.pdfTab = function (title) {
    var w = null;
    try { w = window.open('', '_blank'); } catch (e) { w = null; }
    if (w) {
      try {
        w.document.write('<!doctype html><meta charset="utf-8"><title>' + M.esc(title || 'PDF') + '</title><body style="margin:0;font:16px Segoe UI,Arial,sans-serif;color:#00152A;display:flex;align-items:center;justify-content:center;height:100vh;background:#F4F4F3">PDF wird erstellt …</body>');
        w.document.close();
      } catch (e) { /* egal */ }
    }
    return w;
  };
  M.showPdf = function (tab, blob, name) {
    var url = URL.createObjectURL(blob);
    if (tab && !tab.closed) {
      try {
        // Seite mit Titel, Download-Knopf (richtiger Dateiname) und dem PDF darunter
        var d = tab.document, e = M.esc;
        d.open();
        d.write('<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + e(name) + '</title>' +
          '<style>html,body{margin:0;height:100%;background:#3A4350;font:14px "Segoe UI",Arial,sans-serif}.bar{display:flex;align-items:center;gap:12px;padding:8px 14px;background:#00152A;color:#fff}' +
          '.bar b{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bar a{color:#fff;background:#00468E;padding:8px 14px;text-decoration:none;font-weight:700}' +
          'iframe{display:block;border:0;width:100%;height:calc(100% - 50px);background:#fff}</style></head><body>' +
          '<div class="bar"><b>' + e(name) + '</b><a href="' + url + '" download="' + e(name) + '">Herunterladen</a><a href="' + url + '" target="_self">Nur PDF</a></div>' +
          '<iframe src="' + url + '#view=FitH" title="' + e(name) + '"></iframe></body></html>');
        d.close();
        return;   // URL bleibt gültig, solange der Tab offen ist
      } catch (err) { /* weiter unten */ }
    }
    URL.revokeObjectURL(url);
    M.openBlob(blob, name);   // Popup blockiert: im Fenster der App zeigen
    M.toast('Der Browser hat den neuen Tab blockiert – PDF wird hier angezeigt.');
  };

  Object.assign(M.ACT, {
    'abr-pdf': function (d, el) {
      var p = M.idx().proj[d.id], r = M.state.abr, tab = M.pdfTab('Abrechnung ' + M.projName(p));
      if (el) { el.disabled = true; el.textContent = 'PDF wird erstellt …'; }
      M.abrechnungPdf(d.id).then(function (blob) {
        M.showPdf(tab, blob, 'Abrechnung-' + (p.nummer || p.name).replace(/[^\w-]+/g, '_') + '-' + r.von + '_bis_' + r.bis + '.pdf');
      }).catch(function (e) { console.error(e); M.toast('PDF konnte nicht erstellt werden: ' + (e.message || e), 'err'); })
        .then(function () { if (el && el.isConnected) { el.disabled = false; el.textContent = 'Abrechnung als PDF'; } });
    }
  });
})();
