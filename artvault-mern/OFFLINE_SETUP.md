# ArtVault offline copy (Windows)

This is a **trusted-computer local copy** of ArtVault. Gallery, artists, exhibits, and public artwork images come from local MongoDB, so they remain available without internet. The **Offline drafts & sync** page lets you save title, description, category, and material drafts for public artworks in this browser on this computer. It does not edit the local snapshot or Atlas immediately. Sign-in, upload, likes, private Vault editing, admin changes, and email are not available while disconnected.

## Before starting

- MongoDB Server must be installed and its Windows service running on `127.0.0.1:27017`.
- Keep a recent `mongodump` archive or dump folder outside the Git repository. This backup contains private user and artwork data; do not upload it to GitHub or share it.
- Node dependencies must be installed in both `server` and `client` (`npm install` in each if needed).
- The offline copy uses ports 5500 (API) and 5174 (browser), separate from the normal local site.

## 1. Restore a backup into the separate local database

The October 12 backup is **already restored** on this computer into `artvault_offline` (161 documents). It remains available as an older fallback. Do not repeat this step for daily use. To restore a backup on a new computer, open PowerShell in the `artvault-mern` folder and run:

```powershell
node scripts/restore-offline.js "C:\Users\gaspe\Documents\ArtVaultBackups\artvault-20261012-131251.archive.gz"
```

For a compressed archive, use the `.gz` path. For a folder dump, pass the dump directory that contains an `artvault` subfolder (or pass the `artvault` subfolder itself).

The script checks the backup, maps `artvault.*` collections to `artvault_offline.*`, and restores only to local MongoDB. It **does not use `--drop`** and refuses to run if `artvault_offline` already contains documents. Empty collections are safe. It never restores into Atlas. If the backup is old, the offline copy will show data only up to that backup date.

MongoDB warned that this backup came from server 8.0.34 while the installed local server is 8.3.11. Basic gallery, exhibit, and image reads passed, but cross-version restores are not guaranteed by MongoDB; keep the original archive safe and do not treat this local copy as your only backup.

### Refresh from current Atlas data before going offline

When you have internet, stop the offline launcher and run:

```powershell
node scripts/refresh-offline.js
```

This reads the `artvault` database from the `MONGO_URI` in `server/.env` and copies its collections into a **new** local MongoDB database. It does not write to Atlas, drop the old offline database, or erase browser drafts. A local `.offline-state.json` pointer chooses the new snapshot on the next launcher start; this pointer is Git-ignored and contains no secrets. Do not share or commit database dumps because they include private account and artwork information.

The October 17 refresh created `artvault_offline_20261017134206_0809e9` with 9 collections (25 artworks, 21 artists, 4 exhibits). The October 12 `artvault_offline` database remains intact. Future refreshes create separate databases; old copies can consume disk space and should be reviewed before any manual removal.

## 2. Start ArtVault without internet

In PowerShell, go to the project folder, then start the local copy:

```powershell
cd "C:\Users\gaspe\OneDrive\Desktop\gaspel joy\VsCode\ArtVault-Gallery-Exhibit-System\artvault-mern"
node scripts/start-offline.js
```

Open <http://127.0.0.1:5174>. Keep that PowerShell window open; press `Ctrl+C` to stop. The launcher binds the API and frontend to the local computer and turns off outgoing email. Browsing and saving drafts do not contact Supabase.

Use **port 5174** for the offline snapshot, not the regular development site on port 5173 or the deployed Vercel URL. Those normally use the online Atlas/Supabase services and will not become offline automatically. If the gallery is empty, check <http://127.0.0.1:5500/api/health>; it should report the currently selected `artvault_offline...` database. If the launcher says MongoDB is unavailable, start the local MongoDB Windows service and run the launcher again.

## 3. Draft offline; sync after reconnecting

1. Open **Offline drafts & sync** in the local copy. Choose a public artwork, edit its metadata, and select **Save local draft**. The browser stores metadata only; no image, password, or token is stored with it. Use the same browser profile and `127.0.0.1:5174` URL each time because browser storage is origin-specific.
2. When the internet returns, keep the offline launcher running. On the same page, sign in with the **artist account that owns the artwork**. The password is sent to Supabase only while online; the sync token is held in memory for that page, not in the draft queue.
3. The local page sends each draft to the live Railway API. The API checks artist ownership, public visibility, and the artwork's exact `updated_at` snapshot version in one atomic update. Successful drafts disappear from the queue. Conflicts remain locally saved for you to compare and choose **Keep online version** or **Use my local draft**. A newer edit made after your choice causes another conflict rather than a silent overwrite.
4. If the browser closes, sign in again later. Drafts stay in this browser until successfully synced or explicitly discarded. Make a separate computer backup if these drafts are important; clearing browser site data removes them.

**Deployment note:** The live Railway server must have the new `/api/artworks/:id/sync-metadata` endpoint and allow `http://127.0.0.1:5174` in CORS before reconnect sync works. This code is local until it is deployed. Do not point the offline launcher at Atlas or copy the live MongoDB URI into its local database setting. No deployment is performed by these scripts.

## Important limits

- Snapshots do not update themselves when Atlas changes. Run `node scripts/refresh-offline.js` while online before a planned offline session; it creates a fresh copy without removing previous copies.
- Do **not** run a second restore over `artvault_offline`; the script refuses to overwrite local data. Take a separate local backup before replacing the offline snapshot.
- Offline drafts cover **metadata for public artworks only**. Images, new artworks, Vault data, likes, exhibit entries, and account/profile edits still require the online app. Local browsing may be out of date until a fresh backup is restored, and drafts made from an old snapshot may all become conflicts.
- The local API remains read-only. Local drafts live in browser storage, not MongoDB. They sync when you sign in online or when connection returns while the page and its temporary sign-in remain open. They cannot sync after a browser restart without signing in again.
- If MongoDB Server is not running, start the Windows `MongoDB` service first. MongoDB Compass alone is not the database server.
