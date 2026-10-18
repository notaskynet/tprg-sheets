// react-markdown + remark-gfm are heavy; load them only when markdown is actually shown.
import { lazy, Suspense } from 'react';

const Inner = lazy(() => import('./Markdown').then((m) => ({ default: m.Markdown })));

export function Markdown(props: { source: string; onChange?: (next: string) => void }) {
  return (
    <Suspense fallback={<div className="md min-h-6" />}>
      <Inner {...props} />
    </Suspense>
  );
}
