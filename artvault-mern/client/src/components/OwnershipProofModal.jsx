import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';

export default function OwnershipProofModal({ artworkId, artworkTitle, onClose }) {
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    api.get(`/artworks/${artworkId}/ownership-evidence`, { responseType: 'blob', signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        if (!data.type.startsWith('image/')) throw new Error('The ownership proof is not a viewable image.');
        objectUrl = URL.createObjectURL(data);
        setImageUrl(objectUrl);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          if (err.response?.status === 404) setMissing(true);
          else setError(err.message === 'The ownership proof is not a viewable image.' ? err.message : 'Could not load the private ownership proof. Please try again.');
        }
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [artworkId]);

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(<div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
    <div className="modal-box ownership-proof-modal" role="dialog" aria-modal="true" aria-labelledby="ownership-proof-title">
      <div className="modal-head">
        <div><div className="eyebrow">PRIVATE REVIEW</div><h2 id="ownership-proof-title">Ownership proof</h2></div>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close ownership proof">×</button>
      </div>
      <p className="ownership-proof-context">Submitted for “{artworkTitle}”. Review this alongside the artwork; a proof image alone does not verify ownership.</p>
      <div className="ownership-proof-preview">
        {missing ? <div className="ownership-proof-missing" role="status"><span aria-hidden="true">▧</span><strong>No proof on file</strong><p>This older artwork has no uploaded ownership-proof image. This is a placeholder, not evidence of ownership.</p></div> : error ? <p role="alert">{error}</p> : imageUrl ? <img src={imageUrl} alt={`Private ownership proof for ${artworkTitle}`} /> : <p role="status">Loading private proof…</p>}
      </div>
      <div className="modal-actions"><button className="btn btn-primary" type="button" onClick={onClose}>Done reviewing</button></div>
    </div>
  </div>, document.body);
}
