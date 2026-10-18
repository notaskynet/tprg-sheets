// Markdown view (GFM, no raw HTML) with clickable task-list checkboxes.
import { useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const TASK = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/gm;

/** Toggle the nth task marker (`- [ ]` / `- [x]`) in the source. */
export function toggleTask(src: string, index: number): string {
  let i = -1;
  return src.replace(TASK, (m, pre: string, mark: string) => (++i === index ? `${pre}[${mark === ' ' ? 'x' : ' '}]` : m));
}

export function Markdown({ source, onChange }: { source: string; onChange?: (next: string) => void }) {
  const counter = useRef(0);
  counter.current = 0; // reset each render; checkboxes render in document order
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
          input: (props) => {
            if (props.type !== 'checkbox') return <input {...props} />;
            const idx = counter.current++;
            return (
              <input
                type="checkbox"
                checked={!!props.checked}
                disabled={!onChange}
                onClick={(e) => e.stopPropagation()}
                onChange={() => onChange?.(toggleTask(source, idx))}
                className="accent-brand"
              />
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
