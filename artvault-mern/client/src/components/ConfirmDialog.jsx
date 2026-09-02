export default function ConfirmDialog({ title = 'Confirm action', message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
  return <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
    <div className="modal-box confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="modal-head"><h2 id="confirm-title">{title}</h2><button className="modal-close" type="button" onClick={onCancel} aria-label="Close">×</button></div>
      <p>{message}</p>
      <div className="modal-actions"><button className="btn btn-ghost" type="button" onClick={onCancel}>Cancel</button><button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} type="button" onClick={onConfirm}>{confirmLabel}</button></div>
    </div>
  </div>;
}
