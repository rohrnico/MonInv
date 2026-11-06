/* Lädt die App-Skripte ohne Browser in eine eigene Umgebung (Node «vm»), mit leerem Datenbestand.
   Jeder Aufruf von app() liefert eine frische, unabhängige App: { M, S (MonStore), data, ... } */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['symbols', 'store', 'core', 'map', 'views', 'forms'];

function el() {
  const e = { style: {}, dataset: {}, children: [], innerHTML: '', textContent: '', value: '', hidden: false, checked: false,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {}, appendChild(c) { return c; }, removeChild() {},
    addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    focus() {}, blur() {}, getBoundingClientRect() { return { x: 0, y: 0, width: 0, height: 0 }; }, closest() { return null; } };
  return e;
}
function mem() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }

function app(opts) {
  opts = opts || {};
  const doc = { getElementById: () => null, createElement: el, createElementNS: el, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {}, body: el(), documentElement: el(), hidden: false };
  const sb = { console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, Promise, Date, Math, JSON,
    document: doc, localStorage: mem(), sessionStorage: mem(), navigator: { userAgent: 'node' }, location: { href: 'http://test/', search: '', hash: '' },
    matchMedia: () => ({ matches: false, addEventListener() {} }), requestAnimationFrame: f => setTimeout(f, 0), fetch: () => Promise.reject(new Error('offline')),
    MONINV_CONFIG: { modus: 'lokal' } };
  sb.window = sb; sb.self = sb;
  vm.createContext(sb);
  FILES.forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), sb, { filename: f + '.js' }));
  const M = sb.M;
  M.toast = () => {}; M.refreshUI = () => {}; M.renderPlacing = () => {}; M.mapUpdate = () => {};
  M.saved = [];
  M.store = { mode: 'lokal', userEmail: '', save(c, r) { M.saved.push([c, r.id]); return Promise.resolve(); }, remove() { return Promise.resolve(); } };
  M.state.data = sb.MonStore.emptyData();
  return { M, S: sb.MonStore, sb, data: M.state.data };
}

/* kleine Helfer zum Aufbau von Testdaten */
function setup(a) {
  const { M, data } = a;
  let n = 0;
  const id = p => p + '-' + (++n);
  const api = {
    projekt(name) { const p = { id: id('prj'), name, typ: 'projekt' }; data.projekte.push(p); M.bump(); return p.id; },
    magazin(name) { const p = { id: id('mag'), name, typ: 'magazin' }; data.projekte.push(p); M.bump(); return p.id; },
    geraet(name, typ, extra) { const g = Object.assign({ id: id('ger'), name, typ: typ || 'sensor', zustand: 'aktiv' }, extra || {}); data.geraete.push(g); M.bump(); return g.id; },
    position(pid, nr, V, extra) { const P = Object.assign({ id: id('pos'), projektId: pid, nr, text: 'Pos ' + nr, gruppe: 'geo', art: 'stk', V, B: 0, W: 0 }, extra || {}); data.positionen.push(P); M.bump(); return P.id; },
    einsatz(gid, e) { const x = Object.assign({ id: id('ein'), geraetId: gid, ort: 'feld', lat: 47, lng: 7.5, bis: null }, e); data.einsaetze.push(x); M.bump(); return x.id; },
    ein(eid) { return data.einsaetze.find(x => x.id === eid); },
    flush() { return new Promise(r => setTimeout(r, 0)); }
  };
  return api;
}

module.exports = { app, setup };
