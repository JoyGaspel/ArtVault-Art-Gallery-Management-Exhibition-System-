import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import ArtCard from '../components/ArtCard';
import useAutoRefresh from '../hooks/useAutoRefresh';

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

  function loadGallery(showLoading = true) {
    let cancelled = false;
    if (showLoading) setLoading(true);
    if (showLoading) setErr('');
    const query = active !== 'All' ? { category: active } : {};
    api
      .get('/artworks', { params: { ...query, page: 1, limit: 24 } })
      .then((res) => {
        if (cancelled) return;
        const result = res.data?.artworks;
        if (!Array.isArray(result)) throw new Error('The gallery response was invalid.');
        setArtworks(result);
      })
      .catch((error) => {
        if (cancelled) return;
        if (showLoading) setArtworks([]);
        if (showLoading) setErr(error.response?.data?.message || 'Could not load the gallery. Check that the API is running.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }

  // Keep the current cards in place while switching categories so the
  // scroll position does not jump to the top during the request.
  useEffect(() => loadGallery(artworks.length === 0), [active]);
  useAutoRefresh(() => loadGallery(false));

  const visible = useMemo(() => {
    if (!search) return artworks;
    const q = search.toLowerCase();
    return artworks.filter(
      (w) => (w.title || '').toLowerCase().includes(q)
        || (w.artist?.name || '').toLowerCase().includes(q)
        || (w.categories || []).some((c) => c.toLowerCase().includes(q))
    );
  }, [artworks, search]);

  // Do not render empty masonry columns when the final filtered page has
  // fewer artworks than the available screen columns.
  // Adapt the number of columns to the result count so the final cards do
  // not sit in mostly empty columns, especially on wide screens.
  const idealColumns = Math.ceil(Math.sqrt(visible.length * 1.25));
  const renderedColumnCount = Math.min(columnCount, Math.max(1, idealColumns));

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
        <>
          <div className={`gallery-masonry${search || active !== 'All' ? ' filtered-results' : ''}`} style={{ '--gallery-columns': renderedColumnCount }}>
            {visible.map((w) => <ArtCard key={w._id} artwork={w} />)}
          </div>
          <div className="gallery-end-marker" role="status">You&apos;ve reached the end of the gallery.</div>
        </>
      )}
    </section>
  );
}

function getColumnCount() {
  if (typeof window === 'undefined') return 1;
  if (window.innerWidth <= 390) return 1;
  if (window.innerWidth <= 620) return 2;
  if (window.innerWidth <= 860) return 3;
  return Math.max(1, Math.min(6, Math.floor((window.innerWidth - 296) / 240)));
}
