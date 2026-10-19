// Character picture: the uploaded image, or the first letter of the name.
import { cn } from '@/ui/lib/utils';

export function Avatar({ src, name, className }: { src?: string; name: string; className?: string }) {
  return (
    <div className={cn('rounded-full bg-surf2 border border-line2 flex items-center justify-center font-display overflow-hidden shrink-0 size-11 text-xl', className)}>
      {src ? <img src={src} alt="" className="size-full object-cover" draggable={false} /> : (name || '?').trim().charAt(0).toUpperCase() || '?'}
    </div>
  );
}

const SIZE = 256;

/** Centre-crops the picked file to a small square JPEG data URL (~20 KB), light enough to sync and share with the sheet. */
export async function imageToAvatar(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  try {
    const side = Math.min(bmp.width, bmp.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    bmp.close();
  }
}
