/* MonInv – Symbolbibliothek
   Form = wo gemessen wird (Gruppe), Farbe = Gruppe, Piktogramm = was es ist.
   Neue Piktogramme: einen Eintrag in PIKTOGRAMME ergänzen (SVG-Pfade, viewBox 0 0 24 24). */
(function () {
  'use strict';

  var GRUPPEN = {
    geo:   { name: 'Geodätisch',      form: 'dreieck',  fill: '#A9C6E8', ink: '#1F3F66' },
    boden: { name: 'Im Boden',        form: 'kreis',    fill: '#F6E7A1', ink: '#6B5300' },
    bau:   { name: 'Am Bauwerk',      form: 'raute',    fill: '#CDBDE6', ink: '#4B3577' },
    umw:   { name: 'Wasser & Umwelt', form: 'sechseck', fill: '#A9DCCF', ink: '#0F5E52' },
    erf:   { name: 'Geotechnisch',    form: 'quadrat',  fill: '#F3C4D0', ink: '#7E2A3E' }
  };
  var GRUPPEN_ORDER = ['geo', 'boden', 'bau', 'umw', 'erf'];

  var PIKTOGRAMME = {
    TS: { name: 'Tachymeter', p: ['M9 2.5h6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z', 'M12 9.5v3M12 12.5l-6 9M12 12.5v9M12 12.5l6 9'] },
    GN: { name: 'GNSS-Antenne', p: ['M5 8a7 2.5 0 1 0 14 0a7 2.5 0 1 0-14 0', 'M12 10.5V21M8 21h8', 'M8.5 4a5.5 5.5 0 0 1 7 0'] },
    PR: { name: 'Prisma', p: ['M5.5 9a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0-13 0', 'M12 5.5l3.2 5.5H8.8z', 'M12 15.5V22'] },
    MC: { name: 'MCC TSC', p: ['M5.5 7h13A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9A1.5 1.5 0 0 1 5.5 7z', 'M7 10.5h10M7 13.5h6', 'M16 7l2.5-4'] },
    IN: { name: 'Inklinometer', p: ['M4 5h4M16 5h4', 'M8 5v16M16 5v16', 'M12 5c0 6 2.6 9 1 16'] },
    EX: { name: 'Extensometer', p: ['M8 2.5h8v3.5H8z', 'M12 6v15', 'M9 11h6M9 16h6M9 21h6'] },
    PZ: { name: 'Piezometersonde', p: ['M8 2v20M16 2v20', 'M12 9c-2 2.6-3 4.2-3 5.6a3 3 0 0 0 6 0c0-1.4-1-3-3-5.6z'] },
    SP: { name: 'Setzungspegel', p: ['M12 3v12', 'M8.5 11.5L12 15l3.5-3.5', 'M6 18.5h12M3 21.5h18'] },
    NS: { name: 'Neigungssensor', p: ['M4 19h16', 'M4 19L17 8', 'M11 19a7 7 0 0 0-1.6-4.5'] },
    RM: { name: 'Rissmeter', p: ['M12.5 2l-2.5 5 4 4-4 5 3 6', 'M5 9v6M19 9v6M5 12h3M16 12h3'] },
    ER: { name: 'Erschütterung', p: ['M2 12h3l2-5 3 11 3-14 3 13 2-5h4'] },
    KV: { name: 'Konvergenz', p: ['M4 21v-9a8 8 0 0 1 16 0v9', 'M8 14h8M8 14l2-2M8 14l2 2M16 14l-2-2M16 14l-2 2'] },
    PG: { name: 'Pegel', p: ['M5 3v18M5 6h3M5 10h3M5 14h3', 'M10 13c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0M10 17c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0'] },
    WS: { name: 'Wetter / Regen', p: ['M7 14.5a4 4 0 0 1 .4-8 5 5 0 0 1 9.6 1.6 3.2 3.2 0 0 1 0 6.4z', 'M8 18l-1 3M12 18l-1 3M16 18l-1 3'] },
    TE: { name: 'Temperatur', p: ['M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z', 'M12 9v7'] },
    LA: { name: 'Lärm', p: ['M4 9h3l5-4v14l-5-4H4z', 'M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11'] },
    MZ: { name: 'Messzentrale', p: ['M4.5 4h15A1.5 1.5 0 0 1 21 5.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 13.5v-8A1.5 1.5 0 0 1 4.5 4z', 'M6 8h12', 'M7.5 15v6M12 15v6M16.5 15v6'] },
    GW: { name: 'Gateway / Modem', p: ['M5.5 13h13a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-4A1.5 1.5 0 0 1 5.5 13z', 'M8 13V9M16 13V9', 'M9.5 6.5a3.5 3.5 0 0 1 5 0M7 4a7 7 0 0 1 10 0'] },
    KA: { name: 'Kamera', p: ['M4.5 7h10A1.5 1.5 0 0 1 16 8.5v7a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 3 15.5v-7A1.5 1.5 0 0 1 4.5 7z', 'M16 10.5l5-3v9l-5-3', 'M7 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0'] },
    SO: { name: 'Solar / Strom', p: ['M4 16l3-9h13l-3 9z', 'M5.5 11.5h13M11 7l-2 9M15.5 7l-2 9', 'M12 16v4M8.5 20h7'] },
    AL: { name: 'Alarmgeber', p: ['M7 17v-4a5 5 0 0 1 10 0v4', 'M5 17h14v3.5H5z', 'M12 2.5v2M4.5 6l1.4 1.4M19.5 6l-1.4 1.4'] }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pictoSvg(key, size, stroke, sw) {
    var pk = PIKTOGRAMME[key];
    if (!pk) return '';
    return '<svg aria-hidden="true" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + (stroke || 'currentColor') +
      '" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round">' +
      pk.p.map(function (d) { return '<path d="' + d + '"/>'; }).join('') + '</svg>';
  }

  /* Formen im 40er-Raster; pk = Lage des Piktogramms [Mitte x, Mitte y, Grösse] */
  var FORMEN = {
    kreis:    { el: '<circle cx="20" cy="20" r="18"/>', pk: [20, 20, 22] },
    quadrat:  { el: '<rect x="3" y="3" width="34" height="34" rx="7"/>', pk: [20, 20, 22] },
    raute:    { el: '<polygon points="20,1 39,20 20,39 1,20"/>', pk: [20, 20, 19] },
    dreieck:  { el: '<polygon points="20,2 38.5,36.5 1.5,36.5"/>', pk: [20, 25, 16] },
    sechseck: { el: '<polygon points="10.5,3 29.5,3 39,20 29.5,37 10.5,37 1,20"/>', pk: [20, 20, 19] }
  };

  /* Symbol-HTML. opts: { size, state: 'ok'|'wartung'|'ort'|'magazin'|'defekt', kuerzel, map } */
  function symbolHtml(gruppeKey, pikto, opts) {
    opts = opts || {};
    var g = GRUPPEN[gruppeKey] || GRUPPEN.erf;
    var f = FORMEN[g.form];
    var s = opts.size || 28;
    var st = opts.state || 'ok';
    var fill = g.fill, ink = g.ink, edge = g.ink, edgeW = 1.3, dash = '', edgeOp = 0.55;
    if (st === 'ort') { fill = '#FFFFFF'; ink = '#A04500'; edge = '#F26B1D'; edgeW = 2; dash = ' stroke-dasharray="4 3"'; edgeOp = 1; }
    if (st === 'magazin') { fill = '#FFFFFF'; edgeW = 2; edgeOp = 1; }
    if (st === 'reserviert') { fill = '#FFFFFF'; edge = '#00468E'; edgeW = 2.2; edgeOp = 1; dash = ' stroke-dasharray="5 2.5"'; }
    if (st === 'defekt') { fill = '#E5E5E4'; ink = '#5E5C5B'; edge = '#8A8887'; edgeOp = 1; }
    var shape = f.el.replace('/>', ' fill="' + fill + '" stroke="' + edge + '" stroke-opacity="' + edgeOp + '" stroke-width="' + edgeW + '" vector-effect="non-scaling-stroke"' + dash + '/>');
    var halo = opts.map ? f.el.replace('/>', ' fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>') : '';
    var inner = '';
    var pk = PIKTOGRAMME[pikto];
    if (pk) {
      var k = f.pk[2] / 24;
      inner = '<g transform="translate(' + (f.pk[0] - f.pk[2] / 2) + ' ' + (f.pk[1] - f.pk[2] / 2) + ') scale(' + k.toFixed(3) + ')" fill="none" stroke="' + ink +
        '" stroke-width="' + (s < 24 ? 1.6 : 1.9) + '" stroke-linecap="round" stroke-linejoin="round">' +
        pk.p.map(function (d) { return '<path d="' + d + '" vector-effect="non-scaling-stroke"/>'; }).join('') + '</g>';
    } else {
      var txt = esc(String(opts.kuerzel || '?').slice(0, 3));
      inner = '<text x="20" y="' + (g.form === 'dreieck' ? 31 : 24.5) + '" text-anchor="middle" font-family="Exo 2, Segoe UI, sans-serif" font-weight="800" font-size="' +
        (txt.length > 2 ? 10 : 12.5) + '" fill="' + ink + '">' + txt + '</text>';
    }
    if (st === 'defekt') inner += '<path d="M8 32L32 8" stroke="#5E5C5B" stroke-width="1.6" vector-effect="non-scaling-stroke"/>';
    return '<span class="sym sym-' + st + (opts.map ? ' sym-map' : '') + '" style="--s:' + s + 'px">' +
      '<svg aria-hidden="true" width="' + s + '" height="' + s + '" viewBox="-2 -2 44 44" overflow="visible">' + halo + shape + inner + '</svg></span>';
  }

  window.MonSym = {
    GRUPPEN: GRUPPEN,
    GRUPPEN_ORDER: GRUPPEN_ORDER,
    PIKTOGRAMME: PIKTOGRAMME,
    pictoSvg: pictoSvg,
    symbolHtml: symbolHtml,
    esc: esc
  };
})();
