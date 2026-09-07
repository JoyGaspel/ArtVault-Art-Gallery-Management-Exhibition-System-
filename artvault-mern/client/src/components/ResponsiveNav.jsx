import { NavLink, useNavigate } from 'react-router-dom';
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
  const isAdmin = ['admin', 'sub_admin', 'main_admin'].includes(user?.role);
  const isArtist = user?.role === 'artist' || user?.role === 'main_admin';

  function signOut() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <nav className="responsive-nav" aria-label="Main navigation">
      <NavLink to="/" className="responsive-brand" aria-label="ArtVault home">
        <img className="responsive-brand-mark" src="/artvault-logos/artvault_logo_lightbg.png" alt="" />
        <span>ArtVault</span>
      </NavLink>

      <div className="responsive-nav-links">
        <LinkItem to="/" icon="⌂" end>Gallery</LinkItem>
        <LinkItem to="/artists" icon="♙">Artists</LinkItem>
        <LinkItem to="/exhibits" icon="▦">Exhibits</LinkItem>
        {isArtist && <>
          <LinkItem to="/upload" icon="＋">Upload</LinkItem>
          <LinkItem to={`/artists/${user.id}`} icon="◎">My profile</LinkItem>
          <LinkItem to="/settings" icon="⚙">Settings</LinkItem>
        </>}
        {isAdmin && <>
          <LinkItem to="/manage-gallery" icon="▣">Manage gallery</LinkItem>
          <LinkItem to="/manage-exhibits" icon="▤">Manage exhibits</LinkItem>
          <LinkItem to="/manage-artists" icon="♙">Manage artists</LinkItem>
          <LinkItem to="/archives" icon="▱">Archives</LinkItem>
        </>}
      </div>

      <div className="responsive-account">
        {user ? <>
          <NavLink className="responsive-user" to={isArtist ? `/artists/${user.id}` : '/manage-exhibits'} title="Open account area">
            <span className="responsive-avatar">{initials(user.name)}</span>
            <span className="responsive-user-name">{user.name}</span>
          </NavLink>
          <button type="button" className="responsive-signout" onClick={signOut}>Sign out</button>
        </> : <>
          <NavLink className="responsive-login" to="/login">Log in</NavLink>
          <NavLink className="responsive-join" to="/signup">Sign up</NavLink>
        </>}
      </div>
    </nav>
  );
}
