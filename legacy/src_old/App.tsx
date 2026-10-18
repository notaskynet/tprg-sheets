import { useEffect } from 'react';
import { I18nProvider } from '@/i18n/I18nContext';
import { AuthProvider } from '@/cloud/AuthContext';
import { Dashboard } from '@/screens/Dashboard';
import { SheetScreen } from '@/screens/SheetScreen';
import { StorytellerView } from '@/screens/StorytellerView';
import { migrateLegacy } from '@/store/characters';
import { useRoute, goSheet } from '@/routing';

function Router() {
  const route = useRoute();

  switch (route.name) {
    case 'sheet':
      // key by id so switching characters remounts (fresh wizard flag, state).
      return <SheetScreen key={route.charId} charId={route.charId} />;
    case 'view':
      return <StorytellerView key={`${route.uid}/${route.charId ?? ''}`} uid={route.uid} charId={route.charId} />;
    case 'dashboard':
    default:
      return <Dashboard onCreate={(id) => goSheet(id)} />;
  }
}

export default function App() {
  useEffect(() => {
    migrateLegacy();
  }, []);

  return (
    <I18nProvider>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </I18nProvider>
  );
}
