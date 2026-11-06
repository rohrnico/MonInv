/* Automatische Sicherung: eine Datei pro Tag, Aufbewahrung 30 + Monatsstände */
const test = require('node:test'); const assert = require('node:assert');
const { app } = require('./harness');

function fakeDrive(S, namen) {
  const st = S.create({ modus: 'sharepoint', sharepoint: { listenPrefix: 'X_' } });
  st.siteId = 's'; st.driveId = 'd';
  let files = namen.map((n, i) => ({ id: 'f' + i, name: n })), nid = 1000;
  const puts = [];
  st._graph = (m, p) => { if (m === 'GET' && /children/.test(p)) return Promise.resolve({ value: files.slice() }); return Promise.reject(Object.assign(new Error('?'), { status: 500 })); };
  st._raw = (m, p, body) => {
    if (m === 'PUT') { const name = decodeURIComponent(p.replace(/:\/content$/, '').split('/').pop()); puts.push([name, body]); files = files.filter(f => f.name !== name); files.push({ id: 'f' + nid++, name }); return Promise.resolve({ json: () => ({}) }); }
    if (m === 'DELETE') { const id = p.split('/').pop(); files = files.filter(f => f.id !== id); return Promise.resolve({}); }
  };
  return { st, puts, files: () => files.map(f => f.name).sort() };
}
const tag = d => 'MonInv-Sicherung-' + d + '.json';

test('Sicherung: neue Datei pro Tag, am selben Tag nicht nochmals', async () => {
  const { S } = app(); const f = fakeDrive(S, []);
  const r1 = await f.st.backupDaily(() => '{"geraete":[]}', '2026-11-06');
  assert.strictEqual(r1.neu, true); assert.strictEqual(f.puts.length, 1); assert.strictEqual(f.puts[0][0], tag('2026-11-06'));
  const r2 = await f.st.backupDaily(() => '{}', '2026-11-06');
  assert.strictEqual(r2.neu, false); assert.strictEqual(f.puts.length, 1);
  await f.st.backupDaily(() => '{}', '2026-11-06', true);   // «Jetzt sichern» überschreibt
  assert.strictEqual(f.puts.length, 2);
});

test('Sicherung: die letzten 30 bleiben, von älteren die erste jedes Monats', async () => {
  const { S } = app();
  const alt = [];
  for (let d = new Date('2026-08-01'); d <= new Date('2026-11-05'); d.setDate(d.getDate() + 1)) alt.push(tag(d.toISOString().slice(0, 10)));
  const f = fakeDrive(S, alt);
  await f.st.backupDaily(() => '{}', '2026-11-06');
  const left = f.files();
  assert.strictEqual(left.length, 30 + 3);   // 30 neueste + 1. Aug, 1. Sep, 1. Okt
  assert.ok(left.includes(tag('2026-08-01')) && left.includes(tag('2026-09-01')) && left.includes(tag('2026-10-01')));
  assert.ok(!left.includes(tag('2026-08-02')));
  assert.ok(left.includes(tag('2026-11-06')) && left.includes(tag('2026-10-08')));
});
