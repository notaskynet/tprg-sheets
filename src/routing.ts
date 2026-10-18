// Minimal query-string routing without react-router (GitHub-Pages friendly). Routes:
//   /            -> library
//   /?c=<id>     -> character sheet
import { useSyncExternalStore } from 'react';

export type Route = { name: 'library' } | { name: 'sheet'; charId: string };

function parse(): Route {
  const c = new URLSearchParams(window.location.search).get('c');
  return c ? { name: 'sheet', charId: c } : { name: 'library' };
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('popstate', cb);
  window.addEventListener('trpg:navigate', cb);
  return () => {
    window.removeEventListener('popstate', cb);
    window.removeEventListener('trpg:navigate', cb);
  };
}

let cached = window.location.search;
let cachedRoute = parse();
function getSnapshot(): Route {
  if (window.location.search !== cached) {
    cached = window.location.search;
    cachedRoute = parse();
  }
  return cachedRoute;
}

export const useRoute = (): Route => useSyncExternalStore(subscribe, getSnapshot);

export function navigate(to: Route): void {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  if (to.name === 'sheet') url.searchParams.set('c', to.charId);
  window.history.pushState({}, '', url);
  window.dispatchEvent(new Event('trpg:navigate'));
}

export const goLibrary = () => navigate({ name: 'library' });
export const goSheet = (charId: string) => navigate({ name: 'sheet', charId });
