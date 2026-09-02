import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import ArtCard from '../components/ArtCard';

const CATEGORIES = [
  'All', 'Digital Art', 'Illustration', 'Textile Art', 'Crafts', 'Photography',
  'Sculpture', 'Painting', 'Traditional Art', 'Mixed Media', 'Calligraphy',
];

export default function Gallery() {
  const [params] = useSearchParams();
  const search = params.get('search') || '';
  const [active, setActive] = useState('All');
  const [artworks, setArtworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    const query = active !== 'All' ? { category: active } : {};
    api
      .get('/artworks', { params: query })
      .then((res) => setArtworks(res.data.artworks))
      .catch(() => setErr('Could not load the gallery. Is the API running?'))
      .finally(() => setLoading(false));
  }, [active]);

  const visible = useMemo(() => {
    if (!search) return artworks;
    const q = search.toLowerCase();
    return artworks.filter(
      (w) => w.title.toLowerCase().includes(q) || (w.categories || []).some((c) => c.toLowerCase().includes(q))
    );
  }, [artworks, search]);

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">Browse</div>
          <h1>The gallery wall</h1>
          <div className="sub">
            {search ? `${visible.length} results for "${search}"` : `${visible.length} artwork${visible.length === 1 ? '' : 's'}`}
          </div>
        </div>
      </div>

      <div className="chip-row">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`chip${active === c ? ' active' : ''}`}
            onClick={() => setActive(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {err && <div className="empty">{err}</div>}
      {!err && loading && <div className="empty">Loading…</div>}
      {!err && !loading && visible.length === 0 && (
        <div className="empty">No artworks here yet. Be the first to upload one.</div>
      )}
      {!err && !loading && visible.length > 0 && (
        <div className="gallery-grid">
          {visible.map((w, i) => (
            <ArtCard key={w._id} artwork={w} height={150 + ((i * 37) % 120)} />
          ))}
        </div>
      )}
    </section>
  );
}
