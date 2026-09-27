export default function PageLoadState({ loading, error, onRetry, label = 'this page' }) {
  if (loading) return <div className="empty" role="status">Loading {label}…</div>;
  if (!error) return null;
  return (
    <div className="empty" role="alert">
      <p>{error}</p>
      {onRetry && <button className="btn btn-ghost btn-sm" type="button" onClick={onRetry}>Try again</button>}
    </div>
  );
}
