import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // The session check is a round trip. Redirecting before it lands would bounce
  // every signed-in user to /login on a hard refresh.
  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
        <span className="sr-only">Checking your session…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (role && user.userType !== role) {
    const correct =
      user.userType === 'admin'    ? '/admin' :
      user.userType === 'supplier' ? '/supplier' : '/vendor';
    return <Navigate to={correct} replace />;
  }
  return children;
}
