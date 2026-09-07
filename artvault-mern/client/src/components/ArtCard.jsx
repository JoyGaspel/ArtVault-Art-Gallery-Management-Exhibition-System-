import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const EMOJI_BY_CATEGORY = {
  'Digital Art': '🎨', Illustration: '✒️', Photography: '📷', Sculpture: '🗿',
  Painting: '🖼️', 'Traditional Art': '🖌️', Crafts: '🏺', 'Textile Art': '🧵',
  'Mixed Media': '🐣', Calligraphy: '✒️',
};

function emojiFor(categories = []) {
  for (const c of categories) if (EMOJI_BY_CATEGORY[c]) return EMOJI_BY_CATEGORY[c];
  return '🖼️';
}

export default function ArtCard({ artwork, height }) {
  const [imageFailed, setImageFailed] = useState(false);
  const artistName = artwork.artist?.name || 'Unknown artist';
  const apiBase = (api.defaults.baseURL || '/api').replace(/\/$/, '');
  const imageSrc = artwork.image_path || (artwork.has_image ? `${apiBase}/artworks/${artwork._id}/image` : '');
  return (
    <Link to={`/artworks/${artwork._id}`} className="art-card" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className={`art-thumb${imageSrc && !imageFailed ? ' has-image' : ''}`} style={height ? { height } : undefined}>
        {imageSrc && !imageFailed ? <img src={imageSrc} alt={artwork.title} loading="lazy" decoding="async" onError={() => setImageFailed(true)} /> : <span className="art-placeholder" role="img" aria-label="Artwork placeholder">{emojiFor(artwork.categories)}</span>}
      </div>
      <div className="art-info">
        <div className="t">{artwork.title}</div>
        <div className="a">by {artistName}</div>
        <div className="tags">
          {(artwork.categories || []).map((c) => (
            <span className="tiny-tag" key={c}>{c}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
