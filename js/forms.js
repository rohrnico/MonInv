/* MonInv – Masken (Dialoge) */
(function () {
  'use strict';
  var M = window.M, S = window.MonSym, esc = M.esc;

  function $(id) { return document.getElementById(id); }
  function val(id) { var el = $(id); return el && el.value !== '__neu' ? el.value.trim() : ''; }
  function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function fld(label, inner, cls) { return '<label class="fld ' + (cls || '') + '"><span>' + label + '</span>' + inner + '</label>'; }
  function sec(t) { return '<h3 class="fsec">' + t + '</h3>'; }
  /* Feld des Finanzbereichs: für User ausgeblendet (Wert bleibt im Formular und wird unverändert gespeichert) */
  function finFld(label, inner) { return fld(label, inner, 'fin'); }
  function inp(id, v, attrs) { return '<input id="' + id + '" value="' + esc(v === null || v === undefined ? '' : v) + '" ' + (attrs || '') + '>'; }

  /* ---------- Rahmen */
  M.modal = function (o) {
    var root = $('modal-root');
    root.innerHTML = '<div class="mb" data-act="modal-bg"><div class="md' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="md-t">' +
      '<div class="md-h"><h2 id="md-t">' + esc(o.title) + '</h2><button type="button" class="md-x" data-act="modal-close" aria-label="Schliessen">×</button></div>' +
      '<form class="md-f" data-form="' + o.form + '" novalidate><div class="md-b">' + o.body + '</div><div class="md-ft">' + (o.foot || '') + '</div></form></div></div>';
    document.body.classList.add('modal-open');
    root.querySelectorAll('.posbox').forEach(function (bx) { M.posSync(bx.id.replace(/-posbox$/, '')); });
    root.querySelectorAll('.plan-box').forEach(function (bx) { M.planInfoUpdate(bx.id.replace(/-planbox$/, '')); });
    var first = root.querySelector('.md-b input:not([type=hidden]):not([type=radio]):not([type=checkbox]), .md-b select, .md-b textarea');
    if (first && !o.noFocus) setTimeout(function () { first.focus(); }, 30);
  };
  M.closeModal = function () {
    $('modal-root').innerHTML = '';
    document.body.classList.remove('modal-open');
    M.ctx = null;
  };
  M.modalOpen = function () { return !!$('modal-root').firstChild; };
  function foot(saveLabel, extra) {
    return (extra || '') + '<span class="grow"></span><button type="button" class="btn ghost" data-act="modal-close">Abbrechen</button><button type="submit" class="btn">' + (saveLabel || 'Speichern') + '</button>';
  }
  M.confirm = function (title, text, label, fn, danger) {
    M.ctx = { confirm: fn };
    M.modal({ title: title, form: 'confirm', body: '<p>' + text + '</p>', foot: '<span class="grow"></span><button type="button" class="btn ghost" data-act="modal-close">Abbrechen</button><button type="submit" class="btn' + (danger ? ' danger' : '') + '">' + esc(label) + '</button>', noFocus: true });
  };

  /* ================================================== Standort + Projekt (gemeinsamer Baustein) */
  function locFields(p, init, opts) {
    init = init || {}; opts = opts || {};
    var ort = init.ort === 'magazin' ? 'magazin' : 'feld';
    var lv = M.has(init.lat) ? M.toLv95(init.lat, init.lng) : null;
    var mags = M.magazine();
    var h = '<fieldset class="extra loc"><legend>Standort</legend><input type="hidden" id="' + p + '-ort" value="' + ort + '">' +
      '<div class="seg full" role="group" aria-label="Standort">' +
      '<button type="button" data-act="loc-ort" data-p="' + p + '" data-k="feld" class="' + (ort === 'feld' ? 'on' : '') + '" aria-pressed="' + (ort === 'feld') + '">Im Feld</button>' +
      '<button type="button" data-act="loc-ort" data-p="' + p + '" data-k="magazin" class="' + (ort === 'magazin' ? 'on' : '') + '" aria-pressed="' + (ort === 'magazin') + '"' + (mags.length ? '' : ' disabled') + '>Im Magazin</button></div>' +
      '<div id="' + p + '-feld"' + (ort === 'feld' ? '' : ' hidden') + '><div class="grid2">' +
      fld('Ost (LV95)', inp(p + '-e', lv ? Math.round(lv.e) : '', 'inputmode="decimal" class="mono" placeholder="2\'600\'000"')) +
      fld('Nord (LV95)', inp(p + '-n', lv ? Math.round(lv.n) : '', 'inputmode="decimal" class="mono" placeholder="1\'200\'000"')) + '</div>' +
      '<div class="loc-tools"><button type="button" class="btn ghost sm" data-act="loc-gps" data-p="' + p + '">Mein Standort (GPS)</button>' +
      '<div class="row-in loc-q"><input id="' + p + '-q" placeholder="Adresse oder Ort suchen" aria-label="Adresse oder Ort suchen" data-enter="loc-search" data-p="' + p + '">' +
      '<button type="button" class="btn ghost sm" data-act="loc-search" data-p="' + p + '">Suchen</button></div></div>' +
      '<div id="' + p + '-res" class="loc-res"></div>' +
      (opts.amort ? amortFields(p, opts.amort) : '') +
      (opts.mcc ? opts.mcc : '') +
      (opts.later !== false ? '<label class="chk"><input type="checkbox" id="' + p + '-later"' + (lv ? '' : ' checked') + '> Position danach auf der Karte setzen</label>' : '') +
      '</div>' +
      '<div id="' + p + '-mag"' + (ort === 'magazin' ? '' : ' hidden') + '>' + fld('Magazin', '<select id="' + p + '-magsel">' + M.magOptions(init.magazinId) + '</select>') + '</div>' +
      '</fieldset>' +
      '<fieldset class="extra loc"><legend>Projekt</legend>' +
      '<div class="grid2">' + M.projSelHtml(p, init.projektId || '', ort === 'magazin') +
      fld('Auftragsnummer / Teilprojekt', '<input id="' + p + '-auftrag" list="auftrag-list" maxlength="40" value="' + esc(init.auftrag || '') + '" placeholder="z.B. 26160-03"' + (ort === 'magazin' ? ' disabled' : '') + '>' + M.auftragList()) + '</div>' + M.newProjBox(p) +
      '<div id="' + p + '-posbox" class="posbox">' + (ort === 'magazin' ? '' : M.posBoxHtml(p, init.projektId, init, opts.n || 1)) + '</div>' +
      M.planBoxHtml(p, init, ort === 'magazin') +
      '<p class="muted small" id="' + p + '-projhint">' + (ort === 'magazin' ? 'Im Magazin läuft kein Projekt.' : 'Für Abrechnung und Projekthistorie. Der Standort oben bleibt davon unabhängig.') + '</p></fieldset>';
    return h;
  }
  /* Projektauswahl mit «＋ Neues Projekt …» direkt im Dialog */
  M.NEU_PROJ = '__neu';
  M.projSelHtml = function (p, sel, disabled) {
    return fld('Projekt (optional)', '<select id="' + p + '-proj" data-change="loc-proj" data-p="' + p + '" data-prev="' + esc(sel || '') + '"' + (disabled ? ' disabled' : '') + '>' +
      M.projOptions(sel || '', true, '– kein Projekt –') + '<option value="' + M.NEU_PROJ + '">＋ Neues Projekt …</option></select>');
  };
  M.newProjBox = function (p) {
    return '<div class="np-box" id="' + p + '-np" hidden><div class="np-h">Neues Projekt anlegen</div><div class="np-row">' +
      fld('Auftrags-Nr.', inp(p + '-np-nr', '', 'maxlength="30" placeholder="z.B. 26160" data-enter="np-add" data-p="' + p + '"')) +
      fld('Name', inp(p + '-np-name', '', 'maxlength="80" placeholder="z.B. Baugrube Bahnhofplatz" data-enter="np-add" data-p="' + p + '"')) +
      '<div class="np-btns"><button type="button" class="btn ghost sm" data-act="np-cancel" data-p="' + p + '">Abbrechen</button>' +
      '<button type="button" class="btn sm" data-act="np-add" data-p="' + p + '">Anlegen</button></div></div>' +
      '<p class="form-err" id="' + p + '-np-err" role="alert"></p></div>';
  };
  M.newProjShow = function (p, on) {
    var bx = $(p + '-np'); if (!bx) return;
    bx.hidden = !on;
    if (on) { $(p + '-np-err').textContent = ''; setTimeout(function () { var n = $(p + '-np-nr'); if (n) n.focus(); }, 30); }
  };
  M.newProjAdd = function (p) {
    var nr = val(p + '-np-nr'), name = val(p + '-np-name');
    if (!name) { $(p + '-np-err').textContent = 'Bitte einen Projektnamen eingeben.'; $(p + '-np-name').focus(); return; }
    var dup = M.state.data.projekte.find(function (x) { return x.typ === 'projekt' && nr && x.nummer === nr; });
    if (dup) { $(p + '-np-err').textContent = 'Auftragsnummer ' + nr + ' gibt es schon: ' + M.projName(dup) + '.'; return; }
    var pr = { id: M.uid('prj'), nummer: nr, name: name, typ: 'projekt', status: 'aktiv', lat: null, lng: null };
    return M.put('projekte', pr).then(function () {
      var s = $(p + '-proj'); if (!s) return;
      s.innerHTML = M.projOptions(pr.id, true, '– kein Projekt –') + '<option value="' + M.NEU_PROJ + '">＋ Neues Projekt …</option>';
      s.value = pr.id; s.setAttribute('data-prev', pr.id);
      $(p + '-np-nr').value = ''; $(p + '-np-name').value = '';
      M.newProjShow(p, false);
      M.CHANGE['loc-proj']({ p: p }, s);
      M.toast('Projekt «' + M.projName(pr) + '» angelegt');
    });
  };
  M.newProjCancel = function (p) {
    var s = $(p + '-proj'); if (s) s.value = s.getAttribute('data-prev') || '';
    M.newProjShow(p, false);
  };

  /* Geplante Laufzeit: Monate (ab Einsatzbeginn) oder bis Datum */
  M.planBoxHtml = function (p, init, hidden) {
    init = init || {};
    var mode = init.planBis && !init.planMonate ? 'datum' : 'monate', had = init.planBis ? '1' : '';
    return '<div class="plan-box" id="' + p + '-planbox" data-had="' + had + '"' + (hidden ? ' hidden' : '') + '><span class="lbl">Geplante Laufzeit <span class="muted">(optional – für Planung und Offertkontrolle)</span></span>' +
      '<input type="hidden" id="' + p + '-planmode" value="' + mode + '"><div class="row-in">' +
      '<div class="seg" role="group" aria-label="Laufzeit angeben als"><button type="button" data-act="plan-mode" data-p="' + p + '" data-k="monate" class="' + (mode === 'monate' ? 'on' : '') + '" aria-pressed="' + (mode === 'monate') + '">Monate</button>' +
      '<button type="button" data-act="plan-mode" data-p="' + p + '" data-k="datum" class="' + (mode === 'datum' ? 'on' : '') + '" aria-pressed="' + (mode === 'datum') + '">bis Datum</button></div>' +
      '<input id="' + p + '-planm" type="number" min="1" max="240" inputmode="numeric" placeholder="z.B. 12" aria-label="Laufzeit in Monaten" class="r plan-m" value="' + esc(init.planMonate || '') + '" data-input="plan-in" data-p="' + p + '"' + (mode === 'monate' ? '' : ' hidden') + '>' +
      '<input id="' + p + '-pland" type="date" aria-label="Geplant bis" value="' + esc(init.planBis || '') + '" data-change="plan-in" data-p="' + p + '"' + (mode === 'datum' ? '' : ' hidden') + '></div>' +
      '<p class="muted small" id="' + p + '-planinfo"></p></div>';
  };
  function planStart(p) {
    var el = $(p === 'el' ? 'e-von' : p + '-date');
    return (el && el.value) || (M.ctx && M.ctx.planVon) || M.today();
  }
  M.planInfoUpdate = function (p) {
    var el = $(p + '-planinfo'); if (!el) return;
    var mode = val(p + '-planmode'), von = planStart(p);
    var viele = M.ctx && M.ctx.kind === 'laufzeit' && M.ctx.ids.length > 1;
    if (mode === 'monate' && viele) {
      var n0 = M.num(val(p + '-planm'));
      el.textContent = n0 ? 'Endet ' + n0 + ' Monate nach dem Montagedatum jedes Geräts.' : 'Leer lassen, wenn noch offen.';
    } else if (mode === 'monate') {
      var n = M.num(val(p + '-planm'));
      el.textContent = n ? 'Endet geplant am ' + M.fmtDate(M.addMonths(von, n)) + ' (ab ' + M.fmtDate(von) + ').' : 'Leer lassen, wenn noch offen.';
    } else {
      var b = val(p + '-pland');
      el.textContent = b ? (b <= von ? 'Das Datum liegt vor dem Beginn (' + M.fmtDate(von) + ').' : '= ' + M.monateZwischen(von, b) + ' abgerechnete Monate ab ' + M.fmtDate(von) + '.') : 'Leer lassen, wenn noch offen.';
    }
  };
  M.planSetMode = function (p, k) {
    $(p + '-planmode').value = k;
    document.querySelectorAll('[data-act=plan-mode][data-p="' + p + '"]').forEach(function (b) { var on = b.getAttribute('data-k') === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $(p + '-planm').hidden = k !== 'monate'; $(p + '-pland').hidden = k !== 'datum';
    M.planInfoUpdate(p);
  };
  function readPlan(p, t) {
    var box = $(p + '-planbox'); if (!box || box.hidden) return;
    var mode = val(p + '-planmode');
    var n = mode === 'monate' ? M.num(val(p + '-planm')) : null, b = mode === 'datum' ? val(p + '-pland') : '';
    if (n) { t.planMonate = n; delete t.planBis; }
    else if (b) { t.planBis = b; t.planMonate = null; }
    else if (box.getAttribute('data-had')) { t.planBis = ''; t.planMonate = null; }   // bewusst geleert
  }
  M.readPlan = readPlan;

  /* Offertposition und Set wählen (ersetzt den Amortisationsbetrag) */
  M.posBoxHtml = function (p, projektId, sel, n) {
    sel = sel || {};
    if (!projektId || projektId === M.NEU_PROJ) return '';
    var I = M.idx(), ps = I.posByProj[projektId] || [];
    var pid = sel.positionId && I.pos[sel.positionId] ? sel.positionId : '';
    var P = pid ? I.pos[pid] : null;
    var h = fld('Offertposition', '<select id="' + p + '-pos" data-change="loc-pos" data-p="' + p + '" data-prev="' + pid + '">' +
      opt('', ps.length ? '– keine Position –' : '– noch keine Positionen –', !pid) +
      M.ABR_ORDER.map(function (g) {
        var arr = ps.filter(function (x) { return (x.gruppe || 'sen') === g; });
        return arr.length ? '<optgroup label="' + esc(M.ABR_GRUPPEN[g].n) + '">' + arr.map(function (x) { return opt(x.id, (x.nr ? x.nr + ' · ' : '') + x.text + (x.art === 'set' ? ' (Set)' : ''), x.id === pid); }).join('') + '</optgroup>' : '';
      }).join('') + '<option value="' + M.NEU_PROJ + '">＋ Neue Offertposition …</option></select>');
    if (P && P.art === 'set') {
      var units = M.posUnits(P.id).list.filter(function (u) { return u.aktiv; });
      var curKey = sel.einheit ? 'S:' + sel.einheit : null;
      h += fld('Set', '<select id="' + p + '-einheit">' + opt('neu', n > 1 ? 'Neues Set aus diesen ' + n + ' Geräten' : 'Neues Set', !curKey) +
        units.map(function (u) { return opt(u.key.slice(2), M.unitLabel(P, u), u.key === curKey); }).join('') + '</select>');
    }
    if (P) h += '<div class="pos-chips"><span><i>Vorhalten</i>' + M.chf(P.V) + '</span><span><i>Betrieb</i>' + M.chf(P.B) + '</span><span><i>Wartung</i>' + M.chf(P.W) + '</span><em>CHF pro ' + (P.art === 'set' ? 'Set' : 'Gerät') + ' und Monat</em></div>';
    else if (!ps.length) h += '<p class="muted small pos-hint">Position direkt hier erfassen – oder später unter Projekte › Offerte &amp; Positionen.</p>';
    h += M.newPosBox(p);
    return h;
  };
  M.newPosBox = function (p) {
    var gid = M.ctx && (M.ctx.gid || (M.ctx.gids && M.ctx.gids[0]));
    var gr = gid ? M.abrGruppeOf(gid) : 'sen';
    var num = function (k, l) { return fld(l, '<div class="unit-in"><input id="' + p + '-np' + k + '" inputmode="decimal" class="r" placeholder="0" data-enter="npos-add" data-p="' + p + '"><i>CHF</i></div>'); };
    return '<div class="np-box npos-box" id="' + p + '-npos" hidden><div class="np-h">Neue Offertposition</div>' +
      '<div class="npos-g1">' + fld('Pos.', inp(p + '-npnr', '', 'maxlength="12" placeholder="1.1" data-enter="npos-add" data-p="' + p + '"')) +
      fld('Bezeichnung', inp(p + '-nptext', '', 'maxlength="120" placeholder="z.B. Automatisches Tachymeter inkl. MCC" data-enter="npos-add" data-p="' + p + '"')) + '</div>' +
      '<div class="npos-g2">' + fld('Gruppe', '<select id="' + p + '-npgr">' + M.ABR_ORDER.map(function (g) { return opt(g, M.ABR_GRUPPEN[g].n, g === gr); }).join('') + '</select>') +
      fld('Preis gilt', '<select id="' + p + '-npart">' + opt('stk', 'pro Gerät', true) + opt('set', 'pro Set', false) + '</select>') + '</div>' +
      '<div class="npos-g3">' + num('V', 'Vorhalten / Mt.') + num('B', 'Betrieb / Mt.') + num('W', 'Wartung / Mt.') + '</div>' +
      '<p class="form-err" id="' + p + '-npos-err" role="alert"></p>' +
      '<div class="np-btns end"><button type="button" class="btn ghost sm" data-act="npos-cancel" data-p="' + p + '">Abbrechen</button>' +
      '<button type="button" class="btn sm" data-act="npos-add" data-p="' + p + '">Position anlegen</button></div></div>';
  };
  M.newPosShow = function (p, on) {
    var bx = $(p + '-npos'); if (!bx) return;
    bx.hidden = !on;
    if (on) { $(p + '-npos-err').textContent = ''; setTimeout(function () { var n = $(p + '-npnr'); if (n) n.focus(); }, 30); }
  };
  M.newPosCancel = function (p) {
    var s = $(p + '-pos'); if (s) s.value = s.getAttribute('data-prev') || '';
    M.newPosShow(p, false);
  };
  M.newPosAdd = function (p) {
    var projektId = val(p + '-proj'), err = $(p + '-npos-err');
    var d = { id: M.uid('pos'), projektId: projektId, nr: val(p + '-npnr'), text: val(p + '-nptext'), gruppe: val(p + '-npgr') || 'sen', art: val(p + '-npart') === 'set' ? 'set' : 'stk', offMonate: '', bemerkung: '' };
    ['V', 'B', 'W'].forEach(function (k) { var x = M.num(val(p + '-np' + k)); d[k] = x === null ? (k === 'V' ? '' : 0) : x; });
    if (!projektId) { err.textContent = 'Zuerst ein Projekt wählen.'; return; }
    if (!d.text) { err.textContent = 'Bitte die Bezeichnung eingeben.'; $(p + '-nptext').focus(); return; }
    if (d.V === '') { err.textContent = 'Bitte den Preis für Vorhalten eingeben (0 ist möglich).'; $(p + '-npV').focus(); return; }
    return M.put('positionen', d).then(function () {
      var bx = $(p + '-posbox'); if (!bx) return;
      bx.innerHTML = M.posBoxHtml(p, projektId, { positionId: d.id }, (M.ctx && M.ctx.n) || 1); M.posSync(p);
      if (M.ctx && M.ctx.kind === 'move') M.movePreview();
      M.toast('Position ' + (d.nr ? d.nr + ' ' : '') + '«' + d.text + '» angelegt');
    });
  };
  M.posSync = function (p) {
    var on = !!($(p + '-pos') && val(p + '-pos'));
    var box = $(p + '-abox'); if (box) box.hidden = on || box.getAttribute('data-off') === '1';
  };
  /* Amortisation an diesem Standort: frei wählbarer Betrag pro Monat oder pauschal */
  function amortFields(p, a) {
    var modus = a.modus === 'pauschal' ? 'pauschal' : 'monat';
    if (!a.edit) return '';   // eigener Betrag entfällt: Amortisation läuft über die Offertposition (nur Korrektur in der Historie)
    var off = !(M.num(a.betrag) > 0);   // eigener Betrag nur noch für bestehende Einsätze – sonst über die Offertposition
    return '<div class="amort-box" id="' + p + '-abox"' + (off ? ' data-off="1" hidden' : '') + '><span class="lbl">Eigener Amortisationsbetrag (ohne Offertposition)</span><input type="hidden" id="' + p + '-amodus" value="' + modus + '">' +
      '<div class="row-in"><span class="chf">CHF</span><input id="' + p + '-amort" value="' + esc(M.has(a.betrag) ? a.betrag : '') + '" inputmode="decimal" class="r" aria-label="Betrag CHF" placeholder="' + esc(a.placeholder || '0') + '">' +
      '<div class="seg" role="group" aria-label="Art der Amortisation">' +
      '<button type="button" data-act="amort-mode" data-p="' + p + '" data-k="monat" class="' + (modus === 'monat' ? 'on' : '') + '" aria-pressed="' + (modus === 'monat') + '">pro Monat</button>' +
      '<button type="button" data-act="amort-mode" data-p="' + p + '" data-k="pauschal" class="' + (modus === 'pauschal' ? 'on' : '') + '" aria-pressed="' + (modus === 'pauschal') + '">pauschal</button></div>' +
      (a.scope > 1 ? '<input type="hidden" id="' + p + '-ascope" value="geraet"><div class="seg" role="group" aria-label="Betrag gilt für">' +
        '<button type="button" data-act="amort-scope" data-p="' + p + '" data-k="geraet" class="on" aria-pressed="true">je Gerät</button>' +
        '<button type="button" data-act="amort-scope" data-p="' + p + '" data-k="total" aria-pressed="false">Total für alle ' + a.scope + '</button></div>' : '') + '</div>' +
      (a.scope > 1 ? '<p class="small am-scope-info" id="' + p + '-ainfo"></p>' : '') +
      '<p class="muted small">Pro Monat läuft, solange das Gerät hier steht; pauschal wird einmal gebucht. Beides reduziert den Restwert. Im Magazin wird nichts gebucht.</p></div>';
  }
  M.amortSetScope = function (p, k) {
    $(p + '-ascope').value = k;
    document.querySelectorAll('[data-act=amort-scope][data-p="' + p + '"]').forEach(function (b) { var on = b.getAttribute('data-k') === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    if (M.ctx && M.ctx.kind === 'move') M.movePreview();
  };
  /* Betrag je Gerät aus der Eingabe (je Gerät oder Total verteilt) */
  function amortPer(p, n) {
    var b = M.num(val(p + '-amort'));
    if (b === null) return null;
    if ($(p + '-ascope') && val(p + '-ascope') === 'total' && n > 0) return Math.round(b / n * 100) / 100;
    return b;
  }
  M.amortSetMode = function (p, k) {
    $(p + '-amodus').value = k;
    document.querySelectorAll('[data-act=amort-mode][data-p="' + p + '"]').forEach(function (b) { var on = b.getAttribute('data-k') === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    if (M.ctx && M.ctx.kind === 'move') M.movePreview();
  };
  function posPreview(t) {
    var P = M.idx().pos[t.positionId];
    return P ? M.posLabel(P) + ' · ' + (P.art === 'set' ? (t.einheit && M.posUnits(P.id).map['S:' + t.einheit] ? 'ins bestehende Set' : 'als neues Set') : 'Stückpreis') + ' · Vorhalten CHF ' + M.chf(P.V) + ' pro Monat → Amortisation' : '';
  }
  function amortPreview(t, fallback) {
    if (t.positionId) return posPreview(t);
    var b = M.has(t.amortBetrag) ? t.amortBetrag : (fallback ? M.num(fallback.betrag) || 0 : 0);
    var m = t.amortModus || (fallback && fallback.modus) || 'monat';
    if (!b) return 'keine Amortisation an diesem Standort';
    return m === 'monat' ? 'CHF ' + M.chf(b) + ' Amortisation pro Monat, solange das Gerät hier steht' : 'CHF ' + M.chf(b) + ' Amortisation pauschal';
  }
  /* MCC-Auswahl für einen Tachymeter (Pflicht im Feld) */
  function mccSelect(id, tsId, sel) {
    var I = M.idx();
    var mccs = M.state.data.geraete.filter(function (x) { return x.typ === 'mcc' && x.zustand !== 'ausgemustert' && (!I.tsOfMcc[x.id] || I.tsOfMcc[x.id] === tsId); })
      .sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'de', { numeric: true }); });
    return fld('MCC TSC · Pflicht im Feld', '<select id="' + id + '">' + opt('', mccs.length ? '– bitte wählen –' : 'keine freie MCC erfasst', !sel) +
      mccs.map(function (m) { return opt(m.id, m.name + ' · ' + M.info(m.id).ortText, sel === m.id); }).join('') + '</select>');
  }
  M.mccSelect = mccSelect;

  function readLoc(p) {
    var ort = val(p + '-ort');
    if (ort === 'magazin') {
      var m = val(p + '-magsel');
      if (!m) return { err: 'Bitte ein Magazin wählen.' };
      return { t: { ort: 'magazin', magazinId: m } };
    }
    var t = { ort: 'feld', projektId: val(p + '-proj') || null, lat: null, lng: null };
    if ($(p + '-auftrag')) t.auftrag = val(p + '-auftrag').trim();
    if ($(p + '-amort')) { t.amortModus = val(p + '-amodus') || 'monat'; t.amortBetrag = M.num(val(p + '-amort')); }
    readPos(p, t);
    readPlan(p, t);
    if (val(p + '-e') || val(p + '-n')) {
      var w = M.parseLv95(val(p + '-e'), val(p + '-n'));
      if (!w) return { err: 'LV95-Koordinaten prüfen (Ost 2\'xxx\'xxx, Nord 1\'xxx\'xxx).' };
      t.lat = w.lat; t.lng = w.lng;
    }
    return { t: t, later: $(p + '-later') ? $(p + '-later').checked && !M.has(t.lat) : false };
  }
  function readPos(p, t) {
    if (!$(p + '-pos')) { if ($(p + '-posbox') && t.projektId && !(M.idx().posByProj[t.projektId] || []).length) t.positionId = ''; return; }
    t.positionId = val(p + '-pos') || '';
    if (t.positionId) {
      var e = $(p + '-einheit') ? val(p + '-einheit') : '';
      t.einheit = e === 'neu' ? M.uid('set') : (e || null);
      delete t.amortModus; delete t.amortBetrag;
    }
  }
  M.readPos = readPos;
  M.locSetOrt = function (p, k) {
    $(p + '-ort').value = k;
    document.querySelectorAll('[data-act=loc-ort][data-p="' + p + '"]').forEach(function (b) { var on = b.getAttribute('data-k') === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $(p + '-feld').hidden = k !== 'feld';
    $(p + '-mag').hidden = k !== 'magazin';
    $(p + '-proj').disabled = k === 'magazin';
    if ($(p + '-auftrag')) $(p + '-auftrag').disabled = k === 'magazin';
    if ($(p + '-posbox')) { $(p + '-posbox').innerHTML = k === 'magazin' ? '' : M.posBoxHtml(p, val(p + '-proj'), {}, (M.ctx && M.ctx.n) || 1); M.posSync(p); }
    if ($(p + '-planbox')) $(p + '-planbox').hidden = k === 'magazin';
    $(p + '-projhint').textContent = k === 'magazin' ? 'Im Magazin läuft kein Projekt.' : 'Für Abrechnung und Projekthistorie. Der Standort oben bleibt davon unabhängig.';
    if (M.movePreview && M.ctx && M.ctx.kind === 'move') M.movePreview();
  };
  M.locFill = function (p, lat, lng, label) {
    var c = M.toLv95(lat, lng);
    $(p + '-e').value = Math.round(c.e); $(p + '-n').value = Math.round(c.n);
    if ($(p + '-later')) $(p + '-later').checked = false;
    $(p + '-res').innerHTML = label ? '<span class="muted small">Übernommen: ' + esc(label) + '</span>' : '';
  };
  M.locGps = function (p) {
    if (!navigator.geolocation) { M.toast('Dieses Gerät liefert keinen Standort.', 'err'); return; }
    $(p + '-res').innerHTML = '<span class="muted small">Standort wird ermittelt …</span>';
    navigator.geolocation.getCurrentPosition(function (pos) {
      M.locFill(p, pos.coords.latitude, pos.coords.longitude, 'GPS ± ' + Math.round(pos.coords.accuracy) + ' m');
    }, function () { $(p + '-res').innerHTML = '<span class="warn-t small">Standort nicht verfügbar.</span>'; }, { enableHighAccuracy: true, timeout: 15000 });
  };
  M.locSearch = function (p) {
    var q = val(p + '-q');
    if (!q) return;
    $(p + '-res').innerHTML = '<span class="muted small">Suche …</span>';
    M.ortSuche(q).then(function (r) {
      $(p + '-res').innerHTML = r.length ? r.map(function (x) {
        return '<button type="button" class="res-btn" data-act="loc-pick" data-p="' + p + '" data-lat="' + x.lat + '" data-lng="' + x.lng + '" data-label="' + esc(x.label) + '">' + esc(x.label) + '</button>';
      }).join('') : '<span class="muted small">Nichts gefunden.</span>';
    });
  };

  /* ================================================== GERÄT */
  function katOptions(sel, typ) {
    var ks = M.state.data.kategorien.filter(function (k) { return (k.typ || 'sensor') === typ; });
    var h = '';
    S.GRUPPEN_ORDER.forEach(function (gk) {
      var g = ks.filter(function (k) { return k.gruppe === gk; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'de'); });
      if (!g.length) return;
      h += '<optgroup label="' + esc(S.GRUPPEN[gk].name) + '">' + g.map(function (k) { return opt(k.id, k.name, k.id === sel); }).join('') + '</optgroup>';
    });
    return h;
  }

  M.openGeraet = function (gid, typ, draft) {
    var I = M.idx();
    var g = gid ? M.copy(I.ger[gid]) : null;
    var d = draft || (g ? g : { typ: typ || 'sensor', kaufdatum: '', extra: {}, zustand: 'aktiv' });
    if (!d.extra) d.extra = {};
    var t = d.typ;
    if (!d.kategorieId) {
      var first = M.state.data.kategorien.find(function (k) { return (k.typ || 'sensor') === t; });
      d.kategorieId = first ? first.id : '';
    }
    var kat = I.kat[d.kategorieId];
    M.ctx = { kind: 'geraet', gid: gid, d: d };
    var st = M.settings();

    var b = '';
    if (!gid) {
      b += '<div class="seg full" role="group" aria-label="Gerätetyp">' + ['sensor', 'tachymeter', 'mcc'].map(function (k) {
        return '<button type="button" class="' + (t === k ? 'on' : '') + '" data-act="g-typ" data-k="' + k + '">' + M.typLabel[k] + '</button>';
      }).join('') + '</div>';
    }
    b += sec('Gerät') + '<div class="grid2">';
    b += fld(t === 'mcc' ? 'Bezeichnung' : (t === 'tachymeter' ? 'Nummer' : 'Name'), inp('g-name', d.name, 'required maxlength="60" placeholder="' + (t === 'mcc' ? 'z.B. SN 41207' : t === 'tachymeter' ? 'z.B. TS-12' : 'z.B. IN-11') + '"'));
    if (t === 'sensor') {
      b += '<div class="fld"><label for="g-kat">Kategorie · wählen oder neu</label><div class="row-in"><select id="g-kat" data-change="g-kat">' + katOptions(d.kategorieId, 'sensor') + '</select>' +
        '<button type="button" class="btn ghost sm" data-act="g-newkat">+ Neu</button></div></div>';
    } else {
      b += fld('Typ', inp('g-gtyp', d.gtyp, 'maxlength="60" placeholder="' + (t === 'mcc' ? 'MCC TSC' : 'z.B. Leica TM50') + '"'));
    }
    b += fld('Hersteller', inp('g-her', d.hersteller, 'maxlength="60"'));
    b += fld('Seriennummer', inp('g-sn', d.seriennummer, 'maxlength="60"'));
    if (t !== 'tachymeter' || d.sim) {
      var hasSim = !!d.sim;
      b += '<div class="fld"><span class="lbl">SIM-Karte</span><div class="row-in">' +
        '<label class="rad"><input type="radio" name="g-simk" id="g-sim-no" value="no"' + (hasSim ? '' : ' checked') + ' data-change="g-simk"> keine</label>' +
        '<label class="rad"><input type="radio" name="g-simk" id="g-sim-yes" value="yes"' + (hasSim ? ' checked' : '') + ' data-change="g-simk"> Nummer</label>' +
        inp('g-sim', d.sim, 'aria-label="SIM-Nummer" class="mono" placeholder="8941 …"' + (hasSim ? '' : ' disabled')) + '</div></div>';
    }
    if (t === 'mcc') {
      b += '<div class="fld"><label for="g-wlan">WLAN-Passwort</label><div class="row-in"><input id="g-wlan" type="password" class="mono" autocomplete="off" value="' + esc(d.wlanPasswort || '') + '">' +
        '<button type="button" class="btn ghost sm" data-act="pw-toggle" data-for="g-wlan">Zeigen</button></div></div>';
    }
    if (t === 'tachymeter') b += mccSelect('g-mcc', gid, d.mccId);
    b += '</div>' + sec(M.can('fin') ? 'Wert & Amortisation' : 'Kauf') + '<div class="grid2">';
    b += fld('Kaufdatum', inp('g-kauf', d.kaufdatum, 'type="date"'));
    // Finanzfelder für User nur ausgeblendet: die Werte bleiben beim Speichern erhalten
    b += finFld('Anschaffungswert', '<div class="unit-in"><input id="g-wert" value="' + esc(M.has(d.wert) ? d.wert : '') + '" inputmode="decimal" class="r"><i>CHF</i></div>');
    b += finFld('Bereits amortisiert vor Erfassung', '<div class="unit-in"><input id="g-vor" value="' + esc(M.has(d.amortVor) ? d.amortVor : '') + '" inputmode="decimal" class="r" placeholder="0"><i>CHF</i></div>');
    b += finFld('Stand per', inp('g-vordat', d.amortVorDatum || (gid ? '' : M.today()), 'type="date"'));
    b += '</div>' + sec('Wartung & Zustand') + '<div class="grid2">';
    var defInt = st.intervall ? st.intervall[t] : null;
    b += fld('Letzte Wartung', inp('g-lw', d.letzteWartung, 'type="date"'));
    b += fld('Wartungsintervall Monate', inp('g-int', d.wartungIntervall, 'type="number" min="1" max="120" placeholder="' + (defInt ? 'Standard ' + defInt : 'keine Wartung') + '"'));
    if (gid) b += fld('Zustand', '<select id="g-zst">' + opt('aktiv', 'in Betrieb', d.zustand === 'aktiv') + opt('defekt', 'defekt', d.zustand === 'defekt') + opt('ausgemustert', 'ausgemustert', d.zustand === 'ausgemustert') + '</select>');
    b += '</div>';

    if (kat && kat.felder && kat.felder.length && t === 'sensor') {
      b += '<fieldset class="extra"><legend>Zusatzfelder der Kategorie «' + esc(kat.name) + '»</legend><div class="grid2">';
      kat.felder.forEach(function (f, n) {
        var v = d.extra[f.name];
        var type = f.typ === 'zahl' ? 'inputmode="decimal"' : f.typ === 'datum' ? 'type="date"' : '';
        b += fld(esc(f.name), inp('g-x-' + n, v, type + ' data-xname="' + esc(f.name) + '"'));
      });
      b += '</div></fieldset>';
    }

    if (!gid) {
      b += locFields('gl', d._loc || { ort: 'feld' }, { amort: { modus: d._loc ? d._loc.amortModus : 'monat', betrag: d._loc ? d._loc.amortBetrag : '' } });
      b += fld('Seit (Inbetriebnahme)', inp('g-von', d._von || M.today(), 'type="date"'));
    } else {
      b += '<p class="hint fsec-hint">Standort und Projekt ändert man mit «Projekt ändern» – so entsteht ein Eintrag in der Historie.</p>';
    }
    b += sec('Notizen') + fld('Bemerkung', '<textarea id="g-bem" rows="3">' + esc(d.bemerkung || '') + '</textarea>', 'full');
    b += '<p class="form-err" id="g-err" role="alert"></p>';

    var extra = gid ? '<button type="button" class="btn ghost danger-t" data-act="g-del">Löschen</button>' : '';
    M.modal({
      title: gid ? (d.name + ' bearbeiten') : 'Neues Instrument', form: 'geraet', wide: true, body: b,
      foot: extra + '<span class="grow"></span><button type="button" class="btn ghost" data-act="modal-close">Abbrechen</button>' +
        '<button type="submit" class="btn ghost" data-submit="dup">Speichern &amp; duplizieren …</button><button type="submit" class="btn">Speichern</button>'
    });
  };

  function readGeraet() {
    var c = M.ctx, d = M.copy(c.d);
    d.name = val('g-name');
    if ($('g-kat')) d.kategorieId = val('g-kat');
    if ($('g-gtyp')) d.gtyp = val('g-gtyp');
    d.hersteller = val('g-her');
    d.seriennummer = val('g-sn');
    d.kaufdatum = val('g-kauf');
    d.wert = M.num(val('g-wert'));
    d.amortVor = M.num(val('g-vor'));
    d.amortVorDatum = val('g-vordat');
    if ($('g-sim')) d.sim = $('g-sim-yes').checked ? val('g-sim') : '';
    if ($('g-wlan')) d.wlanPasswort = $('g-wlan').value;
    if ($('g-mcc')) d.mccId = val('g-mcc') || null;
    d.letzteWartung = val('g-lw');
    d.wartungIntervall = M.num(val('g-int'));
    if ($('g-zst')) d.zustand = val('g-zst');
    d.bemerkung = $('g-bem').value.trim();
    d.extra = d.extra || {};
    document.querySelectorAll('[data-xname]').forEach(function (el) { d.extra[el.getAttribute('data-xname')] = el.value.trim(); });
    if ($('gl-ort')) {
      d._loc = { ort: val('gl-ort'), magazinId: val('gl-magsel'), projektId: val('gl-proj'), amortModus: val('gl-amodus'), amortBetrag: M.num(val('gl-amort')) };
      var w = M.parseLv95(val('gl-e'), val('gl-n'));
      if (w) { d._loc.lat = w.lat; d._loc.lng = w.lng; }
      d._von = val('g-von') || M.today();
    }
    return d;
  }
  M.readGeraetDraft = readGeraet;

  M.submitGeraet = function (mode) {
    var d = readGeraet(), c = M.ctx;
    var err = '', loc = null;
    if (!d.name) err = 'Bitte einen Namen bzw. eine Nummer eingeben.';
    else if (M.state.data.geraete.some(function (x) { return x.id !== c.gid && String(x.name).toLowerCase() === d.name.toLowerCase(); })) err = 'Den Namen «' + d.name + '» gibt es schon.';
    else if (d.typ === 'sensor' && !d.kategorieId) err = 'Bitte eine Kategorie wählen oder neu anlegen.';
    if (!err && !c.gid) { loc = readLoc('gl'); err = loc.err || ''; }
    if (!err && d.typ === 'tachymeter' && !d.mccId && d.zustand !== 'defekt' && d.zustand !== 'ausgemustert') {
      var imFeld = c.gid ? (function () { var ii = M.info(c.gid); return ii.cur && !ii.isMag; })() : (loc && loc.t.ort === 'feld');
      if (imFeld) err = 'Ein Tachymeter im Feld braucht eine MCC TSC. Bitte wählen.';
    }
    if (err) { $('g-err').textContent = err; return; }

    if (d.typ === 'tachymeter' || d.typ === 'mcc') {
      var kk = M.state.data.kategorien.find(function (k) { return k.typ === d.typ; });
      if (kk) d.kategorieId = kk.id;
    }
    var von = d._von;
    delete d._loc; delete d._von;
    var isNew = !c.gid;
    if (isNew) d.id = M.uid('ger');
    var prevMcc = c.gid ? M.idx().ger[c.gid].mccId : null;
    var jobs = [M.put('geraete', d)];
    if (isNew) jobs.push(M.move(d.id, loc.t, von));
    // neu zugeordnete MCC an den Standort des Tachymeters holen
    if (!isNew && d.typ === 'tachymeter' && d.mccId && d.mccId !== prevMcc) jobs.push(M.mccFollow(d.id, d.mccId));
    Promise.all(jobs).then(function () {
      M.closeModal();
      M.toast(isNew ? d.name + ' erfasst' : d.name + ' gespeichert');
      M.refreshUI();
      if (mode === 'dup') M.openDup(d.id);
      else if (isNew && loc.later && loc.t.ort === 'feld') M.startPlacing('geraet', d.id);
      else if (isNew) M.open(d.id);
    });
  };

  /* MCC an den aktuellen Standort ihres Tachymeters holen */
  M.mccFollow = function (tsId, mccId) {
    var ti = M.info(tsId);
    if (!ti || !ti.cur || ti.isMag) return Promise.resolve();
    var c = ti.cur;
    return M.move(mccId, { ort: 'feld', projektId: c.projektId, lat: c.lat, lng: c.lng, ortName: c.ortName }, M.today());
  };

  M.deleteGeraet = function (gid) {
    var g = M.idx().ger[gid], i = M.info(gid);
    var nk = i.kabel.length;
    M.confirm(g.name + ' löschen?', 'Das Gerät und seine ganze Historie werden gelöscht.' + (nk ? ' ' + nk + ' Kabel bleiben auf der Karte, verlieren aber die Verbindung.' : '') +
      ' Wird es nur nicht mehr gebraucht, besser den Zustand auf «ausgemustert» setzen – dann bleibt die Historie erhalten.', 'Endgültig löschen', function () {
      return M.deleteGeraetData(gid).then(function () { M.toast(g.name + ' gelöscht'); });
    }, true);
  };

  /* ================================================== MCC zuordnen */
  M.openMccPick = function (tsId) {
    var I = M.idx(), t = I.ger[tsId];
    M.ctx = { kind: 'mccpick', tsId: tsId };
    var mccs = M.state.data.geraete.filter(function (x) { return x.typ === 'mcc' && x.zustand !== 'ausgemustert' && (!I.tsOfMcc[x.id] || I.tsOfMcc[x.id] === tsId); });
    var b = '<div class="mv-from">' + M.symbol(tsId, 32) + '<div><b>' + esc(t.name) + '</b><span>' + esc(M.info(tsId).ortText) + '</span></div></div>' +
      fld('MCC TSC', '<select id="mp-mcc">' + opt('', 'keine', !t.mccId) + mccs.map(function (m) { return opt(m.id, m.name + ' · ' + M.info(m.id).ortText, t.mccId === m.id); }).join('') + '</select>') +
      '<p class="muted small">Die MCC wechselt danach mit dem Tachymeter den Standort und erscheint nicht separat auf der Karte.</p>';
    M.modal({ title: 'MCC zuordnen', form: 'mccpick', body: b, foot: foot('Übernehmen') });
  };
  M.setMcc = function (tsId, mccId) {
    var t = M.copy(M.idx().ger[tsId]);
    var prev = t.mccId;
    t.mccId = mccId || null;
    var jobs = [M.put('geraete', t)];
    if (t.mccId && t.mccId !== prev) jobs.push(M.mccFollow(tsId, t.mccId));
    return Promise.all(jobs);
  };

  /* ================================================== DUPLIZIEREN */
  M.openDup = function (gid, n) {
    var g = M.idx().ger[gid], i = M.info(gid);
    n = n || 4;
    M.ctx = { kind: 'dup', gid: gid };
    var names = M.nextNames(g.name, n);
    var b = '<div class="dup-top">' + M.symbol(gid, 40) + '<div><b>' + esc(g.name) + '</b><span class="muted"> als Vorlage · ' + esc(i.kat ? i.kat.name : M.typLabel[g.typ]) + '</span></div></div>' +
      '<div class="stepper"><span>Wie viele gleiche Geräte?</span><button type="button" class="btn ghost sq" data-act="dup-step" data-d="-1" aria-label="weniger">−</button>' +
      '<input id="dup-n" type="number" min="1" max="50" value="' + n + '" data-input="dup-n" aria-label="Anzahl">' +
      '<button type="button" class="btn ghost sq" data-act="dup-step" data-d="1" aria-label="mehr">+</button></div>' +
      '<div class="dup-names" id="dup-names">' + names.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</div>' +
      '<div class="fld"><span class="lbl">Was übernehmen? Kategorie und Gerätetyp immer.</span><div class="dup-pick">';
    M.DUP_FELDER.forEach(function (f) {
      var key = f[0], def = f[2];
      if (key === 'gtyp' && !g.gtyp) return;
      if (key === 'sim' && !g.sim) return;
      if (key === 'seriennummer' && !g.seriennummer) return;
      if (key === 'wartung' && !g.letzteWartung && !M.has(g.wartungIntervall)) return;
      if (key === 'extra' && !(g.extra && Object.keys(g.extra).some(function (k) { return M.has(g.extra[k]); }))) return;
      if (key === 'bemerkung' && !g.bemerkung) return;
      if ((key === 'ort' || key === 'position') && !i.cur) return;
      if (key === 'position' && (i.isMag || i.posSrc !== 'eigen')) return;
      if (key === 'projekt' && !i.proj) return;
      if (key === 'ort') def = true;
      h(key, f[1], def);
    });
    function h(key, label, on) {
      var hint = '';
      if (key === 'ort') hint = ' · ' + esc(i.ortText);
      if (key === 'projekt' && i.proj) hint = ' · ' + esc(M.projName(i.proj));
      b += '<label class="chk' + ({ wert: 1, vor: 1, amort: 1 }[key] ? ' fin' : '') + '"><input type="checkbox" id="dup-f-' + key + '"' + (on ? ' checked' : '') + '> ' + esc(label) + '<span class="muted">' + hint + '</span></label>';
    }
    b += '</div></div><p class="muted small">Ohne «Gleiche Position» stehen die neuen Geräte im Feld mit «Position fehlt», bis sie vor Ort gesetzt sind.</p>';
    M.modal({ title: 'Duplizieren', form: 'dup', body: b, foot: foot(n + ' Geräte anlegen') });
  };
  M.dupPreview = function () {
    var n = Math.max(1, Math.min(50, parseInt(val('dup-n'), 10) || 1));
    var g = M.idx().ger[M.ctx.gid];
    $('dup-names').innerHTML = M.nextNames(g.name, n).map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('');
    var btn = document.querySelector('.md-ft button[type=submit]');
    if (btn) btn.textContent = n + ' Geräte anlegen';
  };
  M.submitDup = function () {
    var n = Math.max(1, Math.min(50, parseInt(val('dup-n'), 10) || 1));
    var f = {};
    M.DUP_FELDER.forEach(function (x) { var el = $('dup-f-' + x[0]); f[x[0]] = el ? el.checked : false; });
    M.duplicate(M.ctx.gid, n, f).then(function (names) {
      M.closeModal();
      M.toast(names.length + ' Geräte angelegt: ' + names[0] + (names.length > 1 ? ' … ' + names[names.length - 1] : ''));
      M.refreshUI();
    });
  };

  /* ================================================== VERSCHIEBEN */
  M.openMove = function (gids, onlyMag) {
    var I = M.idx();
    gids = gids.filter(function (id) { return !M.info(id).mccTs; });
    if (!gids.length) { M.toast('MCC im Einsatz wechseln den Standort mit ihrem Tachymeter.'); return; }
    M.ctx = { kind: 'move', gids: gids };
    var one = gids.length === 1 ? I.ger[gids[0]] : null;
    var info = one ? M.info(one.id) : null;
    var init = onlyMag ? { ort: 'magazin', magazinId: (M.magazine()[0] || {}).id } : (info && info.cur ? info.cur : { ort: 'feld' });
    var hasMcc = gids.some(function (id) { var g = I.ger[id]; return g && g.typ === 'tachymeter' && g.mccId; });
    var b = '';
    if (one) b += '<div class="mv-from">' + M.symbol(one.id, 32) + '<div><b>' + esc(one.name) + '</b><span>Bisher: ' + esc(info.ortText) + (info.proj ? ' · Projekt ' + esc(M.projName(info.proj)) : '') + (info.cur ? ' · seit ' + M.fmtDate(info.cur.von) : '') + '</span></div></div>';
    else b += '<p><b>' + gids.length + ' Geräte</b> verschieben. Jedes erhält seinen eigenen Eintrag in der Historie.</p>';
    var nTarget = 0;
    gids.forEach(function (id) { var ii = M.info(id); nTarget += ii.members ? ii.members.length : 1; });
    M.ctx.n = nTarget;
    var oneMs = one && M.info(one.id).members;
    var la = one ? M.lastAmort(oneMs ? (oneMs[0] || one.id) : one.id) : null;
    if (oneMs) b += '<p class="small">Die ' + oneMs.length + ' Geräte der Messstelle wechseln mit; jedes erhält seinen Eintrag in der Historie.</p>';
    b += locFields('mv', init, {
      later: !!one, n: nTarget,
      amort: one && !oneMs ? { modus: la.modus, betrag: la.betrag } : { modus: (la && la.modus) || 'monat', betrag: '', placeholder: 'leer = wie bisher je Gerät', scope: nTarget },
      mcc: one && one.typ === 'tachymeter' ? mccSelect('mv-mcc-sel', one.id, one.mccId) : ''
    });
    b += '<div class="grid2">' + fld('Datum', inp('mv-date', M.today(), 'type="date" data-change="mv-preview"')) + fld('Wer', inp('mv-wer', M.userKuerzel(), 'maxlength="40"')) + '</div>';
    if (hasMcc) b += '<label class="chk"><input type="checkbox" id="mv-mcc" checked> MCC beim Wechsel ins Magazin mitnehmen</label>';
    b += '<div class="mv-prev" id="mv-prev"></div><p class="form-err" id="mv-err" role="alert"></p>';
    M.modal({ title: onlyMag ? 'Ins Magazin' : 'Projekt ändern', form: 'move', wide: true, body: b, foot: foot('Speichern') });
    document.querySelectorAll('#mv-proj, #mv-magsel, #mv-e, #mv-n, #mv-amort, #mv-mcc-sel').forEach(function (el) { el.setAttribute('data-change', 'mv-preview'); });
    M.movePreview();
  };
  M.movePreview = function () {
    var I = M.idx(), c = M.ctx, d = val('mv-date') || M.today();
    var r = readLoc('mv');
    if (!r.t) { $('mv-prev').innerHTML = ''; return; }
    var t = r.t, lines = [];
    var ziel = t.ort === 'magazin' ? (I.proj[t.magazinId] || {}).name : (M.has(t.lat) ? 'Feld, LV95 ' + M.fmtLv95(t.lat, t.lng) : 'Feld, Position folgt');
    var proj = t.projektId ? I.proj[t.projektId] : null;
    var per = amortPer('mv', c.n), mod = val('mv-amodus') || 'monat';
    if ($('mv-ainfo')) $('mv-ainfo').textContent = per === null ? 'Leer lassen: jedes Gerät behält seinen bisherigen Ansatz.' :
      (val('mv-ascope') === 'total' ? 'CHF ' + M.chf(M.num(val('mv-amort'))) + ' ÷ ' + c.n + ' = CHF ' + M.chf(per) + ' je Gerät' : c.n + ' × CHF ' + M.chf(per) + ' = CHF ' + M.chf(per * c.n) + ' total') + (mod === 'monat' ? ' pro Monat' : ' pauschal');
    if (c.gids.length === 1 && M.info(c.gids[0]).members) {
      var gm = M.info(c.gids[0]);
      lines.push('✓ Neu: ' + ziel + (proj ? ' · Projekt ' + M.projName(proj) : ''));
      lines.push('✓ ' + gm.members.length + ' Geräte wechseln mit' + (t.ort === 'feld' && per !== null ? ' · CHF ' + M.chf(per) + (mod === 'monat' ? ' pro Monat' : ' pauschal') + ' je Gerät' : ''));
    } else if (c.gids.length === 1) {
      var g = I.ger[c.gids[0]], i = M.info(g.id);
      if (i.cur) lines.push('✓ Bisheriger Einsatz endet am ' + M.fmtDate(d) + ' (' + Math.max(0, M.days(i.cur.von, d)) + ' Tage)');
      lines.push('✓ Neu: ' + ziel + (proj ? ' · Projekt ' + M.projName(proj) : ''));
      if (t.ort === 'feld') lines.push('✓ ' + amortPreview(t, M.lastAmort(g.id)) + (proj ? ' (auf ' + M.projName(proj) + ')' : '') + ' · Restwert heute CHF ' + M.chf(i.restwert));
      if (g.typ === 'tachymeter' && g.mccId) lines.push(t.ort === 'magazin' ? '✓ MCC wird frei' : '✓ MCC wechselt mit');
      if (i.wart && i.wart.faellig && t.ort === 'feld') lines.push('<span class="warn-t">! Wartungszähler ' + i.wart.tage + ' / ' + i.wart.limit + ' – Wartung vorher prüfen</span>');
    } else {
      lines.push('✓ ' + c.gids.length + ' Einsätze enden am ' + M.fmtDate(d) + ', neu: ' + ziel + (proj ? ' · Projekt ' + M.projName(proj) : ''));
      if (t.ort === 'feld' && t.positionId) lines.push('✓ ' + posPreview(t));
      else if (t.ort === 'feld') lines.push('✓ ' + (per !== null ? 'CHF ' + M.chf(per) + (mod === 'monat' ? ' pro Monat' : ' pauschal') + ' je Gerät · total CHF ' + M.chf(per * c.n) : 'Amortisation wie am bisherigen Feld-Standort je Gerät'));
      if (t.ort === 'feld' && c.gids.some(function (id) { var g = I.ger[id]; return g.typ === 'tachymeter' && !g.mccId; })) lines.push('<span class="warn-t">! Tachymeter ohne MCC – danach einzeln zuordnen</span>');
      if (t.ort === 'feld' && M.has(t.lat)) lines.push('○ Alle erhalten dieselbe Position – einzeln korrigieren über «Position ändern»');
    }
    if (!M.can('fin')) lines = lines.filter(function (l) { return !/CHF|Amortisation|Restwert|Vorhalten/.test(l); });
    $('mv-prev').innerHTML = '<b>Das passiert beim Speichern</b>' + lines.map(function (l) { return '<span>' + l + '</span>'; }).join('');
  };
  M.submitMove = function () {
    var c = M.ctx, d = val('mv-date') || M.today(), wer = val('mv-wer');
    var r = readLoc('mv');
    if (r.err) { $('mv-err').textContent = r.err; return; }
    var mitMcc = $('mv-mcc') ? $('mv-mcc').checked : true;
    var pre = Promise.resolve();
    if ($('mv-mcc-sel') && r.t.ort === 'feld') {
      var mid = val('mv-mcc-sel');
      if (!mid) { $('mv-err').textContent = 'Ein Tachymeter im Feld braucht eine MCC TSC. Bitte wählen.'; return; }
      var ts = M.copy(M.idx().ger[c.gids[0]]);
      if (ts.mccId !== mid) { ts.mccId = mid; pre = M.put('geraete', ts); }
    }
    var per = r.t.positionId ? null : $('mv-ascope') ? amortPer('mv', c.n) : (M.has(r.t.amortBetrag) ? r.t.amortBetrag : null);
    var jobs = [pre.then(function () {
      return Promise.all(c.gids.map(function (id) {
        var isMs = !!M.info(id).members;
        var t = Object.assign({}, r.t, r.t.positionId ? {} : { amortBetrag: per });
        var ma = per === null ? null : function () { return { amortModus: r.t.amortModus, amortBetrag: per }; };
        return M.move(id, t, d, { wer: wer, mitMcc: mitMcc, memberAmort: isMs ? ma : null });
      }));
    })];
    var gids = c.gids, later = r.later;
    Promise.all(jobs).then(function () {
      M.closeModal();
      M.state.invSel = {};
      M.toast(gids.length === 1 ? 'Gespeichert' : gids.length + ' Geräte verschoben');
      M.refreshUI();
      if (later && gids.length === 1) M.startPlacing('geraet', gids[0]);
    });
  };

  /* ================================================== GERÄT PLATZIEREN (von der Karte aus) */
  M.openPlace = function (gid) {
    var I = M.idx();
    var list = M.state.data.geraete.filter(function (g) { var i = M.info(g.id); return g.zustand !== 'ausgemustert' && !i.mccTs; })
      .sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'de', { numeric: true }); });
    if (!list.length) { M.toast('Noch keine Geräte erfasst. Neue Geräte legt man unter «Inventar» an.'); return; }
    gid = gid || (list.find(function (g) { return M.info(g.id).isMag; }) || list[0]).id;
    var g = I.ger[gid], i = M.info(gid), la = M.lastAmort(gid);
    M.ctx = { kind: 'place', gid: gid };
    function group(label, arr) { return arr.length ? '<optgroup label="' + esc(label) + '">' + arr.map(function (x) { return opt(x.id, x.name + ' · ' + M.info(x.id).ortText, x.id === gid); }).join('') + '</optgroup>' : ''; }
    var mag = list.filter(function (x) { return M.info(x.id).isMag; }), feld = list.filter(function (x) { var ii = M.info(x.id); return ii.cur && !ii.isMag; }), ohne = list.filter(function (x) { return !M.info(x.id).cur; });
    var b = '<div class="mv-from">' + M.symbol(gid, 36) + '<div><b>' + esc(g.name) + '</b><span>Bisher: ' + esc(i.ortText) + (i.proj ? ' · Projekt ' + esc(M.projName(i.proj)) : '') + '</span></div></div>' +
      fld('Gerät', '<select id="pg-dev" data-change="pg-dev">' + group('Im Magazin', mag) + group('Im Feld', feld) + group('Ohne Standort', ohne) + '</select>') +
      '<div class="grid2">' + M.projSelHtml('pg', i.proj ? i.proj.id : '') +
      fld('Datum', inp('pg-date', M.today(), 'type="date" data-change="plan-in" data-p="pg"')) + '</div>' + M.newProjBox('pg') +
      '<div id="pg-posbox" class="posbox">' + M.posBoxHtml('pg', i.proj ? i.proj.id : '', i.cur || {}, 1) + '</div>' +
      fld('Auftragsnummer / Teilprojekt (optional)', '<input id="pg-auftrag" list="auftrag-list" maxlength="40" placeholder="z.B. 26160-03" value="' + esc(i.cur && i.cur.auftrag || '') + '">' + M.auftragList()) +
      M.planBoxHtml('pg', {}) +
      amortFields('pg', { modus: la.modus, betrag: la.betrag }) +
      (g.typ === 'tachymeter' ? mccSelect('pg-mcc', gid, g.mccId) : '') +
      fld('Wer', inp('pg-wer', M.userKuerzel(), 'maxlength="40"')) +
      '<p class="muted small">Nach «Weiter» den Ort in die Karte tippen, per GPS übernehmen, LV95 eingeben oder eine Adresse suchen. Neue Geräte erfasst man unter «Inventar».</p>' +
      '<p class="form-err" id="pg-err" role="alert"></p>';
    M.modal({ title: 'Gerät platzieren', form: 'place', body: b, foot: foot('Weiter: Ort wählen') });
    M.posSync('pg');
  };
  M.submitPlace = function () {
    var gid = M.ctx.gid, g = M.idx().ger[gid];
    var t = { ort: 'feld', projektId: val('pg-proj') || null, auftrag: val('pg-auftrag').trim(), amortModus: val('pg-amodus') || 'monat', amortBetrag: M.num(val('pg-amort')) || 0 };
    readPos('pg', t);
    readPlan('pg', t);
    var mcc = null;
    if (g.typ === 'tachymeter') {
      mcc = val('pg-mcc');
      if (!mcc) { $('pg-err').textContent = 'Ein Tachymeter im Feld braucht eine MCC TSC. Bitte wählen.'; return; }
    }
    var job = { kind: 'platz', id: gid, t: t, datum: val('pg-date') || M.today(), wer: val('pg-wer'), mcc: mcc };
    M.closeModal();
    M.startPlacing('platz', gid, job);
  };

  /* ================================================== MESSSTELLE */
  function msName(ids) {
    var I = M.idx(), names = ids.map(function (id) { return I.ger[id].name; });
    var pre = names.reduce(function (a, n) { var i = 0; while (i < a.length && a[i] === n[i]) i++; return a.slice(0, i); }, names[0] || '');
    pre = pre.replace(/[#\-_. ]+0*$/, '').trim();
    return pre.length >= 3 ? pre + ' (' + ids.length + ')' : 'Messstelle (' + ids.length + ')';
  }
  M.openMsNew = function (ids) {
    var I = M.idx(), ok = [], skip = [];
    ids.forEach(function (id) {
      var i = M.info(id);
      if (i.members) skip.push(i.g.name + ' (ist selbst eine Messstelle)');
      else if (i.mccTs) skip.push(i.g.name + ' (MCC beim Tachymeter)');
      else ok.push(id);
    });
    ok.sort(function (a, b) { return String(I.ger[a].name).localeCompare(String(I.ger[b].name), 'de', { numeric: true }); });
    if (ok.length < 1) { M.toast('Bitte Geräte auswählen, die zusammengefasst werden sollen.'); return; }
    var exist = M.state.data.geraete.filter(function (g) { return g.typ === 'messstelle'; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'de', { numeric: true }); });
    M.ctx = { kind: 'msnew', ids: ok };
    var ref = ok.map(function (id) { return M.info(id); }).find(function (i) { return i.cur && !i.isMag && M.has(i.cur.lat); }) || M.info(ok[0]);
    var b = '<p>' + ok.length + (ok.length === 1 ? ' Gerät' : ' Geräte') + ': <b>' + esc(ok.map(function (id) { return I.ger[id].name; }).join(', ')) + '</b></p>' +
      (skip.length ? '<p class="small muted">Nicht dabei: ' + esc(skip.join(', ')) + '</p>' : '') +
      '<label class="chk"><input type="radio" name="ms-mode" value="neu" checked data-change="ms-mode"> <span>Neue Messstelle</span></label>' +
      '<div id="ms-neu">' + fld('Name der Messstelle', inp('ms-name', msName(ok), 'maxlength="80"')) + fld('Bemerkung', inp('ms-bem', '', 'maxlength="200"')) +
      '<p class="muted small">Ort und Projekt übernimmt die Messstelle von ' + esc(ref.g.name) + (ref.cur ? ' (' + esc(ref.ortText) + ')' : '') + '. Alle Geräte stehen danach dort und erscheinen auf der Karte als ein Symbol mit Zahl.</p></div>' +
      (exist.length ? '<label class="chk"><input type="radio" name="ms-mode" value="add" data-change="ms-mode"> <span>Zu einer bestehenden Messstelle hinzufügen</span></label>' +
        '<div id="ms-add" hidden>' + fld('Messstelle', '<select id="ms-sel">' + exist.map(function (g) { return opt(g.id, g.name + ' · ' + M.info(g.id).ortText, false); }).join('') + '</select>') + '</div>' : '') +
      '<p class="muted small">Jedes Gerät bleibt einzeln im Inventar (Seriennummer, Wert, Historie, Wartung). Es wechselt aber künftig mit der Messstelle den Standort.</p><p class="form-err" id="ms-err" role="alert"></p>';
    M.modal({ title: 'Zu Messstelle zusammenfassen', form: 'msnew', body: b, foot: foot('Zusammenfassen') });
  };
  M.msMode = function () {
    var add = (document.querySelector('input[name=ms-mode]:checked') || {}).value === 'add';
    $('ms-neu').hidden = add; if ($('ms-add')) $('ms-add').hidden = !add;
  };
  M.submitMsNew = function () {
    var c = M.ctx, add = (document.querySelector('input[name=ms-mode]:checked') || {}).value === 'add';
    var job;
    if (add) { var mid = val('ms-sel'); job = M.addToGruppe(mid, c.ids).then(function () { return mid; }); }
    else {
      var name = val('ms-name').trim();
      if (!name) { $('ms-err').textContent = 'Bitte einen Namen eingeben.'; return; }
      job = M.createGruppe(name, c.ids, val('ms-bem'));
    }
    M.closeModal();
    job.then(function (mid) {
      M.state.invSel = {}; M.state.stack = null;
      M.toast(c.ids.length + ' Geräte in «' + M.idx().ger[mid].name + '»');
      M.refreshUI();
      if (M.state.view === 'karte') { M.select(mid); M.mapFocus(mid); } else M.openDrawer(mid);
    });
  };
  M.openMsAdd = function (msId) {
    var I = M.idx(), ms = I.ger[msId], mi = M.info(msId);
    var cand = M.state.data.geraete.filter(function (g) { var i = M.info(g.id); return g.typ !== 'messstelle' && g.gruppeId !== msId && !i.mccTs && g.zustand !== 'ausgemustert'; });
    var near = function (g) { var i = M.info(g.id); return (mi.proj && i.proj && i.proj.id === mi.proj.id) ? 0 : (mi.pos && i.pos && M.dist([mi.pos.lat, mi.pos.lng], [i.pos.lat, i.pos.lng]) < 500 ? 1 : 2); };
    cand.sort(function (a, b) { return near(a) - near(b) || String(a.name).localeCompare(String(b.name), 'de', { numeric: true }); });
    M.ctx = { kind: 'msadd', id: msId };
    var b = '<p class="muted small">Geräte im gleichen Projekt oder in der Nähe stehen oben. Hinzugefügte Geräte werden an den Ort der Messstelle gesetzt.</p>' +
      '<input id="msa-q" placeholder="Suchen …" data-input="msa-q" aria-label="Geräte suchen" class="msa-q"><div class="msa-list">' +
      cand.map(function (g) { var i = M.info(g.id); return '<label class="msa-row" data-name="' + esc((g.name + ' ' + (i.kat ? i.kat.name : '')).toLowerCase()) + '"><input type="checkbox" value="' + g.id + '"> ' + M.symbol(g.id, 20) + '<span><b>' + esc(g.name) + '</b> <span class="muted">' + esc((i.kat ? i.kat.name : M.typLabel[g.typ]) + ' · ' + (i.ms ? 'in ' + i.ms.name : i.ortText)) + '</span></span></label>'; }).join('') +
      '</div><p class="form-err" id="msa-err" role="alert"></p>';
    M.modal({ title: 'Geräte zu «' + ms.name + '» hinzufügen', form: 'msadd', body: b, foot: foot('Hinzufügen'), wide: true });
  };
  M.submitMsAdd = function () {
    var ids = Array.prototype.map.call(document.querySelectorAll('.msa-list input:checked'), function (x) { return x.value; });
    if (!ids.length) { $('msa-err').textContent = 'Bitte mindestens ein Gerät ankreuzen.'; return; }
    var mid = M.ctx.id;
    M.closeModal();
    M.addToGruppe(mid, ids).then(function () { M.toast(ids.length + ' Geräte hinzugefügt'); M.refreshUI(); });
  };
  M.openGruppeEdit = function (msId) {
    var g = M.idx().ger[msId];
    M.ctx = { kind: 'msedit', id: msId };
    M.modal({ title: 'Messstelle bearbeiten', form: 'msedit', body: fld('Name', inp('mse-name', g.name, 'maxlength="80"')) + fld('Bemerkung', '<textarea id="mse-bem" rows="3">' + esc(g.bemerkung || '') + '</textarea>') + '<p class="form-err" id="mse-err" role="alert"></p>', foot: foot('Speichern') });
  };
  M.submitGruppeEdit = function () {
    var g = M.copy(M.idx().ger[M.ctx.id]);
    g.name = val('mse-name').trim(); g.bemerkung = $('mse-bem').value;
    if (!g.name) { $('mse-err').textContent = 'Bitte einen Namen eingeben.'; return; }
    M.closeModal();
    M.put('geraete', g).then(function () { M.toast('Gespeichert'); M.refreshUI(); });
  };

  /* ================================================== OFFERTPOSITION */
  M.openPosition = function (pid, projektId) {
    var I = M.idx(), P = pid ? I.pos[pid] : null;
    projektId = P ? P.projektId : projektId;
    var proj = I.proj[projektId];
    if (!proj) return;
    var ps = I.posByProj[projektId] || [];
    var d = P ? M.copy(P) : { projektId: projektId, nr: nextNr(ps), text: '', gruppe: 'erf', art: 'set', V: '', B: '', W: '', bemerkung: '' };
    M.ctx = { kind: 'position', pid: pid || null, projektId: projektId };
    // Geräte, die jetzt im Projekt im Feld stehen
    var cand = M.state.data.einsaetze.filter(function (e) { var g = I.ger[e.geraetId]; return e.projektId === projektId && !e.bis && e.ort === 'feld' && g && g.typ !== 'messstelle' && g.typ !== 'mcc'; })
      .map(function (e) { return { e: e, g: I.ger[e.geraetId] }; })
      .sort(function (a, b) { var ia = a.e.positionId === pid ? 0 : 1, ib = b.e.positionId === pid ? 0 : 1; return ia - ib || String(a.g.name).localeCompare(String(b.g.name), 'de', { numeric: true }); });
    var units = P ? M.posUnits(P.id).list.filter(function (u) { return u.aktiv; }) : [];
    var b = '<div class="grid-pos">' + fld('Pos.', inp('po-nr', d.nr, 'maxlength="12" class="mono"')) + fld('Bezeichnung wie in der Offerte', inp('po-text', d.text, 'maxlength="120" placeholder="z.B. Funk-Messsystem Gateway + 5 Nodes"')) + '</div>' +
      '<div class="row-wrap"><div class="fld"><span>Gruppe</span><div class="seg" role="group" aria-label="Gruppe">' + M.ABR_ORDER.map(function (g) {
        return '<button type="button" data-act="po-grp" data-k="' + g + '" class="' + (d.gruppe === g ? 'on' : '') + '" aria-pressed="' + (d.gruppe === g) + '">' + esc(M.ABR_GRUPPEN[g].n) + '</button>'; }).join('') + '</div><input type="hidden" id="po-gruppe" value="' + esc(d.gruppe || 'sen') + '"></div>' +
      '<div class="fld"><span>Preisart</span><div class="seg" role="group" aria-label="Preisart"><button type="button" data-act="po-art" data-k="set" class="' + (d.art === 'set' ? 'on' : '') + '" aria-pressed="' + (d.art === 'set') + '">Set-Preis · mehrere Geräte zusammen</button>' +
      '<button type="button" data-act="po-art" data-k="stk" class="' + (d.art !== 'set' ? 'on' : '') + '" aria-pressed="' + (d.art !== 'set') + '">Stückpreis · je Gerät</button></div><input type="hidden" id="po-art" value="' + (d.art === 'set' ? 'set' : 'stk') + '"></div></div>' +
      '<div class="po-preis"><span class="lbl" id="po-preislbl">Preis pro ' + (d.art === 'set' ? 'Set' : 'Gerät') + ' und Monat (Offerte)</span><div class="grid3">' +
      fld('Vorhalten CHF', inp('po-V', d.V, 'inputmode="decimal" class="r"')) + fld('Betrieb CHF', inp('po-B', d.B, 'inputmode="decimal" class="r"')) + fld('Wartung CHF', inp('po-W', d.W, 'inputmode="decimal" class="r"')) + '</div>' +
      '<div class="grid3">' + fld('Offeriert: Monate total', inp('po-offMonate', d.offMonate, 'inputmode="numeric" class="r" placeholder="optional"')) + '</div>' +
      '<p class="muted small">Vorhalten fliesst voll in die Amortisation der Geräte (im Set nach Anschaffungswert verteilt). Betrieb und Wartung laufen pro ' + (d.art === 'set' ? 'Set' : 'Gerät') + '.</p></div>';
    // Geräte zuweisen
    b += '<fieldset class="extra"><legend>Geräte im Projekt</legend>';
    if (!cand.length) b += '<p class="muted small">Zurzeit steht kein Gerät im Projekt. Geräte lassen sich auch beim Platzieren oder mit «Projekt ändern» einer Position zuordnen.</p>';
    else {
      b += '<p class="muted small">Angekreuzt = gehört zu dieser Position (gilt ab Beginn des laufenden Einsatzes). MCC TSC gehen mit ihrem Tachymeter.</p>' +
        '<div class="po-set" id="po-setbox"' + (d.art === 'set' ? '' : ' hidden') + '>' + fld('Neu angekreuzte Geräte kommen in', '<select id="po-einheit">' + opt('neu', 'ein neues Set', true) + units.map(function (u) { return opt(u.key.slice(2), M.unitLabel(P, u), false); }).join('') + '</select>') + '</div>' +
        '<div class="po-devs">' + cand.map(function (c) {
          var inPos = c.e.positionId === pid && pid, other = c.e.positionId && c.e.positionId !== pid && I.pos[c.e.positionId];
          var u = inPos ? M.unitOf(c.e) : null;
          return '<label class="chk po-dev"><input type="checkbox" data-change="po-dev" value="' + c.g.id + '"' + (inPos ? ' checked' : '') + ' data-wert="' + (M.num(c.g.wert) || 0) + '"> ' + M.symbol(c.g.id, 20) + '<b>' + esc(c.g.name) + '</b>' +
            '<span class="muted small">' + (inPos ? (P.art === 'set' && u ? 'Set ' + u.nr : 'in dieser Position') : other ? 'jetzt Pos. ' + esc(other.nr || '?') : 'ohne Position') + (c.g.mccId && I.ger[c.g.mccId] ? ' · mit ' + esc(I.ger[c.g.mccId].name) : '') + '</span></label>';
        }).join('') + '</div>';
    }
    b += '</fieldset>' + fld('Bemerkung', '<textarea id="po-bem" rows="2">' + esc(d.bemerkung || '') + '</textarea>') + '<p class="form-err" id="po-err" role="alert"></p>';
    M.modal({ title: (P ? 'Position ' + (P.nr || '') : 'Neue Position') + ' · ' + M.projName(proj), form: 'position', wide: true, body: b, noFocus: !!P,
      foot: (P ? '<button type="button" class="btn ghost danger-t" data-act="pos-del" data-id="' + P.id + '">Position löschen</button>' : '') + '<span class="grow"></span><button type="button" class="btn ghost" data-act="modal-close">Abbrechen</button><button type="submit" class="btn">Speichern</button>' });
    M.posRicht();
  };
  function nextNr(ps) {
    var last = ps.map(function (x) { return x.nr || ''; }).sort(function (a, b) { return a.localeCompare(b, 'de', { numeric: true }); }).pop();
    if (!last) return '1.1';
    var m = String(last).match(/^(.*?)(\d+)$/);
    return m ? m[1] + (+m[2] + 1) : last + '.1';
  }
  /* Richtwert Vorhalten: Anschaffungswert ÷ 36 Monate (Set: Summe, Stück: Durchschnitt) */
  M.posRicht = function () { /* Richtwert entfällt */ };
  M.submitPosition = function () {
    var c = M.ctx, I = M.idx();
    var d = c.pid ? M.copy(I.pos[c.pid]) : { id: M.uid('pos'), projektId: c.projektId };
    d.nr = val('po-nr'); d.text = val('po-text'); delete d.auftrag; delete d.Wp; delete d.kB; delete d.kW; d.gruppe = val('po-gruppe') || 'sen'; d.art = val('po-art') === 'set' ? 'set' : 'stk';
    ['V', 'B', 'W', 'offMonate'].forEach(function (k) { d[k] = M.num(val('po-' + k)); if (d[k] === null) d[k] = ''; });
    d.bemerkung = $('po-bem').value.trim();
    if (!d.text) { $('po-err').textContent = 'Bitte die Bezeichnung eingeben.'; return; }
    if (!M.has(d.V) || d.V === '') { $('po-err').textContent = 'Bitte den Preis für Vorhalten eingeben (0 ist möglich).'; return; }
    var boxes = Array.prototype.slice.call(document.querySelectorAll('[data-change=po-dev]'));
    var add = [], rem = [];
    boxes.forEach(function (x) {
      var id = x.value, cur = (I.ein[id] || []).find(function (e) { return !e.bis; });
      var inPos = cur && cur.positionId === d.id;
      if (x.checked && !inPos) add.push(id); else if (!x.checked && inPos) rem.push(id);
    });
    var einh = $('po-einheit') ? val('po-einheit') : 'neu';
    var key = d.art === 'set' ? (einh === 'neu' ? M.uid('set') : einh) : null;
    var artWechsel = c.pid && I.pos[c.pid].art !== d.art;
    M.put('positionen', d).then(function () {
      var jobs = [M.setPosition(rem, null)];
      if (add.length) jobs.push(M.setPosition(add, d.id, key));
      // Preisart gewechselt: alle laufenden Geräte neu einteilen
      if (artWechsel) {
        var all = M.state.data.einsaetze.filter(function (e) { return e.positionId === d.id && !e.bis && I.ger[e.geraetId] && I.ger[e.geraetId].typ !== 'mcc'; }).map(function (e) { return e.geraetId; });
        jobs.push(M.setPosition(all, d.id, d.art === 'set' ? M.uid('set') : null));
      }
      return Promise.all(jobs);
    }).then(function () {
      M.closeModal();
      M.toast('Position ' + (d.nr || '') + ' gespeichert' + (add.length ? ' · ' + add.length + ' Geräte zugewiesen' : '') + (rem.length ? ' · ' + rem.length + ' entfernt' : ''));
      M.refreshUI();
    });
  };

  /* ================================================== LAUFZEIT (ein oder mehrere Geräte, laufender Einsatz) */
  M.openLaufzeit = function (ids) {
    var all = [];
    ids.forEach(function (id) { var i = M.info(id); if (all.indexOf(id) < 0) all.push(id); if (i.members) i.members.forEach(function (m) { if (all.indexOf(m) < 0) all.push(m); }); });
    var feld = all.filter(function (id) { var i = M.info(id); return i.cur && !i.isMag && !i.mccTs; });
    if (!feld.length) { M.toast('Keines der Geräte steht im Feld. Die Laufzeit gilt für einen Einsatz im Feld.'); return; }
    var one = feld.length === 1 ? M.info(feld[0]).cur : null;
    M.ctx = { kind: 'laufzeit', ids: feld, planVon: one ? one.von : null };
    var b = '<p>' + (feld.length === 1 ? esc(M.idx().ger[feld[0]].name) + ' · im Einsatz seit ' + M.fmtDate(one.von) : feld.length + ' Geräte im Feld') + (all.length > feld.length ? ' (' + (all.length - feld.length) + ' im Magazin oder ohne Standort ausgelassen)' : '') + '.</p>' +
      M.planBoxHtml('lz', one ? { planBis: one.planBis, planMonate: one.planMonate } : {}) +
      '<p class="muted small">Gilt für den laufenden Einsatz. Monate zählen ab dem Montagedatum jedes Geräts' + (feld.length > 1 ? ' (bei mehreren Geräten kann das Enddatum deshalb verschieden sein)' : '') + '. Ein Tachymeter nimmt seine MCC mit. Leer lassen und speichern entfernt die Planung.</p>';
    M.modal({ title: 'Geplante Laufzeit', form: 'laufzeit', body: b, foot: foot('Speichern') });
    $('lz-planbox').setAttribute('data-had', '1');
    M.planInfoUpdate('lz');
  };
  M.submitLaufzeit = function () {
    var t = {}; readPlan('lz', t);
    var ids = M.ctx.ids;
    M.closeModal();
    M.setPlan(ids, t).then(function () { M.state.invSel = {}; M.toast(t.planMonate ? 'Laufzeit ' + t.planMonate + ' Monate · ' + ids.length + (ids.length === 1 ? ' Gerät' : ' Geräte') : t.planBis ? 'Geplant bis ' + M.fmtDate(t.planBis) + ' · ' + ids.length + (ids.length === 1 ? ' Gerät' : ' Geräte') : 'Planung entfernt'); M.refreshUI(); });
  };

  /* ================================================== AUFTRAGSNUMMER (mehrere) */
  M.auftragList = function () {
    var o = {};
    M.state.data.einsaetze.forEach(function (e) { if (e.auftrag) o[e.auftrag] = 1; });
    return '<datalist id="auftrag-list">' + Object.keys(o).sort().map(function (a) { return '<option value="' + esc(a) + '">'; }).join('') + '</datalist>';
  };
  M.openAuftrag = function (ids) {
    var I = M.idx(), all = [];
    ids.forEach(function (id) { var i = M.info(id); all.push(id); if (i.members) i.members.forEach(function (m) { if (all.indexOf(m) < 0) all.push(m); }); });
    var feld = all.filter(function (id) { var i = M.info(id); return i.cur && !i.isMag; });
    if (!feld.length) { M.toast('Keines der Geräte steht im Feld. Die Auftragsnummer gilt für einen Einsatz im Feld.'); return; }
    var cur = {}; feld.forEach(function (id) { var a = M.info(id).cur.auftrag || ''; cur[a] = (cur[a] || 0) + 1; });
    var vals = Object.keys(cur);
    M.ctx = { kind: 'auftrag', ids: feld };
    var b = '<p>' + feld.length + (feld.length === 1 ? ' Gerät' : ' Geräte') + ' im Feld' + (all.length > feld.length ? ' (' + (all.length - feld.length) + ' im Magazin oder ohne Standort ausgelassen)' : '') + '.</p>' +
      fld('Auftragsnummer / Teilprojekt', '<input id="au-nr" list="auftrag-list" maxlength="40" placeholder="z.B. 26160-03" value="' + esc(vals.length === 1 ? vals[0] : '') + '">' + M.auftragList()) +
      (vals.length > 1 ? '<p class="muted small">Zurzeit verschieden: ' + esc(vals.map(function (v) { return (v || 'ohne') + ' (' + cur[v] + ')'; }).join(', ')) + '</p>' : '') +
      '<p class="muted small">Gilt für den laufenden Einsatz – es entsteht kein neuer Eintrag in der Historie. Leer lassen entfernt die Nummer.</p>';
    M.modal({ title: 'Auftragsnummer setzen', form: 'auftrag', body: b, foot: foot('Speichern') });
  };
  M.submitAuftrag = function () {
    var nr = val('au-nr').trim(), ids = M.ctx.ids;
    M.closeModal();
    M.setAuftrag(ids, nr).then(function () { M.state.invSel = {}; M.toast((nr ? 'Auftrag ' + nr : 'Auftragsnummer entfernt') + ' · ' + ids.length + ' Geräte'); M.refreshUI(); });
  };

  /* ================================================== POSITION ÄNDERN (mehrere) */
  M.openBulkPos = function (ids) {
    var ok = [], skip = [];
    ids.forEach(function (id) {
      var i = M.info(id);
      if (i.cur && !i.isMag && !i.mccTs) ok.push(id); else skip.push(i.g.name + (i.mccTs ? ' (MCC beim Tachymeter)' : i.isMag ? ' (im Magazin)' : ' (ohne Standort)'));
    });
    var I = M.idx();
    ok.sort(function (a, b) { return String(I.ger[a].name).localeCompare(String(I.ger[b].name), 'de', { numeric: true }); });
    if (!ok.length) { M.toast('Keines der gewählten Geräte steht im Feld. Zuerst mit «Projekt ändern» ins Feld setzen.'); return; }
    M.ctx = { kind: 'bulkpos', ids: ok };
    var b = '<p>' + ok.length + (ok.length === 1 ? ' Gerät' : ' Geräte') + ': <b>' + esc(ok.map(function (id) { return I.ger[id].name; }).join(', ')) + '</b></p>' +
      (skip.length ? '<p class="small muted">Nicht dabei, weil nicht im Feld: ' + esc(skip.join(', ')) + '. Diese zuerst mit «Projekt ändern» ins Feld setzen.</p>' : '') +
      '<div class="fld"><span class="lbl">Wie setzen?</span>' +
      '<label class="chk"><input type="radio" name="bp-mode" value="einzeln" checked> <span><b>Nacheinander</b> – jedes Gerät einzeln in die Karte tippen (per GPS, LV95 oder Adresse geht auch). «Überspringen» lässt ein Gerät aus.</span></label>' +
      '<label class="chk"><input type="radio" name="bp-mode" value="gleich"> <span><b>Alle an dieselbe Position</b> – z.B. mehrere Sensoren im gleichen Bohrloch oder Schacht.</span></label></div>' +
      '<p class="muted small">Standort, Projekt und Amortisation bleiben gleich, es ändert nur die genaue Position.</p>';
    M.modal({ title: 'Position ändern', form: 'bulkpos', body: b, foot: foot('Weiter: auf der Karte setzen'), noFocus: true });
  };
  M.submitBulkPos = function () {
    var ids = M.ctx.ids, same = (document.querySelector('input[name=bp-mode]:checked') || {}).value === 'gleich';
    M.closeModal();
    var q = { queue: true, ids: ids, i: 0, same: same, done: 0 };
    M.startPlacing('geraet', ids[0], q);
  };

  /* ================================================== ZUSTAND (mehrere) */
  M.openZustand = function (gids) {
    M.ctx = { kind: 'zst', gids: gids };
    M.modal({ title: 'Zustand ändern', form: 'zst', body: '<p>' + gids.length + ' Geräte</p>' + fld('Neuer Zustand', '<select id="z-zst">' + opt('aktiv', 'in Betrieb') + opt('defekt', 'defekt') + opt('ausgemustert', 'ausgemustert') + '</select>'), foot: foot('Übernehmen') });
  };
  M.submitZustand = function () {
    var z = val('z-zst'), I = M.idx();
    Promise.all(M.ctx.gids.map(function (id) { var g = M.copy(I.ger[id]); g.zustand = z; return M.put('geraete', g); })).then(function () {
      M.closeModal(); M.state.invSel = {}; M.toast('Zustand geändert'); M.refreshUI();
    });
  };

  /* ================================================== WARTUNG */
  M.openWartung = function (gid, wid) {
    var I = M.idx(), w = wid ? M.state.data.wartungen.find(function (x) { return x.id === wid; }) : null;
    gid = gid || (w && w.geraetId);
    var g = I.ger[gid];
    M.ctx = { kind: 'wartung', gid: gid, wid: wid };
    var arten = ['Service', 'Kalibrierung', 'Reparatur', 'Kontrolle'];
    var b = '<div class="mv-from">' + M.symbol(gid, 32) + '<div><b>' + esc(g.name) + '</b><span>' + esc(g.gtyp || M.typLabel[g.typ]) + '</span></div></div><div class="grid2">' +
      fld('Datum', inp('w-date', w ? w.datum : M.today(), 'type="date" required')) +
      fld('Art', '<select id="w-art">' + arten.map(function (a) { return opt(a, a, w ? w.art === a : a === 'Service'); }).join('') + '</select>') +
      fld('Firma', inp('w-firma', w ? w.firma : (g.hersteller || ''), 'maxlength="60"')) +
      finFld('Kosten CHF', inp('w-kosten', w ? w.kosten : '', 'inputmode="decimal" class="r"')) + '</div>' +
      fld('Bemerkung', '<textarea id="w-bem" rows="2">' + esc(w ? w.bemerkung || '' : '') + '</textarea>', 'full') +
      '<p class="muted small">Eine Wartung setzt den Zähler «In Betrieb seit letzter Wartung» auf 0.</p>';
    M.modal({ title: wid ? 'Wartung bearbeiten' : 'Wartung erfassen', form: 'wartung', body: b, foot: foot('Speichern', wid ? '<button type="button" class="btn ghost danger-t" data-act="w-del">Löschen</button>' : '') });
  };
  M.submitWartung = function () {
    var c = M.ctx, d = val('w-date');
    if (!d) return;
    var rec = { id: c.wid || M.uid('wrt'), geraetId: c.gid, datum: d, art: val('w-art'), firma: val('w-firma'), kosten: M.num(val('w-kosten')), bemerkung: $('w-bem').value.trim() };
    M.put('wartungen', rec).then(function () { M.closeModal(); M.toast('Wartung gespeichert'); M.refreshUI(); });
  };

  /* ================================================== EINSATZ */
  M.openEinsatz = function (eid) {
    var e = M.state.data.einsaetze.find(function (x) { return x.id === eid; });
    if (!e) return;
    var g = M.idx().ger[e.geraetId];
    M.ctx = { kind: 'einsatz', eid: eid };
    var b = '<div class="mv-from">' + M.symbol(g.id, 32) + '<div><b>' + esc(g.name) + '</b><span>Einsatz korrigieren</span></div></div>' +
      locFields('el', e, { later: false, amort: { edit: true, modus: e.amortModus, betrag: e.amortBetrag } }) + '<div class="grid2">' +
      fld('Von', inp('e-von', e.von, 'type="date" required data-change="plan-in" data-p="el"')) +
      fld('Bis (leer = laufend)', inp('e-bis', e.bis, 'type="date"')) +
      fld('Ortsbezeichnung', inp('e-ortname', e.ortName, 'maxlength="80" placeholder="wird aus der Position ermittelt"')) +
      fld('Gesetzt von', inp('e-ges', e.gesetztVon, 'maxlength="40"')) +
      fld('Geholt von', inp('e-geh', e.geholtVon, 'maxlength="40"')) + '</div>' +
      fld('Bemerkung', '<textarea id="e-bem" rows="2">' + esc(e.bemerkung || '') + '</textarea>', 'full') +
      '<p class="form-err" id="e-err" role="alert"></p>';
    M.modal({ title: 'Einsatz bearbeiten', form: 'einsatz', wide: true, body: b, foot: foot('Speichern', '<button type="button" class="btn ghost danger-t" data-act="e-del">Löschen</button>') });
  };
  M.submitEinsatz = function () {
    var e = M.copy(M.state.data.einsaetze.find(function (x) { return x.id === M.ctx.eid; }));
    var r = readLoc('el');
    if (r.err) { $('e-err').textContent = r.err; return; }
    var moved = r.t.lat !== e.lat || r.t.lng !== e.lng;
    Object.assign(e, { ort: r.t.ort, magazinId: r.t.magazinId || null, projektId: r.t.projektId || null, lat: M.has(r.t.lat) ? r.t.lat : null, lng: M.has(r.t.lng) ? r.t.lng : null, auftrag: r.t.ort === 'feld' ? (r.t.auftrag || '') : '' });
    if (r.t.ort === 'feld') {
      if (r.t.planMonate) { e.planMonate = r.t.planMonate; e.planBis = M.addMonths(val('e-von') || e.von, r.t.planMonate); }
      else if (r.t.planBis !== undefined) { e.planBis = r.t.planBis || null; e.planMonate = null; }
    } else { e.planBis = null; e.planMonate = null; }
    if (r.t.ort === 'feld' && r.t.positionId) { e.positionId = r.t.positionId; e.einheit = r.t.einheit || null; e.amortModus = 'position'; e.amortBetrag = 0; }
    else if (r.t.ort === 'feld') { e.positionId = null; e.einheit = null; e.amortModus = r.t.amortModus === 'position' ? 'monat' : (r.t.amortModus || 'monat'); e.amortBetrag = M.num(r.t.amortBetrag) || 0; }
    else { e.positionId = null; e.einheit = null; e.amortModus = 'pauschal'; e.amortBetrag = 0; }
    delete e.amortGebucht;
    e.von = val('e-von'); e.bis = val('e-bis') || null;
    e.gesetztVon = val('e-ges'); e.geholtVon = val('e-geh');
    e.ortName = e.ort === 'feld' ? val('e-ortname') : '';
    if (moved && e.ort === 'feld' && e.ortName === (M.state.data.einsaetze.find(function (x) { return x.id === e.id; }).ortName || '')) e.ortName = '';
    e.bemerkung = $('e-bem').value.trim();
    if (!e.von) { $('e-err').textContent = 'Bitte ein Startdatum eingeben.'; return; }
    if (e.bis && e.bis < e.von) { $('e-err').textContent = '«Bis» liegt vor «Von».'; return; }
    if (!e.bis && M.state.data.einsaetze.some(function (x) { return x.geraetId === e.geraetId && !x.bis && x.id !== e.id; })) {
      $('e-err').textContent = 'Das Gerät hat schon einen laufenden Einsatz. Bitte ein «Bis»-Datum setzen.'; return;
    }
    M.put('einsaetze', e).then(function () {
      if (e.ort === 'feld' && M.has(e.lat) && !e.ortName) M.fillOrtName(e.id);
      M.closeModal(); M.toast('Einsatz gespeichert'); M.refreshUI();
    });
  };

  /* ================================================== KABEL */
  M.openKabel = function (kid, draft) {
    var I = M.idx();
    var k = kid ? M.copy(I.kab[kid]) : Object.assign({ name: '', typ: 'strom', datum: M.today(), punkte: [], reserve: null, bemerkung: '' }, draft || {});
    M.ctx = { kind: 'kabel', kid: kid, k: k };
    var devs = M.state.data.geraete.filter(function (g) { var i = M.info(g.id); return i.pos && !i.mccTs && g.zustand !== 'ausgemustert'; })
      .sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'de', { numeric: true }); });
    function devSel(id, sel) { return '<select id="' + id + '">' + opt('', '– kein Gerät –', !sel) + devs.map(function (g) { return opt(g.id, g.name + ' · ' + M.info(g.id).ortText, g.id === sel); }).join('') + '</select>'; }
    var len = M.lineLen(k.punkte);
    var b = '<div class="kab-len"><span class="kab-big" style="--c:' + (M.kabelTypen[k.typ] || M.kabelTypen.andere).color + '" aria-hidden="true"></span><div><b>' + M.fmtLen(len) + '</b><span class="muted"> Länge auf der Karte · ' + k.punkte.length + ' Punkte</span></div></div>' +
      '<div class="grid2">' + fld('Bezeichnung', inp('k2-name', k.name, 'maxlength="60" placeholder="z.B. Signalkabel IN-03"')) +
      fld('Art', '<select id="k2-typ">' + Object.keys(M.kabelTypen).map(function (t) { return opt(t, M.kabelTypen[t].name, k.typ === t); }).join('') + '</select>') +
      fld('Führt zu', devSel('k2-zu', k.zuId)) + fld('Von', devSel('k2-von', k.vonId)) +
      fld('Projekt (optional)', '<select id="k2-proj">' + M.projOptions(k.projektId || '', true, '– kein Projekt –') + '</select>') +
      fld('Verlegt am', inp('k2-datum', k.datum, 'type="date"')) +
      fld('Reserve / Zuschlag m', inp('k2-res', k.reserve, 'inputmode="decimal" class="r" placeholder="z.B. 10"')) + '</div>' +
      fld('Bemerkung', '<textarea id="k2-bem" rows="2">' + esc(k.bemerkung || '') + '</textarea>', 'full');
    var extra = kid ? '<button type="button" class="btn ghost danger-t" data-act="kabel-del" data-id="' + kid + '">Löschen</button><button type="button" class="btn ghost" data-act="kabel-redraw" data-id="' + kid + '">Neu zeichnen</button>' : '';
    M.modal({ title: kid ? 'Kabel bearbeiten' : 'Neues Kabel', form: 'kabel', wide: true, body: b, foot: foot('Speichern', extra) });
  };
  M.submitKabel = function () {
    var c = M.ctx, k = c.k;
    if (!c.kid) k.id = M.uid('kab');
    k.name = val('k2-name'); k.typ = val('k2-typ'); k.zuId = val('k2-zu') || null; k.vonId = val('k2-von') || null;
    k.projektId = val('k2-proj') || null; k.datum = val('k2-datum'); k.reserve = M.num(val('k2-res')); k.bemerkung = $('k2-bem').value.trim();
    if (!k.name) {
      var I = M.idx(), z = k.zuId && I.ger[k.zuId];
      k.name = M.kabelTypen[k.typ].name + (z ? ' ' + z.name : '');
    }
    M.put('kabel', k).then(function () {
      M.closeModal(); M.toast('Kabel gespeichert · ' + M.fmtLen(M.lineLen(k.punkte)));
      M.state.selKabel = k.id; M.state.sel = null;
      M.refreshUI();
    });
  };

  /* ================================================== KATEGORIE */
  M.openKategorie = function (kid, back) {
    var k = kid ? M.copy(M.idx().kat[kid]) : { name: '', kuerzel: '', gruppe: 'bau', piktogramm: 'RM', typ: 'sensor', felder: [] };
    M.ctx = { kind: 'kat', kid: kid, k: k, back: back || null };
    renderKat();
  };
  function renderKat() {
    var c = M.ctx, k = c.k;
    var used = M.state.data.geraete.filter(function (g) { return g.kategorieId === c.kid; }).length;
    var b = '<div class="kat-top"><div class="kat-prev">' + S.symbolHtml(k.gruppe, k.piktogramm, { size: 54, kuerzel: k.kuerzel || '?' }) + '</div>' +
      '<div class="grid2 grow">' + fld('Name', inp('k-name', k.name, 'required maxlength="50" placeholder="z.B. Fissurometer"')) +
      fld('Kürzel', inp('k-kz', k.kuerzel, 'maxlength="3" class="mono" placeholder="FI" data-input="k-sync"')) + '</div></div>';
    b += '<div class="fld"><span class="lbl">1 · Gruppe – bringt Form und Farbe</span><div class="grp-pick">';
    S.GRUPPEN_ORDER.forEach(function (gk) {
      var g = S.GRUPPEN[gk];
      b += '<button type="button" class="' + (k.gruppe === gk ? 'on' : '') + '" data-act="k-grp" data-k="' + gk + '" aria-pressed="' + (k.gruppe === gk) + '">' +
        S.symbolHtml(gk, M.GRP_PIK[gk], { size: 22 }) + '<span>' + esc(g.name) + '</span></button>';
    });
    b += '</div></div><div class="fld"><span class="lbl">2 · Piktogramm</span><div class="pik-pick">';
    Object.keys(S.PIKTOGRAMME).forEach(function (pk) {
      b += '<button type="button" class="' + (k.piktogramm === pk ? 'on' : '') + '" data-act="k-pik" data-k="' + pk + '" title="' + esc(S.PIKTOGRAMME[pk].name) + '" aria-label="' + esc(S.PIKTOGRAMME[pk].name) + '">' + S.pictoSvg(pk, 22, '#00152A', 1.9) + '</button>';
    });
    b += '<button type="button" class="' + (!k.piktogramm ? 'on' : '') + '" data-act="k-pik" data-k="" title="Nur Kürzel" aria-label="Nur Kürzel"><span class="mono small">Aa</span></button></div></div>';
    b += '<div class="fld"><span class="lbl">3 · Zusatzfelder (optional)</span><div id="k-felder">';
    (k.felder || []).forEach(function (f, n) {
      b += '<div class="row-in kf"><input id="k-f-' + n + '" value="' + esc(f.name) + '" placeholder="Feldname, z.B. Rohrlänge m" aria-label="Feldname">' +
        '<select id="k-t-' + n + '" aria-label="Feldtyp">' + opt('text', 'Text', f.typ === 'text') + opt('zahl', 'Zahl', f.typ === 'zahl') + opt('datum', 'Datum', f.typ === 'datum') + '</select>' +
        '<button type="button" class="btn ghost sq" data-act="k-fdel" data-n="' + n + '" aria-label="Feld entfernen">×</button></div>';
    });
    b += '</div><button type="button" class="link-btn" data-act="k-fadd">+ Feld hinzufügen</button></div>';
    b += '<p class="form-err" id="k-err" role="alert"></p>';
    var del = c.kid && !used && k.typ === 'sensor' ? '<button type="button" class="btn ghost danger-t" data-act="k-del">Löschen</button>' : (used ? '<span class="muted small">' + used + ' Geräte nutzen diese Kategorie</span>' : '');
    M.modal({ title: c.kid ? 'Kategorie bearbeiten' : 'Neue Kategorie', form: 'kat', wide: true, body: b, foot: foot('Speichern', del), noFocus: !!c.kidRerender });
  }
  function readKat() {
    var k = M.ctx.k;
    k.name = val('k-name'); k.kuerzel = val('k-kz').toUpperCase();
    k.felder = (k.felder || []).map(function (f, n) { return { name: val('k-f-' + n), typ: val('k-t-' + n) || 'text' }; });
    return k;
  }
  M.katAction = function (act, data) {
    var k = readKat();
    if (act === 'k-grp') k.gruppe = data.k;
    if (act === 'k-pik') k.piktogramm = data.k;
    if (act === 'k-fadd') k.felder.push({ name: '', typ: 'text' });
    if (act === 'k-fdel') k.felder.splice(+data.n, 1);
    M.ctx.kidRerender = true;
    renderKat();
  };
  M.katSync = function () {
    var k = M.ctx.k;
    k.kuerzel = val('k-kz').toUpperCase();
    var prev = document.querySelector('.kat-prev');
    if (prev) prev.innerHTML = S.symbolHtml(k.gruppe, k.piktogramm, { size: 54, kuerzel: k.kuerzel || '?' });
  };
  M.submitKat = function () {
    var c = M.ctx, k = readKat();
    k.felder = k.felder.filter(function (f) { return f.name; });
    if (!k.name) { $('k-err').textContent = 'Bitte einen Namen eingeben.'; return; }
    if (!k.kuerzel) k.kuerzel = k.name.slice(0, 2).toUpperCase();
    if (!c.kid) k.id = M.uid('kat');
    var back = c.back;
    M.put('kategorien', k).then(function () {
      M.closeModal(); M.toast('Kategorie «' + k.name + '» gespeichert'); M.refreshUI();
      if (back) { back.d.kategorieId = k.id; M.openGeraet(back.gid, back.d.typ, back.d); }
    });
  };

  /* ================================================== PROJEKT / MAGAZIN */
  M.openProjekt = function (pid) {
    var p = pid ? M.copy(M.idx().proj[pid]) : { nummer: '', name: '', typ: 'projekt', status: 'aktiv', lat: null, lng: null };
    M.ctx = { kind: 'proj', pid: pid };
    var lv = M.has(p.lat) ? M.toLv95(p.lat, p.lng) : null;
    var b = '<div class="grid2">' + fld('Auftragsnummer', inp('p-nr', p.nummer, 'maxlength="30"')) + fld('Name', inp('p-name', p.name, 'required maxlength="80"')) +
      fld('Art', '<select id="p-typ">' + opt('projekt', 'Projekt', p.typ === 'projekt') + opt('magazin', 'Magazin', p.typ === 'magazin') + '</select>') +
      fld('Status', '<select id="p-st">' + opt('aktiv', 'aktiv', p.status !== 'abgeschlossen') + opt('abgeschlossen', 'abgeschlossen', p.status === 'abgeschlossen') + '</select>') +
      fld('Ost (LV95, optional)', inp('p-e', lv ? Math.round(lv.e) : '', 'inputmode="decimal" class="mono" placeholder="2\'600\'000"')) +
      fld('Nord (LV95, optional)', inp('p-n', lv ? Math.round(lv.n) : '', 'inputmode="decimal" class="mono" placeholder="1\'200\'000"')) + '</div>' +
      '<label class="chk"><input type="checkbox" id="p-place"> Ort danach auf der Karte setzen</label>' +
      '<p class="muted small">Magazine brauchen einen Ort – dort stehen die eingelagerten Geräte. Bei Projekten ist der Ort nur eine Hilfe: Geräte ohne eigene Position stehen vorläufig dort.</p><p class="form-err" id="p-err" role="alert"></p>';
    var del = pid ? '<button type="button" class="btn ghost danger-t" data-act="p-del">Löschen</button>' : '';
    M.modal({ title: pid ? 'Bearbeiten' : 'Neues Projekt', form: 'proj', body: b, foot: foot('Speichern', del) });
  };
  M.submitProjekt = function () {
    var c = M.ctx;
    var p = c.pid ? M.copy(M.idx().proj[c.pid]) : { id: M.uid('prj') };
    p.nummer = val('p-nr'); p.name = val('p-name'); p.typ = val('p-typ'); p.status = val('p-st');
    if (!p.name) { $('p-err').textContent = 'Bitte einen Namen eingeben.'; return; }
    if (val('p-e') || val('p-n')) {
      var w = M.parseLv95(val('p-e'), val('p-n'));
      if (!w) { $('p-err').textContent = 'LV95-Koordinaten prüfen (Ost 2\'xxx\'xxx, Nord 1\'xxx\'xxx).'; return; }
      p.lat = w.lat; p.lng = w.lng;
    } else { p.lat = null; p.lng = null; }
    var place = $('p-place').checked;
    M.put('projekte', p).then(function () {
      M.closeModal(); M.state.projSel = p.id; M.toast('Gespeichert'); M.refreshUI();
      if (place) M.startPlacing('projekt', p.id);
    });
  };

  /* ================================================== Formular-Dispatcher */
  M.onSubmit = function (form, submitter) {
    var f = form.getAttribute('data-form');
    var mode = submitter && submitter.getAttribute('data-submit');
    if (f === 'geraet') M.submitGeraet(mode);
    else if (f === 'dup') M.submitDup();
    else if (f === 'move') M.submitMove();
    else if (f === 'zst') M.submitZustand();
    else if (f === 'wartung') M.submitWartung();
    else if (f === 'einsatz') M.submitEinsatz();
    else if (f === 'kat') M.submitKat();
    else if (f === 'proj') M.submitProjekt();
    else if (f === 'kabel') M.submitKabel();
    else if (f === 'place') M.submitPlace();
    else if (f === 'bulkpos') M.submitBulkPos();
    else if (f === 'auftrag') M.submitAuftrag();
    else if (f === 'position') M.submitPosition();
    else if (f === 'laufzeit') M.submitLaufzeit();
    else if (f === 'msnew') M.submitMsNew();
    else if (f === 'msadd') M.submitMsAdd();
    else if (f === 'msedit') M.submitGruppeEdit();
    else if (f === 'csvimp') M.submitCsvImport();
    else if (f === 'mccpick') {
      var ts = M.ctx.tsId;
      M.setMcc(ts, val('mp-mcc')).then(function () { M.closeModal(); M.toast('MCC-Zuordnung gespeichert'); M.refreshUI(); });
    }
    else if (f === 'confirm') {
      var fn = M.ctx && M.ctx.confirm;
      M.closeModal();
      if (fn) Promise.resolve(fn()).then(function () { M.refreshUI(); });
    }
    else if (f === 'lv95') {
      var w = M.parseLv95(val('pl-e'), val('pl-n'));
      if (!w) { M.toast('LV95-Koordinaten prüfen (Ost 2\'xxx\'xxx, Nord 1\'xxx\'xxx).', 'err'); return; }
      M.placeAt(w.lat, w.lng);
    }
    else if (f === 'ortsuche') {
      var q = val('pl-q'), box = $('pl-res');
      if (!q) return;
      box.innerHTML = '<span class="small">Suche …</span>';
      M.ortSuche(q).then(function (r) {
        box.innerHTML = r.length ? r.map(function (x) {
          return '<button type="button" class="res-btn dark" data-act="map-goto" data-lat="' + x.lat + '" data-lng="' + x.lng + '">' + esc(x.label) + '</button>';
        }).join('') : '<span class="small">Nichts gefunden.</span>';
      });
    }
    else if (f === 'settings-wartung') {
      var s = M.copy(M.settings());
      s.intervall = { tachymeter: M.num(val('set-int-ts')), mcc: M.num(val('set-int-mcc')), sensor: M.num(val('set-int-sensor')) };
      s.warnProzent = Math.max(50, Math.min(100, M.num(val('set-warn')) || 90));
      M.put('einstellungen', s).then(function () { M.toast('Wartungseinstellungen gespeichert'); M.refreshUI(); });
    }
  };
})();
