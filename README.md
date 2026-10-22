# ArtVault

**Art Gallery Management and Exhibition System**

ArtVault gives artists a space to share their work, organize a private artwork Vault, and submit artworks for exhibits. Visitors can discover approved public artworks, artists, and exhibitions. Administrators support curation, submission review, and account management.

[Visit ArtVault](https://art-vault-art-gallery-management-ex.vercel.app/) · [Developer setup](artvault-mern/README.md) · [Content screening](artvault-mern/server/CONTENT-SCREENING.md)

> This guide describes the current repository. Live features depend on the deployed frontend/backend versions and configured services. Normal online use requires an internet connection.

## For artists

- Create and personalize an artist profile.
- Upload artworks to the public gallery or private Vault, subject to screening and review.
- Edit artwork details, categories, materials, and visibility, subject to exhibit and moderation restrictions.
- Browse, search, filter, and like public artworks.
- Submit eligible artworks to exhibits and track submission decisions.
- Receive notifications and manage optional activity emails.
- Recover recently removed artworks where available.
- Protect sign-in with an authenticator, single-use backup codes, or both.

## Getting started

1. Open ArtVault and select **Join as artist**.
2. Enter your name, an email address you control, and an ArtVault password. Read and accept the Terms and privacy information.
3. Verify your email, then sign in with your registered email and **ArtVault password**. A Gmail address does not automatically provide Google account sign-in.
4. Visit **Profile settings** to manage your photo, biography, specializations, account security, and email preferences.
5. Choose **Upload artwork** when your image and creation evidence are ready.

Never share your password, email OTPs, authenticator secret/QR, or backup security codes. ArtVault does not need your email account password.

## Upload requirements

| Field | What to provide |
| --- | --- |
| Artwork image | Clear PNG, JPG/JPEG/JPE, WebP, or still GIF, up to **10 MB**. Animated images are not supported. |
| Title | Required; up to **50 characters**. |
| Description | Optional; up to **1,000 characters**. |
| Categories | **1–5** categories. Selecting **Others** requires a specialization up to **40 characters**. |
| Materials | Optional recognizable materials separated by commas; up to **20**, each up to **80 characters**. |
| Destination | Public gallery or Vault. Pending works remain hidden from public pages. |
| Ownership proof | One relevant proof image, up to **5 MB** in the upload form. |
| Declaration | Confirm that you created the work or have permission to share it. |

**Others accepts different specializations**, such as Pixel Art, Mosaic, Pottery, or Resin Art. These are examples, not an exclusive list. Your typed specialization appears on the artwork, which is discoverable through the gallery's **Others** filter. Use a distinct name, not a URL or markup.

### Preparing useful proof

Proof should relate to the specific artwork:

- **Digital art:** an editing screenshot showing layers, sketches, or meaningful unfinished stages.
- **Painting or drawing:** a sketch or work-in-progress photo showing the same composition.
- **Crafts or sculpture:** a photo showing construction or an unfinished stage.
- **Photography:** relevant original editing context or behind-the-scenes evidence; additional human review may be necessary.
- **Permission:** evidence identifying the work and the creator's permission to share it. Permission requires human review.

A duplicate of the finished image, watermark, or signature alone is insufficient creation evidence. A face or identity document is not required. Crop unrelated personal information and never include credentials or security codes.

## Screening and review

1. Required fields, files, proof, and the ownership declaration are validated.
2. **Local sexual-content screening** checks the artwork and proof. Detected explicit content is blocked; screening outages can prevent upload. This step requires no paid image-checking API.
3. **Local duplicate checking** compares images against fingerprinted ArtVault records. This is not an internet search; older records may need fingerprint backfilling.
4. When configured, **Gemini** assesses creation evidence and **Google Cloud Vision** searches for online image matches.
5. Submissions either proceed to their selected destination or await administrator review.

**Without a successful automatic online check, otherwise valid uploads go to Pending artworks**, including Vault submissions. Possible duplicates, online matches, and uncertain proof also require review. The Main Admin makes final pending-artwork approval or rejection decisions; Sub-admins can inspect and monitor the queue.

With all required automatic checks working, credible creation evidence and no detected online or local matches can allow automatic publication to the selected destination. Pending does not mean stolen. A match does not establish copying, and no match does not establish ownership.

Reviewers can inspect artwork and private proof without leaving the queue, and manually search artwork with Google Lens or TinEye. Those links open external services; they do not automatically check inside ArtVault. Private ownership proof should never be uploaded to those search services.

Automated screening can make mistakes. It does not detect every harmful image or classify graphic violence. Contact the project administrators to request review of an incorrect decision. See [screening configuration and limitations](artvault-mern/server/CONTENT-SCREENING.md).

## Gallery, Vault, and privacy

| Information | Access |
| --- | --- |
| Approved public artworks and artist profiles | Visitors and signed-in users. |
| Vault artworks | The owner and authorized administrators for monitoring and review. |
| Pending or rejected artworks | The owner and authorized administrators. |
| Ownership proof | Restricted review access; not displayed in the public gallery. |

**Vault is private from the public, but authorized administrators can view it.** Public image display cannot prevent visitors from copying an image.

Supabase supports authentication, MongoDB stores application records, and the configured email service sends messages. When enabled, Gemini receives artwork and proof, and Cloud Vision receives artwork. Manual searches send the chosen artwork to the external service. Provider configuration and retention are managed by the deployment operator.

Removing artwork or requesting account deletion does not immediately erase every copy. Artist recovery is available for **30 days where offered**; administrator archives, logs, backups, and provider copies may remain. Account deletion requests can suspend access pending Main Admin review. Read the Terms and privacy information during registration and contact the administrators for access, correction, retention, or deletion questions.

## Exhibits and notifications

Gallery uploads are not automatically entered into exhibits. Use **Exhibit submissions** for eligible artworks and **Submission status** to track decisions. Administrators handle exhibit selection.

Check in-app notifications for updates. Optional activity emails can be managed in Settings; required security messages remain enabled. Delivery depends on the mail service, so also check your spam folder. Role changes are communicated through account indicators and notifications.

## Security and account recovery

- **Authenticator:** add the QR/secret to a compatible app and enter a valid six-digit code in ArtVault to finish enabling protection. Scanning alone does not enable it.
- **Backup codes:** email OTP verification is required to enable, replace, or disable them. Save the codes when displayed; they cannot be shown again. Each successful use consumes one code and decreases the unused count in Settings. Replacing codes invalidates the old set.
- **Either method:** use an authenticator code or an unused backup code when verification is required. An authenticator is not required to enable backup codes.
- **Remember this browser:** after successful MFA, remember your own browser for up to **15 days**. Other browsers, cleared storage, expiry, or revoked trust require fresh verification. The **30-minute idle logout** still applies. Without remembered-browser trust, a backup-code verification grant lasts 15 minutes.
- **Forgot password:** verify the recovery email OTP, set a new password, and continue signing in. Complete MFA if enabled. Password recovery revokes remembered-browser grants. Backup codes alone cannot reset a password.

Repeated failed password attempts can temporarily lock sign-in. If you lose access to your email and verification methods, contact the deployment administrators. Access cannot safely be restored from an unverified request.

## Account roles

| Role | Responsibilities |
| --- | --- |
| Visitor | Browse public artworks, artists, and exhibits. |
| Artist | Manage their profile, artworks, Vault, submissions, and security. |
| Sub-admin | Authorized curation, monitoring, and records access; no final pending-artwork ownership approval. |
| Main Admin | Final ownership review, administrative management, and protected Sub-admin role changes. |

Administrators have private profile settings rather than public artist profiles. Revoking Sub-admin access returns the same account to Artist status, and artist profile visibility resumes.

## Technology and documentation

Built with **React/Vite**, **Node.js/Express**, **MongoDB/Mongoose**, **Supabase Auth**, and local **NSFWJS/TensorFlow.js** screening. Cloud Vision and Gemini integrations are optional. Administrator analytics provide descriptive workload and exhibit reports with CSV export, rather than predictions.

- [Setup, deployment, and reporting definitions](artvault-mern/README.md)
- [Server environment template](artvault-mern/server/.env.example)
- [Client environment template](artvault-mern/client/.env.example)
- [Content screening](artvault-mern/server/CONTENT-SCREENING.md)
- [Defense readiness and remaining validation](artvault-mern/DEFENSE-READINESS.md)
- [Manual database backup and recovery](artvault-mern/DEFENSE_RECOVERY.md)

For local development, install dependencies in both `artvault-mern/server` and `artvault-mern/client`, configure their `.env` files from the templates, and run `npm run dev` in each folder. Follow the setup guide for prerequisites and provider configuration. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

Run `npm test` in `server` and `npm run build` in `client`. Automated checks do not replace live email, mobile, provider, or end-to-end testing.

Never commit actual `.env` files, database dumps, credentials, or security codes. Server secrets must not go into public `VITE_*` variables. Shared features require both frontend and backend updates to be deployed; local changes do not automatically update the live site.

## Support and responsible use

Use the contact method provided by the ArtVault project team or institution for account issues, moderation appeals, and data requests. GitHub issues may describe reproducible software problems, but must not contain private proof, credentials, database exports, or personal account details.

Only upload content you are authorized to share. ArtVault provides curation and review tools; it does not certify authorship or guarantee uninterrupted hosting.
