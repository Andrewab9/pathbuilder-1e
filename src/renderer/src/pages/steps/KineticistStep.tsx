import { useMemo, useState } from 'react';
import { Flame, Plus, X } from 'lucide-react';
import { useComputed, useDb, useStore } from '@/store';
import { Badge, Button, Card, Empty, Html, PageHeader, Select, SourceTag, cx } from '@/components/ui';
import { Picker } from '@/components/Picker';
import type { KineticTalent } from '@/data/types';
import { ABILITY_LABEL, signed } from '@/rules/constants';
import { talentAvailable, type KineticSlot } from '@/rules/kineticist';
import { useSourceFilter } from '@/hooks';

const TYPE_LABEL: Record<string, string> = {
  simple: 'Blast semplice', composite: 'Blast composito', defense: 'Difesa', form: 'Infusione di forma',
  substance: 'Infusione di sostanza', utility: 'Utilità', other: 'Altro',
};
const ELEMENT_IT: Record<string, string> = {
  aether: 'Etere (telecinesi)', air: 'Aria', earth: 'Terra', fire: 'Fuoco', water: 'Acqua', void: 'Vuoto', wood: 'Legno', universal: 'Universale',
};

export function KineticTalentDetail({ t }: { t: KineticTalent }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-xl font-semibold">{t.name}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge tone="accent">{TYPE_LABEL[t.type]}</Badge>
          {t.elements.map((e) => (
            <Badge key={e}>{ELEMENT_IT[e] ?? e}</Badge>
          ))}
          <SourceTag source={t.source} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <Mini label="Livello" value={t.level ? `${t.level}°` : '—'} />
        <Mini label="Burn" value={t.burn} />
        <Mini label="Tipo" value={t.typeText} />
      </div>
      {t.prereq && (
        <div className="text-sm">
          <b>Prerequisiti:</b> {t.prereq}
        </div>
      )}
      {t.assoc && (
        <div className="text-sm">
          <b>Blast associati:</b> {t.assoc === 'any' ? 'qualsiasi' : t.assoc.join(', ')}
        </div>
      )}
      {t.blastType && (
        <div className="text-sm">
          <b>Blast:</b> {t.blastType}
          {t.damage ? ` — ${t.damage}` : ''}
        </div>
      )}
      {t.save && (
        <div className="text-sm">
          <b>Tiro salvezza:</b> {t.save}
        </div>
      )}
      <Html html={t.desc} className="text-sm" />
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

export function KineticistStep() {
  const db = useDb();
  const { char, c } = useComputed()!;
  const update = useStore((s) => s.update);
  const setStep = useStore((s) => s.setStep);
  const allowed = useSourceFilter();
  const [slot, setSlot] = useState<KineticSlot | null>(null);
  const k = c.kinetic;

  const pickerItems = useMemo(() => {
    if (!slot || !k) return [];
    return db.kinetic.talents.filter((t) => {
      if (!allowed(t.source)) return false;
      if (slot.kind === 'infusion') return t.type === 'form' || t.type === 'substance';
      if (slot.kind === 'utility') return t.type === 'utility';
      return ['form', 'substance', 'utility'].includes(t.type);
    });
  }, [slot, k, db, allowed]);

  if (!k) {
    return (
      <Card>
        <Empty icon={<Flame size={36} />} title="Nessun livello da cineta">Aggiungi livelli di Kineticist nella sezione Classi.</Empty>
      </Card>
    );
  }
  const setK = (fn: (x: typeof char.kineticist) => void) => update((x) => fn(x.kineticist));
  const taken = new Set(Object.values(char.kineticist.talents));
  const elementOptions = db.kinetic.elements;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Talenti selvaggi"
        subtitle={`Cineta di ${k.level}° livello: elementi, kinetic blast, infusioni, talenti di utilità e burn.`}
        actions={<Button variant="primary" onClick={() => setStep('skills')}>Avanti: abilità</Button>}
      />

      <Card title="Elementi">
        <div className="grid grid-cols-3 gap-3">
          <ElementSelect label="Elemento primario (1°)" value={char.kineticist.primary} onChange={(v) => setK((x) => void (x.primary = v))} options={elementOptions} />
          <ElementSelect label="Elemento espanso (7°)" value={char.kineticist.expanded7} disabled={k.level < 7} onChange={(v) => setK((x) => void (x.expanded7 = v))} options={elementOptions} />
          <ElementSelect label="Elemento espanso (15°)" value={char.kineticist.expanded15} disabled={k.level < 15} onChange={(v) => setK((x) => void (x.expanded15 = v))} options={elementOptions} />
        </div>
        {k.primary && <p className="mt-3 text-sm text-muted">{k.primary.desc}</p>}
        {k.blastChoices.some((b) => b.options.length > 1) && (
          <div className="mt-4 space-y-2">
            {k.blastChoices
              .filter((b) => b.options.length > 1)
              .map((b) => (
                <div key={b.slot} className="flex flex-wrap items-center gap-2">
                  <span className="w-64 text-sm">{b.label}</span>
                  {b.options.map((o) => (
                    <Button
                      key={o.id}
                      size="sm"
                      variant={b.chosen?.id === o.id ? 'primary' : 'outline'}
                      onClick={() =>
                        setK((x) => {
                          const others = b.options.map((p) => p.id);
                          x.blasts = [...x.blasts.filter((id) => !others.includes(id)), o.id];
                        })
                      }
                    >
                      {o.name}
                    </Button>
                  ))}
                </div>
              ))}
          </div>
        )}
        <div className="mt-3 text-xs text-muted">
          Gli elementi espansi diversi dal primario consentono talenti come se il cineta avesse 4 livelli in meno. Scegliere di nuovo l'elemento primario concede un'infusione o un talento di utilità bonus.
        </div>
      </Card>

      <Card title="Burn ed elemental overflow">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="mb-1 text-xs text-muted">Burn attuale (massimo {k.burnMax})</div>
            <input type="range" min={0} max={k.burnMax} value={k.burn} onChange={(e) => setK((x) => void (x.burn = +e.target.value))} className="w-56 accent-[var(--accent)]" />
            <span className="ml-3 font-display text-xl font-semibold tabular">{k.burn}</span>
          </div>
          <Stat label="Danni non letali" value={String(k.burnNonlethal)} />
          <Stat label="Burn per round" value={String(k.burnPerRound)} />
          {k.level >= 3 && <Stat label="Overflow" value={`${signed(k.overflowBonus)} att / ${signed(2 * k.overflowBonus)} dan`} />}
          {k.level >= 6 && <Stat label="Ignora critici" value={`${k.critIgnore}%`} />}
        </div>
        {k.level >= 6 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span>Bonus di taglia alle caratteristiche (in ordine di priorità):</span>
            {[0, 1, 2].map((i) => (
              <Select
                key={i}
                value={char.kineticist.overflow[i] ?? ''}
                onChange={(e) =>
                  setK((x) => {
                    const v = e.target.value as 'str';
                    const arr = [...(x.overflow.length === 3 ? x.overflow : (['dex', 'con', 'str'] as const))];
                    const j = arr.indexOf(v);
                    if (j >= 0) arr[j] = arr[i];
                    arr[i] = v;
                    x.overflow = arr;
                  })
                }
                className="h-8 w-36 text-xs"
              >
                {(['str', 'dex', 'con'] as const).map((a) => (
                  <option key={a} value={a}>
                    {ABILITY_LABEL[a]}
                  </option>
                ))}
              </Select>
            ))}
            {Object.keys(k.overflowAbilities).length > 0 && (
              <Badge tone="ok">
                Attivi: {Object.entries(k.overflowAbilities).map(([a, v]) => `${ABILITY_LABEL[a as 'str']} +${v}`).join(', ')}
              </Badge>
            )}
          </div>
        )}
      </Card>

      <Card title="Kinetic blast">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1.5 font-medium">Blast</th>
              <th className="font-medium">Tipo</th>
              <th className="font-medium">Attacco</th>
              <th className="font-medium">Danni</th>
              <th className="font-medium">Burn</th>
              <th className="font-medium">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {k.blasts.map((b) => (
              <tr key={b.talent.id}>
                <td className="py-1.5 font-medium">{b.talent.name}</td>
                <td className="text-xs text-muted">
                  {b.composite ? 'composito' : 'semplice'}, {b.talent.blastType}
                </td>
                <td className="font-semibold tabular">{signed(b.attack)}</td>
                <td className="tabular">{b.damage}</td>
                <td className="tabular">{b.burn}</td>
                <td className="text-xs text-muted">{b.notes.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge>CD blast/infusioni di sostanza {k.blastDc}</Badge>
          <Badge>CD infusioni di forma {k.formDc}</Badge>
          {k.infusionSpecialization > 0 && <Badge tone="accent">Infusion specialization −{k.infusionSpecialization} burn</Badge>}
          {k.internalBuffer > 0 && <Badge>Internal buffer {k.internalBuffer}</Badge>}
          {k.metakinesis.map((m) => (
            <Badge key={m}>Metakinesis: {m}</Badge>
          ))}
          {k.level >= 11 && <Badge>Supercharge</Badge>}
          {k.level >= 16 && <Badge>Composite specialization (−1 burn compositi)</Badge>}
        </div>
      </Card>

      <Card title="Talenti selvaggi">
        <div className="space-y-2">
          {k.automatic.map((t) => (
            <TalentRow key={t.id} t={t} label={t.type === 'defense' ? 'Difesa (2°)' : 'Utilità base'} auto />
          ))}
          {k.slots.map((s) =>
            s.talent ? (
              <div key={s.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <TalentRow t={s.talent} label={s.label} warn={talentAvailable(s.talent, k).reason} onRemove={() => setK((x) => void delete x.talents[s.id])} />
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
                <Plus size={15} /> {s.label}
              </button>
            ),
          )}
        </div>
      </Card>

      {slot && (
        <Picker
          open
          onClose={() => setSlot(null)}
          title={`${slot.label} — livello massimo ${Math.max(1, Math.floor(k.level / 2))}`}
          items={pickerItems}
          getId={(t) => t.id}
          getName={(t) => t.name}
          renderRow={(t) => (
            <span className="flex items-center justify-between gap-2">
              <span className="truncate">{t.name}</span>
              <span className="shrink-0 text-[11px] text-muted">
                {t.level ?? '—'}° · burn {t.burn} · {t.elements.join('/')}
              </span>
            </span>
          )}
          rowTone={(t) => (talentAvailable(t, k).ok ? 'ok' : 'bad')}
          toggle={{ label: 'Solo disponibili', test: (t) => talentAvailable(t, k).ok, default: true }}
          filters={[
            { key: 'type', label: 'Tipo', options: ['form', 'substance', 'utility'].map((v) => ({ value: v, label: TYPE_LABEL[v] })), test: (t, v) => t.type === v },
            { key: 'el', label: 'Elemento', options: Object.entries(ELEMENT_IT).map(([value, label]) => ({ value, label })), test: (t, v) => t.elements.includes(v) },
          ]}
          selectedIds={taken}
          onPick={(t) => {
            setK((x) => void (x.talents[slot.id] = t.id));
            setSlot(null);
          }}
          renderDetail={(t) => (
            <div>
              {!talentAvailable(t, k).ok && <Badge tone="bad" className="mb-3">Non disponibile: {talentAvailable(t, k).reason}</Badge>}
              <KineticTalentDetail t={t} />
            </div>
          )}
        />
      )}
    </div>
  );
}

function ElementSelect({ label, value, onChange, options, disabled }: { label: string; value?: string; onChange: (v?: string) => void; options: { id: string; name: string }[]; disabled?: boolean }) {
  return (
    <label className={cx('flex flex-col gap-1', disabled && 'opacity-40')}>
      <span className="text-xs font-medium text-muted">{label}</span>
      <Select value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {ELEMENT_IT[o.id] ?? o.name}
          </option>
        ))}
      </Select>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="font-display text-lg font-semibold tabular">{value}</div>
    </div>
  );
}

function TalentRow({ t, label, auto, warn, onRemove }: { t: KineticTalent; label: string; auto?: boolean; warn?: string; onRemove?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cx('rounded-lg border', warn ? 'border-bad/50' : 'border-line')}>
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="w-56 shrink-0 text-xs text-muted">{label}</div>
        <button className="flex flex-1 items-center gap-2 text-left text-sm" onClick={() => setOpen(!open)}>
          <span className="font-semibold">{t.name}</span>
          <Badge>{TYPE_LABEL[t.type]}</Badge>
          {t.level && <span className="text-xs text-muted">{t.level}°</span>}
          <span className="text-xs text-muted">burn {t.burn}</span>
          {auto && <Badge tone="ok">automatico</Badge>}
          {warn && <Badge tone="bad">{warn}</Badge>}
        </button>
        {onRemove && (
          <button className="rounded p-1 text-muted hover:text-bad" onClick={onRemove}>
            <X size={14} />
          </button>
        )}
      </div>
      {open && (
        <div className="border-t border-line px-4 py-3">
          <KineticTalentDetail t={t} />
        </div>
      )}
    </div>
  );
}
