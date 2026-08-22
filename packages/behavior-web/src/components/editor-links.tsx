import type { EditorLinkQuery } from '@eddy/behavior-contracts';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { editorLinksQuery } from '@/api/queries';
import { cn } from '@/lib/cn';

export type EditorLinksProps = {
  query: EditorLinkQuery;
  className?: string;
};

/**
 * Buttons that open the target in each configured editor.
 *
 * A link whose target file is missing renders disabled rather than hidden, so the
 * user learns the file moved instead of wondering where the button went.
 */
export function EditorLinks({ query, className }: EditorLinksProps) {
  const { data: links, isPending, isError } = useQuery(editorLinksQuery(query));

  if (isPending || isError || links === undefined || links.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {links.map(function toButton(link) {
        if (!link.targetExists) {
          return (
            <span
              key={link.editor}
              title={`${link.path} could not be found`}
              className="text-muted-foreground border-border inline-flex cursor-not-allowed items-center gap-1 rounded-md border px-2 py-1 text-xs opacity-60"
            >
              {link.editor}
            </span>
          );
        }

        return (
          <a
            key={link.editor}
            href={link.url}
            title={link.label}
            className="border-border hover:bg-muted inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors"
          >
            <ExternalLink className="size-3" aria-hidden />
            {link.editor}
          </a>
        );
      })}
    </div>
  );
}
