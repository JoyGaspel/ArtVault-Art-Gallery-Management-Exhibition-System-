# ArtVault Checkpoint 2 Deployment Checklist

Complete this checklist after pushing the latest changes and redeploying both
services.

## Required checks

- [ ] Vercel frontend opens successfully.
- [ ] Render API responds at `/api/health` with `status: ok`.
- [ ] Health response reports MongoDB as `connected`.
- [ ] Supabase authentication is configured and confirmed users can sign in.
- [ ] Artist signup and duplicate-email rejection work in production.
- [ ] Artist profile updates persist in MongoDB.
- [ ] Artwork upload, image retrieval, edit, and archive/delete work.
- [ ] Exhibit create, edit, detail, and delete work for administrators.
- [ ] Archives can be listed and restored by administrators.
- [ ] Main-admin/sub-admin restrictions work.
- [ ] Guest users cannot access protected write operations.
- [ ] Production frontend uses the Render API URL ending in `/api`.
- [ ] Render `CLIENT_ORIGIN` contains the exact Vercel origin.
- [ ] `JWT_SECRET`, `MONGO_URI`, and Supabase server secret are configured only in Render.
- [ ] No `.env` file, JWT, password, or database URI is committed to GitHub.
- [ ] Vercel and Render URLs use HTTPS.
- [ ] MongoDB Atlas user/network access is restricted appropriately.
- [ ] Security test results are recorded in `SECURITY-TEST-PLAN.md`.

## Evidence to submit

Capture screenshots of the deployed frontend, Render health response, MongoDB
Atlas data, authentication, role restriction, validation, HTTPS, and the
security test results. Redact all credentials and tokens.

## Deployment order

1. Commit and push the code changes.
2. Confirm Render environment variables and redeploy the API.
3. Confirm Vercel environment variables and redeploy the frontend.
4. Open the deployed frontend in a private browser window.
5. Run the security tests against the deployed URLs.
6. Record the actual results and attach the screenshots to the checkpoint file.
