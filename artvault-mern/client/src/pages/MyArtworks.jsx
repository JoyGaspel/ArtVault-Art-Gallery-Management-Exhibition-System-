import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import ArtworkThumbnail from '../components/ArtworkThumbnail';
import ArtworkCardDetails from '../components/ArtworkCardDetails';
import PageLoadState from '../components/PageLoadState';
import { useAuth } from '../context/AuthContext';
import useAutoRefresh from '../hooks/useAutoRefresh';

export default function MyArtworks() {
  const { user } = useAuth();
  const [artworks, setArtworks] = useState([]);
  const [counts, setCounts] = useState({ public: 0, private: 0 });
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(({ silent = false } = {}) => {
    if (!silent) { setLoading(true); setError(''); }
    return api.get('/artworks/mine/portfolio', { params: { visibility: filter, page, limit: 24 } })
      .then(({ data }) => {
        setArtworks(data.artworks || []);
        setCounts({ public: data.publicCount || 0, private: data.privateCount || 0 });
        setPages(Math.max(1, data.pages || 1));
        setError('');
      })
      .catch((err) => { if (!silent) setError(err.response?.data?.message || 'Could not load your artworks.'); })
      .finally(() => { if (!silent) setLoading(false); });
  }, [filter, page]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(() => load({ silent: true }));

  function chooseFilter(value) {
    setFilter(value);
    setPage(1);
  }

  const filters = [
    { value: 'all', label: 'All', count: counts.public + counts.private },
    { value: 'public', label: 'Public', count: counts.public },
    { value: 'private', label: 'In my Vault', count: counts.private },
  ];

  return <section className="my-artworks-page">
    <div className="page-head collection-page-head"><div>
      <div className="eyebrow">MY STUDIO · COLLECTION</div>
      <h1>My artworks</h1>
      <div className="sub">Find your current artworks here. Public works appear in the gallery; private works stay in your Vault. Removed works are kept in Recently removed for 30 days.</div>
    </div>{user?.role === 'artist' && <Link className="btn btn-primary" to="/upload">Upload artwork</Link>}</div>

    <div className="my-artworks-toolbar">
      <div className="chip-row" role="group" aria-label="Filter my artworks">
        {filters.map((item) => <button key={item.value} type="button" className={`chip${filter === item.value ? ' active' : ''}`} aria-pressed={filter === item.value} onClick={() => chooseFilter(item.value)}>{item.label} <span>{item.count}</span></button>)}
      </div>
      <div className="my-artworks-shortcuts"><Link to="/vault">Open my Vault</Link><Link to="/removed-artworks">Recently removed</Link>{user?.id && <Link to={`/artists/${user.id}`}>My public profile</Link>}</div>
    </div>

    {loading ? <PageLoadState loading label="your artworks" /> : error ? <PageLoadState error={error} onRetry={load} /> : !artworks.length
      ? <div className="empty">{filter === 'all' ? user?.role === 'artist' ? <>No artworks yet. <Link to="/upload">Upload your first piece</Link>.</> : 'No artworks yet.' : filter === 'private' ? <>Your Vault is empty. <Link to="/vault">Open the Vault</Link> to learn more.</> : 'You have no public artworks yet.'}</div>
      : <><div className="my-artworks-grid">{artworks.map((artwork) => <Link className="my-artwork-card" to={`/artworks/${artwork._id}`} aria-label={`View artwork: ${artwork.title}`} key={artwork._id}>
        <div className="my-artwork-image">
          <ArtworkThumbnail artwork={artwork} alt={artwork.title} />
        </div>
        <div className="my-artwork-info">
          <span className={`my-artwork-status${artwork.visibility === 'private' ? ' private' : ''}`}>
            {artwork.visibility === 'private' ? 'In Vault' : 'Not in Vault'}
          </span>
          <div className="collection-card-title-row"><h2 title={artwork.title}>{artwork.title}</h2><span className="collection-card-likes" aria-label={`${artwork.like_count || 0} likes`}>♡ {artwork.like_count || 0}</span></div>
          <ArtworkCardDetails artwork={artwork} fallbackArtist={user} />
          <span className="my-artwork-view">View artwork <span aria-hidden="true">→</span></span>
        </div>
      </Link>)}</div>
      {pages > 1 && <div className="vault-pagination"><button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button></div>}</>}
  </section>;
}
