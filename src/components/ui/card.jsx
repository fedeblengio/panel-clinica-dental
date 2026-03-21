import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

export function Card({ className, children, ...props }) {
  return (
    <motion.div
      className={cn('rounded-xl border bg-card text-card-foreground shadow-sm', className)}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function CardHeader({ className, children, ...props }) {
  return (
    <div className={cn('flex flex-col space-y-1.5 p-6 pb-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }) {
  return (
    <h3 className={cn('text-xl font-semibold leading-none tracking-tight', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardContent({ className, children, ...props }) {
  return (
    <div className={cn('p-6 pt-0', className)} {...props}>
      {children}
    </div>
  );
}
