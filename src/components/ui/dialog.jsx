import { cn } from '../../lib/utils';

export function Dialog({ open, onClose, title, children, className }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative z-50 w-full max-w-lg rounded-2xl bg-card p-8 shadow-2xl animate-fade-in mx-4',
          className
        )}
      >
        {title && (
          <h2 className="text-2xl font-semibold mb-6">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}
