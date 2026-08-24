import type { FeatureStatus, TestOutcome } from '@eddy/behavior-contracts';
import { cn } from '@/lib/cn';

/** Visual treatment per status — hard ink chips in the Policy Bias style. */
const STATUS_CLASSES: Record<FeatureStatus, string> = {
  passing:
    'bg-[color-mix(in_srgb,var(--passing)_12%,var(--paper))] text-passing border-[var(--ink)]',
  failing:
    'bg-[color-mix(in_srgb,var(--failing)_12%,var(--paper))] text-failing border-[var(--ink)]',
  untested:
    'bg-[color-mix(in_srgb,var(--untested)_12%,var(--paper))] text-untested border-[var(--ink)]',
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

/** A coloured chip showing pass, fail, or untested. */
export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      data-testid="status-badge"
      data-status={status}
      className={cn(
        'inline-flex items-center rounded-[var(--radius)] border-2 px-2 py-0.5 font-mono text-xs font-semibold',
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
