import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function ProtectedRoute({ role, children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (role && user.userType !== role) {
    const correct = user.userType === 'supplier' ? '/supplier' : '/vendor';
    return <Navigate to={correct} replace />;
  }
  return children;
}
