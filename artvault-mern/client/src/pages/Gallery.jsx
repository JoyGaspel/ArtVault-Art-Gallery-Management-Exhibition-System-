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
  const sentinel = useRef(null);
  const inFlight = useRef(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [columnCount, setColumnCount] = useState(() => getColumnCount());

  useEffect(() => {
    const onResize = () => setColumnCount(getColumnCount());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function loadGallery(showLoading = true, nextPage = 1, append = false) {
    if (!showLoading && inFlight.current) return;
    const version = ++requestVersion.current;
    inFlight.current = true;
    if (showLoading) setLoading(true);
    if (showLoading) setErr('');
    const query = active !== 'All' ? { category: active } : {};
    const requestedPages = append ? [nextPage] : Array.from({ length: nextPage }, (_, index) => index + 1);
    Promise.all(requestedPages.map((requestedPage) => api.get('/artworks', { params: { ...query, search, page: requestedPage, limit: 24 } })))
      .then((responses) => {
        if (version !== requestVersion.current) return;
        if (responses.some((response) => !Array.isArray(response.data?.artworks))) throw new Error('The gallery response was invalid.');
        const res = responses[responses.length - 1];
        const result = responses.flatMap((response) => response.data.artworks);
        setArtworks((current) => [...new Map((append ? [...current, ...result] : result).map((item) => [item._id, item])).values()]);
        setTotal(res.data.total || 0);
        setPages(res.data.pages || 0);
        setPage(Math.max(1, Math.min(nextPage, res.data.pages || 1)));
        setErr('');
      })
      .catch((error) => {
        if (version !== requestVersion.current) return;
        setErr(error.response?.data?.message || 'Could not load artworks. Please retry.');
      })
      .finally(() => {
        if (version === requestVersion.current) { inFlight.current = false; setLoading(false); }
      });

    return () => { if (version === requestVersion.current) requestVersion.current++; };
  }

  // New searches begin on the first page; version checks ignore stale responses.
  useEffect(() => {
    setArtworks([]); setPage(1); setPages(0);
    return loadGallery(true);
  }, [active, search]);
  useAutoRefresh(() => loadGallery(false, page));
  useEffect(() => {
    if (!sentinel.current || loading || err || page >= pages) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !inFlight.current) loadGallery(true, page + 1, true);
    }, { rootMargin: '400px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [loading, err, page, pages, active, search]);

  const visible = artworks;

  // Do not render empty masonry columns when the final filtered page has
  // fewer artworks than the available screen columns.
  // Adapt the number of columns to the result count so the final cards do
  // not sit in mostly empty columns, especially on wide screens.
  const renderedColumnCount = Math.min(columnCount, Math.max(1, visible.length));
  const columns = Array.from({ length: renderedColumnCount }, () => []);
  visible.forEach((artwork, index) => columns[index % renderedColumnCount].push({ artwork, index }));

  return (
    <section className="gallery-page">
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

      {err && <div className="empty" role="alert">{err} <button className="btn btn-ghost" onClick={() => loadGallery(true, artworks.length ? page + 1 : 1, artworks.length > 0)}>Retry loading</button></div>}
      {loading && !visible.length && <div className="empty" role="status">Loading…</div>}
      {!err && !loading && visible.length === 0 && (
        <div className="empty">No artworks here yet. Be the first to upload one.</div>
      )}
      {visible.length > 0 && (
        <>
          <div className={`gallery-masonry gallery-packed${search || active !== 'All' ? ' filtered-results' : ''}`} style={{ '--gallery-columns': renderedColumnCount }}>
            {columns.map((items, column) => <div className="gallery-packed-column" key={column}>
              {items.map(({ artwork, index }) => <ArtCard key={artwork._id} artwork={artwork} priority={index < 4} />)}
            </div>)}
          </div>
          {!loading && !err && page >= pages && <div className="gallery-end-marker" role="status">You&apos;ve reached the end of the results.</div>}
        </>
      )}
      <div ref={sentinel} className="gallery-end-marker" role="status">{loading && visible.length > 0 ? 'Loading more artworks…' : ''}</div>
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
