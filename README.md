# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Outlook mail helper

Repair Records > Register Device and Unregister Device can send email through the local desktop Outlook app. Each Windows PC that uses automatic sending must keep the helper running.

For deployed users, download these files from the app and place them in the same folder:

- `/outlook-helper/Start-EndivioOutlookHelper.bat`
- `/outlook-helper/Install-StartupShortcut.bat`
- `/outlook-helper/EndivioOutlookHelper.ps1`
- `/outlook-helper/EndivioOutlookHelper.config.json`
- `/outlook-helper/README.txt`

Before first use, edit `EndivioOutlookHelper.config.json` and replace `https://YOUR-ENDIVIO-APP-DOMAIN` with the deployed Endivio URL. Double-click `Start-EndivioOutlookHelper.bat`. The helper listens on `http://127.0.0.1:57991`, accepts only configured origins with the shared helper token, logs attempts to `%LOCALAPPDATA%\Endivio\OutlookHelper\mail-helper.log`, and uses Outlook COM to send through the currently configured Outlook profile. Keep Outlook signed in before sending. Developers can still run `npm run outlook-helper` from the project folder.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
