import { Dices } from 'lucide-react';
import { useComputed, useStore } from '@/store';
import { Badge, Button, Card, PageHeader, Select, Stepper, Tabs, cx } from '@/components/ui';
import { ABILITIES, ABILITY_INCREASE_LEVELS, ABILITY_LABEL, POINT_BUY_BUDGETS, POINT_BUY_COST, signed } from '@/rules/constants';
import type { AbilityKey } from '@/data/types';

function roll4d6() {
  const d = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6)).sort((a, b) => a - b);
  return d[1] + d[2] + d[3];
}

export function AbilitiesStep() {
  const { char, c } = useComputed()!;
  const update = useStore((s) => s.update);
  const setStep = useStore((s) => s.setStep);
  const pb = char.settings.abilityMethod === 'pointbuy';
  const remaining = c.pointBuy.budget - c.pointBuy.spent;
  const increases = ABILITY_INCREASE_LEVELS.filter((l) => l <= char.levels.length);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Caratteristiche"
        subtitle="Punteggi base, modificatori razziali e aumenti di livello."
        actions={<Button variant="primary" onClick={() => setStep('classes')}>Avanti: classi</Button>}
      />
      <Card
        title="Punteggi"
        actions={
          <Tabs
            value={char.settings.abilityMethod}
            onChange={(v) => update((x) => void (x.settings.abilityMethod = v))}
            items={[
              { value: 'pointbuy', label: 'Point buy' },
              { value: 'manual', label: 'Manuale / tiro' },
            ]}
          />
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {pb ? (
            <>
              <Select value={char.settings.pointBuy} onChange={(e) => update((x) => void (x.settings.pointBuy = +e.target.value))} className="w-56">
                {POINT_BUY_BUDGETS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </Select>
              <Badge tone={remaining < 0 ? 'bad' : remaining === 0 ? 'ok' : 'accent'} className="!px-2.5 !py-1 text-sm">
                {remaining < 0 ? `${-remaining} punti oltre il budget` : `${remaining} punti rimasti`}
              </Badge>
              <Button size="sm" variant="ghost" onClick={() => update((x) => void (x.baseAbilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }))}>
                Azzera
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() =>
                  update((x) => {
                    for (const a of ABILITIES) x.baseAbilities[a] = roll4d6();
                  })
                }
              >
                <Dices size={14} /> Tira 4d6 (scarta il più basso)
              </Button>
              <Button size="sm" variant="ghost" onClick={() => update((x) => void (x.baseAbilities = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }))}>
                Serie standard (15,14,13,12,10,8)
              </Button>
            </>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2 font-medium">Caratteristica</th>
              <th className="font-medium">Base</th>
              {pb && <th className="font-medium">Costo</th>}
              <th className="text-center font-medium">Razza</th>
              <th className="text-center font-medium">Livelli</th>
              <th className="text-center font-medium">Altri bonus</th>
              <th className="text-center font-medium">Totale</th>
              <th className="text-center font-medium">Mod.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ABILITIES.map((a) => {
              const s = c.abilities[a];
              return (
                <tr key={a}>
                  <td className="py-2.5 font-medium">{ABILITY_LABEL[a]}</td>
                  <td>
                    <Stepper value={s.base} min={pb ? 7 : 1} max={pb ? 18 : 30} onChange={(v) => update((x) => void (x.baseAbilities[a] = v))} />
                  </td>
                  {pb && <td className="tabular text-muted">{POINT_BUY_COST[s.base] ?? '—'}</td>}
                  <td className={cx('text-center tabular', s.racial > 0 ? 'text-ok' : s.racial < 0 ? 'text-bad' : 'text-muted')}>{s.racial ? signed(s.racial) : '—'}</td>
                  <td className="text-center tabular text-muted">{s.levelUp ? signed(s.levelUp) : '—'}</td>
                  <td className="text-center tabular text-muted">{s.bonus ? signed(s.bonus) : '—'}</td>
                  <td className="text-center font-display text-lg font-semibold tabular">{s.total}</td>
                  <td className="text-center">
                    <span className="inline-block min-w-10 rounded-md bg-accent-soft px-2 py-0.5 font-semibold text-accent tabular">{signed(s.mod)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="Aumenti di caratteristica (4°, 8°, 12°, 16°, 20° livello)">
        {increases.length === 0 ? (
          <p className="text-sm text-muted">Il primo aumento arriva al 4° livello del personaggio.</p>
        ) : (
          <div className="grid grid-cols-5 gap-3">
            {increases.map((l) => (
              <div key={l}>
                <div className="mb-1 text-xs text-muted">Livello {l}</div>
                <Select
                  value={char.levels[l - 1]?.ability ?? ''}
                  onChange={(e) => update((x) => void (x.levels[l - 1].ability = (e.target.value || undefined) as AbilityKey | undefined))}
                  className={cx('w-full', !char.levels[l - 1]?.ability && 'border-warn')}
                >
                  <option value="">—</option>
                  {ABILITIES.map((a) => (
                    <option key={a} value={a}>
                      {ABILITY_LABEL[a]}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
