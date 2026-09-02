import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Topbar() {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = ['admin', 'sub_admin', 'main_admin'].includes(user?.role);
  const isArtist = user?.role === 'artist' || user?.role === 'main_admin';

  function onSearch(event) {
    event.preventDefault();
    if (q.trim()) navigate(`/?search=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header className="topbar">
      <form className="search" onSubmit={onSearch} role="search">
        <span className="search-icon" aria-hidden="true">Search</span>
        <input
          type="search"
          aria-label="Search the gallery"
          placeholder="Search artworks, artists, exhibits"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </form>
      <div className="topbar-spacer" />
      {isArtist && <button className="btn btn-primary" type="button" onClick={() => navigate('/upload')}>Upload artwork</button>}
      {isAdmin && <button className="btn btn-primary" type="button" onClick={() => navigate('/manage-gallery')}>Moderate gallery</button>}
      {!user && (
        <div className="topbar-guest-actions">
          <Link className="btn btn-ghost" to="/login">Sign in</Link>
          <Link className="btn btn-primary" to="/signup">Join as artist</Link>
        </div>
      )}
    </header>
  );
}
