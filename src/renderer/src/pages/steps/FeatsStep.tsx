import { useMemo, useState } from 'react';
import { Check, CircleHelp, Plus, X } from 'lucide-react';
import { useComputed, useDb, useStore } from '@/store';
import { Badge, Button, Card, Html, Input, PageHeader, SourceTag, cx } from '@/components/ui';
import { Picker } from '@/components/Picker';
import type { FeatData } from '@/data/types';
import type { FeatSlot } from '@/rules/compute';
import type { PrereqResult } from '@/rules/prereq';
import { uid } from '@/rules/character';
import { bookOptions, useSourceFilter } from '@/hooks';

/** Talenti che richiedono di specificare un'arma, un'abilità, una scuola… */
const NEEDS_DETAIL = /^(Weapon Focus|Greater Weapon Focus|Weapon Specialization|Greater Weapon Specialization|Improved Critical|Skill Focus|Spell Focus|Greater Spell Focus|Exotic Weapon Proficiency|Martial Weapon Proficiency|Elemental Focus|Greater Elemental Focus|Favored Defense|Mythic Weapon Focus|Weapon Mastery|Spell Specialization|Spell Mastery|Extra .+|Expanded Arcana)$/;

export function PrereqChips({ r }: { r: PrereqResult }) {
  if (!r.clauses.length) return <span className="text-xs text-muted">Nessun requisito</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {r.clauses.map((cl, i) => (
        <Badge key={i} tone={cl.status === 'ok' ? 'ok' : cl.status === 'fail' ? 'bad' : 'neutral'} title={cl.status === 'unknown' ? 'Da verificare manualmente' : undefined}>
          {cl.status === 'ok' ? <Check size={10} /> : cl.status === 'fail' ? <X size={10} /> : <CircleHelp size={10} />}
          {cl.text}
        </Badge>
      ))}
    </div>
  );
}

export function FeatDetail({ f, prereq }: { f: FeatData; prereq?: PrereqResult }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-xl font-semibold">{f.name}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {f.types.map((t) => (
            <Badge key={t} tone="accent">
              {t}
            </Badge>
          ))}
          <SourceTag source={f.source} />
        </div>
      </div>
      {f.flavor && <p className="text-sm italic text-muted">{f.flavor}</p>}
      <div>
        <div className="mb-1 text-xs font-semibold text-muted">Requisiti</div>
        {prereq ? <PrereqChips r={prereq} /> : <span className="text-sm">{f.prereqText || '—'}</span>}
        {f.prereqText && prereq && <div className="mt-1 text-xs text-muted">{f.prereqText}</div>}
      </div>
      <Section title="Beneficio" html={f.benefit} />
      <Section title="Normale" html={f.normal} />
      <Section title="Speciale" html={f.special} />
      {Object.entries(f.extra ?? {}).map(([k, v]) => (
        <Section key={k} title={k[0].toUpperCase() + k.slice(1)} html={v} />
      ))}
      {f.changes?.length ? <Badge tone="ok">Effetti numerici applicati automaticamente</Badge> : null}
    </div>
  );
}

function Section({ title, html }: { title: string; html?: string }) {
  if (!html) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-muted">{title}</div>
      <Html html={html} className="text-sm" />
    </div>
  );
}

export function FeatsStep() {
  const db = useDb();
  const { char, c } = useComputed()!;
  const update = useStore((s) => s.update);
  const setStep = useStore((s) => s.setStep);
  const allowed = useSourceFilter();
  const [slot, setSlot] = useState<FeatSlot | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const typeOptions = useMemo(() => [...new Set(db.feats.flatMap((f) => f.types))].sort().map((t) => ({ value: t, label: t })), [db]);
  const bookOpts = useMemo(() => bookOptions(db.feats.map((f) => f.source)), [db]);
  const takenIds = new Set(char.feats.map((f) => f.featId));

  const assign = (s: FeatSlot, f: FeatData) =>
    update((x) => {
      const old = x.feats.find((p) => p.slot === s.id);
      x.feats = x.feats.filter((p) => p.slot !== s.id);
      x.feats.push({ uid: old?.uid ?? uid(), featId: f.id, slot: s.id, detail: old?.featId === f.id ? old.detail : undefined });
    });

  const groups: { title: string; kind: FeatSlot['kind'][] }[] = [
    { title: 'Talenti per livello', kind: ['general'] },
    { title: 'Talenti bonus razziali', kind: ['race'] },
    { title: 'Talenti bonus di classe', kind: ['class'] },
    { title: 'Talenti bonus aggiuntivi', kind: ['extra'] },
  ];

  const pickerItems = useMemo(() => {
    if (!slot) return [];
    return db.feats.filter((f) => (allowed(f.source) || takenIds.has(f.id)) && (!slot.filter || slot.filter(f)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, db, allowed]);
  const currentUid = slot ? char.feats.find((p) => p.slot === slot.id)?.uid : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Talenti"
        subtitle="Un talento al 1° livello e a ogni livello dispari, più i talenti bonus di razza e classe."
        actions={
          <>
            <Button
              onClick={() =>
                update((x) => void x.extraFeatSlots.push({ id: `extra-${uid()}`, label: 'Talento bonus' }))
              }
            >
              <Plus size={15} /> Slot bonus
            </Button>
            <Button variant="primary" onClick={() => setStep('traits')}>
              Avanti: tratti
            </Button>
          </>
        }
      />
      {groups.map((g) => {
        const slots = c.featSlots.filter((s) => g.kind.includes(s.kind));
        if (!slots.length) return null;
        return (
          <Card key={g.title} title={g.title}>
            <div className="space-y-2">
              {slots.map((s) => {
                const pick = c.feats.find((p) => p.slot === s.id);
                const f = pick?.feat;
                const open = expanded === s.id;
                return (
                  <div key={s.id} className={cx('rounded-lg border', f ? (pick!.prereq.ok ? 'border-line' : 'border-bad/50') : 'border-dashed border-accent/60')}>
                    <div className="flex items-center gap-3 px-3 py-2">
                      <div className="w-40 shrink-0 text-xs text-muted">{s.label}</div>
                      {f ? (
                        <>
                          <button className="min-w-0 flex-1 text-left" onClick={() => setExpanded(open ? null : s.id)}>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{f.name}</span>
                              {pick!.detail && <span className="text-sm text-muted">({pick!.detail})</span>}
                              {f.types.slice(0, 3).map((t) => (
                                <Badge key={t}>{t}</Badge>
                              ))}
                              {!pick!.prereq.ok && <Badge tone="bad">requisiti mancanti</Badge>}
                            </div>
                            {f.summary && <div className="truncate text-xs text-muted">{f.summary}</div>}
                          </button>
                          {(NEEDS_DETAIL.test(f.name) || f.multiple) && (
                            <Input
                              value={pick!.detail ?? ''}
                              placeholder="Specifica (arma, abilità…)"
                              onChange={(e) => update((x) => void (x.feats.find((p) => p.slot === s.id)!.detail = e.target.value || undefined))}
                              className="h-7 w-48 text-xs"
                            />
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setSlot(s)}>
                            Cambia
                          </Button>
                          <button className="rounded p-1 text-muted hover:text-bad" onClick={() => update((x) => void (x.feats = x.feats.filter((p) => p.slot !== s.id)))}>
                            <X size={15} />
                          </button>
                        </>
                      ) : (
                        <button className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-accent" onClick={() => setSlot(s)}>
                          <Plus size={15} /> Scegli talento
                        </button>
                      )}
                      {s.kind === 'extra' && (
                        <button
                          className="rounded p-1 text-muted hover:text-bad"
                          title="Rimuovi slot"
                          onClick={() =>
                            update((x) => {
                              x.extraFeatSlots = x.extraFeatSlots.filter((e) => e.id !== s.id);
                              x.feats = x.feats.filter((p) => p.slot !== s.id);
                            })
                          }
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    {f && open && (
                      <div className="border-t border-line px-4 py-3">
                        <FeatDetail f={f} prereq={pick!.prereq} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
      {c.featSlots.length === 0 && <p className="text-sm text-muted">Aggiungi un livello di classe per ottenere i primi talenti.</p>}

      {slot && (
        <Picker
          open
          onClose={() => setSlot(null)}
          title={`Scegli talento — ${slot.label}`}
          items={pickerItems}
          getId={(f) => f.id}
          getName={(f) => f.name}
          searchText={(f) => `${f.name} ${f.types.join(' ')} ${f.summary ?? ''}`}
          renderRow={(f) => (
            <span className="flex items-center justify-between gap-2">
              <span className="truncate">{f.name}</span>
              <span className="shrink-0 text-[11px] text-muted">{f.types.slice(0, 2).join(', ')}</span>
            </span>
          )}
          rowTone={(f) => (c.checkFeat(f, currentUid).ok ? 'ok' : 'bad')}
          filters={[
            { key: 'type', label: 'Tipo', options: typeOptions, test: (f, v) => f.types.includes(v) },
            { key: 'book', label: 'Manuale', options: bookOpts, test: (f, v) => f.source?.book === v },
          ]}
          toggle={{ label: 'Solo idonei', test: (f) => c.checkFeat(f, currentUid).ok, default: false }}
          selectedIds={takenIds}
          onPick={(f) => {
            assign(slot, f);
            setSlot(null);
          }}
          pickLabel="Scegli talento"
          renderDetail={(f) => <FeatDetail f={f} prereq={c.checkFeat(f, currentUid)} />}
        />
      )}
    </div>
  );
}
