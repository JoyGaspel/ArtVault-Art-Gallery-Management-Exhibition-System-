import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function initials(name = '') {
  return name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function LinkItem({ to, children, icon, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={children}
      aria-label={children}
      className={({ isActive }) => `responsive-nav-link${isActive ? ' active' : ''}`}
    >
      <span className="responsive-nav-link-icon" aria-hidden="true">{icon}</span>
      <span className="responsive-nav-link-label">{children}</span>
    </NavLink>
  );
}

export default function ResponsiveNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('search') || '');
  const isAdmin = ['admin', 'sub_admin', 'main_admin'].includes(user?.role);
  const isMainAdmin = user?.role === 'main_admin';
  const isArtist = user?.role === 'artist';
  const canEditProfile = ['artist', 'admin', 'sub_admin', 'main_admin'].includes(user?.role);

  useEffect(() => {
    setQuery(new URLSearchParams(location.search).get('search') || '');
  }, [location.pathname, location.search]);

  function signOut() {
    logout();
    navigate('/login', { replace: true });
  }

  function updateSearch(value) {
    setQuery(value);
    const params = new URLSearchParams(location.search);
    const trimmed = value.trim();
    if (trimmed) params.set('search', trimmed);
    else params.delete('search');
    const nextQuery = params.toString();
    navigate({ pathname: location.pathname, search: nextQuery ? `?${nextQuery}` : '' }, { replace: true });
  }

  function onSearch(event) {
    event.preventDefault();
    updateSearch(query);
    setMenuOpen(false);
  }

  return (
    <nav className={`responsive-nav${isAdmin ? ' admin-responsive-nav' : ''}${menuOpen ? ' menu-open' : ''}`} aria-label="Main navigation">
      <NavLink to="/" className="responsive-brand" aria-label="ArtVault home">
        <img className="responsive-brand-mark" src="/artvault-logos/artvault_logo_lightbg.png" alt="" />
        <span>ArtVault</span>
      </NavLink>

      <form className="responsive-search" onSubmit={onSearch} role="search">
        <span aria-hidden="true">Search</span>
        <input type="search" aria-label="Search the gallery" placeholder="Search artworks, artists, exhibits" value={query} onChange={(event) => updateSearch(event.target.value)} />
      </form>

      <div className="responsive-nav-links">
        <LinkItem to="/" icon="⌂" end>Gallery</LinkItem>
        <LinkItem to="/artists" icon="♙">Artists</LinkItem>
        <LinkItem to="/exhibits" icon="▦">Exhibits</LinkItem>
        {isArtist && <>
          <LinkItem to="/upload" icon="＋">Upload</LinkItem>
          <LinkItem to={`/artists/${user.id}`} icon="◎">My profile</LinkItem>
          <LinkItem to="/settings" icon="⚙">Settings</LinkItem>
        </>}
        {canEditProfile && !isArtist && <LinkItem to="/settings" icon="⚙">Settings</LinkItem>}
        {isAdmin && <>
          <LinkItem to="/manage-gallery" icon="▣">Manage gallery</LinkItem>
          <LinkItem to="/manage-exhibits" icon="▤">Manage exhibits</LinkItem>
          <LinkItem to="/manage-artists" icon="⚙">Manage artists</LinkItem>
          {isMainAdmin && <LinkItem to="/manage-sub-admins" icon="⚡">Manage sub-admins</LinkItem>}
          <LinkItem to="/archives" icon="▱">Archives</LinkItem>
          {['sub_admin', 'main_admin'].includes(user?.role) && <LinkItem to="/audit-logs" icon="☷">{isMainAdmin ? 'Activity logs' : 'Artist activity'}</LinkItem>}
        </>}
        {user && <button type="button" className="responsive-menu-signout" onClick={signOut} aria-label="Sign out" title="Sign out">Sign out</button>}
      </div>

      <button className="responsive-menu-toggle" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen}>
        <span aria-hidden="true">☰</span>
      </button>

      <div className="responsive-account">
        {user ? <>
          <NavLink className="responsive-user" to={isArtist ? `/artists/${user.id}` : '/manage-exhibits'} title="Open account area">
            {user.avatar_path ? <img className="responsive-avatar responsive-avatar-image" src={user.avatar_path} alt="" /> : <span className="responsive-avatar">{initials(user.name)}</span>}
            <span className="responsive-user-name">{user.name}</span>
          </NavLink>
        </> : <>
          <NavLink className="responsive-login" to="/login">Log in</NavLink>
          <NavLink className="responsive-join" to="/signup">Sign up</NavLink>
        </>}
      </div>
    </nav>
  );
}
