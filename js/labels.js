/* MonInv – QR-Etiketten (Avery Zweckform L4773 / L4778) und Scannen
   Etikett: QR-Code links, rechts RISTAG-Logo und Gerätename, unten ein schmaler blauer Streifen.
   Der QR-Code enthält die Adresse der App mit «#g=<Code>». Jedes Gerät bekommt beim ersten Druck
   einen kurzen, festen Code (g.qr), damit der QR-Code klein und gut lesbar bleibt. */
(function () {
  'use strict';
  var M = window.M, esc = M.esc;
  function $(id) { return document.getElementById(id); }

  /* ---------- Skripte erst bei Bedarf laden (funktioniert auch mit file://) */
  var loaded = {};
  M.loadScript = function (src) {
    if (!loaded[src]) loaded[src] = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src + (src.indexOf('?') < 0 ? '?v=' + M.VERSION : ''); s.onload = function () { res(); }; s.onerror = function () { delete loaded[src]; rej(new Error('Konnte ' + src + ' nicht laden')); };
      document.head.appendChild(s);
    });
    return loaded[src];
  };

  /* ---------- Formate (Masse in mm, wie auf dem Board abgestimmt) */
  M.ETIKETT_FORMATE = {
    L4773: { name: 'Avery Zweckform L4773', kurz: 'L4773 · gross', sub: '63,5 × 33,9 mm · 24 pro Bogen', lw: 63.5, lh: 33.9, rx: 2, cols: 3, rows: 8, left: 7.25, top: 12.9, gapX: 2.5, gapY: 0,
      qrX: 2.6, qrY: 2.6, qrS: 25, tx: 29.6, logoY: 2.7, logoW: 30, nameMax: 4.4, textW: 32.2, nameOneY: 21.6, nameTwoY: 19.8, bandY: 31.4 },
    L4778: { name: 'Avery Zweckform L4778', kurz: 'L4778 · klein', sub: '45,7 × 21,2 mm · 48 pro Bogen', lw: 45.7, lh: 21.2, rx: 1.5, cols: 4, rows: 12, left: 9.85, top: 21.3, gapX: 2.5, gapY: 0,
      qrX: 1.5, qrY: 1.6, qrS: 16, tx: 19, logoY: 1.7, logoW: 23, nameMax: 3.4, textW: 25.6, nameOneY: 15.2, nameTwoY: 13.9, bandY: 19.8 }
  };
  var BLAU = [0, 70, 142], NACHT = [0, 21, 42];

  /* ---------- Adresse im QR-Code */
  M.qrBasis = function () {
    var c = (window.MONINV_CONFIG || {}).qrAdresse;
    if (c) return String(c).split('#')[0];
    return location.origin + location.pathname;
  };
  M.qrBasisLokal = function () {
    var c = (window.MONINV_CONFIG || {}).qrAdresse;
    return !c && (location.protocol === 'file:' || /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname));
  };
  var ABC = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';   // ohne 0/O, 1/I/L
  function neuerCode(used) {
    for (var t = 0; t < 1000; t++) {
      var s = '', r = new Uint32Array(6);
      if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(r); else for (var k = 0; k < 6; k++) r[k] = Math.floor(Math.random() * 1e9);
      for (var j = 0; j < 6; j++) s += ABC[r[j] % ABC.length];
      if (!used[s]) return s;
    }
    throw new Error('Kein freier Code');
  }
  /* sorgt dafür, dass alle Geräte einen Code haben (speichert neue Codes) */
  M.ensureQr = function (ids) {
    var used = {}, jobs = [];
    M.state.data.geraete.forEach(function (g) { if (g.qr) used[g.qr] = true; });
    ids.forEach(function (id) {
      var g = M.idx().ger[id];
      if (!g || g.qr) return;
      var c = M.copy(g); c.qr = neuerCode(used); used[c.qr] = true;
      jobs.push(M.put('geraete', c));
    });
    return Promise.all(jobs);
  };
  M.qrUrl = function (g) { return M.qrBasis() + '#g=' + encodeURIComponent(g.qr || g.id); };
  /* Code, ID, Link oder Name → Gerät */
  M.findByCode = function (txt) {
    if (!txt) return null;
    var s = String(txt).trim(), m = s.match(/[#&?]g=([^&#\s]+)/);
    if (m) s = decodeURIComponent(m[1]);
    var up = s.toUpperCase(), ger = M.state.data.geraete;
    return ger.find(function (g) { return g.qr && g.qr.toUpperCase() === up; }) || ger.find(function (g) { return g.id === s; }) ||
      ger.find(function (g) { return (g.name || '').toUpperCase() === up; }) || ger.find(function (g) { return g.seriennummer && String(g.seriennummer).toUpperCase() === up; }) || null;
  };
  /* Gerät anzeigen: Karte mit Panel (im Feld), sonst Gerätefenster */
  M.showDevice = function (gid) {
    var g = M.idx().ger[gid]; if (!g) return;
    var i = M.info(g.id);
    var target = i.mccTs && !i.isMag ? i.mccTs.id : g.id;
    M.state.drawer = null; M.renderDrawer && M.renderDrawer();
    if (i.pos || (i.mccTs && M.info(target).pos)) {
      M.go('karte', false); history.replaceState(null, '', '#karte');
      setTimeout(function () { M.select(target); M.mapFocus(target); if (target !== g.id) M.toast(g.name + ' gehört zu ' + M.idx().ger[target].name); }, 60);
    } else {
      history.replaceState(null, '', '#' + M.state.view);
      M.openDrawer(g.id);
    }
  };
  /* Code (Scan oder Link #g=…) → Schnellaktionen */
  M.openCode = function (txt) {
    var g = M.findByCode(txt);
    if (!g) { M.toast('Unbekannter Code: ' + String(txt).slice(0, 60), 'err'); return false; }
    if (/^#g=/.test(location.hash)) history.replaceState(null, '', '#' + M.state.view);
    M.openScanAktionen(g.id);
    return true;
  };
  var IC = {
    gps: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2.2" class="f"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/></svg>',
    mag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 4l9 6.5V20H3z"/><path d="M7.5 20v-6h9v6M7.5 17h9"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 4.5l4 4L8 20H4v-4z"/><path d="M13 7l4 4"/></svg>'
  };
  M.openScanAktionen = function (gid) {
    var I = M.idx(), g = I.ger[gid]; if (!g) return;
    var i = M.info(gid), ts = i.mccTs && !i.isMag ? i.mccTs : null, base = ts || g, bi = ts ? M.info(ts.id) : i;
    var imFeld = !!(bi.cur && bi.cur.ort === 'feld');
    M.ctx = { kind: 'scanakt', gid: gid, base: base.id };
    var sub = (i.kat ? i.kat.name : M.typLabel[g.typ]) + (g.seriennummer ? ' · SN ' + g.seriennummer : '');
    var wo = esc(bi.ortText || 'ohne Standort') + (bi.proj ? ' · <b>' + esc(M.projName(bi.proj)) + '</b>' : '') + (bi.cur && bi.cur.von ? ' · seit ' + M.fmtDate(bi.cur.von) : '');
    var gpsSub = imFeld ? 'Position übernehmen' + (bi.proj ? ', Projekt bleibt' : '') : 'Projekt und Position wählen';
    var b = '<div class="sa-head">' + M.symbol(gid, 44) + '<div><b>' + esc(g.name) + '</b><span>' + esc(sub) + '</span>' +
      '<span class="sa-wo">' + wo + '</span>' + (ts ? '<span class="sa-ts">Gehört zu ' + esc(ts.name) + ' – Standort und Magazin gelten für beide.</span>' : '') + '</div></div>' +
      (base.typ === 'tachymeter' ? saMcc(base) : '') +
      '<div class="sa-grid">' +
      '<button type="button" class="sa-btn" data-act="sa-gps" id="sa-gps">' + IC.gps + '<b>Hier platzieren</b><span>GPS · ' + gpsSub + '</span></button>' +
      '<button type="button" class="sa-btn" data-act="sa-mag"' + (bi.isMag ? ' disabled' : '') + '>' + IC.mag + '<b>Ins Magazin</b><span>' + (bi.isMag ? 'steht schon im Magazin' : 'zurückbuchen') + '</span></button>' +
      '<button type="button" class="sa-btn" data-act="sa-edit">' + IC.edit + '<b>Bearbeiten</b><span>Gerätedaten ändern</span></button>' +
      '</div><p class="sa-msg" id="sa-msg" aria-live="polite"></p>';
    M.modal({ title: 'Gescannt', form: 'scanakt', body: b, noFocus: true,
      foot: '<button type="button" class="btn ghost" data-act="sa-show">Details anzeigen</button><span class="grow"></span><button type="button" class="btn ghost" data-act="modal-close">Schliessen</button>' });
  };
  /* MCC des Tachymeters: anzeigen und per QR dazusetzen */
  function saMcc(ts) {
    var mcc = ts.mccId && M.idx().ger[ts.mccId], kann = M.can('edit');
    return '<div class="sa-mcc' + (mcc ? '' : ' fehlt') + '">' + (mcc ? M.symbol(mcc.id, 28) : '') + '<span class="sa-mcc-t"><span>MCC TSC</span><b>' + (mcc ? esc(mcc.name) : 'noch keine – im Feld Pflicht') + '</b></span>' +
      (kann ? '<button type="button" class="btn sm' + (mcc ? ' ghost' : '') + '" data-act="sa-mcc">' + (mcc ? 'Andere scannen' : 'MCC scannen') + '</button>' : '') + '</div>';
  }
  function saGps() {
    var c = M.ctx; if (!c || c.kind !== 'scanakt') return;
    var base = c.base, bi = M.info(base), btn = $('sa-gps'), m = $('sa-msg');
    if (!navigator.geolocation) { m.textContent = 'Dieser Browser liefert keine GPS-Position.'; m.className = 'sa-msg err'; return; }
    btn.disabled = true; btn.classList.add('busy'); m.className = 'sa-msg'; m.textContent = 'Standort wird ermittelt …';
    navigator.geolocation.getCurrentPosition(function (pos) {
      if (!M.ctx || M.ctx.kind !== 'scanakt') return;
      var lat = pos.coords.latitude, lng = pos.coords.longitude, acc = Math.round(pos.coords.accuracy || 0);
      if (bi.cur && bi.cur.ort === 'feld') {
        M.closeModal();
        var ohneMcc = M.idx().ger[base].typ === 'tachymeter' && !M.idx().ger[base].mccId;
        Promise.resolve(M.setPos(base, lat, lng)).then(function () {
          if (ohneMcc) setTimeout(function () { M.toast('Noch keine MCC zugeordnet – Tachymeter nochmals scannen und «MCC scannen» wählen', 'err'); }, 900);
          M.refreshUI && M.refreshUI();
          M.go('karte', false); history.replaceState(null, '', '#karte');
          setTimeout(function () { M.select(base); M.mapFocus(base); }, 80);
          M.toast(M.idx().ger[base].name + ': Position gesetzt (GPS ± ' + acc + ' m)' + (acc > 30 ? ' – ungenau, bei Bedarf auf der Karte korrigieren' : ''));
        });
      } else {
        M.openMove([base]);
        if (!$('mv-ort')) return;
        M.locSetOrt('mv', 'feld');
        M.locFill('mv', lat, lng, 'GPS ± ' + acc + ' m');
        M.movePreview && M.movePreview();
        var s = $('mv-proj'); if (s) setTimeout(function () { s.focus(); }, 60);
      }
    }, function (e) {
      btn.disabled = false; btn.classList.remove('busy');
      m.className = 'sa-msg err';
      m.textContent = e && e.code === 1 ? 'Kein Zugriff auf die GPS-Position. In den Einstellungen für den Browser erlauben.' : 'GPS-Position nicht verfügbar. Draussen nochmals versuchen.';
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 });
  }

  /* ---------- Gerätename auf Platz bringen (eine oder zwei Zeilen) */
  function fitName(doc, F, name) {
    function w(t, mm) { doc.setFontSize(mm * 72 / 25.4); return doc.getTextWidth(t); }
    var one = Math.min(F.nameMax, F.textW / Math.max(0.001, w(name, 1)));
    var sp = [];
    for (var i = 0; i < name.length; i++) if (name[i] === ' ') sp.push(i);
    if (one >= F.nameMax * 0.8 || !sp.length) return { lines: [name], fs: one };
    // Umbruch am Leerzeichen, das die Zeilen am ausgeglichensten macht
    var best = null;
    sp.forEach(function (p) {
      var a = name.slice(0, p), b = name.slice(p + 1), m = Math.max(w(a, 1), w(b, 1));
      if (!best || m < best.m) best = { a: a, b: b, m: m };
    });
    var two = Math.min(F.nameMax * 0.92, F.textW / best.m);
    return two > one * 1.12 ? { lines: [best.a, best.b], fs: two } : { lines: [name], fs: one };
  }
  function drawQr(doc, text, x, y, size) {
    var q = window.qrcode(0, 'M');
    q.addData(text, 'Byte'); q.make();
    var n = q.getModuleCount(), m = size / n, eps = 0.012;
    doc.setFillColor(NACHT[0], NACHT[1], NACHT[2]);
    for (var r = 0; r < n; r++) {
      var c = 0;
      while (c < n) {
        if (!q.isDark(r, c)) { c++; continue; }
        var s = c; while (c < n && q.isDark(r, c)) c++;
        doc.rect(x + s * m, y + r * m, (c - s) * m + eps, m + eps, 'F');
      }
    }
    return n;
  }
  function drawLabel(doc, F, x, y, g, opts) {
    // QR
    drawQr(doc, M.qrUrl(g), x + F.qrX, y + F.qrY, F.qrS);
    // Logo
    var L = window.MONINV_ETIKETT_LOGO;
    if (L) doc.addImage(L.png, 'PNG', x + F.tx, y + F.logoY, F.logoW, F.logoW / L.ratio, 'ristag-logo', 'FAST');
    // Name
    doc.setFont('Exo2', 'bold');
    doc.setTextColor(NACHT[0], NACHT[1], NACHT[2]);
    var fit = fitName(doc, F, g.name || '');
    doc.setFontSize(fit.fs * 72 / 25.4);
    if (fit.lines.length === 1) doc.text(fit.lines[0], x + F.tx, y + F.nameOneY);
    else { doc.text(fit.lines[0], x + F.tx, y + F.nameTwoY); doc.text(fit.lines[1], x + F.tx, y + F.nameTwoY + fit.fs * 1.12); }
    // Streifen
    doc.setFillColor(BLAU[0], BLAU[1], BLAU[2]);
    doc.rect(x, y + F.bandY, F.lw, F.lh - F.bandY, 'F');
    if (opts.rahmen) { doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.1); doc.roundedRect(x, y, F.lw, F.lh, F.rx, F.rx, 'S'); }
  }

  /* ---------- PDF erzeugen */
  M.etikettenPdf = function (list, o) {
    var F = M.ETIKETT_FORMATE[o.format] || M.ETIKETT_FORMATE.L4773;
    return Promise.all([
      M.loadScript('vendor/jspdf/jspdf.umd.min.js'), M.loadScript('vendor/qrcode/qrcode.js'),
      M.loadScript('vendor/fonts/exo2-800.js'), M.loadScript('assets/etikett-logo.js')
    ]).then(function () {
      var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
      doc.addFileToVFS('Exo2-ExtraBold.ttf', window.MONINV_FONT_EXO2_800);
      doc.addFont('Exo2-ExtraBold.ttf', 'Exo2', 'bold');
      doc.setProperties({ title: 'MonInv Etiketten ' + o.format, creator: 'MonInv ' + M.VERSION });
      var st = M.settings().etikett || {}, dx = M.num(st.dx) || 0, dy = M.num(st.dy) || 0;
      var per = F.cols * F.rows, slot = Math.max(0, (o.start || 1) - 1), page = 0;
      var items = [];
      list.forEach(function (g) { for (var k = 0; k < (o.kopien || 1); k++) items.push(g); });
      if (o.test) items = [];
      items.forEach(function (g) {
        if (slot >= per) { doc.addPage(); slot = 0; page++; }
        var c = slot % F.cols, r = Math.floor(slot / F.cols);
        drawLabel(doc, F, F.left + dx + c * (F.lw + F.gapX), F.top + dy + r * (F.lh + F.gapY), g, { rahmen: o.rahmen });
        slot++;
      });
      if (o.test) {
        // Testseite: alle Felder als Rahmen mit Nummer, zum Abgleich mit einem Etikettenbogen
        doc.setDrawColor(0, 70, 142); doc.setLineWidth(0.2); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0, 70, 142);
        for (var s = 0; s < per; s++) {
          var cc = s % F.cols, rr = Math.floor(s / F.cols), x = F.left + dx + cc * (F.lw + F.gapX), y = F.top + dy + rr * (F.lh + F.gapY);
          doc.roundedRect(x, y, F.lw, F.lh, F.rx, F.rx, 'S');
          doc.text(String(s + 1), x + F.lw / 2, y + F.lh / 2 + 1.2, { align: 'center' });
        }
        doc.setTextColor(60, 60, 60); doc.setFontSize(8);
        doc.text('MonInv Testseite ' + F.name + ' · Versatz X ' + dx + ' mm, Y ' + dy + ' mm · auf Normalpapier drucken (100 %) und gegen einen Etikettenbogen halten', 105, 6, { align: 'center' });
      }
      return { blob: doc.output('blob'), seiten: page + 1, anzahl: items.length };
    });
  };

  /* ---------- Dialog «Etiketten drucken» */
  function prefs() { try { return JSON.parse(localStorage.getItem('moninv.etikett') || '{}'); } catch (e) { return {}; } }
  function savePrefs(p) { try { localStorage.setItem('moninv.etikett', JSON.stringify(p)); } catch (e) { /* egal */ } }
  M.openEtiketten = function (ids) {
    var I = M.idx(), list = ids.map(function (id) { return I.ger[id]; }).filter(Boolean);
    if (!list.length) { M.toast('Keine Geräte gewählt'); return; }
    var p = prefs(), fmt = M.ETIKETT_FORMATE[p.format] ? p.format : 'L4773';
    var nMem = 0; list.forEach(function (g) { var m = I.members[g.id]; if (m) nMem += m.length; });
    M.ctx = { kind: 'etiketten', ids: list.map(function (g) { return g.id; }), format: fmt, start: 1, mitMitgliedern: false };
    var b = '<div class="et-top"><div class="et-list"><b>' + list.length + (list.length === 1 ? ' Gerät' : ' Geräte') + '</b> ' +
      esc(list.slice(0, 6).map(function (g) { return g.name; }).join(', ') + (list.length > 6 ? ' …' : '')) + '</div>' +
      (nMem ? '<label class="chk"><input type="checkbox" id="et-mem" data-change="et-redraw"> auch für die ' + nMem + ' Geräte in ' + (list.filter(function (g) { return I.members[g.id]; }).length === 1 ? 'der Messstelle' : 'den Messstellen') + '</label>' : '') + '</div>' +
      '<div class="et-grid"><div class="et-opts">' +
      '<div class="fld"><span>Etiketten</span><div class="seg" role="group" aria-label="Etikettenformat">' +
      Object.keys(M.ETIKETT_FORMATE).map(function (k) { return '<button type="button" data-act="et-format" data-k="' + k + '" class="' + (k === fmt ? 'on' : '') + '" aria-pressed="' + (k === fmt) + '">' + esc(M.ETIKETT_FORMATE[k].kurz) + '</button>'; }).join('') + '</div>' +
      '<span class="muted small" id="et-sub"></span></div>' +
      '<label class="fld"><span>Etiketten pro Gerät</span><input id="et-kopien" type="number" min="1" max="10" value="1" data-change="et-redraw" inputmode="numeric"></label>' +
      '<label class="chk"><input type="checkbox" id="et-rahmen"> Umrisse mitdrucken (Probedruck auf Normalpapier)</label>' +
      '<div class="et-info" id="et-info"></div>' +
      (M.qrBasisLokal() ? '<p class="hint warn">Die App läuft hier lokal. Der QR-Code würde auf <code>' + esc(M.qrBasis()) + '</code> zeigen und funktioniert auf dem Handy nicht. Etiketten nach dem Aufschalten drucken oder in <code>config.js</code> die <code>qrAdresse</code> eintragen.</p>' : '') +
      '<p class="muted small">Im Druckdialog <b>Tatsächliche Grösse / 100 %</b> wählen und als Papierart <b>Etiketten</b> einstellen. Sitzt der Druck nicht genau: Einstellungen › QR-Etiketten › Versatz.</p>' +
      '</div><div class="et-sheet-w"><span class="lbl">Erstes freies Feld auf dem Bogen antippen</span><div class="et-sheet" id="et-sheet"></div></div></div>';
    M.modal({ title: 'Etiketten drucken', form: 'etiketten', wide: true, body: b, noFocus: true,
      foot: '<button type="button" class="btn ghost" data-act="et-test">Testseite</button><span class="grow"></span><button type="button" class="btn ghost" data-act="modal-close">Abbrechen</button><button type="submit" class="btn">PDF erstellen</button>' });
    etRedraw();
  };
  function etList() {
    var I = M.idx(), out = [], seen = {};
    var mem = $('et-mem') && $('et-mem').checked;
    M.ctx.ids.forEach(function (id) {
      if (!seen[id]) { seen[id] = 1; out.push(I.ger[id]); }
      if (mem && I.members[id]) I.members[id].forEach(function (m) { if (!seen[m]) { seen[m] = 1; out.push(I.ger[m]); } });
    });
    return out.filter(Boolean);
  }
  function etRedraw() {
    var c = M.ctx; if (!c || c.kind !== 'etiketten') return;
    var F = M.ETIKETT_FORMATE[c.format], per = F.cols * F.rows;
    if (c.start > per) c.start = 1;
    var n = etList().length * Math.max(1, Math.min(10, M.num(($('et-kopien') || {}).value) || 1));
    var sheet = $('et-sheet');
    sheet.style.setProperty('--cols', F.cols);
    sheet.style.aspectRatio = '210 / 297';
    sheet.style.padding = (F.top / 297 * 100).toFixed(2) + '% ' + (F.left / 210 * 100).toFixed(2) + '%';
    sheet.style.columnGap = (F.gapX / 210 * 100).toFixed(2) + '%';
    var h = '';
    for (var s = 1; s <= per; s++) {
      var used = s < c.start, fill = !used && s - c.start < n;
      h += '<button type="button" class="et-cell' + (used ? ' used' : '') + (fill ? ' fill' : '') + (s === c.start ? ' start' : '') + '" data-act="et-start" data-k="' + s + '" aria-label="Feld ' + s + (s === c.start ? ', Start' : '') + '"' + (s === c.start ? ' aria-pressed="true"' : '') + '>' + (s === c.start ? '▶' : fill ? '' : s) + '</button>';
    }
    sheet.innerHTML = h;
    $('et-sub').textContent = F.name + ' · ' + F.sub;
    var restErste = per - c.start + 1, seiten = n <= restErste ? 1 : 1 + Math.ceil((n - restErste) / per);
    $('et-info').innerHTML = '<b>' + n + (n === 1 ? ' Etikett' : ' Etiketten') + '</b> · ' + seiten + (seiten === 1 ? ' Bogen' : ' Bogen') + ' · Start bei Feld ' + c.start +
      (n > restErste ? '<br><span class="muted small">Auf dem ersten Bogen ' + restErste + ', danach volle Bogen.</span>' : '');
  }
  function etShow(r, name, tab) {
    M.closeModal();
    if (M.showPdf) M.showPdf(tab, r.blob, name); else M.openBlob(r.blob, name);
  }
  M.submitEtiketten = function () {
    var c = M.ctx, list = etList(), kopien = Math.max(1, Math.min(10, M.num($('et-kopien').value) || 1)), rahmen = $('et-rahmen').checked;
    savePrefs({ format: c.format });
    var btn = document.querySelector('.md-ft button[type=submit]'); if (btn) { btn.disabled = true; btn.textContent = 'Wird erstellt …'; }
    var tab = M.pdfTab ? M.pdfTab('Etiketten ' + c.format) : null;
    M.ensureQr(list.map(function (g) { return g.id; })).then(function () {
      var I = M.idx();
      return M.etikettenPdf(list.map(function (g) { return I.ger[g.id]; }), { format: c.format, start: c.start, kopien: kopien, rahmen: rahmen });
    }).then(function (r) {
      etShow(r, 'MonInv-Etiketten-' + c.format + '-' + M.today() + '.pdf', tab);
      M.toast(r.anzahl + (r.anzahl === 1 ? ' Etikett' : ' Etiketten') + ' auf ' + r.seiten + (r.seiten === 1 ? ' Bogen' : ' Bogen'));
    }).catch(function (e) { console.error(e); if (tab && !tab.closed) tab.close(); M.toast('PDF konnte nicht erstellt werden: ' + (e.message || e), 'err'); if (btn) { btn.disabled = false; btn.textContent = 'PDF erstellen'; } });
  };

  /* ---------- Betrachter für erzeugte Dateien (PDF) */
  M.openBlob = function (blob, name) {
    M.closeViewer();
    var v = document.createElement('div');
    v.id = 'viewer'; v.className = 'vw';
    var url = M.viewerUrl = URL.createObjectURL(blob);
    v.innerHTML = '<div class="vw-bar"><b class="vw-t">' + esc(name) + '</b><span class="grow"></span><button type="button" class="btn sm ghost-inv" data-act="viewer-tab">In neuem Tab</button>' +
      '<a class="btn sm" href="' + url + '" download="' + esc(name) + '">Herunterladen</a><button type="button" class="md-x vw-x" data-act="viewer-close" aria-label="Schliessen">×</button></div>' +
      '<div class="vw-b"><iframe class="vw-pdf" src="' + url + '#view=FitH" title="' + esc(name) + '"></iframe></div>';
    document.body.appendChild(v);
    document.body.classList.add('viewer-open');
    requestAnimationFrame(function () { v.classList.add('in'); });
  };

  /* ================================================== Scannen */
  var scan = null;   // { stream, timer, mode, list, last }
  function stopScan() {
    if (!scan) return;
    if (scan.cam) scan.cam.stop();
    scan = null;
  }
  /* Kamera starten und laufend nach QR-Codes suchen; liefert { stop } */
  function camStart(v, onText, say) {
    var h = { stopped: false, stream: null, timer: null };
    h.stop = function () { h.stopped = true; clearInterval(h.timer); if (h.stream) h.stream.getTracks().forEach(function (t) { t.stop(); }); };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { say(location.protocol === 'file:' ? 'Die Kamera geht nur, wenn die App über https läuft (nicht als lokale Datei). Code unten eingeben.' : 'Dieser Browser gibt keinen Zugriff auf die Kamera. Code unten eingeben.', true); return h; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }).then(function (stream) {
      if (h.stopped) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      h.stream = stream;
      v.srcObject = stream; v.play().catch(function () {});
      say('QR-Code in den Rahmen halten');
      return detector().then(function (det) {
        if (h.stopped) return;
        var busy = false;
        h.timer = setInterval(function () {
          if (busy || !v.videoWidth) return;
          busy = true;
          det(v).then(function (txt) { busy = false; if (txt && !h.stopped) onText(txt); }).catch(function () { busy = false; });
        }, 220);
      });
    }).catch(function (e) {
      if (h.stopped) return;
      say(e && e.name === 'NotAllowedError' ? 'Kein Zugriff auf die Kamera. In den Browser-Einstellungen erlauben oder den Code unten eingeben.' : 'Kamera nicht verfügbar (' + (e && e.message || e) + '). Code unten eingeben.', true);
    });
    return h;
  }

  /* ---------- Ein Gerät per QR wählen, ohne den offenen Dialog zu schliessen (z.B. MCC zum Tachymeter) */
  var pick = null;   // { cam, o }
  function pickClose() {
    if (!pick) return;
    if (pick.cam) pick.cam.stop();
    var el = $('scanpick'); if (el) el.remove();
    document.removeEventListener('keydown', pickKey, true);
    pick = null;
  }
  function pickKey(e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); pickClose(); } }
  function pickMsg(t, err) { var m = $('sp-msg'); if (m) { m.textContent = t; m.classList.toggle('err', !!err); } }
  function pickCode(txt) {
    if (!pick) return;
    var g = M.findByCode(txt), o = pick.o;
    if (!g) { pickMsg('Unbekannter Code: ' + String(txt).slice(0, 50), true); return; }
    if (o.typ && g.typ !== o.typ) { pickMsg(g.name + ' ist ' + (o.typ === 'mcc' ? 'keine MCC TSC' : 'nicht passend') + ' – bitte ' + (o.was || 'das richtige Etikett') + ' scannen.', true); return; }
    if (navigator.vibrate) navigator.vibrate(60);
    pickClose();
    o.onPick(g);
  }
  M.scanPick = function (o) {
    pickClose();
    var el = document.createElement('div');
    el.id = 'scanpick'; el.className = 'sp-ov';
    el.innerHTML = '<div class="sp-box" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '"><div class="sp-h"><b>' + esc(o.title) + '</b><button type="button" class="md-x" data-act="sp-close" aria-label="Schliessen">×</button></div>' +
      (o.hint ? '<p class="muted small sp-hint">' + o.hint + '</p>' : '') +
      '<div class="sc-cam"><video id="sp-video" playsinline muted></video><div class="sc-frame" aria-hidden="true"></div><p class="sc-msg" id="sp-msg" aria-live="polite">Kamera wird gestartet …</p></div>' +
      '<label class="fld sc-manual"><span>Oder Code / Name eingeben</span><span class="row-in"><input id="sp-code" autocomplete="off" placeholder="z.B. MCC618160009" data-enter="sp-manual"><button type="button" class="btn ghost sm" data-act="sp-manual">Übernehmen</button></span></label></div>';
    document.body.appendChild(el);
    document.addEventListener('keydown', pickKey, true);
    pick = { o: o };
    pick.cam = camStart($('sp-video'), pickCode, pickMsg);
  };

  /* MCC einem Tachymeter zuordnen; hängt sie noch an einem anderen Tachymeter, wird sie dort gelöst */
  M.mccZuordnen = function (tsId, mccId) {
    var I = M.idx(), alt = I.tsOfMcc[mccId] && I.tsOfMcc[mccId] !== tsId ? I.ger[I.tsOfMcc[mccId]] : null;
    var pre = alt ? M.put('geraete', Object.assign(M.copy(alt), { mccId: null })) : Promise.resolve();
    return pre.then(function () { return M.setMcc(tsId, mccId); }).then(function () { return { alt: alt }; });
  };
  var origClose = M.closeModal;
  M.closeModal = function () { stopScan(); inlStop(); origClose(); };
  var origModal = M.modal;
  M.modal = function () { inlStop(); return origModal.apply(this, arguments); };

  /* ---------- Scanner direkt im Dialog (z.B. «Gerät platzieren»): Gerät per QR wählen, ohne Rückfrage */
  var inl = null;   // { p, o, cam }
  function inlStop() { if (inl && inl.cam) inl.cam.stop(); inl = null; }
  function inlMsg(t, err) { var m = inl && $(inl.p + '-simsg'); if (m) { m.textContent = t; m.classList.toggle('err', !!err); } }
  function inlBtn(running) {
    var b = inl && $(inl.p + '-sigo'); if (!b) return;
    b.classList.toggle('ghost', !!running);
    b.querySelector('span').textContent = running ? 'Kamera ausschalten' : inl.o.label || 'Gerät per QR-Code scannen';
  }
  function inlStart() {
    if (!inl) return;
    var box = $(inl.p + '-sicam'); if (!box) return;
    box.hidden = false; inlBtn(true);
    inl.cam = camStart($(inl.p + '-sivideo'), inlCode, inlMsg);
  }
  function inlOff() {
    if (!inl) return;
    if (inl.cam) inl.cam.stop(); inl.cam = null;
    var box = $(inl.p + '-sicam'); if (box) box.hidden = true;
    inlBtn(false);
  }
  function inlCode(txt) {
    if (!inl) return;
    var g = M.findByCode(txt);
    if (!g) { inlMsg('Unbekannter Code: ' + String(txt).slice(0, 50), true); return; }
    if (navigator.vibrate) navigator.vibrate(60);
    var o = inl.o; inlStop();
    o.onPick(g);
  }
  M.scanInlineHtml = function (p, label) {
    return '<div class="si" id="' + p + '-si"><div class="sc-cam si-cam" id="' + p + '-sicam" hidden><video id="' + p + '-sivideo" playsinline muted></video><div class="sc-frame" aria-hidden="true"></div><p class="sc-msg" id="' + p + '-simsg" aria-live="polite">Kamera wird gestartet …</p></div>' +
      '<div class="si-row"><button type="button" class="btn si-go" id="' + p + '-sigo" data-act="si-toggle">' + M.ico('qr') + '<span>' + esc(label || 'Gerät per QR-Code scannen') + '</span></button>' +
      '<span class="row-in si-man"><input id="' + p + '-sicode" autocomplete="off" placeholder="oder Code / Name eintippen" data-enter="si-manual"><button type="button" class="btn ghost sm" data-act="si-manual">OK</button></span></div></div>';
  };
  M.scanInline = function (p, o) {
    inlStop();
    inl = { p: p, o: o };
    if (o.auto) inlStart();
  };
  M.scanInlineStop = inlStop;

  M.openScan = function (mode) {
    M.ctx = { kind: 'scan' };
    var b = '<div class="sc-mode seg" role="group" aria-label="Was soll ein Scan tun">' +
      '<button type="button" data-act="scan-mode" data-k="open" class="on" aria-pressed="true">Gerät öffnen</button>' +
      '<button type="button" data-act="scan-mode" data-k="multi" aria-pressed="false">Mehrere sammeln</button></div>' +
      '<div class="sc-cam"><video id="sc-video" playsinline muted></video><div class="sc-frame" aria-hidden="true"></div><p class="sc-msg" id="sc-msg" aria-live="polite">Kamera wird gestartet …</p></div>' +
      '<div id="sc-list" class="sc-list" hidden></div>' +
      '<label class="fld sc-manual"><span>Oder Code / Name eingeben</span><span class="row-in"><input id="sc-code" autocomplete="off" placeholder="z.B. K4T9W2 oder TS-07" data-enter="scan-manual"><button type="button" class="btn ghost sm" data-act="scan-manual">Suchen</button></span></label>';
    M.modal({ title: 'QR-Etikett scannen', form: 'scan', body: b, noFocus: true, foot: '<span class="grow"></span><button type="button" class="btn ghost" data-act="modal-close">Schliessen</button>' });
    scan = { mode: 'open', list: [], last: {} };
    if (mode === 'multi') setScanMode('multi');
    scan.cam = camStart($('sc-video'), onCode, msg);
  };
  function msg(t, err) { var m = $('sc-msg'); if (m) { m.textContent = t; m.classList.toggle('err', !!err); } }
  /* liefert eine Funktion video → Promise<Text|null>; nativ (BarcodeDetector) oder jsQR */
  function detector() {
    if ('BarcodeDetector' in window) {
      return window.BarcodeDetector.getSupportedFormats().then(function (f) {
        if (f.indexOf('qr_code') < 0) throw new Error('kein QR');
        var bd = new window.BarcodeDetector({ formats: ['qr_code'] });
        return function (v) { return bd.detect(v).then(function (r) { return r.length ? r[0].rawValue : null; }); };
      }).catch(jsqrDetector);
    }
    return jsqrDetector();
  }
  function jsqrDetector() {
    return M.loadScript('vendor/jsqr/jsQR.js').then(function () {
      var cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
      return function (v) {
        var k = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
        cv.width = Math.round(v.videoWidth * k); cv.height = Math.round(v.videoHeight * k);
        cx.drawImage(v, 0, 0, cv.width, cv.height);
        var d = cx.getImageData(0, 0, cv.width, cv.height), r = window.jsQR(d.data, d.width, d.height, { inversionAttempts: 'dontInvert' });
        return Promise.resolve(r ? r.data : null);
      };
    });
  }
  function onCode(txt) {
    if (!scan) return;
    var now = Date.now();
    if (scan.last[txt] && now - scan.last[txt] < 2500) return;
    scan.last[txt] = now;
    var g = M.findByCode(txt);
    if (!g) { msg('Unbekannter Code: ' + String(txt).slice(0, 50), true); return; }
    if (navigator.vibrate) navigator.vibrate(60);
    if (scan.mode === 'open') { M.closeModal(); M.openCode(g.qr || g.id); return; }
    if (scan.list.indexOf(g.id) < 0) scan.list.push(g.id);
    msg(g.name + ' hinzugefügt · ' + scan.list.length + ' gesammelt');
    renderScanList();
  }
  function setScanMode(k) {
    if (!scan) return;
    scan.mode = k;
    document.querySelectorAll('[data-act=scan-mode]').forEach(function (b) { var on = b.getAttribute('data-k') === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    renderScanList();
  }
  function renderScanList() {
    var el = $('sc-list'); if (!el || !scan) return;
    el.hidden = scan.mode !== 'multi';
    if (scan.mode !== 'multi') return;
    var I = M.idx();
    if (!scan.list.length) { el.innerHTML = '<p class="muted small">Ein Gerät nach dem anderen scannen. Danach gemeinsam ins Magazin buchen, einem Projekt zuordnen oder im Inventar weiterbearbeiten.</p>'; return; }
    el.innerHTML = '<div class="sc-chips">' + scan.list.map(function (id) {
      var g = I.ger[id], i = M.info(id);
      return '<span class="sc-chip"><b>' + esc(g.name) + '</b><span>' + esc(i.ortText || '') + '</span><button type="button" class="ic-btn" data-act="scan-rm" data-id="' + id + '" aria-label="' + esc(g.name) + ' entfernen">×</button></span>';
    }).join('') + '</div><div class="btn-row"><button type="button" class="btn sm" data-act="scan-go" data-k="mag">Ins Magazin …</button><button type="button" class="btn sm" data-act="scan-go" data-k="move">Projekt ändern …</button><button type="button" class="btn sm ghost" data-act="scan-go" data-k="inv">Im Inventar auswählen</button><button type="button" class="btn sm ghost" data-act="scan-go" data-k="label">Etiketten drucken …</button></div>';
  }

  /* ---------- Aktionen anmelden */
  Object.assign(M.ACT, {
    'labels': function (d) { M.openEtiketten([d.id]); },
    'bulk-labels': function () { M.openEtiketten(M.selectedIds()); },
    'et-format': function (d) {
      M.ctx.format = d.k;
      document.querySelectorAll('[data-act=et-format]').forEach(function (b) { var on = b.getAttribute('data-k') === d.k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      etRedraw();
    },
    'et-start': function (d) { M.ctx.start = +d.k; etRedraw(); },
    'et-test': function () {
      var c = M.ctx, tab = M.pdfTab ? M.pdfTab('Testseite ' + c.format) : null;
      M.etikettenPdf([], { format: c.format, test: true }).then(function (r) { etShow(r, 'MonInv-Testseite-' + c.format + '.pdf', tab); })
        .catch(function (e) { M.toast('Testseite fehlgeschlagen: ' + (e.message || e), 'err'); });
    },
    'scan': function () { M.openScan(); },
    'scan-multi': function () { M.openScan('multi'); },
    'scan-mode': function (d) { setScanMode(d.k); },
    'scan-rm': function (d) { if (!scan) return; scan.list = scan.list.filter(function (x) { return x !== d.id; }); renderScanList(); },
    'scan-manual': function () {
      var v = ($('sc-code') || {}).value || '';
      if (!v.trim()) return;
      var g = M.findByCode(v);
      if (!g) { msg('Nichts gefunden für «' + v.trim() + '»', true); return; }
      $('sc-code').value = '';
      scan ? (delete scan.last[g.qr || g.id], onCode(g.qr || g.id)) : M.openCode(g.qr || g.id);
    },
    'sa-gps': function () { saGps(); },
    'sa-mcc': function () {
      var c = M.ctx; if (!c || c.kind !== 'scanakt') return;
      var gid = c.gid, base = c.base;
      M.scanPick({ title: 'MCC TSC scannen', typ: 'mcc', was: 'das Etikett der MCC', hint: 'Für ' + esc(M.idx().ger[base].name) + '. Die MCC wechselt danach den Standort mit dem Tachymeter.', onPick: function (g) {
        M.mccZuordnen(base, g.id).then(function (r) {
          M.toast(g.name + ' gehört jetzt zu ' + M.idx().ger[base].name + (r.alt ? ' (von ' + r.alt.name + ' gelöst)' : ''));
          M.refreshUI && M.refreshUI();
          if (M.ctx && M.ctx.kind === 'scanakt') M.openScanAktionen(gid);
        }).catch(function (e) { M.toast('MCC nicht gespeichert: ' + (e.message || e), 'err'); });
      } });
    },
    /* MCC-Auswahlfeld (Projekt ändern, Gerät bearbeiten) per QR füllen */
    'mcc-scan': function (d) {
      var sel = $(d.k); if (!sel) return;
      M.scanPick({ title: 'MCC TSC scannen', typ: 'mcc', was: 'das Etikett der MCC', onPick: function (g) {
        if (!sel.isConnected) return;
        var I = M.idx(), alt = I.tsOfMcc[g.id] && I.tsOfMcc[g.id] !== d.id ? I.ger[I.tsOfMcc[g.id]] : null;
        if (![].some.call(sel.options, function (o) { return o.value === g.id; })) {
          var o = document.createElement('option'); o.value = g.id; o.textContent = g.name + (alt ? ' · wird von ' + alt.name + ' gelöst' : ''); sel.appendChild(o);
        }
        sel.value = g.id;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        M.toast(g.name + ' gewählt' + (alt ? ' – wird beim Speichern von ' + alt.name + ' gelöst' : ''));
      } });
    },
    'sp-close': function () { pickClose(); },
    'si-toggle': function () { if (!inl) return; if (inl.cam) inlOff(); else inlStart(); },
    'si-manual': function () {
      if (!inl) return;
      var el = $(inl.p + '-sicode'), v = (el || {}).value || ''; if (!v.trim()) return;
      var g = M.findByCode(v);
      if (!g) { if ($(inl.p + '-sicam').hidden) M.toast('Nichts gefunden für «' + v.trim() + '»', 'err'); else inlMsg('Nichts gefunden für «' + v.trim() + '»', true); return; }
      inlCode(g.qr || g.id);
    },
    'sp-manual': function () {
      var v = ($('sp-code') || {}).value || ''; if (!v.trim()) return;
      var g = M.findByCode(v); if (!g) { pickMsg('Nichts gefunden für «' + v.trim() + '»', true); return; }
      pickCode(g.qr || g.id);
    },
    'sa-mag': function () { var c = M.ctx; if (c && c.kind === 'scanakt') M.openMove([c.base], true); },
    'sa-edit': function () { var c = M.ctx; if (c && c.kind === 'scanakt') M.openGeraet(c.gid); },
    'sa-show': function () { var c = M.ctx; if (c && c.kind === 'scanakt') { var id = c.gid; M.closeModal(); M.showDevice(id); } },
    'scan-go': function (d) {
      var ids = scan ? scan.list.slice() : [];
      if (!ids.length) return;
      M.closeModal();
      M.state.invSel = {}; ids.forEach(function (id) { M.state.invSel[id] = true; });
      if (d.k === 'inv') { M.go('inventar'); return; }
      if (d.k === 'label') { M.openEtiketten(ids); return; }
      if (d.k === 'mag') M.openMove(ids, true); else M.openMove(ids);
    },
    'et-settings-save': function () {
      var s = M.copy(M.settings());
      s.etikett = { dx: Math.max(-5, Math.min(5, M.num($('set-et-dx').value) || 0)), dy: Math.max(-5, Math.min(5, M.num($('set-et-dy').value) || 0)) };
      M.put('einstellungen', s).then(function () { M.toast('Versatz gespeichert'); });
    },
    'et-settings-test': function () {
      var f = prefs().format || 'L4773', tab = M.pdfTab ? M.pdfTab('Testseite ' + f) : null;
      M.etikettenPdf([], { format: f, test: true }).then(function (r) { M.showPdf(tab, r.blob, 'MonInv-Testseite-' + f + '.pdf'); });
    }
  });
  Object.assign(M.CHANGE, { 'et-redraw': function () { etRedraw(); } });
  var origSubmit = M.onSubmit;
  M.onSubmit = function (form, submitter) {
    var f = form.getAttribute('data-form');
    if (f === 'etiketten') return M.submitEtiketten();
    if (f === 'scan') return M.ACT['scan-manual']();
    return origSubmit(form, submitter);
  };

  /* ---------- Einstieg über den Link im QR-Code (#g=…) – auch nach der Microsoft-Anmeldung */
  var m0 = location.hash.match(/^#g=([^&]+)/);
  if (m0) { try { sessionStorage.setItem('moninv.open', decodeURIComponent(m0[1])); } catch (e) { /* egal */ } }
  M.pendingOpen = function () {
    var c = null;
    try { c = sessionStorage.getItem('moninv.open'); sessionStorage.removeItem('moninv.open'); } catch (e) { /* egal */ }
    var m = location.hash.match(/^#g=([^&]+)/);
    if (m) c = decodeURIComponent(m[1]);
    if (c) M.openCode(c);
  };
  window.addEventListener('hashchange', function () {
    var m = location.hash.match(/^#g=([^&]+)/);
    if (m && M.state && M.state.data) M.openCode(decodeURIComponent(m[1]));
  });
})();
