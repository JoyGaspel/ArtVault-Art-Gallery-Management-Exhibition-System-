import { useState } from 'react';
import api from '../api';

export default function ArtworkThumbnail({ artwork, alt = '', className = '' }) {
  const [failed, setFailed] = useState(false);
  const apiBase = (api.defaults.baseURL || '/api').replace(/\/$/, '');
  const source = artwork?.thumbnail_url || artwork?.image_url || (artwork?.has_image !== false && artwork?._id ? `${apiBase}/artworks/${artwork._id}/thumbnail` : '');
  if (!source || failed) return <span className={`artwork-thumbnail artwork-thumbnail-empty ${className}`} aria-label={alt}>Art</span>;
  return <img className={`artwork-thumbnail ${className}`} src={source} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
