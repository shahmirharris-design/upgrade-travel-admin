# Upgrade Travel Admin

Desktop admin app (customers, quotes, invoices, itineraries, packages) for Upgrade Travel.
Built on Electron + Supabase.

## For the person using it (Windows)
Download the latest **Setup .exe** from the [Releases](../../releases) page and run it.
Windows may warn "unrecognized app" the first time — click **More info → Run anyway**.
After that, the app **updates itself automatically** whenever a new version is released.

## Releasing a new version (for the developer)
1. Refresh the bundled customer-preview files if the website theme changed: `npm run sync-bv`
2. Bump the version in `package.json` (e.g. 1.0.0 → 1.0.1) and commit.
3. Tag and push:
   ```
   git tag v1.0.1
   git push origin main --tags
   ```
4. GitHub Actions builds the Windows + Mac installers and publishes them to Releases.
   Everyone on Windows auto-updates on their next launch.

## Local run (Mac dev)
`npm install` then `npm start`.
