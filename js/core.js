/* MonInv – Kern: Zustand, Berechnungen, Datenänderungen
   Ein Einsatz beschreibt, WO ein Gerät ist (ort: 'feld' mit Position, oder 'magazin')
   und separat, für WELCHES Projekt es läuft (projektId, optional). */
(function () {
  'use strict';
  var M = window.M = window.M || {};
  var S = window.MonSym;
  M.esc = S.esc;

  /* Versionsnummer der App. Bei jeder neuen Version hier UND in index.html (?v=…) ersetzen. */
  M.VERSION = '0.5.8';
  /* Handy-Darstellung (gleiche Grenze wie in css/mobile.css) */
  M.isMobile = function () { return !!(window.matchMedia && window.matchMedia('(max-width: 760px)').matches); };

  /* ---------- Hilfen */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  M.iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  M.today = function () { return M.iso(new Date()); };
  M.fmtDate = function (s) { if (!s) return '–'; var p = String(s).split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : s; };
  M.chf = function (n) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '–';
    var neg = n < 0; n = Math.round(Math.abs(n));
    return (neg ? '−' : '') + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  };
  M.num = function (v) { if (v === '' || v === null || v === undefined) return null; var x = parseFloat(String(v).replace(/['’\s]/g, '').replace(',', '.')); return isNaN(x) ? null : x; };
  M.uid = function (p) {
    var r = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
    return (p || 'id') + '-' + r;
  };
  function dayNum(s) { var p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5; }
  M.days = function (a, b) { return Math.round(dayNum(b) - dayNum(a)); };
  M.has = function (v) { return v !== null && v !== undefined && v !== ''; };

  /* ---------- LV95 ⇄ WGS84 (Näherungsformeln swisstopo, ca. 1 m genau) */
  M.toLv95 = function (lat, lng) {
    var p = (lat * 3600 - 169028.66) / 10000, l = (lng * 3600 - 26782.5) / 10000;
    var e = 2600072.37 + 211455.93 * l - 10938.51 * l * p - 0.36 * l * p * p - 44.54 * l * l * l;
    var n = 1200147.07 + 308807.95 * p + 3745.25 * l * l + 76.63 * p * p - 194.56 * l * l * p + 119.79 * p * p * p;
    return { e: e, n: n };
  };
  M.fromLv95 = function (e, n) {
    var y = (e - 2600000) / 1e6, x = (n - 1200000) / 1e6;
    var l = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y * y * y;
    var p = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.0140 * x * x * x;
    return { lat: p * 100 / 36, lng: l * 100 / 36 };
  };
  M.fmtLv95 = function (lat, lng) {
    if (!M.has(lat)) return '–';
    var c = M.toLv95(lat, lng);
    return M.chf(c.e) + ' / ' + M.chf(c.n);
  };
  M.parseLv95 = function (e, n) {
    var E = M.num(e), N = M.num(n);
    if (E === null || N === null) return null;
    if (E < 2400000 || E > 2900000 || N < 1050000 || N > 1350000) return null;
    return M.fromLv95(E, N);
  };
  M.dist = function (a, b) {
    var R = 6371000, t = Math.PI / 180;
    var dLat = (b[0] - a[0]) * t, dLng = (b[1] - a[1]) * t;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  M.lineLen = function (pts) { var s = 0; for (var i = 1; i < (pts || []).length; i++) s += M.dist(pts[i - 1], pts[i]); return s; };
  M.fmtLen = function (m) { return m >= 1000 ? (m / 1000).toFixed(2).replace('.', ',') + ' km' : Math.round(m) + ' m'; };

  /* Gemeinde zu einer Position (swisstopo, frei nutzbar). Ohne Internet: null. */
  M.gemeinde = function (lat, lng) {
    var c = M.toLv95(lat, lng);
    var url = 'https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometryType=esriGeometryPoint&geometry=' +
      Math.round(c.e) + ',' + Math.round(c.n) + '&sr=2056&layers=all:ch.swisstopo.swissboundaries3d-gemeinde-flaeche.fill&tolerance=0&returnGeometry=false&lang=de';
    return fetch(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var a = j && j.results && j.results[0] && j.results[0].attributes;
      return a ? (a.gemname || a.label || null) : null;
    }).catch(function () { return null; });
  };
  /* Adresse / Ort suchen (swisstopo) */
  M.ortSuche = function (q) {
    var url = 'https://api3.geo.admin.ch/rest/services/api/SearchServer?type=locations&sr=4326&limit=6&searchText=' + encodeURIComponent(q);
    return fetch(url).then(function (r) { return r.ok ? r.json() : { results: [] }; }).then(function (j) {
      return (j.results || []).map(function (x) {
        return { label: String(x.attrs.label || '').replace(/<[^>]+>/g, ''), lat: x.attrs.lat, lng: x.attrs.lon };
      });
    }).catch(function () { return []; });
  };

  /* ---------- Zustand */
  M.state = {
    data: null,
    version: 0,
    view: 'karte',
    sel: null,           // gewähltes Gerät
    selKabel: null,      // gewähltes Kabel
    placing: null,       // { kind: 'geraet'|'projekt', id }
    drawing: null,       // { kabelId, pts:[[lat,lng]], vonId, zuId }
    projSel: null,
    invSel: {},
    roleTest: (function () { try { return sessionStorage.getItem('moninv-roletest') || null; } catch (e) { return null; } })(),   // Admin: Ansicht als …
    filters: {
      map: { off: {}, feld: true, magazin: true, issue: false, projekt: '', kabel: true },
      inv: { q: '', typ: '', gruppe: '', ort: '', projekt: '', zustand: '' },
      proj: { q: '', status: 'aktiv' }
    }
  };

  M.settings = function () {
    var s = (M.state.data.einstellungen || []).find(function (r) { return r.id === 'global'; });
    return Object.assign({ id: 'global', intervall: { tachymeter: 24, sensor: null, mcc: null }, warnProzent: 90, kuerzel: '' }, s || {});
  };

  /* Ältere Daten (Projekt = Standort) ins neue Modell überführen – nur im Speicher;
     gespeichert wird beim nächsten Bearbeiten des Einsatzes. */
  M.normalize = function (d) {
    window.MonStore.COLLECTIONS.forEach(function (c) { if (!Array.isArray(d[c])) d[c] = []; });
    var P = {};
    d.projekte.forEach(function (p) { P[p.id] = p; });
    d.einsaetze.forEach(function (e) {
      if (!e.amortModus) { e.amortModus = 'pauschal'; e.amortBetrag = e.amortGebucht || 0; }
      if (e.ort) return;
      var p = P[e.projektId];
      if (p && p.typ === 'magazin') { e.ort = 'magazin'; e.magazinId = p.id; e.projektId = null; e.lat = null; e.lng = null; }
      else e.ort = 'feld';
    });
    return d;
  };
  M.setData = function (d) { M.state.data = M.normalize(d); M.bump(); };

  /* ---------- Indizes (pro Datenversion neu) */
  var cache = { v: -1 };
  M.idx = function () {
    if (cache.v === M.state.version) return cache;
    var d = M.state.data;
    cache = { v: M.state.version, kat: {}, proj: {}, ger: {}, ein: {}, wrt: {}, kab: {}, kabByGer: {}, tsOfMcc: {}, members: {}, dat: {}, pos: {}, posByProj: {}, units: {}, derived: {} };
    d.kategorien.forEach(function (k) { cache.kat[k.id] = k; });
    d.projekte.forEach(function (p) { cache.proj[p.id] = p; });
    (d.positionen || []).forEach(function (P) { cache.pos[P.id] = P; (cache.posByProj[P.projektId] = cache.posByProj[P.projektId] || []).push(P); });
    Object.keys(cache.posByProj).forEach(function (k) { cache.posByProj[k].sort(function (a, b) { return String(a.nr || '').localeCompare(String(b.nr || ''), 'de', { numeric: true }); }); });
    d.geraete.forEach(function (g) {
      cache.ger[g.id] = g; cache.ein[g.id] = []; cache.wrt[g.id] = []; cache.kabByGer[g.id] = [];
      if (g.typ === 'tachymeter' && g.mccId) cache.tsOfMcc[g.mccId] = g.id;
    });
    d.geraete.forEach(function (g) { if (g.gruppeId && cache.ger[g.gruppeId]) (cache.members[g.gruppeId] = cache.members[g.gruppeId] || []).push(g.id); });
    Object.keys(cache.members).forEach(function (k) { cache.members[k].sort(function (a, b) { return String(cache.ger[a].name).localeCompare(String(cache.ger[b].name), 'de', { numeric: true }); }); });
    d.einsaetze.forEach(function (e) { (cache.ein[e.geraetId] = cache.ein[e.geraetId] || []).push(e); });
    d.wartungen.forEach(function (w) { (cache.wrt[w.geraetId] = cache.wrt[w.geraetId] || []).push(w); });
    (d.dateien || []).forEach(function (f) { (cache.dat[f.zielId] = cache.dat[f.zielId] || []).push(f); });
    Object.keys(cache.dat).forEach(function (k) { cache.dat[k].sort(function (a, b) { return a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : String(a.name).localeCompare(String(b.name)); }); });
    d.kabel.forEach(function (k) {
      cache.kab[k.id] = k;
      [k.vonId, k.zuId].forEach(function (gid) { if (gid && cache.kabByGer[gid] && cache.kabByGer[gid].indexOf(k) < 0) cache.kabByGer[gid].push(k); });
    });
    Object.keys(cache.ein).forEach(function (k) { cache.ein[k].sort(function (a, b) { return a.von < b.von ? 1 : a.von > b.von ? -1 : (a.bis ? 1 : -1); }); });
    Object.keys(cache.wrt).forEach(function (k) { cache.wrt[k].sort(function (a, b) { return a.datum < b.datum ? 1 : -1; }); });
    return cache;
  };

  M.projName = function (p) { return p ? (p.typ === 'magazin' ? p.name : (p.nummer ? p.nummer + ' ' : '') + p.name) : '–'; };
  /* Amortisation eines Einsatzes: pauschal einmalig, oder pro Monat solange das Gerät dort steht */
  /* ---------- Geplante Laufzeit eines Einsatzes */
  M.addMonths = function (iso, n) {
    var d = new Date(iso + 'T00:00:00'), day = d.getDate();
    var t = new Date(d.getFullYear(), d.getMonth() + (+n || 0), 1);
    var last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(day, last));
    return M.iso(t);
  };
  /* Monate zwischen zwei Daten nach der Abrechnungsregel (mehr als 10 Tage im Kalendermonat = 1), ohne Begrenzung auf heute */
  M.monateZwischen = function (von, bis) {
    if (!von || !bis || bis <= von) return 0;
    var n = 0, y = +von.slice(0, 4), m = +von.slice(5, 7) - 1, guard = 0;
    while (guard++ < 600) {
      var a = M.iso(new Date(y, m, 1)), b = M.iso(new Date(y, m + 1, 1));
      if (a >= bis) break;
      var s = von > a ? von : a, e = bis < b ? bis : b;
      if (e > s && M.days(s, e) > M.MIN_TAGE) n++;
      m++; if (m > 11) { m = 0; y++; }
    }
    return n;
  };
  /* Plan eines Einsatzes: { bis, monate, rest (Tage bis Planende), ueber (Tage überfällig), offen } */
  M.planInfo = function (e) {
    if (!e || e.ort !== 'feld' || !e.planBis) return null;
    var heute = M.today(), laufend = !e.bis;
    var r = { bis: e.planBis, monate: M.monateZwischen(e.von, e.planBis), laufend: laufend };
    if (laufend) {
      if (heute > e.planBis) r.ueber = M.days(e.planBis, heute);
      else r.rest = M.days(heute, e.planBis);
    } else r.diff = M.days(e.planBis, e.bis);   // + = länger als geplant
    return r;
  };
  M.planText = function (e, kurz) {
    var p = M.planInfo(e); if (!p) return '';
    var mo = e.planMonate || p.monate;
    var s = 'geplant bis ' + M.fmtDate(p.bis) + (kurz ? '' : ' (' + mo + (mo === 1 ? ' Monat' : ' Monate') + (e.planMonate && p.monate !== e.planMonate ? ', ' + p.monate + ' abgerechnet' : '') + ')');
    if (p.ueber) s += ' · ' + p.ueber + ' Tage überfällig';
    else if (p.rest !== undefined && !kurz) s += ' · noch ' + (p.rest > 45 ? Math.round(p.rest / 30.4) + ' Monate' : p.rest + ' Tage');
    return s;
  };

  /* Abgerechnete Monate: pro Kalendermonat 1, wenn mehr als 10 Tage in Betrieb, sonst 0 (siehe M.monatsAnteile) */
  function halbeMonate(e, stich) {
    var f = M.monatsAnteile([[e.von, e.bis]], stich), s = 0;
    Object.keys(f).forEach(function (k) { s += f[k]; });
    return s;
  }
  M.halbeMonate = halbeMonate;
  /* Vorhalten-Anteil eines Geräts pro Monat in seiner Position (Set: nach Anschaffungswert verteilt) */
  M.posRate = function (e) {
    var P = e && e.positionId && M.idx().pos[e.positionId];
    if (!P) return null;
    var u = M.unitOf(e), sh = u ? u.anteil[e.geraetId] || 0 : 1;
    return { P: P, u: u, anteil: sh, rate: (M.num(P.V) || 0) * sh };
  };
  M.einsatzAmort = function (e) {
    if (!e || e.ort === 'magazin') return 0;
    // Vor dem Stichtag des Startwerts zählt nichts: das steckt im Startwert
    var gg = M.idx().ger[e.geraetId], stich = gg && gg.amortVorDatum && M.num(gg.amortVor) > 0 ? gg.amortVorDatum : null;
    var pr = M.posRate(e);
    if (pr) return Math.round(pr.rate * halbeMonate(e, stich) * 100) / 100;
    var b = M.num(e.amortBetrag) || 0;
    if (e.amortModus === 'monat') return Math.round(b * halbeMonate(e, stich) * 100) / 100;
    return stich && e.von < stich ? 0 : b;
  };
  M.amortText = function (e) {
    if (!e || e.ort === 'magazin') return 'keine (Magazin)';
    var pr = M.posRate(e);
    if (pr) return M.posLabel(pr.P) + ' · CHF ' + M.chf(pr.rate) + ' pro Monat' + (pr.u && pr.u.devs.length > 1 ? ' (' + Math.round(pr.anteil * 100) + ' % des Sets)' : '') + ' · bisher CHF ' + M.chf(M.einsatzAmort(e));
    var b = M.num(e.amortBetrag) || 0;
    if (!b) return 'keine';
    return e.amortModus === 'monat' ? 'CHF ' + M.chf(b) + ' pro Monat · bisher CHF ' + M.chf(M.einsatzAmort(e)) : 'CHF ' + M.chf(b) + ' pauschal';
  };
  M.lastAmort = function (gid) {
    var e = (M.idx().ein[gid] || []).find(function (x) { return x.ort === 'feld' && M.has(x.amortBetrag) && x.amortModus !== 'position'; });
    return e ? { modus: e.amortModus || 'monat', betrag: e.amortBetrag } : { modus: 'monat', betrag: '' };
  };
  M.magazine = function () { return M.state.data.projekte.filter(function (p) { return p.typ === 'magazin'; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'de'); }); };
  M.projekteAktiv = function () {
    return M.state.data.projekte.filter(function (p) { return p.typ === 'projekt' && p.status !== 'abgeschlossen'; })
      .sort(function (a, b) { return M.projName(a).localeCompare(M.projName(b), 'de', { numeric: true }); });
  };

  /* Ortsbezeichnung eines Einsatzes */
  M.ortText = function (e) {
    if (!e) return 'ohne Standort';
    var I = M.idx();
    if (e.ort === 'magazin') { var m = I.proj[e.magazinId]; return m ? m.name : 'Magazin'; }
    if (e.ortName) return e.ortName;
    if (M.has(e.lat)) return 'LV95 ' + M.fmtLv95(e.lat, e.lng);
    return 'Feld · Position fehlt';
  };

  /* ---------- Abgeleitete Werte je Gerät */
  M.info = function (gid) {
    var I = M.idx();
    if (I.derived[gid]) return I.derived[gid];
    var g = I.ger[gid];
    if (!g) return null;
    var st = M.settings();
    var kat = I.kat[g.kategorieId] || null;
    var gruppe = kat ? kat.gruppe : (g.typ === 'sensor' ? 'erf' : 'geo');
    var pikto = kat ? kat.piktogramm : (g.typ === 'tachymeter' ? 'TS' : g.typ === 'mcc' ? 'MC' : '');
    var members = g.typ === 'messstelle' ? (I.members[gid] || []) : null;
    var ms = g.gruppeId && I.ger[g.gruppeId] && I.ger[g.gruppeId].typ === 'messstelle' ? I.ger[g.gruppeId] : null;
    if (members && members.length) {
      // Symbol der Messstelle = häufigste Kategorie ihrer Geräte
      var cnt = {}, best = null;
      members.forEach(function (m) { var k = I.kat[I.ger[m].kategorieId]; var key = k ? k.id : I.ger[m].typ; cnt[key] = (cnt[key] || 0) + 1; if (!best || cnt[key] > cnt[best]) best = key; });
      var bk = I.kat[best];
      if (bk) { gruppe = bk.gruppe; pikto = bk.piktogramm; kat = null; }
      else if (best === 'tachymeter') { gruppe = 'geo'; pikto = 'TS'; }
    }
    var eins = I.ein[gid] || [];
    var cur = eins.find(function (e) { return !e.bis; }) || null;
    var isMag = !!(cur && cur.ort === 'magazin');
    var mag = isMag ? I.proj[cur.magazinId] || null : null;
    var proj = cur && cur.projektId ? I.proj[cur.projektId] || null : null;
    var pos = null, posSrc = null;
    if (isMag) { if (mag && M.has(mag.lat)) { pos = { lat: mag.lat, lng: mag.lng }; posSrc = 'magazin'; } }
    else if (cur && M.has(cur.lat)) { pos = { lat: cur.lat, lng: cur.lng }; posSrc = 'eigen'; }
    else if (proj && M.has(proj.lat)) { pos = { lat: proj.lat, lng: proj.lng }; posSrc = 'projekt'; }

    var amortSum = M.num(g.amortVor) || 0, projSet = {}, nStandorte = 0;
    eins.forEach(function (e) {
      amortSum += M.einsatzAmort(e);
      if (e.projektId) projSet[e.projektId] = true;
      if (e.ort === 'feld') nStandorte++;
    });
    var restwert = M.has(g.wert) ? Math.max(0, g.wert - amortSum) : null;
    var ertrag = M.has(g.wert) && g.wert > 0 ? Math.max(0, amortSum - g.wert) : 0;

    // Wartung: gezählt werden Tage im Feld, nicht im Magazin
    var wart = null;
    var intervall = M.has(g.wartungIntervall) ? +g.wartungIntervall : (st.intervall ? st.intervall[g.typ] : null);
    if (intervall) {
      var letzte = g.letzteWartung || null;
      (I.wrt[gid] || []).forEach(function (w) { if (!letzte || w.datum > letzte) letzte = w.datum; });
      var start = letzte || (eins.length ? eins[eins.length - 1].von : g.kaufdatum) || M.today();
      var heute = M.today(), tage = 0;
      eins.forEach(function (e) {
        if (e.ort !== 'feld') return;
        var a = e.von > start ? e.von : start;
        var b = e.bis && e.bis < heute ? e.bis : heute;
        if (b > a) tage += M.days(a, b);
      });
      var limit = Math.round(intervall * 30.4375);
      wart = { letzte: letzte, intervall: intervall, tage: tage, limit: limit, pct: limit ? tage / limit : 0 };
      wart.faellig = wart.pct >= (st.warnProzent || 90) / 100;
      wart.rest = limit - tage;
    }

    var mccTs = g.typ === 'mcc' && I.tsOfMcc[gid] ? I.ger[I.tsOfMcc[gid]] : null;
    var ortFehlt = !!(cur && !isMag && posSrc !== 'eigen' && !mccTs);
    var mccFehlt = g.typ === 'tachymeter' && !!cur && !isMag && !g.mccId && g.zustand !== 'defekt' && g.zustand !== 'ausgemustert';

    var state = 'ok';
    if (g.zustand === 'defekt' || g.zustand === 'ausgemustert') state = 'defekt';
    else if (wart && wart.faellig) state = 'wartung';
    else if (isMag) state = 'magazin';
    else if (ortFehlt) state = 'ort';
    else if (mccFehlt) state = 'mcc';
    var issue = state === 'wartung' || state === 'ort' || mccFehlt;

    var info = {
      g: g, kat: kat, gruppe: gruppe, pikto: pikto, kuerzel: kat ? kat.kuerzel : '',
      cur: cur, proj: proj, mag: mag, isMag: isMag, pos: pos, posSrc: posSrc,
      ortText: cur ? M.ortText(cur) : 'ohne Standort',
      eins: eins, amortSum: amortSum, nProjekte: Object.keys(projSet).length, nStandorte: nStandorte, restwert: restwert, ertrag: ertrag,
      wart: wart, state: state, issue: issue, ortFehlt: ortFehlt, mccFehlt: mccFehlt, mccTs: mccTs, members: members, ms: ms,
      kabel: I.kabByGer[gid] || []
    };
    I.derived[gid] = info;
    return info;
  };

  /* Amortisationsverlauf: Startwert vor Erfassung + Beiträge je Standort, Abbezahlt-Datum, Prognose */
  M.amortInfo = function (gid) {
    var i = M.info(gid), g = i.g, heute = M.today();
    var wert = M.num(g.wert) || 0, vor = M.num(g.amortVor) || 0;
    var chron = i.eins.slice().sort(function (a, b) { return a.von < b.von ? -1 : 1; });
    // Startwert nur, wenn ein Betrag erfasst ist; sonst zählt alles ab dem ersten Einsatz
    var first = (chron.length ? chron[0].von : g.kaufdatum) || heute;
    var vorDatum = vor > 0 ? (g.amortVorDatum || first) : first;
    var DAY = 86400000, t = function (s) { return new Date(s + 'T00:00:00').getTime(); };
    var cum = vor, be = null, beRow = -1, pts = [[t(vorDatum), vor]], rows = [];
    if (vor > 0) rows.push({ kind: 'vor', von: null, bis: vorDatum, ort: 'vor Erfassung in MonInv', proj: null, ansatz: 'Startwert', tage: null, betrag: vor, kum: vor });
    var feld = 0, mag = 0;
    chron.forEach(function (e) {
      var bis = e.bis && e.bis < heute ? e.bis : heute;
      if (bis <= vorDatum && e.von < vorDatum) return;   // ganz vor dem Startwert: steckt darin
      var von0 = e.von;
      if (e.von < vorDatum) { e = Object.assign({}, e, { von: vorDatum }); }
      var tage = Math.max(0, M.days(e.von, bis)), before = cum, amt = M.einsatzAmort(Object.assign({}, e, { von: von0 }));
      var pr = M.posRate(e), mon = e.amortModus === 'monat' || !!pr;
      var b = pr ? pr.rate : M.num(e.amortBetrag) || 0, imStart = e.ort !== 'magazin' && !mon && von0 < vorDatum && b > 0;
      if (e.ort === 'magazin') { mag += tage; pts.push([t(e.von), cum], [t(bis), cum]); }
      else if (mon) {
        feld += tage; pts.push([t(e.von), cum]); cum += amt; pts.push([t(bis), cum]);
        if (wert && !be && before < wert && cum >= wert && b) be = t(e.von) + (wert - before) / (b / 30.4375) * DAY;
      } else {
        feld += tage; pts.push([t(e.von), cum]); cum += amt; pts.push([t(e.von), cum], [t(bis), cum]);
        if (wert && !be && before < wert && cum >= wert) be = t(e.von);
      }
      if (wert && beRow < 0 && before < wert && cum >= wert) beRow = rows.length;
      rows.push({ kind: e.ort === 'magazin' ? 'mag' : (pr ? 'monat' : e.amortModus), e: e, von: e.von, bis: e.bis, ort: M.ortText(e), proj: e.projektId ? M.idx().proj[e.projektId] : null,
        ansatz: e.ort === 'magazin' ? 'Magazin · nichts' : pr ? M.posLabel(pr.P) + ' · CHF ' + M.chf(Math.round(b * 100) / 100) + ' pro Monat' + (pr.u && pr.u.devs.length > 1 ? ' (' + Math.round(pr.anteil * 100) + ' % des Sets)' : '') : (e.amortModus === 'monat' ? 'CHF ' + M.chf(b) + ' pro Monat' : 'CHF ' + M.chf(b) + ' pauschal' + (imStart ? ' – vor dem ' + M.fmtDate(vorDatum) + ' gesetzt, im Startwert enthalten' : '')), tage: tage, betrag: e.ort === 'magazin' ? null : amt, kum: cum });
    });
    if (wert && vor >= wert && !be) { be = t(vorDatum); beRow = 0; }
    var cpr = i.cur && M.posRate(i.cur);
    var cur = i.cur, rate = cpr ? cpr.rate : cur && cur.ort === 'feld' && cur.amortModus === 'monat' ? M.num(cur.amortBetrag) || 0 : 0;
    var offen = Math.max(0, wert - cum), ertrag = wert ? Math.max(0, cum - wert) : 0;
    var prog = !be && wert && rate ? t(heute) + offen / (rate / 30.4375) * DAY : null;
    var seit = Math.max(1, M.days(vorDatum, heute));
    return { wert: wert, vor: vor, vorDatum: vorDatum, kauf: g.kaufdatum || null, total: cum, offen: offen, ertrag: ertrag,
      be: be ? M.iso(new Date(be)) : null, prog: prog ? M.iso(new Date(prog)) : null, rate: rate, rows: rows, beRow: beRow, pts: pts,
      feld: feld, mag: mag, auslastung: Math.round(feld / seit * 100) };
  };

  M.symbol = function (gid, size, extra) {
    var i = M.info(gid);
    if (!i) return '';
    var html = S.symbolHtml(i.gruppe, i.pikto, Object.assign({ size: size || 28, state: i.state, kuerzel: i.kuerzel || i.g.name }, extra || {}));
    if (i.members) html = '<span class="ms-sym">' + html + '<span class="ms-n">' + i.members.length + '</span></span>';
    return html;
  };

  M.stateLabel = {
    ok: ['Im Einsatz', 'chip-ok'], wartung: ['Wartung fällig', 'chip-warn'], ort: ['Position fehlt', 'chip-ort'],
    magazin: ['Im Magazin', 'chip-mag'], defekt: ['Defekt', 'chip-off'], mcc: ['MCC fehlt', 'chip-warn']
  };
  M.stateChip = function (gid) {
    var i = M.info(gid);
    var s = i.g.zustand === 'ausgemustert' ? ['Ausgemustert', 'chip-off'] : M.stateLabel[i.state];
    return '<span class="chip ' + s[1] + '">' + s[0] + '</span>';
  };
  M.typLabel = { sensor: 'Geotechnischer Sensor', tachymeter: 'Tachymeter', mcc: 'MCC TSC', messstelle: 'Messstelle' };
  M.isGeraet = function (g) { return g && g.typ !== 'messstelle'; };
  M.kabelTypen = {
    strom:  { name: 'Stromkabel',  color: '#F4A261', dash: null },
    signal: { name: 'Signalkabel', color: '#F4A261', dash: '10 6' },
    glas:   { name: 'Glasfaser',   color: '#F4A261', dash: '2 6' },
    andere: { name: 'Sonstiges',   color: '#F4A261', dash: '14 5 2 5' }
  };

  M.userKuerzel = function () {
    var s = M.settings();
    return (M.store && M.store.userName) || s.kuerzel || '';
  };

  /* ---------- Rollen: Admin (alles), User (ohne Finanzen), Sekretariat (Finanzen sehen, nichts ändern)
     Admins stehen fest in config.js (admins: […]); weitere Rollen trägt ein Admin unter Einstellungen › Benutzer ein.
     Wer nicht eingetragen ist, gilt als User. Im lokalen Testbetrieb ist man Admin. */
  M.ROLLEN = {
    admin: { name: 'Admin', text: 'alles, inkl. Benutzer und Rollen' },
    user: { name: 'User', text: 'alles ausser Finanzen (Werte, Amortisation, Offerte, Abrechnung, Kosten)' },
    sekretariat: { name: 'Sekretariat', text: 'alles sehen inkl. Finanzen, aber nichts ändern' }
  };
  M.ROLLEN_ORDER = ['admin', 'user', 'sekretariat'];
  function lc(x) { return String(x || '').trim().toLowerCase(); }
  M.userEmail = function () { return lc(M.store && M.store.userEmail); };
  M.cfgAdmins = function () { var c = window.MONINV_CONFIG || {}; return (Array.isArray(c.admins) ? c.admins : []).map(lc).filter(Boolean); };
  M.realRole = function () {
    if (!M.store || M.store.mode !== 'sharepoint') return 'admin';
    var mail = M.userEmail(), admins = M.cfgAdmins(), rollen = M.settings().rollen || {};
    if (mail && admins.indexOf(mail) >= 0) return 'admin';
    var r = rollen[mail];
    if (r && M.ROLLEN[r]) return r;
    // Übergang: solange niemand als Admin bestimmt ist, sind alle Admin (sonst könnte sich niemand einrichten)
    if (!admins.length && !Object.keys(rollen).some(function (k) { return rollen[k] === 'admin'; })) return 'admin';
    return 'user';
  };
  /* Admins können die App als User oder Sekretariat ansehen (nur in diesem Tab, zum Prüfen) */
  M.role = function () {
    var real = M.realRole(), t = M.state.roleTest;
    return real === 'admin' && t && M.ROLLEN[t] ? t : real;
  };
  M.can = function (what) {
    var r = M.role();
    if (what === 'fin') return r !== 'user';
    if (what === 'edit') return r !== 'sekretariat';
    if (what === 'admin') return r === 'admin';
    return true;
  };
  /* Rolle einer Person setzen (null = Eintrag entfernen). Nur Admin. */
  M.setRolle = function (mail, rolle) {
    if (M.realRole() !== 'admin') { M.toast('Nur Admins können Rollen vergeben.', 'err'); return Promise.resolve(); }
    var s = M.copy(M.settings()), r = Object.assign({}, s.rollen || {});
    mail = lc(mail);
    if (rolle && M.ROLLEN[rolle]) r[mail] = rolle; else delete r[mail];
    s.rollen = r;
    var me = M.userEmail();
    // sich selbst nicht aussperren: der letzte Admin (ohne Eintrag in config.js) bleibt Admin
    if (me === mail && rolle !== 'admin' && M.cfgAdmins().indexOf(me) < 0 && M.store.mode === 'sharepoint') {
      M.toast('Die eigene Admin-Rolle kann man nicht selbst entfernen.', 'err'); return Promise.resolve();
    }
    return M.put('einstellungen', s).then(function () { M.refreshUI(); });
  };
  M.denied = function () { M.toast('Nur lesen: Als ' + M.ROLLEN[M.role()].name + ' können Sie nichts ändern.', 'err'); };

  /* ---------- Daten ändern */
  M.bump = function () { M.state.version++; };

  M.put = function (col, rec) {
    // Nur lesen: nichts speichern. Ohne Meldung, weil auch Hintergrund-Ergänzungen (z.B. Ortsname) hier landen;
    // Klicks auf Bearbeiten-Aktionen meldet schon der Wächter in app.js.
    if (!M.can('edit')) { console.info('MonInv: nur lesen, nicht gespeichert', col, rec && rec.id); return Promise.resolve(); }
    // Rollen ändert nur ein Admin – andere behalten beim Speichern der Einstellungen die bestehende Liste
    if (col === 'einstellungen' && rec && rec.id === 'global' && M.realRole() !== 'admin') {
      var cur = (M.state.data.einstellungen || []).find(function (r) { return r.id === 'global'; });
      rec = Object.assign({}, rec, { rollen: cur && cur.rollen ? cur.rollen : rec.rollen });
      if (!cur || !cur.rollen) delete rec.rollen;
    }
    var arr = M.state.data[col];
    var i = arr.findIndex(function (r) { return r.id === rec.id; });
    if (i >= 0) arr[i] = rec; else arr.push(rec);
    M.bump();
    return M.store.save(col, rec).catch(M.failed);
  };
  M.del = function (col, id) {
    if (!M.can('edit')) { console.info('MonInv: nur lesen, nicht gelöscht', col, id); return Promise.resolve(); }
    M.state.data[col] = M.state.data[col].filter(function (r) { return r.id !== id; });
    M.bump();
    return M.store.remove(col, id).catch(M.failed);
  };
  M.failed = function (e) {
    console.error(e);
    M.toast('Nicht gespeichert: ' + (e && e.message ? e.message : 'unbekannter Fehler'), 'err');
  };
  M.copy = function (o) { return JSON.parse(JSON.stringify(o)); };

  /* Gerät an neuen Standort und/oder in ein anderes Projekt.
     t = { ort: 'feld'|'magazin', magazinId, projektId, lat, lng, ortName } */
  M.move = function (gid, t, datum, opts) {
    opts = opts || {};
    var I = M.idx(), g = I.ger[gid];
    if (!g) return Promise.resolve();
    var wer = M.has(opts.wer) ? opts.wer : M.userKuerzel();
    var feld = t.ort !== 'magazin';
    var pre = [];
    if (g.gruppeId && !opts.viaGruppe) { var gx = M.copy(g); gx.gruppeId = null; pre.push(M.put('geraete', gx)); g = gx; }
    var target = {
      ort: feld ? 'feld' : 'magazin',
      magazinId: feld ? null : t.magazinId,
      projektId: feld ? (t.projektId || null) : null,
      lat: feld && M.has(t.lat) ? t.lat : null,
      lng: feld && M.has(t.lng) ? t.lng : null,
      ortName: feld ? (t.ortName || '') : ''
    };
    var jobs = [];
    var eins = I.ein[gid] || [];
    var cur = eins.find(function (e) { return !e.bis; });
    // Auftragsnummer (Teilprojekt): angegeben, sonst bei gleichem Projekt die bisherige
    target.auftrag = feld ? (M.has(t.auftrag) ? t.auftrag : (cur && (cur.projektId || null) === target.projektId ? cur.auftrag || '' : '')) : '';
    // Offertposition und Einheit (Set): angegeben, sonst bei gleichem Projekt die bisherige
    var sameProj = cur && cur.ort === 'feld' && (cur.projektId || null) === target.projektId;
    target.positionId = feld && target.projektId ? (t.positionId !== undefined ? (t.positionId || null) : (sameProj ? cur.positionId || null : null)) : null;
    target.einheit = target.positionId ? (t.positionId !== undefined ? (t.einheit || null) : (sameProj ? cur.einheit || null : null)) : null;
    // Tachymeter und seine MCC bilden zusammen eine Einheit
    if (target.positionId && !target.einheit && g.typ === 'tachymeter' && g.mccId) target.einheit = M.uid('set');
    // Geplante Laufzeit: angegeben (Monate ab Datum oder bis Datum), sonst bei gleichem Projekt die bisherige
    if (!feld) { target.planBis = null; target.planMonate = null; }
    else if (t.planMonate) { target.planMonate = +t.planMonate; target.planBis = M.addMonths(datum, +t.planMonate); }
    else if (t.planBis !== undefined) { target.planBis = t.planBis || null; target.planMonate = null; }
    else { target.planBis = sameProj ? cur.planBis || null : null; target.planMonate = sameProj ? cur.planMonate || null : null; }
    if (cur) {
      if (cur.ort === target.ort && (cur.magazinId || null) === target.magazinId && (cur.projektId || null) === target.projektId &&
        cur.lat === target.lat && cur.lng === target.lng) {
        // gleicher Ort: Laufzeit in Monaten ab dem bisherigen Einsatzbeginn
        if (t.planMonate) target.planBis = M.addMonths(cur.von, +t.planMonate);
        var ch = (cur.auftrag || '') !== target.auftrag || (cur.positionId || null) !== target.positionId || (cur.einheit || null) !== target.einheit || (cur.planBis || null) !== (target.planBis || null);
        if (ch) {
          var ca = M.copy(cur); ca.auftrag = target.auftrag; ca.positionId = target.positionId; ca.einheit = target.einheit; ca.planBis = target.planBis || null; ca.planMonate = target.planMonate || null;
          if (target.positionId) { ca.amortModus = 'position'; ca.amortBetrag = 0; }
          var j2 = [M.put('einsaetze', ca)];
          if (g.typ === 'tachymeter' && g.mccId) j2.push(M.followTo(g.mccId, target, datum, wer));
          return Promise.all(j2);
        }
        return Promise.resolve();
      }
      var c = M.copy(cur);
      c.bis = datum < cur.von ? cur.von : datum;
      c.geholtVon = wer;
      jobs.push(M.put('einsaetze', c));
    }
    // Amortisation pro Standort: frei wählbarer Betrag pro Monat oder pauschal; im Magazin keine.
    // Ohne Angabe gelten die Werte des letzten Feld-Standorts dieses Geräts.
    var la = M.lastAmort(gid);
    var aModus = t.amortModus || la.modus || 'monat';
    var aBetrag = M.has(t.amortBetrag) ? +t.amortBetrag : (M.num(la.betrag) || 0);
    var neu = Object.assign({
      id: M.uid('ein'), geraetId: gid, von: datum, bis: null, gesetztVon: wer, geholtVon: '',
      amortModus: feld && g.typ !== 'messstelle' ? aModus : 'pauschal', amortBetrag: feld && g.typ !== 'messstelle' ? aBetrag : 0,
      bemerkung: opts.bemerkung || ''
    }, target);
    if (target.positionId) { neu.amortModus = 'position'; neu.amortBetrag = 0; }
    jobs.push(M.put('einsaetze', neu));
    if (feld && M.has(neu.lat) && !neu.ortName) M.fillOrtName(neu.id);

    // MCC begleitet ihren Tachymeter
    if (g.typ === 'tachymeter' && g.mccId) {
      if (feld) jobs.push(M.move(g.mccId, target, datum, { wer: wer }));
      else {
        var gg = M.copy(g); gg.mccId = null;
        jobs.push(M.put('geraete', gg));
        if (opts.mitMcc !== false) jobs.push(M.move(g.mccId, target, datum, { wer: wer }));
      }
    }
    // Geräte einer Messstelle folgen ihr
    if (g.typ === 'messstelle') {
      (I.members[gid] || []).forEach(function (mid, n) {
        var a = opts.memberAmort ? opts.memberAmort(mid, n) : null;
        jobs.push(M.followTo(mid, Object.assign({}, target, a || {}), datum, wer, !!a));
      });
    }
    return Promise.all(pre.concat(jobs));
  };

  /* Ein Gerät an den Ort seiner Messstelle bringen: gleicher Standort/Projekt → nur Position, sonst Projektwechsel */
  M.followTo = function (mid, target, datum, wer, force) {
    var cur = (M.idx().ein[mid] || []).find(function (e) { return !e.bis; });
    var same = cur && cur.ort === target.ort && (cur.magazinId || null) === (target.magazinId || null) && (cur.projektId || null) === (target.projektId || null);
    if (same && !force) {
      var chg = (M.has(target.auftrag) && (cur.auftrag || '') !== target.auftrag) || (target.positionId !== undefined && ((cur.positionId || null) !== (target.positionId || null) || (cur.einheit || null) !== (target.einheit || null))) ||
        (target.planBis !== undefined && (cur.planBis || null) !== (target.planBis || null));
      if (chg) {
        var ca = M.copy(cur);
        if (target.planBis !== undefined) { ca.planBis = target.planBis || null; ca.planMonate = target.planMonate || null; }
        if (M.has(target.auftrag)) ca.auftrag = target.auftrag;
        if (target.positionId !== undefined) { ca.positionId = target.positionId || null; ca.einheit = target.einheit || null; if (ca.positionId) { ca.amortModus = 'position'; ca.amortBetrag = 0; } }
        M.put('einsaetze', ca);
      }
      if (target.ort === 'feld' && M.has(target.lat) && (cur.lat !== target.lat || cur.lng !== target.lng)) return M.setPos(mid, target.lat, target.lng, { viaGruppe: true });
      return Promise.resolve();
    }
    return M.move(mid, target, datum, { wer: wer, viaGruppe: true });
  };

  /* Messstellen: mehrere Geräte symbolisch an einer Stelle */
  M.createGruppe = function (name, ids, bemerkung) {
    var I = M.idx();
    var ref = ids.map(function (id) { return M.info(id); }).find(function (i) { return i.cur && !i.isMag && M.has(i.cur.lat); }) ||
      ids.map(function (id) { return M.info(id); }).find(function (i) { return i.cur; });
    var ms = { id: M.uid('ger'), name: name, typ: 'messstelle', zustand: 'aktiv', bemerkung: bemerkung || '', extra: {} };
    return M.put('geraete', ms).then(function () {
      return Promise.all(ids.map(function (id) { var c = M.copy(M.idx().ger[id]); c.gruppeId = ms.id; return M.put('geraete', c); }));
    }).then(function () {
      if (!ref || !ref.cur) return null;
      var c = ref.cur;
      return M.move(ms.id, { ort: c.ort, magazinId: c.magazinId, projektId: c.projektId, lat: c.lat, lng: c.lng, ortName: c.ortName }, M.today(), {});
    }).then(function () { return ms.id; });
  };
  M.addToGruppe = function (msId, ids) {
    var cur = (M.idx().ein[msId] || []).find(function (e) { return !e.bis; });
    return Promise.all(ids.map(function (id) { var c = M.copy(M.idx().ger[id]); c.gruppeId = msId; return M.put('geraete', c); })).then(function () {
      if (!cur) return null;
      var t = { ort: cur.ort, magazinId: cur.magazinId, projektId: cur.projektId, lat: cur.lat, lng: cur.lng, ortName: cur.ortName };
      return Promise.all(ids.map(function (id) { return M.followTo(id, t, M.today(), M.userKuerzel()); }));
    });
  };
  /* Geräte einer Position zuweisen (laufender Einsatz, ohne neuen Historien-Eintrag).
     pid leer = Position entfernen. Set: einheit für alle gleich; MCC geht mit ihrem Tachymeter. */
  M.setPosition = function (ids, pid, einheit) {
    var I = M.idx(), P = pid ? I.pos[pid] : null, jobs = [], done = {};
    function one(id, key) {
      if (done[id]) return; done[id] = 1;
      var cur = (I.ein[id] || []).find(function (e) { return !e.bis; });
      if (!cur || cur.ort !== 'feld') return;
      var c = M.copy(cur);
      if (P) {
        if ((cur.positionId || null) === P.id && (cur.einheit || null) === (key || null)) return;
        c.positionId = P.id; c.einheit = key || null; c.amortModus = 'position'; c.amortBetrag = 0;
      } else {
        if (!cur.positionId) return;
        c.positionId = null; c.einheit = null; c.amortModus = 'monat'; c.amortBetrag = 0;
      }
      jobs.push(M.put('einsaetze', c));
    }
    ids.map(function (id) { var g = I.ger[id]; return g && g.typ === 'mcc' && I.tsOfMcc[id] ? I.tsOfMcc[id] : id; }).forEach(function (id) {
      var g = I.ger[id]; if (!g) return;
      var key = P ? (P.art === 'set' ? einheit : (g.typ === 'tachymeter' && g.mccId ? 'ts-' + id : null)) : null;
      one(id, key);
      if (g.typ === 'tachymeter' && g.mccId) one(g.mccId, key);
    });
    return Promise.all(jobs);
  };
  M.deletePosition = function (pid) {
    var jobs = [];
    M.state.data.einsaetze.forEach(function (e) {
      if (e.positionId !== pid) return;
      var c = M.copy(e); c.positionId = null; c.einheit = null; if (c.amortModus === 'position') { c.amortModus = 'monat'; c.amortBetrag = 0; }
      jobs.push(M.put('einsaetze', c));
    });
    jobs.push(M.del('positionen', pid));
    return Promise.all(jobs);
  };

  /* Geplante Laufzeit am laufenden Einsatz setzen (ohne Historien-Eintrag); MCC folgt ihrem Tachymeter */
  M.setPlan = function (ids, t) {
    var I = M.idx(), jobs = [], done = {};
    function one(id) {
      if (done[id]) return; done[id] = 1;
      var cur = (I.ein[id] || []).find(function (e) { return !e.bis; });
      if (!cur || cur.ort !== 'feld') return;
      var c = M.copy(cur);
      if (t.planMonate) { c.planMonate = +t.planMonate; c.planBis = M.addMonths(cur.von, +t.planMonate); }
      else { c.planBis = t.planBis || null; c.planMonate = null; }
      if ((cur.planBis || null) === (c.planBis || null) && (cur.planMonate || null) === (c.planMonate || null)) return;
      jobs.push(M.put('einsaetze', c));
    }
    ids.forEach(function (id) { var g = I.ger[id]; if (!g) return; one(id); if (g.typ === 'tachymeter' && g.mccId) one(g.mccId); });
    return Promise.all(jobs);
  };

  /* Auftragsnummer am laufenden Einsatz setzen, ohne neuen Historien-Eintrag */
  M.setAuftrag = function (ids, nr) {
    var I = M.idx(), jobs = [];
    ids.forEach(function (id) {
      var cur = (I.ein[id] || []).find(function (e) { return !e.bis; });
      if (!cur || cur.ort !== 'feld' || (cur.auftrag || '') === nr) return;
      var c = M.copy(cur); c.auftrag = nr; jobs.push(M.put('einsaetze', c));
    });
    return Promise.all(jobs);
  };
  M.removeFromGruppe = function (ids) {
    return Promise.all(ids.map(function (id) { var c = M.copy(M.idx().ger[id]); c.gruppeId = null; return M.put('geraete', c); }));
  };

  M.fillOrtName = function (eid) {
    var e = M.state.data.einsaetze.find(function (x) { return x.id === eid; });
    if (!e || !M.has(e.lat)) return;
    M.gemeinde(e.lat, e.lng).then(function (name) {
      if (!name) return;
      var cur = M.state.data.einsaetze.find(function (x) { return x.id === eid; });
      if (!cur || !M.has(cur.lat)) return;
      var c = M.copy(cur); c.ortName = name;
      M.put('einsaetze', c).then(function () { if (M.softRefresh) M.softRefresh(); });
    });
  };

  /* Fehlende Ortsnamen (z.B. aus älteren Daten) im Hintergrund nachtragen */
  M.fillMissingOrt = function () {
    var todo = M.state.data.einsaetze.filter(function (e) { return !e.bis && e.ort === 'feld' && M.has(e.lat) && !e.ortName; }).slice(0, 80);
    var i = 0;
    (function next() {
      if (i >= todo.length) return;
      var e = todo[i++];
      M.gemeinde(e.lat, e.lng).then(function (name) {
        var cur = M.state.data.einsaetze.find(function (x) { return x.id === e.id; });
        if (name && cur && !cur.ortName && cur.lat === e.lat) { var c = M.copy(cur); c.ortName = name; M.put('einsaetze', c); }
        if (i % 10 === 0 || i === todo.length) M.softRefresh();
        setTimeout(next, 120);
      });
    })();
  };

  M.setPos = function (gid, lat, lng, opts) {
    opts = opts || {};
    var I = M.idx();
    var gg0 = I.ger[gid];
    if (gg0 && gg0.gruppeId && !opts.viaGruppe) { var gx = M.copy(gg0); gx.gruppeId = null; M.put('geraete', gx); I = M.idx(); }
    var cur = (I.ein[gid] || []).find(function (e) { return !e.bis; });
    if (!cur) return M.move(gid, { ort: 'feld', lat: lat, lng: lng }, M.today(), { viaGruppe: opts.viaGruppe });
    var c = M.copy(cur);
    if (c.ort === 'magazin') return M.move(gid, { ort: 'feld', lat: lat, lng: lng }, M.today(), { viaGruppe: opts.viaGruppe });
    c.lat = lat; c.lng = lng; c.ortName = '';
    var jobs = [M.put('einsaetze', c)];
    M.fillOrtName(c.id);
    var g = I.ger[gid];
    if (g && g.typ === 'tachymeter' && g.mccId) jobs.push(M.setPos(g.mccId, lat, lng));
    if (g && g.typ === 'messstelle') (I.members[gid] || []).forEach(function (mid) { jobs.push(M.setPos(mid, lat, lng, { viaGruppe: true })); });
    return Promise.all(jobs);
  };

  /* Nächste freie Namen: «IN-03» → IN-04, IN-05 … (vorhandene Namen werden übersprungen) */
  M.nextNames = function (name, n) {
    var taken = {};
    M.state.data.geraete.forEach(function (g) { taken[String(g.name).toLowerCase()] = true; });
    var m = String(name).match(/^(.*?)(\d+)(\D*)$/);
    var out = [], i = 0, guard = 0;
    if (!m) {
      while (out.length < n && guard++ < 1000) { i++; var c = name + ' (' + (i + 1) + ')'; if (!taken[c.toLowerCase()]) { out.push(c); taken[c.toLowerCase()] = true; } }
      return out;
    }
    var pre = m[1], num = parseInt(m[2], 10), width = m[2].length, post = m[3];
    while (out.length < n && guard++ < 5000) {
      num++;
      var s = String(num); while (s.length < width) s = '0' + s;
      var nm = pre + s + post;
      if (!taken[nm.toLowerCase()]) { out.push(nm); taken[nm.toLowerCase()] = true; }
    }
    return out;
  };

  /* Duplizieren. f = gewählte Attribute { hersteller, seriennummer, kaufdatum, wert, amort, sim, wartung, extra, bemerkung, ort, position, projekt } */
  M.DUP_FELDER = [
    ['hersteller', 'Hersteller', true], ['gtyp', 'Typ', true], ['kaufdatum', 'Kaufdatum', true], ['wert', 'Anschaffungswert', true],
    ['vor', 'Bereits amortisiert vor Erfassung', true], ['amort', 'Amortisation des Standorts', true], ['extra', 'Zusatzfelder', true], ['bemerkung', 'Bemerkung', true], ['wartung', 'Wartung (letzte, Intervall)', true],
    ['seriennummer', 'Seriennummer', false], ['sim', 'SIM-Karte', false],
    ['ort', 'Standort (Feld oder Magazin)', true], ['position', 'Gleiche Position', false], ['projekt', 'Projekt', true]
  ];
  M.duplicate = function (gid, n, f) {
    var I = M.idx(), g = I.ger[gid], info = M.info(gid);
    var names = M.nextNames(g.name, n);
    var jobs = [];
    names.forEach(function (nm) {
      var c = { id: M.uid('ger'), name: nm, typ: g.typ, kategorieId: g.kategorieId, zustand: 'aktiv', extra: {} };
      if (f.hersteller) c.hersteller = g.hersteller || '';
      if (f.gtyp) c.gtyp = g.gtyp || '';
      if (f.kaufdatum) c.kaufdatum = g.kaufdatum || '';
      if (f.wert) c.wert = g.wert;
      if (f.vor && M.has(g.amortVor)) { c.amortVor = g.amortVor; c.amortVorDatum = g.amortVorDatum || ''; }
      if (f.extra) c.extra = M.copy(g.extra || {});
      if (f.bemerkung) c.bemerkung = g.bemerkung || '';
      if (f.wartung) { c.letzteWartung = g.letzteWartung || ''; c.wartungIntervall = g.wartungIntervall; }
      if (f.seriennummer) c.seriennummer = g.seriennummer || '';
      if (f.sim) c.sim = g.sim || '';
      jobs.push(M.put('geraete', c));
      if (info.cur && (f.ort || f.projekt)) {
        var cur = info.cur, t;
        if (f.ort && cur.ort === 'magazin') t = { ort: 'magazin', magazinId: cur.magazinId };
        else t = { ort: 'feld', projektId: f.projekt ? cur.projektId : null, lat: f.ort && f.position ? cur.lat : null, lng: f.ort && f.position ? cur.lng : null, ortName: f.ort && f.position ? cur.ortName : '' };
        if (t.ort === 'feld' && !f.ort && !t.projektId) return;
        jobs.push(M.put('einsaetze', Object.assign({
          id: M.uid('ein'), geraetId: c.id, von: M.today(), bis: null, gesetztVon: M.userKuerzel(), geholtVon: '',
          amortModus: f.amort && cur.ort === 'feld' ? (cur.amortModus || 'monat') : 'monat', amortBetrag: f.amort && cur.ort === 'feld' ? (cur.amortBetrag || 0) : 0,
          magazinId: null, projektId: null, lat: null, lng: null, ortName: ''
        }, t)));
      }
    });
    return Promise.all(jobs).then(function () { return names; });
  };

  /* Gerät mit allem löschen. Kabel bleiben, verlieren aber die Verbindung. */
  M.deleteGeraetData = function (gid) {
    var I = M.idx(), jobs = [];
    (I.ein[gid] || []).forEach(function (e) { jobs.push(M.del('einsaetze', e.id)); });
    (I.wrt[gid] || []).forEach(function (w) { jobs.push(M.del('wartungen', w.id)); });
    (I.dat[gid] || []).forEach(function (f) { jobs.push(M.deleteFile(f.id)); });
    M.state.data.geraete.forEach(function (t) {
      if (t.mccId === gid || t.gruppeId === gid) { var c = M.copy(t); if (c.mccId === gid) c.mccId = null; if (c.gruppeId === gid) c.gruppeId = null; jobs.push(M.put('geraete', c)); }
    });
    M.state.data.kabel.forEach(function (k) {
      if (k.vonId === gid || k.zuId === gid) { var c = M.copy(k); if (c.vonId === gid) c.vonId = null; if (c.zuId === gid) c.zuId = null; jobs.push(M.put('kabel', c)); }
    });
    jobs.push(M.del('geraete', gid));
    if (M.state.sel === gid) M.state.sel = null;
    if (M.state.drawer === gid) M.state.drawer = null;
    return Promise.all(jobs);
  };

  /* ---------- Abrechnung pro Projekt nach Offertpositionen
     Pro Kalendermonat: mehr als 10 Tage in Betrieb = ganzer Monat, sonst nichts (M.MIN_TAGE).
     Gruppen: Geodätisch (geo), Geotechnisch (erf), Sensor (alle übrigen). */
  M.ABR_GRUPPEN = { geo: { n: 'Geodätisch', c: '#1F5FAE', l: '#DCE7F6', t: '#123E78' }, erf: { n: 'Geotechnisch', c: '#B04A6E', l: '#F6DCE5', t: '#7E2A3E' }, sen: { n: 'Sensor', c: '#2E8B5E', l: '#DDEFE5', t: '#1D5B3F' } };
  M.ABR_ORDER = ['geo', 'erf', 'sen'];
  M.abrGruppeOf = function (gid) { var g = M.info(gid).gruppe; return g === 'geo' ? 'geo' : g === 'erf' ? 'erf' : 'sen'; };
  M.monate = function (von, bis) {   // 'YYYY-MM' … 'YYYY-MM'
    var out = [], y = +von.slice(0, 4), m = +von.slice(5, 7), Y = +bis.slice(0, 4), Mo = +bis.slice(5, 7), guard = 0;
    while ((y < Y || (y === Y && m <= Mo)) && guard++ < 240) { out.push(y + '-' + (m < 10 ? '0' : '') + m); m++; if (m > 12) { m = 1; y++; } }
    return out;
  };
  function monatEnde(mk) { var y = +mk.slice(0, 4), m = +mk.slice(5, 7); return M.iso(new Date(y, m, 1)); }   // erster Tag des Folgemonats
  function morgen() { return M.iso(new Date(new Date(M.today() + 'T00:00:00').getTime() + 86400000)); }
  M.MIN_TAGE = 10;   // mehr als so viele Tage im Kalendermonat = ganzer Monat, sonst 0
  /* Tage je Kalendermonat, die eine Liste von Zeiträumen [von, bis) abdeckt (Überlappungen zählen einmal) */
  M.monatsTage = function (iv, abDatum) {
    var end0 = morgen(), list = iv.map(function (x) { var a = x[0], b = x[1] && x[1] < end0 ? x[1] : end0; if (abDatum && a < abDatum) a = abDatum; return [a, b]; })
      .filter(function (x) { return x[0] < x[1]; }).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
    var merged = [];
    list.forEach(function (x) { var l = merged[merged.length - 1]; if (l && x[0] <= l[1]) { if (x[1] > l[1]) l[1] = x[1]; } else merged.push([x[0], x[1]]); });
    var out = {};
    merged.forEach(function (x) {
      var mk = x[0].slice(0, 7), guard = 0;
      while (guard++ < 400) {
        var s = mk + '-01', e = monatEnde(mk), a = x[0] > s ? x[0] : s, b = x[1] < e ? x[1] : e;
        if (a < b) out[mk] = (out[mk] || 0) + M.days(a, b);
        if (x[1] <= e) break;
        mk = e.slice(0, 7);
      }
    });
    return out;   // { 'YYYY-MM': Tage }
  };
  M.monatsAnteile = function (iv, abDatum) {   // { 'YYYY-MM': 0 | 1 }
    var t = M.monatsTage(iv, abDatum), out = {};
    Object.keys(t).forEach(function (mk) { out[mk] = t[mk] > M.MIN_TAGE ? 1 : 0; });
    return out;
  };
  /* Einheiten einer Position: Set (mehrere Geräte, ein Preis) oder Stück (jedes Gerät eine Einheit) */
  function baseUnitKey(P, e) { return e.einheit ? 'S:' + e.einheit : P.art === 'set' ? 'S:' + e.id : 'G:' + e.geraetId; }
  /* Tachymeter + MCC sind zusammen immer EINE Einheit: die MCC folgt dem Tachymeter, sobald beide
     (zeitlich überlappend) in derselben Position stehen – egal wie die Einsätze erfasst wurden. */
  M.unitKey = function (P, e) {
    var I = M.idx(), g = I.ger[e.geraetId];
    if (!g || (g.typ !== 'tachymeter' && g.typ !== 'mcc')) return baseUnitKey(P, e);
    if (g.typ === 'tachymeter') return P.art === 'set' ? baseUnitKey(P, e) : 'G:' + g.id;
    var tsId = I.tsOfMcc[g.id]; if (!tsId) return baseUnitKey(P, e);
    var eb = e.bis || '9999-12-31';
    var te = (I.ein[tsId] || []).filter(function (x) { return x.positionId === P.id && x.ort === 'feld' && x.von <= eb && (x.bis || '9999-12-31') >= e.von; })
      .sort(function (a, b) { return a.von < b.von ? 1 : -1; })[0];
    if (!te) return baseUnitKey(P, e);
    return P.art === 'set' ? baseUnitKey(P, te) : 'G:' + tsId;
  };
  M.posUnits = function (pid) {
    var I = M.idx();
    if (I.units[pid]) return I.units[pid];
    var P = I.pos[pid], out = {}, list = [];
    if (!P) return (I.units[pid] = { map: {}, list: [] });
    M.state.data.einsaetze.forEach(function (e) {
      var g = I.ger[e.geraetId];
      if (e.positionId !== pid || e.ort !== 'feld' || !g || g.typ === 'messstelle') return;
      var k = M.unitKey(P, e), u = out[k];
      if (!u) { u = out[k] = { key: k, devs: [], eins: [], von: e.von, bis: e.bis || null }; list.push(u); }
      if (u.devs.indexOf(e.geraetId) < 0) u.devs.push(e.geraetId);
      u.eins.push(e);
      if (e.von < u.von) u.von = e.von;
      if (u.bis !== null && (!e.bis || e.bis > u.bis)) u.bis = e.bis || null;
    });
    list.sort(function (a, b) { return a.von < b.von ? -1 : a.von > b.von ? 1 : String(I.ger[a.devs[0]].name).localeCompare(String(I.ger[b.devs[0]].name), 'de', { numeric: true }); });
    list.forEach(function (u, i) {
      u.nr = i + 1;
      u.aktiv = u.eins.some(function (e) { return !e.bis; });
      var tot = 0; u.devs.forEach(function (id) { tot += M.num(I.ger[id].wert) || 0; });
      u.anteil = {}; u.devs.forEach(function (id) { u.anteil[id] = tot > 0 ? (M.num(I.ger[id].wert) || 0) / tot : 1 / u.devs.length; });
    });
    return (I.units[pid] = { map: out, list: list });
  };
  M.unitOf = function (e) {
    var P = e && e.positionId && M.idx().pos[e.positionId];
    return P ? M.posUnits(P.id).map[M.unitKey(P, e)] || null : null;
  };
  M.unitLabel = function (P, u) {
    var I = M.idx(), names = u.devs.map(function (id) { return I.ger[id].name; });
    return (P.art === 'set' ? 'Set ' + u.nr + ' · ' : '') + names.slice(0, 3).join(' + ') + (names.length > 3 ? ' + ' + (names.length - 3) + ' weitere' : '');
  };
  M.posLabel = function (P) { return P ? 'Pos. ' + (P.nr || '?') + ' · ' + (P.text || '') : ''; };
  M.posPreis = function (P) { return (M.num(P.V) || 0) + (M.num(P.B) || 0) + (M.num(P.W) || 0); };
  M.auftragOf = function (e) { return (e && e.auftrag) || ''; };

  M.abrechnung = function (pid, von, bis) {
    var I = M.idx(), mons = M.monate(von, bis), idx = {};
    mons.forEach(function (mk, i) { idx[mk] = i; });
    function leer() { return mons.map(function () { return { v: 0, b: 0, w: 0, t: 0, n: 0, nd: 0 }; }); }
    var rows = [], G = {};
    M.ABR_ORDER.forEach(function (g) { G[g] = { per: leer(), sum: { v: 0, b: 0, w: 0, t: 0 }, ger: {}, units: {} }; });
    function add(row, g, mk, v, b, w, devs) {
      var i = idx[mk]; if (i === undefined) return;
      var c = row.per[i], t = v + b + w;
      c.v += v; c.b += b; c.w += w; c.t += t; c.n += 1; c.nd += devs.length;
      row.sum.v += v; row.sum.b += b; row.sum.w += w; row.sum.t += t;
      var gc = G[g].per[i]; gc.v += v; gc.b += b; gc.w += w; gc.t += t; gc.n += 1; gc.nd += devs.length;
      G[g].sum.v += v; G[g].sum.b += b; G[g].sum.w += w; G[g].sum.t += t;
      devs.forEach(function (d) { G[g].ger[d] = 1; });
    }
    // Positionen
    (I.posByProj[pid] || []).forEach(function (P) {
      var g = P.gruppe || 'sen', row = { P: P, g: g, per: leer(), sum: { v: 0, b: 0, w: 0, t: 0 }, units: [] };
      M.posUnits(P.id).list.forEach(function (u) {
        var f = M.monatsAnteile(u.eins.map(function (e) { return [e.von, e.bis]; }));
        var any = false;
        Object.keys(f).forEach(function (mk) {
          var x = f[mk]; if (!x) return;
          add(row, g, mk, (M.num(P.V) || 0) * x, (M.num(P.B) || 0) * x, (M.num(P.W) || 0) * x, u.devs); any = any || idx[mk] !== undefined;
        });
        if (any) row.units.push({ u: u, f: f });
      });
      rows.push(row);
    });
    // Geräte ohne Position werden nicht verrechnet: die Abrechnung zeigt nur, was dem Auftraggeber laut Offerte zusteht.

    var tot = { v: 0, b: 0, w: 0, t: 0 }, ger = {};
    M.ABR_ORDER.forEach(function (g) { ['v', 'b', 'w', 't'].forEach(function (k) { tot[k] += G[g].sum[k]; }); Object.keys(G[g].ger).forEach(function (d) { ger[d] = 1; }); G[g].nGer = Object.keys(G[g].ger).length; });
    return { monate: mons, rows: rows, G: G, total: tot, nGer: Object.keys(ger).length };
  };

  /* Abrechnung als Posten: je Position die Einheiten (Geräte) mit Monaten im Zeitraum, Ansatz und Beträgen */
  M.montageText = function (r) { return r.von ? 'montiert ' + M.fmtDate(r.von) + (r.bis ? ' · abgebaut ' + M.fmtDate(r.bis) : (r.planBis ? ' · geplant bis ' + M.fmtDate(r.planBis) : '')) : ''; };
  /* Geplantes Ende einer laufenden Einheit (spätestes Planende ihrer laufenden Geräte; null wenn eines ungeplant ist) */
  M.unitPlanBis = function (u) {
    var run = u.eins.filter(function (e) { return !e.bis; });
    if (!run.length || run.some(function (e) { return !e.planBis; })) return null;
    return run.map(function (e) { return e.planBis; }).sort().pop();
  };
  /* Monate einer Position: verrechnet bis heute, geplant (ganze Laufzeit), offeriert */
  M.posMonate = function (P) {
    var r = { verr: 0, geplant: 0, offen: 0, mitPlan: 0, off: M.num(P.offMonate) || 0 };
    M.posUnits(P.id).list.forEach(function (u) {
      var f = M.monatsAnteile(u.eins.map(function (e) { return [e.von, e.bis]; })), n = 0;
      Object.keys(f).forEach(function (k) { n += f[k]; });
      r.verr += n;
      if (!u.aktiv) { r.geplant += n; return; }
      var pb = M.unitPlanBis(u);
      if (pb) { r.geplant += Math.max(n, M.monateZwischen(u.von, pb)); r.mitPlan++; } else { r.geplant += n; r.offen++; }
    });
    return r;
  };
  M.abrPosten = function (A) {
    var I = M.idx(), mons = A.monate, inR = {};
    mons.forEach(function (mk) { inR[mk] = 1; });
    var out = [];
    A.rows.forEach(function (x) {
      var P = x.P, rows = [];
      x.units.forEach(function (uu) {
        var u = uu.u, flags = mons.map(function (mk) { return uu.f[mk] || 0; }), n = flags.reduce(function (a, b) { return a + b; }, 0);
        var devs = u.devs.slice().sort(function (a, b) { return (I.ger[a].typ === 'mcc' ? 1 : 0) - (I.ger[b].typ === 'mcc' ? 1 : 0) || String(I.ger[a].name).localeCompare(String(I.ger[b].name), 'de', { numeric: true }); });
        var names = devs.map(function (id) { return I.ger[id].name; });
        var r = { auftrag: (u.eins.find(function (e) { return e.auftrag; }) || {}).auftrag || '', devs: devs, von: u.von || null, bis: u.bis || null, planBis: u.bis ? null : M.unitPlanBis(u), label: names.join(' + '), set: P && P.art === 'set' && u.nr ? 'Set ' + u.nr : '', flags: flags, n: n, v: 0, b: 0, w: 0, wp: 0 };
        if (P) {
          r.av = M.num(P.V) || 0; r.ab = M.num(P.B) || 0; r.aw = M.num(P.W) || 0;
          r.v = r.av * n; r.b = r.ab * n; r.w = r.aw * n;
        } else {
          var e = uu.e, bt = M.num(e.amortBetrag) || 0;
          r.ohne = true; r.modus = e.amortModus === 'monat' ? 'monat' : 'pauschal'; r.av = bt; r.ab = 0; r.aw = 0;
          r.v = r.modus === 'monat' ? bt * n : (inR[e.von.slice(0, 7)] ? bt : 0);
        }
        r.t = r.v + r.b + r.w;
        if (r.n || r.t) rows.push(r);
      });
      if (!rows.length) return;
      rows.sort(function (a, b) { return String(a.label).localeCompare(String(b.label), 'de', { numeric: true }); });
      var sum = { n: 0, v: 0, b: 0, w: 0, t: 0, per: mons.map(function () { return 0; }) };
      rows.forEach(function (r) { sum.n += r.n; sum.v += r.v; sum.b += r.b; sum.w += r.w; sum.t += r.t; r.flags.forEach(function (f, i) { sum.per[i] += f; }); });
      out.push({ g: x.g, P: P, rows: rows, sum: sum });
    });
    return out;
  };

  /* ---------- Dateien: Pläne, Skizzen, Fotos (Gerät) und Offerten, Dokumente (Projekt) */
  M.DATEI_ARTEN = {
    geraet: [['plan', 'Messplan'], ['fixpunkt', 'Fixpunktplan'], ['skizze', 'Skizze'], ['foto', 'Foto'], ['zertifikat', 'Kalibrierung / Zertifikat'], ['andere', 'Anderes']],
    projekt: [['offerte', 'Offerte'], ['plan', 'Plan'], ['vertrag', 'Auftrag / Vertrag'], ['bericht', 'Bericht'], ['andere', 'Anderes']]
  };
  /* Offerte und Vertrag gehören zum Finanzbereich */
  M.FIN_ARTEN = { offerte: 1, vertrag: 1 };
  M.dateiArten = function (ziel) { return (M.DATEI_ARTEN[ziel] || []).filter(function (a) { return M.can('fin') || !M.FIN_ARTEN[a[0]]; }); };
  M.fileVisible = function (f) { return M.can('fin') || f.ziel !== 'projekt' || !M.FIN_ARTEN[f.art]; };
  M.dateiArtLabel = function (ziel, art) { var a = (M.DATEI_ARTEN[ziel] || []).find(function (x) { return x[0] === art; }); return a ? a[1] : 'Datei'; };
  M.MAX_DATEI = 50 * 1024 * 1024;
  M.isBild = function (f) { return /^image\//.test(f.mime || '') || /\.(jpe?g|png|gif|webp)$/i.test(f.name || ''); };
  M.isPdf = function (f) { return /pdf/.test(f.mime || '') || /\.pdf$/i.test(f.name || ''); };
  function thumbOf(file) {
    if (!/^image\/(jpeg|png|gif|webp)/.test(file.type)) return Promise.resolve(null);
    return new Promise(function (res) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 360 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        try { res(c.toDataURL('image/jpeg', 0.72)); } catch (e) { res(null); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(null); };
      img.src = url;
    });
  }
  M.uploadFiles = function (ziel, zielId, files, art, onStep) {
    var list = Array.prototype.slice.call(files || []), done = 0, ok = [];
    return list.reduce(function (p, file) {
      return p.then(function () {
        if (file.size > M.MAX_DATEI) { M.toast(file.name + ': grösser als 50 MB, nicht hochgeladen', 'err'); return null; }
        var id = M.uid('dat');
        return thumbOf(file).then(function (thumb) {
          return M.store.putBlob(id, file.name, file).then(function (ref) {
            var rec = { id: id, ziel: ziel, zielId: zielId, name: file.name, mime: file.type || '', groesse: file.size, art: art || (M.isPdf({ name: file.name, mime: file.type }) ? (ziel === 'projekt' ? (M.can('fin') ? 'offerte' : 'plan') : 'plan') : (ziel === 'projekt' ? 'andere' : 'foto')),
              datum: M.today(), wer: M.userKuerzel(), ref: ref, thumb: thumb || null, bemerkung: '' };
            ok.push(rec);
            return M.put('dateien', rec);
          });
        }).then(function () { done++; if (onStep) onStep(done, list.length); });
      });
    }, Promise.resolve()).then(function () { return ok; });
  };
  M.fileBlob = function (fid) {
    var f = (M.state.data.dateien || []).find(function (x) { return x.id === fid; });
    if (!f) return Promise.reject(new Error('Datei nicht gefunden'));
    return M.store.getBlob(f.ref).then(function (b) { return { f: f, blob: b }; });
  };
  M.deleteFile = function (fid) {
    var f = (M.state.data.dateien || []).find(function (x) { return x.id === fid; });
    if (!f) return Promise.resolve();
    return Promise.resolve(M.store.removeBlob(f.ref)).catch(function (e) { console.warn(e); }).then(function () { return M.del('dateien', fid); });
  };
  M.fmtSize = function (n) { n = +n || 0; return n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB'; };

  /* Kurzname einer MCC für Kartenlabels: letzte 4 Ziffern aus dem Namen (sonst Seriennummer/Name) */
  M.mccKurz = function (mid) {
    var m = M.idx().ger[mid]; if (!m) return '';
    var d = String(m.name || '').replace(/\D/g, '');
    if (d.length < 4) d = String(m.seriennummer || '').replace(/\D/g, '') || d;
    return d ? d.slice(-4) : String(m.name || '');
  };
  M.mccOf = function (tsId) { var g = M.idx().ger[tsId]; return g && g.mccId ? M.idx().ger[g.mccId] : null; };
  M.tsOfMcc = function (mccId) { var I = M.idx(); return I.tsOfMcc[mccId] ? I.ger[I.tsOfMcc[mccId]] : null; };

  /* ---------- Toast */
  M.toast = function (msg, kind) {
    var box = document.getElementById('toasts');
    if (!box) return;
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast-' + kind : '');
    el.setAttribute('role', 'status');
    el.textContent = msg;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(function () { el.classList.add('out'); }, kind === 'err' ? 6000 : 3200);
    setTimeout(function () { el.remove(); }, kind === 'err' ? 6600 : 3800);
  };
})();
