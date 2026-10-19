// "Share this sheet": offline snapshot link (+ QR) and file export. Live sharing
// lives in the session screen (stage 6c).
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Copy, Download, Link2Off, Radio } from 'lucide-react';
import type { Character } from '@/engine/character';
import { snapshotLink } from '@/share/snapshot';
import { downloadCharacter } from '@/share/file';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/cloud/AuthContext';
import { createShare, createSnapshotShare, shareLink, snapshotShareId, stopShare, useShares } from '@/cloud/shares';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/dialog';

export function ShareDialog({ ch, title, open, onOpenChange }: { ch: Character; title: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useI18n();
  const [link, setLink] = useState('');
  const [qr, setQr] = useState('');
  const { user } = useAuth();
  const shareId = useShares().get(ch.id);
  const [busy, setBusy] = useState(false);
  const savedShort = snapshotShareId(useShares(), ch.id);
  const [short, setShort] = useState('');
  const [shortQr, setShortQr] = useState('');
  const liveLink = shareId ? shareLink(shareId) : '';

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    snapshotLink(ch).then(async (l) => {
      const svg = await QRCode.toString(l, { type: 'svg', errorCorrectionLevel: 'L', margin: 1, color: { dark: '#14121a', light: '#ffffff' } }).catch(() => '');
      if (!cancelled) { setLink(l); setQr(svg); }
    });
    return () => { cancelled = true; };
  }, [open, ch]);

  async function copy(text = link) {
    try { await navigator.clipboard.writeText(text); toast.success(t('linkCopied')); }
    catch { window.prompt(t('shareLink'), text); }
  }

  useEffect(() => {
    setShort(''); setShortQr('');
    if (!open || !savedShort) return;
    const l = shareLink(savedShort);
    QRCode.toString(l, { type: 'svg', errorCorrectionLevel: 'L', margin: 1, color: { dark: '#14121a', light: '#ffffff' } }).catch(() => '').then((svg) => { setShort(l); setShortQr(svg); });
  }, [open, ch.id, savedShort]);

  async function makeShort() {
    setBusy(true);
    try {
      const l = await createSnapshotShare(ch);
      setShortQr(await QRCode.toString(l, { type: 'svg', errorCorrectionLevel: 'L', margin: 1, color: { dark: '#14121a', light: '#ffffff' } }).catch(() => ''));
      setShort(l);
    } catch { toast.error(t('syncError')); }
    finally { setBusy(false); }
  }

  async function toggleLive() {
    setBusy(true);
    try { await (shareId ? stopShare(ch.id) : createShare(ch)); }
    catch { toast.error(t('syncError')); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surf border-line2 max-w-[460px] max-h-[92dvh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-[22px] font-semibold">{t('shareSheet')}</DialogTitle></DialogHeader>
        {user && (
          <div className="flex flex-col gap-2 border border-line2 rounded-md p-3">
            <div className="eyebrow">{t('liveLink')}</div>
            <p className="text-text-mute text-sm">{t('liveLinkHint')}</p>
            {liveLink && (
              <div className="flex gap-2">
                <input readOnly value={liveLink} onFocus={(e) => e.target.select()} className="flex-1 min-w-0 h-10 bg-ink border border-line2 rounded-md px-3 font-mono text-xs outline-none focus:border-brand" />
                <button onClick={() => copy(liveLink)} aria-label={t('copy')} className="size-10 shrink-0 border border-line2 rounded-md inline-flex items-center justify-center text-text-mute hover:text-text hover:border-text-mute"><Copy className="size-4" /></button>
              </div>
            )}
            <button onClick={toggleLive} disabled={busy} className="h-10 border border-line2 rounded-md text-sm inline-flex items-center justify-center gap-2 text-text-mute hover:text-text hover:border-text-mute transition-colors disabled:opacity-40">
              {shareId ? <><Link2Off className="size-4" /> {t('liveLinkOff')}</> : <><Radio className="size-4" /> {t('liveLinkOn')}</>}
            </button>
          </div>
        )}
        {user && (
          <div className="flex flex-col gap-2 border border-line2 rounded-md p-3">
            <div className="eyebrow">{t('shortLink')}</div>
            <p className="text-text-mute text-sm">{t('shortLinkHint')}</p>
            {short && (
              <div className="flex gap-2">
                <input readOnly value={short} onFocus={(e) => e.target.select()} className="flex-1 min-w-0 h-10 bg-ink border border-line2 rounded-md px-3 font-mono text-xs outline-none focus:border-brand" />
                <button onClick={() => copy(short)} aria-label={t('copy')} className="size-10 shrink-0 border border-line2 rounded-md inline-flex items-center justify-center text-text-mute hover:text-text hover:border-text-mute"><Copy className="size-4" /></button>
              </div>
            )}
            <button onClick={makeShort} disabled={busy} className="h-10 border border-line2 rounded-md text-sm text-text-mute hover:text-text hover:border-text-mute transition-colors disabled:opacity-40">{short ? t('shortLinkRefresh') : t('shortLinkMake')}</button>
            {shortQr && <div className="mx-auto w-40 rounded-md overflow-hidden bg-white p-2 [&>svg]:w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: shortQr }} />}
          </div>
        )}
        <p className="text-text-mute text-sm">{t('shareSnapshotHint')}</p>
        <div className="flex gap-2">
          <input readOnly value={link} onFocus={(e) => e.target.select()} className="flex-1 min-w-0 h-10 bg-ink border border-line2 rounded-md px-3 font-mono text-xs outline-none focus:border-brand" />
          <button onClick={() => copy()} disabled={!link} aria-label={t('copy')} className="size-10 shrink-0 border border-line2 rounded-md inline-flex items-center justify-center text-text-mute hover:text-text hover:border-text-mute disabled:opacity-40"><Copy className="size-4" /></button>
        </div>
        {qr && <div className="mx-auto w-56 rounded-md overflow-hidden bg-white p-2 [&>svg]:w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: qr }} />}
        <button onClick={() => downloadCharacter(ch, title)} className="h-10 border border-line2 rounded-md text-sm inline-flex items-center justify-center gap-2 text-text-mute hover:text-text hover:border-text-mute transition-colors">
          <Download className="size-4" /> {t('exportFile')}
        </button>
      </DialogContent>
    </Dialog>
  );
}
