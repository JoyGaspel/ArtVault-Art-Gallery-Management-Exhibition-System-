import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from './Icon';
import NotificationBell from './NotificationBell';
import ConfirmDialog from './ConfirmDialog';

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
      <span className="responsive-nav-link-icon"><Icon name={icon} size={17} /></span>
      <span className="responsive-nav-link-label">{children}</span>
    </NavLink>
  );
}

export default function ResponsiveNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('search') || '');
  const isAdmin = ['admin', 'sub_admin', 'main_admin'].includes(user?.role);
  const isMainAdmin = user?.role === 'main_admin';
  const isArtist = user?.role === 'artist';
  const hasAdminActivity = ['sub_admin', 'main_admin'].includes(user?.role);

  useEffect(() => {
    setQuery(new URLSearchParams(location.search).get('search') || '');
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  function signOut() {
    setConfirmSignOut(false);
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
    <nav className={`responsive-nav${isAdmin ? ' admin-responsive-nav' : ''}${isArtist ? ' artist-responsive-nav' : ''}${menuOpen ? ' menu-open' : ''}`} aria-label="Main navigation">
      <NavLink to="/" className="responsive-brand" aria-label="ArtVault home">
        <img className="responsive-brand-mark" src="/artvault-logos/artvault_logo_lightbg.png" alt="" />
        <span>ArtVault</span>
      </NavLink>

      <form className="responsive-search" onSubmit={onSearch} role="search">
        <span aria-hidden="true"><Icon name="search" size={15} /></span>
        <input type="search" aria-label="Search the gallery" placeholder="Search artworks, artists, exhibits" value={query} onChange={(event) => updateSearch(event.target.value)} />
      </form>

      <div className="responsive-nav-links">
        {(isArtist || isAdmin) && <span className="responsive-menu-heading">Discover</span>}
        <LinkItem to="/" icon="gallery" end>Gallery</LinkItem>
        <LinkItem to="/artists" icon="artists">Artists</LinkItem>
        <LinkItem to="/exhibits" icon="exhibits">Exhibits</LinkItem>
        {import.meta.env.VITE_OFFLINE_READONLY === 'true' && <LinkItem to="/offline-workspace" icon="photo">Offline drafts &amp; sync</LinkItem>}
        {isArtist && <>
          <span className="responsive-menu-heading">My studio</span>
          <LinkItem to="/upload" icon="upload">Upload</LinkItem>
          <LinkItem to="/my-artworks" icon="photo">My artworks</LinkItem>
          <LinkItem to="/vault" icon="vault">My Vault</LinkItem>
          <LinkItem to="/removed-artworks" icon="archives">Recently removed</LinkItem>
          <span className="responsive-menu-heading">Submissions</span>
          <LinkItem to="/exhibit-submissions" icon="submissions">Exhibit submissions</LinkItem>
          <LinkItem to="/exhibit-submission-status" icon="status">Submission status</LinkItem>
          <span className="responsive-menu-heading">Account</span>
          <LinkItem to={`/artists/${user.id}`} icon="profile">My profile</LinkItem>
          <LinkItem to="/settings" icon="settings">Settings</LinkItem>
        </>}
        {isAdmin && <>
          <span className="responsive-menu-heading">Curation</span>
          <LinkItem to="/manage-gallery" icon="manageGallery">Manage gallery</LinkItem>
          {hasAdminActivity && <LinkItem to="/manage-vault" icon="vault">Artist Vaults</LinkItem>}
          <LinkItem to="/manage-exhibits" icon="manageExhibits">Manage exhibits</LinkItem>
          <LinkItem to="/manage-exhibit-entries" icon="entries">Exhibit entries</LinkItem>
          <LinkItem to="/manage-artists" icon="artists">Manage artists</LinkItem>
          {isMainAdmin && <>
            <span className="responsive-menu-heading">Administration</span>
            <LinkItem to="/manage-sub-admins" icon="admins">Manage sub-admins</LinkItem>
          </>}
          <span className="responsive-menu-heading">Activity &amp; records</span>
          <LinkItem to="/archives" icon="archives">Archives</LinkItem>
          {hasAdminActivity && <LinkItem to="/audit-logs" icon="activity">{isMainAdmin ? 'Activity logs' : 'Artist activity'}</LinkItem>}
          {isMainAdmin && <LinkItem to="/artwork-likes" icon="likes">Artwork likes</LinkItem>}
          <span className="responsive-menu-heading">Account</span>
          <LinkItem to="/settings" icon="settings">Account security</LinkItem>
        </>}
        {user && <button type="button" className="responsive-menu-signout" onClick={() => setConfirmSignOut(true)} aria-label="Sign out" title="Sign out"><Icon name="logout" size={18} /><span>Sign out</span></button>}
      </div>

      <button className="responsive-menu-toggle" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen}>
        <span aria-hidden="true"><Icon name="menu" size={21} /></span>
      </button>
      <NotificationBell />

      <div className="responsive-account">
        {user ? <>
          <NavLink className="responsive-user" to={isArtist ? `/artists/${user.id}` : '/manage-exhibits'} title="Open account area">
            {user.avatar_path ? <img className="responsive-avatar responsive-avatar-image" src={user.avatar_path} alt="" /> : <span className="responsive-avatar">{initials(user.name)}</span>}
            <span className="responsive-user-name">{user.name}</span>
          </NavLink>
        </> : import.meta.env.VITE_OFFLINE_READONLY === 'true' ? <span className="responsive-user-name">Offline gallery</span> : <>
          <NavLink className="responsive-login" to="/login">Log in</NavLink>
          <NavLink className="responsive-join" to="/signup">Sign up</NavLink>
        </>}
      </div>
      {confirmSignOut && <ConfirmDialog title="Sign out of ArtVault?" message="You'll need to sign in again to access your account." confirmLabel="Sign out" onConfirm={signOut} onCancel={() => setConfirmSignOut(false)} />}
    </nav>
  );
}
