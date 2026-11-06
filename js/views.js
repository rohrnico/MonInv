/* MonInv – Ansichten */
(function () {
  'use strict';
  var M = window.M, S = window.MonSym, esc = M.esc;

  function $(id) { return document.getElementById(id); }
  function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function geraete() { return M.state.data.geraete; }
  /* Seite neu aufbauen, ohne dass sie nach oben springt: Scrollposition, waagrechte Tabellen-Scrolls und Fokus bleiben */
  function keepScroll(root, html) {
    var pg = root.querySelector('.page'), top = pg ? pg.scrollTop : 0, winY = window.scrollY;
    var wraps = Array.prototype.map.call(root.querySelectorAll('.tbl-wrap, .pd-body, .proj-list'), function (w) { return [w.scrollLeft, w.scrollTop]; });
    var a = document.activeElement, key = null;
    if (a && root.contains(a)) key = a.id ? '#' + a.id : (a.getAttribute('data-id') ? '[data-id="' + a.getAttribute('data-id') + '"]' + (a.getAttribute('data-change') ? '[data-change="' + a.getAttribute('data-change') + '"]' : '') : null);
    var y0 = key && a.getBoundingClientRect ? a.getBoundingClientRect().top : null;
    root.innerHTML = html;
    var np = root.querySelector('.page'); if (np) np.scrollTop = top;
    Array.prototype.forEach.call(root.querySelectorAll('.tbl-wrap, .pd-body, .proj-list'), function (w, n) { if (wraps[n]) { w.scrollLeft = wraps[n][0]; w.scrollTop = wraps[n][1]; } });
    if (window.scrollY !== winY) window.scrollTo(0, winY);
    if (key) {
      try {
        var el = root.querySelector(key);
        if (el) {
          // angeklicktes Element bleibt an derselben Stelle am Bildschirm (z.B. wenn oben die Auswahlleiste erscheint)
          if (np && y0 !== null) np.scrollTop += el.getBoundingClientRect().top - y0;
          el.focus({ preventScroll: true });
        }
      } catch (e) { /* Selektor ungültig: Fokus nicht wiederherstellen */ }
    }
  }
  var GRP_PIK = { geo: 'TS', boden: 'IN', bau: 'NS', umw: 'PG', erf: 'MZ' };
  M.GRP_PIK = GRP_PIK;

  /* Auswahl Projekte (nur echte Projekte, keine Magazine) */
  function projOptions(sel, withEmpty, emptyLabel, inklAbgeschlossen) {
    var ps = M.state.data.projekte.filter(function (p) { return p.typ === 'projekt' && (inklAbgeschlossen || p.status !== 'abgeschlossen' || p.id === sel); })
      .sort(function (a, b) { return M.projName(a).localeCompare(M.projName(b), 'de', { numeric: true }); });
    return (withEmpty ? opt('', emptyLabel || 'alle', !sel) : '') + ps.map(function (p) {
      return opt(p.id, M.projName(p) + (p.status === 'abgeschlossen' ? ' (abgeschlossen)' : ''), sel === p.id);
    }).join('');
  }
  function magOptions(sel) { return M.magazine().map(function (m) { return opt(m.id, m.name, sel === m.id); }).join(''); }
  M.projOptions = projOptions;
  M.magOptions = magOptions;

  /* ================================================== KARTE */
  M.renderMapSide = function () {
    var f = M.state.filters.map;
    var counts = {};
    geraete().forEach(function (g) {
      var i = M.info(g.id);
      if (!i.pos || g.zustand === 'ausgemustert' || (i.mccTs && !i.isMag) || g.typ === 'messstelle') return;
      counts[i.gruppe] = (counts[i.gruppe] || 0) + 1;
    });
    var h = '<div class="side-sec"><div class="sec-h"><span>Gerätegruppen</span><span class="muted">ein/aus</span></div>';
    S.GRUPPEN_ORDER.forEach(function (k) {
      var g = S.GRUPPEN[k], on = !f.off[k];
      h += '<button type="button" class="grp' + (on ? '' : ' off') + '" data-act="toggle-grp" data-k="' + k + '" aria-pressed="' + on + '">' +
        S.symbolHtml(k, GRP_PIK[k], { size: 22 }) + '<span>' + esc(g.name) + '</span><b>' + (counts[k] || 0) + '</b></button>';
    });
    var nk = M.state.data.kabel.length;
    h += '<button type="button" class="grp' + (f.kabel ? '' : ' off') + '" data-act="toggle-kabel" aria-pressed="' + f.kabel + '"><span class="kab-ic" aria-hidden="true"></span><span>Kabelführungen</span><b>' + nk + '</b></button>';
    h += '<button type="button" class="link-btn" data-act="go" data-view="einstellungen" data-anchor="kat">Kategorien und Symbole ›</button></div>';
    h += '<div class="side-sec"><div class="sec-h"><span>Filter</span></div>' +
      '<label class="chk"><input type="checkbox" id="f-feld" data-change="mapf" data-k="feld"' + (f.feld ? ' checked' : '') + '> Im Feld</label>' +
      '<label class="chk"><input type="checkbox" id="f-mag" data-change="mapf" data-k="magazin"' + (f.magazin ? ' checked' : '') + '> Im Magazin</label>' +
      '<label class="chk warn"><input type="checkbox" id="f-issue" data-change="mapf" data-k="issue"' + (f.issue ? ' checked' : '') + '> Nur Handlungsbedarf</label>' +
      '<label class="fld"><span>Projekt</span><select id="f-proj" data-change="mapf" data-k="projekt">' + projOptions(f.projekt, true, 'alle Projekte', true) + '</select></label></div>';
    h += '<div class="side-sec legend"><div class="sec-h"><span>Zustand</span></div>' +
      '<div>' + S.symbolHtml('boden', 'PZ', { size: 22 }) + 'Im Einsatz</div>' +
      '<div>' + S.symbolHtml('boden', 'PZ', { size: 22, state: 'wartung' }) + 'Wartung fällig</div>' +
      '<div>' + S.symbolHtml('boden', 'PZ', { size: 22, state: 'ort' }) + 'Position fehlt</div>' +
      '<div>' + S.symbolHtml('boden', 'PZ', { size: 22, state: 'magazin' }) + 'Im Magazin</div>' +
      '<div>' + S.symbolHtml('boden', 'PZ', { size: 22, state: 'reserviert' }) + 'Reserviert (im Magazin)</div>' +
      '<div><span class="cl cl-mini" style="--cs:26px;background:conic-gradient(#F6E7A1 0 200deg,#CDBDE6 200deg 300deg,#F3C4D0 300deg 360deg)"><span class="cl-n">9</span></span>Zusammengefasst</div>';
    Object.keys(M.kabelTypen).forEach(function (k) {
      var t = M.kabelTypen[k];
      h += '<div><svg aria-hidden="true" width="26" height="10" viewBox="0 0 26 10"><path d="M1 5h24" stroke="' + t.color + '" stroke-width="3"' + (t.dash ? ' stroke-dasharray="' + t.dash.split(' ').map(function (n) { return Math.max(1, Math.round(n / 2)); }).join(' ') + '"' : '') + '/></svg>' + esc(t.name) + '</div>';
    });
    h += '</div>';
    $('map-side').innerHTML = h;
  };

  M.renderMapTools = function () {
    var cur = M.mapLayerKey ? M.mapLayerKey() : 'karte';
    var f = M.state.filters.map, nOff = Object.keys(f.off || {}).filter(function (k) { return f.off[k]; }).length + (f.issue ? 1 : 0) + (f.projekt ? 1 : 0) + (f.feld ? 0 : 1) + (f.magazin ? 0 : 1);
    var tic = function (p) { return '<svg class="t-ic" viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>'; };
    var h = '<button type="button" class="tool only-narrow t-filter" data-act="side-open">' + tic('<path d="M4 6h16M7 12h10M10 18h4"/>') + '<span>Filter</span>' + (nOff ? '<b class="t-n">' + nOff + '</b>' : '') + '</button><span class="grow"></span><div class="seg t-layer" role="group" aria-label="Kartenhintergrund">';
    Object.keys(M.mapLayers || {}).forEach(function (k) {
      h += '<button type="button" data-act="layer" data-k="' + k + '" class="' + (k === cur ? 'on' : '') + '" aria-pressed="' + (k === cur) + '">' + esc(M.mapLayers[k].name) + '</button>';
    });
    h += '</div><div class="t-fab">' +
      '<button type="button" class="tool t-fit" data-act="fit" aria-label="Alle Geräte zeigen">' + tic('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><circle cx="12" cy="12" r="2.5"/>') + '<span>Alle zeigen</span></button>' +
      '<button type="button" class="tool t-kabel" data-act="kabel-new" aria-label="Kabel zeichnen">' + tic('<circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="5.5" r="2"/><path d="M7.3 17.6C12 15.5 9 9.5 16.7 6.4"/>') + '<span>+ Kabel</span></button>' +
      '<button type="button" class="tool tool-pri t-place" data-act="place-new">Gerät platzieren</button></div>';
    $('map-tools').innerHTML = h;
  };

  M.renderPlacing = function () {
    var bar = $('placing-bar'), pl = M.state.placing, dr = M.state.drawing;
    M.mapSetMode(pl ? 'place' : dr ? 'draw' : null);
    if (!pl && !dr) { bar.hidden = true; bar.innerHTML = ''; return; }
    bar.hidden = false;
    var h = '';
    if (pl) {
      var label = pl.kind === 'projekt' ? M.projName(M.idx().proj[pl.id]) : (M.idx().ger[pl.id] || {}).name;
      var q = pl.job && pl.job.queue ? pl.job : null;
      if (q && q.same) h += '<div class="pl-t"><b>' + q.ids.length + ' Geräte</b> an dieselbe Position setzen – in die Karte tippen</div>';
      else if (q) h += '<div class="pl-t"><b>' + esc(label) + '</b> platzieren – in die Karte tippen <span class="pl-step">' + (q.i + 1) + ' von ' + q.ids.length + '</span></div>';
      else h += '<div class="pl-t"><b>' + esc(label) + '</b> platzieren – in die Karte tippen</div>';
      h += '' +
        '<form class="pl-f" data-form="lv95">' +
        '<label><span class="sr">Ost</span><input id="pl-e" inputmode="decimal" placeholder="Ost 2\'600\'000"></label>' +
        '<label><span class="sr">Nord</span><input id="pl-n" inputmode="decimal" placeholder="Nord 1\'200\'000"></label>' +
        '<button type="submit" class="btn sm">LV95 übernehmen</button></form>' +
        '<div class="pl-b"><button type="button" class="btn sm ghost" data-act="gps">Meine Position (GPS)</button>' +
        (q && !q.same ? '<button type="button" class="btn sm ghost" data-act="place-skip">Überspringen</button>' : '') +
        '<button type="button" class="btn sm ghost" data-act="place-cancel">' + (q && q.done ? 'Beenden' : 'Abbrechen') + '</button></div>';
    } else {
      var len = M.lineLen(dr.pts), I = M.idx();
      var links = [dr.zuId && I.ger[dr.zuId] ? I.ger[dr.zuId].name : null, dr.vonId && I.ger[dr.vonId] ? I.ger[dr.vonId].name : null].filter(Boolean);
      (dr.kabelAn || []).forEach(function (a) { var k = I.kab[a.kid], nm = k && (k.name || (M.kabelTypen[k.typ] || M.kabelTypen.andere).name); if (nm && links.indexOf(nm) < 0) links.push(nm); });
      h += '<div class="pl-t"><b>Kabel zeichnen</b> – Punkte entlang der Kabelführung in die Karte tippen. Ein Gerät antippen verbindet das Kabel damit, ein bestehendes Kabel antippen setzt den Punkt genau auf dieses Kabel (Abzweigung).</div>' +
        '<div class="pl-info"><span>' + dr.pts.length + ' Punkte</span><span class="mono">' + M.fmtLen(len) + '</span>' + (links.length ? '<span>verbunden: ' + esc(links.join(' ↔ ')) + '</span>' : '') + '</div>' +
        '<div class="pl-b"><button type="button" class="btn sm ghost" data-act="draw-undo"' + (dr.pts.length ? '' : ' disabled') + '>Rückgängig</button>' +
        '<button type="button" class="btn sm ghost" data-act="draw-cancel">Abbrechen</button>' +
        '<button type="button" class="btn sm signal" data-act="draw-done"' + (dr.pts.length > 1 ? '' : ' disabled') + '>Fertig</button></div>';
    }
    h += '<form class="pl-search" data-form="ortsuche"><label class="sr" for="pl-q">Adresse oder Ort suchen</label><input id="pl-q" placeholder="Adresse oder Ort suchen …" autocomplete="off"><button type="submit" class="btn sm ghost">Suchen</button></form><div id="pl-res" class="pl-res"></div>';
    bar.innerHTML = h;
  };

  function summaryHtml() {
    var all = geraete().filter(function (g) { return g.zustand !== 'ausgemustert' && g.typ !== 'messstelle'; });
    var feld = 0, mag = 0, wart = [], ort = [], abbau = [], defekt = 0;
    all.forEach(function (g) {
      var i = M.info(g.id);
      if (i.isMag) mag++; else if (i.cur) feld++;
      if (i.wart && i.wart.faellig) wart.push(i);
      if (i.ortFehlt) ort.push(i);
      if (i.lz && i.lz.warn) abbau.push(i);
      if (g.zustand === 'defekt') defekt++;
    });
    function row(i, sub) {
      return '<button type="button" class="row-btn" data-act="sel" data-id="' + i.g.id + '">' + M.symbol(i.g.id, 24) +
        '<span class="rb-t"><b>' + esc(i.g.name) + '</b><span>' + esc(sub) + '</span></span><span class="chev">›</span></button>';
    }
    var h = '<div class="pn-sum"><div class="sec-h"><span>Alle Geräte</span></div>' +
      '<div class="big"><span class="big-n">' + all.length + '</span><span>Geräte, davon <b>' + feld + '</b> im Feld und <b>' + mag + '</b> im Magazin</span></div>';
    h += '<div class="tiles2"><div class="tile t-warn"><b>' + wart.length + '</b><span>Wartung fällig</span></div>' +
      '<div class="tile t-ort"><b>' + ort.length + '</b><span>Position fehlt</span></div></div>';
    if (wart.length) h += '<div class="sec-h"><span>Wartung fällig</span></div>' + wart.map(function (i) { return row(i, i.wart.tage + ' von ' + i.wart.limit + ' Tagen · ' + i.ortText); }).join('');
    if (abbau.length) h += '<div class="sec-h"><span>Abbau fällig (Offertdauer erreicht)</span></div>' + abbau.map(function (i) { return row(i, (i.proj ? M.projName(i.proj) + ' · ' : '') + i.lz.off + ' Monate offeriert · Abbau ' + M.monatName(i.lz.abbau)); }).join('');
    if (ort.length) h += '<div class="sec-h"><span>Position fehlt</span></div>' + ort.map(function (i) { return row(i, (i.proj ? M.projName(i.proj) + ' · ' : '') + 'seit ' + M.fmtDate(i.cur.von)); }).join('');
    if (defekt) h += '<p class="muted small">' + defekt + ' Gerät' + (defekt > 1 ? 'e' : '') + ' als defekt markiert (in der Liste filterbar).</p>';
    h += '<p class="muted small">Symbol, Kreis oder Kabel antippen. Kreise fassen nahe Geräte zusammen und zeigen die Gruppen als Ring; der orange Punkt zählt den Handlungsbedarf. MCC im Einsatz stehen beim Tachymeter.</p></div>';
    return h;
  }

  M.renderPanel = function () {
    var el = $('panel'), I = M.idx();
    if (M.state.selKabel && I.kab[M.state.selKabel]) {
      el.innerHTML = '<button type="button" class="pn-close" data-act="desel" aria-label="Schliessen">×</button>' + M.kabelHtml(M.state.selKabel);
      el.classList.add('has-sel');
    } else if (M.state.stack && M.state.stack.length) {
      el.innerHTML = '<button type="button" class="pn-close" data-act="desel" aria-label="Schliessen">×</button>' + stackHtml(M.state.stack);
      el.classList.add('has-sel');
    } else if (M.state.sel && I.ger[M.state.sel]) {
      el.innerHTML = '<button type="button" class="pn-close" data-act="desel" aria-label="Schliessen">×</button>' + M.detailHtml(M.state.sel);
      el.classList.add('has-sel');
    } else {
      el.innerHTML = summaryHtml();
      el.classList.remove('has-sel');
    }
  };

  /* ---------- Mehrere Geräte am gleichen Ort */
  function stackHtml(ids) {
    var I = M.idx();
    ids = ids.filter(function (id) { return I.ger[id]; }).sort(function (a, b) { return String(I.ger[a].name).localeCompare(String(I.ger[b].name), 'de', { numeric: true }); });
    var can = ids.filter(function (id) { var i = M.info(id); return i.cur && !i.isMag && !i.mccTs && !i.members; });
    var h = '<div class="dt-head"><div class="dt-t"><h2>' + ids.length + ' Geräte</h2><span>an praktisch derselben Stelle</span></div></div>';
    if (can.length > 1) h += '<div class="hint">Sollen diese Geräte als <b>ein Symbol</b> erscheinen? <button type="button" class="link-btn" data-act="ms-new" data-ids="' + can.join(',') + '">Zu Messstelle zusammenfassen</button></div>';
    h += '<div class="stack-list">';
    ids.forEach(function (id) {
      var i = M.info(id);
      h += '<button type="button" class="row-btn" data-act="sel" data-id="' + id + '">' + M.symbol(id, 26) + '<span class="rb-t"><b>' + esc(i.g.name) + '</b><span>' +
        esc((i.members ? 'Messstelle · ' + i.members.length + (i.members.length === 1 ? ' Gerät' : ' Geräte') : (i.kat ? i.kat.name : M.typLabel[i.g.typ])) + ' · ' + M.stateLabel[i.state][0]) + '</span></span><span class="chev">›</span></button>';
    });
    return h + '</div>';
  }

  /* ================================================== KABEL-DETAIL */
  M.kabelHtml = function (kid) {
    var I = M.idx(), k = I.kab[kid], t = M.kabelTypen[k.typ] || M.kabelTypen.andere;
    var len = M.lineLen(k.punkte);
    function dev(id) { var g = id && I.ger[id]; return g ? '<button type="button" class="link-btn" data-act="sel" data-id="' + g.id + '">' + esc(g.name) + '</button>' : '<span class="muted">–</span>'; }
    var h = '<div class="dt-head"><span class="kab-big" style="--c:' + t.color + '" aria-hidden="true"></span><div class="dt-t"><h2>' + esc(k.name || t.name) + '</h2><span>Kabelführung · ' + esc(t.name) + '</span></div></div>';
    h += '<div class="dt-actions">' +
      '<button type="button" class="btn" data-act="kabel-edit" data-id="' + kid + '">Bearbeiten</button>' +
      '<button type="button" class="btn ghost" data-act="kabel-redraw" data-id="' + kid + '">Neu zeichnen</button>' +
      '<button type="button" class="btn ghost" data-act="kabel-focus" data-id="' + kid + '">Zeigen</button>' +
      '<button type="button" class="btn ghost danger-t" data-act="kabel-del" data-id="' + kid + '">Löschen</button></div>';
    h += '<div class="sec-h"><span>Angaben</span></div><div class="attrs">' +
      attr('Länge auf der Karte', M.fmtLen(len), 'calc') +
      (M.has(k.reserve) ? attr('Reserve', M.fmtLen(+k.reserve)) + attr('Kabellänge total', M.fmtLen(len + (+k.reserve)), 'calc') : '') +
      attr('Führt zu', dev(k.zuId)) + attr('Von', dev(k.vonId)) +
      attr('Projekt', k.projektId && I.proj[k.projektId] ? esc(M.projName(I.proj[k.projektId])) : '<span class="muted">–</span>') +
      attr('Verlegt', M.fmtDate(k.datum)) + attr('Punkte', String((k.punkte || []).length)) +
      (k.bemerkung ? attr('Bemerkung', esc(k.bemerkung), 'pre') : '') + '</div>';
    return h;
  };

  /* ================================================== GERÄTE-DETAIL */
  function attr(k, v, cls) { return '<div class="at"><span>' + esc(k) + '</span><span class="' + (cls || '') + '">' + v + '</span></div>'; }
  /* Offertposition eines Geräts im Feld, direkt wählbar (ersetzt das Teilprojekt). Finanzbereich: für «User» ausgeblendet. */
  M.posAttr = function (i) {
    var pr = M.posRate(i.cur), edit = M.can('edit') && i.proj && !i.mccTs;
    var v = pr ? esc(M.posLabel(pr.P)) + (pr.u && pr.u.devs.length > 1 ? '<br><span class="muted small">' + esc(M.unitLabel(pr.P, pr.u)) + '</span>' : '')
      : '<span class="muted">' + (i.proj ? 'keine' : 'kein Projekt') + '</span>';
    if (i.mccTs) v += ' <span class="muted small">(mit Tachymeter ' + esc(i.mccTs.name) + ')</span>';
    if (edit) v += ' <button type="button" class="link-btn small" data-act="pos-wahl" data-id="' + i.g.id + '">' + (pr ? 'ändern' : 'wählen') + '</button>';
    return '<div class="at fin"><span>Offertposition</span><span>' + v + '</span></div>';
  };
  /* kurze Marke der Offertposition für Listen (statt Teilprojekt) */
  M.posTag = function (e) {
    var P = e && e.ort === 'feld' && e.positionId && M.idx().pos[e.positionId];
    return P ? '<br><span class="au-tag fin" title="' + esc(M.posLabel(P)) + '">' + esc(P.nr ? 'Pos. ' + P.nr : P.text.slice(0, 24)) + '</span>' : '';
  };

  /* Kopf und Aktionen eines Geräts (Kartenpanel und Gerätefenster) */
  M.detailHead = function (gid, big) {
    var i = M.info(gid), g = i.g, kname = i.kat ? i.kat.name : M.typLabel[g.typ];
    if (i.members) kname = 'Messstelle · ' + i.members.length + (i.members.length === 1 ? ' Gerät' : ' Geräte');
    return '<div class="dt-head">' + M.symbol(gid, big ? 56 : 52) + '<div class="dt-t"><h2' + (big ? ' id="dw-t"' : '') + (g.name.length > 24 ? ' class="xlong"' : g.name.length > 12 ? ' class="long"' : '') + ' title="' + esc(g.name) + '">' + esc(g.name) + '</h2><span>' + esc(kname) +
      (g.gtyp && g.gtyp !== kname ? ' · ' + esc(g.gtyp) : '') + '</span></div></div>' +
      '<div class="dt-loc">' + M.stateChip(gid) + '<div><b>' + esc(i.mccTs ? 'beim Tachymeter ' + i.mccTs.name : i.ortText) + '</b>' +
      (i.proj ? '<span>Projekt ' + esc(M.projName(i.proj)) + '</span>' : i.res ? '<span class="res-t">reserviert für ' + esc(M.projName(i.res.proj)) + (i.res.ab ? ' · ab ' + M.fmtDate(i.res.ab) : '') + '</span>' : (i.cur && !i.isMag ? '<span class="muted">ohne Projekt</span>' : '')) + '</div></div>';
  };
  var ICO = {
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
    details: '<rect x="3.5" y="4.5" width="17" height="15" rx="1"/><path d="M3.5 9h17M8 13h8M8 16h5"/>',
    projekt: '<path d="M4 8h13M14 5l3 3-3 3"/><path d="M20 16H7M10 13l-3 3 3 3"/>',
    pos: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    wartung: '<path d="M14.6 5.4a4.2 4.2 0 0 0-5.3 5.3L4 16l4 4 5.3-5.3a4.2 4.2 0 0 0 5.3-5.3l-2.7 2.7-2.6-.7-.7-2.6z"/>',
    kabel: '<circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="5.5" r="2"/><path d="M7.3 17.6C12 15.5 9 9.5 16.7 6.4"/>',
    dup: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="1"/><path d="M15.5 8.5V4H4v11.5h4.5"/>',
    karte: '<path d="M9 4.5l-5.5 2v13l5.5-2 6 2 5.5-2v-13l-5.5 2z"/><path d="M9 4.5v13M15 6.5v13"/>',
    del: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>',
    res: '<path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1z"/>',
    qr: '<rect x="4" y="4" width="6" height="6" rx=".5"/><rect x="14" y="4" width="6" height="6" rx=".5"/><rect x="4" y="14" width="6" height="6" rx=".5"/><path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 20h1.5M20 14v1.5"/>'
  };
  function ico(k) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + ICO[k] + '</svg>'; }
  function act(a, gid, k, label, cls) { return '<button type="button" class="pa-b' + (cls ? ' ' + cls : '') + '" data-act="' + a + '" data-id="' + gid + '">' + ico(k) + '<span>' + label + '</span></button>'; }
  M.ico = ico;

  /* Laufzeit laut Offerte: Balken wie bei der Wartung, Abbaumonat, Hinweis mit Bestätigung */
  function lzBox(gid, z) {
    var mt = function (n) { return n + (n === 1 ? ' Monat' : ' Monate'); };
    var wann = z.rest > 1 ? 'in ' + z.rest + ' Monaten' : z.rest === 1 ? 'nächsten Monat' : z.rest === 0 ? 'diesen Monat' : 'seit ' + (-z.rest === 1 ? '1 Monat' : (-z.rest) + ' Monaten') + ' überfällig';
    var warn = z.warn, h = '<div class="wbox lzbox' + (warn ? ' due' : z.ok ? ' okd' : '') + '"><div class="wb-r"><b>' + (warn ? 'Abbau fällig – Offertdauer erreicht' : 'In Betrieb laut Offerte') + '</b><b class="mono">' + z.n + ' / ' + mt(z.off) + '</b></div>' +
      '<div class="bar"><span style="width:' + Math.round(z.pct * 100) + '%"></span></div>' +
      '<div class="wb-s">Abbau bis Ende <b>' + M.monatName(z.abbau) + '</b> · ' + wann + ' · Pos. ' + esc(z.P.nr || '?') + ': ' +
      (z.set ? (z.nU > 1 ? z.offTotal + ' Monate für ' + z.nU + ' Sets = ' + mt(z.off) + ' pro Set' : mt(z.off) + ' für das Set') : mt(z.off) + ' pro Gerät') +
      (z.ueber ? ' · ' + mt(z.ueber) + ' über der Offerte' : '') + '</div>';
    if (warn) h += '<div class="wb-s">Die offerierte Dauer ist ' + (z.rest < 0 ? 'abgelaufen' : 'Ende Monat erreicht') + '. Gerät abbauen' + (z.set ? ' (ganzes Set)' : '') + ' oder bestätigen, dass es weiterläuft – dann verschwindet die Warnung.</div>' +
      (M.can('edit') ? '<div class="wb-a"><button type="button" class="btn sm" data-act="move" data-id="' + gid + '">Abbauen …</button><button type="button" class="btn sm ghost" data-act="abbau-ok" data-id="' + gid + '">Weiterführen bestätigen</button></div>' : '');
    else if (z.ok) h += '<div class="wb-s">Weiterführen bestätigt am ' + M.fmtDate(z.ok.datum) + (z.ok.wer ? ' von ' + esc(z.ok.wer) : '') +
      (M.can('edit') ? ' · <button type="button" class="link-btn" data-act="abbau-undo" data-id="' + gid + '">zurücknehmen</button>' : '') + '</div>';
    return h + '</div>';
  }
  M.lzBox = lzBox;
  /* kleines Etikett «bis 03.27» für die geplante Laufzeit (rot = überfällig) */
  M.planTag = function (e) {
    var p = M.planInfo(e); if (!p || !p.laufend) return '';
    return ' <span class="pl-tag' + (p.ueber ? ' over' : p.rest < 31 ? ' soon' : '') + '" title="' + esc(M.planText(e)) + '">bis ' + p.bis.slice(5, 7) + '.' + p.bis.slice(2, 4) + '</span>';
  };
  /* Aktionen: Kartenpanel = Hauptaktionen + Raster mit Symbolen; Gerätefenster = Werkzeugleiste */
  M.detailActions = function (gid, big) {
    var i = M.info(gid), inInventar = M.state.view === 'inventar' || M.state.view === 'tachymeter';
    var sec = [];
    if (i.members) {
      sec.push(act('move', gid, 'projekt', 'Projekt ändern'));
      sec.push(act('place', gid, 'pos', i.posSrc === 'eigen' ? 'Position ändern' : 'Position setzen'));
      sec.push(act('ms-add', gid, 'dup', 'Geräte hinzufügen'));
      if (i.isMag) sec.push(act('reserve', gid, 'res', i.res ? 'Reservation ändern' : 'Reservieren'));
      if (i.pos) sec.push(act('kabel-from', gid, 'kabel', 'Kabel zeichnen'));
      if (big && i.pos) sec.push(act('show-map', gid, 'karte', 'Auf Karte'));
      if (big) sec.push(act('labels', gid, 'qr', 'Etikett drucken'));
      var delMs = '<button type="button" class="pa-del" data-act="ms-dissolve" data-id="' + gid + '">' + ico('del') + '<span>Messstelle auflösen</span></button>';
      if (big) return '<div class="pa pa-big"><button type="button" class="btn pa-main" data-act="edit" data-id="' + gid + '">' + ico('edit') + '<span>Bearbeiten</span></button>' + sec.join('') + '<span class="grow"></span>' + delMs + '</div>';
      return '<div class="pa"><div class="pa-top"><button type="button" class="btn pa-main" data-act="edit" data-id="' + gid + '">' + ico('edit') + '<span>Bearbeiten</span></button>' +
        '<button type="button" class="btn ghost pa-main" data-act="details" data-id="' + gid + '">' + ico('details') + '<span>Alle Details</span></button></div>' +
        '<div class="pa-grid">' + sec.join('') + '</div><div class="pa-foot">' + delMs + '</div></div>';
    }
    if (!i.mccTs) sec.push(act('move', gid, 'projekt', 'Projekt ändern'));
    if (i.isMag) sec.push(act('reserve', gid, 'res', i.res ? 'Reservation ändern' : 'Reservieren'));
    if (big && i.cur && !i.isMag && i.g.typ === 'sensor') sec.push(act('reserve', gid, 'res', 'Ins Magazin & reservieren'));
    if (i.cur && !i.isMag && !i.mccTs) sec.push(act('place', gid, 'pos', i.posSrc === 'eigen' ? 'Position ändern' : 'Position setzen'));
    if (i.wart) sec.push(act('wartung', gid, 'wartung', 'Wartung erfassen'));
    if (i.pos && !i.mccTs) sec.push(act('kabel-from', gid, 'kabel', 'Kabel zeichnen'));
    if (big && inInventar) sec.push(act('dup', gid, 'dup', 'Duplizieren'));
    if (big && i.pos) sec.push(act('show-map', gid, 'karte', 'Auf Karte'));
    if (big) sec.push(act('labels', gid, 'qr', 'Etikett drucken'));
    var del = '<button type="button" class="pa-del" data-act="g-del-direct" data-id="' + gid + '">' + ico('del') + '<span>Löschen</span></button>';
    if (big) {
      return '<div class="pa pa-big"><button type="button" class="btn pa-main" data-act="edit" data-id="' + gid + '">' + ico('edit') + '<span>Bearbeiten</span></button>' +
        sec.join('') + '<span class="grow"></span>' + del + '</div>';
    }
    return '<div class="pa"><div class="pa-top"><button type="button" class="btn pa-main" data-act="edit" data-id="' + gid + '">' + ico('edit') + '<span>Bearbeiten</span></button>' +
      '<button type="button" class="btn ghost pa-main" data-act="details" data-id="' + gid + '">' + ico('details') + '<span>Alle Details</span></button></div>' +
      (sec.length ? '<div class="pa-grid">' + sec.join('') + '</div>' : '') +
      '<div class="pa-foot">' + del + '</div></div>';
  };

  /* mode 'kompakt' = Kartenpanel (nur das Nötigste), 'tab' = Reiter «Gerät» im Gerätefenster */
  M.detailHtml = function (gid, mode) {
    var I = M.idx(), i = M.info(gid), g = i.g, full = mode === 'tab';
    var kname = i.kat ? i.kat.name : M.typLabel[g.typ];
    var h = '';
    if (!full) h += M.detailHead(gid) + M.detailActions(gid);
    if (i.members) return h + M.gruppeHtml(gid, full);
    if (i.ms) h += '<div class="hint">Teil der Messstelle <button type="button" class="link-btn" data-act="open-any" data-id="' + i.ms.id + '">' + esc(i.ms.name) + '</button>' +
      (i.msBei ? ' und wechselt den Standort mit ihr. ' : ', steht aber laut eigener Historie an einem eigenen Standort (' + esc(i.ortText) + ') und wechselt nicht mit. Mit der Montage im Projekt der Messstelle gehört es wieder zu ihr. ') +
      '<button type="button" class="link-btn" data-act="ms-remove" data-id="' + gid + '">Herauslösen</button></div>';
    if (i.wart) {
      var w = i.wart, pct = Math.min(100, Math.round(w.pct * 100));
      h += '<div class="wbox' + (w.faellig ? ' due' : '') + '"><div class="wb-r"><b>In Betrieb seit letzter Wartung</b><b class="mono">' + w.tage + ' / ' + w.limit + ' Tage</b></div>' +
        '<div class="bar"><span style="width:' + pct + '%"></span></div>' +
        '<div class="wb-s">Intervall ' + w.intervall + ' Monate · letzte Wartung ' + M.fmtDate(w.letzte) + ' · ' +
        (w.rest > 0 ? 'noch ' + w.rest + ' Tage' : 'überfällig seit ' + (-w.rest) + ' Tagen') + ' · Magazin zählt nicht</div></div>';
    }
    if (i.lz) h += lzBox(gid, i.lz);
    if (i.ortFehlt) h += '<div class="hint warn">Die genaue Position fehlt.' + (i.posSrc === 'projekt' ? ' Das Symbol steht vorläufig an der Projektmitte.' : ' Ohne Position erscheint das Gerät nicht auf der Karte.') +
      ' <button type="button" class="link-btn" data-act="place" data-id="' + gid + '">Jetzt setzen</button></div>';

    // MCC als Zusatz zum Tachymeter
    if (g.typ === 'tachymeter') {
      var mc = M.mccOf(gid);
      h += '<div class="addon"><div class="addon-h"><span>MCC TSC</span>' +
        '<button type="button" class="link-btn" data-act="mcc-pick" data-id="' + gid + '">' + (mc ? 'Wechseln' : 'Zuordnen') + '</button></div>';
      if (mc) {
        var mi = M.info(mc.id);
        h += '<button type="button" class="addon-b" data-act="open" data-id="' + mc.id + '">' + M.symbol(mc.id, 30) + '<span class="rb-t"><b>' + esc(mc.name) + '</b><span>' +
          esc([mc.gtyp, mc.sim ? 'SIM ' + mc.sim : 'ohne SIM', full && M.can('fin') ? 'Restwert CHF ' + M.chf(mi.restwert) : ''].filter(Boolean).join(' · ')) + '</span></span><span class="chev">›</span></button>';
      } else h += '<p class="muted small">Keine MCC zugeordnet.</p>';
      h += '</div>';
    }
    if (i.mccTs) {
      h += '<div class="hint">Diese MCC steuert <button type="button" class="link-btn" data-act="open" data-id="' + i.mccTs.id + '">' + esc(i.mccTs.name) + '</button> und wechselt den Standort mit ihm. ' +
        '<button type="button" class="link-btn" data-act="mcc-free" data-id="' + i.mccTs.id + '">Lösen</button></div>';
    }

    h += '<div class="sec-h"><span>Attribute</span></div><div class="attrs">';
    h += attr('Gerätetyp', esc(M.typLabel[g.typ]));
    if (g.typ === 'sensor') h += attr('Kategorie', esc(kname));
    if (g.gtyp) h += attr('Typ', esc(g.gtyp));
    if (full && g.hersteller) h += attr('Hersteller', esc(g.hersteller));
    if (g.seriennummer) h += attr('Seriennummer', esc(g.seriennummer), 'mono');
    if (full) {
      h += attr('Kaufdatum', M.fmtDate(g.kaufdatum));
      if (M.can('fin')) h += attr('Anschaffungswert', M.has(g.wert) ? 'CHF ' + M.chf(g.wert) : '–');
      if (M.can('fin')) h += attr('Amortisation', i.ertrag ? '<span class="ok-t">abbezahlt · CHF ' + M.chf(i.ertrag) + ' Ertrag</span>' : (i.restwert !== null ? 'noch CHF ' + M.chf(i.restwert) + ' offen' : '–') +
        ' <button type="button" class="link-btn" data-act="dw-tab" data-k="amort">Details</button>');
    }
    if (g.typ !== 'tachymeter' || g.sim) h += attr('SIM-Karte', g.sim ? esc(g.sim) : '<span class="muted">keine</span>', g.sim ? 'mono' : '');
    if (g.typ === 'mcc') {
      h += attr('WLAN-Passwort', g.wlanPasswort ? '<span class="pw"><span class="mono pw-v" data-pw="' + esc(g.wlanPasswort) + '">••••••••</span>' +
        '<button type="button" class="link-btn" data-act="pw-show">Zeigen</button><button type="button" class="link-btn" data-act="pw-copy" data-pw="' + esc(g.wlanPasswort) + '">Kopieren</button></span>' : '<span class="muted">nicht erfasst</span>');
    }
    if (full) h += attr('Standort', esc(i.mccTs ? 'beim Tachymeter ' + i.mccTs.name : i.ortText));
    h += attr('Projekt', i.proj ? esc(M.projName(i.proj)) : '<span class="muted">–</span>');
    if (i.res) h += attr('Reserviert für', esc(M.projName(i.res.proj)) + (i.res.ab ? ' · Montage ab ' + M.fmtDate(i.res.ab) : '') + (i.res.bemerkung ? '<br><span class="muted small">' + esc(i.res.bemerkung) + '</span>' : '') +
      ' <button type="button" class="link-btn" data-act="reserve" data-id="' + gid + '">ändern</button>');
    if (i.cur && !i.isMag) {
      h += M.posAttr(i);
      h += attr('Laufzeit', M.planInfo(i.cur) ? '<span class="' + (M.planInfo(i.cur).ueber ? 'warn-t' : '') + '">' + esc(M.planText(i.cur)) + '</span> <button type="button" class="link-btn small" data-act="laufzeit" data-id="' + i.g.id + '">ändern</button>' : '<span class="muted">nicht geplant</span> <button type="button" class="link-btn small" data-act="laufzeit" data-id="' + i.g.id + '">planen</button>');
    }
    h += attr('Seit', i.cur ? M.fmtDate(i.cur.von) + (i.cur.gesetztVon ? ' · ' + esc(i.cur.gesetztVon) : '') : '–');
    h += attr('Position LV95', i.posSrc === 'eigen' ? M.fmtLv95(i.pos.lat, i.pos.lng) : (i.isMag ? 'im Magazin' : '<span class="warn-t">nicht gesetzt</span>'), i.posSrc === 'eigen' ? 'mono' : '');
    if (i.kat && i.kat.felder && i.kat.felder.length) {
      i.kat.felder.forEach(function (f) {
        var v = g.extra && g.extra[f.name];
        h += attr(f.name, !M.has(v) ? '–' : (f.typ === 'datum' ? M.fmtDate(v) : esc(v)));
      });
    }
    if (g.bemerkung) h += attr('Bemerkung', esc(g.bemerkung), 'pre');
    h += '</div>';
    if (!full) h += M.filesCompact('geraet', gid);

    if (i.kabel.length) {
      h += '<div class="sec-h"><span>Kabel · ' + i.kabel.length + '</span></div>';
      i.kabel.forEach(function (k) {
        var t = M.kabelTypen[k.typ] || M.kabelTypen.andere;
        var other = k.zuId === gid ? k.vonId : k.zuId, og = other && I.ger[other];
        h += '<button type="button" class="row-btn" data-act="kabel-sel" data-id="' + k.id + '"><span class="kab-ic" style="--c:' + t.color + '" aria-hidden="true"></span><span class="rb-t"><b>' +
          esc(k.name || t.name) + '</b><span>' + M.fmtLen(M.lineLen(k.punkte)) + (og ? ' · zu ' + esc(og.name) : '') + '</span></span><span class="chev">›</span></button>';
      });
    }

    return h;
  };

  /* ================================================== INVENTAR */
  M.invRows = function () {
    var f = M.state.filters.inv, q = f.q.trim().toLowerCase();
    return geraete().filter(function (g) {
      var i = M.info(g.id);
      if (f.typ && g.typ !== f.typ) return false;
      if (f.gruppe && i.gruppe !== f.gruppe) return false;
      if (f.ort === 'feld' && (i.isMag || !i.cur)) return false;
      if (f.ort && f.ort !== 'feld' && (!i.isMag || !i.mag || i.mag.id !== f.ort)) return false;
      if (f.projekt && (!i.proj || i.proj.id !== f.projekt) && (!i.res || i.res.proj.id !== f.projekt)) return false;
      if (f.zustand) {
        if (f.zustand === 'issue' && !i.issue) return false;
        if (f.zustand === 'reserviert' && (!i.res || g.zustand === 'ausgemustert')) return false;
        if ((f.zustand === 'defekt' || f.zustand === 'ausgemustert') && g.zustand !== f.zustand) return false;
      } else if (g.zustand === 'ausgemustert') return false;
      if (q) {
        var hay = [g.name, i.kat && i.kat.name, g.hersteller, g.seriennummer, g.sim, g.gtyp, i.ortText, M.projName(i.proj), i.res ? M.projName(i.res.proj) : '', g.bemerkung].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'de', { numeric: true }); });
  };

  M.renderInventar = function () {
    var f = M.state.filters.inv, rows = M.invRows(), sel = M.state.invSel;
    var nSel = Object.keys(sel).filter(function (k) { return sel[k]; }).length;
    var gruppen = opt('', 'alle Gruppen', !f.gruppe) + S.GRUPPEN_ORDER.map(function (k) { return opt(k, S.GRUPPEN[k].name, f.gruppe === k); }).join('');
    var orte = opt('', 'überall', !f.ort) + opt('feld', 'im Feld', f.ort === 'feld') + M.magazine().map(function (m) { return opt(m.id, m.name, f.ort === m.id); }).join('');
    var h = '<div class="page"><div class="page-h"><h1>Inventar</h1><span class="muted">' + rows.filter(function (g) { return g.typ !== 'messstelle'; }).length + ' von ' + geraete().filter(function (g) { return g.typ !== 'messstelle'; }).length + ' Geräten</span><span class="grow"></span>' +
      '<button type="button" class="btn ghost" data-act="scan-multi">' + ico('qr') + ' Scannen</button>' +
      '<label class="btn ghost file-btn desk-only">CSV-Import<input type="file" accept=".csv,text/csv" data-change="import-csv"></label>' +
      '<button type="button" class="btn ghost desk-only" data-act="export-csv">Excel-Export</button>' +
      '<button type="button" class="btn" data-act="new">+ Gerät</button></div>';
    var nFilt = ['typ', 'gruppe', 'ort', 'projekt', 'zustand'].filter(function (k) { return f[k]; }).length;
    h += '<div class="filters' + (M.state.invFiltOpen ? ' open' : '') + '">' +
      '<label class="fld search"><span class="sr">Suchen</span><input id="inv-q" type="search" placeholder="Name, Seriennummer, SIM, Ort …" value="' + esc(f.q) + '" data-input="invf" data-k="q"></label>' +
      '<button type="button" class="btn ghost m-only f-tog" data-act="inv-filt" aria-expanded="' + !!M.state.invFiltOpen + '">Filter' + (nFilt ? ' <b class="t-n">' + nFilt + '</b>' : '') + '</button>' +
      '<label class="fld"><span>Gerätetyp</span><select id="inv-typ" data-change="invf" data-k="typ">' + opt('', 'alle', !f.typ) + opt('sensor', 'Sensoren', f.typ === 'sensor') + opt('tachymeter', 'Tachymeter', f.typ === 'tachymeter') + opt('mcc', 'MCC TSC', f.typ === 'mcc') + opt('messstelle', 'Messstellen', f.typ === 'messstelle') + '</select></label>' +
      '<label class="fld"><span>Gruppe</span><select id="inv-grp" data-change="invf" data-k="gruppe">' + gruppen + '</select></label>' +
      '<label class="fld"><span>Standort</span><select id="inv-ort" data-change="invf" data-k="ort">' + orte + '</select></label>' +
      '<label class="fld"><span>Projekt</span><select id="inv-proj" data-change="invf" data-k="projekt">' + projOptions(f.projekt, true, 'alle Projekte', true) + '</select></label>' +
      '<label class="fld"><span>Zustand</span><select id="inv-zst" data-change="invf" data-k="zustand">' + opt('', 'in Betrieb (ohne ausgemustert)', !f.zustand) +
      opt('issue', 'Handlungsbedarf', f.zustand === 'issue') + opt('reserviert', 'reserviert (im Magazin)', f.zustand === 'reserviert') + opt('defekt', 'defekt', f.zustand === 'defekt') + opt('ausgemustert', 'ausgemustert', f.zustand === 'ausgemustert') + '</select></label></div>';
    if (nSel) {
      h += '<div class="bulk"><b>' + nSel + ' ausgewählt</b><span class="grow"></span><div class="bulk-b">' +
        '<button type="button" class="btn sm inv" data-act="bulk-move">Projekt ändern …</button>' +
        '<button type="button" class="btn sm inv" data-act="bulk-pos">Position ändern …</button>' +
        '<button type="button" class="btn sm inv" data-act="bulk-ms">Zu Messstelle zusammenfassen …</button>' +
        '<button type="button" class="btn sm inv fin" data-act="bulk-poswahl">Offertposition wählen …</button>' +
        '<button type="button" class="btn sm inv" data-act="bulk-plan">Laufzeit planen …</button>' +
        '<button type="button" class="btn sm inv" data-act="bulk-mag">Ins Magazin …</button>' +
        '<button type="button" class="btn sm inv" data-act="bulk-res">Reservieren …</button>' +
        '<button type="button" class="btn sm inv" data-act="bulk-hist">Historie anpassen …</button>' +
        '<button type="button" class="btn sm inv" data-act="bulk-zst">Zustand ändern …</button>' +
        '<button type="button" class="btn sm inv" data-act="bulk-labels">Etiketten drucken …</button>' +
        '<button type="button" class="btn sm inv" data-act="bulk-del">Löschen …</button>' +
        '<button type="button" class="btn sm inv-solid" data-act="bulk-clear">Auswahl aufheben</button></div></div>';
    }
    // Geräte einer Messstelle erscheinen nicht einzeln, sondern unter ihrer Messstelle (aufklappbar)
    var I = M.idx(), inRows = {}, disp = [], seenMs = {}, q = f.q.trim().toLowerCase();
    rows.forEach(function (g) { inRows[g.id] = true; });
    rows.forEach(function (g) {
      var i = M.info(g.id);
      var ms = g.typ === 'messstelle' ? g : i.ms;
      if (ms) { if (!seenMs[ms.id]) { seenMs[ms.id] = true; disp.push(ms); } }
      else disp.push(g);
    });
    var nGer = rows.filter(function (g) { return g.typ !== 'messstelle'; }).length;
    M.state.invVisible = disp.map(function (g) { return g.id; });
    var sumW = 0, sumR = 0, open = M.state.invOpen || (M.state.invOpen = {});
    h += '<label class="chk m-only inv-allm"><input type="checkbox" data-change="inv-all" aria-label="Alle auswählen"' + (disp.length && disp.every(function (g) { return sel[g.id]; }) ? ' checked' : '') + '> Alle ' + disp.length + ' auswählen</label>';
    h += '<div class="tbl-wrap"><table class="tbl cards inv-tbl"><thead><tr><th class="c-chk"><input type="checkbox" id="inv-all" data-change="inv-all" aria-label="Alle auswählen"' +
      (disp.length && disp.every(function (g) { return sel[g.id]; }) ? ' checked' : '') + '></th><th></th><th>Name</th><th>Kategorie</th><th>Standort</th><th>Projekt</th><th>Hersteller</th><th>Seriennr.</th><th>Kaufdatum</th>' +
      '<th class="r fin">Wert CHF</th><th class="r fin">Restwert CHF</th><th>SIM</th><th>Zustand</th></tr></thead><tbody>';
    function uniq(arr) { var o = {}; arr.forEach(function (x) { if (M.has(x) && x !== '') o[x] = 1; }); return Object.keys(o); }
    function devRow(g, child) {
      var i = M.info(g.id);
      if (!child) { if (g.wert) sumW += +g.wert; if (i.restwert) sumR += i.restwert; }
      return '<tr class="' + (sel[g.id] ? 'sel' : '') + (child ? ' ms-child' : '') + '"><td class="c-chk"><input type="checkbox" data-change="inv-sel" data-id="' + g.id + '" aria-label="' + esc(g.name) + ' auswählen"' + (sel[g.id] ? ' checked' : '') + '></td>' +
        '<td class="c-sym">' + M.symbol(g.id, child ? 20 : 24) + '</td>' +
        '<td class="c-name' + (child ? ' ms-indent' : '') + '"><button type="button" class="link-btn strong" data-act="open" data-id="' + g.id + '">' + esc(g.name) + '</button></td>' +
        '<td class="c-kat">' + esc(i.kat ? i.kat.name : M.typLabel[g.typ]) + '</td>' +
        '<td class="c-ort' + (i.ortFehlt ? ' warn-t' : '') + '">' + esc(i.mccTs ? 'bei ' + i.mccTs.name : i.ortText) + '</td>' +
        '<td class="c-proj' + (child || i.proj || i.res ? '' : ' m-empty') + '">' + (i.proj ? esc(M.projName(i.proj)) : i.res ? '<span class="res-t">res. ' + esc(M.projName(i.res.proj)) + '</span>' : '<span class="muted">–</span>') + M.posTag(i.cur) + M.planTag(i.cur) + '</td>' +
        '<td class="m-hide">' + esc(g.hersteller || '') + '</td><td class="mono m-hide">' + esc(g.seriennummer || '') + '</td>' +
        '<td class="mono m-hide">' + M.fmtDate(g.kaufdatum) + '</td>' +
        '<td class="r mono m-hide fin">' + M.chf(g.wert) + '</td>' +
        '<td class="r mono calc c-rest fin" data-l="Restwert">' + M.chf(i.restwert) + '</td>' +
        '<td class="m-hide ' + (g.sim ? 'mono' : 'muted') + '">' + esc(g.sim || 'keine') + '</td>' +
        '<td class="c-zst">' + M.stateChip(g.id) + '</td></tr>';
    }
    disp.forEach(function (g) {
      var i = M.info(g.id);
      if (!i.members) { h += devRow(g, false); return; }
      var mem = i.members.map(function (id) { return I.ger[id]; });
      var shown = mem.filter(function (m) { return inRows[m.id]; });
      if (!shown.length) shown = mem;
      var w = 0, r = 0;
      mem.forEach(function (m) { w += M.num(m.wert) || 0; r += M.info(m.id).restwert || 0; });
      sumW += w; sumR += r;
      var her = uniq(mem.map(function (m) { return m.hersteller; })), kd = uniq(mem.map(function (m) { return m.kaufdatum; })).sort();
      var nSim = mem.filter(function (m) { return m.sim; }).length;
      // Standard: zugeklappt. Eigene Wahl (▸/▾) gilt immer; nur ohne eigene Wahl klappt die Suche auf, wenn sie Geräte darin findet
      var isOpen = Object.prototype.hasOwnProperty.call(open, g.id) ? !!open[g.id] :
        !!(q && g.name.toLowerCase().indexOf(q) < 0 && shown.length < mem.length);
      h += '<tr class="ms-parent' + (sel[g.id] ? ' sel' : '') + '"><td class="c-chk"><input type="checkbox" data-change="inv-sel" data-id="' + g.id + '" aria-label="' + esc(g.name) + ' auswählen"' + (sel[g.id] ? ' checked' : '') + '></td>' +
        '<td class="c-sym">' + M.symbol(g.id, 24) + '</td>' +
        '<td class="c-name"><span class="ms-nm"><button type="button" class="ms-tog" data-act="inv-open" data-id="' + g.id + '" aria-expanded="' + !!isOpen + '" aria-label="' + (isOpen ? 'Geräte zuklappen' : 'Geräte aufklappen') + '">' + (isOpen ? '▾' : '▸') + '</button>' +
        '<button type="button" class="link-btn strong" data-act="open" data-id="' + g.id + '">' + esc(g.name) + '</button></span></td>' +
        '<td class="c-kat">Messstelle · ' + mem.length + (mem.length === 1 ? ' Gerät' : ' Geräte') + (function () {
          var weg = mem.filter(function (m) { return !M.info(m.id).msBei; }), res = weg.filter(function (m) { return M.info(m.id).res; }).length;
          return weg.length ? '<br><span class="small ' + (res ? 'res-t' : 'muted') + '">' + (res ? res + ' reserviert im Magazin' : '') + (weg.length > res ? (res ? ' · ' : '') + (weg.length - res) + ' an eigenem Standort' : '') + '</span>' : '';
        })() + '</td>' +
        '<td class="c-ort' + (i.ortFehlt ? ' warn-t' : '') + '">' + esc(i.ortText) + '</td>' +
        '<td class="c-proj">' + (i.proj ? esc(M.projName(i.proj)) : '<span class="muted">–</span>') + M.posTag(i.cur) + M.planTag(i.cur) + '</td>' +
        '<td class="m-hide">' + esc(her.length === 1 ? her[0] : her.length ? 'gemischt' : '') + '</td><td class="muted m-hide">' + mem.length + ' Stk.</td>' +
        '<td class="mono m-hide">' + (kd.length === 1 ? M.fmtDate(kd[0]) : kd.length ? M.fmtDate(kd[0]) + ' –<br>' + M.fmtDate(kd[kd.length - 1]) : '–') + '</td>' +
        '<td class="r mono m-hide fin">' + M.chf(w) + '</td><td class="r mono calc c-rest fin" data-l="Restwert">' + M.chf(r) + '</td>' +
        '<td class="m-hide ' + (nSim ? '' : 'muted') + '">' + (nSim ? nSim + ' SIM' : 'keine') + '</td><td class="c-zst">' + M.stateChip(g.id) + '</td></tr>';
      if (isOpen) shown.forEach(function (m) { h += devRow(m, true); });
    });
    if (!disp.length) h += '<tr><td colspan="13" class="empty">Keine Geräte für diese Filter.</td></tr>';
    h += '</tbody><tfoot><tr><td colspan="9" class="c-foot">' + nGer + ' Geräte' + (function () { var k = Object.keys(seenMs), n = 0; k.forEach(function (id) { n += (I.members[id] || []).length; }); return k.length ? ' · ' + n + ' davon in ' + k.length + (k.length === 1 ? ' Messstelle' : ' Messstellen') : ''; })() + '</td><td class="r mono fin" data-l="Wert">' + M.chf(sumW) + '</td><td class="r mono calc fin" data-l="Restwert">' + M.chf(sumR) + '</td><td colspan="2" class="muted m-hide fin">Restwert = Wert − gebuchte Amortisation</td></tr></tfoot></table></div></div>';
    keepScroll($('v-inventar'), h);
  };

  /* ================================================== TACHYMETER & MCC */
  M.renderTachy = function () {
    var I = M.idx();
    var byName = function (a, b) { return String(a.name).localeCompare(String(b.name), 'de', { numeric: true }); };
    var tss = geraete().filter(function (g) { return g.typ === 'tachymeter' && g.zustand !== 'ausgemustert'; }).sort(byName);
    var mccs = geraete().filter(function (g) { return g.typ === 'mcc' && g.zustand !== 'ausgemustert'; }).sort(byName);
    var st = M.settings();
    var h = '<div class="page"><div class="page-h"><h1>Tachymeter &amp; MCC</h1><span class="muted">Wartungsintervall Standard ' + (st.intervall.tachymeter || '–') + ' Monate · Warnung ab ' + st.warnProzent + ' %</span><span class="grow"></span>' +
      '<span class="btn-pair"><button type="button" class="btn ghost" data-act="new" data-typ="mcc">+ MCC TSC</button><button type="button" class="btn" data-act="new" data-typ="tachymeter">+ Tachymeter</button></span></div>';
    h += '<div class="tbl-wrap"><table class="tbl cards ts-tbl"><thead><tr><th></th><th>Nummer</th><th>Typ</th><th>Seriennr.</th><th>Standort</th><th>Projekt</th><th>MCC TSC</th><th>Letzte Wartung</th><th>Seit Wartung</th><th>Zustand</th><th></th></tr></thead><tbody>';
    tss.forEach(function (t) {
      var i = M.info(t.id), w = i.wart;
      var imFeld = i.cur && !i.isMag;
      var mopts = opt('', imFeld ? '– MCC wählen –' : 'keine', !t.mccId) + mccs.map(function (m) {
        var owner = I.tsOfMcc[m.id];
        return owner && owner !== t.id ? '' : opt(m.id, m.name + (M.info(m.id).isMag && !owner ? ' · Magazin' : ''), t.mccId === m.id);
      }).join('');
      var pct = w ? Math.min(100, Math.round(w.pct * 100)) : 0;
      h += '<tr><td class="c-sym">' + M.symbol(t.id, 26) + '</td><td class="c-name"><button type="button" class="link-btn strong" data-act="open" data-id="' + t.id + '">' + esc(t.name) + '</button></td>' +
        '<td class="c-kat">' + esc(t.gtyp || '') + '</td><td class="mono c-sn">' + esc(t.seriennummer || '') + '</td><td class="c-ort' + (i.ortFehlt ? ' warn-t' : '') + '">' + esc(i.ortText) + '</td>' +
        '<td class="c-proj' + (i.proj ? '' : ' m-empty') + '">' + (i.proj ? esc(M.projName(i.proj)) : '<span class="muted">–</span>') + M.posTag(i.cur) + M.planTag(i.cur) + '</td>' +
        '<td class="c-mcc" data-l="MCC"><label class="sr" for="mcc-' + t.id + '">MCC für ' + esc(t.name) + '</label><select id="mcc-' + t.id + '" class="sel-sm" data-change="mcc" data-id="' + t.id + '">' + mopts + '</select></td>' +
        '<td class="mono m-hide">' + (w ? M.fmtDate(w.letzte) : '–') + '</td>' +
        '<td class="c-w" data-l="Seit Wartung">' + (w ? '<div class="mini-bar' + (w.faellig ? ' due' : '') + '"><span style="width:' + pct + '%"></span></div><span class="mono small">' + w.tage + ' / ' + w.limit + ' T' + (i.isMag ? ' ‖' : '') + '</span>' : '–') + '</td>' +
        '<td class="c-zst">' + M.stateChip(t.id) + '</td><td class="c-act"><button type="button" class="btn sm ghost" data-act="wartung" data-id="' + t.id + '">Wartung</button></td></tr>';
    });
    if (!tss.length) h += '<tr><td colspan="11" class="empty">Noch keine Tachymeter erfasst.</td></tr>';
    h += '</tbody></table></div><p class="muted small">‖ = Zähler steht, Gerät im Magazin. Die MCC wechselt den Standort mit ihrem Tachymeter und erscheint nicht separat auf der Karte. Kommt der Tachymeter ins Magazin, wird die MCC frei.</p>';

    h += '<h2 class="h2">MCC TSC</h2><div class="tbl-wrap"><table class="tbl cards mcc-tbl"><thead><tr><th></th><th>Bezeichnung</th><th>Typ</th><th>An Tachymeter</th><th>Standort</th><th>SIM</th><th class="r fin">Restwert CHF</th></tr></thead><tbody>';
    mccs.forEach(function (m) {
      var i = M.info(m.id), t = i.mccTs;
      h += '<tr><td class="c-sym">' + M.symbol(m.id, 24) + '</td><td class="c-name"><button type="button" class="link-btn strong" data-act="open" data-id="' + m.id + '">' + esc(m.name) + '</button></td>' +
        '<td class="c-kat">' + esc(m.gtyp || '') + '</td><td class="c-zst">' + (t ? '<button type="button" class="link-btn" data-act="open" data-id="' + t.id + '">' + esc(t.name) + '</button>' : '<span class="chip chip-free">Frei</span>') + '</td>' +
        '<td class="c-ort">' + esc(t ? 'bei ' + t.name : i.ortText) + '</td><td class="c-sim ' + (m.sim ? 'mono' : 'muted') + '" data-l="SIM">' + esc(m.sim || 'keine') + '</td><td class="r mono calc c-rest fin" data-l="Restwert">' + M.chf(i.restwert) + '</td></tr>';
    });
    if (!mccs.length) h += '<tr><td colspan="7" class="empty">Noch keine MCC erfasst.</td></tr>';
    h += '</tbody></table></div></div>';
    keepScroll($('v-tachymeter'), h);
  };

  /* ================================================== PROJEKTE */
  /* ---------- Offerte & Positionen, Abrechnung nach Gruppen */
  var MON_K = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  function monLabel(mk, lang) { var m = +mk.slice(5, 7) - 1; return MON_K[m] + (lang ? ' ' + mk.slice(0, 4) : ' ' + mk.slice(2, 4)); }
  M.monLabel = monLabel;
  function f2(n) { return M.has(n) && +n ? M.chf(Math.round(n * 100) / 100) : '–'; }
  function chf2(n) { return (Math.round((+n || 0) * 100) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "'"); }
  M.abrRange = function (p) {
    var a = M.state.abr;
    if (a && a.pid === p.id) return a;
    var now = M.today().slice(0, 7), y0 = +now.slice(0, 4), m0 = +now.slice(5, 7) - 1; if (m0 < 1) { m0 += 12; y0--; }
    var bis = y0 + '-' + (m0 < 10 ? '0' : '') + m0;   // bis Ende des letzten ganzen Monats
    var first = M.state.data.einsaetze.filter(function (e) { return e.projektId === p.id; }).map(function (e) { return e.von; }).sort()[0];
    var y = y0, m = m0 - 5; while (m < 1) { m += 12; y--; }
    var von = y + '-' + (m < 10 ? '0' : '') + m;
    if (first && first.slice(0, 7) > von) von = first.slice(0, 7);
    return (M.state.abr = { pid: p.id, von: von, bis: bis });
  };
  /* Positionen eines Projekts */
  /* Monate einer Position: Balken verrechnet (voll) und geplant (hell) gegenüber der Offerte */
  function pmHtml(m) {
    var max = Math.max(m.off, m.geplant, m.verr, 1), over = m.off && m.geplant > m.off, overV = m.off && m.verr > m.off;
    var bar = '<span class="pm-bar"><i class="pm-g" style="width:' + (m.geplant / max * 100).toFixed(1) + '%"></i><i class="pm-v" style="width:' + (m.verr / max * 100).toFixed(1) + '%"></i>' +
      (m.off ? '<i class="pm-o" style="left:' + (m.off / max * 100).toFixed(1) + '%"></i>' : '') + '</span>';
    var offT = !m.off ? '–' : m.offStk ? '<span title="' + m.offStk + ' Monate pro Gerät × ' + m.n + (m.n === 1 ? ' Gerät' : ' Geräte') + '">' + m.off + '</span>' : m.off;
    var t = '<span class="mono">' + m.verr + ' · ' + (!m.mitPlan ? '<span class="muted" title="keine Laufzeit geplant">–</span>' : m.geplant + (m.offen ? '<span class="muted" title="' + m.offen + (m.offen === 1 ? ' laufende Einheit' : ' laufende Einheiten') + ' ohne geplante Laufzeit: gezählt bis heute">+</span>' : '')) + ' · ' + offT + '</span>';
    // Laufzeit und Offertmonate sind freiwillig: Hinweise nur, wenn eine Offertmenge erfasst ist
    var geraete = function (n) { return n + (n === 1 ? ' Gerät' : ' Geräte'); };
    var note = !m.off ? '' : overV ? '<span class="pm-n bad">Offerte überschritten</span>' : over ? '<span class="pm-n warn">Plan über Offerte (+' + (m.geplant - m.off) + ')</span>' :
      m.ueberV ? '<span class="pm-n bad">' + geraete(m.ueberV) + ' über ' + m.offStk + ' Mt.</span>' : m.ueberP ? '<span class="pm-n warn">' + geraete(m.ueberP) + ' geplant über ' + m.offStk + ' Mt.</span>' : '<span class="pm-n ok">im Rahmen</span>';
    if (m.offStk) note += '<span class="pm-n">' + m.offStk + ' Mt. pro Gerät</span>';
    return '<div class="pm">' + t + bar + note + '</div>';
  }
  function posHtml(p) {
    var I = M.idx(), ps = I.posByProj[p.id] || [];
    var ohne = M.state.data.einsaetze.filter(function (e) { var g = I.ger[e.geraetId]; return e.projektId === p.id && !e.bis && e.ort === 'feld' && g && g.typ !== 'messstelle' && !(e.positionId && I.pos[e.positionId]); });
    var h = '<div class="sec-h" id="sec-pos"><span>Offertpositionen</span><span class="grow"></span><button type="button" class="btn sm" data-act="pos-new" data-id="' + p.id + '">+ Offertposition</button></div>';
    if (!ps.length) {
      return h + '<div class="hint">Noch keine Offertpositionen. Die Positionen der Offerte übernehmen: Nummer, Text, Preis pro Monat für <b>Vorhalten</b> (fliesst in die Amortisation), <b>Betrieb</b> (Lizenz, SIM) und <b>Wartung</b>. ' +
        '<b>Set-Preis</b> für mehrere Geräte zu einem Preis (z.B. Gateway + 5 Nodes), <b>Stückpreis</b> für jedes Gerät einzeln. Danach die Geräte zuweisen.' + (ohne.length ? ' Zurzeit ' + (ohne.length === 1 ? 'steht 1 Gerät' : 'stehen ' + ohne.length + ' Geräte') + ' ohne Offertposition im Projekt.' : '') + '</div>';
    }
    h += '<div class="tbl-wrap"><table class="tbl pos-tbl"><thead><tr><th>Pos.</th><th>Bezeichnung</th><th>Einheiten</th><th class="r">Vorhalten<br>CHF / Mt.</th><th class="r">Betrieb<br>CHF / Mt.</th><th class="r">Wartung<br>CHF / Mt.</th><th class="r">Aktuell<br>CHF / Mt.</th><th class="pm-h">Monate: abgerechnet · geplant · Offerte</th><th></th></tr></thead><tbody>';
    var grand = 0;
    M.ABR_ORDER.forEach(function (g) {
      var arr = ps.filter(function (x) { return (x.gruppe || 'sen') === g; }); if (!arr.length) return;
      var G = M.ABR_GRUPPEN[g], sub = 0, rows = '';
      arr.forEach(function (P) {
        var U = M.posUnits(P.id).list, akt = U.filter(function (u) { return u.aktiv; }), nd = 0;
        akt.forEach(function (u) { nd += u.devs.filter(function (id) { var g = I.ger[id]; return !(g.typ === 'mcc' && u.devs.indexOf(I.tsOfMcc[id]) >= 0); }).length; });   // MCC zählt mit ihrem Tachymeter als ein Gerät
        var cur = akt.length * M.posPreis(P); sub += cur;
        rows += '<tr class="pos-row" data-act="pos-edit" data-id="' + P.id + '" style="--gc:' + G.c + '"><td class="mono strong">' + esc(P.nr || '') + '</td>' +
          '<td><b>' + esc(P.text || '') + '</b><br><span class="muted small">' + (P.art === 'set' ? 'Set-Preis' : 'Stückpreis') + '</span></td>' +
          '<td>' + (akt.length ? '<b>' + akt.length + (P.art === 'set' ? (akt.length === 1 ? ' Set' : ' Sets') + '</b> · ' + nd + ' Geräte' : ' Stück</b>' + (nd > akt.length ? ' · ' + nd + ' Geräte' : '')) : '<span class="muted">keine laufend</span>') +
          (U.length > akt.length ? '<br><span class="muted small">' + (U.length - akt.length) + ' beendet</span>' : '') +
          (M.resCount(P.id) ? '<br><span class="res-t small">+' + M.resCount(P.id) + ' reserviert im Magazin</span>' : '') + '</td>' +
          '<td class="r mono">' + f2(P.V) + (M.amortPct(P) !== 100 ? '<br><span class="muted small" title="Anteil des Vorhaltens in der Amortisation">' + M.amortPct(P) + ' % Amort.</span>' : '') + '</td><td class="r mono">' + f2(P.B) + '</td><td class="r mono">' + (+P.W ? f2(P.W) : '–') + '</td>' +
          '<td class="r mono strong">' + M.chf(cur) + '</td><td>' + pmHtml(M.posMonate(P)) + '</td><td class="r"><span class="ic-btn" aria-hidden="true">✎</span></td></tr>';
      });
      grand += sub;
      h += '<tr class="pos-grp" style="--gc:' + G.c + ';--gl:' + G.l + '"><td colspan="6"><span class="sw"></span>' + esc(G.n) + ' <span class="muted">' + arr.length + (arr.length === 1 ? ' Offertposition' : ' Offertpositionen') + '</span></td><td class="r mono strong">' + M.chf(sub) + '</td><td></td><td></td></tr>' + rows;
    });
    h += '</tbody><tfoot><tr><td colspan="6">Total laufend (Einheiten × Preis pro Monat)</td><td class="r mono">' + M.chf(grand) + '</td><td></td><td></td></tr></tfoot></table></div>';
    if (ohne.length) h += '<p class="hint small">' + ohne.length + (ohne.length === 1 ? ' Gerät steht' : ' Geräte stehen') + ' ohne Offertposition im Projekt (' + esc(ohne.slice(0, 5).map(function (e) { return I.ger[e.geraetId].name; }).join(', ') + (ohne.length > 5 ? ' …' : '')) + '). Ohne Offertposition ' + (ohne.length === 1 ? 'erscheint es' : 'erscheinen sie') + ' nicht in der Abrechnung (' + (ohne.length === 1 ? 'seine' : 'ihre') + ' Amortisation läuft weiter über den Einzelansatz). Zuweisen: oben eine Offertposition anklicken › «Geräte im Projekt» ankreuzen. Das betrifft nur die Abrechnung – der Standort (LV95) ist davon unabhängig.</p>';
    return h;
  }
  function abrHtml(p) {
    var r = M.abrRange(p), A = M.abrechnung(p.id, r.von, r.bis), I = M.idx(), G = M.ABR_GRUPPEN, view = M.state.abrView || 'chf';
    var h = '<div class="sec-h"><span>Abrechnung nach Offertposition und Gerät</span></div><div class="abr">';
    h += '<div class="abr-ctl"><label class="fld"><span>Von</span><input type="month" value="' + r.von + '" data-change="abr" data-k="von" max="' + r.bis + '"></label>' +
      '<label class="fld"><span>Bis</span><input type="month" value="' + r.bis + '" data-change="abr" data-k="bis" min="' + r.von + '"></label>' +
      '<div class="seg abr-q" role="group" aria-label="Zeitraum schnell wählen">' +
      '<button type="button" data-act="abr-q" data-k="m1">Letzter Monat</button><button type="button" data-act="abr-q" data-k="m3">3 Monate</button><button type="button" data-act="abr-q" data-k="jahr">Dieses Jahr</button><button type="button" data-act="abr-q" data-k="alles">Ganzes Projekt</button></div>' +
      '<span class="grow"></span><button type="button" class="btn sm" data-act="abr-pdf" data-id="' + p.id + '">Abrechnung als PDF</button><button type="button" class="btn ghost sm" data-act="abr-export" data-id="' + p.id + '">Excel</button></div>';
    var nm = A.monate.length;
    if (!A.nGer) return h + '<p class="muted">In diesem Zeitraum lief kein abgerechnetes Gerät in diesem Projekt.</p></div>';
    // Positionen mit ihren Geräten: Monate, Ansatz pro Monat und Beträge
    var posten = M.abrPosten(A), mh = A.monate.map(function (mk) { return '<th class="r mo">' + monLabel(mk) + '</th>'; }).join('');
    h += '<div class="tbl-wrap"><table class="tbl abr-tbl abr-pg"><thead>' +
      '<tr><th>Offertposition / Gerät</th>' + mh + '<th class="r anz">Monate</th><th class="r vbw">Ansatz Vorh.<br>CHF / Mt.</th><th class="r vbw">Ansatz Betr.<br>CHF / Mt.</th><th class="r vbw">Ansatz Wart.<br>CHF / Mt.</th><th class="r">Vorhalten<br>CHF</th><th class="r">Betrieb<br>CHF</th><th class="r">Wartung<br>CHF</th><th class="r">Total<br>CHF</th></tr></thead><tbody>';
    function amt(x) { return x ? M.chf(Math.round(x * 100) / 100) : '<span class="muted">–</span>'; }
    function ans(x) { return x ? M.chf(x) : '<span class="muted">–</span>'; }
    M.ABR_ORDER.forEach(function (g) {
      var ps = posten.filter(function (x) { return x.g === g; }); if (!ps.length) return;
      var gs = { n: 0, v: 0, b: 0, w: 0, t: 0 };
      h += '<tr class="pg-grp" style="--gc:' + G[g].c + ';--gl:' + G[g].l + '"><td colspan="' + (nm + 1) + '"><span class="sw"></span>' + esc(G[g].n) + '</td><td class="anz"></td><td colspan="7"></td></tr>';
      ps.forEach(function (x) {
        var P = x.P, S = x.sum;
        ['n', 'v', 'b', 'w', 't'].forEach(function (k) { gs[k] += S[k]; });
        var wpTxt = '';
        h += '<tr class="pg-pos" style="--gc:' + G[g].c + '"><td>' + (P ? '<button type="button" class="link-btn strong" data-act="pos-edit" data-id="' + P.id + '">' + esc((P.nr ? P.nr + ' ' : '') + P.text) + '</button><br><span class="muted small">' + (P.art === 'set' ? 'Set-Preis' : 'Stückpreis') + ' · ' + x.rows.length + (P.art === 'set' ? (x.rows.length === 1 ? ' Set' : ' Sets') : (x.rows.length === 1 ? ' Gerät' : ' Geräte')) + '</span>' :
          '<b>Ohne Offertposition</b><br><span class="muted small">Einzelansatz je Gerät (zählt als Vorhalten)</span>') + '</td>' +
          S.per.map(function () { return '<td class="mo"></td>'; }).join('') + '<td class="anz"></td>' +
          (P ? '<td class="r mono vbw">' + ans(M.num(P.V)) + '</td><td class="r mono vbw">' + ans(M.num(P.B)) + '</td><td class="r mono vbw">' + ans(M.num(P.W)) + wpTxt + '</td>' : '<td class="vbw"></td><td class="vbw"></td><td class="vbw"></td>') +
          '<td class="r mono">' + amt(S.v) + '</td><td class="r mono">' + amt(S.b) + '</td><td class="r mono">' + amt(S.w) + '</td><td class="r mono strong">' + amt(S.t) + '</td></tr>';
        x.rows.forEach(function (r) {
          h += '<tr class="pg-dev"><td><span class="pg-ind">' + (r.set ? '<span class="muted small">' + esc(r.set) + ' · </span>' : '') + r.devs.map(function (id) { return '<button type="button" class="link-btn" data-act="open-any" data-id="' + id + '">' + esc(I.ger[id].name) + '</button>'; }).join(' + ') + (r.von ? ' <span class="pg-dat' + (r.bis ? ' ab' : '') + '">(' + esc(M.montageText(r)) + ')</span>' : '') + '</span></td>' +
            r.flags.map(function (f) { return '<td class="r mono mo">' + (f ? '1' : '<span class="muted">·</span>') + '</td>'; }).join('') +
            '<td class="r mono anz">' + r.n + '</td>' +
            (r.ohne ? '<td class="r mono vbw">' + ans(r.av) + (r.modus === 'pauschal' ? '<br><span class="small">pauschal</span>' : '') + '</td><td class="r mono vbw muted">–</td><td class="r mono vbw muted">–</td>' :
              '<td class="r mono vbw muted">' + ans(r.av) + '</td><td class="r mono vbw muted">' + ans(r.ab) + '</td><td class="r mono vbw muted">' + ans(r.aw) + (r.wp ? '<br><span class="small">+' + M.chf(r.wp) + '</span>' : '') + '</td>') +
            '<td class="r mono">' + amt(r.v) + '</td><td class="r mono">' + amt(r.b) + '</td><td class="r mono">' + amt(r.w) + '</td><td class="r mono">' + amt(r.t) + '</td></tr>';
        });
      });
      h += '<tr class="abr-sub" style="--gl:' + G[g].l + '"><td>Total ' + esc(G[g].n) + '</td>' + A.G[g].per.map(function (c) { return '<td class="r mono mo">' + (c.n || '<span class="muted">·</span>') + '</td>'; }).join('') +
        '<td class="r mono anz">' + gs.n + '</td><td class="vbw" colspan="3"></td><td class="r mono">' + amt(gs.v) + '</td><td class="r mono">' + amt(gs.b) + '</td><td class="r mono">' + amt(gs.w) + '</td><td class="r mono">' + amt(gs.t) + '</td></tr>';
    });
    var tn = posten.reduce(function (a, x) { return a + x.sum.n; }, 0);
    h += '</tbody><tfoot><tr><td>Total Projekt</td>' + A.monate.map(function (mk, i) { return '<td class="r mono mo">' + M.ABR_ORDER.reduce(function (a, g) { return a + A.G[g].per[i].n; }, 0) + '</td>'; }).join('') +
      '<td class="r mono anz">' + tn + '</td><td colspan="3"></td><td class="r mono">' + M.chf(A.total.v) + '</td><td class="r mono">' + M.chf(A.total.b) + '</td><td class="r mono">' + M.chf(A.total.w) + '</td><td class="r mono">' + M.chf(A.total.t) + '</td></tr></tfoot></table></div>';
    return h + '<p class="muted small">Abgerechnet wird pro Kalendermonat: mehr als 10 Tage in Betrieb = ganzer Monat (1), sonst nicht (·). Ansatz in CHF pro Monat, Betrag in CHF = Ansatz × Monate. Ein Set läuft, solange eines seiner Geräte im Projekt steht.</p></div>';
  }

  function einsOf(p) {
    return M.state.data.einsaetze.filter(function (e) { return p.typ === 'magazin' ? e.magazinId === p.id : e.projektId === p.id; });
  }
  M.renderProjekte = function () {
    var I = M.idx(), f = M.state.filters.proj, q = f.q.trim().toLowerCase();
    var now = {};
    var resN = {};
    M.state.data.einsaetze.forEach(function (e) { if (!e.bis && e.ort === 'magazin' && e.reserviert && e.reserviert.projektId) resN[e.reserviert.projektId] = (resN[e.reserviert.projektId] || 0) + 1; });
    var seen = {};   // Geräte zählen, nicht Einsätze (ein Gerät mit zwei offenen Einsätzen zählt einmal)
    M.state.data.einsaetze.forEach(function (e) { if (!e.bis) { var k = e.ort === 'magazin' ? e.magazinId : e.projektId; if (k && !seen[k + '|' + e.geraetId]) { seen[k + '|' + e.geraetId] = 1; now[k] = (now[k] || 0) + 1; } } });
    var list = M.state.data.projekte.filter(function (p) {
      if (f.status === 'aktiv' && (p.typ !== 'projekt' || p.status === 'abgeschlossen')) return false;
      if (f.status === 'abgeschlossen' && (p.typ !== 'projekt' || p.status !== 'abgeschlossen')) return false;
      if (f.status === 'magazin' && p.typ !== 'magazin') return false;
      if (q && M.projName(p).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return M.projName(a).localeCompare(M.projName(b), 'de', { numeric: true }); });
    if (!M.state.projSel || !I.proj[M.state.projSel]) M.state.projSel = list[0] ? list[0].id : null;

    var h = '<div class="page split' + (M.state.projMob === 'detail' && M.state.projSel ? ' show-detail' : '') + '"><div class="pl-list"><div class="page-h"><h1>Projekte</h1><span class="grow"></span><button type="button" class="btn sm" data-act="new-proj">+ Projekt</button></div>' +
      '<label class="fld search"><span class="sr">Projekt suchen</span><input id="proj-q" type="search" placeholder="Projekt suchen" value="' + esc(f.q) + '" data-input="projf" data-k="q"></label>' +
      '<div class="seg full" role="group" aria-label="Projektstatus">' +
      ['aktiv', 'abgeschlossen', 'magazin'].map(function (s) {
        return '<button type="button" data-act="projf" data-k="' + s + '" class="' + (f.status === s ? 'on' : '') + '">' + ({ aktiv: 'Aktiv', abgeschlossen: 'Abgeschlossen', magazin: 'Magazine' })[s] + '</button>';
      }).join('') + '</div><div class="pl-items">';
    list.forEach(function (p) {
      h += '<button type="button" class="pl-item' + (p.id === M.state.projSel ? ' on' : '') + '" data-act="proj-sel" data-id="' + p.id + '"><span class="pi-t">' + esc(M.projName(p)) + '</span>' + (resN[p.id] ? '<span class="pi-r" title="' + resN[p.id] + ' im Magazin reserviert">+' + resN[p.id] + '</span>' : '') + '<span class="pi-n">' + (now[p.id] || 0) + '</span></button>';
    });
    if (!list.length) h += '<p class="muted small">Keine Einträge.</p>';
    h += '</div></div><div class="pl-detail">';
    var p = I.proj[M.state.projSel];
    if (p) h += '<button type="button" class="pd-back m-only" data-act="proj-back"><span aria-hidden="true">‹</span> Alle Projekte</button>';
    h += p ? projDetail(p) : '<p class="muted">Links ein Projekt wählen oder ein neues anlegen.</p>';
    h += '</div></div>';
    keepScroll($('v-projekte'), h);
  };

  function projDetail(p) {
    var I = M.idx(), mag = p.typ === 'magazin';
    var allE = einsOf(p);
    var msJetzt = {};
    allE.forEach(function (e) { var g = I.ger[e.geraetId]; if (g && g.typ === 'messstelle' && !e.bis) msJetzt[g.id] = true; });
    var eins = allE.filter(function (e) { return I.ger[e.geraetId] && I.ger[e.geraetId].typ !== 'messstelle'; }).sort(function (a, b) { return a.von < b.von ? -1 : 1; });
    var heute = M.today();
    var jetzt = [], jSeen = {};
    eins.forEach(function (e) { if (!e.bis && !jSeen[e.geraetId]) { jSeen[e.geraetId] = 1; jetzt.push(e); } });
    var chk = M.datenCheck(p.id);
    var ger = {}, tage = 0, amort = 0;
    eins.forEach(function (e) { ger[e.geraetId] = true; tage += Math.max(0, M.days(e.von, e.bis || heute)); amort += M.einsatzAmort(e); });
    var nKab = mag ? 0 : M.state.data.kabel.filter(function (k) { return k.projektId === p.id; }).length;
    var verr = 0;
    if (!mag && eins.length && M.can('fin')) verr = M.abrechnung(p.id, eins[0].von.slice(0, 7), M.today().slice(0, 7)).total.t;
    var h = '<div class="pd-h"><div><h2>' + esc(M.projName(p)) + '</h2><span class="muted">' + (mag ? 'Magazin' : 'Projekt') + ' · ' + (p.status === 'abgeschlossen' ? 'abgeschlossen' : 'aktiv') +
      (M.has(p.lat) ? ' · LV95 ' + M.fmtLv95(p.lat, p.lng) : (mag ? ' · <span class="warn-t">Ort fehlt</span>' : '')) + (nKab ? ' · ' + nKab + ' Kabel' : '') + '</span></div><span class="grow"></span>' +
      '<button type="button" class="btn ghost sm" data-act="proj-map" data-id="' + p.id + '">Auf Karte</button>' +
      '<button type="button" class="btn ghost sm" data-act="edit-proj" data-id="' + p.id + '">Bearbeiten</button></div>';
    h += '<div class="tiles4"><div class="tile"><b>' + jetzt.length + '</b><span>Geräte jetzt ' + (mag ? 'hier' : 'im Projekt') + '</span></div><div class="tile"><b>' + Object.keys(ger).length + '</b><span>Geräte insgesamt</span></div>' +
      '<div class="tile"><b>' + M.chf(tage) + '</b><span>Gerätetage</span></div>' +
      (!mag ? (M.can('fin') ? '<div class="tile t-blue"><b>CHF ' + M.chf(verr) + '</b><span>Abgerechnet bis heute</span></div>' : '<div class="tile"><b>' + jetzt.filter(function (e) { return e.ort === 'feld'; }).length + '</b><span>Geräte im Feld</span></div>') : '<div class="tile"><b>–</b><span>Magazin: keine Amortisation</span></div>') + '</div>';

    if (chk.n && M.can('edit')) h += '<div class="hint warn">' + chk.n + (chk.n === 1 ? ' Gerät hat' : ' Geräte haben') + ' in diesem Projekt sich überschneidende Einsätze (z.B. zweimal laufend) und ' + (chk.n === 1 ? 'erscheint' : 'erscheinen') + ' doppelt. ' +
      (M.can('admin') ? '<button type="button" class="link-btn" data-act="check-open" data-id="' + p.id + '">Prüfen und bereinigen</button>' : 'Bitte einen Admin informieren (Einstellungen › Datenprüfung).') + '</div>';
    if (!mag && M.can('fin')) h += posHtml(p);
    if (!mag && M.can('fin')) h += abrHtml(p);
    if (!mag) h += '<div class="sec-h"><span>Dokumente · ' + (M.can('fin') ? 'Offerte, Pläne' : 'Pläne, Berichte') + '</span></div>' + M.filesHtml('projekt', p.id, { compactUpload: true });
    var resv = mag ? [] : M.state.data.geraete.filter(function (g) { var ii = M.info(g.id); return ii.res && ii.res.proj.id === p.id && g.zustand !== 'ausgemustert'; })
      .sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'de', { numeric: true }); });
    if (resv.length) {
      h += '<div class="sec-h"><span>Reserviert · noch im Magazin</span><span class="muted">' + resv.length + (resv.length === 1 ? ' Gerät' : ' Geräte') + '</span></div><div class="chips-wrap">' +
        resv.map(function (g) { var ii = M.info(g.id); return '<button type="button" class="dev-chip res-chip" data-act="open" data-id="' + g.id + '" title="' + esc(ii.ortText + (ii.res.bemerkung ? ' · ' + ii.res.bemerkung : '')) + '">' + M.symbol(g.id, 22) + '<span>' + esc(g.name) + '</span>' + (ii.res.positionId && M.idx().pos[ii.res.positionId] ? '<span class="muted small">Pos. ' + esc(M.idx().pos[ii.res.positionId].nr || '?') + '</span>' : '') + (ii.res.ab ? '<span class="muted small">ab ' + M.fmtDate(ii.res.ab) + '</span>' : '') + '</button>'; }).join('') + '</div>' +
        '<p class="muted small">Beim «Gerät platzieren» oder «Projekt ändern» ist dieses Projekt schon vorgewählt; mit dem Montieren endet die Reservation.</p>';
    }
    if (jetzt.length) {
      h += '<div class="sec-h"><span>Jetzt ' + (mag ? 'hier' : 'im Projekt') + '</span></div><div class="chips-wrap">';
      Object.keys(msJetzt).sort(function (a, b) { return String(I.ger[a].name).localeCompare(String(I.ger[b].name), 'de', { numeric: true }); }).forEach(function (mid) {
        h += '<button type="button" class="dev-chip ms-chip" data-act="open" data-id="' + mid + '">' + M.symbol(mid, 22) + '<span>' + esc(I.ger[mid].name) + '</span></button>';
      });
      jetzt.slice().sort(function (a, b) { return String((I.ger[a.geraetId] || {}).name).localeCompare(String((I.ger[b.geraetId] || {}).name), 'de', { numeric: true }); }).forEach(function (e) {
        var g = I.ger[e.geraetId]; if (!g) return;
        if (g.gruppeId && msJetzt[g.gruppeId]) return;
        h += '<button type="button" class="dev-chip" data-act="open" data-id="' + g.id + '">' + M.symbol(g.id, 22) + '<span>' + esc(g.name) + '</span></button>';
      });
      h += '</div>';
    }
    if (eins.length) {
      var start = eins[0].von, ende = heute;
      eins.forEach(function (e) { if (!e.bis && e.planBis && e.planBis > ende) ende = e.planBis; });
      var span = Math.max(1, M.days(start, ende)), xHeute = M.days(start, heute) / span * 100;
      h += '<div class="sec-h"><span>Welches Gerät war wann ' + (mag ? 'hier' : 'im Projekt') + '</span><span class="muted">' + M.fmtDate(start) + ' – ' + (ende > heute ? 'geplant bis ' + M.fmtDate(ende) : 'heute') + '</span></div><div class="gantt-wrap"><div class="gantt">';
      var ticks = '', d0 = new Date(start + 'T00:00:00'), step = span > 900 ? 12 : span > 300 ? 3 : 1;
      var t = new Date(d0.getFullYear(), d0.getMonth() + 1, 1), guard = 0;
      while (M.iso(t) < ende && guard++ < 300) {
        var x = M.days(start, M.iso(t)) / span * 100;
        if (t.getMonth() % step === 0) ticks += '<span class="gt" style="left:' + x.toFixed(2) + '%">' + (t.getMonth() === 0 ? t.getFullYear() : (t.getMonth() + 1) + '.' + String(t.getFullYear()).slice(2)) + '</span>';
        t = new Date(t.getFullYear(), t.getMonth() + 1, 1);
      }
      if (ende > heute) ticks += '<span class="gt g-now" style="left:' + xHeute.toFixed(2) + '%">heute</span>';
      h += '<div class="g-row g-head"><span class="g-n"></span><div class="g-track">' + ticks + '</div><span class="g-a">' + (mag ? '' : 'CHF') + '</span></div>';
      // eine Zeile pro Gerät; mehrere Einsätze (z.B. Standortwechsel im Projekt) als Balken nebeneinander
      var rows = [], byG = {};
      eins.forEach(function (e) { if (!I.ger[e.geraetId]) return; if (!byG[e.geraetId]) { byG[e.geraetId] = []; rows.push(e.geraetId); } byG[e.geraetId].push(e); });
      // sortiert nach Historie (erster Einsatz im Projekt), bei gleichem Datum nach Name (IN-2 vor IN-10)
      rows.sort(function (a, b) {
        var va = byG[a][0].von, vb = byG[b][0].von;
        return va < vb ? -1 : va > vb ? 1 : String(I.ger[a].name).localeCompare(String(I.ger[b].name), 'de', { numeric: true });
      });
      rows.forEach(function (gid) {
        var g = I.ger[gid], i = M.info(gid), grp = S.GRUPPEN[i.gruppe], es = byG[gid], sum = 0, bars = '';
        es.forEach(function (e) {
          var l = M.days(start, e.von) / span * 100, w = Math.max(0.6, M.days(e.von, e.bis || heute) / span * 100);
          sum += M.einsatzAmort(e);
          bars += '<span class="g-bar' + (e.bis ? ' done' : '') + (chk.ids[e.id] ? ' bad' : '') + '" style="left:' + l.toFixed(2) + '%;width:' + w.toFixed(2) + '%;--f:' + grp.fill + ';--i:' + grp.ink + '" title="' + esc(M.ortText(e)) + ' · ' + M.fmtDate(e.von) + ' – ' + (e.bis ? M.fmtDate(e.bis) : 'laufend') + (e.planBis ? ' · ' + M.planText(e) : '') + '"></span>' + planBar(e);
        });
        var anyFeld = es.some(function (e) { return e.ort !== 'magazin'; });
        h += '<div class="g-row' + (chk.ger[gid] ? ' g-bad' : '') + '"><button type="button" class="g-n link-btn" data-act="open" data-id="' + gid + '">' + M.symbol(gid, 18) + esc(g.name) + (es.length > 1 ? ' <span class="g-cnt" title="' + es.length + ' Einsätze in diesem Projekt">' + es.length + '×</span>' : '') + '</button>' +
          '<div class="g-track">' + (ende > heute ? '<span class="g-today" style="left:' + xHeute.toFixed(2) + '%"></span>' : '') + bars + '</div>' +
          '<span class="g-a mono">' + (sum ? M.chf(sum) : (mag || !anyFeld ? '' : '–')) + '</span></div>';
      });
      if (!mag) h += '<div class="g-row g-sum"><span class="g-n">Summe</span><div class="g-track"></div><span class="g-a mono">' + M.chf(amort) + '</span></div>';
      h += '</div></div><p class="muted small">Schraffiert = abgeschlossener Einsatz. Gestrichelt = geplante Laufzeit; rot = länger im Einsatz als geplant.</p>';
      function planBar(e) {
        if (!e.planBis || e.ort !== 'feld') return '';
        var endIst = e.bis || heute;
        if (e.planBis > endIst && !e.bis) {   // noch geplant: gestrichelt bis Planende
          var a = M.days(start, heute) / span * 100, b = M.days(start, e.planBis) / span * 100;
          return '<span class="g-plan" style="left:' + a.toFixed(2) + '%;width:' + Math.max(0.4, b - a).toFixed(2) + '%"></span>';
        }
        if (endIst > e.planBis) {   // überzogen: rot ab Planende
          var c = M.days(start, e.planBis) / span * 100, d = M.days(start, endIst) / span * 100;
          return '<span class="g-over" style="left:' + c.toFixed(2) + '%;width:' + Math.max(0.4, d - c).toFixed(2) + '%"></span>';
        }
        return '<span class="g-pend" style="left:' + (M.days(start, e.planBis) / span * 100).toFixed(2) + '%"></span>';
      }
    } else {
      h += '<p class="muted">Noch keine Geräte. Geräte ordnet man beim Erfassen oder mit «Projekt ändern» einem Projekt zu.</p>';
    }
    return h;
  }

  /* ================================================== EINSTELLUNGEN */
  M.renderSettings = function () {
    var st = M.settings(), store = M.store;
    var h = '<div class="page narrow"><div class="page-h"><h1>Einstellungen</h1></div>';
    h += '<section class="card"><h2>Datenquelle</h2><p><b>' + esc(store.label) + '</b></p>';
    if (store.mode === 'lokal') {
      h += '<p class="muted">Die Daten liegen nur in diesem Browser auf diesem Gerät. Zum gemeinsamen Arbeiten in <code>config.js</code> auf <code>modus: \'sharepoint\'</code> umstellen (siehe ANLEITUNG.md) und die Daten mit «Sicherung exportieren» und «Sicherung importieren» übernehmen.</p>' +
        (store.persistent ? '' : '<p class="hint warn">Dieser Browser erlaubt kein dauerhaftes Speichern. Änderungen gehen beim Schliessen verloren.</p>') +
        '<label class="fld inline"><span>Mein Kürzel (für «gesetzt / geholt von»)</span><input id="set-kuerzel" maxlength="12" value="' + esc(st.kuerzel || '') + '" data-change="set-kuerzel"></label>';
    } else {
      h += '<p class="muted">Angemeldet als <b>' + esc(store.userName || '–') + '</b>' + (M.userEmail() ? ' (' + esc(M.userEmail()) + ')' : '') + ' · Rolle <b>' + esc(M.ROLLEN[M.realRole()].name) + '</b>. Die App aktualisiert sich jede Minute und beim Zurückkehren in den Tab.</p>' +
        '<button type="button" class="btn ghost sm" data-act="refresh">Jetzt aktualisieren</button> <button type="button" class="btn ghost sm" data-act="sp-folder">Dateien in SharePoint öffnen</button> <button type="button" class="btn ghost sm" data-act="logout">Abmelden</button>' +
        '<p class="muted small">Pläne, Offerten und Fotos liegen in der Dokumentbibliothek der Website im Ordner «MonInv-Dateien», sortiert nach «Projekte» und «Geräte».</p>';
    }
    h += '</section>';
    if (M.realRole() === 'admin') h += rollenHtml();
    if (M.can('admin')) h += checkHtml();

    h += '<section class="card"><h2>Wartung</h2><form class="grid3" data-form="settings-wartung">' +
      '<label class="fld"><span>Tachymeter, Monate</span><input id="set-int-ts" type="number" min="1" max="120" value="' + esc(st.intervall.tachymeter || '') + '"></label>' +
      '<label class="fld"><span>MCC TSC, Monate</span><input id="set-int-mcc" type="number" min="1" max="120" placeholder="keine" value="' + esc(st.intervall.mcc || '') + '"></label>' +
      '<label class="fld"><span>Sensoren, Monate</span><input id="set-int-sensor" type="number" min="1" max="120" placeholder="keine" value="' + esc(st.intervall.sensor || '') + '"></label>' +
      '<label class="fld"><span>Warnung ab % des Intervalls</span><input id="set-warn" type="number" min="50" max="100" value="' + esc(st.warnProzent) + '"></label>' +
      '<div class="fld-end"><button type="submit" class="btn">Speichern</button></div></form>' +
      '<p class="muted small">Gilt für alle Geräte dieses Typs. Pro Gerät lässt sich das Intervall in «Bearbeiten» übersteuern. Gezählt werden nur Tage im Feld, nicht im Magazin.</p></section>';

    var et = st.etikett || {};
    h += '<section class="card" id="sec-etikett"><h2>QR-Etiketten</h2>' +
      '<p class="muted small">Etiketten druckt man im Inventar (Geräte ankreuzen › «Etiketten …») oder im Gerätefenster («Etikett»). Formate: Avery Zweckform L4773 (63,5 × 33,9 mm) und L4778 (45,7 × 21,2 mm).</p>' +
      '<p class="small">Adresse im QR-Code: <code>' + esc(M.qrBasis ? M.qrBasis() : '') + '#g=…</code>' + (M.qrBasisLokal && M.qrBasisLokal() ? ' <span class="warn-t">– läuft lokal, auf dem Handy nicht erreichbar. In <code>config.js</code> die <code>qrAdresse</code> eintragen.</span>' : '') + '</p>' +
      '<div class="grid3"><label class="fld"><span>Versatz nach rechts, mm</span><input id="set-et-dx" type="number" step="0.1" min="-5" max="5" value="' + esc(et.dx || 0) + '"></label>' +
      '<label class="fld"><span>Versatz nach unten, mm</span><input id="set-et-dy" type="number" step="0.1" min="-5" max="5" value="' + esc(et.dy || 0) + '"></label>' +
      '<div class="fld-end"><button type="button" class="btn" data-act="et-settings-save">Speichern</button> <button type="button" class="btn ghost" data-act="et-settings-test">Testseite</button></div></div>' +
      '<p class="muted small">Testseite auf Normalpapier drucken (100 %, Tatsächliche Grösse) und gegen einen Etikettenbogen ans Licht halten. Sitzen die Rahmen z.B. 1 mm zu weit links, Versatz nach rechts 1 eintragen. Negative Werte verschieben nach links bzw. oben.</p></section>';

    h += '<section class="card" id="sec-kat"><div class="card-h"><h2>Kategorien und Symbole</h2><span class="grow"></span><button type="button" class="btn sm" data-act="new-kat">+ Kategorie</button></div><div class="kat-grid">';
    var used = {};
    geraete().forEach(function (g) { used[g.kategorieId] = (used[g.kategorieId] || 0) + 1; });
    S.GRUPPEN_ORDER.forEach(function (gk) {
      var ks = M.state.data.kategorien.filter(function (k) { return k.gruppe === gk; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'de'); });
      if (!ks.length) return;
      h += '<div class="kat-grp"><div class="sec-h"><span>' + esc(S.GRUPPEN[gk].name) + '</span></div>';
      ks.forEach(function (k) {
        h += '<button type="button" class="kat-item" data-act="edit-kat" data-id="' + k.id + '">' + S.symbolHtml(k.gruppe, k.piktogramm, { size: 26, kuerzel: k.kuerzel }) +
          '<span class="ki-t"><b>' + esc(k.name) + '</b><span>' + esc(k.kuerzel || '') + ' · ' + (used[k.id] || 0) + (used[k.id] === 1 ? ' Gerät' : ' Geräte') + (k.felder && k.felder.length ? ' · ' + k.felder.length + ' Zusatzfelder' : '') + '</span></span></button>';
      });
      h += '</div>';
    });
    h += '</div></section>';

    h += '<section class="card"><h2>Daten</h2><div class="btn-row">' +
      '<button type="button" class="btn ghost" data-act="export-csv">Geräte als Excel (CSV)</button>' +
      '<button type="button" class="btn ghost" data-act="export-hist">Historie als Excel (CSV)</button>' +
      '<button type="button" class="btn ghost" data-act="export-kabel">Kabel als Excel (CSV)</button>' +
      (M.can('edit') ? '<label class="btn ghost file-btn">Geräte aus CSV importieren<input type="file" accept=".csv,text/csv" data-change="import-csv"></label>' +
      '<button type="button" class="btn ghost" data-act="csv-vorlage">CSV-Vorlage</button>' : '') +
      (M.can('admin') ? '<button type="button" class="btn ghost" data-act="export-json">Sicherung exportieren</button>' +
      '<label class="btn ghost file-btn">Sicherung importieren<input id="imp-json" type="file" accept=".json,application/json" data-change="import-json"></label>' : '') + '</div>' +
      (M.can('fin') ? '' : '<p class="muted small">Exporte ohne Finanzspalten (Wert, Amortisation, Restwert). Sicherung und Rollen verwaltet ein Admin.</p>') +
      '<p class="muted small">Die Sicherung enthält alle Geräte, Kategorien, Projekte, Einsätze, Wartungen und Kabel als JSON-Datei. Beim Import werden Datensätze mit gleicher ID überschrieben.</p>' +
      '<p class="muted small"><b>CSV-Import</b> nimmt dasselbe Format wie der Excel-Export: Export machen, in Excel ergänzen, als CSV speichern und wieder importieren. Abgleich über den Namen; neue Namen werden neu angelegt, leere Zellen ändern nichts. Vor dem Import zeigt eine Vorschau, was passiert.</p>';
    if (st.beispiel && M.can('admin')) h += '<div class="hint">Zurzeit sind <b>Beispieldaten</b> geladen. <button type="button" class="btn sm danger" data-act="clear-sample">Alle Daten löschen und leer starten</button></div>';
    if (store.mode === 'lokal') h += '<p><button type="button" class="link-btn" data-act="reset-sample">Beispieldaten neu laden</button></p>';
    h += '</section><p class="muted small">MonInv Version ' + M.VERSION + ' · Monitoring-Inventar RISTAG Ingenieure AG · Kartendaten © swisstopo</p></div>';
    keepScroll($('v-einstellungen'), h);
  };

  /* ---------- Datenprüfung (nur Admin) */
  function checkHtml() {
    var r = M.datenCheck(), I = M.idx();
    var h = '<section class="card" id="sec-check"><div class="card-h"><h2>Datenprüfung</h2><span class="grow"></span>' +
      (r.n ? '<button type="button" class="btn sm" data-act="check-fix">Bereinigen (' + r.n + ')</button>' : '') + '</div>';
    var miss = (M.state.data.dateien || []).filter(M.fileMissing);
    if (miss.length) {
      h += '<p class="small"><b>' + miss.length + (miss.length === 1 ? ' Datei fehlt' : ' Dateien fehlen') + ' in SharePoint.</b> ' + (miss.length === 1 ? 'Sie wurde im Testbetrieb hochgeladen und liegt' : 'Sie wurden im Testbetrieb hochgeladen und liegen') + ' nur im damaligen Browser (die Sicherung enthält keine Dateien). Beim Gerät bzw. Projekt unter «Pläne & Dateien» mit «Neu hochladen» ersetzen:</p><div class="ck-list">' +
        miss.slice(0, 40).map(function (f) { var z = f.ziel === 'projekt' ? I.proj[f.zielId] : I.ger[f.zielId]; return '<div class="ck-row"><b>' + esc(f.name) + '</b><div class="ck-d"><span>' + (f.ziel === 'projekt' ? 'Projekt ' + esc(z ? M.projName(z) : '?') : (z ? '<button type="button" class="link-btn" data-act="open" data-id="' + z.id + '">' + esc(z.name) + '</button>' : '?')) + '</span></div></div>'; }).join('') + '</div>';
    }
    if (!r.n && !r.namen.length && !miss.length) return h + '<p class="ok-t"><b>Alles in Ordnung.</b> Keine Geräte mit sich überschneidenden Einsätzen, keine doppelten Gerätenamen.</p></section>';
    if (r.n) {
      h += '<p class="small">' + r.n + (r.n === 1 ? ' Gerät hat' : ' Geräte haben') + ' Einsätze, die sich zeitlich überschneiden (z.B. zweimal laufend). Sie erscheinen in Projekten doppelt und können doppelt abgerechnet werden. ' +
        '«Bereinigen» führt exakte Doppel zusammen und beendet sonst den früheren Einsatz am Beginn des nächsten.</p><div class="ck-list">';
      var lbl = { doppelt: 'doppelt erfasst', offen: 'zweimal laufend', ueberlappt: 'überschneiden sich' };
      r.probleme.slice(0, 60).forEach(function (pr) {
        var g = I.ger[pr.gid];
        h += '<div class="ck-row"><button type="button" class="link-btn strong" data-act="open" data-id="' + pr.gid + '">' + esc(g.name) + '</button><div class="ck-d">' +
          pr.fixes.map(function (f) {
            var e2 = function (e) { return esc(M.ortText(e)) + ' ' + M.fmtDate(e.von) + ' – ' + (e.bis ? M.fmtDate(e.bis) : 'laufend'); };
            return '<span><b>' + lbl[f.art] + ':</b> ' + e2(f.a) + ' · ' + e2(f.b) + '</span>';
          }).join('') + '</div></div>';
      });
      if (r.probleme.length > 60) h += '<p class="muted small">… und ' + (r.probleme.length - 60) + ' weitere</p>';
      h += '</div>';
    }
    if (r.namen.length) {
      h += '<p class="small"><b>Gleicher Name bei mehreren Geräten</b> (' + r.namen.length + '). Das sind getrennte Datensätze, z.B. aus einem doppelten Import. Bitte prüfen und überzählige löschen oder umbenennen:</p><div class="ck-list">';
      r.namen.slice(0, 40).forEach(function (gs) {
        h += '<div class="ck-row"><b>' + esc(gs[0].name) + '</b><div class="ck-d">' + gs.map(function (g) {
          var i = M.info(g.id);
          return '<span><button type="button" class="link-btn" data-act="open" data-id="' + g.id + '">öffnen</button> ' + esc(i.ortText) + (g.seriennummer ? ' · SN ' + esc(g.seriennummer) : '') + '</span>';
        }).join('') + '</div></div>';
      });
      h += '</div>';
    }
    return h + '</section>';
  }

  /* ---------- Benutzer und Rollen (nur Admin) */
  function rollenHtml() {
    var st = M.settings(), r = st.rollen || {}, admins = M.cfgAdmins(), me = M.userEmail();
    var mails = Object.keys(r).filter(function (m) { return admins.indexOf(m) < 0; }).sort();
    var ropt = function (sel) { return M.ROLLEN_ORDER.map(function (k) { return opt(k, M.ROLLEN[k].name, sel === k); }).join(''); };
    var h = '<section class="card" id="sec-rollen"><h2>Benutzer und Rollen</h2>' +
      '<div class="rl-info">' + M.ROLLEN_ORDER.map(function (k) { return '<div><b>' + M.ROLLEN[k].name + '</b><span>' + esc(M.ROLLEN[k].text) + '</span></div>'; }).join('') + '</div>' +
      '<p class="muted small">Wer hier nicht steht, ist <b>User</b>. Für echten Schutz beim Sekretariat diese Personen in der SharePoint-Website zusätzlich nur mit <b>Lesen</b> berechtigen (Besucher).</p>';
    if (M.state.roleTest) h = '<section class="card" id="sec-rollen"><h2>Benutzer und Rollen</h2><p class="muted small">Sie sehen die App gerade als <b>' + esc(M.ROLLEN[M.state.roleTest].name) + '</b>. Benutzer verwalten geht in der Admin-Ansicht.</p>';
    else {
    h += '<div class="rl-list">';
    admins.forEach(function (m) {
      h += '<div class="rl-row"><span class="rl-m">' + esc(m) + (m === me ? ' <span class="muted">(Sie)</span>' : '') + '</span><span class="rl-fix">Admin <span class="muted small">fest in config.js</span></span><span class="rl-x"></span></div>';
    });
    mails.forEach(function (m) {
      h += '<div class="rl-row"><span class="rl-m">' + esc(m) + (m === me ? ' <span class="muted">(Sie)</span>' : '') + '</span>' +
        '<label class="rl-sel"><span class="sr">Rolle für ' + esc(m) + '</span><select class="sel-sm" data-change="user-role" data-mail="' + esc(m) + '">' + ropt(r[m]) + '</select></label>' +
        '<button type="button" class="ic-btn rl-x" data-act="user-del" data-mail="' + esc(m) + '" aria-label="' + esc(m) + ' entfernen" title="Entfernen">×</button></div>';
    });
    if (!admins.length && !mails.length) h += '<p class="hint warn">Noch niemand ist als Admin bestimmt – bis dahin sind alle Admin. Zuerst die eigene Adresse als Admin eintragen.</p>';
    h += '</div><div class="rl-add"><label class="fld"><span>E-Mail</span><input id="u-mail" type="email" autocomplete="off" placeholder="vorname.name@ristag.ch" data-enter="user-add"></label>' +
      '<label class="fld"><span>Rolle</span><select id="u-role">' + ropt('sekretariat') + '</select></label>' +
      '<div class="fld-end"><button type="button" class="btn" data-act="user-add">Hinzufügen</button></div></div>';
    }
    h += '<div class="rl-test"><span class="lbl">Ansicht testen</span><div class="seg" role="group" aria-label="Ansicht als">' +
      M.ROLLEN_ORDER.map(function (k) { var on = (M.state.roleTest || 'admin') === k; return '<button type="button" data-act="role-test" data-k="' + (k === 'admin' ? '' : k) + '" class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '">' + M.ROLLEN[k].name + '</button>'; }).join('') +
      '</div><span class="muted small">Zeigt die App so, wie sie die Rolle sieht (nur in diesem Tab).</span></div></section>';
    return h;
  }

  /* ================================================== DATEIEN */
  var ICO_PDF = '<svg viewBox="0 0 40 48" aria-hidden="true"><path d="M4 2h22l10 10v34H4z" fill="#fff" stroke="#B42318" stroke-width="2"/><path d="M26 2v10h10" fill="none" stroke="#B42318" stroke-width="2"/><text x="20" y="35" text-anchor="middle" font-family="Exo 2, sans-serif" font-weight="800" font-size="11" fill="#B42318">PDF</text></svg>';
  var ICO_FILE = '<svg viewBox="0 0 40 48" aria-hidden="true"><path d="M4 2h22l10 10v34H4z" fill="#fff" stroke="#5E5C5B" stroke-width="2"/><path d="M26 2v10h10" fill="none" stroke="#5E5C5B" stroke-width="2"/></svg>';
  function fileIcon(f) { return f.thumb ? '<img src="' + f.thumb + '" alt="">' : M.isPdf(f) ? ICO_PDF : ICO_FILE; }
  function uploadBox(ziel, zielId, small) {
    var arten = M.dateiArten(ziel);
    return '<div class="dz' + (small ? ' dz-sm' : '') + '" data-ziel="' + ziel + '" data-id="' + zielId + '">' +
      '<svg class="dz-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>' +
      '<span class="dz-t"><b>Dateien hierher ziehen</b> oder <label class="link-btn file-in">auswählen<input type="file" multiple accept="image/*,application/pdf,.dwg,.dxf,.xlsx,.docx,.zip" data-change="file-up" data-ziel="' + ziel + '" data-id="' + zielId + '"></label></span>' +
      '<label class="dz-art"><span class="sr">Art</span><select id="fu-art-' + zielId + '" aria-label="Art der Datei">' + opt('', 'Art automatisch', true) + arten.map(function (a) { return opt(a[0], a[1], false); }).join('') + '</select></label>' +
      '<span class="dz-prog" id="fu-prog-' + zielId + '" aria-live="polite"></span></div>';
  }
  M.filesHtml = function (ziel, zielId, opts) {
    opts = opts || {};
    var list = (M.idx().dat[zielId] || []).filter(M.fileVisible), arten = M.dateiArten(ziel);
    var h = uploadBox(ziel, zielId, opts.compactUpload);
    if (!list.length) return h + '<p class="muted small">' + (ziel === 'projekt' ? (M.can('fin') ? 'Noch keine Dokumente. Offerte als PDF hier ablegen.' : 'Noch keine Dokumente.') : 'Noch keine Pläne. Messplan, Fixpunktplan, Skizzen oder Fotos als Bild oder PDF hochladen – im Feld dann direkt am Gerät ansehen.') + '</p>';
    var groups = {};
    list.forEach(function (f) { (groups[f.art] = groups[f.art] || []).push(f); });
    arten.concat([['?', 'Weitere']]).forEach(function (a) {
      var g = groups[a[0]]; if (!g) return; delete groups[a[0]];
      h += fileGroup(a[1], g, ziel);
    });
    Object.keys(groups).forEach(function (k) { h += fileGroup(M.dateiArtLabel(ziel, k), groups[k], ziel); });
    return h;
  };
  function fileGroup(label, files, ziel) {
    var h = '<div class="fg"><div class="fg-h">' + esc(label) + ' <span class="muted">' + files.length + '</span></div><div class="fgrid">';
    files.forEach(function (f) {
      var miss = M.fileMissing(f);
      h += '<div class="ft' + (miss ? ' missing' : '') + '"><button type="button" class="ft-open" data-act="file-open" data-id="' + f.id + '" title="' + esc(f.name) + ' öffnen"><span class="ft-th">' + fileIcon(f) + '</span>' +
        '<span class="ft-n">' + esc(f.name) + '</span><span class="ft-m">' + M.fmtDate(f.datum) + ' · ' + M.fmtSize(f.groesse) + (f.wer ? ' · ' + esc(f.wer) : '') + '</span></button>' +
        (miss ? '<label class="ft-miss"><span>Fehlt in SharePoint – neu hochladen</span><input type="file" data-change="file-reup" data-id="' + f.id + '"></label>' : '') +
        '<span class="ft-a"><select data-change="file-art" data-id="' + f.id + '" aria-label="Art von ' + esc(f.name) + '">' + M.dateiArten(ziel).map(function (a) { return opt(a[0], a[1], a[0] === f.art); }).join('') + '</select>' +
        '<button type="button" class="ic-btn" data-act="file-del" data-id="' + f.id + '" aria-label="' + esc(f.name) + ' löschen" title="Löschen">×</button></span></div>';
    });
    return h + '</div></div>';
  }
  /* Kartenpanel: Pläne schnell öffnen, auch auf dem Handy */
  M.filesCompact = function (ziel, zielId) {
    var list = (M.idx().dat[zielId] || []).filter(M.fileVisible);
    var h = '<div class="sec-h"><span>Pläne · ' + list.length + '</span><label class="link-btn file-in">+ hochladen<input type="file" multiple accept="image/*,application/pdf" data-change="file-up" data-ziel="' + ziel + '" data-id="' + zielId + '"></label></div>';
    if (!list.length) return h + '<p class="muted small">Keine Pläne hinterlegt.</p>';
    h += '<div class="fc">';
    list.slice(0, 6).forEach(function (f) {
      h += '<button type="button" class="fc-b" data-act="file-open" data-id="' + f.id + '"><span class="fc-th">' + fileIcon(f) + '</span><span class="rb-t"><b>' + esc(f.name) + '</b><span>' + esc(M.dateiArtLabel(ziel, f.art)) + ' · ' + M.fmtSize(f.groesse) + '</span></span></button>';
    });
    if (list.length > 6) h += '<button type="button" class="link-btn" data-act="dw-files" data-id="' + zielId + '">alle ' + list.length + ' anzeigen</button>';
    return h + '</div>';
  };

  /* ================================================== MESSSTELLE */
  M.gruppeHtml = function (gid, full) {
    var I = M.idx(), i = M.info(gid), g = i.g;
    var wert = 0, rest = 0, ertrag = 0, sum = 0;
    i.members.forEach(function (m) { var mi = M.info(m); wert += M.num(mi.g.wert) || 0; rest += mi.restwert || 0; ertrag += mi.ertrag || 0; sum += mi.amortSum || 0; });
    var h = '';
    if (i.ortFehlt) h += '<div class="hint warn">Die Position der Messstelle fehlt. <button type="button" class="link-btn" data-act="place" data-id="' + gid + '">Jetzt setzen</button></div>';
    h += '<div class="sec-h"><span>Geräte · ' + i.members.length + '</span><button type="button" class="link-btn" data-act="ms-add" data-id="' + gid + '">+ hinzufügen</button></div><div class="ms-list">';
    i.members.forEach(function (m) {
      var mi = M.info(m);
      h += '<div class="ms-row"><button type="button" class="row-btn" data-act="open-any" data-id="' + m + '">' + M.symbol(m, 24) + '<span class="rb-t"><b>' + esc(mi.g.name) + '</b><span>' +
        esc([mi.kat ? mi.kat.name : M.typLabel[mi.g.typ], mi.g.seriennummer, mi.g.sim ? 'SIM' : '', M.stateLabel[mi.state][0]].filter(Boolean).join(' · ')) + '</span></span></button>' +
        '<button type="button" class="ic-btn" data-act="ms-remove" data-id="' + m + '" aria-label="' + esc(mi.g.name) + ' aus der Messstelle lösen" title="Herauslösen">×</button></div>';
    });
    if (!i.members.length) h += '<p class="muted small">Noch keine Geräte.</p>';
    h += '</div><div class="sec-h"><span>Angaben</span></div><div class="attrs">';
    h += attr('Standort', esc(i.ortText));
    h += attr('Projekt', i.proj ? esc(M.projName(i.proj)) : '<span class="muted">–</span>');
    if (i.res) h += attr('Reserviert für', esc(M.projName(i.res.proj)) + (i.res.ab ? ' · Montage ab ' + M.fmtDate(i.res.ab) : '') + (i.res.bemerkung ? '<br><span class="muted small">' + esc(i.res.bemerkung) + '</span>' : '') +
      ' <button type="button" class="link-btn" data-act="reserve" data-id="' + gid + '">ändern</button>');
    if (i.cur && !i.isMag) {
      h += M.posAttr(i);
      h += attr('Laufzeit', M.planInfo(i.cur) ? '<span class="' + (M.planInfo(i.cur).ueber ? 'warn-t' : '') + '">' + esc(M.planText(i.cur)) + '</span> <button type="button" class="link-btn small" data-act="laufzeit" data-id="' + i.g.id + '">ändern</button>' : '<span class="muted">nicht geplant</span> <button type="button" class="link-btn small" data-act="laufzeit" data-id="' + i.g.id + '">planen</button>');
    }
    h += attr('Seit', i.cur ? M.fmtDate(i.cur.von) : '–');
    h += attr('Position LV95', i.posSrc === 'eigen' ? M.fmtLv95(i.pos.lat, i.pos.lng) : (i.isMag ? 'im Magazin' : '<span class="warn-t">nicht gesetzt</span>'), i.posSrc === 'eigen' ? 'mono' : '');
    if (full) {
      if (M.can('fin')) h += attr('Anschaffungswert total', 'CHF ' + M.chf(wert));
      if (M.can('fin')) h += attr('Amortisation total', ertrag ? '<span class="ok-t">CHF ' + M.chf(sum) + ' · Ertrag CHF ' + M.chf(ertrag) + '</span>' : 'CHF ' + M.chf(sum) + ' · noch CHF ' + M.chf(rest) + ' offen');
    }
    if (g.bemerkung) h += attr('Bemerkung', esc(g.bemerkung), 'pre');
    h += '</div>';
    if (!full) h += M.filesCompact('geraet', gid);
    if (i.kabel.length) {
      h += '<div class="sec-h"><span>Kabel · ' + i.kabel.length + '</span></div>';
      i.kabel.forEach(function (k) {
        var t = M.kabelTypen[k.typ] || M.kabelTypen.andere;
        h += '<button type="button" class="row-btn" data-act="kabel-sel" data-id="' + k.id + '"><span class="kab-ic" style="--c:' + t.color + '" aria-hidden="true"></span><span class="rb-t"><b>' + esc(k.name || t.name) + '</b><span>' + M.fmtLen(M.lineLen(k.punkte)) + '</span></span><span class="chev">›</span></button>';
      });
    }
    return h;
  };
  M.gruppeAmortHtml = function (gid) {
    var i = M.info(gid), rows = i.members.map(function (m) { return { i: M.info(m), a: M.amortInfo(m) }; });
    var wert = 0, tot = 0, vor = 0, off = 0, ert = 0, rate = 0, done = 0;
    rows.forEach(function (r) { wert += r.a.wert; tot += r.a.total; vor += r.a.vor; off += r.a.offen; ert += r.a.ertrag; rate += r.a.rate; if (r.a.be) done++; });
    var h = '<div class="am-head ' + (off <= 0 && wert ? 'done' : '') + '"><b>' + (off > 0 ? 'Noch CHF ' + M.chf(off) + ' bis abbezahlt' : 'Abbezahlt · CHF ' + M.chf(ert) + ' Ertrag') + '</b><span>' + done + ' von ' + rows.length + ' Geräten abbezahlt · ' + (wert ? Math.round(tot / wert * 100) : 0) + ' % des Anschaffungswerts</span></div>';
    h += '<div class="am-kpi"><div><span class="k">Anschaffungswert</span><b class="mono">CHF ' + M.chf(wert) + '</b><span>' + rows.length + ' Geräte</span></div>' +
      '<div><span class="k">Amortisiert</span><b class="mono am-c1">CHF ' + M.chf(tot) + '</b><span>' + (vor ? 'davon CHF ' + M.chf(vor) + ' vor Erfassung' : 'alles in MonInv gebucht') + '</span></div>' +
      '<div><span class="k">Noch offen</span><b class="mono">CHF ' + M.chf(off) + '</b><span>Summe der Restwerte</span></div>' +
      '<div class="' + (ert ? 'am-ok' : '') + '"><span class="k">Ertrag über Anschaffung</span><b class="mono' + (ert ? ' am-c3' : '') + '">CHF ' + M.chf(ert) + '</b><span>abbezahlte Geräte</span></div>' +
      '<div><span class="k">Laufend pro Monat</span><b class="mono">CHF ' + M.chf(rate) + '</b><span>Summe der Monatsansätze</span></div></div>';
    h += '<div class="tbl-wrap"><table class="tbl am-tbl"><thead><tr><th>Gerät</th><th>Ansatz hier</th><th class="r">Anschaffung CHF</th><th class="r">Amortisiert CHF</th><th>Stand</th><th class="r">Offen / Ertrag CHF</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var pc = r.a.wert ? Math.round(r.a.total / r.a.wert * 100) : 0, over = r.a.wert && r.a.total >= r.a.wert;
      h += '<tr><td><button type="button" class="link-btn strong" data-act="open-any" data-id="' + r.i.g.id + '">' + esc(r.i.g.name) + '</button></td><td>' + esc(r.i.cur ? M.amortText(r.i.cur) : '–') + '</td>' +
        '<td class="r mono">' + M.chf(r.a.wert) + '</td><td class="r mono">' + M.chf(r.a.total) + '</td>' +
        '<td><span class="am-pb"><span style="width:' + Math.min(100, pc) + '%;background:' + (over ? '#2E8B5E' : '#1F5FAE') + '"></span></span><span class="mono small' + (over ? ' ok-t' : '') + '">' + pc + ' %</span></td>' +
        '<td class="r mono' + (over ? ' ok-t' : '') + '">' + (over ? '+' + M.chf(r.a.ertrag) : M.chf(r.a.offen)) + '</td></tr>';
    });
    return h + '</tbody></table></div><p class="muted small">Die Amortisation läuft pro Gerät. Beim «Projekt ändern» der Messstelle lässt sich ein Betrag je Gerät oder ein Total für die ganze Messstelle eingeben.</p>';
  };

  /* ================================================== GERÄTEFENSTER (gross, mit Reitern) */
  var MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  function monYear(isoS) { var d = new Date(isoS + 'T00:00:00'); return MON[d.getMonth()] + ' ' + d.getFullYear(); }

  M.drawerHtml = function (gid, tab) {
    tab = tab || 'geraet';
    var isMs = !!M.info(gid).members;
    var nF = (M.idx().dat[gid] || []).filter(M.fileVisible).length;
    var tabs = [['geraet', isMs ? 'Messstelle' : 'Gerät'], ['dateien', 'Pläne & Dateien' + (nF ? ' <span class="tab-n">' + nF + '</span>' : '')], ['hist', 'Historie']];
    if (M.can('fin')) tabs.push(['amort', 'Amortisation']); else if (tab === 'amort') tab = 'geraet';
    var h = '<div class="dw-bg" data-act="drawer-close"></div><div class="dw" role="dialog" aria-modal="true" aria-labelledby="dw-t">' +
      '<div class="dw-h"><div class="dw-id">' + M.detailHead(gid, true) + '</div><button type="button" class="md-x" data-act="drawer-close" aria-label="Schliessen">×</button></div>' +
      '<div class="dw-act">' + M.detailActions(gid, true) + '</div>' +
      '<div class="dw-tabs" role="tablist">' + tabs.map(function (t) {
        return '<button type="button" role="tab" aria-selected="' + (t[0] === tab) + '" class="' + (t[0] === tab ? 'on' : '') + '" data-act="dw-tab" data-k="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div><div class="dw-b" id="dw-b">';
    if (tab === 'dateien') h += M.filesHtml('geraet', gid);
    else if (tab === 'hist') h += M.histHtml(gid);
    else if (tab === 'amort') h += isMs ? M.gruppeAmortHtml(gid) : M.amortHtml(gid);
    else h += '<div class="dw-geraet">' + M.detailHtml(gid, 'tab') + '</div>';
    return h + '</div></div>';
  };

  /* ---------- Reiter Historie */
  M.histHtml = function (gid) {
    var I = M.idx(), i = M.info(gid), g = i.g, A = M.amortInfo(gid), heute = M.today();
    var items = [];
    i.eins.forEach(function (e) { items.push({ d: e.von, k: 1, e: e }); });
    (I.wrt[gid] || []).forEach(function (w) { items.push({ d: w.datum, k: 2, w: w }); });
    if (A.vor && M.can('fin')) items.push({ d: A.vorDatum, k: 3, vor: true });
    if (g.kaufdatum) items.push({ d: g.kaufdatum, k: 4, kauf: true });
    items.sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : a.k - b.k; });
    var projs = {}; i.eins.forEach(function (e) { if (e.projektId && e.ort === 'feld') projs[e.projektId] = 1; });
    var h = '<div class="hx-sum">' +
      '<div><b>' + i.nStandorte + '</b><span>' + (i.nStandorte === 1 ? 'Standort' : 'Standorte') + ' im Feld</span></div>' +
      '<div><b>' + Object.keys(projs).length + '</b><span>Projekte</span></div>' +
      '<div><b>' + M.chf(A.feld) + '</b><span>Tage im Feld</span></div>' +
      '<div><b>' + M.chf(A.mag) + '</b><span>Tage im Magazin</span></div>' +
      '<div><b>' + A.auslastung + ' %</b><span>Auslastung seit ' + M.fmtDate(A.vorDatum) + '</span></div></div>';
    h += '<ol class="hx">';
    items.forEach(function (it) {
      if (it.e) {
        var e = it.e, mag = e.ort === 'magazin', p = e.projektId ? I.proj[e.projektId] : null, now = !e.bis;
        var tage = Math.max(0, M.days(e.von, e.bis || heute)), amt = M.einsatzAmort(e);
        var lv = M.has(e.lat) ? M.fmtLv95(e.lat, e.lng) : '';
        var who = [e.gesetztVon ? 'gesetzt ' + esc(e.gesetztVon) : '', e.geholtVon ? 'geholt ' + esc(e.geholtVon) : ''].filter(Boolean).join(' · ');
        h += '<li class="hx-i ' + (mag ? 'hx-m' : 'hx-f') + (now ? ' now' : '') + '"><span class="hx-d mono">' + M.fmtDate(e.von) + '</span><span class="hx-dot" aria-hidden="true"></span>' +
          '<div class="hx-c"><div class="hx-r"><b>' + esc(M.ortText(e)) + '</b><span class="muted">' + (now ? 'seit ' + tage + (tage === 1 ? ' Tag' : ' Tagen') + ' · laufend' : 'bis ' + M.fmtDate(e.bis) + ' · ' + tage + (tage === 1 ? ' Tag' : ' Tage')) + '</span><span class="grow"></span>' +
          (!mag ? '<span class="mono hx-amt">' + (amt ? 'CHF ' + M.chf(amt) : '–') + '</span>' : '') +
          '<button type="button" class="ic-btn" data-act="edit-einsatz" data-id="' + e.id + '" aria-label="Eintrag bearbeiten">✎</button></div>' +
          '<div class="hx-s">' + [p ? 'Projekt ' + esc(M.projName(p)) : (mag ? 'eingelagert' : 'ohne Projekt'),
            mag && e.reserviert && I.proj[e.reserviert.projektId] ? '<span class="res-t">reserviert für ' + esc(M.projName(I.proj[e.reserviert.projektId])) + (e.reserviert.ab ? ' ab ' + M.fmtDate(e.reserviert.ab) : '') + '</span>' : '',
            M.auftragOf(e) ? 'Teilprojekt ' + esc(M.auftragOf(e)) : '',
            !mag && M.can('fin') ? (M.posRate(e) ? esc(M.posLabel(M.posRate(e).P)) : e.amortModus === 'monat' ? 'CHF ' + M.chf(e.amortBetrag) + ' pro Monat' : 'CHF ' + M.chf(e.amortBetrag) + ' pauschal') : '',
            lv && e.ortName ? '<span class="mono">LV95 ' + lv + '</span>' : '', who].filter(Boolean).join(' · ') + '</div></div></li>';
      } else if (it.w) {
        var w = it.w;
        h += '<li class="hx-i hx-w"><span class="hx-d mono">' + M.fmtDate(w.datum) + '</span><span class="hx-dot" aria-hidden="true"></span>' +
          '<div class="hx-c"><div class="hx-r"><b>Wartung · ' + esc(w.art || 'Service') + '</b><span class="grow"></span>' + (w.kosten ? '<span class="mono hx-amt">CHF ' + M.chf(w.kosten) + '</span>' : '') +
          '<button type="button" class="ic-btn" data-act="edit-wartung" data-id="' + w.id + '" aria-label="Wartung bearbeiten">✎</button></div>' +
          '<div class="hx-s">' + [w.firma ? esc(w.firma) : '', w.bemerkung ? esc(w.bemerkung) : '', 'Zähler auf 0'].filter(Boolean).join(' · ') + '</div></div></li>';
      } else if (it.vor) {
        h += '<li class="hx-i hx-v"><span class="hx-d mono">' + M.fmtDate(A.vorDatum) + '</span><span class="hx-dot" aria-hidden="true"></span>' +
          '<div class="hx-c"><div class="hx-r"><b>Erfasst in MonInv</b><span class="grow"></span><span class="mono hx-amt">CHF ' + M.chf(A.vor) + '</span></div>' +
          '<div class="hx-s">Startwert: bereits amortisiert vor der Erfassung</div></div></li>';
      } else {
        h += '<li class="hx-i hx-k"><span class="hx-d mono">' + M.fmtDate(g.kaufdatum) + '</span><span class="hx-dot" aria-hidden="true"></span>' +
          '<div class="hx-c"><div class="hx-r"><b>Kauf</b><span class="grow"></span>' + (M.has(g.wert) ? '<span class="mono hx-amt">CHF ' + M.chf(g.wert) + '</span>' : '') + '</div>' +
          '<div class="hx-s">Anschaffungswert' + (g.hersteller ? ' · ' + esc(g.hersteller) : '') + '</div></div></li>';
      }
    });
    if (!items.length) h += '<li class="hx-empty muted">Noch keine Einträge.</li>';
    return h + '</ol>';
  };

  /* ---------- Reiter Amortisation */
  M.amortHtml = function (gid) {
    var A = M.amortInfo(gid), heute = M.today();
    if (!A.wert) return '<div class="hint">Für die Amortisation braucht das Gerät einen Anschaffungswert. <button type="button" class="link-btn" data-act="edit" data-id="' + gid + '">Jetzt erfassen</button></div>';
    var pct = Math.round(A.total / A.wert * 100), done = !!A.be;
    var h = '<div class="am-head ' + (done ? 'done' : '') + '"><b>' + (done ? 'Abbezahlt · CHF ' + M.chf(A.ertrag) + ' Ertrag' : 'Noch CHF ' + M.chf(A.offen) + ' bis abbezahlt') + '</b>' +
      '<span>' + (done ? 'Anschaffungswert seit ' + M.fmtDate(A.be) + ' erreicht · ' + pct + ' %' : pct + ' % des Anschaffungswerts amortisiert') + '</span></div>';
    h += '<div class="am-kpi">' +
      '<div><span class="k">Anschaffungswert</span><b class="mono">CHF ' + M.chf(A.wert) + '</b><span>' + (A.kauf ? 'gekauft ' + M.fmtDate(A.kauf) : 'Kaufdatum fehlt') + '</span></div>' +
      '<div><span class="k">Amortisiert</span><b class="mono am-c1">CHF ' + M.chf(A.total) + '</b><span>' + (A.vor ? 'davon CHF ' + M.chf(A.vor) + ' vor Erfassung' : 'alles in MonInv gebucht') + '</span></div>' +
      '<div class="' + (done ? 'am-ok' : '') + '"><span class="k">' + (done ? 'Ertrag über Anschaffung' : 'Noch offen (Restwert)') + '</span><b class="mono' + (done ? ' am-c3' : '') + '">CHF ' + M.chf(done ? A.ertrag : A.offen) + '</b><span>' + (done ? 'Restwert CHF 0' : 'bis zum Anschaffungswert') + '</span></div>' +
      '<div><span class="k">Laufender Standort</span><b class="mono">' + (A.rate ? 'CHF ' + M.chf(A.rate) + ' pro Monat' : (M.info(gid).cur && M.info(gid).cur.ort === 'feld' ? 'pauschal' : '–')) + '</b><span>' + esc(M.info(gid).cur ? M.amortText(M.info(gid).cur) : 'ohne Standort') + '</span></div>' +
      '<div><span class="k">' + (done ? 'Abbezahlt am' : 'Prognose abbezahlt') + '</span><b class="mono">' + (done ? M.fmtDate(A.be) : (A.prog ? monYear(A.prog) : '–')) + '</b><span>' +
        (done ? (A.kauf ? M.chf(Math.max(0, M.days(A.kauf, A.be))) + ' Tage nach dem Kauf' : '') : (A.prog ? 'wenn es zum heutigen Ansatz stehen bleibt' : 'kein laufender Monatsansatz')) + '</span></div></div>';

    // Balken
    var bMax = Math.max(A.wert, A.total) * 1.08, bw = function (v) { return Math.round(v / bMax * 1000 * 10) / 10; };
    var mon = Math.max(0, Math.min(A.total, A.wert) - A.vor);
    h += '<div class="am-sec"><div class="am-st"><b>Weg zum Anschaffungswert</b><span class="grow"></span>' +
      '<span class="am-lg"><i class="am-sw am-hatch"></i>vor Erfassung</span><span class="am-lg"><i class="am-sw" style="background:#1F5FAE"></i>Standorte in MonInv</span><span class="am-lg"><i class="am-sw" style="background:#2E8B5E"></i>Ertrag</span></div>' +
      '<svg class="am-bar" viewBox="0 0 1000 64" role="img" aria-label="CHF ' + M.chf(A.total) + ' von CHF ' + M.chf(A.wert) + ' amortisiert">' +
      '<defs><pattern id="am-hb" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#6B98D3"/><rect width="3" height="8" fill="#fff" opacity=".45"/></pattern></defs>' +
      '<rect x="0" y="8" width="1000" height="28" rx="4" fill="#EEF0F2"/>' +
      (A.vor ? '<rect x="0" y="8" width="' + bw(Math.min(A.vor, A.wert)) + '" height="28" rx="4" fill="url(#am-hb)"><title>Vor Erfassung: CHF ' + M.chf(A.vor) + '</title></rect>' : '') +
      (mon ? '<rect x="' + (A.vor ? bw(A.vor) + 2 : 0) + '" y="8" width="' + Math.max(0, bw(mon) - (A.vor ? 2 : 0)) + '" height="28" fill="#1F5FAE"><title>Standorte in MonInv: CHF ' + M.chf(mon) + '</title></rect>' : '') +
      (A.ertrag ? '<rect x="' + (bw(A.wert) + 2) + '" y="8" width="' + bw(A.ertrag) + '" height="28" rx="4" fill="#2E8B5E"><title>Ertrag: CHF ' + M.chf(A.ertrag) + '</title></rect>' : '') +
      '<line x1="' + bw(A.wert) + '" x2="' + bw(A.wert) + '" y1="0" y2="44" stroke="#00152A" stroke-width="2"/>' +
      '<text x="' + bw(A.wert) + '" y="60" text-anchor="' + (bw(A.wert) > 800 ? 'end' : 'middle') + '" class="am-tx">Anschaffung CHF ' + M.chf(A.wert) + '</text><text x="0" y="60" class="am-tx2">0</text></svg></div>';

    // Verlauf
    var T = function (s) { return new Date(s + 'T00:00:00').getTime(); }, DAY = 86400000;
    var T0 = A.kauf && A.kauf < A.vorDatum ? T(A.kauf) : T(A.vorDatum) - 30 * DAY, TE = T(A.vorDatum), TH = T(heute);
    var progT = A.prog ? T(A.prog) : null, tMax = Math.max(TH, progT || 0) + 45 * DAY;
    var yMax = Math.max(A.wert, A.total) * 1.12;
    var step = (function (m) { var r = m / 4, p = Math.pow(10, Math.floor(Math.log10(r))), n = r / p; return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p; })(yMax);
    var X0 = 64, X1 = 984, Y0 = 262, Y1 = 18;
    var sx = function (t) { return X0 + (t - T0) / (tMax - T0) * (X1 - X0); }, sy = function (v) { return Y0 - v / yMax * (Y0 - Y1); };
    var P = function (a) { return Math.round(a * 10) / 10; };
    var svg = '<svg class="am-chart" viewBox="0 0 1000 300" role="img" aria-label="Verlauf der Amortisation bis heute: CHF ' + M.chf(A.total) + ' von CHF ' + M.chf(A.wert) + '" data-t0="' + T0 + '" data-t1="' + tMax + '" data-ymax="' + yMax + '" data-gid="' + gid + '">' +
      '<defs><pattern id="am-hc" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#6B98D3" opacity=".22"/><rect width="2" height="8" fill="#6B98D3" opacity=".5"/></pattern></defs>';
    for (var v = 0; v <= yMax; v += step) svg += '<line x1="' + X0 + '" x2="' + X1 + '" y1="' + P(sy(v)) + '" y2="' + P(sy(v)) + '" class="am-grid"/><text x="56" y="' + P(sy(v) + 4) + '" text-anchor="end" class="am-tx2">' + (v >= 1000 ? (Math.round(v / 100) / 10) + 'k' : M.chf(v)) + '</text>';
    var y0 = new Date(T0).getFullYear() + 1, span = (tMax - T0) / DAY, yStep = span > 2600 ? 2 : 1;
    for (var yy = y0; T(yy + '-01-01') < tMax; yy++) if ((yy - y0) % yStep === 0) svg += '<line x1="' + P(sx(T(yy + '-01-01'))) + '" x2="' + P(sx(T(yy + '-01-01'))) + '" y1="' + Y0 + '" y2="' + (Y0 + 6) + '" stroke="#9A9897"/><text x="' + P(sx(T(yy + '-01-01'))) + '" y="286" text-anchor="middle" class="am-tx2">' + yy + '</text>';
    A.rows.forEach(function (r) {
      if (r.kind !== 'mag') return;
      var a = sx(T(r.von)), b = sx(T(r.bis && r.bis < heute ? r.bis : heute));
      if (b - a < 1) return;
      svg += '<rect x="' + P(a) + '" y="' + Y1 + '" width="' + P(b - a) + '" height="' + (Y0 - Y1) + '" fill="#F4F4F3"/>' + (b - a > 46 ? '<text x="' + P((a + b) / 2) + '" y="32" text-anchor="middle" class="am-tx3">Magazin</text>' : '');
    });
    if (A.vor) svg += '<path d="M' + P(sx(T0)) + ' ' + Y0 + ' L' + P(sx(TE)) + ' ' + P(sy(A.vor)) + ' L' + P(sx(TE)) + ' ' + Y0 + ' Z" fill="url(#am-hc)"/>';
    var line = A.pts.map(function (p, n) { return (n ? 'L' : 'M') + P(sx(p[0])) + ' ' + P(sy(p[1])); }).join(' ');
    if (A.be && A.total > A.wert) {
      var up = A.pts.filter(function (p) { return p[1] >= A.wert && p[0] >= T(A.be); });
      svg += '<path d="M' + P(sx(T(A.be))) + ' ' + P(sy(A.wert)) + ' L' + up.map(function (p) { return P(sx(p[0])) + ' ' + P(sy(p[1])); }).join(' L') + ' L' + P(sx(TH)) + ' ' + P(sy(A.wert)) + ' Z" fill="#2E8B5E" opacity=".18"/>';
    }
    svg += '<line x1="' + X0 + '" x2="' + X1 + '" y1="' + P(sy(A.wert)) + '" y2="' + P(sy(A.wert)) + '" stroke="#00152A" stroke-width="1.5" stroke-dasharray="6 5"/>' +
      '<text x="' + (X0 + 6) + '" y="' + P(sy(A.wert) - 8) + '" class="am-tx">Anschaffungswert CHF ' + M.chf(A.wert) + '</text>' +
      '<line x1="' + X0 + '" x2="' + X1 + '" y1="' + Y0 + '" y2="' + Y0 + '" stroke="#9A9897"/>';
    if (A.vor) svg += '<path d="M' + P(sx(T0)) + ' ' + Y0 + ' L' + P(sx(TE)) + ' ' + P(sy(A.vor)) + '" fill="none" stroke="#6B98D3" stroke-width="2" stroke-dasharray="2 4"/>';
    svg += '<path d="' + line + '" fill="none" stroke="#1F5FAE" stroke-width="2.5" stroke-linejoin="round"/>';
    if (progT) svg += '<path d="M' + P(sx(TH)) + ' ' + P(sy(A.total)) + ' L' + P(sx(progT)) + ' ' + P(sy(A.wert)) + '" fill="none" stroke="#1F5FAE" stroke-width="2" stroke-dasharray="7 5"/>';
    svg += '<line x1="' + P(sx(TH)) + '" x2="' + P(sx(TH)) + '" y1="' + Y1 + '" y2="' + Y0 + '" stroke="#00468E" opacity=".5"/><text x="' + P(sx(TH)) + '" y="12" text-anchor="middle" class="am-tx4">heute</text>';
    if (A.vor) svg += '<circle cx="' + P(sx(TE)) + '" cy="' + P(sy(A.vor)) + '" r="5" fill="#fff" stroke="#1F5FAE" stroke-width="2"/><text x="' + P(sx(TE)) + '" y="' + P(Math.min(Y0 - 6, sy(A.vor) + 22)) + '" text-anchor="middle" class="am-tx3">Erfassung in MonInv</text>';
    var bT = A.be ? T(A.be) : progT;
    if (bT) {
      var bx = sx(bT);
      svg += '<circle cx="' + P(bx) + '" cy="' + P(sy(A.wert)) + '" r="7" fill="' + (A.be ? '#2E8B5E' : '#fff') + '" stroke="' + (A.be ? '#fff' : '#1F5FAE') + '" stroke-width="2"/>' +
        '<text x="' + P(bx) + '" y="' + P(sy(A.wert) - 14) + '" text-anchor="' + (bx > 860 ? 'end' : bx < 160 ? 'start' : 'middle') + '" class="am-tx4 dk">' + (A.be ? 'abbezahlt ' + M.fmtDate(A.be) : 'voraussichtlich ' + monYear(A.prog)) + '</text>';
    }
    svg += '<g class="am-hover" style="display:none"><line class="am-hl" y1="' + Y1 + '" y2="' + Y0 + '" stroke="#00152A" stroke-width="1"/><circle class="am-hc" r="5" fill="#1F5FAE" stroke="#fff" stroke-width="2"/></g>' +
      '<rect class="am-hit" x="' + X0 + '" y="' + Y1 + '" width="' + (X1 - X0) + '" height="' + (Y0 - Y1) + '" fill="transparent"/></svg>';
    h += '<div class="am-sec"><div class="am-st"><b>Verlauf</b><span class="muted">flach = Magazin · Sprung = Pauschalbetrag · gestrichelt = Prognose</span></div><div class="am-cw">' + svg + '<div class="am-tip" hidden></div></div></div>';

    // Tabelle
    h += '<div class="am-sec"><div class="am-st"><b>Beiträge je Standort</b></div><div class="tbl-wrap"><table class="tbl am-tbl"><thead><tr><th>Zeitraum</th><th>Standort</th><th>Projekt</th><th>Ansatz</th><th class="r">Tage</th><th class="r">Betrag CHF</th><th class="r">Kumuliert CHF</th><th>Stand</th><th></th></tr></thead><tbody>';
    A.rows.forEach(function (r, n) {
      var pc = Math.round(r.kum / A.wert * 100), over = r.kum >= A.wert, isBe = n === A.beRow;
      h += '<tr class="' + (isBe ? 'am-be' : r.kind === 'vor' ? 'am-vor' : r.kind === 'mag' ? 'am-mag' : '') + '">' +
        '<td class="mono">' + (r.kind === 'vor' ? 'bis ' + M.fmtDate(r.bis) : M.fmtDate(r.von) + ' – ' + (r.bis ? M.fmtDate(r.bis) : 'heute')) + '</td>' +
        '<td>' + esc(r.ort) + '</td><td>' + (r.proj ? esc(M.projName(r.proj)) : '<span class="muted">–</span>') + '</td><td>' + esc(r.ansatz) + '</td>' +
        '<td class="r mono">' + (r.tage === null ? '' : r.tage) + '</td><td class="r mono">' + (r.betrag === null ? '–' : M.chf(r.betrag)) + '</td><td class="r mono strong">' + M.chf(r.kum) + '</td>' +
        '<td><span class="am-pb"><span style="width:' + Math.min(100, pc) + '%;background:' + (over ? '#2E8B5E' : '#1F5FAE') + '"></span></span><span class="mono small' + (over ? ' ok-t' : '') + '">' + pc + ' %' + (isBe ? ' · abbezahlt' : '') + '</span></td>' +
        '<td>' + (r.e ? '<button type="button" class="ic-btn" data-act="edit-einsatz" data-id="' + r.e.id + '" aria-label="Ansatz bearbeiten">✎</button>' : '<button type="button" class="ic-btn" data-act="edit" data-id="' + gid + '" aria-label="Startwert bearbeiten">✎</button>') + '</td></tr>';
    });
    h += '</tbody></table></div></div>';
    h += '<div class="am-note"><div><b>Startwert beim Erfassen.</b> Geräte, die schon länger laufen, bekommen den bereits amortisierten Betrag mit «Stand per» (unter «Bearbeiten»). Er zählt voll, aber zu keinem Projekt.</div>' +
      '<div><b>Pro Standort.</b> Jeder Feld-Standort hat seinen Ansatz: pro Monat (läuft tageweise mit) oder pauschal (einmal beim Setzen). Im Magazin keine Amortisation.</div>' +
      '<div class="ok"><b>Ab dem Anschaffungswert</b> ist das Gerät abbezahlt. Alles darüber ist Ertrag; der Restwert bleibt bei 0.</div></div>';
    return h;
  };

  /* Hover im Verlauf: Datum und Stand an der Mausposition */
  M.amortHover = function (svg, ev) {
    var r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * 1000;
    var g = svg.querySelector('.am-hover'), tip = svg.parentNode.querySelector('.am-tip');
    if (x < 64 || x > 984) { g.style.display = 'none'; tip.hidden = true; return; }
    var t0 = +svg.getAttribute('data-t0'), t1 = +svg.getAttribute('data-t1'), ym = +svg.getAttribute('data-ymax');
    var t = t0 + (x - 64) / 920 * (t1 - t0), A = M.amortInfo(svg.getAttribute('data-gid'));
    var now = new Date(M.today() + 'T00:00:00').getTime();
    if (t > now || t < A.pts[0][0]) { g.style.display = 'none'; tip.hidden = true; return; }
    var v = A.pts[0][1], row = null;
    for (var n = 1; n < A.pts.length; n++) { var a = A.pts[n - 1], b = A.pts[n]; if (t >= a[0] && t <= b[0]) { v = b[0] === a[0] ? b[1] : a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]); } }
    var ds = M.iso(new Date(t));
    A.rows.forEach(function (rw) { if (rw.von && rw.von <= ds && (!rw.bis || rw.bis > ds)) row = rw; });
    var y = 262 - v / ym * 244;
    g.style.display = ''; g.querySelector('.am-hl').setAttribute('x1', x); g.querySelector('.am-hl').setAttribute('x2', x);
    g.querySelector('.am-hc').setAttribute('cx', x); g.querySelector('.am-hc').setAttribute('cy', y);
    tip.hidden = false;
    tip.innerHTML = '<b class="mono">' + M.fmtDate(ds) + '</b><span>CHF ' + M.chf(v) + ' · ' + Math.round(v / A.wert * 100) + ' %</span><span class="muted">' + esc(row ? row.ort + (row.proj ? ' · ' + M.projName(row.proj) : '') : 'vor Erfassung') + '</span>';
    var px = x / 1000 * r.width;
    tip.style.left = Math.min(r.width - 190, Math.max(0, px + 12)) + 'px';
    tip.style.top = Math.max(0, y / 300 * r.height - 30) + 'px';
  };
})();
