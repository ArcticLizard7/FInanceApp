import { cn } from '@/utils/cn';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary:   'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800',
    secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-200',
    ghost:     'text-slate-600 hover:bg-slate-100 hover:text-slate-800 active:bg-slate-200',
    danger:    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
    outline:   'border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300',
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-1.5',
    md: 'text-sm px-3.5 py-2',
    lg: 'text-base px-5 py-2.5',
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
