import { NavLink, Link } from 'react-router-dom';

export default function AuthNav({ active }) {
  return (
    <header className="auth-nav">
      <Link to="/" className="auth-nav-brand" aria-label="ArtVault home">
        <img src="/artvault-logo-transparent.png" alt="" />
        <span>ArtVault</span>
      </Link>
      <nav className="auth-nav-links" aria-label="Public navigation">
        <NavLink to="/" end>Gallery</NavLink>
        <NavLink to="/artists">Artists</NavLink>
        <NavLink to="/exhibits">Exhibits</NavLink>
      </nav>
      <div className="auth-nav-actions">
        {active !== 'login' && <Link className="btn btn-ghost btn-sm" to="/login">Sign in</Link>}
        {active !== 'signup' && <Link className="btn btn-primary btn-sm" to="/signup">Join as artist</Link>}
      </div>
    </header>
  );
}
