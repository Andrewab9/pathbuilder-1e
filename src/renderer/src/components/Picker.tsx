import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Check, Search } from 'lucide-react';
import { Button, Modal, Select, Toggle, cx, inputCls } from './ui';

export interface PickerFilter<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  test: (item: T, value: string) => boolean;
}

export interface BrowserProps<T> {
  items: T[];
  getId: (t: T) => string;
  getName: (t: T) => string;
  searchText?: (t: T) => string;
  renderRow?: (t: T) => ReactNode;
  renderDetail: (t: T) => ReactNode;
  filters?: PickerFilter<T>[];
  toggle?: { label: string; test: (t: T) => boolean; default?: boolean };
  onPick?: (t: T) => void;
  pickLabel?: string;
  onCancel?: () => void;
  selectedIds?: Set<string>;
  /** Stato del singolo elemento (es. requisiti non soddisfatti) per colorare la riga. */
  rowTone?: (t: T) => 'ok' | 'bad' | undefined;
  autoFocus?: boolean;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Elenco ricercabile e filtrabile con pannello di dettaglio. */
export function Browser<T>(props: BrowserProps<T>) {
  const { items, getId, getName, renderDetail, filters = [], toggle, onPick, pickLabel = 'Seleziona', selectedIds, rowTone } = props;
  const [q, setQ] = useState('');
  const [fv, setFv] = useState<Record<string, string>>({});
  const [toggleOn, setToggleOn] = useState(toggle?.default ?? false);
  const [sel, setSel] = useState<T | undefined>();
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const nq = norm(q.trim());
    const words = nq.split(/\s+/).filter(Boolean);
    let list = items.filter((it) => {
      for (const f of filters) {
        const v = fv[f.key];
        if (v && !f.test(it, v)) return false;
      }
      if (toggle && toggleOn && !toggle.test(it)) return false;
      if (!words.length) return true;
      const hay = norm(props.searchText ? props.searchText(it) : getName(it));
      return words.every((w) => hay.includes(w));
    });
    if (nq) list = [...list].sort((a, b) => Number(!norm(getName(a)).startsWith(nq)) - Number(!norm(getName(b)).startsWith(nq)));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q, fv, toggleOn]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({ count: filtered.length, getScrollElement: () => parentRef.current, estimateSize: () => 40, overscan: 12 });

  useEffect(() => {
    if (!sel || !filtered.includes(sel)) setSel(filtered[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-[40%] min-w-80 flex-col border-r border-line">
        <div className="space-y-2 border-b border-line p-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              ref={searchRef}
              autoFocus={props.autoFocus !== false}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca…"
              className={cx(inputCls, 'w-full pl-9')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && sel && onPick) onPick(sel);
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const i = sel ? filtered.indexOf(sel) : -1;
                  const n = Math.max(0, Math.min(filtered.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
                  setSel(filtered[n]);
                  virt.scrollToIndex(n);
                }
              }}
            />
          </div>
          {(filters.length > 0 || toggle) && (
            <div className="flex flex-wrap items-center gap-2">
              {filters.map((f) => (
                <Select key={f.key} value={fv[f.key] ?? ''} onChange={(e) => setFv({ ...fv, [f.key]: e.target.value })} className="h-8 max-w-48 text-xs">
                  <option value="">{f.label}: tutti</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ))}
              {toggle && <Toggle checked={toggleOn} onChange={setToggleOn} label={<span className="text-xs">{toggle.label}</span>} />}
            </div>
          )}
          <div className="text-[11px] text-muted">{filtered.length.toLocaleString('it-IT')} risultati</div>
        </div>
        <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
          <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
            {virt.getVirtualItems().map((vi) => {
              const it = filtered[vi.index];
              const id = getId(it);
              const active = sel === it;
              const tone = rowTone?.(it);
              return (
                <button
                  key={vi.key}
                  onClick={() => setSel(it)}
                  onDoubleClick={() => onPick?.(it)}
                  className={cx('absolute left-0 flex w-full items-center gap-2 border-b border-line/50 px-3 text-left text-sm', active ? 'bg-accent-soft' : 'hover:bg-panel-2')}
                  style={{ top: vi.start, height: vi.size }}
                >
                  {rowTone && <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', tone === 'ok' ? 'bg-ok' : tone === 'bad' ? 'bg-bad' : 'bg-transparent')} />}
                  <span className="min-w-0 flex-1 truncate">{props.renderRow ? props.renderRow(it) : getName(it)}</span>
                  {selectedIds?.has(id) && <Check size={14} className="shrink-0 text-ok" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-auto p-5">{sel ? renderDetail(sel) : <div className="text-muted">Nessun risultato.</div>}</div>
        {onPick && (
          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
            {props.onCancel && (
              <Button variant="ghost" onClick={props.onCancel}>
                Annulla
              </Button>
            )}
            <Button variant="primary" disabled={!sel} onClick={() => sel && onPick(sel)}>
              {pickLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export interface PickerProps<T> extends Omit<BrowserProps<T>, 'onPick' | 'onCancel'> {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  onPick: (t: T) => void;
}

/** Browser dentro una finestra modale, per scegliere un elemento. */
export function Picker<T>({ open, onClose, title, ...rest }: PickerProps<T>) {
  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      {open && <Browser {...rest} onCancel={onClose} />}
    </Modal>
  );
}
