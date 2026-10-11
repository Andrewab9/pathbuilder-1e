import { useMemo, useState } from 'react';
import { Plus, Shield, Sword, Trash2, Package, PenLine, X } from 'lucide-react';
import { useComputed, useDb, useStore } from '@/store';
import { Badge, Button, Card, Field, Html, Input, Modal, PageHeader, Select, SourceTag, Stepper, Toggle, cx } from '@/components/ui';
import { Picker } from '@/components/Picker';
import type { ArmorData, GearData, WeaponData } from '@/data/types';
import { uid, type EquipItem } from '@/rules/character';
import { ABILITIES, ABILITY_LABEL, BONUS_TYPE_LABEL, SAVE_LABEL, SKILLS, signed } from '@/rules/constants';
import { gp, lbs } from '@/format';
import { bookOptions, useSourceFilter } from '@/hooks';

export const BONUS_TARGETS: { value: string; label: string }[] = [
  ...ABILITIES.map((a) => ({ value: a, label: ABILITY_LABEL[a] })),
  { value: 'ac', label: 'CA' },
  { value: 'aac', label: 'CA (armatura)' },
  { value: 'sac', label: 'CA (scudo)' },
  { value: 'nac', label: 'Armatura naturale' },
  { value: 'allSavingThrows', label: 'Tutti i tiri salvezza' },
  { value: 'fort', label: SAVE_LABEL.fort },
  { value: 'ref', label: SAVE_LABEL.ref },
  { value: 'will', label: SAVE_LABEL.will },
  { value: 'init', label: 'Iniziativa' },
  { value: 'attack', label: 'Tiri per colpire' },
  { value: 'mattack', label: 'Tiri per colpire in mischia' },
  { value: 'rattack', label: 'Tiri per colpire a distanza' },
  { value: 'damage', label: 'Danni' },
  { value: 'cmb', label: 'BMC' },
  { value: 'cmd', label: 'DMC' },
  { value: 'mhp', label: 'Punti ferita' },
  { value: 'landSpeed', label: 'Velocità' },
  { value: 'spellResist', label: 'Resistenza agli incantesimi' },
  { value: 'skills', label: 'Tutte le abilità' },
  ...SKILLS.map((s) => ({ value: `skill.${s.key}`, label: `Abilità: ${s.it}` })),
];
const BONUS_TYPES = ['untyped', 'enh', 'deflection', 'dodge', 'insight', 'luck', 'morale', 'competence', 'circumstance', 'resist', 'sacred', 'profane', 'natural', 'size', 'trait', 'alchemical'];

const WEAPON_CAT: Record<string, string> = { simple: 'Semplice', martial: 'Da guerra', exotic: 'Esotica', misc: 'Varie' };
const WEAPON_KIND: Record<string, string> = { light: 'Leggera', '1h': 'A una mano', '2h': 'A due mani', ranged: 'A distanza', ammo: 'Munizioni' };
const ARMOR_CAT: Record<string, string> = { lightArmor: 'Leggera', mediumArmor: 'Media', heavyArmor: 'Pesante', lightShield: 'Scudo leggero', heavyShield: 'Scudo pesante', towerShield: 'Scudo torre', other: 'Scudo (altro)' };

export function EquipmentStep() {
  const db = useDb();
  const { char, c } = useComputed()!;
  const update = useStore((s) => s.update);
  const setStep = useStore((s) => s.setStep);
  const allowed = useSourceFilter();
  const [picker, setPicker] = useState<'weapon' | 'armor' | 'gear' | null>(null);
  const [custom, setCustom] = useState<EquipItem | null>(null);

  const add = (item: Omit<EquipItem, 'uid' | 'qty' | 'equipped'>, equipped = false) =>
    update((x) => void x.equipment.push({ uid: uid(), qty: 1, equipped, ...item }));
  const patch = (u: string, p: Partial<EquipItem>) =>
    update((x) => {
      const it = x.equipment.find((e) => e.uid === u);
      if (it) Object.assign(it, p);
    });

  // Prezzo di armi/armature magiche: (bonus totale)² × 2000 (armi) o × 1000 (armature) + costi fissi
  const enhCost = (it: EquipItem) => {
    const abil = (it.abilities ?? []).map((id) => db.magicAbilityById.get(id)).filter(Boolean);
    const bonus = (it.enhancement ?? 0) + (it.enhancement ? abil.reduce((a, x) => a + (x!.bonus ?? 0), 0) : 0);
    const flat = abil.reduce((a, x) => a + (x!.flat ?? 0), 0);
    const mw = it.kind === 'weapon' ? 300 : 150;
    if (it.kind === 'weapon') return (bonus ? bonus ** 2 * 2000 + mw : it.masterwork ? mw : 0) + flat;
    if (it.kind === 'armor') return (bonus ? bonus ** 2 * 1000 + mw : it.masterwork ? mw : 0) + flat;
    return 0;
  };
  const basePrice = (it: EquipItem) => {
    if (it.kind === 'weapon') return db.weaponById.get(it.refId ?? '')?.price ?? it.price;
    if (it.kind === 'armor') return db.armorById.get(it.refId ?? '')?.price ?? it.price;
    return it.price;
  };
  const setEnh = (it: EquipItem, enhancement: number, masterwork = it.masterwork, abilities = it.abilities) => {
    const next = { ...it, enhancement, abilities, masterwork: masterwork || enhancement > 0 };
    patch(it.uid, { enhancement, abilities, masterwork: next.masterwork, price: basePrice(it) + enhCost(next) });
  };
  const [abilityFor, setAbilityFor] = useState<EquipItem | null>(null);
  const abilityItems = useMemo(() => {
    if (!abilityFor) return [];
    const armorKind = abilityFor.kind === 'armor' ? db.armorById.get(abilityFor.refId ?? '')?.kind : undefined;
    const ranged = abilityFor.kind === 'weapon' ? db.weaponById.get(abilityFor.refId ?? '')?.ranged : false;
    return db.magicAbilities.filter(
      (a) => allowed(a.source) && (abilityFor.kind === 'weapon' ? a.kind === 'weapon' && !!a.ranged === !!ranged : a.kind === (armorKind === 'shield' ? 'shield' : 'armor')),
    );
  }, [abilityFor, db, allowed]);

  const loadLabel = ['Leggero', 'Medio', 'Pesante', 'Sovraccarico'][c.load.level];
  const budgetLeft = c.wealth.budget - c.wealth.spent;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Equipaggiamento"
        subtitle="Armi, armature e oggetti: quelli indossati influenzano CA, attacchi e bonus."
        actions={<Button variant="primary" onClick={() => setStep('sheet')}>Vai alla scheda</Button>}
      />

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <div className="text-xs text-muted">Denaro</div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {(['pp', 'gp', 'sp', 'cp'] as const).map((k) => (
              <Field key={k} label={{ pp: 'mp', gp: 'mo', sp: 'ma', cp: 'mr' }[k]}>
                <Input type="number" min={0} value={char.money[k]} onChange={(e) => update((x) => void (x.money[k] = Math.max(0, +e.target.value || 0)))} className="h-8 px-2" />
              </Field>
            ))}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-muted">Valore dell'equipaggiamento</div>
          <div className="mt-1 font-display text-2xl font-semibold">{gp(c.wealth.spent)}</div>
          {c.level > 1 && (
            <div className={cx('text-xs', budgetLeft < 0 ? 'text-bad' : 'text-muted')}>
              Ricchezza per il livello {c.level}: {gp(c.wealth.budget)} ({budgetLeft >= 0 ? `${gp(budgetLeft)} disponibili` : `${gp(-budgetLeft)} oltre`})
            </div>
          )}
        </Card>
        <Card>
          <div className="text-xs text-muted">Carico</div>
          <div className="mt-1 font-display text-2xl font-semibold">{lbs(c.load.weight)}</div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
            <div className={cx('h-full', c.load.level === 0 ? 'bg-ok' : c.load.level === 1 ? 'bg-warn' : 'bg-bad')} style={{ width: `${Math.min(100, (c.load.weight / Math.max(1, c.load.heavy)) * 100)}%` }} />
          </div>
          <div className="mt-1 text-xs text-muted">
            {loadLabel} · L {c.load.light} / M {c.load.medium} / P {c.load.heavy} lb
          </div>
        </Card>
      </div>

      <Card
        title="Inventario"
        actions={
          <>
            <Button size="sm" onClick={() => setPicker('weapon')}>
              <Sword size={13} /> Arma
            </Button>
            <Button size="sm" onClick={() => setPicker('armor')}>
              <Shield size={13} /> Armatura / scudo
            </Button>
            <Button size="sm" onClick={() => setPicker('gear')}>
              <Package size={13} /> Oggetto
            </Button>
            <Button size="sm" variant="soft" onClick={() => setCustom({ uid: uid(), kind: 'custom', name: '', qty: 1, equipped: true, price: 0, weight: 0, changes: [] })}>
              <PenLine size={13} /> Personalizzato
            </Button>
          </>
        }
      >
        {char.equipment.length === 0 ? (
          <p className="text-sm text-muted">Inventario vuoto.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1.5 font-medium">Oggetto</th>
                <th className="font-medium">Indossato</th>
                <th className="font-medium">Potenz.</th>
                <th className="font-medium">Qtà</th>
                <th className="text-right font-medium">Prezzo</th>
                <th className="text-right font-medium">Peso</th>
                <th className="w-14" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {char.equipment.map((it) => (
                <tr key={it.uid}>
                  <td className="py-2">
                    <div className="font-medium">
                      {it.name}
                      {it.enhancement ? ` +${it.enhancement}` : it.masterwork ? ' (perfetto)' : ''}
                    </div>
                    {(it.abilities ?? []).length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {it.abilities!.map((id) => (
                          <Badge key={id} tone="accent">
                            {db.magicAbilityById.get(id)?.name ?? id}
                            <button className="ml-0.5 hover:text-bad" onClick={() => setEnh(it, it.enhancement ?? 0, it.masterwork, it.abilities!.filter((x) => x !== id))}>
                              <X size={10} />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="text-[11px] text-muted">
                      {it.kind === 'weapon' ? 'Arma' : it.kind === 'armor' ? 'Armatura' : it.kind === 'custom' ? 'Personalizzato' : 'Oggetto'}
                      {it.changes?.length ? ` · ${it.changes.map((ch) => `${BONUS_TARGETS.find((t) => t.value === ch.target)?.label ?? ch.target} ${signed(+ch.formula || 0)}`).join(', ')}` : ''}
                    </div>
                  </td>
                  <td>
                    <Toggle checked={it.equipped} onChange={(v) => patch(it.uid, { equipped: v })} />
                  </td>
                  <td>
                    {(it.kind === 'weapon' || it.kind === 'armor') && (
                      <div className="flex items-center gap-1">
                        <Select value={it.enhancement ?? 0} onChange={(e) => setEnh(it, +e.target.value)} className="h-7 w-16 px-2 text-xs">
                          {[0, 1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n ? `+${n}` : '—'}
                            </option>
                          ))}
                        </Select>
                        {!!it.enhancement && (
                          <button className="rounded px-1 text-[11px] text-accent hover:underline" title="Proprietà speciali (flaming, keen…)" onClick={() => setAbilityFor(it)}>
                            + proprietà
                          </button>
                        )}
                        {!it.enhancement && (
                          <label className="flex items-center gap-1 text-[11px] text-muted" title="Perfetto (masterwork)">
                            <input type="checkbox" checked={!!it.masterwork} onChange={(e) => setEnh(it, 0, e.target.checked)} /> perf.
                          </label>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <Stepper value={it.qty} min={1} onChange={(v) => patch(it.uid, { qty: v })} />
                  </td>
                  <td className="text-right tabular">{gp(it.price * it.qty)}</td>
                  <td className="text-right tabular">{lbs(it.weight * it.qty)}</td>
                  <td className="text-right">
                    {it.kind === 'custom' && (
                      <button className="rounded p-1 text-muted hover:text-fg" onClick={() => setCustom(structuredClone(it))}>
                        <PenLine size={14} />
                      </button>
                    )}
                    <button className="rounded p-1 text-muted hover:text-bad" onClick={() => update((x) => void (x.equipment = x.equipment.filter((e) => e.uid !== it.uid)))}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Attacchi">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1.5 font-medium">Arma</th>
              <th className="font-medium">Attacco</th>
              <th className="font-medium">Danni</th>
              <th className="font-medium">Critico</th>
              <th className="font-medium">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {c.attacks.map((a) => (
              <tr key={a.uid}>
                <td className="py-1.5 font-medium">{a.name}</td>
                <td className="font-semibold tabular">{a.attack.map(signed).join('/')}</td>
                <td className="tabular">
                  {a.damage} {a.type && <span className="text-xs text-muted">{a.type}</span>}
                </td>
                <td className="tabular">{a.crit}</td>
                <td className="text-xs text-muted">{a.notes.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card
        title="Bonus temporanei e modificatori manuali"
        actions={
          <Button size="sm" onClick={() => update((x) => void x.customBonuses.push({ uid: uid(), label: '', target: 'ac', value: 1, type: 'untyped', enabled: true }))}>
            <Plus size={13} /> Aggiungi
          </Button>
        }
      >
        <p className="mb-3 text-xs text-muted">Incantesimi attivi (es. Bull's Strength), condizioni o effetti non automatizzati. Rispettano le regole di cumulo dei bonus.</p>
        <div className="space-y-2">
          {char.customBonuses.map((b) => (
            <div key={b.uid} className="flex items-center gap-2">
              <Toggle checked={b.enabled} onChange={(v) => update((x) => void (x.customBonuses.find((y) => y.uid === b.uid)!.enabled = v))} />
              <Input value={b.label} placeholder="Descrizione" onChange={(e) => update((x) => void (x.customBonuses.find((y) => y.uid === b.uid)!.label = e.target.value))} className="h-8 flex-1" />
              <Select value={b.target} onChange={(e) => update((x) => void (x.customBonuses.find((y) => y.uid === b.uid)!.target = e.target.value))} className="h-8 w-48 text-xs">
                {BONUS_TARGETS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
              <Select value={b.type} onChange={(e) => update((x) => void (x.customBonuses.find((y) => y.uid === b.uid)!.type = e.target.value))} className="h-8 w-36 text-xs">
                {BONUS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {BONUS_TYPE_LABEL[t] ?? t}
                  </option>
                ))}
              </Select>
              <Stepper value={b.value} onChange={(v) => update((x) => void (x.customBonuses.find((y) => y.uid === b.uid)!.value = v))} />
              <button className="rounded p-1 text-muted hover:text-bad" onClick={() => update((x) => void (x.customBonuses = x.customBonuses.filter((y) => y.uid !== b.uid)))}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Picker
        open={picker === 'weapon'}
        onClose={() => setPicker(null)}
        title="Aggiungi arma"
        items={db.weapons.filter((w) => allowed(w.source))}
        getId={(w) => w.id}
        getName={(w) => w.name}
        renderRow={(w) => (
          <span className="flex items-center justify-between gap-2">
            <span className="truncate">{w.name}</span>
            <span className="shrink-0 text-[11px] text-muted">
              {w.damage} · {gp(w.price)}
            </span>
          </span>
        )}
        filters={[
          { key: 'cat', label: 'Categoria', options: Object.entries(WEAPON_CAT).map(([value, label]) => ({ value, label })), test: (w, v) => w.category === v },
          { key: 'kind', label: 'Tipo', options: Object.entries(WEAPON_KIND).map(([value, label]) => ({ value, label })), test: (w, v) => w.kind === v },
          { key: 'book', label: 'Manuale', options: bookOptions(db.weapons.map((w) => w.source)), test: (w, v) => w.source?.book === v },
        ]}
        onPick={(w: WeaponData) => {
          add({ kind: 'weapon', refId: w.id, name: w.name, price: w.price, weight: w.weight }, true);
          setPicker(null);
        }}
        pickLabel="Aggiungi"
        renderDetail={(w) => (
          <div className="space-y-3">
            <h2 className="font-display text-xl font-semibold">{w.name}</h2>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="accent">{WEAPON_CAT[w.category] ?? w.category}</Badge>
              <Badge>{WEAPON_KIND[w.kind] ?? w.kind}</Badge>
              <SourceTag source={w.source} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <Mini label="Danni (M)" value={w.damage || '—'} />
              <Mini label="Critico" value={`${w.critRange < 20 ? `${w.critRange}-20` : '20'}/×${w.critMult}`} />
              <Mini label="Tipo" value={w.damageTypes.join(', ') || '—'} />
              <Mini label="Gittata" value={w.rangeIncrement ? `${w.rangeIncrement} ft.` : '—'} />
              <Mini label="Prezzo" value={gp(w.price)} />
              <Mini label="Peso" value={lbs(w.weight)} />
            </div>
            <Html html={w.desc} className="text-sm" />
          </div>
        )}
      />
      <Picker
        open={picker === 'armor'}
        onClose={() => setPicker(null)}
        title="Aggiungi armatura o scudo"
        items={db.armor.filter((a) => allowed(a.source))}
        getId={(a) => a.id}
        getName={(a) => a.name}
        renderRow={(a) => (
          <span className="flex items-center justify-between gap-2">
            <span className="truncate">{a.name}</span>
            <span className="shrink-0 text-[11px] text-muted">
              +{a.ac} · {gp(a.price)}
            </span>
          </span>
        )}
        filters={[{ key: 'cat', label: 'Categoria', options: Object.entries(ARMOR_CAT).map(([value, label]) => ({ value, label })), test: (a, v) => a.category === v }]}
        onPick={(a: ArmorData) => {
          setPicker(null);
          add({ kind: 'armor', refId: a.id, name: a.name, price: a.price, weight: a.weight }, !char.equipment.some((e) => e.equipped && e.kind === 'armor' && db.armorById.get(e.refId ?? '')?.kind === a.kind));
        }}
        pickLabel="Aggiungi"
        renderDetail={(a) => (
          <div className="space-y-3">
            <h2 className="font-display text-xl font-semibold">{a.name}</h2>
            <Badge tone="accent">{ARMOR_CAT[a.category] ?? a.category}</Badge>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <Mini label="Bonus CA" value={`+${a.ac}`} />
              <Mini label="Des max" value={a.maxDex === null ? '—' : `+${a.maxDex}`} />
              <Mini label="Penalità" value={a.acp ? `−${a.acp}` : '0'} />
              <Mini label="Fallimento arcano" value={`${a.asf}%`} />
              <Mini label="Prezzo" value={gp(a.price)} />
              <Mini label="Peso" value={lbs(a.weight)} />
            </div>
            <Html html={a.desc} className="text-sm" />
          </div>
        )}
      />
      <Picker
        open={picker === 'gear'}
        onClose={() => setPicker(null)}
        title="Aggiungi oggetto"
        items={db.gear.filter((g) => allowed(g.source))}
        getId={(g) => g.id}
        getName={(g) => g.name}
        renderRow={(g) => (
          <span className="flex items-center justify-between gap-2">
            <span className="truncate">{g.name}</span>
            <span className="shrink-0 text-[11px] text-muted">{gp(g.price)}</span>
          </span>
        )}
        filters={[
          {
            key: 'type',
            label: 'Tipo',
            options: [
              { value: 'wondrous', label: 'Oggetti meravigliosi' },
              { value: 'ring', label: 'Anelli' },
              { value: 'rod', label: 'Verghe' },
              { value: 'staff', label: 'Bastoni' },
              { value: 'weapon', label: 'Armi specifiche' },
              { value: 'armor', label: 'Armature e scudi specifici' },
              { value: 'potion', label: 'Pozioni e cibi magici' },
              { value: 'bonus', label: 'Con bonus automatici' },
              { value: 'gear', label: 'Equipaggiamento comune' },
              { value: 'consumable', label: 'Consumabili' },
            ],
            test: (g, v) =>
              v === 'bonus'
                ? !!g.changes
                : v === 'consumable'
                  ? g.type === 'consumable'
                  : v === 'gear'
                    ? g.type === 'loot' || g.type === 'container' || (g.type === 'equipment' && !g.changes)
                    : g.type === 'magic' && g.subType === v,
          },
          { key: 'book', label: 'Manuale', options: bookOptions(db.gear.map((g) => g.source)), test: (g, v) => g.source?.book === v },
          { key: 'slot', label: 'Slot', options: [...new Set(db.gear.map((g) => g.slot).filter(Boolean) as string[])].map((s) => ({ value: s, label: s })), test: (g, v) => g.slot === v },
        ]}
        onPick={(g: GearData) => {
          add({ kind: 'gear', refId: g.id, name: g.name, price: g.price, weight: g.weight }, !!g.changes);
          setPicker(null);
        }}
        pickLabel="Aggiungi"
        renderDetail={(g) => (
          <div className="space-y-3">
            <h2 className="font-display text-xl font-semibold">{g.name}</h2>
            <div className="flex flex-wrap gap-1.5">
              {g.slot && <Badge tone="accent">slot: {g.slot}</Badge>}
              {g.cl && <Badge>LI {g.cl}</Badge>}
              {g.aura && <Badge>{g.aura}</Badge>}
              <Badge>{gp(g.price)}</Badge>
              <Badge>{lbs(g.weight)}</Badge>
              {g.changes && <Badge tone="ok">Bonus applicati automaticamente se indossato</Badge>}
              <SourceTag source={g.source} />
            </div>
            <Html html={g.desc} className="text-sm" />
          </div>
        )}
      />

      {abilityFor && (
        <Picker
          open
          onClose={() => setAbilityFor(null)}
          title={`Proprietà speciali — ${abilityFor.name} +${abilityFor.enhancement}`}
          items={abilityItems}
          getId={(a) => a.id}
          getName={(a) => a.name}
          renderRow={(a) => (
            <span className="flex items-center justify-between gap-2">
              <span className="truncate">{a.name}</span>
              <span className="shrink-0 text-[11px] text-muted">{a.bonus ? `+${a.bonus}` : gp(a.flat ?? 0)}</span>
            </span>
          )}
          selectedIds={new Set(abilityFor.abilities ?? [])}
          onPick={(a) => {
            const cur = char.equipment.find((e) => e.uid === abilityFor.uid) ?? abilityFor;
            const list = cur.abilities ?? [];
            const total = (cur.enhancement ?? 0) + [...list, a.id].reduce((sum, id) => sum + (db.magicAbilityById.get(id)?.bonus ?? 0), 0);
            if (!list.includes(a.id) && total <= 10) setEnh(cur, cur.enhancement ?? 0, cur.masterwork, [...list, a.id]);
            setAbilityFor(null);
          }}
          pickLabel="Aggiungi proprietà"
          renderDetail={(a) => (
            <div className="space-y-3">
              <h2 className="font-display text-xl font-semibold">{a.name}</h2>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="accent">{a.bonus ? `bonus +${a.bonus}` : gp(a.flat ?? 0)}</Badge>
                {a.aura && <Badge>{a.aura}</Badge>}
                {a.cl && <Badge>LI {a.cl}</Badge>}
                <SourceTag source={a.source} />
              </div>
              <p className="text-xs text-muted">Il bonus totale (potenziamento più proprietà) non può superare +10.</p>
              <Html html={a.desc} className="text-sm" />
            </div>
          )}
        />
      )}

      {custom && (
        <Modal
          open
          onClose={() => setCustom(null)}
          title="Oggetto personalizzato"
          footer={
            <>
              <Button variant="ghost" onClick={() => setCustom(null)}>
                Annulla
              </Button>
              <Button
                variant="primary"
                disabled={!custom.name}
                onClick={() => {
                  update((x) => {
                    const i = x.equipment.findIndex((e) => e.uid === custom.uid);
                    if (i >= 0) x.equipment[i] = custom;
                    else x.equipment.push(custom);
                  });
                  setCustom(null);
                }}
              >
                Salva
              </Button>
            </>
          }
        >
          <div className="space-y-3 p-5">
            <Field label="Nome">
              <Input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="es. Mantello della resistenza +2" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prezzo (mo)">
                <Input type="number" value={custom.price} onChange={(e) => setCustom({ ...custom, price: +e.target.value || 0 })} />
              </Field>
              <Field label="Peso (lb)">
                <Input type="number" value={custom.weight} onChange={(e) => setCustom({ ...custom, weight: +e.target.value || 0 })} />
              </Field>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-muted">Bonus conferiti (se indossato)</span>
                <Button size="sm" variant="ghost" onClick={() => setCustom({ ...custom, changes: [...(custom.changes ?? []), { target: 'allSavingThrows', formula: '1', type: 'resist' }] })}>
                  <Plus size={12} /> Bonus
                </Button>
              </div>
              {(custom.changes ?? []).map((ch, i) => (
                <div key={i} className="mb-1.5 flex items-center gap-2">
                  <Select
                    value={ch.target}
                    onChange={(e) => setCustom({ ...custom, changes: custom.changes!.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)) })}
                    className="h-8 flex-1 text-xs"
                  >
                    {BONUS_TARGETS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                  <Select value={ch.type} onChange={(e) => setCustom({ ...custom, changes: custom.changes!.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)) })} className="h-8 w-32 text-xs">
                    {BONUS_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {BONUS_TYPE_LABEL[t] ?? t}
                      </option>
                    ))}
                  </Select>
                  <Stepper value={+ch.formula || 0} onChange={(v) => setCustom({ ...custom, changes: custom.changes!.map((x, j) => (j === i ? { ...x, formula: String(v) } : x)) })} />
                  <button className="text-muted hover:text-bad" onClick={() => setCustom({ ...custom, changes: custom.changes!.filter((_, j) => j !== i) })}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
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
