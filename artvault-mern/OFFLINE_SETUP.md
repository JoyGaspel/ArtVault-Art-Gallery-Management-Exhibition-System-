# ArtVault offline copy (Windows)

This is a **browse-only local copy** of ArtVault. Gallery, artists, exhibits, and public artwork images come from a local MongoDB database, so they remain available when the internet is off. Sign-in, upload, likes, admin changes, email, and two-way sync are **not enabled offline yet**. The launcher clearly marks this mode read-only so local changes cannot silently conflict with Atlas.

## Before starting

- MongoDB Server must be installed and its Windows service running on `127.0.0.1:27017`.
- Keep a recent `mongodump` archive or dump folder outside the Git repository. This backup contains private user and artwork data; do not upload it to GitHub or share it.
- Node dependencies must be installed in both `server` and `client` (`npm install` in each if needed).
- The offline copy uses ports 5500 (API) and 5174 (browser), separate from the normal local site.

## 1. Restore a backup into the separate local database

The October 12 backup is **already restored** on this computer into `artvault_offline` (161 documents). Do not repeat this step for daily use. To restore a backup on a new computer, open PowerShell in the `artvault-mern` folder and run:

```powershell
node scripts/restore-offline.js "C:\Users\gaspe\Documents\ArtVaultBackups\artvault-20261012-131251.archive.gz"
```

For a compressed archive, use the `.gz` path. For a folder dump, pass the dump directory that contains an `artvault` subfolder (or pass the `artvault` subfolder itself).

The script checks the backup, maps `artvault.*` collections to `artvault_offline.*`, and restores only to local MongoDB. It **does not use `--drop`** and refuses to run if `artvault_offline` already contains documents. Empty collections are safe. It never restores into Atlas. If the backup is old, the offline copy will show data only up to that backup date.

MongoDB warned that this backup came from server 8.0.34 while the installed local server is 8.3.11. Basic gallery, exhibit, and image reads passed, but cross-version restores are not guaranteed by MongoDB; keep the original archive safe and do not treat this local copy as your only backup.

## 2. Start ArtVault without internet

In PowerShell, go to the project folder, then start the local copy:

```powershell
cd "C:\Users\gaspe\OneDrive\Desktop\gaspel joy\VsCode\ArtVault-Gallery-Exhibit-System\artvault-mern"
node scripts/start-offline.js
```

Open <http://127.0.0.1:5174>. Keep that PowerShell window open; press `Ctrl+C` to stop. The launcher binds the API and frontend to the local computer, turns off outgoing email, and does not contact Supabase for sign-in.

## Important limits

- `mongodump` is a snapshot, not automatic synchronization. It will not update itself when Atlas changes.
- Do **not** run a second restore over `artvault_offline`; the script refuses to overwrite local data. Take a separate local backup before replacing the offline snapshot.
- Offline editing and automatic online upload require a write queue, per-record version checks, an offline sign-in method, and a conflict review screen. Until those are implemented and tested, this copy intentionally stays read-only.
- If MongoDB Server is not running, start the Windows `MongoDB` service first. MongoDB Compass alone is not the database server.
