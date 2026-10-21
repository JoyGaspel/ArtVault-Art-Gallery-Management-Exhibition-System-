import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import ArtCard from '../components/ArtCard';
import useAutoRefresh from '../hooks/useAutoRefresh';

const CATEGORIES = [
  'All', 'Digital Art', 'Illustration', 'Textile Art', 'Crafts', 'Photography',
  'Sculpture', 'Painting', 'Traditional Art', 'Mixed Media', 'Calligraphy', 'Others',
];

export default function Gallery() {
  const [params] = useSearchParams();
  const search = params.get('search') || '';
  const [active, setActive] = useState('All');
  const [artworks, setArtworks] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const requestVersion = useRef(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [columnCount, setColumnCount] = useState(() => getColumnCount());

  useEffect(() => {
    const onResize = () => setColumnCount(getColumnCount());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function loadGallery(showLoading = true) {
    const version = ++requestVersion.current;
    if (showLoading) setLoading(true);
    if (showLoading) setErr('');
    const query = active !== 'All' ? { category: active } : {};
    api
      .get('/artworks', { params: { ...query, search, page, limit: 24 } })
      .then((res) => {
        if (version !== requestVersion.current) return;
        const result = res.data?.artworks;
        if (!Array.isArray(result)) throw new Error('The gallery response was invalid.');
        setArtworks(result);
        setTotal(res.data.total || 0);
        setPages(res.data.pages || 0);
        if (res.data.pages > 0 && page > res.data.pages) setPage(res.data.pages);
        setErr('');
      })
      .catch((error) => {
        if (version !== requestVersion.current) return;
        if (showLoading) setArtworks([]);
        if (showLoading) setErr(error.response?.data?.message || 'Could not load the gallery. Check that the API is running.');
      })
      .finally(() => {
        if (version === requestVersion.current) setLoading(false);
      });

    return () => { if (version === requestVersion.current) requestVersion.current++; };
  }

  // New searches begin on the first page; version checks ignore stale responses.
  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => loadGallery(true), [active, search, page]);
  useAutoRefresh(() => loadGallery(false));

  const visible = artworks;

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
            {search ? `${total} results for "${search}"` : `${total} artwork${total === 1 ? '' : 's'}`}
          </div>
        </div>
      </div>

      <div className="chip-row">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`chip${active === c ? ' active' : ''}`}
            onClick={() => { setPage(1); setActive(c); }}
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
            {visible.map((w, index) => <ArtCard key={w._id} artwork={w} priority={index < 4} />)}
          </div>
          {page >= pages && <div className="gallery-end-marker" role="status">You&apos;ve reached the end of the results.</div>}
        </>
      )}
      {!err && pages > 1 && <nav className="pagination-controls" aria-label="Gallery pages">
        <button className="btn btn-ghost" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
        <span role="status">Page {page} of {pages}</span>
        <button className="btn btn-ghost" disabled={loading || page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button>
      </nav>}
    </section>
  );
}

function getColumnCount() {
  if (typeof window === 'undefined') return 1;
  if (window.innerWidth <= 340) return 1;
  if (window.innerWidth <= 620) return 2;
  if (window.innerWidth <= 860) return 3;
  return Math.max(1, Math.min(6, Math.floor((window.innerWidth - 296) / 240)));
}
