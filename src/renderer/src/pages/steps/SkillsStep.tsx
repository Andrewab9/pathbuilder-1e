import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useComputed, useStore } from '@/store';
import { Badge, Breakdown, Button, Card, Input, PageHeader, Stepper, Toggle, cx } from '@/components/ui';
import { ABILITY_SHORT, signed } from '@/rules/constants';

export function SkillsStep() {
  const { char, c } = useComputed()!;
  const update = useStore((s) => s.update);
  const setStep = useStore((s) => s.setStep);
  const [onlyClass, setOnlyClass] = useState(false);
  const [newSpec, setNewSpec] = useState<Record<string, string>>({});
  const left = c.skillPoints.total - c.skillPoints.used;

  const setRanks = (key: string, v: number) =>
    update((x) => {
      if (v <= 0) delete x.skills[key];
      else x.skills[key] = v;
    });

  const addSpecialty = (key: string) => {
    const name = (newSpec[key] ?? '').trim();
    if (!name) return;
    update((x) => {
      const list = x.skillSpecialties[key] ?? [];
      if (!list.includes(name)) x.skillSpecialties[key] = [...list, name];
      // Gradi già assegnati alla voce generica passano alla prima specializzazione
      if (x.skills[key] && list.length === 0) {
        x.skills[`${key}:${name}`] = x.skills[key];
        delete x.skills[key];
      }
    });
    setNewSpec({ ...newSpec, [key]: '' });
  };
  const removeSpecialty = (key: string, name: string) =>
    update((x) => {
      x.skillSpecialties[key] = (x.skillSpecialties[key] ?? []).filter((s) => s !== name);
      delete x.skills[`${key}:${name}`];
    });

  const rows = c.skills.filter((s) => !onlyClass || s.classSkill);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Abilità"
        subtitle={`Massimo ${c.level} gradi per abilità. Le abilità di classe con almeno 1 grado ricevono +3.`}
        actions={<Button variant="primary" onClick={() => setStep('feats')}>Avanti: talenti</Button>}
      />
      <Card
        title={
          <span className="flex items-center gap-3">
            Gradi assegnati
            <Badge tone={left < 0 ? 'bad' : left === 0 ? 'ok' : 'accent'} className="!text-xs">
              {c.skillPoints.used} / {c.skillPoints.total}
            </Badge>
          </span>
        }
        actions={
          <>
            <Toggle checked={onlyClass} onChange={setOnlyClass} label={<span className="text-xs">Solo di classe</span>} />
            <Button size="sm" variant="ghost" onClick={() => update((x) => void (x.skills = {}))}>
              Azzera
            </Button>
          </>
        }
      >
        <div className="mb-3 flex flex-wrap gap-1.5 text-xs text-muted">
          {c.skillPoints.perLevel.map((p, i) => (
            <span key={i} className="rounded border border-line px-1.5 py-0.5">
              L{i + 1}: {p}
            </span>
          ))}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="w-6" />
              <th className="py-1.5 font-medium">Abilità</th>
              <th className="font-medium">Car.</th>
              <th className="font-medium">Gradi</th>
              <th className="text-right font-medium">Totale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((s) => {
              const isGenericMulti = s.def.multi && !s.specialty;
              const specs = char.skillSpecialties[s.def.key] ?? [];
              const lastOfMulti = s.def.multi && (s.specialty ? specs[specs.length - 1] === s.specialty : true);
              return (
                <tr key={s.key} className={cx(!s.usable && 'opacity-50')}>
                  <td>
                    <span className={cx('block h-2.5 w-2.5 rounded-full border', s.classSkill ? 'border-accent bg-accent' : 'border-line')} title={s.classSkill ? 'Abilità di classe' : ''} />
                  </td>
                  <td className="py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.label}</span>
                      {s.specialty && (
                        <button onClick={() => removeSpecialty(s.def.key, s.specialty!)} className="text-muted hover:text-bad">
                          <X size={12} />
                        </button>
                      )}
                      {s.def.trained && <span className="text-[10px] text-muted" title="Solo con addestramento">addestr.</span>}
                      {s.def.acp && c.armor.acp > 0 && <span className="text-[10px] text-warn">PA</span>}
                    </div>
                    <div className="text-[11px] text-muted">{s.def.en}</div>
                    {lastOfMulti && (
                      <div className="mt-1 flex items-center gap-1">
                        <Input
                          value={newSpec[s.def.key] ?? ''}
                          onChange={(e) => setNewSpec({ ...newSpec, [s.def.key]: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && addSpecialty(s.def.key)}
                          placeholder={isGenericMulti ? 'Specializzazione (es. armi)…' : 'Altra specializzazione…'}
                          className="h-6 w-48 text-xs"
                        />
                        <Button size="sm" variant="ghost" className="!h-6" onClick={() => addSpecialty(s.def.key)}>
                          <Plus size={12} />
                        </Button>
                      </div>
                    )}
                  </td>
                  <td className="text-xs text-muted">{ABILITY_SHORT[s.def.ability]}</td>
                  <td>
                    <Stepper value={s.ranks} min={0} max={c.level} onChange={(v) => setRanks(s.key, v)} />
                  </td>
                  <td className="text-right">
                    <Breakdown parts={s.parts}>
                      <span className="inline-block min-w-12 rounded-md bg-panel-2 px-2 py-1 text-center font-display text-base font-semibold tabular">{s.usable ? signed(s.total) : '—'}</span>
                    </Breakdown>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {c.traitClassSkills.length > 0 && <p className="mt-3 text-xs text-muted">Alcune abilità sono di classe grazie ai tratti scelti.</p>}
      </Card>
    </div>
  );
}
