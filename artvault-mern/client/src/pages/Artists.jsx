import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function Artists() {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/artists').then((res) => setArtists(res.data.artists)).finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">Community</div>
          <h1>Artists on ArtVault</h1>
          <div className="sub">Every discipline, one directory.</div>
        </div>
      </div>

      {loading && <div className="empty">Loading…</div>}
      {!loading && (
        <div className="artist-grid">
          {artists.map((a) => (
            <Link to={`/artists/${a._id}`} className="artist-card" key={a._id}>
              <div className="av-lg">{(a.name || '?').slice(0, 2).toUpperCase()}</div>
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
    </section>
  );
}
