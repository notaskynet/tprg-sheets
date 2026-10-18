import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isCloudConfigured } from './config';
import { onAuthChange, signInWithGoogle, signOutCloud, type CloudUser } from './firebase';

interface AuthValue {
  configured: boolean;
  ready: boolean; // false until the first auth state is known
  user: CloudUser | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isCloudConfigured();
  const [user, setUser] = useState<CloudUser | null>(null);
  const [ready, setReady] = useState(!configured);

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    let unsub: (() => void) | undefined;
    onAuthChange((u) => { if (alive) { setUser(u); setReady(true); } })
      .then((fn) => { if (alive) unsub = fn; else fn(); })
      .catch(() => { if (alive) setReady(true); });
    return () => { alive = false; unsub?.(); };
  }, [configured]);

  const signIn = useCallback(async () => { await signInWithGoogle(); }, []);
  const signOut = useCallback(async () => { await signOutCloud().catch(() => {}); }, []);
  const value = useMemo<AuthValue>(() => ({ configured, ready, user, signIn, signOut }), [configured, ready, user, signIn, signOut]);
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
