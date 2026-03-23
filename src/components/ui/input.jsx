import { cn } from '../../lib/utils';

export function Input({ className, label, labelClassName, ...props }) {
  return (
    <div className="space-y-2">
      {label && <label className={cn("text-sm font-medium text-foreground", labelClassName)}>{label}</label>}
      <input
        className={cn(
          'flex h-12 w-full rounded-lg border border-input bg-background px-4 text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    </div>
  );
}

export function Select({ className, label, children, ...props }) {
  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <select
        className={cn(
          'flex h-12 w-full rounded-lg border border-input bg-background px-4 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

export function Textarea({ className, label, ...props }) {
  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <textarea
        className={cn(
          'flex min-h-[100px] w-full rounded-lg border border-input bg-background px-4 py-3 text-base transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none',
          className
        )}
        {...props}
      />
    </div>
  );
}
