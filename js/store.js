/* MonInv – Datenschicht
   Beide Speicher haben dieselbe Schnittstelle:
     init() → Promise, load() → Promise<data>, save(col, rec), remove(col, id), replaceAll(data)
   data = { kategorien:[], projekte:[], geraete:[], einsaetze:[], wartungen:[], einstellungen:[] }
   Jeder Datensatz ist ein JSON-Objekt mit eindeutiger id. Neue Attribute brauchen keine
   Änderung am Speicher (SharePoint speichert den Datensatz als JSON in der Spalte «Daten»). */
(function () {
  'use strict';

  var COLLECTIONS = ['kategorien', 'projekte', 'geraete', 'einsaetze', 'wartungen', 'kabel', 'dateien', 'positionen', 'einstellungen'];

  function emptyData() {
    var d = {};
    COLLECTIONS.forEach(function (c) { d[c] = []; });
    return d;
  }

  /* ---------------------------------------------------------- lokal */
  function LocalStore() {
    this.mode = 'lokal';
    this.label = 'Lokal in diesem Browser';
    this.key = 'moninv.daten.v1';
    this.data = null;
    this.persistent = true;
    this.userName = '';
  }
  LocalStore.prototype.init = function () { return Promise.resolve(); };
  LocalStore.prototype.load = function () {
    var raw = null;
    try { raw = localStorage.getItem(this.key); } catch (e) { this.persistent = false; }
    if (raw) {
      try { this.data = Object.assign(emptyData(), JSON.parse(raw)); } catch (e) { this.data = null; }
    }
    if (!this.data) {
      this.data = window.MonInvBeispiel ? window.MonInvBeispiel() : emptyData();
      this._persist();
    }
    return Promise.resolve(this.data);
  };
  LocalStore.prototype._persist = function () {
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); this.persistent = true; }
    catch (e) { this.persistent = false; }
  };
  LocalStore.prototype.save = function (col, rec) {
    var arr = this.data[col];
    var i = arr.findIndex(function (r) { return r.id === rec.id; });
    if (i >= 0) arr[i] = rec; else arr.push(rec);
    this._persist();
    return Promise.resolve();
  };
  LocalStore.prototype.remove = function (col, id) {
    this.data[col] = this.data[col].filter(function (r) { return r.id !== id; });
    this._persist();
    return Promise.resolve();
  };
  LocalStore.prototype.replaceAll = function (data) {
    this.data = Object.assign(emptyData(), data);
    this._persist();
    return Promise.resolve();
  };
  LocalStore.prototype.refresh = function () { return Promise.resolve(null); };

  /* Dateien (Pläne, Skizzen, Offerten) lokal: IndexedDB, damit auch grosse PDFs Platz haben */
  function idb() {
    if (idb.p) return idb.p;
    idb.p = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('Dieser Browser kann keine Dateien speichern.'));
      var r = indexedDB.open('moninv-dateien', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('blobs'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error || new Error('Dateispeicher nicht verfügbar')); };
    });
    return idb.p;
  }
  function idbDo(mode, fn) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('blobs', mode), st = tx.objectStore('blobs'), out;
        var req = fn(st);
        if (req) req.onsuccess = function () { out = req.result; };
        tx.oncomplete = function () { res(out); };
        tx.onerror = tx.onabort = function () { rej(tx.error || new Error('Speichern fehlgeschlagen')); };
      });
    });
  }
  LocalStore.prototype.putBlob = function (id, name, blob) {
    return idbDo('readwrite', function (st) { return st.put(blob, id); }).then(function () { return { key: id }; });
  };
  LocalStore.prototype.getBlob = function (ref) {
    return idbDo('readonly', function (st) { return st.get(ref.key); }).then(function (b) {
      if (!b) throw new Error('Datei nicht gefunden (nur im Browser gespeichert, in dem sie hochgeladen wurde).');
      return b;
    });
  };
  LocalStore.prototype.removeBlob = function (ref) {
    return idbDo('readwrite', function (st) { return st.delete(ref.key); });
  };

  /* ---------------------------------------------------------- SharePoint (Microsoft Graph) */
  var GRAPH = 'https://graph.microsoft.com/v1.0';
  var SCOPES = ['Sites.ReadWrite.All', 'Sites.Manage.All'];

  function SharePointStore(cfg) {
    this.mode = 'sharepoint';
    this.cfg = cfg;
    this.label = 'SharePoint · ' + (cfg.site || '–');
    this.siteId = null;
    this.lists = {};      // col → listId
    this.items = {};      // col → { recordId → itemId }
    this.account = null;
    this.userName = '';
    this.data = emptyData();
  }

  /* Dateien in der Dokumentbibliothek der Website, Ordner «MonInv-Dateien» */
  SharePointStore.prototype._raw = function (method, url, body, headers) {
    var self = this;
    return this._token().then(function (token) {
      var h = Object.assign({ Authorization: 'Bearer ' + token }, headers || {});
      return fetch(url.indexOf('http') === 0 ? url : GRAPH + url, { method: method, headers: h, body: body });
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) {
        var m = ''; try { var j = JSON.parse(t); m = j && j.error && j.error.message ? j.error.message : ''; } catch (x) { m = t.slice(0, 160); }
        var e = new Error('SharePoint-Datei: ' + (res.status === 403 ? 'keine Berechtigung (403)' : res.status === 404 ? 'nicht gefunden (404)' : 'HTTP ' + res.status) + (m ? ' – ' + m : '')); e.status = res.status; throw e;
      });
      return res;
    });
  };
  SharePointStore.prototype._drive = function () {
    var self = this;
    if (this.driveId) return Promise.resolve(this.driveId);
    return this._graph('GET', '/sites/' + this.siteId + '/drive?$select=id').then(function (d) { self.driveId = d.id; return d.id; });
  };
  /* Dateien liegen in der Dokumentbibliothek der Website: MonInv-Dateien/Projekte/<Projekt>/… bzw. …/Geräte/<Gerät>/… */
  function clean(s) { return String(s || '').replace(/'/g, '’').replace(/[\\/:*?"<>|#%~&{}]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Ohne Namen'; }
  SharePointStore.prototype.putBlob = function (id, name, blob, sub) {
    var self = this, folder = this.cfg.dateienOrdner || 'MonInv-Dateien';
    var safe = clean(name).slice(-120);
    var parts = [folder].concat((sub || []).map(clean)).concat([safe.replace(/(\.[^.]+)?$/, function (ext) { return ' (' + id.slice(-6) + ')' + ext; })]);
    var path = parts.map(encodeURIComponent).join('/');
    return this._drive().then(function (drive) {
      if (blob.size <= 4 * 1024 * 1024) {
        return self._raw('PUT', '/drives/' + drive + '/root:/' + path + ':/content', blob, { 'Content-Type': blob.type || 'application/octet-stream' }).then(function (r) { return r.json(); });
      }
      // grosse Dateien: Upload-Sitzung in Stücken von 3.75 MB (Vielfaches von 320 KiB)
      return self._graph('POST', '/drives/' + drive + '/root:/' + path + ':/createUploadSession', { item: { '@microsoft.graph.conflictBehavior': 'replace' } }).then(function (sess) {
        var CH = 12 * 327680, size = blob.size;
        function part(start) {
          var end = Math.min(size, start + CH);
          return fetch(sess.uploadUrl, { method: 'PUT', headers: { 'Content-Range': 'bytes ' + start + '-' + (end - 1) + '/' + size }, body: blob.slice(start, end) }).then(function (res) {
            if (!res.ok) throw new Error('SharePoint-Upload: HTTP ' + res.status);
            if (end < size) return part(end);
            return res.json();
          });
        }
        return part(0);
      });
    }).then(function (item) { return { itemId: item.id, webUrl: item.webUrl, path: parts.join('/') }; });
  };
  /* Datei anzeigen, ohne sie per fetch zu laden (SharePoint-Downloads sind für fremde Websites gesperrt):
     Bilder über ein grosses Vorschaubild, PDF und Office über die eingebettete SharePoint-Vorschau. */
  SharePointStore.prototype.fileView = function (f) {
    var self = this, ref = f.ref || {};
    if (!ref.itemId) return Promise.reject(Object.assign(new Error('Diese Datei wurde im Testbetrieb hochgeladen und liegt nur im damaligen Browser – in SharePoint gibt es nur den Eintrag. Bitte die Datei neu hochladen.'), { fehlt: true }));
    var bild = /^image\//.test(f.mime || '') || /\.(jpe?g|png|gif|webp|heic)$/i.test(f.name || '');
    return this._drive().then(function (drive) {
      var base = '/drives/' + drive + '/items/' + ref.itemId;
      return self._graph('GET', base).then(function (it) {
        var out = { webUrl: it.webUrl || ref.webUrl, download: it['@microsoft.graph.downloadUrl'] || null };
        if (bild) {
          return self._graph('GET', base + '/thumbnails?$select=large').then(function (t) {
            var v = t && t.value && t.value[0]; out.img = v && v.large ? v.large.url : out.download; return out;
          }).catch(function () { out.img = out.download; return out; });
        }
        return self._graph('POST', base + '/preview', {}).then(function (p) { out.embed = p && p.getUrl ? p.getUrl : null; return out; })
          .catch(function () { return out; });
      }, function (e) {
        if (e.status === 404) throw Object.assign(new Error('Die Datei ist in SharePoint nicht mehr vorhanden (gelöscht oder verschoben). Bitte neu hochladen.'), { fehlt: true });
        throw e;
      });
    });
  };
  SharePointStore.prototype.getBlob = function (ref) {
    var self = this;
    if (!ref || !ref.itemId) return Promise.reject(Object.assign(new Error('Diese Datei wurde im Testbetrieb hochgeladen und liegt nur im damaligen Browser – in SharePoint gibt es nur den Eintrag. Bitte die Datei neu hochladen (Knopf «Neu hochladen»).'), { fehlt: true }));
    return this._drive().then(function (drive) {
      return self._graph('GET', '/drives/' + drive + '/items/' + ref.itemId + '?$select=id,@microsoft.graph.downloadUrl');
    }).then(function (it) {
      var u = it && it['@microsoft.graph.downloadUrl'];
      if (!u) throw Object.assign(new Error('Datei in SharePoint nicht gefunden.'), { fehlt: true });
      return fetch(u).then(function (r) { if (!r.ok) throw new Error('Download: HTTP ' + r.status); return r.blob(); });
    });
  };
  SharePointStore.prototype.folderUrl = function () {
    var self = this, folder = this.cfg.dateienOrdner || 'MonInv-Dateien';
    return this._drive().then(function (drive) {
      return self._graph('GET', '/drives/' + drive + '/root:/' + encodeURIComponent(folder) + '?$select=webUrl').catch(function () { return self._graph('GET', '/drives/' + drive + '/root?$select=webUrl'); });
    }).then(function (it) { return it.webUrl; });
  };
  SharePointStore.prototype.removeBlob = function (ref) {
    if (!ref || !ref.itemId) return Promise.resolve();
    var self = this;
    return this._drive().then(function (drive) { return self._raw('DELETE', '/drives/' + drive + '/items/' + ref.itemId); }).catch(function (e) { if (e.status !== 404) throw e; });
  };

  SharePointStore.prototype.logout = function () {
    if (this.pca) return this.pca.logoutRedirect({ account: this.account, postLogoutRedirectUri: location.href.split('#')[0] });
  };

  SharePointStore.prototype.init = function () {
    var self = this, cfg = this.cfg;
    if (!window.msal) return Promise.reject(new Error('Microsoft-Login-Bibliothek fehlt (vendor/msal).'));
    if (!cfg.tenantId || !cfg.clientId || !cfg.site) {
      return Promise.reject(new Error('SharePoint ist in config.js noch nicht eingerichtet (tenantId, clientId, site).'));
    }
    var guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!guid.test(String(cfg.tenantId).trim()) || !guid.test(String(cfg.clientId).trim())) {
      return Promise.reject(new Error('In config.js stehen bei tenantId und clientId noch keine gültigen IDs. Dort die «Verzeichnis-ID (Mandant)» und die «Anwendungs-ID (Client)» aus Microsoft Entra › App-Registrierungen › MonInv › Übersicht eintragen (Format 0a1b2c3d-…).'));
    }
    if (!/^[^:\/]+\.sharepoint\.com:\/sites\/[^/]+/i.test(String(cfg.site).trim())) {
      return Promise.reject(new Error('In config.js ist «site» nicht im richtigen Format. Beispiel: ristag.sharepoint.com:/sites/Monitoring (Host, Doppelpunkt, Pfad).'));
    }
    this.pca = new msal.PublicClientApplication({
      auth: {
        clientId: cfg.clientId,
        authority: 'https://login.microsoftonline.com/' + cfg.tenantId,
        redirectUri: location.origin + location.pathname
      },
      cache: { cacheLocation: 'localStorage' }
    });
    return this.pca.handleRedirectPromise().then(function (res) {
      if (res && res.account) self.account = res.account;
      if (!self.account) self.account = self.pca.getAllAccounts()[0] || null;
      if (!self.account) {
        return self.pca.loginRedirect({ scopes: SCOPES }).then(function () { return new Promise(function () {}); });
      }
      self.userName = self.account.name || self.account.username || '';
      self.userEmail = String(self.account.username || '').toLowerCase();
      return self._resolveSite();
    });
  };

  SharePointStore.prototype._token = function () {
    var self = this;
    return this.pca.acquireTokenSilent({ scopes: SCOPES, account: this.account })
      .then(function (r) { return r.accessToken; })
      .catch(function (e) {
        if (e instanceof msal.InteractionRequiredAuthError) {
          return self.pca.acquireTokenRedirect({ scopes: SCOPES }).then(function () { return new Promise(function () {}); });
        }
        throw e;
      });
  };

  SharePointStore.prototype._graph = function (method, path, body, retry) {
    var self = this;
    return this._token().then(function (token) {
      return fetch(path.indexOf('http') === 0 ? path : GRAPH + path, {
        method: method,
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
    }).then(function (res) {
      if ((res.status === 429 || res.status === 503) && !retry) {
        var wait = (parseInt(res.headers.get('Retry-After'), 10) || 3) * 1000;
        return new Promise(function (r) { setTimeout(r, wait); }).then(function () { return self._graph(method, path, body, true); });
      }
      if (res.status === 204) return null;
      return res.json().then(function (j) {
        if (!res.ok) {
          var msg = (j && j.error && j.error.message) || ('HTTP ' + res.status);
          var err = new Error('SharePoint: ' + msg);
          err.status = res.status;
          throw err;
        }
        return j;
      });
    });
  };

  /* Website suchen. Stimmt der Host in config.js nicht (z.B. ristag.sharepoint.com statt des echten Namens),
     fragt die App Microsoft nach dem SharePoint-Namen der Firma und versucht es damit nochmals. */
  SharePointStore.prototype._findSite = function () {
    var self = this, site = String(this.cfg.site).trim();
    var path = site.indexOf(':') > 0 ? site.slice(site.indexOf(':') + 1) : '/sites/Monitoring';
    return this._graph('GET', '/sites/' + site + '?$select=id').catch(function (e) {
      if (!/hostname|not found|itemNotFound|invalidRequest/i.test(e.message || '')) throw e;
      return self._graph('GET', '/sites/root?$select=siteCollection,webUrl').then(function (root) {
        var host = root && root.siteCollection && root.siteCollection.hostname;
        if (!host) throw e;
        var real = host + ':' + path;
        if (real.toLowerCase() === site.toLowerCase()) {
          throw new Error('SharePoint-Website «' + path + '» wurde auf ' + host + ' nicht gefunden. In config.js bei «site» den Pfad der Website eintragen, z.B. ' + host + ':/sites/Monitoring (steht in der Adresszeile, wenn die Website offen ist).');
        }
        return self._graph('GET', '/sites/' + real + '?$select=id').then(function (s) {
          self.siteFix = real;
          if (window.M && M.toast) setTimeout(function () { M.toast('Hinweis: In config.js bei «site» bitte ' + real + ' eintragen (der SharePoint-Name der Firma ist ' + host + ').'); }, 2500);
          console.warn('MonInv: site in config.js korrigieren auf', real);
          return s;
        }, function () {
          throw new Error('Der SharePoint heisst ' + host + ', nicht wie in config.js angegeben. Dort bei «site» eintragen: ' + real + ' – und prüfen, ob die Website «' + path + '» existiert und ob Zugriff besteht.');
        });
      });
    });
  };

  SharePointStore.prototype._resolveSite = function () {
    var self = this;
    return this._findSite().then(function (s) {
      self.siteId = s.id;
      return self._graph('GET', '/sites/' + self.siteId + '/lists?$select=id,displayName&$top=999');
    }).then(function (r) {
      var byName = {};
      (r.value || []).forEach(function (l) { byName[l.displayName] = l.id; });
      var missing = [];
      COLLECTIONS.forEach(function (c) {
        var name = self.cfg.listenPrefix + c;
        if (byName[name]) self.lists[c] = byName[name]; else missing.push(c);
      });
      return missing.reduce(function (p, c) {
        return p.then(function () { return self._createList(c); });
      }, Promise.resolve());
    });
  };

  SharePointStore.prototype._createList = function (col) {
    var self = this;
    return this._graph('POST', '/sites/' + this.siteId + '/lists', {
      displayName: this.cfg.listenPrefix + col,
      columns: [{ name: 'Daten', text: { allowMultipleLines: true, textType: 'plain' } }],
      list: { template: 'genericList' }
    }).then(function (l) { self.lists[col] = l.id; });
  };

  SharePointStore.prototype._loadList = function (col) {
    var self = this, out = [], map = {};
    var url = '/sites/' + this.siteId + '/lists/' + this.lists[col] + '/items?$expand=fields($select=Title,Daten)&$top=999';
    function page(u) {
      return self._graph('GET', u).then(function (r) {
        (r.value || []).forEach(function (it) {
          var f = it.fields || {};
          try {
            var rec = JSON.parse(f.Daten || '{}');
            rec.id = rec.id || f.Title;
            if (rec.id) { out.push(rec); map[rec.id] = it.id; }
          } catch (e) { /* defekte Zeile überspringen */ }
        });
        if (r['@odata.nextLink']) return page(r['@odata.nextLink']);
      });
    }
    return page(url).then(function () { self.items[col] = map; return out; });
  };

  SharePointStore.prototype.load = function () {
    var self = this;
    return Promise.all(COLLECTIONS.map(function (c) { return self._loadList(c); })).then(function (res) {
      var d = emptyData();
      COLLECTIONS.forEach(function (c, i) { d[c] = res[i]; });
      self.data = d;
      return d;
    });
  };
  SharePointStore.prototype.refresh = SharePointStore.prototype.load;

  SharePointStore.prototype.save = function (col, rec) {
    var self = this;
    var itemId = this.items[col] && this.items[col][rec.id];
    var base = '/sites/' + this.siteId + '/lists/' + this.lists[col] + '/items';
    var fields = { Title: rec.id, Daten: JSON.stringify(rec) };
    if (itemId) return this._graph('PATCH', base + '/' + itemId + '/fields', fields);
    return this._graph('POST', base, { fields: fields }).then(function (it) {
      self.items[col] = self.items[col] || {};
      self.items[col][rec.id] = it.id;
    });
  };

  SharePointStore.prototype.remove = function (col, id) {
    var itemId = this.items[col] && this.items[col][id];
    if (!itemId) return Promise.resolve();
    var self = this;
    return this._graph('DELETE', '/sites/' + this.siteId + '/lists/' + this.lists[col] + '/items/' + itemId)
      .then(function () { delete self.items[col][id]; });
  };

  /* Import (z.B. Umzug vom Testbetrieb): schreibt alle Datensätze, bestehende werden überschrieben. */
  SharePointStore.prototype.replaceAll = function (data, onProgress) {
    var self = this, jobs = [];
    COLLECTIONS.forEach(function (c) { (data[c] || []).forEach(function (r) { jobs.push([c, r]); }); });
    var done = 0;
    return jobs.reduce(function (p, j) {
      return p.then(function () {
        return self.save(j[0], j[1]).then(function () { done++; if (onProgress) onProgress(done, jobs.length); });
      });
    }, Promise.resolve());
  };

  window.MonStore = {
    COLLECTIONS: COLLECTIONS,
    emptyData: emptyData,
    create: function (cfg) {
      if (cfg && cfg.modus === 'sharepoint') return new SharePointStore(cfg.sharepoint || {});
      return new LocalStore();
    }
  };
})();
