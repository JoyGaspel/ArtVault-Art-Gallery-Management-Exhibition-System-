export function goBackOr(navigate, fallback) {
  // React Router tracks in-app history with idx. A directly opened page has no
  // earlier ArtVault entry, so use a predictable destination instead.
  if (Number(window.history.state?.idx) > 0) navigate(-1);
  else navigate(fallback, { replace: true });
}
