import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, role }) {
  const { user, loading, sessionError, retrySession } = useAuth();

  if (loading) return <div className="empty" role="status">Restoring your session…</div>;
  if (sessionError) return <div className="security-feedback" role="alert">{sessionError} <button className="btn btn-primary" onClick={retrySession}>Retry connection</button></div>;
  if (!user) return <Navigate to="/login" replace />;
  const allowedRoles = role === 'admin'
    ? ['admin', 'sub_admin', 'main_admin']
    : role === 'artist'
      ? ['artist']
    : (Array.isArray(role) ? role : [role]);
  if (role && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}
