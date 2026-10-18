// Generic, system-agnostic UI primitives, styled with Tailwind over the design
// tokens in styles/index.css.

// ---------- Dots (trait ratings) ----------

export function Dot({ on, dim, onClick, size = 'md' }: {
  on: boolean;
  dim?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  const px = size === 'lg' ? 'w-3.5 h-3.5' : size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={on ? 'filled' : 'empty'}
      className={[
        px,
        'rounded-full border p-0 cursor-pointer transition-transform hover:scale-[1.18]',
        on ? 'bg-text border-text' : dim ? 'border-line2' : 'bg-transparent border-text-mute',
      ].join(' ')}
    />
  );
}

export function DotRow({ value, max = 5, onChange, dimFrom, size = 'md' }: {
  value: number;
  max?: number;
  onChange?: (v: number) => void;
  dimFrom?: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <div className="inline-flex items-center gap-[3px]">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < value;
        const dim = dimFrom != null && i >= dimFrom;
        return (
          <Dot
            key={i}
            on={filled}
            dim={dim && !filled}
            size={size}
            onClick={onChange ? () => onChange(i + 1 === value ? i : i + 1) : undefined}
          />
        );
      })}
    </div>
  );
}

// ---------- Inputs ----------

export function Field({ label, value, onChange, type = 'text', placeholder, options, list }: {
  label: string;
  value: string | number;
  onChange: (v: string | number) => void;
  type?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  list?: string;
}) {
  const inputCls =
    'bg-transparent border-0 border-b border-line2 text-text text-sm py-1.5 outline-none ' +
    'focus:border-blood placeholder:text-text-dim placeholder:italic min-w-0';
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-text-mute">{label}</span>
      {options ? (
        <select
          className={inputCls + ' field-select cursor-pointer font-body'}
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-surf text-text">
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          className={inputCls}
          type={type}
          value={value ?? ''}
          placeholder={placeholder}
          list={list}
          onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        />
      )}
    </label>
  );
}

// ---------- Save indicator ----------

export type SaveState = 'saving' | 'saved' | 'offline';

export function SavePill({ state, labels }: { state: SaveState; labels: Record<SaveState, string> }) {
  const dot =
    state === 'saving' ? 'bg-gold animate-save-pulse' : state === 'offline' ? 'bg-text-dim' : 'bg-good';
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] uppercase text-text-mute">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {labels[state]}
    </span>
  );
}
