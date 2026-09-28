import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import useAutoRefresh from '../hooks/useAutoRefresh';
import PageLoadState from '../components/PageLoadState';

const prefetchedArtistProfiles = new Set();

export default function Artists() {
  const [artists, setArtists] = useState([]);
  const [params] = useSearchParams();
  const search = (params.get('search') || '').trim().toLowerCase();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredArtist, setHoveredArtist] = useState(null);
  const [latestArtworks, setLatestArtworks] = useState({});

  function load() {
    setLoading(true);
    setError('');
    return api.get('/artists').then((res) => setArtists(res.data.artists || [])).catch((err) => {
      setError(err.response?.data?.message || 'Could not load artists. Check that the API is running.');
    }).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);
  useAutoRefresh(load);

  const visibleArtists = search ? artists.filter((artist) => [artist.name, artist.bio, ...(artist.specializations || [])].filter(Boolean).some((value) => value.toLowerCase().includes(search))) : artists;
  function prefetchProfile(id) {
    const key = String(id);
    if (!key || prefetchedArtistProfiles.has(key)) return;
    prefetchedArtistProfiles.add(key);
    api.get(`/artists/${key}`)
      .then((response) => {
        const artwork = response.data.artworks?.[0] || null;
        if (artwork && !artwork.thumbnail_url && artwork.image_url) artwork.thumbnail_url = artwork.image_url;
        setLatestArtworks((current) => ({ ...current, [key]: artwork }));
      })
      .catch(() => { prefetchedArtistProfiles.delete(key); });
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">Community</div>
          <h1>Artists on ArtVault</h1>
          <div className="sub">{search ? `${visibleArtists.length} matching artists` : `${artists.length} artists · Every discipline, one directory.`}</div>
        </div>
      </div>

      <PageLoadState loading={loading} error={error} onRetry={load} label="artists…" />
      {!loading && !error && (
        <div className="artist-grid">
          {visibleArtists.map((a) => (
            <Link to={`/artists/${a._id}`} className="artist-card" key={a._id} onPointerEnter={() => { setHoveredArtist(a._id); prefetchProfile(a._id); }} onFocus={() => { setHoveredArtist(a._id); prefetchProfile(a._id); }} onPointerLeave={() => setHoveredArtist(null)}>
              {hoveredArtist === a._id && (latestArtworks[a._id] || a.latestArtwork)?.thumbnail_url && <div className="artist-hover-art"><img src={(latestArtworks[a._id] || a.latestArtwork).thumbnail_url} alt="" loading="lazy" decoding="async" /><span>Latest work · {(latestArtworks[a._id] || a.latestArtwork).title}</span></div>}
              {a.avatar_url && <img className="av-lg artist-avatar-image" src={a.avatar_url} alt={`${a.name} profile`} loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; event.currentTarget.nextElementSibling.style.display = 'flex'; }} />}
              <div className="av-lg" style={{ display: a.avatar_url ? 'none' : 'flex' }}>{(a.name || '?').slice(0, 2).toUpperCase()}</div>
              <div className="artist-card-name-row"><div className="name">{a.name}</div><span className="artist-card-arrow">→</span></div>
              <div className="artist-card-role">Artist on ArtVault</div>
              <div className="bio">{a.bio || 'Discover this artist’s work and creative practice.'}</div>
              <div className="tags">
                {(a.specializations || []).map((s) => (
                  <span className="tiny-tag" key={s}>{s}</span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
      {!loading && !error && visibleArtists.length === 0 && <div className="empty">No artists match your search.</div>}
    </section>
  );
}
