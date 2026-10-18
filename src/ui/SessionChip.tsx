// Reminder that this tab is in a live session, shown on every screen but the table.
import { Users } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { useActive } from '@/share/active';
import { formatCode } from '@/share/protocol';
import { goSession, useRoute } from '@/routing';

export function SessionChip() {
  const { t } = useI18n();
  const { status, session } = useActive();
  const route = useRoute();
  if (status === 'idle' || route.name === 'session' || !session) return null;
  return (
    <button onClick={goSession} className="print-hidden fixed left-[18px] bottom-[18px] z-40 inline-flex items-center gap-2 bg-surf border border-line2 rounded-full px-3.5 py-2 text-xs hover:border-text-mute transition-colors shadow-lg">
      <Users className="size-3.5 text-good" /> {t('sessionBar')} <span className="font-mono tracking-wider">{formatCode(session.code)}</span>
    </button>
  );
}
