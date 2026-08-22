import type { FeatureStatus, TestOutcome } from '@eddy/behavior-contracts';
import { cn } from '@/lib/cn';

/** Visual treatment per status, shared by feature and scenario badges. */
const STATUS_CLASSES: Record<FeatureStatus, string> = {
  passing: 'bg-passing/15 text-passing border-passing/30',
  failing: 'bg-failing/15 text-failing border-failing/30',
  untested: 'bg-untested/15 text-untested border-untested/30',
};

const STATUS_LABELS: Record<FeatureStatus, string> = {
  passing: 'Passing',
  failing: 'Failing',
  untested: 'Untested',
};

/** Maps a test outcome onto the three statuses the UI displays. */
export function outcomeToStatus(outcome: TestOutcome): FeatureStatus {
  if (outcome === 'fail') return 'failing';
  if (outcome === 'pass') return 'passing';
  return 'untested';
}

export type StatusBadgeProps = {
  status: FeatureStatus;
  /** Overrides the default label, e.g. to show "Skipped" or "Flaky". */
  label?: string;
  className?: string;
};

/** A coloured pill showing pass, fail, or untested. */
export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      data-testid="status-badge"
      data-status={status}
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        STATUS_CLASSES[status],
        className
      )}
    >
      {label ?? STATUS_LABELS[status]}
    </span>
  );
}

export type OutcomeBadgeProps = {
  outcome: TestOutcome;
  flaky?: boolean;
  className?: string;
};

/** A badge for a raw test outcome, distinguishing skipped and flaky runs. */
export function OutcomeBadge({ outcome, flaky = false, className }: OutcomeBadgeProps) {
  if (flaky) {
    return <StatusBadge status="failing" label="Flaky" className={className} />;
  }

  const labels: Record<TestOutcome, string> = {
    pass: 'Passing',
    fail: 'Failing',
    skipped: 'Skipped',
    'not-run': 'Untested',
  };

  return (
    <StatusBadge status={outcomeToStatus(outcome)} label={labels[outcome]} className={className} />
  );
}
