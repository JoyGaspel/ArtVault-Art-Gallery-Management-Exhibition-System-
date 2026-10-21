import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';

export default function ArtworkPreviewModal({ artwork, onClose }) {
  const [image, setImage] = useState('');
  const [extension, setExtension] = useState('jpg');
  const [error, setError] = useState('');
  const [details, setDetails] = useState(null);
  const [detailsError, setDetailsError] = useState('');
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl;
    api.get(`/artworks/${artwork._id}`, { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setDetails(data.artwork); })
      .catch(() => { if (!controller.signal.aborted) setDetailsError('Could not load artwork details. Close the preview and try again.'); });
    api.get(`/artworks/${artwork._id}/image`, { responseType: 'blob', signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        if (!data.type.startsWith('image/')) throw new Error('Invalid image');
        setExtension(({ 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[data.type] || 'jpg');
        objectUrl = URL.createObjectURL(data);
        setImage(objectUrl);
      })
      .catch(() => { if (!controller.signal.aborted) setError('Could not load this artwork. Close the preview and try again.'); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [artwork._id]);

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector('button')?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') close.current();
      if (event.key === 'Tab') {
        const buttons = [...dialog.current.querySelectorAll('button, a[href]')];
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);

  return createPortal(<div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} className="modal-box ownership-proof-modal" role="dialog" aria-modal="true" aria-labelledby="artwork-preview-title">
      <div className="modal-head">
        <h2 id="artwork-preview-title">{artwork.title}</h2>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close artwork preview">×</button>
      </div>
      <div className="ownership-proof-preview">
        {error ? <p role="alert">{error}</p> : image ? <img src={image} alt={artwork.title} onError={() => setError('This image could not be displayed.')} /> : <p role="status">Loading artwork…</p>}
      </div>
      <div className="artwork-preview-details">
        {detailsError ? <p role="alert">{detailsError}</p> : !details ? <p role="status">Loading artwork details…</p> : <>
          <p className="artwork-preview-artist">By {details.artist?.name || artwork.artist?.name || 'Unknown artist'}</p>
          <dl>
            <dt>Description</dt><dd className="artwork-preview-description">{details.description || 'No description provided.'}</dd>
            <dt>Categories / specialization</dt><dd>{details.categories?.length ? details.categories.join(', ') : 'Not specified.'}</dd>
            <dt>Materials</dt><dd>{details.materials?.length ? details.materials.join(', ') : 'Not specified.'}</dd>
            <dt>Chosen destination</dt><dd>{details.visibility === 'private' ? 'Artist Vault' : 'Public gallery'} — awaiting review</dd>
          </dl>
        </>}
      </div>
      <div className="modal-actions">
        {image && <a className="btn btn-ghost" href={image} download={`artwork-review.${extension}`}>Save image for source review</a>}
        <button className="btn btn-primary" type="button" onClick={onClose}>Close preview</button>
      </div>
    </div>
  </div>, document.body);
}
