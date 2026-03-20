import { cn } from '../../lib/utils';

const statusStyles = {
  Pendiente: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Confirmada: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Cancelada: 'bg-red-500/15 text-red-400 border-red-500/30',
  Completada: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Modificada: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
};

export function Badge({ status, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium',
        statusStyles[status] || 'bg-secondary text-secondary-foreground',
        className
      )}
    >
      {status}
    </span>
  );
}
