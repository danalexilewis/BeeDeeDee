import { AlertCircle, Clock, Inbox, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ApiError } from '@/api/client';
import { cn } from '@/lib/cn';

export type LoadingStateProps = {
  label?: string;
  className?: string;
};

/** Shown while a query is in flight. */
export function LoadingState({ label = 'Loading', className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('text-muted-foreground flex items-center gap-2 p-6 text-sm', className)}
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  className?: string;
};

/** Shown when a query succeeded but produced nothing. */
export function EmptyState({ title, description, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2 p-10 text-center', className)}>
      <Inbox className="text-muted-foreground size-6" aria-hidden />
      <p className="font-medium">{title}</p>
      {description === undefined ? null : (
        <p className="text-muted-foreground max-w-md text-sm">{description}</p>
      )}
    </div>
  );
}

export type ErrorStateProps = {
  error: unknown;
  className?: string;
};

/** True when the failure is the server telling us the index is not ready yet. */
function isNotReady(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as ApiError).status === 503;
}

/**
 * Shown when a query fails.
 *
 * A 503 means the first scan has not finished, which is a normal startup state
 * rather than a fault, so it reads as "indexing" instead of an error.
 */
export function ErrorState({ error, className }: ErrorStateProps) {
  const message = error instanceof Error ? error.message : 'Something went wrong';

  if (isNotReady(error)) {
    return (
      <div
        role="status"
        className={cn('text-muted-foreground flex items-center gap-2 p-6 text-sm', className)}
      >
        <Clock className="size-4" aria-hidden />
        Indexing your specifications, this view will populate shortly.
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        'border-failing/30 bg-failing/10 text-failing m-4 flex items-start gap-2 rounded-md border p-4 text-sm',
        className
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
