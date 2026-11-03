/* MonInv – Einstellungen
   ------------------------------------------------------------
   modus: 'lokal'      → Daten nur in diesem Browser (zum Testen, mit Beispieldaten)
          'sharepoint' → Daten in SharePoint-Listen, alle sehen dasselbe (Login mit RISTAG-Konto)

   Für 'sharepoint' einmalig eine App im Microsoft Entra Admin Center registrieren
   (Anleitung in ANLEITUNG.md) und hier eintragen:                                  */

window.MONINV_CONFIG = {
  modus: 'sharepoint',
  qrAdresse: 'https://rohrnico.github.io/MonInv/',
  sharepoint: {
    tenantId: 'Verzeichnis-ID',
    clientId: 'Anwendungs-ID',
    site: 'ristag.sharepoint.com:/sites/Monitoring',
    listenPrefix: 'MonInv_',
    aktualisierenSekunden: 60
  }
};
