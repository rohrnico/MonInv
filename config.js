/* MonInv – Einstellungen
   ------------------------------------------------------------
   modus: 'lokal'      → Daten nur in diesem Browser (zum Testen, mit Beispieldaten)
          'sharepoint' → Daten in SharePoint-Listen, alle sehen dasselbe (Login mit RISTAG-Konto)

   Für 'sharepoint' einmalig eine App im Microsoft Entra Admin Center registrieren
   (Anleitung in ANLEITUNG.md) und hier eintragen:                                  */

window.MONINV_CONFIG = {
  modus: 'sharepoint',
  // Admins (immer alle Rechte, auch Benutzer und Rollen). Weitere Rollen vergibt ein Admin unter Einstellungen › Benutzer und Rollen.
  admins: ['n.rohr@ristag.ch'],
  qrAdresse: 'https://rohrnico.github.io/MonInv/',
  sharepoint: {
    tenantId: '021f91fa-e689-4c95-8480-d96da66cc2e1',
    clientId: '852bfd59-2109-472c-8283-635735a4f242',
    site: 'ristaging.sharepoint.com:/sites/Monitoring',
    listenPrefix: 'MonInv_',
    aktualisierenSekunden: 60
  }
};
