# MonInv – Monitoring-Inventar RISTAG

Web-App für das Inventar der Monitoring-Instrumente. Zentral ist die Karte (swisstopo) mit allen Geräten; nahe Geräte werden je nach Zoomstufe zu Kreisen zusammengefasst. Dazu kommen Inventarliste, Tachymeter & MCC TSC, Projekte mit Gerätehistorie und Einstellungen.

Die App braucht keinen Server und keine Installation: es sind statische Dateien (HTML, CSS, JavaScript). Kosten: 0 CHF.

---

## 1. Sofort ausprobieren (lokal, mit Beispieldaten)

1. ZIP entpacken.
2. `index.html` doppelklicken (Chrome oder Edge).
3. Die App startet im **Testbetrieb** mit Beispieldaten. Alles bleibt in diesem Browser auf diesem PC.

Unter **Einstellungen › Daten** lassen sich die Beispieldaten löschen, neu laden oder als Sicherung exportieren.

> Die Kartenkacheln kommen direkt von swisstopo (wmts.geo.admin.ch) – dafür braucht es Internet.

---

## 2. Für alle im Büro und auf dem Handy: online stellen

Empfohlen: **GitHub Pages** (gratis) für die App und **SharePoint-Listen** in eurem Microsoft 365 für die Daten. Login mit dem RISTAG-Konto.

### 2a. App hosten (GitHub Pages, ca. 10 Minuten)

1. Auf github.com ein Konto anlegen (falls nicht vorhanden) und ein neues Repository erstellen, z.B. `moninv`. Es darf privat sein, wenn ihr einen kostenpflichtigen GitHub-Plan habt; im Gratis-Plan muss es für Pages öffentlich sein. **Die App enthält keine Daten** – die liegen in SharePoint –, deshalb ist ein öffentliches Repository unkritisch.
2. Alle Dateien aus dem ZIP hochladen (ohne den Ordner `node_modules`, falls vorhanden).
3. Repository › **Settings › Pages** › Source: «Deploy from a branch», Branch `main`, Ordner `/ (root)` › Save.
4. Nach ein bis zwei Minuten läuft die App unter `https://<konto>.github.io/moninv/`.

Alternativ geht jeder Webspace, der statische Dateien ausliefert (auch Azure Static Web Apps, gratis).

### 2b. SharePoint als Datenspeicher anbinden (einmalig, ca. 15 Minuten)

**Schritt 1 – SharePoint-Website wählen**
Eine bestehende Website nehmen (z.B. die, wo heute die Einsatzplanung liegt) oder eine neue Team-Website «Monitoring» anlegen. Notieren: `ristag.sharepoint.com:/sites/Monitoring` (Format: Host, Doppelpunkt, Pfad).

**Schritt 2 – App im Microsoft Entra Admin Center registrieren**
1. https://entra.microsoft.com › **Identität › Anwendungen › App-Registrierungen › Neue Registrierung**
2. Name: `MonInv`
3. Unterstützte Kontotypen: **Nur Konten in diesem Organisationsverzeichnis**
4. Umleitungs-URI: Plattform **Single-Page-Anwendung (SPA)**, URL = die Adresse aus 2a, z.B. `https://<konto>.github.io/moninv/index.html` und zusätzlich `https://<konto>.github.io/moninv/`
5. Registrieren. Auf der Übersicht notieren: **Anwendungs-ID (Client)** und **Verzeichnis-ID (Mandant)**.
6. **API-Berechtigungen › Berechtigung hinzufügen › Microsoft Graph › Delegierte Berechtigungen**: `Sites.ReadWrite.All` und `Sites.Manage.All` hinzufügen.
7. Je nach Einstellung eures Tenants: **Administratorzustimmung für RISTAG erteilen** klicken.

Es entsteht kein Client-Geheimnis und keine Kosten. Die App handelt immer im Namen der angemeldeten Person und sieht nur, was diese Person in SharePoint sehen darf.

**Schritt 3 – `config.js` ausfüllen**

```js
window.MONINV_CONFIG = {
  modus: 'sharepoint',
  qrAdresse: 'https://<konto>.github.io/moninv/',   // Adresse für die QR-Etiketten
  sharepoint: {
    tenantId: '…Verzeichnis-ID…',
    clientId: '…Anwendungs-ID…',
    site: 'ristag.sharepoint.com:/sites/Monitoring',
    listenPrefix: 'MonInv_',
    aktualisierenSekunden: 60
  }
};
```

Datei im Repository ersetzen. Beim ersten Öffnen meldet man sich mit dem RISTAG-Konto an; die App legt die Listen `MonInv_geraete`, `MonInv_einsaetze`, `MonInv_projekte`, `MonInv_kategorien`, `MonInv_wartungen`, `MonInv_kabel`, `MonInv_dateien`, `MonInv_positionen`, `MonInv_einstellungen` selbst an.

**Schritt 4 – Daten übernehmen**
Wer im Testbetrieb schon echte Geräte erfasst hat: dort unter Einstellungen **Sicherung exportieren**, in der SharePoint-Version **Sicherung importieren**. Sonst in der Testversion zuerst «Alle Daten löschen und leer starten», damit keine Beispieldaten mitkommen.

**Auf dem Handy:** Adresse im Browser öffnen › Teilen › «Zum Home-Bildschirm». Die App öffnet dann wie eine normale App. «Position setzen › Mein Standort (GPS)» funktioniert, weil die Seite über https läuft.

**Bedienung auf dem Handy** (bis 760 px Breite, eigene Gestaltung in `css/mobile.css` und `js/mobile.js`; auf dem PC ändert sich nichts):
- **Karte:** oben «Filter» (Zahl = aktive Filter) und Kartenhintergrund, unten rechts «Alle zeigen», «Kabel» und «Gerät platzieren». Unten liegt ein **Blatt**: zugeklappt zeigt es die Übersicht bzw. das angetippte Gerät, am Griff antippen oder nach oben wischen öffnet es, nach unten wischen schliesst es (bei einem Gerät: Auswahl aufheben). Ein angetipptes Gerät bleibt über dem Blatt sichtbar. Zoomen mit zwei Fingern.
- **Platzieren und Kabel zeichnen:** Die Leiste mit LV95, GPS und Adresssuche steht unten, oben bleibt die Karte frei zum Tippen.
- **Inventar und Tachymeter:** Geräte als Karten statt breiter Tabelle (Name, Kategorie, Zustand, Standort, Projekt, Restwert bzw. MCC und Wartung). Suche immer sichtbar, übrige Filter unter «Filter». Ausgewählte Geräte: die Leiste mit den Aktionen bleibt oben stehen und lässt sich seitlich wischen. CSV-Import und Excel-Export gibt es auf dem Handy unter Einstellungen › Daten.
- **Projekte:** zuerst die Liste, ein Tipp öffnet das Projekt, «‹ Alle Projekte» (oder nochmals unten auf «Projekte») führt zurück. Breite Tabellen (Positionen, Abrechnung, Zeitachse) lassen sich seitlich wischen.
- **Dialoge und Gerätefenster** öffnen im Vollbild; die Knöpfe (Speichern, Abbrechen) stehen fest unten, die Aktionen im Gerätefenster in einer wischbaren Zeile.
- Eingabefelder haben 16 px Schrift, damit das iPhone beim Tippen nicht hineinzoomt; Notch und Home-Balken werden freigehalten.

---

### Anmeldung und Zugriff

Im SharePoint-Modus ist MonInv passwortgeschützt: Beim Öffnen meldet man sich mit dem eigenen Microsoft-365-Konto der RISTAG an (Passwort und, falls eingerichtet, Zwei-Faktor). Ohne Anmeldung lädt die App keine Daten. Wer was sehen und ändern darf, steuert die SharePoint-Website: Nur Mitglieder mit Bearbeitungsrecht können Geräte ändern; Personen ohne Zugriff auf die Website sehen nichts. Abmelden unter **Einstellungen › Datenquelle › Abmelden**. Wer die Website betrachten darf, regelt der Administrator in SharePoint; optional lässt sich die App in Entra ID auf eine Gruppe beschränken («Zuweisung erforderlich» bei der Unternehmensanwendung).

Der lokale Testmodus hat keine Anmeldung; die Daten liegen dort nur im eigenen Browser.

## 3. Bedienung in Kürze

**Standort und Projekt sind getrennt.** Der Standort sagt, wo ein Gerät genau ist (im Feld mit LV95-Position, oder in einem Magazin). Das Projekt ist eine separate, optionale Angabe für Abrechnung und Projekthistorie.

| Aufgabe | Wo |
|---|---|
| Gerät erfassen | **Inventar › + Instrument** (Tachymeter und MCC auch unter **Tachymeter & MCC**). Gerätetyp, Kategorie (aus der Liste oder **+ Neu**), dann **Standort** (Feld mit LV95, GPS oder Adresssuche – oder Magazin) mit **Amortisation** (CHF pro Monat oder pauschal) und separat das **Projekt**. |
| Gerät platzieren | Auf der Karte **+ Gerät platzieren**: vorhandenes Gerät wählen (gruppiert nach Magazin / Feld / ohne Standort), Projekt, Datum, Amortisation pro Monat oder pauschal, bei Tachymetern die MCC TSC. **Weiter: Ort wählen** und in die Karte tippen, GPS, LV95 oder Adresse. |
| Gleiche Geräte mehrfach | **Speichern & duplizieren …** oder **Duplizieren** im Gerätefenster, wenn es aus dem Inventar oder «Tachymeter & MCC» geöffnet wurde (im Kartenpanel nicht). Anzahl wählen und ankreuzen, welche Attribute übernommen werden. Namen zählen automatisch weiter (IN-03 → IN-04 …). |
| Projekt ändern | Detail › **Projekt ändern** (neuer Standort, Projekt, Amortisation pro Monat oder pauschal; vorausgefüllt mit dem letzten Feld-Standort), oder in der Liste mehrere markieren › **Projekt ändern …**. Hier wechselt man auch den Standort oder bringt Geräte ins Magazin. |
| Position mehrerer Geräte | **Inventar**: Geräte ankreuzen › **Position ändern …**. «Nacheinander»: jedes Gerät einzeln in die Karte tippen (oder GPS, LV95, Adresse), «Überspringen» lässt eines aus, der Zähler zeigt «2 von 5». «Alle an dieselbe Position»: ein Tipp setzt alle. Nur Geräte im Feld; Standort, Projekt und Amortisation bleiben gleich. |
| Messstelle (mehrere Geräte als ein Symbol) | **Inventar**: Geräte ankreuzen › **Zu Messstelle …** (neu oder zu einer bestehenden). Oder auf der Karte eine Zusammenfassung antippen, die am gleichen Ort steht › «Zu Messstelle zusammenfassen». Die Messstelle übernimmt Ort und Projekt, die Geräte stehen danach dort und erscheinen auf der Karte als **ein Symbol mit Zahl**. Projekt ändern, Position ändern, Ins Magazin und Kabel gehen über die Messstelle; die Geräte wechseln mit (jedes mit eigenem Eintrag in der Historie). Jedes Gerät bleibt einzeln im Inventar mit Wert, Historie, Amortisation und Wartung. **Herauslösen** (× in der Liste) oder ein Gerät einzeln verschieben nimmt es aus der Messstelle. **Messstelle auflösen** lässt alle Geräte, wo sie sind. Im Gerätefenster: Reiter Messstelle (Geräteliste), Historie, Amortisation (Summen und Tabelle je Gerät). In der Projektansicht erscheint die Messstelle als eine Kachel. Im **Inventar** steht nur die Messstelle als eine Zeile (Wert und Restwert als Summe, Hersteller, Kaufdaten, Anzahl SIM); mit ▸ klappt man ihre Geräte auf. Die Suche findet auch einzelne Geräte darin und klappt die Messstelle automatisch auf. Der Excel-Export enthält weiterhin jedes Gerät einzeln. |
| Gleicher Ort ohne Messstelle | Liegen Geräte praktisch am selben Ort (unter 4 m), zeigt ein Klick auf das Zahlen-Symbol eine Liste statt einer Spirale. |
| Amortisation für mehrere | Bei «Projekt ändern» für mehrere Geräte oder eine Messstelle: Betrag **je Gerät** oder **Total für alle** (wird gleichmässig verteilt). Darunter steht die Rechnung, z.B. «CHF 1'000 ÷ 4 = CHF 250 je Gerät». Leer lassen = jedes Gerät behält seinen Ansatz. |
| Auftragsnummer (Teilprojekt) | Pro Einsatz: bei **Erfassen**, **Projekt ändern**, **Gerät platzieren** und **Einsatz bearbeiten** (✎ in der Historie) das Feld «Auftragsnummer / Teilprojekt»; bereits verwendete Nummern werden vorgeschlagen. Für mehrere Geräte: **Inventar** › ankreuzen › **Auftragsnr. …** (gilt für den laufenden Einsatz, kein neuer Historien-Eintrag; bei einer Messstelle für alle ihre Geräte). Bleibt das Projekt gleich, wird die Nummer beim Verschieben übernommen. Sichtbar im Kartenpanel, im Inventar (unter dem Projekt), in der Historie, in der Abrechnung und im Excel-Export (Spalte «Auftrag»; auch per CSV-Import setzbar). |
| Geplante Laufzeit (optional) | Pro Gerät und Projekt beim Platzieren, Erfassen, «Projekt ändern» oder im Einsatz (Historie ✎): **Geplante Laufzeit** als **Monate** (ab Einsatzbeginn) oder **bis Datum**. Für laufende Geräte: Gerätefenster › Laufzeit «planen»/«ändern» oder im Inventar mehrere ankreuzen › **Laufzeit …** (Monate zählen ab dem Montagedatum jedes Geräts; ein Tachymeter nimmt seine MCC mit). Leer lassen = nicht geplant, nichts wird gemahnt. Anzeige: im Gerät «geplant bis … · noch … Monate» bzw. «… Tage überfällig», im Inventar das Etikett «bis 04.27» (orange = endet in 30 Tagen, rot = überfällig), in der Abrechnung «geplant bis …», im Projekt-Zeitstrahl gestrichelt bis zum Planende (rot = länger als geplant). |
| Offertpositionen | **Projekte** › Projekt › **Offerte & Positionen** › **+ Position**: Nummer und Text wie in der Offerte, Auftrag (Teilprojekt), **Gruppe** (Geodätisch · Geotechnisch · Sensor), **Preisart** und der Preis pro Einheit und Monat für **Vorhalten** (fliesst voll in die Amortisation), **Betrieb** (Lizenz Datenplattform, SIM) und **Wartung** (Unterhalt; zusätzlich «Wartung einmalig» möglich). Optional unsere Kosten für Betrieb und Wartung pro Monat (zeigt die Marge) und **Offeriert: Monate total** (Einheiten × Monate laut Offerte). In der Positionsliste steht dann «Monate: verrechnet · geplant · Offerte» mit Balken und Hinweis «im Rahmen», «Plan über Offerte» oder «Offerte überschritten». «+» bei geplant = laufende Einheiten ohne Planung, bis heute gezählt. **Set-Preis**: mehrere Geräte zusammen ein Preis (z.B. Gateway + 5 Nodes); **Stückpreis**: jedes Gerät einzeln. Ein Tachymeter bildet mit seiner MCC immer eine Einheit. Der Richtwert «Vorhalten = Anschaffungswert ÷ 36 Monate» hilft beim Prüfen der Offerte. |
| Geräte einer Position zuordnen | Im Positionsfenster unter **Geräte im Projekt** ankreuzen (bei Set-Preis: in ein neues oder bestehendes Set) – gilt ab Beginn des laufenden Einsatzes, ohne neuen Eintrag in der Historie. Oder direkt beim Platzieren, Erfassen und bei «Projekt ändern»: nach dem Projekt die **Offertposition** wählen (und bei Set-Preis das Set). Mehrere Geräte zusammen verschieben + «Neues Set aus diesen n Geräten» = ein Set. Ohne Position gilt wie bisher der Betrag unter «Amortisation» (Einzelansatz). |
| Abrechnung pro Projekt | **Projekte** › Projekt › **Abrechnung nach Position und Gerät**: Zeitraum mit «Von/Bis» (vorgewählt: die letzten 6 ganzen Monate) oder schnell «Letzter Monat», «3 Monate», «Dieses Jahr», «Ganzes Projekt». Eine Tabelle, gegliedert nach Geodätisch / Geotechnisch / Sensor: je **Position** eine Zeile mit Ansatz und Summe der Beträge und darunter **jedes Gerät bzw. Set** (in Klammern Montagedatum und, falls schon abgebaut, Abbaudatum) mit den abgerechneten Monaten (1 = abgerechnet), Anzahl Monate, **Ansatz pro Monat** für Vorhalten, Betrieb und Wartung und den Beträgen (Ansatz × Monate). Dazu Totale je Gruppe und fürs Projekt. Geräte ohne Position erscheinen nicht. **Abrechnung als PDF** öffnet die Tabelle als gestaltetes PDF (A4 quer, RISTAG-Logo, Seitenzahlen, Zusammenfassung je Gruppe) in einem neuen Tab. **Excel** liefert dieselbe Tabelle (Position, Gerät, Monate, Ansätze, Beträge, Totale). |
| Pläne und Skizzen pro Gerät | Gerätefenster › Reiter **Pläne & Dateien**: Bilder oder PDF hineinziehen oder «auswählen» (mehrere auf einmal, bis 50 MB je Datei). Art wählbar: Messplan, Fixpunktplan, Skizze, Foto, Kalibrierung/Zertifikat, Anderes. Im **Kartenpanel** stehen die Pläne direkt unter den Angaben («+ hochladen» geht auch dort, auf dem Handy auch mit der Kamera). Antippen öffnet den Betrachter: Bilder gross (antippen = zoomen), PDF direkt, «In neuem Tab» und «Herunterladen». Geht auch für Messstellen. |
| Offerte im Projekt | **Projekte** › Projekt › **Dokumente**: Offerte (PDF) und weitere Dokumente (Plan, Auftrag/Vertrag, Bericht) ablegen und ansehen wie bei den Geräteplänen. |
| QR-Etiketten drucken | **Inventar** › Geräte ankreuzen › **Etiketten …**, oder im Gerätefenster **Etikett**. Format wählen: **L4773** (63,5 × 33,9 mm, 24 pro Bogen) oder **L4778** (45,7 × 21,2 mm, 48 pro Bogen, für kleine Sensoren). Auf dem Bogen das **erste freie Feld** antippen, damit angebrochene Bogen weiter gebraucht werden; Etiketten pro Gerät wählbar; bei einer Messstelle wahlweise auch für alle Geräte darin. **PDF erstellen** öffnet das fertige PDF in einem neuen Tab zum Drucken oder Herunterladen. Auf dem Etikett: QR-Code, RISTAG-Logo, Gerätename, schmaler blauer Streifen. Die MCC TSC bekommt ein eigenes Etikett (sie steht nicht auf dem Tachymeter-Etikett, weil sie wechseln kann). |
| Richtig drucken | Im Druckdialog **Tatsächliche Grösse / 100 %** und Papierart **Etiketten** wählen, Bogen wenn möglich über den Einzelblatteinzug. Einmalig: **Einstellungen › QR-Etiketten › Testseite** auf Normalpapier drucken und gegen einen Etikettenbogen ans Licht halten; weicht der Druck ab, **Versatz** in mm eintragen (gilt dann für alle). «Umrisse mitdrucken» hilft beim Probedruck. |
| Scannen | **Scannen** oben rechts (auf dem Handy das QR-Symbol): Kamera auf das Etikett richten. **Gerät öffnen** springt direkt zum Gerät auf der Karte (Gerät ohne Standort: Gerätefenster; eine MCC im Feld zeigt ihren Tachymeter). **Mehrere sammeln** (auch im Inventar: «Scannen»): Geräte nacheinander scannen, dann gemeinsam **Ins Magazin …**, **Projekt ändern …**, im Inventar auswählen oder Etiketten drucken. Ohne Kamera: Code oder Gerätename eintippen. Die normale Handykamera geht auch – der QR-Code ist ein Link, der MonInv beim Gerät öffnet (vorher ggf. Microsoft-Anmeldung). |
| Position korrigieren | Detail › **Position ändern** › in die Karte tippen, LV95 eingeben, Adresse suchen oder GPS. Das ist eine Korrektur am aktuellen Standort, kein neuer Standort. |
| Kabelführung | Standard ist **Stromkabel** (hellorange); Signal, Glasfaser und Andere sind gestrichelt. Detail › **Kabel zeichnen** (startet beim Gerät) oder auf der Karte **+ Kabel**. Punkte entlang der Führung antippen; ein Gerät antippen verbindet das Kabel damit; **Fertig**. Kabel antippen zeigt Länge, Art, Verbindung; dort bearbeiten, neu zeichnen oder löschen. |
| Gerät ansehen | **Karte**: Symbol antippen zeigt das Nötigste (Zustand, Standort, Projekt, Aktionen, Wartung, MCC, Position, Kabel). **Alle Details** öffnet das Gerätefenster. **Inventar / Tachymeter & MCC**: Name anklicken öffnet direkt das grosse Gerätefenster mit den Reitern **Gerät** (alle Angaben), **Historie** (Register aller Standorte, Wartungen, Erfassung und Kauf mit Dauer, Projekt, Ansatz, LV95, wer gesetzt/geholt hat) und **Amortisation**. |
| Historie | Reiter **Historie** im Gerätefenster; ✎ korrigiert einen Eintrag. Pro Projekt unter **Projekte**: welches Gerät war wann da, Gerätetage, Amortisation. |
| Wartung | Detail oder **Tachymeter & MCC › Wartung**. Setzt den Zähler auf 0. |
| MCC | Gehört zum Tachymeter: Zuordnung im Tachymeter-Detail («MCC TSC › Zuordnen/Wechseln») oder in **Tachymeter & MCC**. **Jeder Tachymeter im Feld braucht eine MCC** – beim Erfassen, Platzieren, Projekt ändern und Bearbeiten wird das geprüft; fehlt sie, zeigt die App «MCC fehlt». Eine zugeordnete MCC erscheint nicht separat auf der Karte (Label «TS-07 + MCC 1207» mit den letzten 4 Ziffern des MCC-Namens) und wechselt den Standort mit ihrem Tachymeter. Kommt der Tachymeter ins Magazin, wird die MCC frei. Die MCC führt zusätzlich ein **WLAN-Passwort** (im Detail verdeckt, «Zeigen» / «Kopieren»). |
| Löschen | Detail › **Löschen**, in der Liste mehrere markieren › **Löschen …**, Kabel im Kabel-Detail, Projekte und Magazine unter **Projekte › Bearbeiten**. Für Geräte, die nur nicht mehr gebraucht werden, besser Zustand «ausgemustert» – dann bleibt die Historie. |
| Excel | **Inventar › Excel-Export** (gefilterte Liste) oder **Einstellungen › Daten** (Geräte, Historie, Kabel). |
| CSV-Import | **Inventar › CSV-Import** oder **Einstellungen › Daten › Geräte aus CSV importieren**. Gleiches Format wie der Excel-Export (Vorlage: **CSV-Vorlage** oder einfach einen Export nehmen), Trennzeichen Semikolon oder Komma, UTF-8 oder Windows-Excel. Abgleich über den **Namen** (sonst Seriennummer): unbekannte Namen werden neu angelegt, bekannte aktualisiert; leere Zellen ändern nichts; berechnete Spalten (Restwert, Amortisiert total, Standorte, Tage seit Wartung, Kabel) werden ignoriert. Neue Geräte erhalten Standort (Magazinname oder Feld mit Ost/Nord LV95), Projekt (wird bei Bedarf angelegt), «Seit» und den Ansatz aus «Amortisation aktueller Standort» (z.B. «CHF 300 pro Monat» oder «CHF 2000 pauschal»). Tachymeter und MCC werden über «MCC / Tachymeter» verbunden. Optional gibt es die Spalte **WLAN-Passwort** (nur MCC; im Export bewusst nicht enthalten). Lange Nummern wie SIM-Karten schreibt der Export als ="8941…", damit Excel sie nicht in 8.94E+19 verwandelt; solche verkürzten Werte erkennt der Import und übernimmt sie nicht. Vor dem Import zeigt eine Vorschau Neue / Aktualisiert / Fehler; abweichende Standorte bestehender Geräte werden nur auf Wunsch als Projektwechsel übernommen. |

### Rechenregeln
- **Teilmonate**: pro Kalendermonat gilt: **mehr als 10 Tage in Betrieb = ganzer Monat**, 10 Tage oder weniger = nichts. Gilt für Positionen und für Monatsbeträge ohne Position. Ein Set läuft, solange eines seiner Geräte im Projekt steht (Tage aller Geräte zusammen, ohne Doppelzählung). Der laufende Monat zählt deshalb erst ab dem 11. Tag. Die Grenze steht in `js/core.js` (`M.MIN_TAGE = 10`).
- **Offertposition**: Vorhalten × Monatsanteil wird verrechnet und fliesst in die Amortisation; im Set nach Anschaffungswert auf die Geräte verteilt (Gateway CHF 3'000 + 5 Nodes à CHF 900 → Gateway 40 %, jeder Node 12 %). Betrieb und Wartung werden pro Einheit verrechnet und nicht auf Geräte verteilt. Wartung einmalig: im Monat, in dem die Einheit startet.
- **Amortisation ohne Position** (Einzelansatz): pro Standort frei wählbar als **CHF pro Monat** (läuft, solange das Gerät dort steht, Teilmonate wie oben) oder **pauschal** (einmal). Geräte ohne Position erscheinen nicht in der Abrechnung – sie zeigt nur, was dem Auftraggeber laut Offertpositionen verrechnet wird. Bei «Projekt ändern» wird der Wert des letzten Feld-Standorts vorgeschlagen. Im Magazin wird nichts gebucht. Korrektur in der Historie (✎).
- **Startwert**: Geräte, die schon vor MonInv im Einsatz waren, bekommen unter **Bearbeiten** «Bereits amortisiert vor Erfassung» (CHF) und «Stand per» (Datum). Der Betrag zählt voll zur Amortisation, aber zu keinem Projekt; Standorte vor diesem Datum amortisieren nichts mehr (das steckt im Startwert) – das gilt nur, wenn ein Startwert über CHF 0 erfasst ist. Ohne Startwert zählt jeder Ansatz voll.
- **Amortisiert** = Startwert + Summe aller Standorte bis heute.
- **Restwert** = Anschaffungswert − Amortisiert (nie unter 0). Ist der Anschaffungswert erreicht, gilt das Gerät als **abbezahlt** (Datum wird berechnet); alles darüber ist **Ertrag über Anschaffung**.
- **Prognose abbezahlt**: noch offener Betrag ÷ laufender Monatsansatz – nur wenn der aktuelle Standort pro Monat abrechnet.
- **Reiter Amortisation**: Aussage (noch offen / abbezahlt), Kennzahlen, Balken «Weg zum Anschaffungswert» (Startwert schraffiert, Standorte blau, Ertrag grün), Verlauf über die Zeit (Magazin grau hinterlegt, Pauschalbeträge als Sprung, Prognose gestrichelt, Maus zeigt Datum und Stand) und Tabelle «Beiträge je Standort» mit der Zeile, in der das Gerät abbezahlt wurde.
- **Verrechnet bis heute** (Projekt) = Summe aller Offertpositionen seit Projektbeginn (Vorhalten + Betrieb + Wartung).
- **In Betrieb seit letzter Wartung** = Tage im Feld seit der letzten Wartung. Magazin-Tage zählen nicht.
- **Wartung fällig** ab 90 % des Intervalls (einstellbar). Standard Tachymeter: 24 Monate. Pro Gerät übersteuerbar.
- **Ortsname** (Gemeinde) wird aus der Position über den freien swisstopo-Dienst ermittelt; ohne Internet steht die LV95-Koordinate.
- **Kabellänge** = Länge der gezeichneten Linie auf der Karte, optional plus Reserve.
- **LV95** wird mit den Näherungsformeln von swisstopo umgerechnet (ca. 1 m genau) – genügt für den Gerätestandort.

---

## 4. Erweitern

**Versionsnummer:** steht oben rechts und unter Einstellungen (aktuell **0.5.1**). Bei einer neuen Version die Nummer in `js/core.js` (`M.VERSION`) und in `index.html` (alle `?v=0.5.1`) ersetzen – das zweite sorgt dafür, dass Browser und Handys sofort die neuen Dateien laden statt alte aus dem Zwischenspeicher. Zusätzlich die Nummer in `version.txt` eintragen: Offene Apps merken dann innerhalb von 10 Minuten, dass eine neue Version aufgeschaltet ist, und zeigen «Jetzt neu laden».


**Neue Attribute ohne Programmieren:** Einstellungen › Kategorien › Kategorie öffnen › **Zusatzfelder** (Text, Zahl, Datum). Die Felder erscheinen sofort in der Maske, im Detail und im Excel-Export.

**Neue Kategorie mit Symbol:** Einstellungen › **+ Kategorie** › Gruppe (bestimmt Form und Farbe), Piktogramm, Kürzel.

**Neues Piktogramm:** in `js/symbols.js` unter `PIKTOGRAMME` einen Eintrag mit SVG-Pfaden (Raster 24 × 24) ergänzen.

**Neue Funktionen** (z.B. Fotos, QR-Etiketten, Kalibrierscheine, Messdaten-Link): Code in `js/`. Die Daten sind so gespeichert, dass neue Felder keine Änderung an SharePoint brauchen – jeder Datensatz liegt als JSON in der Spalte «Daten».

### Dateien
```
index.html          Gerüst der App
config.js           Datenquelle (lokal / SharePoint)
css/app.css         Gestaltung (RISTAG-Farben, Exo 2)
css/mobile.css      Handy-Darstellung (bis 760 px)
js/symbols.js       Gruppen, Farben, Piktogramme
js/store.js         Speicher: Browser oder SharePoint (Microsoft Graph)
js/import.js        CSV-Import der Geräte
js/labels.js        QR-Etiketten (PDF L4773/L4778), Scannen, Link #g=…
assets/             RISTAG-Logo für die Etiketten (etikett-logo.js, logo-ristag.svg)
js/core.js          Berechnungen (Restwert, Wartung, Standort), Projektwechsel, Duplizieren
js/map.js           Karte, swisstopo-Ebenen, Zusammenfassen
js/views.js         Ansichten (Karte, Inventar, Tachymeter, Projekte, Einstellungen)
js/forms.js         Masken
js/app.js           Start, Navigation, Export/Import
js/mobile.js        Handy: Kartenblatt (Tippen/Wischen), Kartenränder, Tastatur
js/beispiel.js      Beispieldaten für den Testbetrieb
vendor/             Leaflet 1.9.4, Leaflet.markercluster 1.5.3, MSAL Browser 2.39.0,
                    jsPDF 2.5.1, qrcode-generator 1.4.4, jsQR 1.4.0, Schrift Exo 2 ExtraBold (fonts/)
```

### Datenmodell
- **geraete**: name, qr (kurzer Code für das QR-Etikett, wird beim ersten Druck vergeben), typ (sensor · tachymeter · mcc), kategorieId, gtyp, hersteller, seriennummer, kaufdatum, wert (Anschaffungswert), amortVor (Startwert CHF), amortVorDatum (Stand per), sim, wlanPasswort (MCC), mccId, letzteWartung, wartungIntervall, zustand, bemerkung, extra {Zusatzfelder}
- **geraete** (Messstelle): typ «messstelle», name, bemerkung; die Geräte verweisen mit gruppeId auf ihre Messstelle.
- **dateien**: ziel (geraet · projekt), zielId, name, mime, groesse, art, datum, wer, ref (Speicherort), thumb (kleines Vorschaubild).
- **positionen**: projektId, nr, text, gruppe (geo · erf · sen), auftrag, art (set · stk), V, B, W (CHF pro Einheit und Monat: Vorhalten, Betrieb, Wartung), Wp (Wartung einmalig), kB, kW (unsere Kosten pro Monat), offMonate (offerierte Monate total), bemerkung
- **einsaetze**: geraetId, ort (feld · magazin), magazinId, projektId (optional), lat/lng, ortName, von, bis (leer = laufend), gesetztVon, geholtVon, amortModus (monat · pauschal · position), amortBetrag, planBis / planMonate (geplante Laufzeit), auftrag (Auftragsnummer / Teilprojekt), positionId (Offertposition), einheit (Schlüssel des Sets; gleiche Einheit = ein Preis). Ältere Daten mit amortGebucht werden beim Laden als «pauschal» übernommen.
- **kabel**: name, typ (signal · glas · strom · andere), punkte [[lat, lng] …], zuId, vonId, projektId, datum, reserve, bemerkung
- **projekte**: nummer, name, typ (projekt · magazin), status, lat/lng
- **kategorien**: name, typ, gruppe, piktogramm, kuerzel, felder [{name, typ}]
- **wartungen**: geraetId, datum, art, firma, kosten, bemerkung
- **einstellungen**: intervall {tachymeter, mcc, sensor}, warnProzent, etikett {dx, dy} (Druckversatz in mm)

### Grenzen
- **QR-Etiketten:** Der Code im Etikett ist pro Gerät fest (z.B. `K4T9W2`); ein neu gedrucktes Etikett hat denselben Code. Der Link enthält die Adresse aus `qrAdresse` in config.js (leer = die Adresse, unter der die App läuft). Darum Etiketten erst drucken, wenn die App unter ihrer endgültigen Adresse läuft – im lokalen Test zeigt der Dialog eine Warnung. Scannen mit der Kamera braucht https (GitHub Pages) oder localhost. Logo ersetzen: `assets/etikett-logo.js` (PNG als Base64).
- **Dateien:** Im SharePoint-Modus liegen Pläne und Offerten in der Dokumentbibliothek der Website im Ordner «MonInv-Dateien» (anderer Ordner: `dateienOrdner` in config.js); es braucht keine weitere Berechtigung. Im lokalen Testmodus liegen sie nur im Browser, in dem sie hochgeladen wurden. Die JSON-Sicherung enthält die Dateien nicht, nur ihre Einträge.
- **Bewegung:** Fenster, Panel, Reiter und Grafiken erscheinen mit kurzen Übergängen; wer im Betriebssystem «Bewegung reduzieren» eingestellt hat, bekommt sie ohne Animation.
- WLAN-Passwörter der MCC sind in der App verdeckt, liegen aber im Klartext in der SharePoint-Liste und in der Sicherungsdatei. Wer die Liste lesen darf, sieht sie. Nicht im Excel-Export enthalten.
- Daten aus der ersten Version (Projekt = Standort) werden beim Laden automatisch übernommen: Magazin-Einsätze bleiben Magazin, alle anderen werden «Feld» mit dem bisherigen Projekt.
- Gleichzeitiges Bearbeiten desselben Geräts: wer zuletzt speichert, gewinnt. Die anderen sehen die Änderung nach spätestens einer Minute.
- SharePoint-Listen tragen problemlos einige Tausend Geräte und Einsätze. Darüber würde man auf eine Datenbank umziehen; die Datenstruktur bleibt gleich.

Kartendaten © swisstopo · Leaflet (BSD-2) · Leaflet.markercluster (MIT) · MSAL (MIT)
