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
  const [columnCount, setColumnCount] = useState(() => getColumnCount());

  useEffect(() => {
    const onResize = () => setColumnCount(getColumnCount());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr('');
    const query = active !== 'All' ? { category: active } : {};
    api
      .get('/artworks', { params: { ...query, page: 1, limit: 100 } })
      .then((res) => {
        if (cancelled) return;
        const result = res.data?.artworks;
        if (!Array.isArray(result)) throw new Error('The gallery response was invalid.');
        setArtworks(result);
      })
      .catch((error) => {
        if (cancelled) return;
        setArtworks([]);
        setErr(error.response?.data?.message || 'Could not load the gallery. Check that the API is running.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [active]);

  const visible = useMemo(() => {
    if (!search) return artworks;
    const q = search.toLowerCase();
    return artworks.filter(
      (w) => (w.title || '').toLowerCase().includes(q)
        || (w.artist?.name || '').toLowerCase().includes(q)
        || (w.categories || []).some((c) => c.toLowerCase().includes(q))
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
        <div className="gallery-masonry" style={{ '--gallery-columns': columnCount }}>
          {Array.from({ length: columnCount }, (_, column) => (
            <div className="gallery-masonry-column" key={column}>
              {visible.filter((_, index) => index % columnCount === column).map((w) => (
                <ArtCard key={w._id} artwork={w} />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function getColumnCount() {
  if (typeof window === 'undefined') return 1;
  if (window.innerWidth <= 390) return 1;
  if (window.innerWidth <= 860) return 2;
  return Math.max(1, Math.min(6, Math.floor((window.innerWidth - 296) / 240)));
}
