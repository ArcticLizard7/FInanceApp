import { cn } from '@/utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  padding?: boolean;
}

export function Card({ children, className, onClick, hover = false, padding = true }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl border border-slate-100 shadow-card',
        padding && 'p-5',
        hover && 'cursor-pointer transition-shadow hover:shadow-card-hover',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  colour?: string;
  onClick?: () => void;
}

export function StatCard({ label, value, icon, trend, colour = 'brand', onClick }: StatCardProps) {
  const colourMap: Record<string, { icon: string; trend: string }> = {
    brand:  { icon: 'bg-brand-50 text-brand-600',  trend: 'text-brand-600' },
    red:    { icon: 'bg-red-50 text-red-600',       trend: 'text-red-600' },
    amber:  { icon: 'bg-amber-50 text-amber-600',   trend: 'text-amber-600' },
    green:  { icon: 'bg-green-50 text-green-600',   trend: 'text-green-600' },
    purple: { icon: 'bg-purple-50 text-purple-600', trend: 'text-purple-600' },
    slate:  { icon: 'bg-slate-50 text-slate-600',   trend: 'text-slate-600' },
  };
  const c = colourMap[colour] ?? colourMap['brand'];

  return (
    <Card hover={!!onClick} onClick={onClick} className="flex items-start gap-4">
      <div className={cn('p-2.5 rounded-xl', c.icon)}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-semibold text-slate-800 mt-0.5">{value}</p>
        {trend && (
          <p className={cn('text-xs mt-1', c.trend)}>
            {trend.value > 0 ? '+' : ''}{trend.value} {trend.label}
          </p>
        )}
      </div>
    </Card>
  );
}
