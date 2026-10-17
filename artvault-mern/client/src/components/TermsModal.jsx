import { useEffect, useRef } from 'react';
import { TermsContent } from '../pages/Terms';

export default function TermsModal({ onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector('.terms-modal-close')?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="modal-overlay terms-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="terms-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="terms-modal-title" aria-describedby="terms-modal-intro" onKeyDown={handleKeyDown}>
        <div className="terms-modal-head">
          <div>
            <div className="eyebrow">Effective 17 October 2026</div>
            <h2 id="terms-modal-title">ArtVault Terms and Conditions</h2>
            <p id="terms-modal-intro">Please review these terms before creating your account.</p>
          </div>
          <button className="terms-modal-close" type="button" aria-label="Close terms and conditions" onClick={onClose}>×</button>
        </div>
        <div className="terms-modal-scroll" tabIndex={0} aria-label="Terms and Conditions text">
          <TermsContent />
        </div>
        <div className="terms-modal-foot">
          <span>After reading, tick the agreement checkbox on the signup form.</span>
          <button className="btn btn-primary" type="button" onClick={onClose}>Back to sign up</button>
        </div>
      </div>
    </div>
  );
}
