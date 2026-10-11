import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus, X } from 'lucide-react';
import type { Part } from '@/rules/compute';
import { signed } from '@/rules/constants';
import type { Source } from '@/data/types';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'ghost' | 'outline' | 'danger' | 'soft';
export function Button({ variant = 'outline', size = 'md', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 select-none whitespace-nowrap',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-accent text-accent-fg hover:brightness-110',
        variant === 'ghost' && 'text-muted hover:text-fg hover:bg-panel-2',
        variant === 'outline' && 'border border-line bg-panel hover:bg-panel-2',
        variant === 'soft' && 'bg-accent-soft text-accent hover:brightness-110',
        variant === 'danger' && 'text-bad hover:bg-bad/10',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({ className, children, title, actions }: { className?: string; children: ReactNode; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={cx('rounded-xl border border-line bg-panel', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h3 className="font-display text-sm font-semibold tracking-wide">{title}</h3>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Badge({ children, tone = 'neutral', className, title }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'ok' | 'bad' | 'warn'; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none',
        tone === 'neutral' && 'bg-panel-2 text-muted border border-line',
        tone === 'accent' && 'bg-accent-soft text-accent',
        tone === 'ok' && 'bg-ok/15 text-ok',
        tone === 'bad' && 'bg-bad/15 text-bad',
        tone === 'warn' && 'bg-warn/15 text-warn',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cx('flex flex-col gap-1', className)}>
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'h-9 rounded-lg border border-line bg-panel-2 px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 placeholder:text-muted/60';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}
export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx(inputCls, 'pr-8', props.className)}>
      {children}
    </select>
  );
}

export function Stepper({ value, onChange, min = -Infinity, max = Infinity, className }: { value: number; onChange: (v: number) => void; min?: number; max?: number; className?: string }) {
  return (
    <div className={cx('inline-flex items-center rounded-lg border border-line bg-panel-2', className)}>
      <button className="grid h-7 w-7 place-items-center text-muted hover:text-fg disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus size={13} />
      </button>
      <span className="tabular w-7 text-center text-sm font-semibold">{value}</span>
      <button className="grid h-7 w-7 place-items-center text-muted hover:text-fg disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus size={13} />
      </button>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <span className={cx('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line')} onClick={() => onChange(!checked)}>
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      {label}
    </label>
  );
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cx('inline-flex rounded-lg border border-line bg-panel-2 p-0.5', className)}>
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={cx('rounded-md px-3 py-1 text-xs font-medium transition-colors', value === it.value ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg')}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        className={cx('animate-in flex max-h-full w-full flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl', wide ? 'h-[85vh] max-w-6xl' : 'max-w-xl')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          <button className="rounded-md p-1 text-muted hover:bg-panel-2 hover:text-fg" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/** Numero con tooltip che mostra la scomposizione dei bonus. */
export function Breakdown({ parts, children, className }: { parts: Part[]; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  return (
    <span
      ref={ref}
      className={cx('cursor-help', className)}
      onMouseEnter={() => {
        const r = ref.current!.getBoundingClientRect();
        setPos({ x: r.left + r.width / 2, y: r.bottom + 6 });
        setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open &&
        parts.length > 0 &&
        createPortal(
          <div className="no-print pointer-events-none fixed z-[60] min-w-44 -translate-x-1/2 rounded-lg border border-line bg-panel p-2 text-xs shadow-xl" style={{ left: pos.x, top: pos.y }}>
            {parts.map((p, i) => (
              <div key={i} className="flex justify-between gap-4 py-0.5">
                <span className="text-muted">{p.label}</span>
                <span className="tabular font-medium">{signed(p.value)}</span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </span>
  );
}

export function SourceTag({ source }: { source?: Source }) {
  if (!source?.book) return null;
  return (
    <span className="text-[11px] text-muted">
      {source.book}
      {source.page ? `, p. ${source.page}` : ''}
    </span>
  );
}

export function Html({ html, className }: { html?: string; className?: string }) {
  if (!html) return null;
  const safe = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+="[^"]*"/gi, '');
  return <div className={cx('rules', className)} dangerouslySetInnerHTML={{ __html: safe }} />;
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {icon && <div className="text-muted/60">{icon}</div>}
      <div className="font-medium">{title}</div>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </div>
  );
}
