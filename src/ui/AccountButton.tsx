// Header control for the optional cloud account: sign in with Google, or a menu with sync status.
import { Check, CloudAlert, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/cloud/AuthContext';
import { signOutAndClear, useSyncState } from '@/cloud/sync';
import { goLibrary } from '@/routing';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/ui/components/dropdown-menu';

const btn = 'inline-flex items-center gap-1.5 border border-line2 text-text-mute rounded px-3 py-1.5 text-xs hover:text-text hover:border-text-mute transition-colors';

export function AccountButton() {
  const { t } = useI18n();
  const { configured, ready, user, signIn, signOut } = useAuth();
  const sync = useSyncState();
  const leave = async () => {
    if (await signOutAndClear(signOut, (n) => window.confirm(t('signOutUnsynced').replace('{n}', String(n))))) goLibrary();
  };
  if (!configured || !ready) return null;

  if (!user) {
    const go = () => signIn().catch((e: { code?: string }) => {
      // Closing the popup is not an error worth a toast.
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return;
      console.error('sign-in failed', e);
      toast.error(`${t('signInFailed')}${e?.code ? ` (${e.code})` : ''}`);
    });
    return <button onClick={go} title={t('signIn')} className={btn}><LogIn className="size-3.5" /><span className="hidden sm:inline">{t('signIn')}</span></button>;
  }

  const status = sync === 'error'
    ? { icon: <CloudAlert className="size-3.5 text-gold" />, text: t('syncError') }
    : sync === 'syncing'
      ? { icon: <RefreshCw className="size-3.5 animate-spin" />, text: t('syncSyncing') }
      : { icon: <Check className="size-3.5 text-good" />, text: t('syncSynced') };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button title={user.name ?? user.email ?? ''} className="relative inline-flex size-8 items-center justify-center overflow-hidden rounded-full border border-line2 bg-surf text-xs text-text-mute hover:border-text-mute">
          {user.photo ? <img src={user.photo} alt="" referrerPolicy="no-referrer" className="size-full object-cover" /> : (user.name ?? user.email ?? '?').slice(0, 1).toUpperCase()}
          {sync === 'error' && <span className="absolute right-0 bottom-0 size-2 rounded-full bg-gold" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <div className="px-2 py-1.5">
          <div className="text-sm text-text truncate">{user.name ?? user.email}</div>
          {user.name && user.email && <div className="text-xs text-text-mute truncate">{user.email}</div>}
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-text-mute">{status.icon}<span>{status.text}</span></div>
        </div>
        <DropdownMenuItem onSelect={() => void leave()}><LogOut className="size-3.5" />{t('signOut')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
