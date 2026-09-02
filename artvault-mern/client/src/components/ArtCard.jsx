import { Link } from 'react-router-dom';

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
  const artistName = artwork.artist?.name || 'Unknown artist';
  return (
    <Link to={`/artworks/${artwork._id}`} className="art-card" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="art-thumb" style={{ height: height || 170 }}>
        {emojiFor(artwork.categories)}
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
