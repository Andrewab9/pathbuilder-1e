import { useMemo, useState } from 'react';
import { ChevronRight, Plus, X } from 'lucide-react';
import { useComputed, useDb, useStore } from '@/store';
import { Badge, Button, Card, Empty, Html, Input, PageHeader, SourceTag, cx } from '@/components/ui';
import { Picker } from '@/components/Picker';
import type { FeatureData } from '@/data/types';
import type { ChoiceSlot, FeatureEntry, PoolUsage } from '@/rules/compute';
import { uid } from '@/rules/character';
import { bookOptions, useSourceFilter } from '@/hooks';

const TYPE_LABEL: Record<string, string> = { ex: 'Str', su: 'Sop', sp: 'Mag' };

export function FeatureDetail({ f }: { f: FeatureData }) {
  return (
    <div className="space-y-2">
      <h2 className="font-display text-xl font-semibold">{f.name}</h2>
      <div className="flex flex-wrap items-center gap-2">
        {f.type && <Badge>{TYPE_LABEL[f.type] ?? f.type}</Badge>}
        {f.minLevel && <Badge tone="warn">dal {f.minLevel}° livello</Badge>}
        {f.cost !== undefined && <Badge tone="accent">{f.cost} punti evoluzione</Badge>}
        {f.tags?.map((t) => (
          <Badge key={t} tone="accent">
            {t}
          </Badge>
        ))}
        {f.classes && <span className="text-xs text-muted">{f.classes.join(', ')}</span>}
        <SourceTag source={f.source} />
      </div>
      <Html html={f.desc} className="text-sm" />
    </div>
  );
}

function FeatureRow({ fe, onRemove }: { fe: FeatureEntry; onRemove?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cx('rounded-lg border border-line', fe.replaced && 'opacity-50')}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => setOpen(!open)} className="flex flex-1 items-center gap-2 text-left text-sm" disabled={!fe.feature}>
          <ChevronRight size={14} className={cx('shrink-0 text-muted transition-transform', open && 'rotate-90', !fe.feature && 'invisible')} />
          <span className={cx('font-medium', fe.replaced && 'line-through')}>{fe.label}</span>
          {fe.feature?.type && <span className="text-[10px] uppercase text-muted">({TYPE_LABEL[fe.feature.type] ?? fe.feature.type})</span>}
          {fe.archetype && <Badge tone="accent">{fe.archetype}</Badge>}
          {fe.source === 'linked' && <Badge>concesso dalla scelta</Badge>}
          {fe.replaced && <Badge tone="warn">sostituito dall'archetipo</Badge>}
        </button>
        {onRemove && (
          <button onClick={onRemove} className="rounded p-1 text-muted hover:text-bad" title="Rimuovi">
            <X size={14} />
          </button>
        )}
      </div>
      {open && fe.feature && (
        <div className="border-t border-line px-4 py-3">
          <Html html={fe.feature.desc} className="text-sm" />
          <SourceTag source={fe.feature.source} />
        </div>
      )}
    </div>
  );
}

export function FeaturesStep() {
  const db = useDb();
  const { char, c } = useComputed()!;
  const update = useStore((s) => s.update);
  const setStep = useStore((s) => s.setStep);
  const allowed = useSourceFilter();
  const [slot, setSlot] = useState<ChoiceSlot | null>(null);
  const [extraPicker, setExtraPicker] = useState(false);

  const pickFeature = (s: ChoiceSlot, patch: { featureId?: string; text?: string }) =>
    update((x) => {
      x.choices = x.choices.filter((p) => !(p.classId === s.classId && p.choiceKey === s.def.key && p.level === s.level && (p.index ?? 0) === s.index));
      if (patch.featureId || patch.text) x.choices.push({ uid: uid(), classId: s.classId, choiceKey: s.def.key, level: s.level, index: s.index, ...patch });
    });

  const slotItems = useMemo(() => {
    if (!slot || slot.def.kind !== 'feature' || !slot.def.filter) return [];
    let items = db.features.filter(slot.def.filter).filter((f) => allowed(f.source));
    if (slot.def.linkedTo) {
      // Restringe alle opzioni legate alle scelte precedenti (mistero, scuole di impianto…)
      const names = c.choiceSlots
        .filter((s) => s.classId === slot.classId && s.def.key.startsWith(slot.def.linkedTo!) && s.pick?.featureId)
        .map((s) => db.featureById.get(s.pick!.featureId!)?.name.replace(/ School$/, ''))
        .filter(Boolean) as string[];
      if (names.length) {
        const narrowed = items.filter((f) => f.tags?.some((t) => names.includes(t)));
        if (narrowed.length) items = narrowed;
      }
    }
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [slot, db, allowed, c.choiceSlots]);

  const pickedIds = new Set(char.choices.map((p) => p.featureId).filter(Boolean) as string[]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Privilegi di classe"
        subtitle="Privilegi ottenuti per livello, scelte di classe (poteri d'ira, talenti, domini, linee di sangue…) e privilegi degli archetipi."
        actions={<Button variant="primary" onClick={() => setStep('skills')}>Avanti: abilità</Button>}
      />
      {c.classes.length === 0 && <Empty title="Nessuna classe">Aggiungi un livello di classe per vedere i privilegi.</Empty>}

      {c.classes.map((ci) => {
        const feats = c.features.filter((f) => f.classId === ci.cls.id);
        const slots = c.choiceSlots.filter((s) => s.classId === ci.cls.id);
        const levels = [...new Set([...feats.map((f) => f.level), ...slots.map((s) => s.level)])].sort((a, b) => a - b);
        return (
          <Card key={ci.cls.id} title={`${ci.cls.name} ${ci.level}${ci.archetypes.length ? ` · ${ci.archetypes.map((a) => a.name).join(', ')}` : ''}`}>
            <div className="space-y-4">
              {levels.map((lv) => (
                <div key={lv} className="flex gap-4">
                  <div className="w-10 shrink-0 pt-2 text-right font-display text-sm font-semibold text-muted">{lv}°</div>
                  <div className="flex-1 space-y-1.5">
                    {slots
                      .filter((s) => s.level === lv)
                      .map((s) => {
                        const fd = s.pick?.featureId ? db.featureById.get(s.pick.featureId) : undefined;
                        if (s.def.kind === 'text') {
                          return (
                            <div key={s.id} className="flex items-center gap-2 rounded-lg border border-dashed border-accent/50 bg-accent-soft/30 px-3 py-1.5">
                              <span className="text-sm font-medium text-accent">{s.def.label}</span>
                              <Input
                                list={`opts-${s.def.key}`}
                                value={s.pick?.text ?? ''}
                                onChange={(e) => pickFeature(s, { text: e.target.value })}
                                placeholder="Scrivi o scegli…"
                                className="h-7 flex-1"
                              />
                              {s.def.options && (
                                <datalist id={`opts-${s.def.key}`}>
                                  {s.def.options.map((o) => (
                                    <option key={o} value={o} />
                                  ))}
                                </datalist>
                              )}
                            </div>
                          );
                        }
                        return fd ? (
                          <div key={s.id} className="flex items-center gap-2">
                            <div className="flex-1">
                              <FeatureRow fe={{ key: s.id, feature: fd, label: `${s.def.label}: ${fd.name}`, level: lv, source: 'choice' }} onRemove={() => pickFeature(s, {})} />
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => setSlot(s)}>
                              Cambia
                            </Button>
                          </div>
                        ) : (
                          <button
                            key={s.id}
                            onClick={() => setSlot(s)}
                            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-accent/60 bg-accent-soft/30 px-3 py-2 text-left text-sm font-medium text-accent hover:bg-accent-soft"
                          >
                            <Plus size={15} /> Scegli: {s.def.label}
                            {s.def.hint && <span className="ml-auto text-xs font-normal text-muted">{s.def.hint}</span>}
                          </button>
                        );
                      })}
                    {feats
                      .filter((f) => f.level === lv && f.source !== 'choice')
                      .map((f) => (
                        <FeatureRow key={f.key} fe={f} />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {c.pools.map((p) => (
        <PoolCard key={p.classId + p.def.key} pool={p} />
      ))}

      <Card
        title="Privilegi aggiuntivi"
        actions={
          <Button size="sm" onClick={() => setExtraPicker(true)}>
            <Plus size={13} /> Aggiungi privilegio
          </Button>
        }
      >
        <p className="mb-3 text-xs text-muted">
          Per privilegi concessi da archetipi, talenti o regole della casa non gestiti dalle scelte di classe, puoi aggiungere qualsiasi privilegio del compendio.
        </p>
        <div className="space-y-1.5">
          {c.features
            .filter((f) => f.source === 'extra')
            .map((f) => (
              <FeatureRow key={f.key} fe={f} onRemove={() => update((x) => void (x.extraFeatures = x.extraFeatures.filter((id) => id !== f.feature?.id)))} />
            ))}
        </div>
      </Card>

      {slot && slot.def.kind === 'feature' && (
        <Picker
          open
          onClose={() => setSlot(null)}
          title={`${slot.def.label} — ${db.classById.get(slot.classId)?.name} ${slot.level}`}
          items={slotItems}
          getId={(f) => f.id}
          getName={(f) => f.name}
          selectedIds={pickedIds}
          rowTone={(f) => (f.minLevel && f.minLevel > slot.level ? 'bad' : undefined)}
          toggle={{ label: 'Solo disponibili', test: (f) => !f.minLevel || f.minLevel <= slot.level }}
          filters={[
            { key: 'tag', label: 'Categoria', options: [...new Set(slotItems.flatMap((f) => f.tags ?? []))].sort().map((t) => ({ value: t, label: t })), test: (f, v) => !!f.tags?.includes(v) },
            { key: 'book', label: 'Manuale', options: bookOptions(slotItems.map((f) => f.source)), test: (f, v) => f.source?.book === v },
          ]}
          onPick={(f) => {
            pickFeature(slot, { featureId: f.id });
            setSlot(null);
          }}
          renderDetail={(f) => <FeatureDetail f={f} />}
        />
      )}

      <Picker
        open={extraPicker}
        onClose={() => setExtraPicker(false)}
        title="Aggiungi un privilegio"
        items={db.features.filter((f) => allowed(f.source))}
        getId={(f) => f.id}
        getName={(f) => f.name}
        searchText={(f) => `${f.name} ${(f.tags ?? []).join(' ')} ${(f.classes ?? []).join(' ')}`}
        renderRow={(f) => (
          <span className="flex items-center justify-between gap-2">
            <span className="truncate">{f.name}</span>
            <span className="shrink-0 text-xs text-muted">{f.classes?.[0]}</span>
          </span>
        )}
        filters={[
          {
            key: 'class',
            label: 'Classe',
            options: [...new Set(db.features.flatMap((f) => f.classes ?? []))].sort().map((x) => ({ value: x, label: x })),
            test: (f, v) => !!f.classes?.includes(v),
          },
          { key: 'origin', label: 'Origine', options: [{ value: 'base', label: 'Classe base' }, { value: 'archetype', label: 'Archetipo' }, { value: 'prestige', label: 'Prestigio' }], test: (f, v) => f.origin === v },
        ]}
        selectedIds={new Set(char.extraFeatures)}
        onPick={(f) => {
          update((x) => void (x.extraFeatures = [...new Set([...x.extraFeatures, f.id])]));
          setExtraPicker(false);
        }}
        renderDetail={(f) => <FeatureDetail f={f} />}
      />
    </div>
  );
}

/** Scelte a punti (es. evoluzioni dell'eidolon): elenco con costi e punti residui. */
function PoolCard({ pool }: { pool: PoolUsage }) {
  const db = useDb();
  const update = useStore((s) => s.update);
  const allowed = useSourceFilter();
  const [open, setOpen] = useState(false);
  const key = `${pool.classId}:${pool.def.key}`;
  const items = useMemo(() => db.features.filter(pool.def.filter).filter((f) => allowed(f.source)).sort((a, b) => a.name.localeCompare(b.name)), [db, pool.def, allowed]);
  const left = pool.points - pool.used;
  return (
    <Card
      title={
        <span className="flex items-center gap-3">
          {pool.def.label}
          <Badge tone={left < 0 ? 'bad' : left === 0 ? 'ok' : 'accent'} className="!text-xs">
            {pool.used} / {pool.points} punti
          </Badge>
        </span>
      }
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={13} /> Aggiungi
        </Button>
      }
    >
      {pool.def.hint && <p className="mb-3 text-xs text-muted">{pool.def.hint}</p>}
      {pool.picks.length === 0 ? (
        <p className="text-sm text-muted">Nessuna scelta.</p>
      ) : (
        <div className="space-y-1.5">
          {pool.picks.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <Badge tone="accent">{f.cost ?? 1}</Badge>
              <div className="flex-1">
                <FeatureRow
                  fe={{ key: `${f.id}-${i}`, feature: f, label: f.name, level: 0, source: 'choice' }}
                  onRemove={() =>
                    update((x) => {
                      const arr = [...(x.pools[key] ?? [])];
                      arr.splice(i, 1);
                      x.pools[key] = arr;
                    })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {open && (
        <Picker
          open
          onClose={() => setOpen(false)}
          title={`${pool.def.label} — ${left} punti disponibili`}
          items={items}
          getId={(f) => f.id}
          getName={(f) => f.name}
          renderRow={(f) => (
            <span className="flex items-center justify-between gap-2">
              <span className="truncate">{f.name}</span>
              <span className="shrink-0 text-[11px] text-muted">{f.cost ?? 1} pt</span>
            </span>
          )}
          rowTone={(f) => ((f.cost ?? 1) > left ? 'bad' : 'ok')}
          filters={[{ key: 'cost', label: 'Costo', options: [1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n} punti` })), test: (f, v) => (f.cost ?? 1) === +v }]}
          onPick={(f) => {
            update((x) => void (x.pools[key] = [...(x.pools[key] ?? []), f.id]));
            setOpen(false);
          }}
          pickLabel="Aggiungi evoluzione"
          renderDetail={(f) => <FeatureDetail f={f} />}
        />
      )}
    </Card>
  );
}
