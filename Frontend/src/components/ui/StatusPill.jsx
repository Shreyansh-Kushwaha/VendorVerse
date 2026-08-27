const COLORS = {
  Pending:        'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  Accepted:       'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  Packed:         'bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300',
  OutForDelivery: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300',
  Delivered:      'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  Rejected:       'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  Cancelled:      'bg-gray-100 text-gray-700 dark:bg-night-700 dark:text-gray-300',
};

const LABELS = { OutForDelivery: 'Out for delivery' };

export default function StatusPill({ status, wide }) {
  const s = status || 'Pending';
  return (
    <span className={`${wide ? 'px-3' : 'px-2.5'} py-1 rounded-full text-xs font-medium whitespace-nowrap ${COLORS[s] || COLORS.Cancelled}`}>
      {LABELS[s] || s}
    </span>
  );
}
