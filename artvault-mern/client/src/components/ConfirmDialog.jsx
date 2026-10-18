import { createPortal } from 'react-dom';

export default function ConfirmDialog({ title = 'Confirm action', message, confirmLabel = 'Confirm', danger = false, busy = false, onConfirm, onCancel }) {
  return createPortal(<div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !busy && onCancel()}>
    <div className="modal-box confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="modal-head"><h2 id="confirm-title">{title}</h2><button className="modal-close" type="button" onClick={onCancel} disabled={busy} aria-label="Close">×</button></div>
      <p>{message}</p>
      <div className="modal-actions"><button className="btn btn-ghost" type="button" onClick={onCancel} disabled={busy}>Cancel</button><button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} type="button" onClick={onConfirm} disabled={busy}>{confirmLabel}</button></div>
    </div>
  </div>, document.body);
}
