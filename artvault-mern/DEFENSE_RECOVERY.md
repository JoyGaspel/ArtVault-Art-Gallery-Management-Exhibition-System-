# ArtVault defense database recovery

This is a **manual, trusted-computer** recovery procedure. It does not run in the deployed server, and a network outage must never trigger it. Keep the computer and backup files private: archives contain artwork, accounts, and other user data. Do not commit or upload them to GitHub.

## Before the defense

1. Confirm `server/.env` has the correct Atlas `MONGO_URI`. Keep it secret.
2. Stop making changes in the app for the few seconds needed to take the backup. From the `artvault-mern` folder run:

   ```powershell
   node scripts/defense-recovery.js backup
   ```

3. The command saves a dated `.archive.gz` and matching `.archive.gz.json` checksum manifest in `C:\Users\gaspe\Documents\ArtVaultBackups`. It checks the archive with `mongorestore --dryRun`. Keep both files. Repeat this step immediately before the defense if the site has changed since the previous backup.
4. Check that the Vercel frontend, Railway backend, Atlas database, and Supabase authentication all work. The MongoDB backup does **not** back up Supabase Auth or Storage.

## If the evaluators drop `artvault` in Atlas

1. Confirm the database was actually dropped in Atlas. Do not restore for a temporary disconnection or slow page load.
2. Stop users from adding new data during recovery if possible. Use the newest verified archive.
3. On the trusted computer, from `artvault-mern`, run:

   ```powershell
   node scripts/defense-recovery.js restore "C:\Users\gaspe\Documents\ArtVaultBackups\artvault-defense-YYYYMMDD-HHMMSS.archive.gz"
   ```

4. The script validates the checksum, dry-runs the archive, and checks Atlas twice. If **any** collection contains documents, it refuses to restore. It never uses `--drop`. It then verifies the core collections returned.
5. Reload `/api/health` and check a real gallery/artist page. If the backend did not reconnect after the drop, restart its Railway service. Allow a little time for the app to refresh.

To check an archive without modifying a database:

```powershell
node scripts/defense-recovery.js verify "C:\Users\gaspe\Documents\ArtVaultBackups\artvault-defense-YYYYMMDD-HHMMSS.archive.gz"
```

## Important limits

- This restores the **backup-time** snapshot, not changes made afterward. Pause app writes while backing up or recovering.
- A MongoDB dump is not a continuously synchronized replica. There is no automatic self-healing when Atlas is dropped. Keeping the backup off Atlas is what makes recovery possible.
- On October 18, 2026, the new archive was restored into the separate local database `artvault_defense_rehearsal_20261018`. All 9 collection counts matched the manifest (210 documents total). That rehearsal database was left in place, separate from `artvault_offline` and Atlas.
- The local MongoDB server is version 8.3.11 while the Atlas archive reports 8.0.34, so the tools warn about cross-version restore. The rehearsal counts passed, but this is not an end-to-end production restore guarantee. Do not interpret a dry run alone as proof that every document will restore correctly.
- If Atlas contains newly created documents after a drop, this script stops rather than merging or deleting them. Review those records and plan a controlled recovery.
