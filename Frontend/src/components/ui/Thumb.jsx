import { useState } from 'react';

const SIZES = {
  sm:     'h-10 w-10 shrink-0',
  md:     'h-16 w-16 shrink-0',
  square: 'aspect-square w-full',
};

// Falls back to the first letter when there is no image or the URL has rotted.
export default function Thumb({ src, alt, size = 'md', rounded = true }) {
  const [failed, setFailed] = useState(false);
  const cls = `${SIZES[size] || SIZES.md} ${rounded ? 'rounded-lg' : ''}`;

  if (!src || failed) {
    return (
      <div className={`${cls} bg-brand-100 text-brand-700 dark:bg-night-700 dark:text-brand-300 grid place-items-center font-bold`}>
        {alt?.[0]?.toUpperCase() || '?'}
      </div>
    );
  }
  return <img src={src} alt={alt} onError={() => setFailed(true)} className={`${cls} object-cover`} />;
}
