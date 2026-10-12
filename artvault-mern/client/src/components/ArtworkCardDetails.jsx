export default function ArtworkCardDetails({ artwork, fallbackArtist }) {
  const artist = artwork.artist && typeof artwork.artist === 'object' && artwork.artist.name ? artwork.artist : fallbackArtist;
  const artistName = typeof artist?.name === 'string' && artist.name.trim() ? artist.name.trim() : 'Unknown artist';
  const categories = Array.isArray(artwork.categories) ? artwork.categories.filter(Boolean) : [];

  return <div className="artwork-card-details">
    <div className="artwork-card-credit">by <strong>{artistName}</strong></div>
    {categories.length > 0 && <div className="artwork-card-tags" aria-label="Artwork categories">
      {categories.map((category) => <span className="tiny-tag" key={category}>{category}</span>)}
    </div>}
  </div>;
}
