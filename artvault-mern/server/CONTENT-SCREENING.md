# Free explicit-content screening

## No-billing ownership workflow

Set `ARTWORK_WEB_CHECK_ENABLED=false` locally and on the backend host. This is
now the example/default setting. Local NSFW checks remain unchanged. A local
image digest and difference hash flag possible duplicates within fingerprinted
ArtVault records; these are review signals, not ownership findings. Hash
similarity can produce false positives and miss altered/cropped images.
Private matching records and their identities are not returned to uploaders.

Gemini proof assessment now runs independently of Cloud Vision, using the
configured `GEMINI_API_KEY` and available account quota. It does not search the
internet. With no successful online check, submissions remain pending, even
when proof is assessed as credible. Reviewers see separate local/proof/web
statuses and instructions to manually use Google Lens or TinEye. Uploading to
those external sites is a deliberate reviewer action; do not upload private proof.

Older artworks need a one-time fingerprint backfill from the server folder:
`node scripts/fingerprint-artworks.js`. It adds fingerprints without changing
artwork content, approval or timestamps; external-URL images are skipped.
Run against the intended database after taking a backup. This command has not
been run automatically. Existing pending records are not automatically reassessed.
New submissions and replacement images use the new checks. Update Railway's
web-check setting separately and restart/redeploy both environments.

From the `server` folder, run `npm install`, then restart the backend with
`npm run dev` (or `npm start`). On Windows PowerShell, use `npm.cmd` if script
execution policy prevents running `npm`.

No API key, payment method, or billing account is required for sexual-content
screening. NSFWJS MobileNetV2 weights are included in the installed package;
TensorFlow.js runs on the server CPU in a worker thread. Images stay on the
server for this screening. The model is loaded once and reused. First uploads
can take longer while the model initializes. Hosting CPU and RAM are still used.

New artwork and proof, including replacement images and private Vault uploads,
are screened before they are saved. Porn or Hentai probability >= 0.20, Sexy
probability >= 0.40, or their combined probability >= 0.45 blocks the upload.
These are conservative policy thresholds, not guarantees. Animated files are
rejected because checking just the first frame would miss later content.
Invalid results, worker failures, timeouts, or a full queue return 503 and do
not bypass screening. At most four classifications are queued in one worker.

This model detects sexual imagery, including explicit drawings. It does not
classify gore/violence, prove ownership, or search the internet. False positives
and false negatives remain possible. Existing artworks are not rescanned.

Ownership checks are separate. `GOOGLE_VISION_API_KEY` is only for online
matching (Google Cloud billing service), and `GEMINI_API_KEY` is only for proof
assessment. Neither is needed for local sexual-content screening. To avoid
online-matching requests, set `ARTWORK_WEB_CHECK_ENABLED=false`. With no online
ownership check, otherwise valid submissions wait for manual review; they are
not automatically labeled original. Proof and ownership declaration remain required.

Run checks from `server`:

```
node --test tests/artworkContentCheck.test.js tests/localContentClassifier.test.js tests/artworkOwnershipReview.test.js tests/artworkProofCheck.test.js tests/artworkWebCheck.test.js tests/artworkVisibility.test.js
```

Reference: https://github.com/infinitered/nsfwjs (MIT license).
