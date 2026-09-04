import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import usePageMeta from '../lib/meta.js';

export default function NotFound() {
  usePageMeta({
    title: 'Page not found',
    description:
      'We could not find the page you were looking for. It may have moved, or the link may be out of date.',
    noIndex: true,
  });
  const { user } = useAuth();
  const home = user
    ? (user.userType === 'supplier' ? '/supplier' : '/vendor')
    : '/';

  return (
    <div className="min-h-[70vh] grid place-items-center px-4">
      <div className="text-center max-w-md">
        <div className="font-display text-7xl sm:text-8xl text-brand-600 dark:text-brand-400">404</div>
        <h1 className="font-display text-3xl text-ink dark:text-gray-100 mt-2">Page not found</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Looks like the page you were looking for doesn't exist or has moved.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <Link to={home} className="btn-primary">Take me home</Link>
          <Link to="/help" className="btn-ghost">Visit help center</Link>
        </div>
      </div>
    </div>
  );
}
