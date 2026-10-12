import { useState } from 'react';
import api from '../api';
import useArtworkMedia from '../hooks/useArtworkMedia';

export default function ArtworkThumbnail({ artwork, alt = '', className = '' }) {
  const [failed, setFailed] = useState(false);
  const privateSource = useArtworkMedia(artwork, 'thumbnail');
  const apiBase = (api.defaults.baseURL || '/api').replace(/\/$/, '');
  const source = artwork?.visibility === 'private' ? privateSource : (artwork?.thumbnail_url || artwork?.image_url || (artwork?.has_image !== false && artwork?._id ? `${apiBase}/artworks/${artwork._id}/thumbnail` : ''));
  const waitingForPrivateImage = artwork?.visibility === 'private' && artwork?.has_image !== false && privateSource === '' && !failed;
  if (waitingForPrivateImage) return <span className={`artwork-thumbnail artwork-thumbnail-empty artwork-thumbnail-loading ${className}`} role="status" aria-label={`Loading ${alt || 'artwork'} image`}>Loading image…</span>;
  if (!source || failed) return <span className={`artwork-thumbnail artwork-thumbnail-empty ${className}`} aria-label={alt}>Art</span>;
  return <img className={`artwork-thumbnail ${className}`} src={source} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
