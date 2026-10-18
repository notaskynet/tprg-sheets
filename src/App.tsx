import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { I18nProvider, useI18n } from '@/i18n/I18nContext';
import { Toaster } from '@/ui/components/sonner';
import { Library } from '@/ui/screens/Library';
import { SessionChip } from '@/ui/SessionChip';
import { Lazy, lazyNamed } from '@/ui/lazy';

const SessionScreen = lazyNamed(() => import('@/ui/screens/SessionScreen'), 'SessionScreen');
const SharedView = lazyNamed(() => import('@/ui/screens/SharedView'), 'SharedView');
import { SheetScreen } from '@/ui/screens/SheetScreen';
import { initStorage, putCharacter } from '@/storage/db';
import { initPackages, getPackage } from '@/systems/registry';
import { readLegacyCharacters } from '@/storage/legacy';
import { useRoute } from '@/routing';
import { resumeSession } from '@/share/active';

const LEGACY_FLAG = 'trpg.legacyImported';

async function boot(): Promise<number> {
  await Promise.all([initStorage(), initPackages()]);
  try {
    if (localStorage.getItem(LEGACY_FLAG)) return 0;
    const pkg = getPackage('vtm-v20');
    const old = pkg ? readLegacyCharacters(pkg) : [];
    old.forEach(putCharacter);
    localStorage.setItem(LEGACY_FLAG, '1');
    return old.length;
  } catch {
    return 0;
  }
}

function Router() {
  const route = useRoute();
  if (route.name === 'sheet') return <SheetScreen key={route.charId} charId={route.charId} />;
  if (route.name === 'session') return <Lazy><SessionScreen /></Lazy>;
  if (route.name === 'shared') return <Lazy><SharedView data={route.data} /></Lazy>;
  return <Library join={route.join} receive={route.receive} />;
}

function Shell() {
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    boot().then((n) => {
      setReady(true);
      resumeSession();
      if (n > 0) toast.success(t('legacyImported') + n);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <Shell />
    </I18nProvider>
  );
}
