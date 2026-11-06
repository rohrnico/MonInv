/* MonInv – Karte (Leaflet + swisstopo, zusammengefasste Symbole, Kabelführungen) */
(function () {
  'use strict';
  var M = window.M, S = window.MonSym;

  var WMTS = 'https://wmts.geo.admin.ch/1.0.0/{layer}/default/current/3857/{z}/{x}/{y}.{ext}';
  var LAYERS = {
    karte: { name: 'Landeskarte', layer: 'ch.swisstopo.pixelkarte-farbe', ext: 'jpeg', max: 19 },
    grau:  { name: 'Grau',        layer: 'ch.swisstopo.pixelkarte-grau',  ext: 'jpeg', max: 19 },
    luft:  { name: 'Luftbild',    layer: 'ch.swisstopo.swissimage',       ext: 'jpeg', max: 20 }
  };

  var map = null, cluster = null, kabelLayer = null, drawLayer = null, tiles = {}, current = 'karte', markers = {}, lines = {}, fitted = false;

  function tileLayer(k) {
    var L0 = LAYERS[k];
    return L.tileLayer(WMTS.replace('{layer}', L0.layer).replace('{ext}', L0.ext), {
      maxNativeZoom: L0.max, maxZoom: 21, minZoom: 7,
      attribution: '© <a href="https://www.swisstopo.admin.ch" target="_blank" rel="noopener">swisstopo</a>'
    });
  }

  function clusterIcon(c) {
    var kids = c.getAllChildMarkers();
    var counts = {}, issues = 0, n = kids.length, mag = 0;
    kids.forEach(function (m) {
      counts[m.options.gruppe] = (counts[m.options.gruppe] || 0) + 1;
      if (m.options.issue) issues++;
      if (m.options.mag) mag++;
    });
    var acc = 0, parts = [];
    S.GRUPPEN_ORDER.forEach(function (k) {
      var v = counts[k]; if (!v) return;
      var a = acc / n * 360; acc += v; var b = acc / n * 360;
      parts.push(S.GRUPPEN[k].fill + ' ' + a.toFixed(1) + 'deg ' + b.toFixed(1) + 'deg');
    });
    var size = Math.round(Math.min(64, 34 + Math.sqrt(n) * 5));
    var html = '<div class="cl' + (mag === n ? ' cl-mag' : '') + '" style="--cs:' + size + 'px;background:conic-gradient(' + parts.join(',') + ')">' +
      '<span class="cl-n">' + n + '</span>' + (issues ? '<span class="cl-badge">' + issues + '</span>' : '') + '</div>';
    return L.divIcon({ html: html, className: 'cl-wrap', iconSize: [size, size] });
  }

  M.mapInit = function () {
    if (map) { setTimeout(function () { map.invalidateSize(); }, 30); return; }
    if (!window.L) { document.getElementById('map').innerHTML = '<p class="map-err">Kartenbibliothek konnte nicht geladen werden.</p>'; return; }
    map = L.map('map', { zoomControl: false, center: [46.98, 7.55], zoom: 10, attributionControl: true });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);
    Object.keys(LAYERS).forEach(function (k) { tiles[k] = tileLayer(k); });
    tiles[current].addTo(map);
    kabelLayer = L.layerGroup().addTo(map);
    drawLayer = L.layerGroup().addTo(map);
    cluster = L.markerClusterGroup({
      iconCreateFunction: clusterIcon,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: false,
      zoomToBoundsOnClick: false,
      maxClusterRadius: function (z) { return z < 12 ? 60 : z < 16 ? 45 : 30; },
      spiderLegPolylineOptions: { weight: 1.5, color: '#00468E', opacity: 0.6 }
    });
    map.addLayer(cluster);
    // Klick auf Zusammenfassung: hineinzoomen – liegen die Geräte praktisch am gleichen Ort, als Liste zeigen statt aufzufächern
    cluster.on('clusterclick', function (a) {
      var kids = a.layer.getAllChildMarkers(), b = a.layer.getBounds();
      var close = M.dist([b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]) < 4;
      if (M.state.placing) { M.placeAt(a.latlng.lat, a.latlng.lng); return; }
      if (M.state.drawing) { M.drawAdd(a.latlng.lat, a.latlng.lng, null); return; }
      if (close || map.getZoom() >= 19) M.showStack(kids.map(function (m) { return m.options.gid; }));
      else a.layer.zoomToBounds(pad(40));
    });
    map.on('click', function (e) {
      if (M.state.placing) { M.placeAt(e.latlng.lat, e.latlng.lng); return; }
      if (M.state.drawing) { M.drawAdd(e.latlng.lat, e.latlng.lng, null); return; }
    });
    var labels = function () { map.getContainer().classList.toggle('zoom-labels', map.getZoom() >= 18); };
    map.on('zoomend', labels); labels();
    map.on('mousemove', function (e) {
      var el = document.getElementById('map-coord');
      if (el) el.textContent = 'LV95 ' + M.fmtLv95(e.latlng.lat, e.latlng.lng);
    });
    M.mapUpdate();
  };

  M.mapLayer = function (k) {
    if (!map || !tiles[k] || k === current) return;
    map.removeLayer(tiles[current]);
    tiles[k].addTo(map);
    current = k;
    M.renderMapTools();
  };
  M.mapLayerKey = function () { return current; };
  M.mapLayers = LAYERS;

  M.mapFilter = function (i) {
    var f = M.state.filters.map;
    if (!i.pos) return false;
    if (i.g.zustand === 'ausgemustert') return false;
    if (i.mccTs && !i.isMag) return false;          // MCC im Betrieb: gehört zum Tachymeter
    if (i.ms && i.msBei) return false;               // Gerät bei seiner Messstelle: die Messstelle steht auf der Karte (mit eigenem Standort: einzeln)
    if (f.off[i.gruppe]) return false;
    if (i.isMag && !f.magazin) return false;
    if (!i.isMag && !f.feld) return false;
    if (f.issue && !i.issue) return false;
    if (f.projekt && (!i.proj || i.proj.id !== f.projekt)) return false;
    return true;
  };

  function markerIcon(i, sel) {
    var html = M.symbol(i.g.id, 30, { map: true }) + '<span class="mk-lab">' + M.esc(i.g.name) + (i.g.mccId ? ' + MCC ' + M.esc(M.mccKurz(i.g.mccId)) : '') + (i.members ? ' · ' + i.members.length + (i.members.length === 1 ? ' Gerät' : ' Geräte') : '') + '</span>';
    return L.divIcon({ html: html, className: 'mk' + (sel ? ' mk-sel' : ''), iconSize: [36, 36], iconAnchor: [18, 18] });
  }

  function drawKabel() {
    kabelLayer.clearLayers();
    lines = {};
    if (!M.state.filters.map.kabel) return;
    M.state.data.kabel.forEach(function (k) {
      if (!k.punkte || k.punkte.length < 2) return;
      if (M.state.drawing && M.state.drawing.kabelId === k.id) return;
      var t = M.kabelTypen[k.typ] || M.kabelTypen.andere, sel = M.state.selKabel === k.id;
      var casing = L.polyline(k.punkte, { color: '#FFFFFF', weight: sel ? 9 : 6, opacity: 0.9, interactive: false });
      var line = L.polyline(k.punkte, { color: sel ? '#D9590B' : t.color, weight: sel ? 5 : 3, dashArray: t.dash, opacity: 1 });
      var hit = L.polyline(k.punkte, { color: '#000', weight: 16, opacity: 0 });
      hit.on('click', function (e) {
        L.DomEvent.stop(e);
        if (M.state.drawing) { var sp = snapToLine(k.punkte, e.latlng); M.drawAdd(sp[0], sp[1], null, k.id); return; }
        if (M.state.placing) { M.placeAt(e.latlng.lat, e.latlng.lng); return; }
        M.selectKabel(k.id);
      });
      hit.bindTooltip(M.esc(k.name || t.name) + ' · ' + M.fmtLen(M.lineLen(k.punkte)), { sticky: true, direction: 'top' });
      kabelLayer.addLayer(casing); kabelLayer.addLayer(line); kabelLayer.addLayer(hit);
      lines[k.id] = line;
    });
  }

  /* Punkt auf ein bestehendes Kabel ziehen: nahe einem Knick genau auf den Knick, sonst auf die Linie (lotrecht) */
  function snapToLine(pts, ll) {
    var p = map.latLngToLayerPoint(ll), best = null, bd = Infinity, i;
    for (i = 0; i < pts.length; i++) {
      var v = map.latLngToLayerPoint(L.latLng(pts[i])), dv = v.distanceTo(p);
      if (dv < 14 && dv < bd) { bd = dv; best = pts[i]; }
    }
    if (best) return [best[0], best[1]];
    for (i = 0; i < pts.length - 1; i++) {
      var a = map.latLngToLayerPoint(L.latLng(pts[i])), b = map.latLngToLayerPoint(L.latLng(pts[i + 1]));
      var c = L.LineUtil.closestPointOnSegment(p, a, b), dc = c.distanceTo(p);
      if (dc < bd) { bd = dc; best = c; }
    }
    if (!best) return [ll.lat, ll.lng];
    var q = map.layerPointToLatLng(best);
    return [q.lat, q.lng];
  }

  M.mapUpdate = function () {
    if (!map) return;
    // offene «zoomToShowLayer»-Rückrufe verwerfen: ihre Marker werden gleich ersetzt
    cluster.off('animationend'); cluster.off('spiderfied');
    cluster.clearLayers();
    markers = {};
    var list = [];
    M.state.data.geraete.forEach(function (g) {
      var i = M.info(g.id);
      if (!M.mapFilter(i)) return;
      var m = L.marker([i.pos.lat, i.pos.lng], {
        icon: markerIcon(i, M.state.sel === g.id),
        gruppe: i.gruppe, issue: i.issue, mag: i.isMag, gid: g.id,
        title: g.name, keyboard: true, riseOnHover: true
      });
      m.on('click', function () {
        if (M.state.drawing) { M.drawAdd(i.pos.lat, i.pos.lng, g.id); return; }
        if (M.state.placing) { M.placeAt(m.getLatLng().lat, m.getLatLng().lng); return; }
        M.select(g.id);
      });
      markers[g.id] = m;
      list.push(m);
    });
    cluster.addLayers(list);
    drawKabel();
    renderDraw();
    if (!fitted && list.length) {
      fitted = true;
      map.fitBounds(cluster.getBounds(), pad(40, { maxZoom: 13 }));
    }
  };

  M.mapMarkSel = function (prev, next) {
    [prev, next].forEach(function (id) {
      if (id && markers[id]) markers[id].setIcon(markerIcon(M.info(id), id === next));
    });
  };
  M.mapRedrawKabel = function () { if (map) drawKabel(); };

  /* Ränder für fitBounds: auf dem Handy oben die Werkzeuge, unten das Blatt freihalten */
  function pad(n, o) {
    o = o || {};
    var e = M.mapEdges ? M.mapEdges() : null;
    o.paddingTopLeft = [n, n + (e ? e.top : 0)];
    o.paddingBottomRight = [n, n + (e ? e.bottom : 0)];
    return o;
  }
  /* Gerät nach dem Antippen nicht unter dem Blatt verstecken */
  M.mapKeepVisible = function (gid) {
    var m = markers[gid], e = M.mapEdges ? M.mapEdges() : null;
    if (!map || !m || !e || !map.hasLayer(m)) return;
    var p = map.latLngToContainerPoint(m.getLatLng()), h = map.getSize().y, free = h - e.bottom;
    if (p.y > free - 30 || p.y < e.top + 20) map.panBy([0, p.y - (e.top + (free - e.top) / 2)], { animate: !calm(), duration: 0.35 });
  };
  /* Auf dem Handy deckt das Detailblatt den unteren Teil der Karte ab: Ziel so verschieben, dass es mitten im sichtbaren Teil steht */
  function shifted(ll, z) {
    var oy = M.mapOffsetY ? M.mapOffsetY() : 0;
    if (!oy) return L.latLng(ll);
    return map.unproject(map.project(ll, z).add([0, oy]), z);
  }
  M.mapFocus = function (gid) {
    if (!map) return;
    var m = markers[gid];
    if (m) { cluster.zoomToShowLayer(m, function () { map.panTo(shifted(m.getLatLng(), map.getZoom()), { animate: !calm(), duration: 0.5 }); }); return; }
    var i = M.info(gid);
    if (i && i.mccTs) return M.mapFocus(i.mccTs.id);
    if (i && i.pos) { var z = Math.max(map.getZoom(), 16); map.setView(shifted([i.pos.lat, i.pos.lng], z), z); }
  };
  M.mapFocusKabel = function (kid) {
    var k = M.idx().kab[kid];
    if (map && k && k.punkte && k.punkte.length) map.fitBounds(L.latLngBounds(k.punkte), pad(60, { maxZoom: 19 }));
  };
  var calm = function () { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  M.mapFocusPoint = function (lat, lng, z) {
    if (!map) return;
    var near = map.getBounds().pad(1.5).contains([lat, lng]);
    if (calm() || !near) map.setView([lat, lng], z || 16); else map.flyTo([lat, lng], z || 16, { duration: 0.6 });
  };
  M.mapCenter = function () { if (!map) return null; var c = map.getCenter(); return { lat: c.lat, lng: c.lng }; };
  M.mapFitAll = function () { if (map && cluster.getLayers().length) map.fitBounds(cluster.getBounds(), pad(40, { maxZoom: 15 })); };
  M.mapFitIds = function (ids) {
    if (!map) return;
    var pts = ids.map(function (id) { var i = M.info(id); return i && i.pos ? [i.pos.lat, i.pos.lng] : null; }).filter(Boolean);
    if (pts.length === 1) map.setView(pts[0], Math.max(map.getZoom(), 18));
    else if (pts.length) map.fitBounds(L.latLngBounds(pts), pad(60, { maxZoom: 19 }));
  };
  M.mapSetMode = function (mode) {
    var el = document.getElementById('map');
    if (!el) return;
    el.classList.toggle('is-placing', mode === 'place');
    el.classList.toggle('is-drawing', mode === 'draw');
    if (map) { if (mode === 'draw') map.doubleClickZoom.disable(); else map.doubleClickZoom.enable(); }
  };
  M.mapObj = function () { return map; };
  M.mapInvalidate = function () { if (map) setTimeout(function () { map.invalidateSize(); }, 60); };

  /* ---------- Kabel zeichnen */
  function renderDraw() {
    if (!drawLayer) return;
    drawLayer.clearLayers();
    var d = M.state.drawing;
    if (!d) return;
    if (d.pts.length > 1) {
      drawLayer.addLayer(L.polyline(d.pts, { color: '#FFFFFF', weight: 7, opacity: 0.9, interactive: false }));
      drawLayer.addLayer(L.polyline(d.pts, { color: '#F26B1D', weight: 4, dashArray: '10 6', interactive: false }));
    }
    d.pts.forEach(function (p, n) {
      drawLayer.addLayer(L.circleMarker(p, { radius: n === 0 || n === d.pts.length - 1 ? 6 : 4, color: '#F26B1D', weight: 2, fillColor: '#FFFFFF', fillOpacity: 1, interactive: false }));
    });
  }
  M.drawRender = renderDraw;

  M.drawAdd = function (lat, lng, gid, kid) {
    var d = M.state.drawing;
    if (!d) return;
    d.pts.push([lat, lng]);
    if (kid) { d.kabelAn = d.kabelAn || []; d.kabelAn.push({ kid: kid, n: d.pts.length - 1 }); }
    if (gid) {
      if (!d.zuId) d.zuId = gid;
      else if (gid !== d.zuId) d.vonId = gid;
    }
    renderDraw();
    M.renderPlacing();
  };
})();
