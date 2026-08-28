import { useState } from 'react';

const SIZES = {
  sm:     'h-10 w-10 shrink-0',
  md:     'h-16 w-16 shrink-0',
  square: 'aspect-square w-full',
};

// Most listings have no photo, so the fallback is what the catalog actually
// looks like. Tinting it by category turns a column of identical grey squares
// into something you can scan — the colour is carrying the category, not
// decorating the row.
const CATEGORY_TONES = {
  vegetables: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  fruits:     'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
  spices:     'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  grains:     'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300',
  dairy:      'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  others:     'bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-300',
};

// Falls back to the first letter when there is no image or the URL has rotted.
export default function Thumb({ src, alt, size = 'md', rounded = true, category }) {
  const [failed, setFailed] = useState(false);
  const cls = `${SIZES[size] || SIZES.md} ${rounded ? 'rounded-lg' : ''}`;

  if (!src || failed) {
    const tone = CATEGORY_TONES[category] || CATEGORY_TONES.others;
    return (
      <div className={`${cls} ${tone} grid place-items-center font-semibold`}>
        {alt?.[0]?.toUpperCase() || '?'}
      </div>
    );
  }
  return <img src={src} alt={alt} onError={() => setFailed(true)} className={`${cls} object-cover`} />;
}
