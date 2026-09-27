import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import ArtworkLikeButton from './ArtworkLikeButton';

const EMOJI_BY_CATEGORY = {
  'Digital Art': '🎨', Illustration: '✒️', Photography: '📷', Sculpture: '🗿',
  Painting: '🖼️', 'Traditional Art': '🖌️', Crafts: '🏺', 'Textile Art': '🧵',
  'Mixed Media': '🐣', Calligraphy: '✒️',
};

function emojiFor(categories = []) {
  for (const c of categories) if (EMOJI_BY_CATEGORY[c]) return EMOJI_BY_CATEGORY[c];
  return '🖼️';
}

const prefetchedArtworkDetails = new Set();

export default function ArtCard({ artwork, height, priority = false, to }) {
  const [imageFailed, setImageFailed] = useState(false);
  const artistName = artwork.artist?.name || 'Unknown artist';
  const apiBase = (api.defaults.baseURL || '/api').replace(/\/$/, '');
  const imageVersion = artwork.updated_at ? `?v=${encodeURIComponent(artwork.updated_at)}` : '';
  // Prefer the same-origin/API image endpoint. Older API responses may omit
  // `has_image`, so only skip the request when the server explicitly says
  // there is no stored image. This also prevents mixed-content HTTP URLs.
  const imageSrc = artwork.thumbnail_url || artwork.image_path || (artwork.has_image !== false ? `${apiBase}/artworks/${artwork._id}/thumbnail${imageVersion}` : '');
  function prefetchDetails() {
    if (!artwork._id || prefetchedArtworkDetails.has(String(artwork._id))) return;
    prefetchedArtworkDetails.add(String(artwork._id));
    api.get(`/artworks/${artwork._id}`).catch(() => {
      prefetchedArtworkDetails.delete(String(artwork._id));
    });
  }
  return (
    <article className="art-card">
      <Link to={to || `/artworks/${artwork._id}`} className="art-card-link" style={{ textDecoration: 'none', color: 'inherit' }} onMouseEnter={prefetchDetails} onFocus={prefetchDetails}>
      <div className={`art-thumb${imageSrc && !imageFailed ? ' has-image' : ''}`} style={height ? { height } : undefined}>
        {imageSrc && !imageFailed ? <img src={imageSrc} alt={artwork.title} sizes="(max-width: 620px) 50vw, (max-width: 1000px) 33vw, 240px" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" onError={() => setImageFailed(true)} /> : <span className="art-placeholder" role="img" aria-label="Artwork placeholder">{emojiFor(artwork.categories)}</span>}
      </div>
      <div className="art-info">
        <div className="art-title-row"><div className="t">{artwork.title}</div><div className="art-card-like"><ArtworkLikeButton artworkId={artwork._id} initialCount={artwork.like_count} compact /></div></div>
        <div className="a">by {artistName}</div>
        <div className="tags">
          {(artwork.categories || []).map((c) => (
            <span className="tiny-tag" key={c}>{c}</span>
          ))}
        </div>
      </div>
      </Link>
    </article>
  );
}
