/* MonInv – Geräte aus CSV importieren (gleiches Format wie «Excel-Export»)
   Abgleich über den Namen (sonst Seriennummer). Leere Zellen lassen bestehende Werte unverändert.
   Berechnete Spalten (Restwert, Amortisiert total, Standorte, Tage seit Wartung, Kabel, Gruppe) werden ignoriert. */
(function () {
  'use strict';
  var M = window.M, S = window.MonSym;
  var esc = M.esc;
  function $(id) { return document.getElementById(id); }

  /* ---------- CSV lesen */
  function parseCsv(text) {
    text = text.replace(/^﻿/, '');
    var first = text.split(/\r?\n/)[0] || '';
    var cnt = function (c) { return first.split(c).length - 1; };
    var sep = cnt(';') >= cnt(',') ? (cnt(';') >= cnt('\t') ? ';' : '\t') : (cnt(',') >= cnt('\t') ? ',' : '\t');
    var rows = [], row = [], f = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === sep) { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(f); rows.push(row); row = []; f = '';
      } else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ''; }); });
  }
  function readFile(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onerror = function () { rej(new Error('Datei konnte nicht gelesen werden.')); };
      r.onload = function () {
        var t = String(r.result || '');
        if (t.indexOf('�') < 0) return res(t);
        // Excel speichert CSV oft in Windows-1252
        var r2 = new FileReader();
        r2.onload = function () { res(String(r2.result || '')); };
        r2.onerror = function () { res(t); };
        r2.readAsText(file, 'windows-1252');
      };
      r.readAsText(file, 'utf-8');
    });
  }

  /* ---------- Spalten */
  var COLS = {
    name: ['name', 'nummer', 'gerät', 'geraet'],
    typ: ['gerätetyp', 'geraetetyp'],
    kat: ['kategorie'],
    gruppe: ['gruppe'],
    gtyp: ['typ', 'modell'],
    hersteller: ['hersteller'],
    sn: ['seriennummer', 'seriennr.', 'seriennr', 'sn'],
    kauf: ['kaufdatum'],
    wert: ['wert chf', 'anschaffungswert chf', 'wert', 'anschaffungswert', 'kaufpreis chf', 'kaufpreis'],
    amortText: ['amortisation aktueller standort'],
    vor: ['vor erfassung amortisiert chf', 'bereits amortisiert vor erfassung chf', 'startwert chf'],
    vorDat: ['stand per'],
    sim: ['sim-karte', 'sim'],
    zustand: ['zustand'],
    ort: ['standort'],
    proj: ['projekt'],
    auftrag: ['auftrag', 'auftragsnummer', 'auftragsnr.', 'teilprojekt'],
    seit: ['seit'],
    ost: ['ost lv95', 'ost', 'e lv95'],
    nord: ['nord lv95', 'nord', 'n lv95'],
    lw: ['letzte wartung'],
    int: ['intervall monate', 'wartungsintervall monate'],
    link: ['mcc / tachymeter', 'mcc', 'mcc tsc'],
    ms: ['messstelle'],
    bem: ['bemerkung'],
    wlan: ['wlan-passwort', 'wlan passwort', 'passphrase']
  };
  var IGNORE = ['amortisiert total chf', 'standorte', 'restwert chf', 'ertrag über anschaffung chf', 'tage seit wartung', 'kabel'];

  function norm(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function pd(s) {
    s = String(s || '').trim();
    if (!s) return null;
    var y, mo, da, m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) { y = m[1]; mo = +m[2]; da = +m[3]; }
    else {
      m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})$/);
      if (!m) return 'x';
      y = m[3].length === 2 ? '20' + m[3] : m[3]; mo = +m[2]; da = +m[1];
    }
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return 'x';
    return y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + da).slice(-2);
  }
  function parseTyp(s) {
    var t = norm(s);
    if (!t) return null;
    if (t.indexOf('messstelle') >= 0) return 'messstelle';
    if (t.indexOf('tachy') >= 0) return 'tachymeter';
    if (t.indexOf('mcc') >= 0) return 'mcc';
    return 'sensor';
  }
  function parseAmort(s) {
    var t = String(s || '');
    var m = t.match(/CHF\s*([\d'’ .,]+?)\s*(pro Monat|\/\s*Mt|pauschal)/i);
    if (!m) return null;
    return { modus: /pauschal/i.test(m[2]) ? 'pauschal' : 'monat', betrag: M.num(m[1]) || 0 };
  }

  /* ---------- Analyse */
  M.csvAnalyse = function (rows) {
    if (rows.length < 2) return { err: 'Die Datei enthält keine Gerätezeilen.' };
    var head = rows[0].map(norm), idx = {}, extraCols = [], unknown = [];
    Object.keys(COLS).forEach(function (k) {
      for (var a = 0; a < COLS[k].length; a++) { var p = head.indexOf(COLS[k][a]); if (p >= 0 && !Object.values(idx).includes(p)) { idx[k] = p; break; } }
    });
    if (idx.name === undefined) return { err: 'Spalte «Name» fehlt. Am einfachsten zuerst einen Excel-Export machen und diesen als Vorlage verwenden.' };
    var I = M.idx(), D = M.state.data;
    var fieldNames = {};
    D.kategorien.forEach(function (k) { (k.felder || []).forEach(function (f) { fieldNames[norm(f.name)] = f.name; }); });
    rows[0].forEach(function (h, p) {
      if (Object.values(idx).includes(p) || !String(h).trim()) return;
      if (fieldNames[norm(h)]) extraCols.push({ p: p, name: fieldNames[norm(h)] });
      else if (IGNORE.indexOf(norm(h)) < 0) unknown.push(String(h).trim());
    });

    var byName = {}, bySn = {};
    D.geraete.forEach(function (g) { byName[norm(g.name)] = g; if (g.seriennummer) { var k = norm(g.seriennummer); bySn[k] = bySn[k] ? 'mehrfach' : g; } });
    var katByName = {}; D.kategorien.forEach(function (k) { katByName[norm(k.name)] = k; });
    var projByName = {}, magByName = {};
    D.projekte.forEach(function (p) {
      var map = p.typ === 'magazin' ? magByName : projByName;
      map[norm(M.projName(p))] = p; map[norm(p.name)] = map[norm(p.name)] || p; if (p.nummer) map[norm(p.nummer)] = map[norm(p.nummer)] || p;
    });
    var grpByName = {}; S.GRUPPEN_ORDER.forEach(function (k) { grpByName[norm(S.GRUPPEN[k].name)] = k; grpByName[k] = k; });

    var res = { items: [], newKats: {}, newProjs: {}, unknown: unknown, neu: 0, upd: 0, same: 0, fehler: 0, moves: 0, links: 0 };
    var seen = {};
    function cell(r, k) {
      var v = idx[k] === undefined ? '' : String(r[idx[k]] === undefined ? '' : r[idx[k]]).trim();
      var m = v.match(/^="(.*)"$/);   // Excel-Textschutz ="…"
      return m ? m[1] : v;
    }

    rows.slice(1).forEach(function (r, n) {
      var it = { zeile: n + 2, name: cell(r, 'name'), notes: [], errs: [] };
      res.items.push(it);
      if (!it.name) { it.errs.push('Name fehlt'); return; }
      if (seen[norm(it.name)]) { it.errs.push('Name doppelt in der Datei (Zeile ' + seen[norm(it.name)] + ')'); return; }
      seen[norm(it.name)] = it.zeile;
      var sn = cell(r, 'sn');
      var g = byName[norm(it.name)] || (sn && bySn[norm(sn)] && bySn[norm(sn)] !== 'mehrfach' ? bySn[norm(sn)] : null);
      it.existing = g || null;
      var rec = g ? M.copy(g) : { id: M.uid('ger'), name: it.name, typ: 'sensor', zustand: 'aktiv', extra: {}, sim: '', bemerkung: '' };
      var changed = [];
      function set(field, v, label) {
        if (v === null || v === undefined || v === '') return;
        var old = rec[field];
        if (String(old === null || old === undefined ? '' : old) !== String(v)) { rec[field] = v; changed.push(label); }
      }
      if (g && g.name !== it.name) set('name', it.name, 'Name');
      var typ = parseTyp(cell(r, 'typ'));
      if (!g) rec.typ = typ || 'sensor';
      else if (typ && typ !== g.typ) it.notes.push('Gerätetyp bleibt ' + M.typLabel[g.typ]);
      // Kategorie
      var kn = cell(r, 'kat');
      if (kn) {
        var k = katByName[norm(kn)];
        if (!k && res.newKats[norm(kn)]) k = res.newKats[norm(kn)];
        if (!k) {
          var grp = grpByName[norm(cell(r, 'gruppe'))] || (rec.typ === 'sensor' ? 'erf' : 'geo');
          k = { id: M.uid('kat'), name: kn, gruppe: grp, piktogramm: '', kuerzel: kn.replace(/[^A-Za-zÄÖÜäöü]/g, '').slice(0, 2).toUpperCase() || '?', typ: rec.typ, felder: [], _neu: true };
          res.newKats[norm(kn)] = k;
          it.notes.push('neue Kategorie «' + kn + '»');
        }
        set('kategorieId', k.id, 'Kategorie');
      } else if (!g && rec.typ !== 'sensor') {
        var dk = D.kategorien.find(function (x) { return x.typ === rec.typ; });
        if (dk) rec.kategorieId = dk.id;
      }
      set('gtyp', cell(r, 'gtyp'), 'Typ');
      set('hersteller', cell(r, 'hersteller'), 'Hersteller');
      set('seriennummer', sn, 'Seriennummer');
      var kd = pd(cell(r, 'kauf'));
      if (kd === 'x') it.errs.push('Kaufdatum unlesbar'); else set('kaufdatum', kd, 'Kaufdatum');
      var fin = M.can('fin');   // User: Finanzspalten der CSV werden ignoriert
      var w = fin && cell(r, 'wert'); if (w) { if (M.num(w) === null) it.errs.push('Wert unlesbar'); else set('wert', M.num(w), 'Anschaffungswert'); }
      var v = fin && cell(r, 'vor'); if (v) { if (M.num(v) === null) it.errs.push('Startwert unlesbar'); else if (M.num(v) !== (M.num(rec.amortVor) || 0)) set('amortVor', M.num(v), 'Startwert'); }
      var vd = fin ? pd(cell(r, 'vorDat')) : ''; if (vd === 'x') it.errs.push('«Stand per» unlesbar'); else set('amortVorDatum', vd, 'Stand per');
      var sim = cell(r, 'sim');
      if (/^\d+([.,]\d+)?e\+?\d+$/i.test(sim)) it.notes.push('SIM-Nummer von Excel verkürzt (' + sim + ') – nicht übernommen');
      else if (sim && norm(sim) !== 'keine') set('sim', sim.replace(/\s+/g, ' '), 'SIM');
      var wl = cell(r, 'wlan'); if (wl && rec.typ === 'mcc') set('wlanPasswort', wl, 'WLAN-Passwort');
      var z = norm(cell(r, 'zustand'));
      if (z) {
        var zz = z.indexOf('ausgemustert') >= 0 ? 'ausgemustert' : z.indexOf('defekt') >= 0 ? 'defekt' : 'aktiv';
        if (zz !== 'aktiv' || (g && g.zustand !== 'aktiv')) set('zustand', zz, 'Zustand');
      }
      // Wartung: nur übernehmen, wenn es vom heute gültigen Wert abweicht (nicht den Standard der Einstellungen festschreiben)
      var wi = g ? M.info(g.id).wart : null, defInt = (M.settings().intervall || {})[rec.typ] || null;
      var lw = pd(cell(r, 'lw')); if (lw === 'x') it.errs.push('Letzte Wartung unlesbar'); else if (lw && !(wi && wi.letzte === lw)) set('letzteWartung', lw, 'Letzte Wartung');
      var iv = M.num(cell(r, 'int'));
      if (iv !== null && iv !== (wi ? wi.intervall : defInt)) set('wartungIntervall', iv, 'Wartungsintervall');
      set('bemerkung', cell(r, 'bem'), 'Bemerkung');
      extraCols.forEach(function (c) {
        var val = String(r[c.p] === undefined ? '' : r[c.p]).trim();
        if (!val) return;
        rec.extra = rec.extra || {};
        if (String(rec.extra[c.name] || '') !== val) { rec.extra[c.name] = val; changed.push(c.name); }
      });
      it.rec = rec; it.changed = changed;
      it.typ = rec.typ;
      it.link = cell(r, 'link');
      it.ms = rec.typ === 'messstelle' ? '' : cell(r, 'ms');

      // Standort / Projekt
      var ortT = cell(r, 'ort'), projT = cell(r, 'proj'), pos = M.parseLv95(cell(r, 'ost'), cell(r, 'nord'));
      if ((cell(r, 'ost') || cell(r, 'nord')) && !pos) it.notes.push('LV95 ungültig – ohne Position');
      var seit = pd(cell(r, 'seit')); if (seit === 'x') { it.errs.push('«Seit» unlesbar'); seit = null; }
      var am = M.can('fin') ? parseAmort(cell(r, 'amortText')) : null;
      var t = null;
      if (/^bei\s+/i.test(ortT) && rec.typ === 'mcc') { if (!it.link) it.link = ortT.replace(/^bei\s+/i, ''); }
      else if (ortT && magByName[norm(ortT)]) t = { ort: 'magazin', magazinId: magByName[norm(ortT)].id };
      else if (ortT && /^magazin/i.test(ortT) && !pos) it.errs.push('Magazin «' + ortT + '» gibt es nicht');
      else if (pos || projT || (ortT && norm(ortT) !== 'ohne standort')) {
        t = { ort: 'feld', lat: pos ? pos.lat : null, lng: pos ? pos.lng : null,
          ortName: ortT && !/^(lv95|feld|ohne standort)/i.test(ortT) ? ortT : '' };
      }
      if (t && t.ort === 'feld' && projT) {
        var p = projByName[norm(projT)] || res.newProjs[norm(projT)];
        if (!p) {
          var mm = projT.match(/^(\S*\d\S*)\s+(.+)$/);
          p = { id: M.uid('prj'), typ: 'projekt', status: 'aktiv', nummer: mm ? mm[1] : '', name: mm ? mm[2] : projT, lat: null, lng: null, _neu: true };
          res.newProjs[norm(projT)] = p;
          it.notes.push('neues Projekt «' + projT + '»');
        }
        t.projektId = p.id;
      }
      if (t && t.ort === 'feld') { t.amortModus = am ? am.modus : null; t.amortBetrag = am ? am.betrag : null; if (cell(r, 'auftrag')) t.auftrag = cell(r, 'auftrag'); }
      it.target = t;
      it.datum = seit || rec.kaufdatum || M.today();

      // Vergleich mit dem heutigen Standort
      if (g && t) {
        var cur = M.info(g.id).cur;
        var diff = !cur || cur.ort !== t.ort || (cur.magazinId || null) !== (t.magazinId || null) || (cur.projektId || null) !== (t.projektId || null) ||
          (t.ort === 'feld' && M.has(t.lat) && (!M.has(cur.lat) || M.dist([cur.lat, cur.lng], [t.lat, t.lng]) > 3));   // LV95 auf Meter gerundet
        it.moveDiff = diff;
        if (!diff && t.ort === 'feld' && M.has(t.auftrag) && cur && (cur.auftrag || '') !== t.auftrag) { it.auftragPatch = t.auftrag; changed.push('Auftrag'); }
        if (diff) { res.moves++; if (cur && it.datum <= cur.von) it.datum = M.today(); }
      }
      if (it.errs.length) return;
      if (!g) res.neu++; else if (changed.length) res.upd++; else res.same++;
    });
    res.fehler = res.items.filter(function (x) { return x.errs.length; }).length;
    res.ok = res.items.filter(function (x) { return !x.errs.length; });
    return res;
  };

  /* ---------- Dialog */
  M.importCsv = function (file) {
    readFile(file).then(function (text) {
      var A = M.csvAnalyse(parseCsv(text));
      if (A.err) { M.toast(A.err); return; }
      M.ctx = { kind: 'csvimp', A: A, file: file.name };
      var nk = Object.keys(A.newKats).length, np = Object.keys(A.newProjs).length;
      var b = '<p class="muted">Datei <b>' + esc(file.name) + '</b> · ' + A.items.length + ' Zeilen. Abgleich über den Namen; leere Zellen lassen bestehende Werte unverändert.</p>' +
        '<div class="ci-sum"><div><b>' + A.neu + '</b><span>neue Geräte</span></div><div><b>' + A.upd + '</b><span>werden aktualisiert</span></div>' +
        '<div><b>' + A.same + '</b><span>unverändert</span></div><div class="' + (A.fehler ? 'bad' : '') + '"><b>' + A.fehler + '</b><span>Zeilen mit Fehler (werden übersprungen)</span></div></div>';
      if (nk || np) b += '<p class="small">' + (nk ? 'Neue Kategorien: <b>' + esc(Object.values(A.newKats).map(function (k) { return k.name; }).join(', ')) + '</b>. ' : '') +
        (np ? 'Neue Projekte: <b>' + esc(Object.values(A.newProjs).map(function (p) { return M.projName(p); }).join(', ')) + '</b>.' : '') + '</p>';
      if (A.unknown.length) b += '<p class="small muted">Nicht verwendete Spalten: ' + esc(A.unknown.join(', ')) + '</p>';
      b += '<label class="chk"><input type="checkbox" id="ci-upd" checked> Bestehende Geräte aktualisieren</label>' +
        (A.moves ? '<label class="chk"><input type="checkbox" id="ci-move"> Bei ' + A.moves + ' bestehenden Geräten weicht Standort oder Projekt ab – als Projektwechsel übernehmen (neuer Eintrag in der Historie, Datum = «Seit», sonst heute)</label>' : '');
      b += '<div class="tbl-wrap ci-tbl"><table class="tbl"><thead><tr><th>Zeile</th><th>Status</th><th>Name</th><th>Gerätetyp</th><th>Standort</th><th>Hinweis</th></tr></thead><tbody>';
      var rank = function (it) { return it.errs.length ? 0 : !it.existing ? 1 : it.changed.length || it.moveDiff ? 2 : 3; };
      A.items.slice().sort(function (a, c) { return rank(a) - rank(c) || a.zeile - c.zeile; }).forEach(function (it) {
        var st = it.errs.length ? ['Fehler', 'chip-off'] : !it.existing ? ['neu', 'chip-ok'] : it.changed.length ? ['aktualisieren', 'chip-mag'] : ['unverändert', 'chip-mag'];
        var ort = it.target ? (it.target.ort === 'magazin' ? M.idx().proj[it.target.magazinId].name : (it.target.ortName || (M.has(it.target.lat) ? 'LV95 ' + M.fmtLv95(it.target.lat, it.target.lng) : 'Feld · ohne Position'))) : (it.link && it.typ === 'mcc' ? 'bei ' + it.link : '–');
        var hint = it.errs.concat(it.existing && it.changed.length ? ['geändert: ' + it.changed.join(', ')] : []).concat(it.notes).concat(it.moveDiff ? ['Standort/Projekt weicht ab'] : []);
        b += '<tr><td class="mono">' + it.zeile + '</td><td><span class="chip ' + st[1] + '">' + st[0] + '</span></td><td class="strong">' + esc(it.name || '–') + '</td><td>' + esc(it.typ ? M.typLabel[it.typ] : '') + '</td><td>' + esc(ort) + '</td><td class="small' + (it.errs.length ? ' warn-t' : '') + '">' + esc(hint.join(' · ')) + '</td></tr>';
      });
      b += '</tbody></table></div><p class="form-err" id="ci-err" role="alert"></p>';
      M.modal({ title: 'Geräte importieren', form: 'csvimp', wide: true, body: b, noFocus: true,
        foot: '<button type="button" class="btn ghost" data-act="csv-vorlage">Vorlage herunterladen</button><span class="grow"></span><button type="button" class="btn ghost" data-act="modal-close">Abbrechen</button><button type="submit" class="btn"' + (A.ok.length ? '' : ' disabled') + '>Importieren</button>' });
    }).catch(function (e) { M.toast(e.message || String(e)); });
  };

  function seq(fns) { return fns.reduce(function (p, f) { return p.then(f); }, Promise.resolve()); }

  M.submitCsvImport = function () {
    var A = M.ctx.A, upd = $('ci-upd') ? $('ci-upd').checked : true, mv = $('ci-move') ? $('ci-move').checked : false;
    var items = A.ok.filter(function (it) { return !it.existing || upd; });
    M.closeModal();
    M.toast('Import läuft …');
    var usedK = {}, usedP = {};
    items.forEach(function (it) {
      if (it.rec.kategorieId) usedK[it.rec.kategorieId] = 1;
      if (it.target && it.target.projektId) usedP[it.target.projektId] = 1;
    });
    var jobs = [];
    Object.values(A.newKats).forEach(function (k) { if (usedK[k.id]) { var c = M.copy(k); delete c._neu; jobs.push(function () { return M.put('kategorien', c); }); } });
    Object.values(A.newProjs).forEach(function (p) { if (usedP[p.id]) { var c = M.copy(p); delete c._neu; jobs.push(function () { return M.put('projekte', c); }); } });
    var nNeu = 0, nUpd = 0, nMove = 0, nLink = 0;
    items.forEach(function (it) {
      if (!it.existing || it.changed.length) jobs.push(function () { if (it.existing) nUpd++; else nNeu++; return M.put('geraete', it.rec); });
    });
    // Standorte: neue Geräte immer, bestehende nur auf Wunsch; Tachymeter vor MCC
    items.slice().sort(function (a, b) { return (a.typ === 'mcc') - (b.typ === 'mcc'); }).forEach(function (it) {
      if (!it.target) return;
      if (it.existing && !(mv && it.moveDiff)) return;
      jobs.push(function () { nMove++; return M.move(it.rec.id, it.target, it.datum, { wer: M.userKuerzel(), mitMcc: true }); });
    });
    // Auftragsnummern am laufenden Einsatz
    items.forEach(function (it) {
      if (it.auftragPatch !== undefined && !(mv && it.moveDiff)) jobs.push(function () { return M.setAuftrag([it.rec.id], it.auftragPatch); });
    });
    // MCC-Zuordnung
    jobs.push(function () {
      var byName = {}; M.state.data.geraete.forEach(function (g) { byName[norm(g.name)] = g; });
      var links = [];
      items.forEach(function (it) {
        if (!it.link) return;
        var other = byName[norm(it.link)];
        if (!other) return;
        var ts = it.typ === 'tachymeter' ? it.rec.id : other.typ === 'tachymeter' ? other.id : null;
        var mcc = it.typ === 'mcc' ? it.rec.id : other.typ === 'mcc' ? other.id : null;
        if (!ts || !mcc) return;
        if (links.some(function (l) { return l[0] === ts || l[1] === mcc; })) return;
        links.push([ts, mcc]);
      });
      return seq(links.map(function (l) {
        return function () {
          var I = M.idx(), tsRec = I.ger[l[0]];
          if (tsRec.mccId === l[1]) return null;
          var owner = I.tsOfMcc[l[1]], pre = Promise.resolve();
          if (owner && owner !== l[0]) { var o = M.copy(I.ger[owner]); o.mccId = null; pre = M.put('geraete', o); }
          nLink++;
          return pre.then(function () { return M.setMcc(l[0], l[1]); });
        };
      }));
    });
    // Messstellen-Zugehörigkeit
    jobs.push(function () {
      var byName = {}; M.state.data.geraete.forEach(function (g) { if (g.typ === 'messstelle') byName[norm(g.name)] = g; });
      return seq(items.filter(function (it) { return it.ms && byName[norm(it.ms)]; }).map(function (it) {
        return function () { var g = M.copy(M.idx().ger[it.rec.id]); if (g.gruppeId === byName[norm(it.ms)].id) return null; g.gruppeId = byName[norm(it.ms)].id; return M.put('geraete', g); };
      }));
    });
    seq(jobs).then(function () {
      M.refreshUI();
      M.toast('Import fertig: ' + nNeu + ' neu, ' + nUpd + ' aktualisiert' + (nMove ? ', ' + nMove + ' Standorte' : '') + (nLink ? ', ' + nLink + ' MCC zugeordnet' : ''));
    }).catch(function (e) { M.failed(e); M.refreshUI(); });
  };

  M.csvVorlage = function () { M.exportGeraete([], 'MonInv-Vorlage-Geraete.csv'); };
})();
