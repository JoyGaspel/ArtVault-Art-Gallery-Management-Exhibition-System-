import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();

  if (loading) return null; // could render a spinner here
  if (!user) return <Navigate to="/login" replace />;
  const allowedRoles = role === 'admin'
    ? ['admin', 'sub_admin', 'main_admin']
    : role === 'artist'
      ? ['artist', 'main_admin']
    : (Array.isArray(role) ? role : [role]);
  if (role && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}
