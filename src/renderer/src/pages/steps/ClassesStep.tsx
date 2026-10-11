import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { useComputed, useDb, useStore } from '@/store';
import { Badge, Button, Card, Empty, Html, Input, PageHeader, Select, SourceTag, cx } from '@/components/ui';
import { Picker } from '@/components/Picker';
import type { ArchetypeData, ClassData } from '@/data/types';
import { ARMOR_PROF_LABEL, SKILL_BY_KEY } from '@/rules/constants';
import { bookOptions, useSourceFilter } from '@/hooks';
import type { Database } from '@/data/db';

export const KIND_LABEL: Record<string, string> = {
  base: 'Base', hybrid: 'Ibrida', unchained: 'Unchained', prestige: 'Prestigio', npc: 'PNG',
};
const BAB_LABEL = { high: 'Alto', med: 'Medio', low: 'Basso' };

export function ClassDetail({ cls, db }: { cls: ClassData; db: Database }) {
  const byLevel = new Map<number, string[]>();
  for (const f of cls.features) {
    const n = f.id ? db.featureById.get(f.id)?.name : f.label;
    if (!n) continue;
    if (!byLevel.has(f.level)) byLevel.set(f.level, []);
    byLevel.get(f.level)!.push(n);
  }
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold">{cls.name}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge tone="accent">{KIND_LABEL[cls.kind]}</Badge>
          <SourceTag source={cls.source} />
        </div>
        {cls.summary && <p className="mt-2 text-sm italic text-muted">{cls.summary}</p>}
      </div>
      <div className="grid grid-cols-4 gap-2 text-sm">
        <Mini label="Dado vita" value={`d${cls.hd}`} />
        <Mini label="BAB" value={BAB_LABEL[cls.bab]} />
        <Mini label="TS buoni" value={(['fort', 'ref', 'will'] as const).filter((s) => cls.saves[s] === 'good').map((s) => ({ fort: 'Tem', ref: 'Rif', will: 'Vol' })[s]).join(', ') || '—'} />
        <Mini label="Gradi/livello" value={`${cls.skillRanks} + Int`} />
      </div>
      {cls.casting && (
        <div className="text-sm">
          <b>Incantesimi:</b> {cls.casting.tradition}, {cls.casting.type === 'prepared' ? 'preparati' : cls.casting.type === 'spontaneous' ? 'spontanei' : 'ibridi'}, progressione {cls.casting.progression === 'high' ? 'completa (9°)' : cls.casting.progression === 'med' ? 'media (6°)' : 'bassa (4°)'}, caratteristica {cls.casting.ability.toUpperCase()}
        </div>
      )}
      {cls.requirements && (
        <div className="rounded-lg border border-warn/40 bg-warn/5 p-3 text-sm">
          <div className="mb-1 font-semibold text-warn">Requisiti</div>
          <Html html={cls.requirements} />
        </div>
      )}
      <div className="text-sm">
        <b>Abilità di classe:</b> {cls.classSkills.map((s) => SKILL_BY_KEY.get(s)?.it ?? s).join(', ')}
      </div>
      <div className="text-sm">
        <b>Competenze:</b> {[...cls.weaponProf.map((w) => ({ simple: 'armi semplici', martial: 'armi da guerra' })[w] ?? w), ...cls.armorProf.map((a) => `armature ${ARMOR_PROF_LABEL[a] ?? a}`)].join(', ') || 'nessuna'}
      </div>
      {byLevel.size > 0 && (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line">
            {[...byLevel].sort((a, b) => a[0] - b[0]).map(([lv, names]) => (
              <tr key={lv}>
                <td className="w-14 py-1 align-top text-muted">{lv}°</td>
                <td className="py-1">{names.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Html html={cls.desc} className="text-sm" />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

export function ClassesStep() {
  const db = useDb();
  const { char, c } = useComputed()!;
  const update = useStore((s) => s.update);
  const setStep = useStore((s) => s.setStep);
  const allowed = useSourceFilter();
  const [classPicker, setClassPicker] = useState(false);
  const [archFor, setArchFor] = useState<string | null>(null);

  const addLevel = (classId: string) =>
    update((x) => {
      x.levels.push({ classId });
      if (!x.favoredClasses.length) x.favoredClasses = [classId];
      if (x.favoredClasses.includes(classId)) x.levels[x.levels.length - 1].fcb = 'hp';
    });
  const removeLevel = (i: number) =>
    update((x) => {
      const removed = x.levels.splice(i, 1)[0];
      if (!x.levels.some((l) => l.classId === removed.classId)) delete x.archetypes[removed.classId];
    });

  const maxFavored = c.race?.id === 'half-elf' && !char.alternateTraits.some((t) => /multitalented/i.test(t)) ? 2 : 1;
  const raceFcb = c.race?.favoredClassOptions ?? [];

  const archetypeClass = archFor ? db.classById.get(archFor) : undefined;
  const chosenArch = archFor ? char.archetypes[archFor] ?? [] : [];
  const archReplaced = new Set(chosenArch.flatMap((id) => db.archetypeById.get(id)?.replaces ?? []));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Classi e livelli"
        subtitle="Aggiungi i livelli nell'ordine in cui il personaggio li prende. Il multiclasse è libero."
        actions={<Button variant="primary" onClick={() => setStep('features')}>Avanti: privilegi</Button>}
      />

      <Card
        title={`Progressione (${char.levels.length} livelli)`}
        actions={
          <>
            {c.classes.map((ci) => (
              <Button key={ci.cls.id} size="sm" variant="soft" onClick={() => addLevel(ci.cls.id)} disabled={char.levels.length >= 20}>
                <Plus size={13} /> {ci.cls.name}
              </Button>
            ))}
            <Button size="sm" variant="primary" onClick={() => setClassPicker(true)} disabled={char.levels.length >= 20}>
              <Plus size={13} /> {char.levels.length ? 'Nuova classe' : 'Scegli classe'}
            </Button>
          </>
        }
      >
        {char.levels.length === 0 ? (
          <Empty title="Nessun livello">Scegli la classe di partenza per il 1° livello.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="w-14 py-1.5 font-medium">Liv.</th>
                <th className="font-medium">Classe</th>
                <th className="font-medium">PF</th>
                <th className="font-medium">Classe preferita</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {char.levels.map((l, i) => {
                const cls = db.classById.get(l.classId);
                const clsLevel = char.levels.slice(0, i + 1).filter((x) => x.classId === l.classId).length;
                const favored = char.favoredClasses.includes(l.classId);
                const alts = raceFcb.filter((o) => o.classId === l.classId);
                return (
                  <tr key={i} className="group">
                    <td className="py-2 font-display font-semibold tabular">{i + 1}</td>
                    <td>
                      <span className="font-medium">{cls?.name ?? l.classId}</span> <span className="text-muted">{clsLevel}</span>
                    </td>
                    <td className="tabular">
                      {i === 0 || char.settings.hpMethod !== 'roll' ? (
                        <span className="text-muted">{i === 0 || char.settings.hpMethod === 'max' ? cls?.hd : Math.floor((cls?.hd ?? 0) / 2) + 1}</span>
                      ) : (
                        <Input
                          type="number"
                          min={1}
                          max={cls?.hd}
                          value={l.hpRoll ?? ''}
                          placeholder={`d${cls?.hd}`}
                          onChange={(e) => update((x) => void (x.levels[i].hpRoll = e.target.value ? +e.target.value : undefined))}
                          className="h-7 w-16"
                        />
                      )}
                    </td>
                    <td>
                      {favored ? (
                        <Select
                          value={l.fcb === 'alt' ? `alt:${l.fcbAlt ?? 0}` : l.fcb ?? ''}
                          onChange={(e) =>
                            update((x) => {
                              const v = e.target.value;
                              if (v.startsWith('alt:')) {
                                x.levels[i].fcb = 'alt';
                                x.levels[i].fcbAlt = +v.slice(4);
                              } else x.levels[i].fcb = (v || undefined) as 'hp' | undefined;
                            })
                          }
                          className={cx('h-7 max-w-72 text-xs', !l.fcb && 'border-warn')}
                        >
                          <option value="">— scegli —</option>
                          <option value="hp">+1 punto ferita</option>
                          <option value="skill">+1 grado di abilità</option>
                          {alts.map((o) => {
                            const idx = raceFcb.indexOf(o);
                            return (
                              <option key={idx} value={`alt:${idx}`} title={o.desc}>
                                {o.desc.length > 70 ? o.desc.slice(0, 70) + '…' : o.desc}
                              </option>
                            );
                          })}
                        </Select>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <button className="rounded p-1 text-muted opacity-0 hover:text-bad group-hover:opacity-100" title="Rimuovi livello" onClick={() => removeLevel(i)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {c.classes.length > 0 && (
        <Card title={`Classe preferita${maxFavored > 1 ? ' (fino a 2: Multitalentuoso)' : ''}`}>
          <div className="flex flex-wrap gap-2">
            {c.classes
              .filter((ci) => ci.cls.kind !== 'prestige')
              .map((ci) => {
                const on = char.favoredClasses.includes(ci.cls.id);
                return (
                  <Button
                    key={ci.cls.id}
                    variant={on ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() =>
                      update((x) => {
                        if (on) x.favoredClasses = x.favoredClasses.filter((f) => f !== ci.cls.id);
                        else x.favoredClasses = [...x.favoredClasses, ci.cls.id].slice(-maxFavored);
                      })
                    }
                  >
                    {ci.cls.name}
                  </Button>
                );
              })}
          </div>
          {raceFcb.length > 0 && <p className="mt-2 text-xs text-muted">Le opzioni alternative di classe preferita della tua razza compaiono nel menu di ogni livello.</p>}
        </Card>
      )}

      {c.classes.map((ci) => {
        const archs = db.archetypesByClass.get(ci.cls.id) ?? [];
        const prestigeCaster = ci.cls.kind === 'prestige' && ci.cls.spellProgression?.some(Boolean);
        const casterClasses = c.classes.filter((x) => x.cls.casting);
        return (
          <Card
            key={ci.cls.id}
            title={
              <span>
                {ci.cls.name} <span className="text-muted">{ci.level}</span>
              </span>
            }
            actions={<Badge>{KIND_LABEL[ci.cls.kind]}</Badge>}
          >
            <div className="grid grid-cols-4 gap-2 text-sm">
              <Mini label="Dado vita" value={`d${ci.cls.hd}`} />
              <Mini label="BAB" value={BAB_LABEL[ci.cls.bab]} />
              <Mini label="Gradi/livello" value={`${ci.cls.skillRanks} + Int`} />
              <Mini label="Incantatore" value={ci.cls.casting ? `${ci.cls.casting.tradition} (${ci.cls.casting.ability.toUpperCase()})` : prestigeCaster ? 'avanza classe' : 'no'} />
            </div>
            {prestigeCaster && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span>Avanza gli incantesimi di:</span>
                <Select value={char.prestigeCasting[ci.cls.id] ?? ''} onChange={(e) => update((x) => void (x.prestigeCasting[ci.cls.id] = e.target.value))} className="h-8 w-48">
                  <option value="">— scegli —</option>
                  {casterClasses.map((x) => (
                    <option key={x.cls.id} value={x.cls.id}>
                      {x.cls.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {archs.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted">Archetipi ({archs.length} disponibili)</span>
                  <Button size="sm" onClick={() => setArchFor(ci.cls.id)}>
                    <Plus size={13} /> Aggiungi archetipo
                  </Button>
                </div>
                {ci.archetypes.length === 0 ? (
                  <p className="text-sm text-muted">Nessun archetipo.</p>
                ) : (
                  <div className="space-y-2">
                    {ci.archetypes.map((a) => (
                      <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-line bg-panel-2 p-3">
                        <div>
                          <div className="font-semibold">{a.name}</div>
                          {a.replaces.length > 0 && <div className="text-xs text-muted">Sostituisce: {a.replaces.join(', ')}</div>}
                          <SourceTag source={a.source} />
                        </div>
                        <button
                          className="rounded p-1 text-muted hover:text-bad"
                          onClick={() => update((x) => void (x.archetypes[ci.cls.id] = (x.archetypes[ci.cls.id] ?? []).filter((id) => id !== a.id)))}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}

      <Picker
        open={classPicker}
        onClose={() => setClassPicker(false)}
        title="Scegli una classe"
        items={db.classes.filter((x) => allowed(x.source) || x.kind !== 'prestige')}
        getId={(x) => x.id}
        getName={(x) => x.name}
        renderRow={(x) => (
          <span className="flex items-center justify-between gap-2">
            <span>{x.name}</span>
            <span className="text-xs text-muted">{KIND_LABEL[x.kind]}</span>
          </span>
        )}
        filters={[
          {
            key: 'kind',
            label: 'Tipo',
            options: Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label })),
            test: (x, v) => x.kind === v,
          },
          { key: 'book', label: 'Manuale', options: bookOptions(db.classes.map((x) => x.source)), test: (x, v) => x.source?.book === v },
        ]}
        onPick={(x) => {
          addLevel(x.id);
          setClassPicker(false);
        }}
        pickLabel="Aggiungi livello"
        renderDetail={(x) => <ClassDetail cls={x} db={db} />}
      />

      {archetypeClass && (
        <Picker
          open={!!archFor}
          onClose={() => setArchFor(null)}
          title={`Archetipi del ${archetypeClass.name}`}
          items={(db.archetypesByClass.get(archetypeClass.id) ?? []).filter((a) => allowed(a.source))}
          getId={(a) => a.id}
          getName={(a) => a.name}
          selectedIds={new Set(chosenArch)}
          rowTone={(a) => (chosenArch.includes(a.id) ? undefined : a.replaces.some((r) => archReplaced.has(r)) ? 'bad' : undefined)}
          filters={[{ key: 'book', label: 'Manuale', options: bookOptions((db.archetypesByClass.get(archetypeClass.id) ?? []).map((a) => a.source)), test: (a, v) => a.source?.book === v }]}
          toggle={{ label: 'Solo compatibili', test: (a) => !a.replaces.some((r) => archReplaced.has(r)) }}
          onPick={(a) => {
            update((x) => {
              const list = x.archetypes[archetypeClass.id] ?? [];
              if (!list.includes(a.id)) x.archetypes[archetypeClass.id] = [...list, a.id];
            });
            setArchFor(null);
          }}
          pickLabel="Aggiungi archetipo"
          renderDetail={(a) => <ArchetypeDetail a={a} db={db} conflicts={a.replaces.filter((r) => archReplaced.has(r))} />}
        />
      )}
    </div>
  );
}

export function ArchetypeDetail({ a, db, conflicts = [] }: { a: ArchetypeData; db: Database; conflicts?: string[] }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-xl font-semibold">{a.name}</h2>
        <SourceTag source={a.source} />
      </div>
      {conflicts.length > 0 && <Badge tone="bad">Incompatibile con gli archetipi scelti: {conflicts.join(', ')}</Badge>}
      {a.replaces.length > 0 && (
        <div className="text-sm">
          <b>Sostituisce/modifica:</b> {a.replaces.join(', ')}
        </div>
      )}
      <Html html={a.desc} className="text-sm" />
      <div className="space-y-3">
        {a.features.map((f) => {
          const fd = db.featureById.get(f.id);
          if (!fd) return null;
          return (
            <div key={f.id} className="rounded-lg border border-line p-3">
              <div className="mb-1 flex items-center gap-2">
                <Badge>{f.level}°</Badge>
                <span className="font-semibold">{fd.name.replace(/\s*\([^)]*\)$/, '')}</span>
                {fd.type && <span className="text-xs uppercase text-muted">({fd.type})</span>}
              </div>
              <Html html={fd.desc} className="text-sm" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
