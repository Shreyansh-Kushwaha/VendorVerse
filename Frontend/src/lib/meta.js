import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Where the app is served from. Search engines need absolute URLs in the
// canonical and og:url tags, and the dev origin is not it — so the deployed
// origin is baked in at build time and only falls back to the live one.
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://vendorverse.app')
  .replace(/\/$/, '');

const SITE_NAME = 'VendorVerse';
const DEFAULT_DESCRIPTION =
  'Order raw ingredients from trusted local suppliers. VendorVerse connects Indian street food vendors with suppliers, with live stock and per-unit pricing.';

// Finds the tag the way the crawler will — by the attribute it keys on — so we
// rewrite the tags already in index.html instead of stacking duplicates next to
// them. Anything missing is created once and then reused on every navigation.
function setTag(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement(selector.startsWith('link') ? 'link' : 'meta');
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/**
 * Sets the title, description and canonical URL for the page that calls it.
 *
 * The app is a client-rendered SPA, so index.html can only carry one generic
 * description. This rewrites the head on every route change, which is what
 * gives each page its own entry in a tab strip, a shared link preview and a
 * JS-executing crawler's index.
 *
 * @param title       Page title, without the site name — appended here so the
 *                    suffix stays consistent. Omit on the landing page.
 * @param description One or two sentences describing this page specifically.
 * @param noIndex     True for pages behind a login or unique to one user, so
 *                    they stay out of search results even if a URL leaks.
 */
export default function usePageMeta({ title, description, noIndex = false } = {}) {
  const { pathname } = useLocation();
  const desc = description || DEFAULT_DESCRIPTION;
  const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — raw materials for street food vendors`;

  useEffect(() => {
    document.title = fullTitle;

    setTag('meta[name="description"]', { name: 'description', content: desc });

    setTag('meta[property="og:title"]', { property: 'og:title', content: fullTitle });
    setTag('meta[property="og:description"]', { property: 'og:description', content: desc });
    setTag('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME });
    setTag('meta[name="twitter:title"]', { name: 'twitter:title', content: fullTitle });
    setTag('meta[name="twitter:description"]', { name: 'twitter:description', content: desc });

    // Query strings are filters and tracking, not distinct pages, so the
    // canonical points at the bare path and search engines pool the ranking.
    const url = SITE_URL + pathname;
    setTag('link[rel="canonical"]', { rel: 'canonical', href: url });
    setTag('meta[property="og:url"]', { property: 'og:url', content: url });

    // Signed-in pages are per-user, so they get an explicit noindex rather than
    // relying on the crawler never finding the URL.
    const robots = document.head.querySelector('meta[name="robots"]');
    if (noIndex) {
      setTag('meta[name="robots"]', { name: 'robots', content: 'noindex, nofollow' });
    } else if (robots) {
      robots.remove();
    }
  }, [fullTitle, desc, noIndex, pathname]);
}
