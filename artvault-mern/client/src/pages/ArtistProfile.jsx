import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import ArtCard from '../components/ArtCard';
import { useAuth } from '../context/AuthContext';

export default function ArtistProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [artist, setArtist] = useState(null);
  const [artworks, setArtworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [columnCount, setColumnCount] = useState(() => profileColumnCount());

  useEffect(() => {
    const onResize = () => setColumnCount(profileColumnCount());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/artists/${id}`)
      .then((res) => {
        setArtist(res.data.artist);
        setArtworks(res.data.artworks);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="empty">Loading…</div>;
  if (!artist) return <div className="empty">Artist not found.</div>;

  return (
    <section>
      <button className="back-link" onClick={() => navigate(-1)}>← Back</button>
      <div className="profile-head">
        {artist.avatar_path ? <img className="profile-avatar-xl" src={artist.avatar_path} alt={`${artist.name} profile`} /> : <div className="av-xl">{artist.name.slice(0, 2).toUpperCase()}</div>}
        <div>
          <h1 style={{ fontSize: 24 }}>{artist.name}</h1>
          <div className="chip-row" style={{ margin: '8px 0 0' }}>
            {(artist.specializations || []).map((s) => (
              <span className="chip active" key={s} style={{ cursor: 'default' }}>{s}</span>
            ))}
          </div>
          {user && String(user.id) === String(artist._id) && (
            <Link className="btn btn-ghost btn-sm profile-edit-link" to="/settings">Edit profile</Link>
          )}
        </div>
      </div>
      <p className="profile-bio">{artist.bio}</p>
      <div className="eyebrow">Portfolio</div>
      {artworks.length === 0 ? (
        <div className="empty">No published pieces yet.</div>
      ) : (
        <div className="gallery-masonry" style={{ '--gallery-columns': columnCount, marginTop: 14 }}>
          {Array.from({ length: columnCount }, (_, column) => (
            <div className="gallery-masonry-column" key={column}>
              {artworks.filter((_, index) => index % columnCount === column).map((w) => (
                <ArtCard key={w._id} artwork={{ ...w, artist }} />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function profileColumnCount() {
  if (typeof window === 'undefined') return 1;
  if (window.innerWidth <= 390) return 1;
  if (window.innerWidth <= 860) return 2;
  return 4;
}
