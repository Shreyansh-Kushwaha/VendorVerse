// Colour is never the only encoding — the label carries the same information,
// so the dot is decoration and the word is the content.
const TONES = {
  Pending:        'bg-amber-500',
  Accepted:       'bg-blue-600',
  Packed:         'bg-blue-600',
  OutForDelivery: 'bg-blue-600',
  Delivered:      'bg-emerald-600',
  Rejected:       'bg-red-600',
  Cancelled:      'bg-gray-400',
};

const LABELS = { OutForDelivery: 'Out for delivery' };

export default function StatusPill({ status, wide }) {
  const s = status || 'Pending';
  return (
    <span
      className={
        'inline-flex items-center gap-2 whitespace-nowrap font-medium text-gray-600 dark:text-gray-300 ' +
        (wide ? 'text-sm' : 'text-xs')
      }
    >
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONES[s] || TONES.Cancelled}`} />
      {LABELS[s] || s}
    </span>
  );
}
