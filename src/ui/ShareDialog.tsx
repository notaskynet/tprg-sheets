// "Share this sheet": offline snapshot link (+ QR) and file export. Live sharing
// lives in the session screen (stage 6c).
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Copy, Download } from 'lucide-react';
import type { Character } from '@/engine/character';
import { snapshotLink } from '@/share/snapshot';
import { downloadCharacter } from '@/share/file';
import { useI18n } from '@/i18n/I18nContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/dialog';

export function ShareDialog({ ch, title, open, onOpenChange }: { ch: Character; title: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useI18n();
  const [link, setLink] = useState('');
  const [qr, setQr] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    snapshotLink(ch).then(async (l) => {
      const svg = await QRCode.toString(l, { type: 'svg', errorCorrectionLevel: 'L', margin: 1, color: { dark: '#14121a', light: '#ffffff' } }).catch(() => '');
      if (!cancelled) { setLink(l); setQr(svg); }
    });
    return () => { cancelled = true; };
  }, [open, ch]);

  async function copy() {
    try { await navigator.clipboard.writeText(link); toast.success(t('linkCopied')); }
    catch { window.prompt(t('shareLink'), link); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surf border-line2 max-w-[460px] max-h-[92dvh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-[22px] font-semibold">{t('shareSheet')}</DialogTitle></DialogHeader>
        <p className="text-text-mute text-sm">{t('shareSnapshotHint')}</p>
        <div className="flex gap-2">
          <input readOnly value={link} onFocus={(e) => e.target.select()} className="flex-1 min-w-0 h-10 bg-ink border border-line2 rounded-md px-3 font-mono text-xs outline-none focus:border-brand" />
          <button onClick={copy} disabled={!link} aria-label={t('copy')} className="size-10 shrink-0 border border-line2 rounded-md inline-flex items-center justify-center text-text-mute hover:text-text hover:border-text-mute disabled:opacity-40"><Copy className="size-4" /></button>
        </div>
        {qr && <div className="mx-auto w-56 rounded-md overflow-hidden bg-white p-2 [&>svg]:w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: qr }} />}
        <button onClick={() => downloadCharacter(ch, title)} className="h-10 border border-line2 rounded-md text-sm inline-flex items-center justify-center gap-2 text-text-mute hover:text-text hover:border-text-mute transition-colors">
          <Download className="size-4" /> {t('exportFile')}
        </button>
      </DialogContent>
    </Dialog>
  );
}
