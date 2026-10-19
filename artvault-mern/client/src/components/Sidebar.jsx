import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from './Icon';
import ConfirmDialog from './ConfirmDialog';

const browseLinks = [
  { to: '/', label: 'Gallery', icon: '⌂', end: true },
  { to: '/artists', label: 'Artists', icon: '♙' },
  { to: '/exhibits', label: 'Exhibits', icon: '▦' },
];

browseLinks[0].icon = 'gallery';
browseLinks[1].icon = 'artists';
browseLinks[2].icon = 'exhibits';

function initials(name = '') {
  return name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function NavigationLink({ to, label, icon, end = false }) {
  return (
    <NavLink to={to} end={end} title={label} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
      <span className="nav-icon"><Icon name={icon} size={17} /></span>
      <span className="nav-label">{label}</span>
    </NavLink>
  );
}

export default function Sidebar() {
  const offlineReadOnly = import.meta.env.VITE_OFFLINE_READONLY === 'true';
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const isAdmin = ['admin', 'sub_admin', 'main_admin'].includes(user?.role);
  const isMainAdmin = user?.role === 'main_admin';
  const isArtist = user?.role === 'artist';
  const hasAdminActivity = ['sub_admin', 'main_admin'].includes(user?.role);

  function signOut() {
    setConfirmSignOut(false);
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <NavLink to="/" className="brand" aria-label="ArtVault home">
        <img className="brand-mark" src="/artvault-logos/artvault_logo_darkbg.png" alt="" />
        <span className="nav-label">ArtVault</span>
      </NavLink>

      <nav className="sidebar-nav">
        <div className="nav-group">
          <div className="nav-heading">Discover</div>
          {browseLinks.map((link) => <NavigationLink key={link.to} {...link} />)}
          {offlineReadOnly && <NavigationLink to="/offline-workspace" label="Offline drafts & sync" icon="photo" />}
        </div>

        {isArtist && <>
          <div className="nav-group">
            <div className="nav-heading">My studio</div>
            <NavigationLink to="/upload" label="Upload artwork" icon="upload" />
            <NavigationLink to="/my-artworks" label="My artworks" icon="photo" />
            <NavigationLink to="/vault" label="My artwork Vault" icon="vault" />
            <NavigationLink to="/removed-artworks" label="Recently removed" icon="archives" />
          </div>
          <div className="nav-group">
            <div className="nav-heading">Submissions</div>
            <NavigationLink to="/exhibit-submissions" label="Exhibit submissions" icon="submissions" />
            <NavigationLink to="/exhibit-submission-status" label="Submission status" icon="status" />
          </div>
          <div className="nav-group">
            <div className="nav-heading">Account</div>
            <NavigationLink to={`/artists/${user.id}`} label="My public profile" icon="profile" />
            <NavigationLink to="/settings" label="Profile settings" icon="settings" />
          </div>
        </>}

        {isAdmin && <>
          <div className="nav-group">
            <div className="nav-heading">Curation</div>
            <NavigationLink to="/manage-gallery" label="Manage gallery" icon="manageGallery" />
            {hasAdminActivity && <NavigationLink to="/pending-artworks" label="Pending artworks" icon="status" />}
            {hasAdminActivity && <NavigationLink to="/manage-vault" label="Artist Vaults" icon="vault" />}
            <NavigationLink to="/manage-exhibits" label="Manage exhibits" icon="manageExhibits" />
            <NavigationLink to="/manage-exhibit-entries" label="Exhibit entries" icon="entries" />
            <NavigationLink to="/manage-artists" label="Manage artists" icon="artists" />
          </div>
          {isMainAdmin && <div className="nav-group">
            <div className="nav-heading">Administration</div>
            <NavigationLink to="/manage-sub-admins" label="Manage sub-admins" icon="admins" />
          </div>}
          <div className="nav-group">
            <div className="nav-heading">Activity &amp; records</div>
            <NavigationLink to="/archives" label="Archives" icon="archives" />
            {hasAdminActivity && <NavigationLink to="/audit-logs" label={isMainAdmin ? 'Activity logs' : 'Artist activity'} icon="activity" />}
            {isMainAdmin && <NavigationLink to="/artwork-likes" label="Artwork likes" icon="likes" />}
          </div>
          <div className="nav-group">
            <div className="nav-heading">Account</div>
            <NavigationLink to="/settings" label="Account security" icon="settings" />
          </div>
        </>}
      </nav>

      {user ? (
        <div className="account-panel">
          <NavLink to={isArtist ? `/artists/${user.id}` : '/manage-exhibits'} className="side-foot">
            {user.avatar_path ? <img className="avatar avatar-image" src={user.avatar_path} alt="" /> : <div className="avatar">{initials(user.name)}</div>}
            <div className="who nav-label">
              <div className="name">{user.name}</div>
              <div className="role">{user.role === 'main_admin' ? 'Main administrator' : user.role === 'sub_admin' ? 'Sub administrator' : isAdmin ? 'Administrator' : 'Artist account'}</div>
            </div>
          </NavLink>
          <button className="signout-btn" type="button" title="Sign out" aria-label="Sign out" onClick={() => setConfirmSignOut(true)}><Icon name="logout" size={16} /><span>Sign out</span></button>
        </div>
      ) : (
        <div className="guest-panel">
          <div className="nav-label"><strong>{offlineReadOnly ? 'Offline workspace' : 'Viewing as guest'}</strong><span>{offlineReadOnly ? 'Draft changes here; sync after reconnecting.' : 'Sign in to upload or curate.'}</span></div>
          {!offlineReadOnly && <><NavLink to="/login" className="guest-signin">Sign in</NavLink><NavLink to="/signup" className="guest-signup">Create an artist account</NavLink></>}
        </div>
      )}
      {confirmSignOut && <ConfirmDialog title="Sign out of ArtVault?" message="You'll need to sign in again to access your account." confirmLabel="Sign out" onConfirm={signOut} onCancel={() => setConfirmSignOut(false)} />}
    </aside>
  );
}
