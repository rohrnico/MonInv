/* Rechenregeln laut Anleitung (Abschnitt «Rechenregeln»): Monatsregel, Abrechnung, Sets, Amortisation */
const test = require('node:test'); const assert = require('node:assert');
const { app, setup } = require('./harness');
const plain = x => JSON.parse(JSON.stringify(x));   // Objekte aus der App-Umgebung vergleichbar machen

test('Monatsregel: mehr als 10 Tage im Kalendermonat = ganzer Monat, sonst nichts', () => {
  const { M } = app();
  assert.deepStrictEqual(plain(M.monatsAnteile([['2026-03-01', '2026-03-12']])), { '2026-03': 1 });   // 11 Tage
  assert.deepStrictEqual(plain(M.monatsAnteile([['2026-03-01', '2026-03-11']])), { '2026-03': 0 });   // 10 Tage
  assert.deepStrictEqual(plain(M.monatsAnteile([['2026-01-25', '2026-03-05']])), { '2026-01': 0, '2026-02': 1, '2026-03': 0 });
});

test('Monatsregel: überlappende Zeiträume zählen nur einmal', () => {
  const { M } = app();
  assert.deepStrictEqual(plain(M.monatsTage([['2026-03-01', '2026-03-08'], ['2026-03-05', '2026-03-10']])), { '2026-03': 9 });
  assert.deepStrictEqual(plain(M.monatsAnteile([['2026-03-01', '2026-03-08'], ['2026-03-05', '2026-03-10']])), { '2026-03': 0 });
});

test('Abrechnung Stückpreis: Vorhalten + Betrieb + Wartung je Monat und Gerät', () => {
  const a = app(), t = setup(a), { M } = a;
  const pj = t.projekt('P1'), pos = t.position(pj, '1.1', 100, { B: 10, W: 5 });
  const g1 = t.geraet('S1'), g2 = t.geraet('S2');
  t.einsatz(g1, { projektId: pj, positionId: pos, von: '2026-01-01', bis: '2026-04-01' });   // Jan–März
  t.einsatz(g2, { projektId: pj, positionId: pos, von: '2026-01-25', bis: '2026-02-15' });   // Jan 7 T., Feb 14 T. → nur Feb
  const r = M.abrechnung(pj, '2026-01', '2026-06');
  assert.strictEqual(r.total.v, 400);
  assert.strictEqual(r.total.t, 460);
  assert.strictEqual(r.nGer, 2);
});

test('Abrechnung: Geräte ohne Offertposition werden nicht verrechnet', () => {
  const a = app(), t = setup(a), { M } = a;
  const pj = t.projekt('P1'); t.position(pj, '1.1', 100);
  t.einsatz(t.geraet('S1'), { projektId: pj, von: '2026-01-01', bis: '2026-04-01' });
  assert.strictEqual(M.abrechnung(pj, '2026-01', '2026-06').total.t, 0);
});

test('Abrechnung Set-Preis: ein Preis pro Set und Monat, egal wie viele Geräte', () => {
  const a = app(), t = setup(a), { M } = a;
  const pj = t.projekt('P1'), pos = t.position(pj, '2.1', 300, { art: 'set' });
  const gw = t.geraet('GW', 'sensor', { wert: 3000 }), n1 = t.geraet('N1', 'sensor', { wert: 1000 });
  t.einsatz(gw, { projektId: pj, positionId: pos, einheit: 'set-a', von: '2026-01-01', bis: '2026-03-01' });
  t.einsatz(n1, { projektId: pj, positionId: pos, einheit: 'set-a', von: '2026-01-20', bis: '2026-04-01' });   // Set läuft Jan–März
  assert.strictEqual(M.abrechnung(pj, '2026-01', '2026-06').total.v, 900);
});

test('Tachymeter mit MCC auf derselben Stückpreis-Position: zählt als ein Gerät', () => {
  const a = app(), t = setup(a), { M } = a;
  const pj = t.projekt('P1'), pos = t.position(pj, '1.1', 1000);
  const mcc = t.geraet('MCC 1', 'mcc'), ts = t.geraet('TS 1', 'tachymeter', { mccId: mcc });
  t.einsatz(ts, { projektId: pj, positionId: pos, von: '2026-01-01', bis: '2026-03-01' });
  t.einsatz(mcc, { projektId: pj, positionId: pos, von: '2026-01-01', bis: '2026-03-01' });
  assert.strictEqual(M.abrechnung(pj, '2026-01', '2026-06').total.v, 2000);
});

test('Amortisation über die Offertposition: Vorhalten je Monat, im Set nach Anschaffungswert verteilt', () => {
  const a = app(), t = setup(a), { M } = a;
  const pj = t.projekt('P1'), stk = t.position(pj, '1.1', 100), set = t.position(pj, '2.1', 200, { art: 'set' });
  const s1 = t.geraet('S1', 'sensor', { wert: 5000 });
  const e1 = t.einsatz(s1, { projektId: pj, positionId: stk, amortModus: 'position', von: '2026-01-01', bis: '2026-04-01' });
  assert.strictEqual(M.einsatzAmort(t.ein(e1)), 300);
  const gw = t.geraet('GW', 'sensor', { wert: 3000 }), nd = t.geraet('N1', 'sensor', { wert: 1000 });
  const eg = t.einsatz(gw, { projektId: pj, positionId: set, einheit: 'x', amortModus: 'position', von: '2026-01-01', bis: '2026-03-01' });
  const en = t.einsatz(nd, { projektId: pj, positionId: set, einheit: 'x', amortModus: 'position', von: '2026-01-01', bis: '2026-03-01' });
  assert.strictEqual(M.einsatzAmort(t.ein(eg)), 300);   // 75 % von 2 × 200
  assert.strictEqual(M.einsatzAmort(t.ein(en)), 100);   // 25 %
});

test('Amortisation: Anteil «Vorhalten in Amortisation» wird berücksichtigt', () => {
  const a = app(), t = setup(a), { M } = a;
  const pj = t.projekt('P1'), pos = t.position(pj, '1.1', 100, { amortPct: 40 });
  const e = t.einsatz(t.geraet('S1'), { projektId: pj, positionId: pos, amortModus: 'position', von: '2026-01-01', bis: '2026-03-01' });
  assert.strictEqual(M.einsatzAmort(t.ein(e)), 80);
});

test('Startwert: Standorte vor dem Stichtag amortisieren nichts mehr', () => {
  const a = app(), t = setup(a), { M } = a;
  const pj = t.projekt('P1'), pos = t.position(pj, '1.1', 100);
  const g = t.geraet('S1', 'sensor', { wert: 5000, amortVor: 1000, amortVorDatum: '2026-03-01' });
  const e = t.einsatz(g, { projektId: pj, positionId: pos, amortModus: 'position', von: '2026-01-01', bis: '2026-05-01' });
  assert.strictEqual(M.einsatzAmort(t.ein(e)), 200);   // nur März und April
  assert.strictEqual(M.info(g).amortSum, 1200);
  assert.strictEqual(M.info(g).restwert, 3800);
});

test('Magazin amortisiert nichts', () => {
  const a = app(), t = setup(a), { M } = a;
  const mg = t.magazin('Urtenen');
  const e = t.einsatz(t.geraet('S1'), { ort: 'magazin', magazinId: mg, amortModus: 'monat', amortBetrag: 100, von: '2026-01-01', bis: '2026-05-01' });
  assert.strictEqual(M.einsatzAmort(t.ein(e)), 0);
});
