export default function Stat({ label, value, warn }) {
  return (
    <div className="card p-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div
        className={
          'tnum mt-1 break-words text-2xl font-medium tracking-tight ' +
          (warn ? 'text-red-700 dark:text-red-400' : 'text-ink dark:text-gray-100')
        }
      >
        {value}
      </div>
    </div>
  );
}
