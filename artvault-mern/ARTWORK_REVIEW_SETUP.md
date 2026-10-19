# Artwork web-check and admin review

ArtVault can send a resized copy of each uploaded artwork image to Google Cloud Vision Web Detection. It does **not** send the private ownership-proof image. A full or partial web-image match is only a possible match, not proof that an artist copied an image. Visually similar results alone do not trigger review.

## Enable on the backend

1. In your own Google Cloud project, enable the Cloud Vision API, set up billing, and create a restricted server-side API key for that API.
2. Set `GOOGLE_VISION_API_KEY` in the Railway backend service's variables. Do not put it in Vercel, the frontend, a `VITE_` variable, or Git.
3. Set `ARTWORK_WEB_CHECK_ENABLED=true` in the same Railway service and redeploy the backend. Leave it `false` until the key is ready.
4. Test with a non-sensitive, permitted test image. Verify the intended Public/Vault setting and review status in My artworks; check Manage gallery as main admin.

Google Cloud requires billing to be enabled. Its current Vision pricing lists the first 1,000 Web Detection units per month as free, then usage charges; set a budget/alert before enabling this on a public service. Check the current pricing before deployment: https://cloud.google.com/vision/pricing

When enabled, a possible match goes to **Pending review**. A successful check with no full/partial match keeps the artist's chosen Public or Vault setting. If Google is unavailable, the key is missing, or the request fails, the artwork also stays pending, rather than silently publishing an unscanned image. If the feature flag is off, uploads keep the previous immediate-publish behavior, and no web check is claimed.

Pending and rejected artwork is hidden from the public gallery, public profile, likes, and exhibit submissions. The artist and authorized administrators can view it. Sub-admins can monitor pending items and proof; only the main admin can approve or reject. Approval keeps the originally chosen Public/Vault setting. A decision sends an in-app notice and an email if email notifications are enabled.

This check cannot verify ownership or guarantee an original image: a real artist may have already published their own work online, and an unmatched image may still be someone else's. Administrators should compare the image, private proof, and match links before deciding.

Older artworks with no stored proof remain in the system. The admin proof viewer shows a clearly labeled **No proof on file** placeholder for them; it does not create or imply evidence that was never uploaded.
