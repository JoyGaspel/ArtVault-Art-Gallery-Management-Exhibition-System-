# ArtVault Checkpoint 2 Security Test Plan

Run these tests against both the local API (`http://localhost:5000`) and the
deployed Render API. Record the actual response, date, environment, and a
screenshot for the submission document.

| Test | Procedure | Expected result |
| --- | --- | --- |
| Invalid login | Submit an incorrect password several times | `401`; after 3 failures, account is temporarily locked with `423` |
| Rate limiting | Send more than 10 failed auth requests within 15 minutes | `429` with a safe rate-limit message |
| Protected route without token | `GET /api/auth/me` without `Authorization` | `401` and no user data |
| Invalid/expired token | Send a malformed or expired Bearer token to `/api/auth/me` | `401` with a generic session message |
| Artist role restriction | Use an artist token on `/api/exhibits` `POST` | `403` administrator access response |
| Ownership restriction | Use Artist A's token to update Artist B's artwork | `403` and no database change |
| Invalid input | Submit an oversized title, bio, description, or invalid date | `400` with a validation message |
| Invalid upload | Submit a document or oversized image as `image_path` | `400`; no artwork is created |
| Password storage | Inspect the MongoDB `artists` collection | Password field contains a bcrypt hash, never plaintext |
| Secure error response | Request an invalid route or trigger a server error in production | Generic message; no stack trace or database URI |
| HTTPS | Open the deployed frontend and API using `http://` | Redirects or upgrades to HTTPS |
| MongoDB access | Check Atlas database users and network access | Restricted user permissions and approved network access only |

## Evidence to capture

- Login lockout/rate-limit response
- `401` protected-route response
- `403` wrong-role response
- Form validation response
- Invalid-file response
- MongoDB hashed password view (redact values)
- Generic production error response
- HTTPS browser address bar
- Render `/api/health` response showing database connectivity

Never include passwords, JWTs, MongoDB URIs, Supabase secret keys, or other
credentials in screenshots or the submitted document.
