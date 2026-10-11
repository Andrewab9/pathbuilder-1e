import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useComputed, useDb, useStore } from '@/store';
import { Badge, Button, Card, Empty, Html, PageHeader, SourceTag, cx } from '@/components/ui';
import { Picker } from '@/components/Picker';
import type { SpellData } from '@/data/types';
import type { CasterInfo } from '@/rules/compute';
import { ABILITY_LABEL, SCHOOL_LABEL, signed } from '@/rules/constants';
import { bookOptions, useSourceFilter } from '@/hooks';

export function SpellDetail({ s, classId }: { s: SpellData; classId?: string }) {
  const lv = Object.entries(s.levels).map(([k, v]) => `${k} ${v}`).join(', ');
  const row = (label: string, v?: string) =>
    v ? (
      <div className="flex gap-2 text-sm">
        <span className="w-28 shrink-0 text-muted">{label}</span>
        <span>{v}</span>
      </div>
    ) : null;
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-xl font-semibold">{s.name}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge tone="accent">
            {SCHOOL_LABEL[s.school] ?? s.school}
            {s.subschool?.length ? ` (${s.subschool.join(', ')})` : ''}
          </Badge>
          {s.descriptors?.map((d) => <Badge key={d}>{d}</Badge>)}
          {classId && s.levels[classId] !== undefined && <Badge tone="ok">Livello {s.levels[classId]}</Badge>}
          <SourceTag source={s.source} />
        </div>
      </div>
      <div className="space-y-0.5 rounded-lg border border-line bg-panel-2 p-3">
        {row('Livello', lv)}
        {row('Tempo di lancio', s.time)}
        {row('Componenti', s.components)}
        {row('Raggio', s.range)}
        {row('Bersaglio', s.target)}
        {row('Area', s.area)}
        {row('Effetto', s.effect)}
        {row('Durata', s.duration)}
        {row('Tiro salvezza', s.save)}
        {row('Resist. incant.', s.sr === 'yes' ? 'sì' : s.sr === 'no' ? 'no' : undefined)}
      </div>
      <Html html={s.desc} className="text-sm" />
    </div>
  );
}

/** Classi che conoscono l'intera lista e preparano ogni giorno (niente libro). */
const FULL_LIST = new Set(['cleric', 'druid', 'paladin', 'ranger', 'antipaladin', 'warpriest', 'adept', 'hunter', 'shaman', 'medium', 'occultist']);

function CasterCard({ ci }: { ci: CasterInfo }) {
  const db = useDb();
  const { char } = useComputed()!;
  const update = useStore((s) => s.update);
  const allowed = useSourceFilter();
  const [pick, setPick] = useState<{ mode: 'known' | 'prepared'; level: number } | null>(null);
  const sel = char.spells[ci.classId] ?? { known: [], prepared: {} };
  const classSpells = useMemo(() => db.spells.filter((s) => s.levels[ci.classId] !== undefined), [db, ci.classId]);
  const fullList = FULL_LIST.has(ci.classId);
  const hasKnown = !fullList;
  const isPrepared = !!ci.prepared;
  const amod = Math.floor((ci.abilityScore - 10) / 2);
  const levels = ci.perDay.map((p, i) => ({ i, p })).filter((x) => x.p !== null);

  // Incantesimi di dominio dai domini scelti
  const domainNames = char.choices
    .filter((p) => p.classId === ci.classId && p.featureId)
    .map((p) => db.featureById.get(p.featureId!)?.name ?? '')
    .filter((n) => /Domain$|Subdomain$|Bloodline$|Mystery$|Patron$/.test(n));
  const bonusSpells = useMemo(() => {
    const out: { name: string; level: number; from: string }[] = [];
    for (const n of domainNames) {
      const key = n.replace(/ (Domain|Subdomain|Bloodline|Mystery|Patron)$/, '');
      const kind = /Subdomain$/.test(n) ? 'subDomain' : /Domain$/.test(n) ? 'domain' : /Bloodline$/.test(n) ? 'bloodline' : null;
      if (!kind) continue;
      for (const s of db.spells) {
        const lv = s.other?.[kind]?.[key];
        if (lv !== undefined) out.push({ name: s.name, level: lv, from: n });
      }
    }
    return out.sort((a, b) => a.level - b.level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainNames.join('|'), db]);

  const setSel = (fn: (s: typeof sel) => void) =>
    update((x) => {
      const cur = x.spells[ci.classId] ?? { known: [], prepared: {} };
      fn(cur);
      x.spells[ci.classId] = cur;
    });

  const pickerItems = pick
    ? classSpells.filter((s) => {
        const lv = s.levels[ci.classId];
        if (lv > ci.maxSpellLevel || !allowed(s.source)) return false;
        if (pick.mode === 'prepared') {
          if (lv > pick.level) return false;
          if (hasKnown && !sel.known.includes(s.id)) return false;
        }
        return true;
      })
    : [];

  return (
    <Card
      title={`${ci.cls.name} — livello incantatore ${ci.casterLevel}`}
      actions={
        <span className="text-xs text-muted">
          {ABILITY_LABEL[ci.ability]} {ci.abilityScore} · CD {ci.dcBase} + liv. · Concentrazione {signed(ci.casterLevel + amod)}
        </span>
      }
    >
      <table className="mb-4 w-full text-center text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="py-1 text-left font-medium">Livello</th>
            {levels.map((l) => (
              <th key={l.i} className="font-medium">
                {l.i}°
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          <tr>
            <td className="py-1.5 text-left text-muted">Al giorno</td>
            {levels.map((l) => (
              <td key={l.i} className="font-semibold tabular">
                {l.p === 'inf' ? '∞' : l.p}
                {ci.bonus[l.i] > 0 && <span className="ml-0.5 text-[10px] font-normal text-ok">(+{ci.bonus[l.i]})</span>}
              </td>
            ))}
          </tr>
          {ci.known && (
            <tr>
              <td className="py-1.5 text-left text-muted">Conosciuti</td>
              {levels.map((l) => {
                const n = sel.known.filter((id) => db.spellById.get(id)?.levels[ci.classId] === l.i).length;
                const lim = ci.known![l.i];
                return (
                  <td key={l.i} className={cx('tabular', lim !== null && n > lim ? 'text-bad' : n === lim ? 'text-ok' : '')}>
                    {n}/{lim ?? '—'}
                  </td>
                );
              })}
            </tr>
          )}
          {ci.prepared && (
            <tr>
              <td className="py-1.5 text-left text-muted">Preparati</td>
              {levels.map((l) => (
                <td key={l.i} className="tabular">
                  {(sel.prepared[l.i] ?? []).length}/{ci.prepared![l.i] ?? '—'}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
      {ci.domainSlots > 0 && <p className="mb-3 text-xs text-muted">Gli slot preparati includono {ci.domainSlots} slot di dominio per livello (1°+).</p>}

      {hasKnown && (
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">{ci.known ? 'Incantesimi conosciuti' : 'Libro degli incantesimi / formule'}</span>
          </div>
          <SpellLevels
            levels={levels.map((l) => l.i)}
            ids={(lv) => sel.known.filter((id) => db.spellById.get(id)?.levels[ci.classId] === lv)}
            onAdd={(lv) => setPick({ mode: 'known', level: lv })}
            onRemove={(id) => setSel((s) => void (s.known = s.known.filter((x) => x !== id)))}
          />
        </div>
      )}

      {isPrepared && (
        <div>
          <div className="mb-2 text-sm font-semibold">Incantesimi preparati</div>
          <SpellLevels
            levels={levels.map((l) => l.i)}
            ids={(lv) => sel.prepared[lv] ?? []}
            onAdd={(lv) => setPick({ mode: 'prepared', level: lv })}
            onRemove={(id, lv) =>
              setSel((s) => {
                const arr = [...(s.prepared[lv] ?? [])];
                arr.splice(arr.indexOf(id), 1);
                s.prepared[lv] = arr;
              })
            }
            allowDuplicates
          />
        </div>
      )}

      {bonusSpells.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-sm font-semibold">Incantesimi bonus (dominio / linea di sangue)</div>
          <div className="flex flex-wrap gap-1.5">
            {bonusSpells.map((b, i) => (
              <Badge key={i} title={b.from}>
                {b.level}° {b.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {pick && (
        <Picker
          open
          onClose={() => setPick(null)}
          title={pick.mode === 'known' ? `Aggiungi incantesimo — ${ci.cls.name}` : `Prepara incantesimo di ${pick.level}° livello`}
          items={pickerItems}
          getId={(s) => s.id}
          getName={(s) => s.name}
          searchText={(s) => `${s.name} ${s.summary ?? ''} ${(s.descriptors ?? []).join(' ')}`}
          renderRow={(s) => (
            <span className="flex items-center justify-between gap-2">
              <span className="truncate">{s.name}</span>
              <span className="shrink-0 text-[11px] text-muted">
                {s.levels[ci.classId]}° · {SCHOOL_LABEL[s.school] ?? s.school}
              </span>
            </span>
          )}
          filters={[
            {
              key: 'level',
              label: 'Livello',
              options: levels.map((l) => ({ value: String(l.i), label: `${l.i}° livello` })),
              test: (s, v) => s.levels[ci.classId] === +v,
            },
            { key: 'school', label: 'Scuola', options: Object.entries(SCHOOL_LABEL).map(([value, label]) => ({ value, label })), test: (s, v) => s.school === v },
            { key: 'book', label: 'Manuale', options: bookOptions(classSpells.map((s) => s.source)), test: (s, v) => s.source?.book === v },
          ]}
          selectedIds={new Set(pick.mode === 'known' ? sel.known : sel.prepared[pick.level] ?? [])}
          onPick={(s) => {
            setSel((x) => {
              if (pick.mode === 'known') x.known = [...new Set([...x.known, s.id])];
              else x.prepared[pick.level] = [...(x.prepared[pick.level] ?? []), s.id];
            });
            if (pick.mode === 'known') setPick(null);
          }}
          pickLabel={pick.mode === 'known' ? 'Aggiungi' : 'Prepara'}
          renderDetail={(s) => <SpellDetail s={s} classId={ci.classId} />}
        />
      )}
    </Card>
  );
}

function SpellLevels({ levels, ids, onAdd, onRemove, allowDuplicates }: { levels: number[]; ids: (lv: number) => string[]; onAdd: (lv: number) => void; onRemove: (id: string, lv: number) => void; allowDuplicates?: boolean }) {
  const db = useDb();
  return (
    <div className="space-y-2">
      {levels.map((lv) => {
        const list = ids(lv);
        return (
          <div key={lv} className="flex items-start gap-3">
            <div className="w-10 shrink-0 pt-1 text-right font-display text-sm font-semibold text-muted">{lv}°</div>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {list.map((id, i) => (
                <span key={allowDuplicates ? `${id}-${i}` : id} className="inline-flex items-center gap-1 rounded-md border border-line bg-panel-2 py-0.5 pl-2 pr-1 text-sm" title={db.spellById.get(id)?.summary}>
                  {db.spellById.get(id)?.name ?? id}
                  <button className="rounded p-0.5 text-muted hover:text-bad" onClick={() => onRemove(id, lv)}>
                    <X size={12} />
                  </button>
                </span>
              ))}
              <button onClick={() => onAdd(lv)} className="inline-flex items-center gap-1 rounded-md border border-dashed border-accent/60 px-2 py-0.5 text-sm text-accent hover:bg-accent-soft">
                <Plus size={12} /> Aggiungi
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SpellsStep() {
  const { c } = useComputed()!;
  const setStep = useStore((s) => s.setStep);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Incantesimi"
        subtitle="Slot giornalieri calcolati con i bonus della caratteristica da incantatore."
        actions={<Button variant="primary" onClick={() => setStep('equipment')}>Avanti: equipaggiamento</Button>}
      />
      {c.casters.length === 0 ? (
        <Card>
          <Empty title="Nessuna classe incantatrice">Il personaggio non ha classi che lanciano incantesimi.</Empty>
        </Card>
      ) : (
        c.casters.map((ci) => <CasterCard key={ci.classId} ci={ci} />)
      )}
    </div>
  );
}
