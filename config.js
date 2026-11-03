/* MonInv – Einstellungen
   ------------------------------------------------------------
   modus: 'lokal'      → Daten nur in diesem Browser (zum Testen, mit Beispieldaten)
          'sharepoint' → Daten in SharePoint-Listen, alle sehen dasselbe (Login mit RISTAG-Konto)

   Für 'sharepoint' einmalig eine App im Microsoft Entra Admin Center registrieren
   (Anleitung in ANLEITUNG.md) und hier eintragen:                                  */

window.MONINV_CONFIG = {
  modus: 'lokal',
  // Adresse der App für die QR-Etiketten, z.B. 'https://ristag.github.io/moninv/'. Leer = die Adresse, unter der die App gerade läuft.
  qrAdresse: '',

  sharepoint: {
    tenantId: '',            // Verzeichnis-ID (Mandant), z.B. '0a1b2c3d-…'
    clientId: '',            // Anwendungs-ID (Client) der registrierten App
    site: '',                // z.B. 'ristag.sharepoint.com:/sites/Monitoring'
    listenPrefix: 'MonInv_', // Präfix der SharePoint-Listen, die die App anlegt
    aktualisierenSekunden: 60
  }
};
