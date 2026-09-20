import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get('search') || '');
  const { user } = useAuth();
  const isAdmin = ['admin', 'sub_admin', 'main_admin'].includes(user?.role);
  const isArtist = user?.role === 'artist';

  useEffect(() => {
    setQ(new URLSearchParams(location.search).get('search') || '');
  }, [location.pathname, location.search]);

  function updateSearch(value) {
    setQ(value);
    const params = new URLSearchParams(location.search);
    const trimmed = value.trim();
    if (trimmed) params.set('search', trimmed);
    else params.delete('search');
    const query = params.toString();
    navigate({ pathname: location.pathname, search: query ? `?${query}` : '' }, { replace: true });
  }

  function onSearch(event) {
    event.preventDefault();
    updateSearch(q);
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
          onChange={(event) => updateSearch(event.target.value)}
        />
      </form>
      <div className="topbar-spacer" />
      {isArtist && <button className="btn btn-primary" type="button" onClick={() => navigate('/upload')}>Upload artwork</button>}
      {isAdmin && <>
        <button className="btn btn-primary" type="button" onClick={() => navigate('/manage-gallery')}>Manage gallery</button>
        <button className="btn btn-primary" type="button" onClick={() => navigate('/manage-exhibits')}>Manage exhibits</button>
      </>}
      {!user && (
        <div className="topbar-guest-actions">
          <Link className="btn btn-ghost" to="/login">Sign in</Link>
          <Link className="btn btn-primary" to="/signup">Join as artist</Link>
        </div>
      )}
    </header>
  );
}
