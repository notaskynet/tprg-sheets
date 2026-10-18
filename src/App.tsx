import { useEffect, useState } from 'react';
import { I18nProvider, useI18n } from '@/i18n/I18nContext';
import { Toaster } from '@/ui/components/sonner';
import { Library } from '@/ui/screens/Library';
import { SessionChip } from '@/ui/SessionChip';
import { Lazy, lazyNamed } from '@/ui/lazy';

const SessionScreen = lazyNamed(() => import('@/ui/screens/SessionScreen'), 'SessionScreen');
const SharedView = lazyNamed(() => import('@/ui/screens/SharedView'), 'SharedView');
import { SheetScreen } from '@/ui/screens/SheetScreen';
import { initStorage } from '@/storage/db';
import { initPackages } from '@/systems/registry';
import { useRoute } from '@/routing';
import { resumeSession } from '@/share/active';
import { AuthProvider, useAuth } from '@/cloud/AuthContext';
import { startSync } from '@/cloud/sync';

async function boot(): Promise<void> {
  await Promise.all([initStorage(), initPackages()]);
}

function Router() {
  const route = useRoute();
  if (route.name === 'sheet') return <SheetScreen key={route.charId} charId={route.charId} />;
  if (route.name === 'session') return <Lazy><SessionScreen /></Lazy>;
  if (route.name === 'shared') return <Lazy><SharedView data={route.data} /></Lazy>;
  return <Library join={route.join} />;
}

function Shell() {
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const { user } = useAuth();
  const uid = user?.uid;
  useEffect(() => {
    if (!ready || !uid) return;
    return startSync(uid);
  }, [ready, uid]);
  useEffect(() => {
    boot().then(() => {
      setReady(true);
      resumeSession();
    });
  }, []);
  return (
    <>
      {ready ? <Router /> : <div className="flex min-h-full items-center justify-center text-text-mute">{t('loading')}</div>}
      <SessionChip />
      <Toaster />
    </>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </I18nProvider>
  );
}
