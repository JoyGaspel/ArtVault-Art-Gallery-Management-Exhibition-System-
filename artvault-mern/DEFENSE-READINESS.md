# Defense readiness and staging verification

This file records engineering checks. It is not fabricated survey evidence,
a penetration-test certificate, or a declaration that deployment settings are correct.

## Changes prepared for review

- Gallery pagination and server-side search, including Others/custom labels.
- Date-filtered descriptive analytics, accessible only to sub/main administrators,
  with CSV export and documented formulas and population limits.
- Public privacy notice, provider disclosures, archive/deletion limitations.
- Supabase TOTP enrollment and challenge, backend assurance-level enforcement,
  legacy-token restrictions and current-token revocation on logout.
- Production prototype-auth guard, configurable deployment API URL, environment
  templates, automated test command and GitHub Actions checks.
- On-demand route loading: production entry bundle reduced from approximately
  649 kB before splitting to 479 kB (uncompressed); individual pages load separately.
- Compatible dependency fixes: sharp 0.35.5, proxy-addr 2.0.8, and patched
  follow-redirects in the frontend lockfile. Run a clean install when deploying.

## Local verification, October 21, 2026

- All 87 backend tests passed, including backup-code OTP/replay/lockout checks,
  session-bound recovery, and real bundled NSFW model inference.
- Production frontend build passed with route splitting.
- Headless Edge with fake accounts and intercepted provider/backend APIs passed:
  gallery pagination/end marker, Others page reset, server-search request, analytics
  display and CSV download, authenticator settings/challenge screens and a simulated
  challenge completion, custom upload label, mobile page width, and privacy notice.
- These browser checks do not prove actual Supabase or database integration.
- Backup-code browser checks additionally covered email-OTP gating, generate and
  disable actions, one-time display, text download/hide, and recovery sign-in with
  mocked services. Real SMTP delivery and provider sessions still need staging tests.
- Dependency review still reports TensorFlow/argparse/sprintf-js advisories and
  development-tool advisories. Frontend router/Vite advisories need a separately
  tested major migration. Forced fixes were not applied because the suggested
  downgrade would break the bundled model/API compatibility. Do not claim a clean
  dependency audit. Local frontend installation hit Windows file locks, so its
  compatible dependency update was completed in the lockfile; deployment must
  use `npm ci` to install that exact tree.

## Required staging acceptance checks

Use a separate database and accounts. Do not seed or run destructive examples
against the live student/artist database. Record observed results and screenshots.

| Scenario | Expected result |
|---|---|
| Missing Supabase settings in a production build | Cannot silently sign in with prototype accounts |
| Artist calls analytics directly | 403; no private report data |
| Reviewer requests valid analytics dates | Correct totals, Philippine day boundaries, zeros for empty days |
| Reversed, impossible, or over-366-day analytics dates | 400; no expensive unbounded query |
| CSV export | Matches the displayed applied range; no names, emails, proof, or private labels |
| More than 24 public artworks | Next/Previous reaches all result pages; counts reflect full result set |
| Search for artwork not on page one | Matching artwork is found through server search |
| Category change from a later page | Returns to first page; stale responses do not overwrite new data |
| Others selected without a label | Upload/save rejected |
| Artist opens another artist's Vault/proof/media URL | Denied |
| Missing ownership proof/declaration | Upload rejected before persistence |
| Valid local NSFW screening | Runs without Google API credentials |
| Model timeout/failure | Upload blocked; no bypass |
| Match/uncertain proof/unavailable ownership check | Pending, hidden from public |
| Enrollment with current authenticator code | Factor verified; future API access requires aal2 |
| Enrolled user's password-only login/direct API request | MFA challenge / 403 MFA_REQUIRED |
| Correct/incorrect/expired authenticator code | Correct code grants access; other codes do not |
| Linked account attempts legacy JWT access | Denied; cannot bypass provider/MFA |
| Logout, then replay old access token | 401 after revocation is persisted |
| Authenticator removal | Requires a fresh code; next sign-in behavior matches remaining factors |
| Enable/replace/disable backup codes without email OTP | Denied; previous codes remain unchanged |
| Correct purpose-bound OTP | Generates ten one-time codes, or disables them; OTP cannot be replayed |
| Backup code used twice or simultaneously | Only one redemption succeeds |
| Backup recovery in another provider session or after 15 minutes | MFA required again |
| SMTP unavailable or wrong/expired OTP | No code-management changes; failures and cooldown enforced |
| Password reset, deletion code, lockout | Works through configured email/provider flows |
| Account/artwork deletion and recovery | Matches documented archive retention and role restrictions |

Provider API calls/MFA need real staging verification. Unit tests use controlled
provider responses and cannot confirm your Supabase configuration, SMTP delivery,
Google billing/quota, database policies, or production TLS settings.

## Remaining rubric work

1. **Sessions:** bearer tokens remain in browser storage. Plan HttpOnly/Secure cookie
   sessions with CSRF defenses and a server-enforced inactivity/refresh policy.
   Test cross-origin behavior between the frontend and backend hosts before migration.
2. **MFA policy:** MFA is supported and enforced once enrolled, but enrollment is
   not mandatory for every admin. Institution-wide enforcement/recovery needs a
   documented operator process. Backup security codes grant short-lived ArtVault
   recovery access; they do not remove/replace a lost Supabase factor. Do not claim
   institution-wide enforcement or automatic provider-factor recovery exists.
3. **Research:** supply real stakeholder evidence, measurable research questions,
   consented/anonymized data, sampling, analysis and justified findings. Dashboard
   counts are operational analytics and do not replace quantitative research.
4. **Privacy/governance:** publish a real `VITE_PRIVACY_CONTACT`; choose and implement
   an institutional retention schedule. Archives/logs/backups do not have universal
   automatic erasure. Review Google/Gemini data-use terms before sending private proof.
5. **Data protection:** verify actual hosting TLS, MongoDB encryption at rest and
   restricted database credentials; keep screenshots/configuration evidence without
   exposing passwords or keys. Application code does not establish host encryption.
6. **Backup/recovery:** record a staging backup and restoration drill in an isolated
   database; validate artwork/proof availability and reference integrity afterward.
7. **Scalability:** measure concurrent browsing/uploads, local-model CPU/RAM, p95
   response time and error rates on the target host. Bounded queues protect the
   server but may reject busy uploads. Large media should migrate to object storage.
8. **Testing:** add deployed browser acceptance and database integration coverage;
   audit dependencies and resolve material issues with regression tests. GitHub
   Actions only runs after the workflow is committed/pushed.

## Suggested defense demonstration

Show artist registration and verification, public upload and Vault distinction,
rejected/uncertain upload handling, main-admin review with proof, exhibit submission
and decision, notifications, aggregate analytics and CSV, unauthorized API denial,
MFA, logout replay denial, and archive recovery. Explain failure cases and remaining
limits. Each member should explain their implementation, data flow and tradeoffs.
