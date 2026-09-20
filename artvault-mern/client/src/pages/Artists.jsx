import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import useAutoRefresh from '../hooks/useAutoRefresh';

export default function Artists() {
  const [artists, setArtists] = useState([]);
  const [params] = useSearchParams();
  const search = (params.get('search') || '').trim().toLowerCase();
  const [loading, setLoading] = useState(true);

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
          <div className="sub">{search ? `${visibleArtists.length} matching artists` : 'Every discipline, one directory.'}</div>
        </div>
      </div>

      {loading && <div className="empty">Loading…</div>}
      {!loading && (
        <div className="artist-grid">
          {visibleArtists.map((a) => (
            <Link to={`/artists/${a._id}`} className="artist-card" key={a._id}>
              {a.avatar_path
                ? <img className="av-lg artist-avatar-image" src={a.avatar_path} alt={`${a.name} profile`} loading="lazy" />
                : <div className="av-lg">{(a.name || '?').slice(0, 2).toUpperCase()}</div>}
              <div className="name">{a.name}</div>
              <div className="bio">{a.bio}</div>
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
