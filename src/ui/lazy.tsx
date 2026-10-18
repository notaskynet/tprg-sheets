// Route- and dialog-level code splitting helpers.
import { lazy, Suspense, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react';

/** React.lazy for a named export. */
export function lazyNamed<M extends Record<string, ComponentType<any>>, K extends keyof M>(load: () => Promise<M>, name: K): LazyExoticComponent<M[K]> {
  return lazy(() => load().then((m) => ({ default: m[name] })));
}

/** Mounts a lazily loaded child; shows nothing while its chunk loads. */
export function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
