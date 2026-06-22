Endivio Outlook Mail Helper

Use this on each Windows PC that needs automatic email sending from Repair Records.

Files needed in the same folder:
- Start-EndivioOutlookHelper.bat
- Install-StartupShortcut.bat
- EndivioOutlookHelper.ps1
- EndivioOutlookHelper.config.json

Steps:
1. Make sure Outlook is installed and signed in.
2. Open EndivioOutlookHelper.config.json and replace https://YOUR-ENDIVIO-APP-DOMAIN with the actual Endivio website URL.
3. Double-click Start-EndivioOutlookHelper.bat.
4. Keep the helper window open while using Register Device or Unregister Device.

Optional:
- Double-click Install-StartupShortcut.bat to start the helper automatically when Windows signs in.

When the helper is running, Endivio sends email automatically through the local Outlook profile.
When the helper is not running, Endivio falls back to opening an editable Outlook email draft.

The helper accepts requests only from configured AllowedOrigins and requires the configured Token header.
Send/failure logs are written to the LogPath configured in EndivioOutlookHelper.config.json.
