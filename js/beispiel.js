/* MonInv – Beispieldaten für den lokalen Testbetrieb.
   Werden nur geladen, solange im Browser noch keine Daten liegen.
   Projekte, Geräte, Werte und Positionen sind erfunden. */
(function () {
  'use strict';

  window.MonInvBeispiel = function () {
    var n = 0;
    function id(p) { n++; return p + '-' + n.toString(36) + Math.random().toString(36).slice(2, 7); }

    // ---------- Kategorien (eine pro Piktogramm)
    var K = [
      ['TS', 'Tachymeter', 'geo', 'tachymeter'], ['MC', 'MCC TSC', 'geo', 'mcc'],
      ['GN', 'GNSS-Antenne', 'geo', 'sensor'], ['PR', 'Prisma', 'geo', 'sensor'],
      ['IN', 'Inklinometer', 'boden', 'sensor'], ['EX', 'Extensometer', 'boden', 'sensor'],
      ['PZ', 'Piezometersonde', 'boden', 'sensor'], ['SP', 'Setzungspegel', 'boden', 'sensor'],
      ['NS', 'Neigungssensor', 'bau', 'sensor'], ['RM', 'Rissmeter', 'bau', 'sensor'],
      ['ER', 'Erschütterungssensor', 'bau', 'sensor'], ['KV', 'Konvergenzmessung', 'bau', 'sensor'],
      ['PG', 'Pegel', 'umw', 'sensor'], ['WS', 'Wetterstation', 'umw', 'sensor'],
      ['TE', 'Temperatursensor', 'umw', 'sensor'], ['LA', 'Lärmmessgerät', 'umw', 'sensor'],
      ['MZ', 'Messzentrale', 'erf', 'sensor'], ['GW', 'Gateway / Modem', 'erf', 'sensor'],
      ['KA', 'Kamera', 'erf', 'sensor'], ['SO', 'Solarversorgung', 'erf', 'sensor'],
      ['AL', 'Alarmgeber', 'erf', 'sensor']
    ];
    var kat = {}, kategorien = [];
    K.forEach(function (k) {
      var rec = { id: 'kat-' + k[0].toLowerCase(), name: k[1], gruppe: k[2], piktogramm: k[0], kuerzel: k[0], typ: k[3], felder: [] };
      if (k[0] === 'IN') rec.felder = [{ name: 'Rohrlänge m', typ: 'zahl' }, { name: 'Messintervall', typ: 'text' }];
      if (k[0] === 'ER') rec.felder = [{ name: 'Alarmwert mm/s', typ: 'zahl' }];
      kat[k[0]] = rec.id;
      kategorien.push(rec);
    });

    // ---------- Projekte
    var P = {
      as25: { nummer: 'AS25', name: 'UFBE Baugrube', typ: 'projekt', lat: 46.96545, lng: 7.46480, status: 'aktiv' },
      abb:  { nummer: 'ABB', name: 'ANO Burgdorf', typ: 'projekt', lat: 47.05905, lng: 7.62590, status: 'aktiv' },
      lau:  { nummer: 'G2602', name: 'Laupenstrasse', typ: 'projekt', lat: 46.94705, lng: 7.43290, status: 'aktiv' },
      sum:  { nummer: 'SUM', name: 'Sumiswald Rutschhang', typ: 'projekt', lat: 47.02810, lng: 7.74490, status: 'aktiv' },
      wie:  { nummer: 'SG1490', name: 'Wiedlisbach', typ: 'projekt', lat: 47.25180, lng: 7.64650, status: 'abgeschlossen' },
      mu:   { nummer: 'MAG-U', name: 'Magazin Urtenen', typ: 'magazin', lat: 47.02520, lng: 7.49830, status: 'aktiv' },
      mh:   { nummer: 'MAG-H', name: 'Magazin Herzogenbuchsee', typ: 'magazin', lat: 47.18800, lng: 7.70560, status: 'aktiv' }
    };
    var projekte = [];
    Object.keys(P).forEach(function (k) { P[k].id = 'prj-' + k; projekte.push(P[k]); });

    function off(pk, dx, dy) {
      var p = P[pk];
      return { lat: p.lat + dy / 111320, lng: p.lng + dx / (111320 * Math.cos(p.lat * Math.PI / 180)) };
    }

    var geraete = [], einsaetze = [], wartungen = [];
    var wer = ['obn', 'hom', 'roh', 'bid', 'ebd'];

    /* g: Gerät; steps: [[projekt, von, dx, dy], …] – letzter Schritt = aktueller Standort.
       dx/dy in Metern ab Projektmitte; dx = null → keine Position (Ort fehlt). */
    function add(g, steps) {
      g.id = id('ger');
      g.zustand = g.zustand || 'aktiv';
      geraete.push(g);
      var seen = {};
      steps.forEach(function (s, i) {
        var p = P[s[0]];
        var next = steps[i + 1];
        var pos = (s[2] === null || s[2] === undefined || p.typ === 'magazin') ? null : off(s[0], s[2], s[3]);
        var first = p.typ === 'projekt' && !seen[p.id];
        if (p.typ === 'projekt') seen[p.id] = true;
        einsaetze.push({
          id: id('ein'), geraetId: g.id, projektId: p.typ === 'magazin' ? null : p.id, von: s[1], bis: next ? next[1] : null,
          lat: pos ? pos.lat : null, lng: pos ? pos.lng : null,
          gesetztVon: wer[(i + geraete.length) % wer.length], geholtVon: next ? wer[(i + 1 + geraete.length) % wer.length] : '',
          ort: p.typ === 'magazin' ? 'magazin' : 'feld', magazinId: p.typ === 'magazin' ? p.id : null,
          amortModus: i % 3 === 2 ? 'pauschal' : 'monat',
          amortBetrag: p.typ === 'magazin' ? 0 : (i % 3 === 2 ? (g.amortProProjekt || 0) : Math.round((g.amortProProjekt || 0) / 100) * 10)
        });
      });
      return g;
    }
    function sensor(name, k, her, kauf, wert, amort, extra) {
      return Object.assign({ typ: 'sensor', name: name, kategorieId: kat[k], hersteller: her, kaufdatum: kauf, wert: wert, amortProProjekt: amort, sim: '', bemerkung: '', extra: {} }, extra || {});
    }

    // ---------- MCC TSC
    function mcc(sn, kauf) {
      return { typ: 'mcc', name: 'SN ' + sn, seriennummer: sn, kategorieId: kat.MC, gtyp: 'MCC TSC', hersteller: 'Leica', kaufdatum: kauf, wert: 2400, amortProProjekt: 200, sim: '', bemerkung: '', extra: {} };
    }
    var m1 = add(mcc('40955', '2021-04-12'), [['mu', '2021-04-12'], ['abb', '2025-04-07', 10, -60]]);
    var m2 = add(mcc('41188', '2022-02-01'), [['mu', '2022-02-01']]);
    var m3 = add(mcc('41207', '2022-02-01'), [['mu', '2022-02-01'], ['as25', '2026-03-02', -170, -70]]);
    var m4 = add(mcc('41290', '2023-05-15'), [['mh', '2023-05-15']]);
    var m5 = add(mcc('41315', '2023-05-15'), [['mu', '2023-05-15'], ['lau', '2026-08-03', 40, 30]]);
    m5.sim = '8941 0200 0000 5120';

    // ---------- Tachymeter
    function ts(nr, typ, sn, kauf, mccRec, letzte) {
      return { typ: 'tachymeter', name: nr, gtyp: typ, seriennummer: sn, kategorieId: kat.TS, hersteller: 'Leica', kaufdatum: kauf, wert: 38000, amortProProjekt: 3000, mccId: mccRec ? mccRec.id : null, letzteWartung: letzte, wartungIntervall: null, sim: '', bemerkung: '', extra: {} };
    }
    var ts07 = add(ts('TS-07', 'Leica TM50', '366214', '2021-05-03', m3, '2024-09-20'), [
      ['mh', '2021-05-03'], ['sum', '2021-05-17', 0, 0], ['mh', '2022-11-30'], ['wie', '2023-01-09', 0, 0],
      ['mu', '2024-06-28'], ['lau', '2024-09-23', 0, 0], ['mu', '2025-03-14'], ['abb', '2025-04-07', 0, 0],
      ['mu', '2026-01-20'], ['as25', '2026-03-02', -180, -60]
    ]);
    wartungen.push({ id: id('wrt'), geraetId: ts07.id, datum: '2022-12-01', art: 'Service', firma: 'Leica Geosystems', kosten: 1850, bemerkung: '' });
    wartungen.push({ id: id('wrt'), geraetId: ts07.id, datum: '2024-09-20', art: 'Service', firma: 'Leica Geosystems', kosten: 2100, bemerkung: 'Kompensator justiert' });
    var ts04 = add(ts('TS-04', 'Leica TM50', '362871', '2020-03-10', m1, '2025-03-28'), [['mu', '2020-03-10'], ['wie', '2020-04-01', 120, 80], ['mu', '2023-01-05'], ['abb', '2025-04-07', 0, -55]]);
    ts04.amortProProjekt = 3000;
    var ts09 = add(ts('TS-09', 'Leica TS60', '881402', '2023-02-20', m5, '2025-08-11'), [['mu', '2023-02-20'], ['abb', '2023-03-06', 60, 90], ['mu', '2025-07-31'], ['lau', '2026-08-03', 30, 20]]);
    var ts11 = add(ts('TS-11', 'Leica TS60', '881955', '2024-01-15', null, '2026-02-02'), [['mh', '2024-01-15'], ['sum', '2024-02-05', 70, -40], ['mh', '2026-01-26']]);

    // ---------- AS25 UFBE Baugrube
    var A = [
      ['IN-01', 'IN', 'Sisgeo', '2024-03-12', 4800, 600, -60, 75], ['IN-02', 'IN', 'Sisgeo', '2024-03-12', 4800, 600, 20, 78],
      ['IN-03', 'IN', 'Sisgeo', '2025-06-02', 5200, 650, 85, 20], ['IN-04', 'IN', 'Sisgeo', '2025-06-02', 5200, 650, 5, -70],
      ['EX-01', 'EX', 'Geokon', '2023-09-20', 3900, 500, -95, 25], ['EX-02', 'EX', 'Geokon', '2023-09-20', 3900, 500, 90, -30],
      ['PZ-01', 'PZ', 'Geokon', '2024-11-05', 2100, 300, -110, -45], ['PZ-02', 'PZ', 'Geokon', '2024-11-05', 2100, 300, 55, -85],
      ['NS-01', 'NS', 'Sisgeo', '2025-02-14', 1650, 250, -150, 110], ['NS-02', 'NS', 'Sisgeo', '2025-02-14', 1650, 250, 150, 105],
      ['NS-03', 'NS', 'Sisgeo', '2025-02-14', 1650, 250, 150, -100], ['RM-01', 'RM', 'Geokon', '2022-05-10', 780, 120, -130, 95],
      ['RM-02', 'RM', 'Geokon', '2022-05-10', 780, 120, 170, 10], ['PR-01', 'PR', 'Leica', '2023-01-10', 380, 50, -70, 100],
      ['PR-02', 'PR', 'Leica', '2023-01-10', 380, 50, 70, 100], ['PR-03', 'PR', 'Leica', '2023-01-10', 380, 50, 120, -80]
    ];
    A.forEach(function (a, i) {
      var g = sensor(a[0], a[1], a[2], a[3], a[4], a[5]);
      if (a[1] === 'IN') g.extra = { 'Rohrlänge m': a[0] < 'IN-03' ? 30 : 24, 'Messintervall': 'wöchentlich' };
      var steps = [['mu', a[3]]];
      if (i % 3 === 0 && a[3] < '2024-10-01') steps.push(['lau', '2024-10-01', a[6] / 3, a[7] / 3], ['mu', '2025-03-10']);
      if (i % 4 === 1 && a[3] < '2025-04-10') steps.push(['abb', '2025-04-10', a[6] / 2, a[7] / 2], ['mu', '2026-01-22']);
      steps.push(['as25', i < 12 ? '2026-04-14' : '2026-04-16', a[6], a[7]]);
      add(g, steps);
    });
    add(sensor('IN-05', 'IN', 'Sisgeo', '2025-06-02', 5200, 650, { extra: { 'Rohrlänge m': 24, 'Messintervall': 'wöchentlich' }, bemerkung: 'Neu gesetzt, Position nachtragen' }),
      [['mu', '2025-06-02'], ['as25', '2026-10-28', null]]);
    add(sensor('MZ-01', 'MZ', 'Campbell Scientific', '2024-01-15', 6400, 800, { sim: '8941 0200 0000 4471', bemerkung: 'Messzentrale mit Solarpanel' }),
      [['mu', '2024-01-15'], ['as25', '2026-04-14', -20, -110]]);

    // ---------- ABB ANO Burgdorf
    add(sensor('IN-06', 'IN', 'Sisgeo', '2024-03-12', 4800, 600, { extra: { 'Rohrlänge m': 30 } }), [['mu', '2024-03-12'], ['abb', '2025-04-10', -40, 30]]);
    add(sensor('IN-07', 'IN', 'Sisgeo', '2024-03-12', 4800, 600, { extra: { 'Rohrlänge m': 30 } }), [['mu', '2024-03-12'], ['abb', '2025-04-10', 45, 35]]);
    add(sensor('EX-03', 'EX', 'Geokon', '2023-09-20', 3900, 500), [['mu', '2023-09-20'], ['abb', '2025-04-10', 0, 60]]);
    add(sensor('MZ-02', 'MZ', 'Campbell Scientific', '2024-01-15', 6400, 800, { sim: '8941 0200 0000 4472' }), [['mu', '2024-01-15'], ['abb', '2025-04-10', -70, -20]]);
    add(sensor('GW-01', 'GW', 'Teltonika', '2024-06-01', 450, 60, { sim: '8941 0200 0000 4473' }), [['mu', '2024-06-01'], ['abb', '2025-04-10', -75, -28]]);

    // ---------- Laupenstrasse
    add(sensor('NS-04', 'NS', 'Sisgeo', '2025-02-14', 1650, 250), [['mu', '2025-02-14'], ['lau', '2026-08-04', -35, 25]]);
    add(sensor('NS-05', 'NS', 'Sisgeo', '2025-02-14', 1650, 250), [['mu', '2025-02-14'], ['lau', '2026-08-04', 35, 30]]);
    add(sensor('NS-06', 'NS', 'Sisgeo', '2025-02-14', 1650, 250), [['mu', '2025-02-14'], ['lau', '2026-08-04', 0, -35]]);
    add(sensor('RM-03', 'RM', 'Geokon', '2022-05-10', 780, 120), [['mu', '2022-05-10'], ['lau', '2026-08-04', -15, 40]]);
    add(sensor('ER-01', 'ER', 'Profound', '2023-08-01', 5600, 700, { sim: '8941 0200 0000 4480', extra: { 'Alarmwert mm/s': 5 } }), [['mu', '2023-08-01'], ['lau', '2026-08-03', 10, -10]]);

    // ---------- Sumiswald
    add(sensor('PZ-03', 'PZ', 'Geokon', '2024-11-05', 2100, 300), [['mh', '2024-11-05'], ['sum', '2025-05-12', -60, 50]]);
    add(sensor('PZ-04', 'PZ', 'Geokon', '2024-11-05', 2100, 300), [['mh', '2024-11-05'], ['sum', '2025-05-12', 30, 70]]);
    add(sensor('PZ-05', 'PZ', 'Geokon', '2024-11-05', 2100, 300), [['mh', '2024-11-05'], ['sum', '2025-05-12', 80, -20]]);
    add(sensor('PG-01', 'PG', 'OTT', '2023-04-03', 2900, 350), [['mh', '2023-04-03'], ['sum', '2025-05-12', -120, -60]]);
    add(sensor('MZ-03', 'MZ', 'Campbell Scientific', '2024-01-15', 6400, 800, { sim: '8941 0200 0000 4474' }), [['mh', '2024-01-15'], ['sum', '2025-05-12', 0, 0]]);
    add(sensor('WS-01', 'WS', 'Vaisala', '2022-09-01', 3200, 400), [['mh', '2022-09-01'], ['sum', '2025-05-12', 10, 8]]);
    add(sensor('SO-01', 'SO', 'Victron', '2022-09-01', 900, 100), [['mh', '2022-09-01'], ['sum', '2025-05-12', 6, -6]]);

    // ---------- Magazine
    ['IN-08', 'IN-09', 'IN-10'].forEach(function (nm) { add(sensor(nm, 'IN', 'Sisgeo', '2025-06-02', 5200, 650), [['mu', '2025-06-02']]); });
    add(sensor('EX-04', 'EX', 'Geokon', '2023-09-20', 3900, 500), [['mu', '2023-09-20'], ['wie', '2023-10-02', 30, -40], ['mu', '2024-06-20']]);
    add(sensor('NS-07', 'NS', 'Sisgeo', '2025-02-14', 1650, 250), [['mu', '2025-02-14']]);
    add(sensor('ER-02', 'ER', 'Profound', '2023-08-01', 5600, 700, { zustand: 'defekt', bemerkung: 'Geophon defekt, beim Hersteller abgeklärt' }), [['mu', '2023-08-01'], ['lau', '2024-09-25', 5, 5], ['mu', '2025-03-14']]);
    add(sensor('KA-01', 'KA', 'Mobotix', '2024-05-01', 1800, 220), [['mu', '2024-05-01']]);
    add(sensor('AL-01', 'AL', 'Werma', '2024-05-01', 650, 80), [['mu', '2024-05-01']]);
    add(sensor('GN-01', 'GN', 'Leica', '2022-03-01', 7800, 900), [['mh', '2022-03-01'], ['wie', '2023-01-15', -60, 120], ['mh', '2024-06-28']]);
    add(sensor('PZ-06', 'PZ', 'Geokon', '2024-11-05', 2100, 300), [['mh', '2024-11-05']]);
    add(sensor('TE-01', 'TE', 'Sisgeo', '2023-03-01', 420, 60), [['mh', '2023-03-01']]);
    add(sensor('LA-01', 'LA', 'Cirrus', '2023-07-01', 4300, 500), [['mh', '2023-07-01'], ['lau', '2024-10-01', 20, -25], ['mh', '2025-03-10']]);

    // Ältere Geräte: Startwert «bereits amortisiert vor Erfassung» per 1.1.2024
    geraete.forEach(function (g) {
      if (g.kaufdatum && g.kaufdatum < '2024-01-01' && g.wert) { g.amortVor = Math.round(g.wert * 0.55 / 100) * 100; g.amortVorDatum = '2024-01-01'; }
      delete g.amortProProjekt;
    });

    // Offertpositionen für AS25 (Beispiel): Tachymeter mit MCC als Einheit, Funk-Set, Stückpreise
    var positionen = [
      { id: 'pos-as25-11', projektId: 'prj-as25', nr: '1.1', text: 'Automatisches Tachymeter inkl. MCC TSC', gruppe: 'geo', art: 'stk', V: 1150, B: 140, W: 120, bemerkung: '' },
      { id: 'pos-as25-12', projektId: 'prj-as25', nr: '1.2', text: 'Reflektoren', gruppe: 'geo', art: 'stk', V: 8, B: 0, W: 0, bemerkung: '' },
      { id: 'pos-as25-21', projektId: 'prj-as25', nr: '2.1', text: 'Funk-Messsystem Neigung und Rissweite (Set)', gruppe: 'erf', art: 'set', V: 380, B: 45, W: 40, bemerkung: '' },
      { id: 'pos-as25-31', projektId: 'prj-as25', nr: '3.1', text: 'Inklinometer-Messrohre', gruppe: 'sen', art: 'stk', V: 90, B: 0, W: 10, bemerkung: '' },
      { id: 'pos-as25-32', projektId: 'prj-as25', nr: '3.2', text: 'Extensometer und Piezometer', gruppe: 'sen', art: 'stk', V: 60, B: 0, W: 8, bemerkung: '' }
    ];
    var byId = {}; geraete.forEach(function (g) { byId[g.id] = g; });
    einsaetze.forEach(function (e) {
      var g = byId[e.geraetId];
      if (e.projektId !== 'prj-as25' || e.bis || e.ort !== 'feld' || !g) return;
      var n = g.name, pid = null, key = null;
      if (g.typ === 'tachymeter') { pid = 'pos-as25-11'; key = 'ts-' + g.id; }
      else if (g.typ === 'mcc') { var t = geraete.find(function (x) { return x.mccId === g.id; }); if (t) { pid = 'pos-as25-11'; key = 'ts-' + t.id; } }
      else if (/^PR-/.test(n)) pid = 'pos-as25-12';
      else if (/^(NS|RM)-/.test(n)) { pid = 'pos-as25-21'; key = 'set-as25-funk'; }
      else if (/^IN-/.test(n)) pid = 'pos-as25-31';
      else if (/^(EX|PZ)-/.test(n)) pid = 'pos-as25-32';
      if (pid) { e.positionId = pid; e.einheit = key; e.amortModus = 'position'; e.amortBetrag = 0; }
    });

    return {
      positionen: positionen,
      kategorien: kategorien,
      projekte: projekte,
      geraete: geraete,
      einsaetze: einsaetze,
      wartungen: wartungen,
      einstellungen: [{ id: 'global', intervall: { tachymeter: 24, sensor: null, mcc: null }, warnProzent: 90, kuerzel: '', beispiel: true }]
    };
  };
})();
