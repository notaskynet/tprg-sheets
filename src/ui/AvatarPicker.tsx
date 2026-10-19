// The sheet-header avatar: click to upload a picture, menu to replace or remove it.
import { useRef } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { Avatar, imageToAvatar } from '@/ui/Avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/ui/components/dropdown-menu';

export function AvatarPicker({ src, name, onChange }: { src?: string; name: string; onChange: (src: string | undefined) => void }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    try { onChange(await imageToAvatar(file)); } catch { alert(t('imageFailed')); }
  }

  const trigger = <Avatar src={src} name={name} className="size-14 text-2xl hover:border-text-mute transition-colors" />;
  return (
    <>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      {src ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="print-hidden rounded-full shrink-0" aria-label={t('photo')}>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => input.current?.click()}>{t('replacePhoto')}</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => onChange(undefined)}>{t('removePhoto')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button type="button" onClick={() => input.current?.click()} title={t('uploadPhoto')} aria-label={t('uploadPhoto')} className="print-hidden rounded-full shrink-0">{trigger}</button>
      )}
    </>
  );
}
