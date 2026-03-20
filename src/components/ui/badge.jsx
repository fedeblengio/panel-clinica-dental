import { cn } from '../../lib/utils';

const statusStyles = {
  Pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
  Confirmada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Cancelada: 'bg-red-50 text-red-700 border-red-200',
  Completada: 'bg-blue-50 text-blue-700 border-blue-200',
  Modificada: 'bg-violet-50 text-violet-700 border-violet-200',
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
