import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import useAutoRefresh from '../hooks/useAutoRefresh';

export default function Artists() {
  const [artists, setArtists] = useState([]);
  const [params] = useSearchParams();
  const search = (params.get('search') || '').trim().toLowerCase();
  const [loading, setLoading] = useState(true);
  const [hoveredArtist, setHoveredArtist] = useState(null);

  function load() {
    setLoading(true);
    return api.get('/artists').then((res) => setArtists(res.data.artists)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);
  useAutoRefresh(load);

  const visibleArtists = search ? artists.filter((artist) => [artist.name, artist.bio, ...(artist.specializations || [])].filter(Boolean).some((value) => value.toLowerCase().includes(search))) : artists;

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">Community</div>
          <h1>Artists on ArtVault</h1>
          <div className="sub">{search ? `${visibleArtists.length} matching artists` : `${artists.length} artists · Every discipline, one directory.`}</div>
        </div>
      </div>

      {loading && <div className="empty">Loading…</div>}
      {!loading && (
        <div className="artist-grid">
          {visibleArtists.map((a) => (
            <Link to={`/artists/${a._id}`} className="artist-card" key={a._id} onMouseEnter={() => setHoveredArtist(a._id)} onMouseLeave={() => setHoveredArtist(null)}>
              {hoveredArtist === a._id && a.latestArtwork?.image_url && <div className="artist-hover-art"><img src={a.latestArtwork.image_url} alt="" /><span>Latest work · {a.latestArtwork.title}</span></div>}
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
      {!loading && visibleArtists.length === 0 && <div className="empty">No artists match your search.</div>}
    </section>
  );
}
