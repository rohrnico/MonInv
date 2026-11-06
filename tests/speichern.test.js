/* SharePoint-Speichern: keine doppelten Zeilen, Doppel beim Laden zusammenführen */
const test = require('node:test'); const assert = require('node:assert');
const { app } = require('./harness');

function fakeSharePoint(S) {
  const st = S.create({ modus: 'sharepoint', sharepoint: { listenPrefix: 'X_' } });
  st.siteId = 's'; S.COLLECTIONS.forEach(c => { st.lists[c] = 'L-' + c; });
  const rows = {}; let nid = 1;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  st._graph = (m, p, body) => wait(m === 'POST' ? 30 : 5).then(() => {
    const list = p.split('/lists/')[1].split('/')[0]; rows[list] = rows[list] || [];
    const R = rows[list];
    if (m === 'POST') { const it = { id: String(nid++), fields: body.fields, lastModifiedDateTime: new Date(Date.now() + nid).toISOString() }; R.push(it); return it; }
    if (m === 'PATCH') { const id = p.split('/items/')[1].split('/')[0]; const r = R.find(x => x.id === id); r.fields = body; r.lastModifiedDateTime = new Date(Date.now() + nid++).toISOString(); return r; }
    if (m === 'DELETE') { const id = p.split('/items/')[1]; rows[list] = R.filter(x => x.id !== id); return null; }
    if (m === 'GET') return { value: JSON.parse(JSON.stringify(R)) };
  });
  return { st, rows };
}

test('Zweimal schnell hintereinander speichern (z.B. Ortsname nachtragen): nur eine Zeile', async () => {
  const { S } = app(); const { st, rows } = fakeSharePoint(S);
  const e = { id: 'E1', von: '2025-11-25' };
  await Promise.all([st.save('einsaetze', e), st.save('einsaetze', Object.assign({}, e, { ortName: 'Bolligen' }))]);
  assert.strictEqual(rows['L-einsaetze'].length, 1);
  assert.strictEqual(JSON.parse(rows['L-einsaetze'][0].fields.Daten).ortName, 'Bolligen');
  assert.strictEqual(st.busy(), false);
});

test('Doppelte Zeilen beim Laden: die neueste gilt, die übrigen werden aufgeräumt', async () => {
  const { S } = app(); const { st, rows } = fakeSharePoint(S);
  await st.save('einsaetze', { id: 'E1', von: '2025-11-25', ortName: 'Bolligen' });
  rows['L-einsaetze'].push({ id: '99', fields: { Title: 'E1', Daten: JSON.stringify({ id: 'E1', von: '2026-11-05' }) }, lastModifiedDateTime: '2000-01-01T00:00:00Z' });
  const d = await st.load();
  assert.strictEqual(d.einsaetze.length, 1);
  assert.strictEqual(d.einsaetze[0].ortName, 'Bolligen');
  assert.strictEqual(st.dupCount(), 1);
  assert.strictEqual(await st.cleanupDups(), 1);
  assert.strictEqual(rows['L-einsaetze'].length, 1);
});
