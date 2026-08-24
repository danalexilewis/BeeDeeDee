import { cn } from '@/lib/cn';

export type CoverageBarProps = {
  /** Percentage between 0 and 100. */
  value: number;
  className?: string;
};

/** A horizontal bar showing test coverage, coloured by how complete it is. */
export function CoverageBar({ value, className }: CoverageBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const tone = clamped >= 80 ? 'bg-passing' : clamped >= 40 ? 'bg-primary' : 'bg-failing';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Test coverage"
        className="bg-[var(--paper-muted)] h-1.5 w-full overflow-hidden rounded-[var(--radius)] border border-[var(--ink)]"
      >
        <div
          data-testid="coverage-fill"
          className={cn('h-full transition-[width]', tone)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-muted-foreground w-10 shrink-0 text-right text-xs tabular-nums">
        {clamped}%
      </span>
    </div>
  );
}
