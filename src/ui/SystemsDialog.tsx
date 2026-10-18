// Installed game systems: import a package (.zip), export one as a template, remove custom ones.
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { strToU8, zipSync } from 'fflate';
import { Download, Trash2, Upload } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { localize } from '@/i18n/lang';
import { filesFromZip, PackageError } from '@/engine/loader';
import { addPackage, getSourceFiles, isBuiltin, removePackage, usePackages } from '@/systems/registry';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/dialog';
import { cn } from '@/ui/lib/utils';

export function SystemsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, lang } = useI18n();
  const packages = usePackages();
  const input = useRef<HTMLInputElement>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);

  async function importFile(file: File | undefined) {
    if (!file) return;
    setIssues([]);
    try {
      const pkg = await addPackage(filesFromZip(new Uint8Array(await file.arrayBuffer())));
      toast.success(`${t('importOk')}: ${localize(pkg.manifest.name, lang)}`);
    } catch (e) {
      setIssues(e instanceof PackageError ? e.issues : [(e as Error).message]);
    }
  }

  async function exportZip(id: string) {
    const files = await getSourceFiles(id);
    if (!files) return;
    const zip = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [`${id}/${k}`, strToU8(v)])));
    const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }));
    Object.assign(document.createElement('a'), { href: url, download: `${id}.zip` }).click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surf border-line2 max-w-[560px] max-h-[92dvh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-[22px] font-semibold">{t('systems')}</DialogTitle></DialogHeader>
        <p className="text-text-mute text-sm">{t('systemsHint')}</p>

        <div className="flex flex-col gap-2">
          {packages.map((p) => (
            <div key={p.manifest.id} className="border border-line2 rounded-md px-3.5 py-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg font-semibold truncate">{localize(p.manifest.name, lang)}</div>
                <div className="font-mono text-[10px] text-text-dim">{p.manifest.id} · v{p.manifest.version} · {isBuiltin(p.manifest.id) ? t('builtIn') : t('customSystem')}</div>
                {p.manifest.credits && <p className="text-[11px] text-text-mute mt-1 leading-snug">{p.manifest.credits}</p>}
              </div>
              <button onClick={() => exportZip(p.manifest.id)} title={t('exportSystem')} aria-label={t('exportSystem')} className="size-9 shrink-0 border border-line2 rounded-md inline-flex items-center justify-center text-text-mute hover:text-text hover:border-text-mute"><Download className="size-4" /></button>
              {!isBuiltin(p.manifest.id) && (
                <button onClick={() => { if (confirm(t('removeSystemConfirm'))) void removePackage(p.manifest.id); }} title={t('removeSystem')} aria-label={t('removeSystem')} className="size-9 shrink-0 border border-line2 rounded-md inline-flex items-center justify-center text-text-mute hover:text-brand-bright hover:border-brand"><Trash2 className="size-4" /></button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void importFile(e.dataTransfer.files[0]); }}
          className={cn('border border-dashed rounded-md py-6 px-4 flex flex-col items-center gap-2 text-sm text-text-mute hover:text-text hover:border-text-mute transition-colors', drag ? 'border-brand text-text' : 'border-line2')}
        >
          <Upload className="size-5" />
          {t('dropZip')}
        </button>
        <input ref={input} type="file" accept=".zip,application/zip" hidden onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ''; }} />

        {issues.length > 0 && (
          <div className="rounded-md border border-brand/45 bg-brand/10 p-3 max-h-48 overflow-y-auto">
            <div className="eyebrow text-brand-bright mb-1.5">{t('importFailed')}</div>
            <ul className="text-xs font-mono flex flex-col gap-1">{issues.map((i, k) => <li key={k}>{i}</li>)}</ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
