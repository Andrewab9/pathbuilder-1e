import { useState } from 'react';
import { AlertCircle, AlertTriangle, ChevronDown, Info } from 'lucide-react';
import { useComputed, useStore, type Step } from '@/store';
import { ABILITIES, ABILITY_SHORT, SAVES, SAVE_LABEL, signed } from '@/rules/constants';
import { Breakdown, cx } from './ui';

const SECTION_STEP: Record<string, Step> = {
  race: 'race', abilities: 'abilities', classes: 'classes', features: 'features', kinetic: 'kinetic', skills: 'skills', feats: 'feats', traits: 'traits', spells: 'spells', equipment: 'equipment',
};

export function StatsPanel() {
  const data = useComputed();
  const setStep = useStore((s) => s.setStep);
  const [showAll, setShowAll] = useState(false);
  if (!data) return null;
  const { c } = data;
  const errors = c.warnings.filter((w) => w.level !== 'info');
  const infos = c.warnings.filter((w) => w.level === 'info');
  const list = showAll ? [...errors, ...infos] : errors.length ? errors : infos.slice(0, 4);

  return (
    <aside className="no-print w-72 shrink-0 overflow-auto border-l border-line bg-panel">
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-3 gap-1.5">
          {ABILITIES.map((a) => {
            const s = c.abilities[a];
            return (
              <Breakdown key={a} parts={s.parts}>
                <div className="rounded-lg border border-line bg-panel-2 px-2 py-1.5 text-center">
                  <div className="text-[10px] font-semibold tracking-wider text-muted">{ABILITY_SHORT[a]}</div>
                  <div className="font-display text-lg font-semibold leading-tight tabular">{s.total}</div>
                  <div className="text-xs text-accent tabular">{signed(s.mod)}</div>
                </div>
              </Breakdown>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Big label="Punti ferita" value={c.hp.total} parts={c.hp.parts} />
          <Big label="Classe Armatura" value={c.ac.total} parts={c.ac.parts} sub={`Cont. ${c.touch} · Sprov. ${c.flatFooted}`} />
        </div>

        <div className="divide-y divide-line rounded-lg border border-line text-sm">
          <Row label="Iniziativa" value={signed(c.init.total)} parts={c.init.parts} />
          <Row label="Bonus di attacco base" value={signed(c.bab)} />
          <Row label="BMC" value={signed(c.cmb.total)} parts={c.cmb.parts} />
          <Row label="DMC" value={String(c.cmd.total)} parts={c.cmd.parts} />
          {SAVES.map((s) => (
            <Row key={s} label={SAVE_LABEL[s]} value={signed(c.saves[s].total)} parts={c.saves[s].parts} />
          ))}
          <Row label="Velocità" value={`${c.speed.land ?? 0} ft.`} />
          {c.sr > 0 && <Row label="Resistenza incantesimi" value={String(c.sr)} />}
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold text-muted">Gradi e talenti</div>
          <Meter label="Gradi abilità" used={c.skillPoints.used} total={c.skillPoints.total} onClick={() => setStep('skills')} />
          <Meter label="Talenti" used={c.featSlots.filter((s) => s.pick).length} total={c.featSlots.length} onClick={() => setStep('feats')} />
        </div>

        {c.warnings.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-muted">
              <span>Controlli ({errors.length} problemi, {infos.length} da fare)</span>
            </div>
            <div className="space-y-1">
              {list.map((w, i) => (
                <button
                  key={i}
                  onClick={() => w.section && SECTION_STEP[w.section] && setStep(SECTION_STEP[w.section])}
                  className={cx(
                    'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-panel-2',
                    w.level === 'error' ? 'text-bad' : w.level === 'warn' ? 'text-warn' : 'text-muted',
                  )}
                >
                  {w.level === 'error' ? <AlertCircle size={13} className="mt-0.5 shrink-0" /> : w.level === 'warn' ? <AlertTriangle size={13} className="mt-0.5 shrink-0" /> : <Info size={13} className="mt-0.5 shrink-0" />}
                  <span>{w.text}</span>
                </button>
              ))}
            </div>
            {c.warnings.length > list.length && (
              <button onClick={() => setShowAll(true)} className="mt-1 flex items-center gap-1 text-xs text-accent">
                <ChevronDown size={13} /> Mostra tutti ({c.warnings.length})
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function Big({ label, value, parts, sub }: { label: string; value: number; parts: { label: string; value: number }[]; sub?: string }) {
  return (
    <Breakdown parts={parts}>
      <div className="rounded-lg border border-line bg-panel-2 px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</div>
        <div className="font-display text-2xl font-semibold tabular">{value}</div>
        {sub && <div className="text-[10px] text-muted">{sub}</div>}
      </div>
    </Breakdown>
  );
}

function Row({ label, value, parts }: { label: string; value: string; parts?: { label: string; value: number }[] }) {
  const inner = (
    <div className="flex items-center justify-between px-3 py-1.5">
      <span className="text-muted">{label}</span>
      <span className="font-semibold tabular">{value}</span>
    </div>
  );
  return parts ? <Breakdown parts={parts} className="block">{inner}</Breakdown> : inner;
}

function Meter({ label, used, total, onClick }: { label: string; used: number; total: number; onClick: () => void }) {
  const over = used > total;
  return (
    <button onClick={onClick} className="mb-1.5 block w-full text-left">
      <div className="mb-0.5 flex justify-between text-xs">
        <span>{label}</span>
        <span className={cx('tabular', over ? 'text-bad' : used === total ? 'text-ok' : 'text-muted')}>
          {used}/{total}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div className={cx('h-full rounded-full', over ? 'bg-bad' : 'bg-accent')} style={{ width: `${total ? Math.min(100, (used / total) * 100) : 0}%` }} />
      </div>
    </button>
  );
}
