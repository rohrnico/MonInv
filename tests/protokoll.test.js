/* Änderungsprotokoll: geänderte Felder alt → neu, gesammelt geschrieben */
const test = require('node:test'); const assert = require('node:assert');
const { app, setup } = require('./harness');

function mitLog(a) { const got = []; a.M.store.logAdd = list => { got.push(...list); return Promise.resolve(); }; return got; }

test('Einsatz ändern: nur die geänderten Felder, mit altem und neuem Wert', async () => {
  const a = app(), t = setup(a), { M } = a, got = mitLog(a);
  const pj = t.projekt('P1'), g = t.geraet('TS 9', 'tachymeter');
  const e = t.einsatz(g, { projektId: pj, von: '2026-03-01' });
  await M.put('einsaetze', Object.assign(M.copy(t.ein(e)), { von: '2026-02-20', lat: 47.2 }));
  await M.logFlush();
  assert.strictEqual(got.length, 1);
  const x = got[0];
  assert.strictEqual(x.a, 'geändert'); assert.strictEqual(x.name, 'TS 9'); assert.strictEqual(x.ger, g);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(x.d)).map(f => f[0]).sort(), ['pos', 'von']);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(x.d.find(f => f[0] === 'von'))), ['von', '2026-03-01', '2026-02-20']);
});

test('Unverändert gespeichert und automatisch ergänzter Ortsname: kein Eintrag', async () => {
  const a = app(), t = setup(a), { M } = a, got = mitLog(a);
  const e = t.einsatz(t.geraet('S1'), { projektId: t.projekt('P1'), von: '2026-03-01' });
  await M.put('einsaetze', M.copy(t.ein(e)));
  await M.put('einsaetze', Object.assign(M.copy(t.ein(e)), { ortName: 'Bolligen' }));
  await M.logFlush();
  assert.strictEqual(got.length, 0);
});

test('Neu und gelöscht werden protokolliert, alles in einem Schreibvorgang', async () => {
  const a = app(), t = setup(a), { M } = a, got = mitLog(a);
  let calls = 0; const orig = M.store.logAdd; M.store.logAdd = l => { calls++; return orig(l); };
  await M.put('kabel', { id: 'k1', name: 'Strom 1', typ: 'strom', punkte: [[47, 7], [47.1, 7.1]] });
  await M.del('kabel', 'k1');
  await M.logFlush();
  assert.deepStrictEqual(got.map(x => x.a), ['neu', 'gelöscht']);
  assert.strictEqual(calls, 1);
});

test('Sekretariat (nur lesen): nichts gespeichert, nichts protokolliert', async () => {
  const a = app(), t = setup(a), { M } = a, got = mitLog(a);
  M.store.mode = 'sharepoint'; M.store.userEmail = 'sek@ristag.ch';
  a.sb.MONINV_CONFIG.admins = ['chef@ristag.ch'];
  a.data.einstellungen.push({ id: 'global', rollen: { 'sek@ristag.ch': 'sekretariat' } }); M.bump();
  const e = t.einsatz(t.geraet('S1'), { projektId: t.projekt('P1'), von: '2026-03-01' });
  await M.put('einsaetze', Object.assign(M.copy(t.ein(e)), { von: '2026-01-01' }));
  await M.logFlush();
  assert.strictEqual(got.length, 0);
  assert.strictEqual(t.ein(e).von, '2026-03-01');
});
