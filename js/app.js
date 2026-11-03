/* MonInv – Start, Navigation, Ereignisse */
(function () {
  'use strict';
  var M = window.M, esc = M.esc;
  function $(id) { return document.getElementById(id); }
  var VIEWS = ['karte', 'inventar', 'tachymeter', 'projekte', 'einstellungen'];

  /* ---------- Darstellung */
  M.renderView = function () {
    var v = M.state.view;
    VIEWS.forEach(function (k) { $('v-' + k).hidden = k !== v; });
    document.querySelectorAll('[data-view]').forEach(function (b) {
      if (b.closest('.nav') || b.closest('.tabbar')) b.classList.toggle('on', b.getAttribute('data-view') === v);
    });
    if (v === 'karte') { M.renderMapSide(); M.renderMapTools(); M.renderPanel(); M.renderPlacing(); M.mapInit(); }
    if (v === 'inventar') M.renderInventar();
    if (v === 'tachymeter') M.renderTachy();
    if (v === 'projekte') M.renderProjekte();
    if (v === 'einstellungen') M.renderSettings();
    M.renderDrawer();
    M.renderBanner();
  };
  M.refreshUI = function () {
    M.renderView();
    M.mapUpdate();
  };
  /* Aktualisieren ohne laufende Eingaben (Platzieren, Zeichnen, Suche) zu stören */
  M.softRefresh = function () {
    if (M.state.placing || M.state.drawing) return;
    var a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && !a.closest('#modal-root')) return;
    M.refreshUI();
  };
  M.renderBanner = function () {
    var st = M.settings(), el = $('banner');
    if (M.store.mode === 'lokal' && st.beispiel) {
      el.hidden = false;
      el.innerHTML = '<span><b>Testbetrieb mit Beispieldaten.</b> Alles bleibt in diesem Browser.</span><button type="button" class="link-btn" data-act="go" data-view="einstellungen">Einstellungen ›</button>';
    } else el.hidden = true;
  };

  M.go = function (view, push) {
    if (VIEWS.indexOf(view) < 0) view = 'karte';
    if (view === 'projekte' && M.state.view === 'projekte') M.state.projMob = null;   // zweiter Tipp auf «Projekte» = zurück zur Liste
    M.state.view = view;
    if (view !== 'karte') { M.state.placing = null; M.state.drawing = null; }
    if (push !== false && location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    document.body.classList.remove('side-open');
    M.renderView();
    window.scrollTo(0, 0);
  };

  /* ---------- Auswahl */
  M.showStack = function (ids) {
    M.state.stack = ids; M.state.sel = null; M.state.selKabel = null;
    M.renderPanel(); M.mapMarkSel(null, null);
    document.body.classList.add('sheet-open');
    var pn = $('panel'); if (pn) pn.scrollTop = 0;
  };
  M.select = function (gid) {
    M.state.stack = null;
    var prev = M.state.sel, hadKabel = M.state.selKabel;
    M.state.sel = gid;
    M.state.selKabel = null;
    if (M.state.view !== 'karte') { M.openDrawer(gid); return; }
    M.renderPanel();
    M.mapMarkSel(prev, gid);
    if (hadKabel) M.mapRedrawKabel();
    document.body.classList.toggle('sheet-open', !!gid);
    var pn = $('panel'); if (pn) { pn.scrollTop = 0; pn.classList.add('anim-in'); clearTimeout(M._animT); M._animT = setTimeout(function () { pn.classList.remove('anim-in'); }, 450); }
  };
  M.selectKabel = function (kid) {
    var prev = M.state.sel;
    M.state.sel = null;
    M.state.selKabel = kid;
    M.state.drawer = null;
    if (M.state.view !== 'karte') M.go('karte');
    M.renderPanel();
    M.mapMarkSel(prev, null);
    M.mapRedrawKabel();
    document.body.classList.toggle('sheet-open', !!kid);
  };
  M.open = function (gid) {
    if (M.state.view === 'karte') { M.select(gid); M.mapFocus(gid); }
    else M.openDrawer(gid);
  };
  /* Gerätefenster: gross, mit Reitern Gerät / Historie / Amortisation */
  M.openDrawer = function (gid, tab) {
    if (M.state.drawer !== gid) M.state.drawerTab = tab || 'geraet';
    else if (tab) M.state.drawerTab = tab;
    M.state.drawer = gid;
    M.renderDrawer(true);
  };
  M.renderDrawer = function (fresh) {
    var d = $('drawer'), id = M.state.drawer;
    if (!id || !M.idx().ger[id]) { M.state.drawer = null; d.hidden = true; d.innerHTML = ''; document.body.classList.remove('drawer-open'); return; }
    var b = $('dw-b'), keep = !fresh && b ? b.scrollTop : 0;
    d.hidden = false;
    document.body.classList.add('drawer-open');
    d.innerHTML = M.drawerHtml(id, M.state.drawerTab);
    d.classList.toggle('still', !fresh);
    d.classList.toggle('tabsw', fresh === 'tab');
    if (keep) $('dw-b').scrollTop = keep;
    if (fresh === true) { var x = d.querySelector('.md-x'); if (x) x.focus(); }
  };

  /* ---------- Dateien hochladen und ansehen */
  M.doUpload = function (ziel, zielId, files) {
    if (!files || !files.length) return;
    var artSel = $('fu-art-' + zielId), art = artSel ? artSel.value : '';
    var prog = $('fu-prog-' + zielId);
    if (prog) prog.textContent = 'Lädt hoch …';
    M.toast(files.length === 1 ? files[0].name + ' wird hochgeladen …' : files.length + ' Dateien werden hochgeladen …');
    M.uploadFiles(ziel, zielId, files, art, function (n, t) { var pr = $('fu-prog-' + zielId); if (pr) pr.textContent = n + ' / ' + t; })
      .then(function (ok) { M.toast(ok.length + (ok.length === 1 ? ' Datei gespeichert' : ' Dateien gespeichert')); M.refreshUI(); })
      .catch(function (e) { M.toast('Hochladen fehlgeschlagen: ' + (e.message || e), 'err'); M.refreshUI(); });
  };
  M.openViewer = function (fid) {
    M.closeViewer();
    var v = document.createElement('div');
    v.id = 'viewer'; v.className = 'vw';
    v.innerHTML = '<div class="vw-bar"><b class="vw-t">Lädt …</b><span class="grow"></span><button type="button" class="btn sm ghost-inv" data-act="viewer-tab">In neuem Tab</button><a class="btn sm ghost-inv" id="vw-dl" download>Herunterladen</a><button type="button" class="md-x vw-x" data-act="viewer-close" aria-label="Schliessen">×</button></div><div class="vw-b"><div class="vw-load"><span class="spin"></span></div></div>';
    document.body.appendChild(v);
    document.body.classList.add('viewer-open');
    requestAnimationFrame(function () { v.classList.add('in'); });
    M.fileBlob(fid).then(function (r) {
      if (!$('viewer')) return;
      var url = M.viewerUrl = URL.createObjectURL(r.blob);
      v.querySelector('.vw-t').textContent = r.f.name;
      var dl = $('vw-dl'); dl.href = url; dl.setAttribute('download', r.f.name);
      var b = v.querySelector('.vw-b');
      if (M.isBild(r.f)) b.innerHTML = '<div class="vw-img"><img src="' + url + '" alt="' + M.esc(r.f.name) + '"></div>';
      else if (M.isPdf(r.f)) b.innerHTML = '<iframe class="vw-pdf" src="' + url + '#view=FitH" title="' + M.esc(r.f.name) + '"></iframe>';
      else b.innerHTML = '<div class="vw-none"><p>Für diese Datei gibt es keine Vorschau.</p><a class="btn" href="' + url + '" download="' + M.esc(r.f.name) + '">Herunterladen</a></div>';
      var img = b.querySelector('.vw-img');
      if (img) img.addEventListener('click', function () { img.classList.toggle('zoom'); });
    }).catch(function (e) {
      var b = v.querySelector('.vw-b'); if (b) b.innerHTML = '<div class="vw-none"><p>' + M.esc(e.message || String(e)) + '</p></div>';
    });
  };
  M.closeViewer = function () {
    var v = $('viewer'); if (v) v.remove();
    document.body.classList.remove('viewer-open');
    if (M.viewerUrl) { URL.revokeObjectURL(M.viewerUrl); M.viewerUrl = null; }
  };

  /* ---------- Platzieren */
  M.startPlacing = function (kind, id, job) {
    M.state.drawer = null; M.renderDrawer();
    M.state.drawing = null;
    if (M.state.view !== 'karte') M.go('karte');
    M.state.placing = { kind: kind, id: id, job: job || null };
    var c = null;
    if (kind === 'geraet' || kind === 'platz') { var i = M.info(id); if (i.pos) c = i.pos; }
    else { var p = M.idx().proj[id]; if (p && M.has(p.lat)) c = { lat: p.lat, lng: p.lng }; }
    M.mapInvalidate();
    if (c) setTimeout(function () { M.mapFocusPoint(c.lat, c.lng, 17); }, 80);
    document.body.classList.remove('sheet-open');
    M.renderPlacing();
  };
  M.placeAt = function (lat, lng) {
    var pl = M.state.placing;
    if (!pl) return;
    M.state.placing = null;
    var job;
    var q = pl.job && pl.job.queue ? pl.job : null;
    if (q) {
      var ids = q.same ? q.ids : [pl.id];
      job = ids.reduce(function (p, id) { return p.then(function () { return M.setPos(id, lat, lng); }); }, Promise.resolve());
      return job.then(function () {
        q.done += ids.length;
        M.refreshUI();
        if (!q.same && q.i + 1 < q.ids.length) { q.i++; M.toast((M.idx().ger[pl.id] || {}).name + ' gesetzt · weiter mit ' + M.idx().ger[q.ids[q.i]].name); M.startPlacing('geraet', q.ids[q.i], q); }
        else { M.toast(q.done + (q.done === 1 ? ' Position' : ' Positionen') + ' gespeichert'); M.state.invSel = {}; M.mapFitIds && M.mapFitIds(q.ids); }
      });
    }
    if (pl.kind === 'geraet') job = M.setPos(pl.id, lat, lng);
    else if (pl.kind === 'platz') {
      var j = pl.job, t = Object.assign({}, j.t, { lat: lat, lng: lng });
      var pre = Promise.resolve(), g = M.idx().ger[pl.id];
      if (j.mcc && g.mccId !== j.mcc) { var g2 = M.copy(g); g2.mccId = j.mcc; pre = M.put('geraete', g2); }
      job = pre.then(function () { return M.move(pl.id, t, j.datum, { wer: j.wer, mitMcc: true }); });
    }
    else { var p = M.copy(M.idx().proj[pl.id]); p.lat = lat; p.lng = lng; job = M.put('projekte', p); }
    job.then(function () {
      M.toast((pl.kind === 'platz' ? (M.idx().ger[pl.id] || {}).name + ' platziert' : 'Position gespeichert') + ' · LV95 ' + M.fmtLv95(lat, lng));
      M.refreshUI();
      if (pl.kind === 'geraet' || pl.kind === 'platz') { M.select(pl.id); M.mapFocus(pl.id); }
    });
  };

  /* ---------- Kabel zeichnen */
  M.startDrawing = function (opts) {
    opts = opts || {};
    M.state.placing = null;
    M.state.drawer = null; M.renderDrawer();
    if (M.state.view !== 'karte') M.go('karte');
    var d = { kabelId: opts.kabelId || null, pts: [], vonId: null, zuId: null };
    if (opts.fromId) {
      var i = M.info(opts.fromId);
      if (i && i.pos) { d.pts.push([i.pos.lat, i.pos.lng]); d.zuId = opts.fromId; }
    }
    if (opts.kabelId) {
      var k = M.idx().kab[opts.kabelId];
      d.vonId = k.vonId; d.zuId = k.zuId;
    }
    M.state.drawing = d;
    M.state.selKabel = null;
    document.body.classList.remove('sheet-open');
    M.renderPanel();
    M.renderPlacing();
    M.mapUpdate();
    if (d.pts.length) setTimeout(function () { M.mapFocusPoint(d.pts[0][0], d.pts[0][1], 18); }, 80);
  };
  M.finishDrawing = function () {
    var d = M.state.drawing;
    if (!d || d.pts.length < 2) return;
    M.state.drawing = null;
    M.renderPlacing();
    if (d.kabelId) {
      var k = M.copy(M.idx().kab[d.kabelId]);
      k.punkte = d.pts; if (d.zuId) k.zuId = d.zuId; if (d.vonId) k.vonId = d.vonId;
      M.put('kabel', k).then(function () { M.toast('Kabel neu gezeichnet · ' + M.fmtLen(M.lineLen(k.punkte))); M.state.selKabel = k.id; M.refreshUI(); });
    } else {
      M.mapUpdate();
      M.openKabel(null, { punkte: d.pts, zuId: d.zuId, vonId: d.vonId, projektId: d.zuId ? (M.info(d.zuId).proj || {}).id || null : null });
    }
  };

  /* ---------- Export */
  function download(name, content, type) {
    var blob = new Blob([content], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function csv(rows) {
    return '﻿' + rows.map(function (r) {
      return r.map(function (v) {
        v = v === null || v === undefined ? '' : String(v);
        return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(';');
    }).join('\r\n');
  }
  function stamp() { return M.today(); }
  // lange Ziffernfolgen (SIM) so schreiben, dass Excel sie nicht in 8.94E+19 umwandelt
  function xlText(v) { v = v || ''; return /^\d{12,}$/.test(String(v).replace(/\s/g, '')) ? '="' + v + '"' : v; }
  M.exportGeraete = function (list, fileName) {
    var xs = {};
    M.state.data.kategorien.forEach(function (k) { (k.felder || []).forEach(function (f) { xs[f.name] = true; }); });
    var xk = Object.keys(xs);
    var head = ['Name', 'Gerätetyp', 'Kategorie', 'Gruppe', 'Typ', 'Hersteller', 'Seriennummer', 'Kaufdatum', 'Wert CHF', 'Amortisation aktueller Standort', 'Vor Erfassung amortisiert CHF', 'Stand per', 'Amortisiert total CHF', 'Standorte', 'Restwert CHF', 'Ertrag über Anschaffung CHF',
      'SIM-Karte', 'Zustand', 'Standort', 'Projekt', 'Auftrag', 'Seit', 'Ost LV95', 'Nord LV95', 'Letzte Wartung', 'Tage seit Wartung', 'Intervall Monate', 'MCC / Tachymeter', 'Messstelle', 'Kabel', 'Bemerkung'].concat(xk);
    var rows = [head];
    (list || M.state.data.geraete).forEach(function (g) {
      var i = M.info(g.id), lv = i.posSrc === 'eigen' ? M.toLv95(i.pos.lat, i.pos.lng) : null;
      var link = g.typ === 'tachymeter' ? (M.mccOf(g.id) || {}).name : g.typ === 'mcc' ? (i.mccTs || {}).name : '';
      rows.push([g.name, M.typLabel[g.typ], i.kat ? i.kat.name : '', window.MonSym.GRUPPEN[i.gruppe].name, g.gtyp || '', g.hersteller || '', xlText(g.seriennummer),
        M.fmtDate(g.kaufdatum), g.wert, i.cur && !i.isMag ? M.amortText(i.cur) : '', M.num(g.amortVor) || 0, g.amortVorDatum ? M.fmtDate(g.amortVorDatum) : '', i.amortSum, i.nStandorte, i.restwert, i.ertrag, xlText(g.sim), g.zustand === 'ausgemustert' ? 'Ausgemustert' : M.stateLabel[i.state][0],
        i.mccTs ? 'bei ' + i.mccTs.name : i.ortText, i.proj ? M.projName(i.proj) : '', i.cur && !i.isMag ? M.auftragOf(i.cur) : '',
        i.cur ? M.fmtDate(i.cur.von) : '', lv ? Math.round(lv.e) : '', lv ? Math.round(lv.n) : '',
        i.wart ? M.fmtDate(i.wart.letzte) : '', i.wart ? i.wart.tage : '', i.wart ? i.wart.intervall : '', link || '', i.ms ? i.ms.name : (i.members ? i.members.length + ' Geräte' : ''), i.kabel.length || '', g.bemerkung || ''
      ].concat(xk.map(function (k) { return g.extra ? g.extra[k] : ''; })));
    });
    download(fileName || 'MonInv-Geraete-' + stamp() + '.csv', csv(rows), 'text/csv;charset=utf-8');
  };
  M.exportAbrechnung = function (pid) {
    var I = M.idx(), p = I.proj[pid], r = M.state.abr, A = M.abrechnung(pid, r.von, r.bis), G = M.ABR_GRUPPEN, posten = M.abrPosten(A);
    function rd(x) { return Math.round((x || 0) * 100) / 100; }
    function mtxt(mk) { return mk.slice(5, 7) + '.' + mk.slice(0, 4); }
    var head = ['Gruppe', 'Pos.', 'Bezeichnung', 'Auftrag', 'Preisart', 'Gerät / Einheit', 'Montiert', 'Abgebaut', 'Geplant bis'].concat(A.monate.map(mtxt))
      .concat(['Monate', 'Ansatz Vorhalten CHF / Mt.', 'Ansatz Betrieb CHF / Mt.', 'Ansatz Wartung CHF / Mt.', 'Wartung einmalig CHF', 'Vorhalten CHF', 'Betrieb CHF', 'Wartung CHF', 'Total CHF']);
    var rows = [['Abrechnung ' + M.projName(p) + ' · ' + mtxt(A.monate[0] || r.von) + ' bis ' + mtxt(A.monate[A.monate.length - 1] || r.bis) + ' · Monat zählt ab mehr als 10 Tagen in Betrieb'], [], head];
    M.ABR_ORDER.forEach(function (g) {
      var ps = posten.filter(function (x) { return x.g === g; }); if (!ps.length) return;
      var gs = { n: 0, v: 0, b: 0, w: 0, t: 0 };
      ps.forEach(function (x) {
        var P = x.P, S = x.sum, base = [G[g].n, P ? P.nr || '' : '', P ? P.text : 'ohne Position (Einzelansatz)', P ? P.auftrag || '' : '', P ? (P.art === 'set' ? 'Set-Preis' : 'Stückpreis') : ''];
        ['n', 'v', 'b', 'w', 't'].forEach(function (k) { gs[k] += S[k]; });
        rows.push(base.concat(['Total Position', '', '', '']).concat(S.per.map(function () { return ''; })).concat(['', P ? rd(M.num(P.V)) : '', P ? rd(M.num(P.B)) : '', P ? rd(M.num(P.W)) : '', P && M.num(P.Wp) ? rd(M.num(P.Wp)) : '', rd(S.v), rd(S.b), rd(S.w), rd(S.t)]));
        x.rows.forEach(function (u) {
          rows.push(base.concat([(u.set ? u.set + ': ' : '') + u.label, u.von ? M.fmtDate(u.von) : '', u.bis ? M.fmtDate(u.bis) : '', u.planBis ? M.fmtDate(u.planBis) : '']).concat(u.flags).concat([u.n, rd(u.av) + (u.ohne && u.modus === 'pauschal' ? ' pauschal' : ''), rd(u.ab), rd(u.aw), u.wp ? rd(u.wp) : '', rd(u.v), rd(u.b), rd(u.w), rd(u.t)]));
        });
      });
      rows.push(['Total ' + G[g].n, '', '', '', '', '', '', '', ''].concat(A.G[g].per.map(function (c) { return c.n; })).concat([gs.n, '', '', '', '', rd(gs.v), rd(gs.b), rd(gs.w), rd(gs.t)]));
    });
    rows.push(['Total Projekt', '', '', '', '', '', '', '', ''].concat(A.monate.map(function (mk, i) { return M.ABR_ORDER.reduce(function (a, g) { return a + A.G[g].per[i].n; }, 0); }))
      .concat([posten.reduce(function (a, x) { return a + x.sum.n; }, 0), '', '', '', '', rd(A.total.v), rd(A.total.b), rd(A.total.w), rd(A.total.t)]));
    download('MonInv-Abrechnung-' + (p.nummer || p.name).replace(/[^\w-]+/g, '_') + '-' + r.von + '_bis_' + r.bis + '.csv', csv(rows), 'text/csv;charset=utf-8');
  };
  M.exportHistorie = function () {
    var I = M.idx();
    var rows = [['Gerät', 'Gerätetyp', 'Standort', 'Projekt', 'Auftrag', 'Von', 'Bis', 'Tage', 'Amortisation Art', 'Amortisation Betrag CHF', 'Amortisation total CHF', 'Gesetzt von', 'Geholt von', 'Ost LV95', 'Nord LV95']];
    M.state.data.einsaetze.slice().sort(function (a, b) { return a.von < b.von ? -1 : 1; }).forEach(function (e) {
      var g = I.ger[e.geraetId], p = e.projektId ? I.proj[e.projektId] : null;
      if (!g) return;
      var lv = M.has(e.lat) ? M.toLv95(e.lat, e.lng) : null;
      rows.push([g.name, M.typLabel[g.typ], M.ortText(e), p ? M.projName(p) : '', M.auftragOf(e), M.fmtDate(e.von), e.bis ? M.fmtDate(e.bis) : 'laufend',
        Math.max(0, M.days(e.von, e.bis || M.today())), e.ort === 'magazin' ? '' : (M.posRate(e) ? M.posLabel(M.posRate(e).P) : e.amortModus === 'monat' ? 'pro Monat' : 'pauschal'), e.ort === 'magazin' ? '' : (M.posRate(e) ? Math.round(M.posRate(e).rate * 100) / 100 : M.num(e.amortBetrag) || 0), M.einsatzAmort(e), e.gesetztVon || '', e.geholtVon || '', lv ? Math.round(lv.e) : '', lv ? Math.round(lv.n) : '']);
    });
    download('MonInv-Historie-' + stamp() + '.csv', csv(rows), 'text/csv;charset=utf-8');
  };
  M.exportKabel = function () {
    var I = M.idx();
    var rows = [['Bezeichnung', 'Art', 'Länge m (Karte)', 'Reserve m', 'Länge total m', 'Führt zu', 'Von', 'Projekt', 'Verlegt', 'Punkte (LV95 Ost/Nord)', 'Bemerkung']];
    M.state.data.kabel.forEach(function (k) {
      var len = M.lineLen(k.punkte);
      rows.push([k.name, (M.kabelTypen[k.typ] || M.kabelTypen.andere).name, Math.round(len), k.reserve || '', Math.round(len + (+k.reserve || 0)),
        k.zuId && I.ger[k.zuId] ? I.ger[k.zuId].name : '', k.vonId && I.ger[k.vonId] ? I.ger[k.vonId].name : '',
        k.projektId && I.proj[k.projektId] ? M.projName(I.proj[k.projektId]) : '', M.fmtDate(k.datum),
        (k.punkte || []).map(function (p) { var c = M.toLv95(p[0], p[1]); return Math.round(c.e) + '/' + Math.round(c.n); }).join(' '), k.bemerkung || '']);
    });
    download('MonInv-Kabel-' + stamp() + '.csv', csv(rows), 'text/csv;charset=utf-8');
  };
  M.exportJson = function () {
    var out = { app: 'MonInv', appVersion: M.VERSION, version: 2, exportiert: new Date().toISOString() };
    window.MonStore.COLLECTIONS.forEach(function (c) { out[c] = M.state.data[c]; });
    download('MonInv-Sicherung-' + stamp() + '.json', JSON.stringify(out, null, 1), 'application/json');
  };
  M.importJson = function (file) {
    var r = new FileReader();
    r.onload = function () {
      var data;
      try { data = JSON.parse(r.result); } catch (e) { M.toast('Die Datei ist keine gültige MonInv-Sicherung.', 'err'); return; }
      if (!data || !Array.isArray(data.geraete)) { M.toast('Die Datei ist keine gültige MonInv-Sicherung.', 'err'); return; }
      var n = data.geraete.length;
      M.confirm('Sicherung importieren?', n + ' Geräte, ' + (data.einsaetze || []).length + ' Einsätze, ' + (data.kabel || []).length + ' Kabel und ' + (data.projekte || []).length + ' Projekte/Magazine werden übernommen. ' +
        (M.store.mode === 'lokal' ? 'Die Daten in diesem Browser werden dabei ersetzt.' : 'Datensätze mit gleicher ID werden überschrieben.'), 'Importieren', function () {
        var clean = window.MonStore.emptyData();
        window.MonStore.COLLECTIONS.forEach(function (c) { clean[c] = Array.isArray(data[c]) ? data[c] : []; });
        M.normalize(clean);
        M.toast('Import läuft …');
        return M.store.replaceAll(clean, function (d, t) { if (d % 25 === 0) M.toast(d + ' / ' + t + ' gespeichert'); })
          .then(function () { return M.reload(); })
          .then(function () { M.toast('Import abgeschlossen'); })
          .catch(M.failed);
      });
    };
    r.readAsText(file);
  };
  M.clearSample = function () {
    M.confirm('Alle Daten löschen?', 'Geräte, Einsätze, Wartungen, Kabel und Projekte werden gelöscht. Kategorien, Symbole und die beiden Magazine bleiben. Die Magazin-Orte danach unter Projekte › Magazine prüfen.', 'Alles löschen', function () {
      var d = M.state.data, jobs = [];
      ['einsaetze', 'wartungen', 'kabel', 'geraete'].forEach(function (c) { d[c].slice().forEach(function (r) { jobs.push(M.del(c, r.id)); }); });
      d.projekte.slice().forEach(function (p) { if (p.typ !== 'magazin') jobs.push(M.del('projekte', p.id)); });
      var s = M.copy(M.settings()); s.beispiel = false;
      jobs.push(M.put('einstellungen', s));
      M.state.sel = null; M.state.drawer = null; M.state.selKabel = null;
      return Promise.all(jobs).then(function () { M.toast('Daten gelöscht – bereit für den echten Bestand'); });
    }, true);
  };

  /* ---------- Suche im Kopf */
  function renderSearch(q) {
    var box = $('search-res');
    q = q.trim().toLowerCase();
    if (!q) { box.hidden = true; box.innerHTML = ''; return; }
    var hits = M.state.data.geraete.filter(function (g) {
      var i = M.info(g.id);
      return [g.name, g.seriennummer, g.sim, g.hersteller, i.kat && i.kat.name, i.ortText, M.projName(i.proj)].join(' ').toLowerCase().indexOf(q) >= 0;
    }).slice(0, 8);
    box.hidden = false;
    box.innerHTML = hits.length ? hits.map(function (g) {
      var i = M.info(g.id);
      return '<button type="button" class="row-btn" data-act="search-pick" data-id="' + g.id + '">' + M.symbol(g.id, 24) + '<span class="rb-t"><b>' + esc(g.name) + '</b><span>' +
        esc((i.kat ? i.kat.name : M.typLabel[g.typ]) + ' · ' + (i.mccTs ? 'bei ' + i.mccTs.name : i.ortText)) + '</span></span></button>';
    }).join('') : '<p class="muted small sr-empty">Kein Gerät gefunden.</p>';
  }

  /* ---------- Ereignisse */
  function selectedIds() { var s = M.state.invSel; return Object.keys(s).filter(function (k) { return s[k] && M.idx().ger[k]; }); }
  M.selectedIds = selectedIds;

  var ACT = {
    'go': function (d) {
      M.go(d.view);
      if (d.anchor) setTimeout(function () { var el = $('sec-' + d.anchor); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 50);
    },
    'new': function (d) { M.openGeraet(null, d.typ || 'sensor'); },
    'sel': function (d) { M.open(d.id); },
    'open': function (d) { M.open(d.id); },
    'desel': function () { if (M.state.stack) { M.state.stack = null; M.renderPanel(); document.body.classList.remove('sheet-open'); return; } if (M.state.selKabel) { M.state.selKabel = null; M.renderPanel(); M.mapRedrawKabel(); document.body.classList.remove('sheet-open'); } else M.select(null); },
    'edit': function (d) { var g = M.idx().ger[d.id]; if (g && g.typ === 'messstelle') M.openGruppeEdit(d.id); else M.openGeraet(d.id); },
    'inv-open': function (d, el) { var o = M.state.invOpen || (M.state.invOpen = {}); o[d.id] = el.getAttribute('aria-expanded') !== 'true'; M.renderInventar(); },
    'reload-app': function () { location.reload(); },
    'file-open': function (d) { M.openViewer(d.id); },
    'file-del': function (d) {
      var f = M.state.data.dateien.find(function (x) { return x.id === d.id; });
      if (!f) return;
      M.confirm('Datei löschen', '«' + M.esc(f.name) + '» endgültig löschen?', 'Löschen', function () { return M.deleteFile(d.id).then(function () { M.toast('Datei gelöscht'); }); }, true);
    },
    'dw-files': function (d) { M.openDrawer(d.id, 'dateien'); },
    'viewer-close': function () { M.closeViewer(); },
    'viewer-tab': function () { if (M.viewerUrl) window.open(M.viewerUrl, '_blank', 'noopener'); },
    'open-any': function (d) { if (M.state.drawer) M.openDrawer(d.id); else M.open(d.id); },
    'amort-scope': function (d) { M.amortSetScope(d.p, d.k); },
    'abr-q': function (d) {
      var r = M.state.abr, now = M.today().slice(0, 7), y = +now.slice(0, 4), m = +now.slice(5, 7);
      var mk = function (yy, mm) { while (mm < 1) { mm += 12; yy--; } return yy + '-' + (mm < 10 ? '0' : '') + mm; };
      if (d.k === 'm1') { r.von = r.bis = mk(y, m - 1); }
      else if (d.k === 'm3') { r.von = mk(y, m - 3); r.bis = mk(y, m - 1); }
      else if (d.k === 'jahr') { r.von = y + '-01'; r.bis = now; }
      else { var f = M.state.data.einsaetze.filter(function (e) { return e.projektId === r.pid; }).map(function (e) { return e.von; }).sort()[0]; r.von = f ? f.slice(0, 7) : now; r.bis = now; }
      M.renderProjekte();
    },
    'abr-export': function (d) { M.exportAbrechnung(d.id); },
    'abr-view': function (d) { M.state.abrView = d.k; M.renderProjekte(); },
    'pos-new': function (d) { M.openPosition(null, d.id); },
    'pos-edit': function (d) { M.openPosition(d.id); },
    'pos-del': function (d) {
      var P = M.idx().pos[d.id]; if (!P) return;
      var n = M.state.data.einsaetze.filter(function (e) { return e.positionId === d.id; }).length;
      M.closeModal();
      M.confirm('Position ' + (P.nr || '') + ' löschen?', (n ? n + ' Einsätze verweisen darauf. Sie bleiben in der Historie, rechnen danach aber ohne Position (Einzelansatz CHF 0). ' : '') + 'Das lässt sich nicht rückgängig machen.', 'Löschen', function () {
        return M.deletePosition(d.id).then(function () { M.toast('Position gelöscht'); M.refreshUI(); });
      }, true);
    },
    'po-grp': function (d) {
      $('po-gruppe').value = d.k;
      document.querySelectorAll('[data-act=po-grp]').forEach(function (b) { var on = b.getAttribute('data-k') === d.k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    },
    'po-art': function (d) {
      $('po-art').value = d.k;
      document.querySelectorAll('[data-act=po-art]').forEach(function (b) { var on = b.getAttribute('data-k') === d.k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      var sb = $('po-setbox'); if (sb) sb.hidden = d.k !== 'set';
      $('po-preislbl').textContent = 'Preis pro ' + (d.k === 'set' ? 'Set' : 'Gerät') + ' und Monat (Offerte)';
      M.posRicht();
    },
    'plan-mode': function (d) { M.planSetMode(d.p, d.k); },
    'bulk-plan': function () { M.openLaufzeit(selectedIds()); },
    'laufzeit': function (d) { M.openLaufzeit([d.id]); },
    'bulk-auftrag': function () { M.openAuftrag(selectedIds()); },
    'bulk-ms': function () { M.openMsNew(selectedIds()); },
    'ms-new': function (d) { M.openMsNew(String(d.ids || '').split(',').filter(Boolean)); },
    'ms-add': function (d) { M.openMsAdd(d.id); },
    'ms-remove': function (d) {
      var g = M.idx().ger[d.id];
      M.removeFromGruppe([d.id]).then(function () { M.toast(g.name + ' aus der Messstelle gelöst – erscheint jetzt einzeln'); M.refreshUI(); });
    },
    'ms-dissolve': function (d) {
      var g = M.idx().ger[d.id], n = (M.idx().members[d.id] || []).length;
      M.confirm('Messstelle auflösen', 'Messstelle «' + M.esc(g.name) + '» auflösen? Die ' + n + ' Geräte bleiben, wo sie sind, und erscheinen wieder einzeln. Die Historie der Messstelle wird gelöscht, die der Geräte bleibt.', 'Auflösen', function () {
        return M.deleteGeraetData(d.id).then(function () { M.toast('Messstelle aufgelöst'); });
      }, true);
    },
    'move': function (d) { M.openMove([d.id]); },
    'dup': function (d) { M.openDup(d.id); },
    'wartung': function (d) { M.openWartung(d.id); },
    'edit-wartung': function (d) { M.openWartung(null, d.id); },
    'edit-einsatz': function (d) { M.openEinsatz(d.id); },
    'place': function (d) { M.startPlacing('geraet', d.id); },
    'place-cancel': function () {
      var q = M.state.placing && M.state.placing.job && M.state.placing.job.queue ? M.state.placing.job : null;
      M.state.placing = null; M.renderPlacing();
      if (q && q.done) M.toast(q.done + (q.done === 1 ? ' Position' : ' Positionen') + ' gespeichert');
    },
    'place-skip': function () {
      var pl = M.state.placing, q = pl && pl.job && pl.job.queue ? pl.job : null;
      if (!q) return;
      if (q.i + 1 < q.ids.length) { q.i++; M.startPlacing('geraet', q.ids[q.i], q); }
      else ACT['place-cancel']();
    },
    'bulk-pos': function () { M.openBulkPos(selectedIds()); },
    'gps': function () {
      if (!navigator.geolocation) { M.toast('Dieses Gerät liefert keinen Standort.', 'err'); return; }
      M.toast('Standort wird ermittelt …');
      navigator.geolocation.getCurrentPosition(function (p) {
        M.toast('GPS-Genauigkeit ± ' + Math.round(p.coords.accuracy) + ' m');
        M.placeAt(p.coords.latitude, p.coords.longitude);
      }, function () { M.toast('Standort nicht verfügbar. Bitte in die Karte tippen oder LV95 eingeben.', 'err'); }, { enableHighAccuracy: true, timeout: 15000 });
    },
    'map-goto': function (d) { M.mapFocusPoint(+d.lat, +d.lng, 18); var r = $('pl-res'); if (r) r.innerHTML = ''; },
    'show-map': function (d) { M.state.drawer = null; M.go('karte'); M.select(d.id); setTimeout(function () { M.mapFocus(d.id); }, 120); },
    'toggle-grp': function (d) { var f = M.state.filters.map; f.off[d.k] = !f.off[d.k]; M.renderMapSide(); M.renderMapTools(); M.mapUpdate(); },
    'toggle-kabel': function () { var f = M.state.filters.map; f.kabel = !f.kabel; M.renderMapSide(); M.mapRedrawKabel(); },
    'layer': function (d) { M.mapLayer(d.k); },
    'fit': function () { M.mapFitAll(); },
    'side-open': function () { document.body.classList.toggle('side-open'); },
    'side-close': function () { document.body.classList.remove('side-open'); },
    'logout': function () { M.confirm('Abmelden', 'Von MonInv und Microsoft 365 abmelden?', 'Abmelden', function () { M.store.logout(); }); },
    'drawer-close': function () { M.state.drawer = null; M.renderDrawer(); },
    'details': function (d) { M.openDrawer(d.id); },
    'dw-tab': function (d) { M.state.drawerTab = d.k; M.renderDrawer('tab'); var t = document.querySelector('.dw-tabs .on'); if (t) t.focus(); },
    'modal-close': function () { M.closeModal(); },
    'modal-bg': function (d, el, e) { if (e.target === el) M.closeModal(); },
    'search-pick': function (d) { $('q').value = ''; renderSearch(''); M.state.drawer = null; if (M.state.view !== 'karte') M.go('karte'); M.select(d.id); setTimeout(function () { M.mapFocus(d.id); }, 100); },
    'bulk-move': function () { M.openMove(selectedIds()); },
    'bulk-mag': function () { M.openMove(selectedIds(), true); },
    'bulk-zst': function () { M.openZustand(selectedIds()); },
    'bulk-del': function () {
      var ids = selectedIds();
      M.confirm(ids.length + ' Geräte löschen?', 'Die Geräte und ihre ganze Historie werden gelöscht. Verbundene Kabel bleiben, verlieren aber die Verbindung. Für Geräte, die nur nicht mehr gebraucht werden, besser «Zustand ändern › ausgemustert».', 'Endgültig löschen', function () {
        return Promise.all(ids.map(function (id) { return M.deleteGeraetData(id); })).then(function () { M.state.invSel = {}; M.toast(ids.length + ' Geräte gelöscht'); });
      }, true);
    },
    'bulk-clear': function () { M.state.invSel = {}; M.renderInventar(); },
    'csv-vorlage': function () { M.csvVorlage(); },
    'export-csv': function () { M.exportGeraete(M.state.view === 'inventar' ? M.invRows() : null); },
    'export-hist': function () { M.exportHistorie(); },
    'export-kabel': function () { M.exportKabel(); },
    'export-json': function () { M.exportJson(); },
    'clear-sample': function () { M.clearSample(); },
    'reset-sample': function () {
      M.confirm('Beispieldaten neu laden?', 'Alle Daten in diesem Browser werden durch die Beispieldaten ersetzt.', 'Neu laden', function () {
        return M.store.replaceAll(window.MonInvBeispiel()).then(M.reload);
      }, true);
    },
    'refresh': function () { M.reload().then(function () { M.toast('Aktualisiert'); }); },
    'new-kat': function () { M.openKategorie(null); },
    'edit-kat': function (d) { M.openKategorie(d.id); },
    'new-proj': function () { M.openProjekt(null); },
    'edit-proj': function (d) { M.openProjekt(d.id); },
    'proj-sel': function (d) {
      M.state.projSel = d.id; M.state.projMob = 'detail'; M.renderProjekte();
      if (M.isMobile()) { var pg = document.querySelector('#v-projekte .page'); if (pg) pg.scrollTop = 0; }
    },
    'proj-back': function () { M.state.projMob = null; M.renderProjekte(); var pg = document.querySelector('#v-projekte .page'); if (pg) pg.scrollTop = 0; },
    'inv-filt': function () { M.state.invFiltOpen = !M.state.invFiltOpen; M.renderInventar(); },
    'projf': function (d) { M.state.filters.proj.status = d.k; M.state.projSel = null; M.renderProjekte(); },
    'proj-map': function (d) {
      var p = M.idx().proj[d.id];
      M.go('karte');
      if (p.typ === 'projekt') { M.state.filters.map.projekt = p.id; M.renderMapSide(); M.mapUpdate(); setTimeout(M.mapFitAll, 120); }
      else if (M.has(p.lat)) setTimeout(function () { M.mapFocusPoint(p.lat, p.lng, 16); }, 100);
      else M.startPlacing('projekt', p.id);
    },
    'dup-step': function (d) { var el = $('dup-n'); el.value = Math.max(1, Math.min(50, (parseInt(el.value, 10) || 1) + (+d.d))); M.dupPreview(); },
    'g-typ': function (d) { var dr = M.readGeraetDraft(); dr.typ = d.k; dr.kategorieId = ''; M.openGeraet(null, d.k, dr); },
    'g-newkat': function () { var dr = M.readGeraetDraft(); M.openKategorie(null, { gid: M.ctx.gid, d: dr }); },
    'g-del': function () { var id = M.ctx.gid; M.closeModal(); M.deleteGeraet(id); },
    'g-del-direct': function (d) { M.deleteGeraet(d.id); },
    'mcc-pick': function (d) { M.openMccPick(d.id); },
    'place-new': function () { M.openPlace(); },
    'amort-mode': function (d) { M.amortSetMode(d.p, d.k); },
    'mcc-free': function (d) {
      var ii = M.info(d.id);
      if (ii.cur && !ii.isMag) { M.toast('Der Tachymeter steht im Feld und braucht eine MCC. Zuerst eine andere MCC wählen oder ins Magazin verschieben.'); return; }
      M.setMcc(d.id, null).then(function () { M.toast('MCC gelöst'); M.refreshUI(); }); },
    'pw-toggle': function (d, el) { var i = $(d['for']); if (!i) return; var show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.textContent = show ? 'Verbergen' : 'Zeigen'; },
    'pw-show': function (d, el) {
      var v = el.parentNode.querySelector('.pw-v'); if (!v) return;
      var shown = v.getAttribute('data-shown') === '1';
      v.textContent = shown ? '••••••••' : v.getAttribute('data-pw');
      v.setAttribute('data-shown', shown ? '0' : '1');
      el.textContent = shown ? 'Zeigen' : 'Verbergen';
    },
    'pw-copy': function (d) {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(d.pw).then(function () { M.toast('WLAN-Passwort kopiert'); }, function () { M.toast('Kopieren nicht möglich – «Zeigen» und abschreiben.', 'err'); });
      else M.toast('Kopieren nicht möglich – «Zeigen» und abschreiben.', 'err');
    },
    'loc-ort': function (d) { M.locSetOrt(d.p, d.k); },
    'loc-gps': function (d) { M.locGps(d.p); },
    'loc-search': function (d) { M.locSearch(d.p); },
    'loc-pick': function (d) { M.locFill(d.p, +d.lat, +d.lng, d.label); if (M.ctx && M.ctx.kind === 'move') M.movePreview(); },
    'kabel-new': function () { M.startDrawing({}); },
    'kabel-from': function (d) { M.startDrawing({ fromId: d.id }); },
    'kabel-sel': function (d) { M.selectKabel(d.id); setTimeout(function () { M.mapFocusKabel(d.id); }, 100); },
    'kabel-edit': function (d) { M.openKabel(d.id); },
    'kabel-redraw': function (d) { M.closeModal(); M.startDrawing({ kabelId: d.id }); },
    'kabel-focus': function (d) { M.mapFocusKabel(d.id); },
    'kabel-del': function (d) {
      var k = M.idx().kab[d.id];
      M.closeModal();
      M.confirm('Kabel löschen?', '«' + esc(k.name || 'Kabel') + '» wird von der Karte entfernt.', 'Löschen', function () {
        if (M.state.selKabel === k.id) M.state.selKabel = null;
        return M.del('kabel', k.id).then(function () { M.toast('Kabel gelöscht'); });
      }, true);
    },
    'draw-undo': function () { var dr = M.state.drawing; if (!dr) return; dr.pts.pop(); M.drawRender(); M.renderPlacing(); },
    'draw-cancel': function () { M.state.drawing = null; M.renderPlacing(); M.mapUpdate(); },
    'draw-done': function () { M.finishDrawing(); },
    'w-del': function () {
      var wid = M.ctx.wid;
      M.closeModal();
      M.confirm('Wartung löschen?', 'Der Eintrag wird aus der Historie entfernt und der Wartungszähler neu berechnet.', 'Löschen', function () { return M.del('wartungen', wid); }, true);
    },
    'e-del': function () {
      var eid = M.ctx.eid;
      M.closeModal();
      M.confirm('Einsatz löschen?', 'Der Einsatz verschwindet aus der Historie des Geräts und des Projekts. Die gebuchte Amortisation entfällt.', 'Löschen', function () { return M.del('einsaetze', eid); }, true);
    },
    'k-grp': function (d) { M.katAction('k-grp', d); },
    'k-pik': function (d) { M.katAction('k-pik', d); },
    'k-fadd': function (d) { M.katAction('k-fadd', d); },
    'k-fdel': function (d) { M.katAction('k-fdel', d); },
    'k-del': function () {
      var kid = M.ctx.kid;
      M.closeModal();
      M.confirm('Kategorie löschen?', 'Die Kategorie wird nicht mehr angeboten.', 'Löschen', function () { return M.del('kategorien', kid); }, true);
    },
    'p-del': function () {
      var pid = M.ctx.pid, p = M.idx().proj[pid];
      M.closeModal();
      if (p.typ === 'magazin') {
        var drin = M.state.data.einsaetze.filter(function (e) { return e.magazinId === pid && !e.bis; }).length;
        if (drin) { M.toast('Im Magazin liegen noch ' + drin + ' Geräte. Bitte zuerst verschieben.', 'err'); return; }
      }
      var refs = M.state.data.einsaetze.filter(function (e) { return e.projektId === pid || e.magazinId === pid; });
      M.confirm(M.projName(p) + ' löschen?', refs.length ? refs.length + ' Einsätze verweisen darauf. Sie bleiben in der Historie der Geräte, aber ohne ' + (p.typ === 'magazin' ? 'Magazin' : 'Projekt') + '. Eine Alternative ist der Status «abgeschlossen».' : 'Es gibt keine Einsätze dazu.', 'Löschen', function () {
        var jobs = refs.map(function (e) { var c = M.copy(e); if (c.projektId === pid) { c.projektId = null; } if (c.magazinId === pid) { c.magazinId = null; } return M.put('einsaetze', c); });
        M.state.data.kabel.forEach(function (k) { if (k.projektId === pid) { var c = M.copy(k); c.projektId = null; jobs.push(M.put('kabel', c)); } });
        (M.idx().dat[pid] || []).forEach(function (f) { jobs.push(M.deleteFile(f.id)); });
        (M.idx().posByProj[pid] || []).forEach(function (P) { jobs.push(M.del('positionen', P.id)); });
        jobs.push(M.del('projekte', pid));
        M.state.projSel = null;
        if (M.state.filters.map.projekt === pid) M.state.filters.map.projekt = '';
        return Promise.all(jobs).then(function () { M.toast('Gelöscht'); });
      }, true);
    }
  };

  var CHANGE = {
    'po-dev': function () { M.posRicht(); },
    'plan-in': function (d) { M.planInfoUpdate(d.p); },
    'loc-proj': function (d, el) {
      var p = d.p, bx = $(p + '-posbox'); if (!bx) return;
      bx.innerHTML = M.posBoxHtml(p, el.value, {}, (M.ctx && M.ctx.n) || 1); M.posSync(p);
      if (M.ctx && M.ctx.kind === 'move') M.movePreview();
    },
    'loc-pos': function (d, el) {
      var p = d.p, bx = $(p + '-posbox'); if (!bx) return;
      bx.innerHTML = M.posBoxHtml(p, $(p + '-proj').value, { positionId: el.value }, (M.ctx && M.ctx.n) || 1); M.posSync(p);
      var s = $(p + '-pos'); if (s) s.focus();
      if (M.ctx && M.ctx.kind === 'move') M.movePreview();
    },
    'abr': function (d, el) {
      var r = M.state.abr; if (!r || !el.value) return;
      r[d.k] = el.value;
      if (r.von > r.bis) { if (d.k === 'von') r.bis = r.von; else r.von = r.bis; }
      M.renderProjekte();
    },
    'file-up': function (d, el) { M.doUpload(d.ziel, d.id, el.files); el.value = ''; },
    'file-art': function (d, el) {
      var f = M.copy(M.state.data.dateien.find(function (x) { return x.id === d.id; }));
      f.art = el.value; M.put('dateien', f).then(function () { M.refreshUI(); });
    },
    'ms-mode': function () { M.msMode(); },
    'pg-dev': function (d, el) {
      var keep = { proj: $('pg-proj').value, date: $('pg-date').value, wer: $('pg-wer').value };
      M.openPlace(el.value);
      if (keep.proj) $('pg-proj').value = keep.proj; $('pg-date').value = keep.date; $('pg-wer').value = keep.wer;
    },
    'mapf': function (d, el) {
      var f = M.state.filters.map;
      f[d.k] = el.type === 'checkbox' ? el.checked : el.value;
      M.renderMapTools();
      M.mapUpdate();
      if (d.k === 'projekt' && el.value) setTimeout(M.mapFitAll, 50);
    },
    'invf': function (d, el) { M.state.filters.inv[d.k] = el.value; M.renderInventar(); },
    'inv-sel': function (d, el) { M.state.invSel[d.id] = el.checked; M.renderInventar(); },
    'inv-all': function (d, el) { (M.state.invVisible || []).forEach(function (id) { M.state.invSel[id] = el.checked; }); M.renderInventar(); },
    'mcc': function (d, el) {
      var ii = M.info(d.id);
      if (!el.value && ii.cur && !ii.isMag) { el.value = M.idx().ger[d.id].mccId || ''; M.toast('Ein Tachymeter im Feld braucht eine MCC TSC.'); return; }
      M.setMcc(d.id, el.value).then(function () { M.toast('MCC-Zuordnung gespeichert'); M.refreshUI(); }); },
    'set-kuerzel': function (d, el) { var s = M.copy(M.settings()); s.kuerzel = el.value.trim(); M.put('einstellungen', s).then(function () { M.toast('Kürzel gespeichert'); }); },
    'import-csv': function (d, el) { if (el.files && el.files[0]) M.importCsv(el.files[0]); el.value = ''; },
    'import-json': function (d, el) { if (el.files && el.files[0]) M.importJson(el.files[0]); el.value = ''; },
    'g-kat': function () { var dr = M.readGeraetDraft(); M.openGeraet(M.ctx.gid, dr.typ, dr); },
    'g-simk': function () { var on = $('g-sim-yes').checked; $('g-sim').disabled = !on; if (on) $('g-sim').focus(); },
    'mv-preview': function (d, el) { if (el && el.id === 'mv-proj') CHANGE['loc-proj']({ p: 'mv' }, el); else M.movePreview(); M.planInfoUpdate('mv'); }
  };

  M.ACT = ACT; M.CHANGE = CHANGE;   // Erweiterungen (z.B. labels.js) melden hier eigene Aktionen an
  var INPUT = {
    'plan-in': function (d) { M.planInfoUpdate(d.p); },
    'msa-q': function (d, el) {
      var q = el.value.trim().toLowerCase();
      document.querySelectorAll('.msa-row').forEach(function (r) { r.hidden = q && r.getAttribute('data-name').indexOf(q) < 0 && !r.querySelector('input').checked; });
    },
    'invf': debounce(function (d, el) {
      M.state.filters.inv[d.k] = el.value;
      var pos = el.selectionStart;
      M.renderInventar();
      var n = $('inv-q'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* */ } }
    }, 180),
    'projf': debounce(function (d, el) {
      M.state.filters.proj[d.k] = el.value;
      M.renderProjekte();
      var n = $('proj-q'); if (n) { n.focus(); var l = n.value.length; try { n.setSelectionRange(l, l); } catch (e) { /* */ } }
    }, 180),
    'dup-n': function () { M.dupPreview(); },
    'k-sync': function () { M.katSync(); }
  };

  function debounce(fn, ms) {
    var t = null;
    return function (a, b) { clearTimeout(t); t = setTimeout(function () { fn(a, b); }, ms); };
  }

  function bind() {
    document.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-view]');
      if (nav && !nav.getAttribute('data-act')) { e.preventDefault(); M.state.drawer = null; M.go(nav.getAttribute('data-view')); return; }
      var el = e.target.closest('[data-act]');
      if (!el) {
        if (!e.target.closest('.search')) renderSearch('');
        return;
      }
      var fn = ACT[el.getAttribute('data-act')];
      if (fn) fn(el.dataset, el, e);
    });
    document.addEventListener('change', function (e) {
      var el = e.target.closest('[data-change]');
      if (!el) return;
      var fn = CHANGE[el.getAttribute('data-change')];
      if (fn) fn(el.dataset, el);
    });
    document.addEventListener('input', function (e) {
      var el = e.target.closest('[data-input]');
      if (!el) return;
      var fn = INPUT[el.getAttribute('data-input')];
      if (fn) fn(el.dataset, el);
    });
    document.addEventListener('submit', function (e) {
      var f = e.target.closest('form[data-form]');
      if (!f) return;
      e.preventDefault();
      M.onSubmit(f, e.submitter);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.getAttribute && e.target.getAttribute('data-enter')) {
        e.preventDefault();
        var fn = ACT[e.target.getAttribute('data-enter')];
        if (fn) fn(e.target.dataset, e.target, e);
        return;
      }
      if (e.key !== 'Escape') return;
      if ($('viewer')) M.closeViewer();
      else if (M.modalOpen()) M.closeModal();
      else if (M.state.drawing) { M.state.drawing = null; M.renderPlacing(); M.mapUpdate(); }
      else if (M.state.placing) { M.state.placing = null; M.renderPlacing(); }
      else if (M.state.drawer) { M.state.drawer = null; M.renderDrawer(); }
      else if ((M.state.sel || M.state.selKabel) && M.state.view === 'karte') ACT.desel();
    });
    document.addEventListener('toggle', function (e) { if (e.target.getAttribute && e.target.getAttribute('data-toggle') === 'abr-open') M.state.abrOpen = e.target.open; }, true);
    // Dateien in eine Ablagefläche ziehen
    var dzOf = function (e) { return e.target.closest && e.target.closest('.dz'); };
    document.addEventListener('dragover', function (e) {
      var dz = dzOf(e);
      if (dz || (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0)) e.preventDefault();
      document.querySelectorAll('.dz.over').forEach(function (x) { if (x !== dz) x.classList.remove('over'); });
      if (dz) dz.classList.add('over');
    });
    document.addEventListener('dragleave', function (e) { var dz = dzOf(e); if (dz && !dz.contains(e.relatedTarget)) dz.classList.remove('over'); });
    document.addEventListener('drop', function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault();
      var dz = dzOf(e);
      document.querySelectorAll('.dz.over').forEach(function (x) { x.classList.remove('over'); });
      if (dz) M.doUpload(dz.getAttribute('data-ziel'), dz.getAttribute('data-id'), e.dataTransfer.files);
    });
    document.addEventListener('mousemove', function (e) {
      var svg = e.target.closest && e.target.closest('.am-chart');
      if (svg) M.amortHover(svg, e);
      else { var h = document.querySelector('.am-hover'); if (h && h.style.display !== 'none') { h.style.display = 'none'; var t = document.querySelector('.am-tip'); if (t) t.hidden = true; } }
    });
    $('q').addEventListener('input', function () { renderSearch(this.value); });
    $('q').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var b = document.querySelector('#search-res [data-act]'); if (b) b.click(); }
    });
    window.addEventListener('hashchange', function () { var v = location.hash.slice(1); if (v && v.indexOf('g=') !== 0 && v !== M.state.view) M.go(v, false); });
    window.addEventListener('resize', function () { M.mapInvalidate(); });
  }

  /* ---------- Laden */
  M.reload = function () {
    return M.store.load().then(function (data) {
      M.setData(data);
      M.refreshUI();
    });
  };

  function boot() {
    var cfg = window.MONINV_CONFIG || { modus: 'lokal' };
    M.store = window.MonStore.create(cfg);
    bind();
    $('src').textContent = M.store.mode === 'lokal' ? 'Lokal' : 'SharePoint';
    var ver = $('ver'); if (ver) ver.textContent = 'v' + M.VERSION;
    document.title = 'MonInv ' + M.VERSION + ' · Monitoring-Inventar';
    M.store.init().then(function () { return M.store.load(); }).then(function (data) {
      M.setData(data);
      $('loading').hidden = true;
      var v = location.hash.slice(1);
      M.go(VIEWS.indexOf(v) >= 0 ? v : 'karte', false);
      if (M.pendingOpen) setTimeout(M.pendingOpen, 80);   // Link aus einem QR-Etikett
      setTimeout(M.fillMissingOrt, 1500);
      // Neue Version aufgeschaltet? (version.txt liegt neben index.html)
      var checkVer = function () {
        if (location.protocol === 'file:') return;
        fetch('version.txt?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : null; }).then(function (v) {
          v = (v || '').trim();
          if (!v || v === M.VERSION || $('ver-banner')) return;
          var b = document.createElement('div'); b.id = 'ver-banner'; b.className = 'ver-banner';
          b.innerHTML = '<span>Neue Version <b>' + M.esc(v) + '</b> ist aufgeschaltet (hier läuft ' + M.esc(M.VERSION) + ').</span><button type="button" class="btn sm" data-act="reload-app">Jetzt neu laden</button>';
          document.body.appendChild(b);
        }).catch(function () { /* offline: später wieder */ });
      };
      setTimeout(checkVer, 3000); setInterval(checkVer, 10 * 60 * 1000);
      if (M.store.mode === 'sharepoint') {
        var sec = (cfg.sharepoint && cfg.sharepoint.aktualisierenSekunden) || 60;
        var poll = function () {
          if (document.hidden || M.modalOpen() || M.state.placing || M.state.drawing) return;
          M.store.refresh().then(function (d) {
            if (!d) return;
            M.normalize(d);
            if (JSON.stringify(d) !== JSON.stringify(M.state.data)) { M.state.data = d; M.bump(); M.refreshUI(); }
          }).catch(function (e) { console.warn(e); });
        };
        setInterval(poll, sec * 1000);
        document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });
      }
    }).catch(function (e) {
      console.error(e);
      $('loading').innerHTML = '<div class="load-err"><h2>MonInv konnte nicht starten</h2><p>' + esc(e && e.message ? e.message : String(e)) + '</p>' +
        '<p class="muted">Prüfe die Angaben in config.js oder stelle <code>modus</code> auf <code>\'lokal\'</code>, um mit Beispieldaten zu testen.</p></div>';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
