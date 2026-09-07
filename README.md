# OffgridDoc

OffgridDoc is an offline-first PDF workspace for Windows. Documents are processed in the local browser runtime and are not sent to a web service.

## Download for Windows

Open the repository's **Releases** page and download the latest `OffgridDoc-Setup-*.exe`. Run the installer, then launch OffgridDoc from the Start menu or desktop shortcut.

The installer is produced by GitHub Actions when a version tag such as `v1.0.0` is pushed.

## Build locally

Requires Node.js 22 or newer.

```powershell
npm ci
npm run dist
```

The Windows installer is written to `artifacts/`.

For browser development:

```powershell
npm run dev
```

## Offline security

- The renderer runs with `nodeIntegration: false`, `contextIsolation`, and Chromium sandboxing enabled.
- New windows, navigation, webviews, permission requests, and network requests are blocked by the Electron shell.
- The app's Content Security Policy sets `connect-src 'none'` and permits only local resources.
- No analytics, telemetry, remote fonts, upload endpoint, or account system is included.
- Working files remain in memory until the app is closed or the queue is cleared.

## Current local operations

PDF merge, split, reorder, rotate, crop, page numbering, structural compression, and JPG/PNG-to-PDF conversion are supported in the browser runtime.

Office conversion, OCR, encryption, signatures, AI summarization, translation, and visual comparison require additional bundled engines or models. They are intentionally reported as unavailable rather than sending documents online.

## Release checklist

1. Update `version` in `package.json`.
2. Commit and push the change.
3. Create and push a tag: `git tag v1.0.0; git push origin v1.0.0`.
4. Download the generated installer from the GitHub Release and test it on a clean Windows machine.
