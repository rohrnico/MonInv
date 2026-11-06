/* Historie korrigieren, Tachymeter + MCC, Offertposition am Gerät, Warnungen */
const test = require('node:test'); const assert = require('node:assert');
const { app, setup } = require('./harness');

function tsMitMcc(t, pj, pos) {
  const mcc = t.geraet('MCC 1', 'mcc'), ts = t.geraet('TS 1', 'tachymeter', { mccId: mcc });
  const mg = t.magazin('Urtenen');
  const m0 = t.einsatz(mcc, { ort: 'magazin', magazinId: mg, lat: null, lng: null, von: '2026-01-01', bis: '2026-03-01' });
  const et = t.einsatz(ts, { projektId: pj, positionId: pos, von: '2026-03-01' });
  const em = t.einsatz(mcc, { projektId: pj, positionId: pos, von: '2026-03-01' });
  return { mcc, ts, m0, et, em };
}

test('«Von» verschieben: der vorherige Einsatz endet am neuen Datum', () => {
  const a = app(), t = setup(a), { M } = a;
  const g = t.geraet('S1'), mg = t.magazin('Urtenen'), pj = t.projekt('P1');
  const e0 = t.einsatz(g, { ort: 'magazin', magazinId: mg, von: '2026-01-01', bis: '2026-03-01' });
  const e1 = t.einsatz(g, { projektId: pj, von: '2026-03-01' });
  const neu = Object.assign({}, t.ein(e1), { von: '2026-02-15' });
  const r = M.shiftNeighbors(t.ein(e1), neu);
  assert.ok(!r.err);
  assert.strictEqual(r.puts.length, 1);
  assert.strictEqual(r.puts[0].id, e0);
  assert.strictEqual(r.puts[0].bis, '2026-02-15');
});

test('«Von» vor den Beginn des vorherigen Einsatzes: wird abgelehnt', () => {
  const a = app(), t = setup(a), { M } = a;
  const g = t.geraet('S1'), mg = t.magazin('Urtenen'), pj = t.projekt('P1');
  t.einsatz(g, { ort: 'magazin', magazinId: mg, von: '2026-01-01', bis: '2026-03-01' });
  const e1 = t.einsatz(g, { projektId: pj, von: '2026-03-01' });
  assert.ok(M.shiftNeighbors(t.ein(e1), Object.assign({}, t.ein(e1), { von: '2025-12-01' })).err);
});

test('Zweiter laufender Einsatz: wird abgelehnt', () => {
  const a = app(), t = setup(a), { M } = a;
  const g = t.geraet('S1'), pj = t.projekt('P1');
  t.einsatz(g, { projektId: pj, von: '2026-03-01' });
  const e2 = t.einsatz(g, { projektId: pj, von: '2026-01-01', bis: '2026-02-01' });
  assert.ok(M.shiftNeighbors(t.ein(e2), Object.assign({}, t.ein(e2), { bis: null })).err);
});

test('Tachymeter-Einsatz korrigieren: die MCC wird gefunden und zieht mit (Datum und Position)', async () => {
  const a = app(), t = setup(a), { M } = a;
  const pj = t.projekt('P1'), pos = t.position(pj, '1.1', 1000);
  const x = tsMitMcc(t, pj, pos);
  const pa = M.mccPartner(t.ein(x.et));
  assert.strictEqual(pa && pa.id, x.em);
  assert.strictEqual(M.mccPartner(t.ein(x.em)).id, x.et);
  const neu = Object.assign({}, t.ein(x.et), { von: '2026-02-20', lat: 47.1 });
  const r = M.applyToSet(t.ein(x.et), neu, [x.em], x.em);
  await Promise.all(r.jobs);
  assert.deepStrictEqual(r.skip.length, 0);
  assert.strictEqual(t.ein(x.em).von, '2026-02-20');
  assert.strictEqual(t.ein(x.em).lat, 47.1);
  assert.strictEqual(t.ein(x.m0).bis, '2026-02-20');   // Magazin der MCC rückt mit
});

test('Offertposition am Tachymeter setzen: die MCC bekommt sie auch, ohne neuen Historien-Eintrag', async () => {
  const a = app(), t = setup(a), { M } = a;
  const pj = t.projekt('P1'), p1 = t.position(pj, '1.1', 1000), p2 = t.position(pj, '1.2', 500);
  const x = tsMitMcc(t, pj, p1);
  const n = a.data.einsaetze.length;
  await M.setPosition([x.ts], p2);
  assert.strictEqual(t.ein(x.et).positionId, p2);
  assert.strictEqual(t.ein(x.em).positionId, p2);
  assert.strictEqual(a.data.einsaetze.length, n);
});

test('Warnungen: Tachymeter und MCC zählen als ein Objekt', () => {
  const a = app(), t = setup(a), { M } = a;
  const pj = t.projekt('P1'), pos = t.position(pj, '1.1', 1000, { offMonate: 1 });
  const x = tsMitMcc(t, pj, pos);
  M.bump();
  const w = M.warnings(M.info(x.ts));
  assert.strictEqual(w.filter(s => /Abbau/.test(s)).length, 1, JSON.stringify(w));
  // Wartung nur bei der MCC fällig: zählt zusätzlich, mit Namen der MCC
  a.data.geraete.find(g => g.id === x.mcc).wartungIntervall = 1; M.bump();
  const w2 = M.warnings(M.info(x.ts));
  assert.ok(w2.some(s => s === 'MCC 1: Wartung fällig'), JSON.stringify(w2));
  // und bei beiden fällig: nur einmal
  a.data.geraete.find(g => g.id === x.ts).wartungIntervall = 1; M.bump();
  assert.strictEqual(M.warnings(M.info(x.ts)).filter(s => /Wartung/.test(s)).length, 1);
});

test('Warnungen: defektes Gerät hat keine', () => {
  const a = app(), t = setup(a), { M } = a;
  const g = t.geraet('S1', 'sensor', { zustand: 'defekt' });
  t.einsatz(g, { projektId: t.projekt('P1'), von: '2026-01-01', lat: null, lng: null });
  assert.strictEqual(M.warnings(M.info(g)).length, 0);
});
