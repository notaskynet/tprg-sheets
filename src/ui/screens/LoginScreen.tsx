// Shown instead of the app when cloud sync is configured and nobody is signed in.
import { LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/cloud/AuthContext';

export function LoginScreen() {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const go = () => signIn().catch((e: { code?: string }) => {
    // Closing the popup is not an error worth a toast.
    if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return;
    console.error('sign-in failed', e);
    toast.error(`${t('signInFailed')}${e?.code ? ` (${e.code})` : ''}`);
  });
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="font-display text-3xl font-semibold">{t('appTitle')}</h1>
      <p className="max-w-sm text-sm text-text-mute">{t('loginNote')}</p>
      <button onClick={go} className="inline-flex h-11 items-center gap-2 rounded-md border border-brand bg-brand px-5 text-on-brand transition-colors hover:border-brand-bright hover:bg-brand-bright">
        <LogIn className="size-4" /> {t('signIn')}
      </button>
    </div>
  );
}
