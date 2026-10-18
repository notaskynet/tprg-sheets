// Small themed HSV picker (saturation/value square + hue slider); no native <input type=color>.
import { useRef, type PointerEvent } from 'react';
import { hexToHsv, hsvToHex, type Hsv } from '@/ui/theme';

function useDrag(onMove: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    onMove(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
  };
  return {
    ref,
    onPointerDown: (e: PointerEvent) => { e.currentTarget.setPointerCapture(e.pointerId); move(e); },
    onPointerMove: (e: PointerEvent) => { if (e.buttons) move(e); },
  };
}

export function ColorPicker({ hsv, onChange }: { hsv: Hsv; onChange: (hsv: Hsv, hex: string) => void }) {
  const [h, s, v] = hsv;
  const emit = (next: Hsv) => onChange(next, hsvToHex(next));
  const area = useDrag((x, y) => emit([h, x, 1 - y]));
  const hue = useDrag((x) => emit([x * 360, s || 0.6, v || 0.7]));
  return (
    <div className="flex flex-col gap-3 select-none touch-none">
      <div
        {...area}
        className="relative h-32 rounded-md cursor-crosshair"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${h} 100% 50%)` }}
      >
        <span className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.5)] pointer-events-none" style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, background: hsvToHex(hsv) }} />
      </div>
      <div
        {...hue}
        className="relative h-4 rounded-full cursor-pointer"
        style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
      >
        <span className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.5)] pointer-events-none" style={{ left: `${(h / 360) * 100}%`, background: `hsl(${h} 100% 50%)` }} />
      </div>
    </div>
  );
}

export { hexToHsv };
