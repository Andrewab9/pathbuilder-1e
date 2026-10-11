import { useState } from 'react';
import { Check, Repeat } from 'lucide-react';
import { useCharacter, useDb, useStore } from '@/store';
import { Badge, Button, Card, Html, PageHeader, SourceTag, cx } from '@/components/ui';
import { Picker } from '@/components/Picker';
import { ABILITIES, ABILITY_LABEL, ABILITY_SHORT, SIZE_LABEL, signed } from '@/rules/constants';
import type { RaceData } from '@/data/types';
import { bookOptions, useSourceFilter } from '@/hooks';

function abilityText(r: RaceData) {
  if (r.flexible) return '+2 a scelta';
  const m = Object.entries(r.abilityMods);
  return m.length ? m.map(([k, v]) => `${signed(v!)} ${ABILITY_SHORT[k as keyof typeof ABILITY_SHORT]}`).join(', ') : '—';
}

export function RaceStep() {
  const db = useDb();
  const char = useCharacter()!;
  const update = useStore((s) => s.update);
  const setStep = useStore((s) => s.setStep);
  const allowed = useSourceFilter();
  const [picker, setPicker] = useState(false);
  const race = char.raceId ? db.raceById.get(char.raceId) : undefined;

  const choose = (r: RaceData) => {
    update((c) => {
      if (c.raceId !== r.id) {
        c.raceId = r.id;
        c.alternateTraits = [];
        c.raceAbilityChoice = undefined;
      }
    });
    setPicker(false);
  };

  const replacedBy = new Map<string, string>();
  for (const name of char.alternateTraits) {
    const t = race?.alternateTraits?.find((x) => x.name === name);
    t?.replaces.forEach((r) => replacedBy.set(r.toLowerCase(), name));
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Razza"
        subtitle="La razza determina modificatori alle caratteristiche, taglia, velocità e tratti razziali."
        actions={
          <>
            {race && (
              <Button onClick={() => setPicker(true)}>
                <Repeat size={15} /> Cambia razza
              </Button>
            )}
            <Button variant="primary" onClick={() => setStep('abilities')}>
              Avanti: caratteristiche
            </Button>
          </>
        }
      />

      {!race && (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {db.races
              .filter((r) => r.core)
              .map((r) => (
                <button key={r.id} onClick={() => choose(r)} className="rounded-xl border border-line bg-panel p-4 text-left transition-all hover:-translate-y-0.5 hover:border-accent/60">
                  <div className="font-display text-base font-semibold">{r.name}</div>
                  <div className="mt-1 text-xs text-muted">
                    {abilityText(r)} · {SIZE_LABEL[r.size]} · {r.speed.land} ft.
                  </div>
                </button>
              ))}
          </div>
          <Button onClick={() => setPicker(true)}>Altre razze ({db.races.length - 7})…</Button>
        </>
      )}

      {race && (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-semibold">{race.name}</h2>
                <SourceTag source={race.source} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Stat label="Caratteristiche" value={abilityText(race)} />
                <Stat label="Taglia" value={SIZE_LABEL[race.size]} />
                <Stat label="Velocità" value={Object.entries(race.speed).filter(([, v]) => v).map(([k, v]) => `${k === 'land' ? '' : k + ' '}${v} ft.`).join(', ')} />
                <Stat label="Tipo" value={[...race.types, ...race.subtypes].join(', ')} />
              </div>
            </div>
            {race.flexible && (
              <div className="mt-4 rounded-lg border border-accent/40 bg-accent-soft/50 p-3">
                <div className="mb-2 text-sm font-medium">Bonus razziale +2 a una caratteristica a scelta</div>
                <div className="flex flex-wrap gap-1.5">
                  {ABILITIES.map((a) => (
                    <Button key={a} size="sm" variant={char.raceAbilityChoice === a ? 'primary' : 'outline'} onClick={() => update((c) => void (c.raceAbilityChoice = a))}>
                      {ABILITY_LABEL[a]}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card title="Tratti razziali standard">
            {race.traits?.length ? (
              <ul className="space-y-2">
                {race.traits.map((t) => {
                  const rep = replacedBy.get(t.name.toLowerCase());
                  return (
                    <li key={t.name} className={cx('text-sm', rep && 'opacity-50')}>
                      <span className={cx('font-semibold', rep && 'line-through')}>{t.name}</span>: {t.desc}
                      {rep && <Badge tone="warn" className="ml-2">sostituito da {rep}</Badge>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Html html={race.desc} />
            )}
          </Card>

          {!!race.alternateTraits?.length && (
            <Card title={`Tratti razziali alternativi (${race.alternateTraits.length})`} actions={<span className="text-xs text-muted">{char.alternateTraits.length} selezionati</span>}>
              <div className="space-y-2">
                {race.alternateTraits.filter((t) => allowed(t.source) || char.alternateTraits.includes(t.name)).map((t) => {
                  const on = char.alternateTraits.includes(t.name);
                  const conflict = !on && t.replaces.some((r) => replacedBy.has(r.toLowerCase()));
                  return (
                    <button
                      key={t.name}
                      disabled={conflict}
                      onClick={() =>
                        update((c) => {
                          c.alternateTraits = on ? c.alternateTraits.filter((x) => x !== t.name) : [...c.alternateTraits, t.name];
                        })
                      }
                      className={cx(
                        'flex w-full gap-3 rounded-lg border p-3 text-left text-sm transition-colors',
                        on ? 'border-accent bg-accent-soft/40' : 'border-line hover:bg-panel-2',
                        conflict && 'opacity-40',
                      )}
                    >
                      <span className={cx('mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border', on ? 'border-accent bg-accent text-accent-fg' : 'border-line')}>
                        {on && <Check size={11} />}
                      </span>
                      <span className="flex-1">
                        <span className="font-semibold">{t.name}</span>
                        {t.replaces.length > 0 && <span className="ml-2 text-xs text-muted">sostituisce: {t.replaces.join(', ')}</span>}
                        <span className="mt-1 block text-fg/80">{t.desc}</span>
                        <SourceTag source={t.source} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          <Card title="Descrizione">
            <Html html={race.desc} />
          </Card>
        </>
      )}

      <Picker
        open={picker}
        onClose={() => setPicker(false)}
        title="Scegli la razza"
        items={db.races.filter((r) => allowed(r.source) || r.id === char.raceId)}
        getId={(r) => r.id}
        getName={(r) => r.name}
        renderRow={(r) => (
          <span className="flex items-center justify-between gap-2">
            <span>{r.name}</span>
            <span className="text-xs text-muted">{abilityText(r)}</span>
          </span>
        )}
        filters={[
          { key: 'core', label: 'Gruppo', options: [{ value: 'core', label: 'Razze base' }, { value: 'other', label: 'Altre razze' }], test: (r, v) => (v === 'core') === r.core },
          { key: 'size', label: 'Taglia', options: [{ value: 'sm', label: 'Piccola' }, { value: 'med', label: 'Media' }], test: (r, v) => r.size === v },
          { key: 'book', label: 'Manuale', options: bookOptions(db.races.map((r) => r.source)), test: (r, v) => r.source?.book === v },
        ]}
        selectedIds={new Set(char.raceId ? [char.raceId] : [])}
        onPick={choose}
        pickLabel="Scegli razza"
        renderDetail={(r) => (
          <div>
            <h2 className="font-display text-xl font-semibold">{r.name}</h2>
            <div className="mb-3 mt-1 flex flex-wrap gap-2">
              <Badge tone="accent">{abilityText(r)}</Badge>
              <Badge>{SIZE_LABEL[r.size]}</Badge>
              <Badge>{r.speed.land} ft.</Badge>
              <SourceTag source={r.source} />
            </div>
            {r.traits?.length ? (
              <ul className="space-y-1.5 text-sm">
                {r.traits.map((t) => (
                  <li key={t.name}>
                    <b>{t.name}</b>: {t.desc}
                  </li>
                ))}
              </ul>
            ) : (
              <Html html={r.desc} />
            )}
          </div>
        )}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2 px-3 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-sm font-semibold">{value || '—'}</div>
    </div>
  );
}
