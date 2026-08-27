export default function Stat({ label, value, accent, warn }) {
  const tone = warn   ? 'text-red-600 dark:text-red-400'
             : accent ? 'text-brand-600 dark:text-brand-400'
             :          'text-ink dark:text-gray-100';
  return (
    <div className="card p-4">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`font-display text-2xl sm:text-3xl mt-1 break-words ${tone}`}>{value}</div>
    </div>
  );
}
