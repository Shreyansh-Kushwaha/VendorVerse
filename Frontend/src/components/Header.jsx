import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import NotificationBell from './NotificationBell.jsx';

export default function Header() {
  const { user, logout } = useAuth();
  const { count: cartCount } = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const showCart = user?.userType === 'vendor';

  const dashHref =
    user?.userType === 'supplier' ? '/supplier' :
    user?.userType === 'vendor'   ? '/vendor'   : '/';

  const handleLogout = async () => {
    await logout();
    setOpen(false);
    navigate('/');
  };

  const linkBase = 'px-3 py-2 rounded-lg text-sm font-medium transition';
  const linkInactive = 'text-gray-600 hover:bg-gray-50 hover:text-ink dark:text-gray-300 dark:hover:bg-night-700 dark:hover:text-gray-100';
  const linkActive = 'bg-gray-100 text-ink dark:bg-night-700 dark:text-gray-100';

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-night-900/90 backdrop-blur border-b border-brand-100 dark:border-night-700 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-ink text-sm font-semibold text-white dark:bg-gray-100 dark:text-ink">
            V
          </div>
          <span className="font-display text-2xl font-bold text-ink dark:text-gray-100">VendorVerse</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {user ? (
            <>
              <NavLink to={dashHref} className={({isActive}) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
                Dashboard
              </NavLink>
              {showCart && (
                <NavLink to="/orders" className={({isActive}) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
                  Orders
                </NavLink>
              )}
              <NavLink to="/profile" className={({isActive}) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
                Profile
              </NavLink>
              {showCart && <CartButton count={cartCount} />}
              <NotificationBell />
              <ThemeToggle className="ml-2" />
              <button onClick={handleLogout} className="btn-ghost ml-2">Log out</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={({isActive}) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
                Login
              </NavLink>
              <ThemeToggle className="ml-2" />
              <Link to="/signup" className="btn-primary ml-2">Get started</Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          {showCart && <CartButton count={cartCount} />}
          {user && <NotificationBell />}
          <ThemeToggle />
          <button
            aria-label="Toggle menu"
            className="p-2 rounded-lg text-gray-700 hover:bg-brand-50 dark:text-gray-300 dark:hover:bg-night-700"
            onClick={() => setOpen(o => !o)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open
                ? <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                : <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />}
            </svg>
          </button>
        </div>
      </div>

      {/* end main bar */}

      {open && (
        <div className="md:hidden border-t border-brand-100 dark:border-night-700 bg-white dark:bg-night-900">
          <div className="px-4 py-3 flex flex-col gap-1">
            {user ? (
              <>
                <NavLink onClick={() => setOpen(false)} to={dashHref} className={({isActive}) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
                  Dashboard
                </NavLink>
                {showCart && (
                  <NavLink onClick={() => setOpen(false)} to="/orders" className={({isActive}) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
                    Orders
                  </NavLink>
                )}
                <NavLink onClick={() => setOpen(false)} to="/profile" className={({isActive}) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
                  Profile
                </NavLink>
                <button onClick={handleLogout} className="btn-ghost mt-2">Log out</button>
              </>
            ) : (
              <>
                <NavLink onClick={() => setOpen(false)} to="/login" className={({isActive}) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
                  Login
                </NavLink>
                <Link onClick={() => setOpen(false)} to="/signup" className="btn-primary mt-2">Get started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function CartButton({ count }) {
  return (
    <Link
      to="/cart"
      aria-label={`Cart (${count} items)`}
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-night-700"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="20" r="1.5" />
        <circle cx="17" cy="20" r="1.5" />
        <path d="M3 3h2l3.4 12.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6" />
      </svg>
      {count > 0 && (
        <span className="tnum absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ink px-1 text-[10px] font-semibold text-white ring-2 ring-white dark:bg-gray-100 dark:text-ink dark:ring-night-900">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
