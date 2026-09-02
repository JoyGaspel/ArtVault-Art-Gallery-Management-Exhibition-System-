import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const browseLinks = [
  { to: '/', label: 'Gallery', icon: 'G', end: true },
  { to: '/artists', label: 'Artists', icon: 'A' },
  { to: '/exhibits', label: 'Exhibits', icon: 'E' },
];

function initials(name = '') {
  return name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function NavigationLink({ to, label, icon, end = false }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
      <span className="nav-icon" aria-hidden="true">{icon}</span>
      <span className="nav-label">{label}</span>
    </NavLink>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = ['admin', 'sub_admin', 'main_admin'].includes(user?.role);
  const isArtist = user?.role === 'artist' || user?.role === 'main_admin';

  function signOut() {
    logout();
    navigate('/', { replace: true });
  }

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <NavLink to="/" className="brand" aria-label="ArtVault home">
        <img className="brand-mark" src="/artvault-logo-transparent.png" alt="" />
        <span className="nav-label">ArtVault</span>
      </NavLink>

      <nav className="sidebar-nav">
        <div className="nav-group">
          <div className="nav-heading">Discover</div>
          {browseLinks.map((link) => <NavigationLink key={link.to} {...link} />)}
        </div>

        {isArtist && (
          <div className="nav-group">
            <div className="nav-heading">My studio</div>
            <NavigationLink to="/upload" label="Upload artwork" icon="+" />
            <NavigationLink to={`/artists/${user.id}`} label="My public profile" icon="P" />
            <NavigationLink to="/settings" label="Profile settings" icon="S" />
          </div>
        )}

        {isAdmin && (
          <div className="nav-group">
            <div className="nav-heading">Curation</div>
            <NavigationLink to="/manage-gallery" label="Manage gallery" icon="G" />
            <NavigationLink to="/manage-exhibits" label="Manage exhibits" icon="M" />
            <NavigationLink to="/manage-artists" label="Manage artists" icon="A" />
            <NavigationLink to="/archives" label="Archives" icon="R" />
          </div>
        )}
      </nav>

      <div className="side-spacer" />

      {user ? (
        <div className="account-panel">
          <NavLink to={isArtist ? `/artists/${user.id}` : '/manage-exhibits'} className="side-foot">
            <div className="avatar">{initials(user.name)}</div>
            <div className="who nav-label">
              <div className="name">{user.name}</div>
              <div className="role">{user.role === 'main_admin' ? 'Main administrator' : user.role === 'sub_admin' ? 'Sub administrator' : isAdmin ? 'Administrator' : 'Artist account'}</div>
            </div>
          </NavLink>
          <button className="signout-btn" type="button" title="Sign out" aria-label="Sign out" onClick={signOut}>Sign out</button>
        </div>
      ) : (
        <div className="guest-panel">
          <div className="nav-label"><strong>Viewing as guest</strong><span>Sign in to upload or curate.</span></div>
          <NavLink to="/login" className="guest-signin">Sign in</NavLink>
          <NavLink to="/signup" className="guest-signup">Create an artist account</NavLink>
        </div>
      )}
    </aside>
  );
}
