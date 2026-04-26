import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-brand-100 dark:border-night-700 bg-white dark:bg-night-900 mt-auto transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand-500 grid place-items-center text-white font-bold">V</div>
            <span className="font-display text-xl text-ink dark:text-gray-100">VendorVerse</span>
          </div>
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            Connecting Indian street food vendors with trusted local suppliers.
          </p>
        </div>
        <FooterCol title="Product" links={[
          ['Home', '/'],
          ['Sign up', '/signup'],
          ['Log in', '/login'],
        ]} />
        <FooterCol title="Company" links={[
          ['About', '/about'],
          ['Contact', '/contact'],
          ['Help center', '/help'],
        ]} />
        <FooterCol title="Legal" links={[
          ['Privacy', '/privacy'],
          ['Terms', '/terms'],
        ]} />
      </div>
      <div className="border-t border-brand-100 dark:border-night-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 text-xs text-gray-500 dark:text-gray-500 flex flex-col sm:flex-row justify-between gap-2">
          <p>© {new Date().getFullYear()} VendorVerse. All rights reserved.</p>
          <p>Made with care for street food dreams.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</div>
      <ul className="mt-3 space-y-2">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link to={href} className="text-gray-700 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
