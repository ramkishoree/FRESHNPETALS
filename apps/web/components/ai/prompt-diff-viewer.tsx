import { diffLines } from '@/lib/line-diff';
import { cn } from '@/lib/utils';

export interface PromptDiffViewerProps {
  oldVersion: string;
  newVersion: string;
  oldLabel?: string;
  newLabel?: string;
}

/**
 * Ch.12 §83. Ch.14 §19/§69: prompts are immutable once published — this
 * shows the difference between two versions for review before a new one
 * is approved, it never edits either version in place.
 */
export function PromptDiffViewer({
  oldVersion,
  newVersion,
  oldLabel = 'Previous version',
  newLabel = 'Proposed version',
}: PromptDiffViewerProps) {
  const lines = diffLines(oldVersion, newVersion);

  return (
    <div className="rounded-card border-border text-caption border font-mono">
      <div className="border-border text-muted-foreground flex justify-between border-b px-3 py-2">
        <span>{oldLabel}</span>
        <span>{newLabel}</span>
      </div>
      <div className="overflow-x-auto p-3">
        {lines.map((line, index) => (
          <div
            key={index}
            className={cn(
              'whitespace-pre px-2',
              line.type === 'added' && 'bg-success/10 text-success-text',
              line.type === 'removed' && 'bg-destructive/10 text-destructive line-through',
            )}
          >
            <span aria-hidden="true">
              {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
            </span>
            {line.text || ' '}
          </div>
        ))}
      </div>
    </div>
  );
}
