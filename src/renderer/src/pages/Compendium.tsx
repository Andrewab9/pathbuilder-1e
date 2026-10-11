import { useMemo, useState, type ReactNode } from 'react';
import { useDb } from '@/store';
import { Browser } from '@/components/Picker';
import { Badge, Html, SourceTag, cx } from '@/components/ui';
import { bookOptions } from '@/hooks';
import { ClassDetail, ArchetypeDetail, KIND_LABEL } from './steps/ClassesStep';
import { FeatDetail } from './steps/FeatsStep';
import { TraitDetail } from './steps/TraitsStep';
import { SpellDetail } from './steps/SpellsStep';
import { FeatureDetail } from './steps/FeaturesStep';
import { KineticTalentDetail } from './steps/KineticistStep';
import { SCHOOL_LABEL, SIZE_LABEL, signed, ABILITY_SHORT } from '@/rules/constants';
import { gp, lbs } from '@/format';

type Tab = 'classes' | 'archetypes' | 'races' | 'feats' | 'traits' | 'spells' | 'features' | 'kinetic' | 'weapons' | 'armor' | 'gear' | 'abilities';

export function Compendium() {
  const db = useDb();
  const [tab, setTab] = useState<Tab>('feats');
  const tabs: { key: Tab; label: string; n: number }[] = [
    { key: 'classes', label: 'Classi', n: db.classes.length },
    { key: 'archetypes', label: 'Archetipi', n: db.archetypes.length },
    { key: 'races', label: 'Razze', n: db.races.length },
    { key: 'feats', label: 'Talenti', n: db.feats.length },
    { key: 'traits', label: 'Tratti', n: db.traits.length },
    { key: 'spells', label: 'Incantesimi', n: db.spells.length },
    { key: 'features', label: 'Privilegi', n: db.features.length },
    { key: 'kinetic', label: 'Talenti selvaggi', n: db.kinetic.talents.length },
    { key: 'weapons', label: 'Armi', n: db.weapons.length },
    { key: 'armor', label: 'Armature', n: db.armor.length },
    { key: 'gear', label: 'Oggetti', n: db.gear.length },
    { key: 'abilities', label: 'Proprietà magiche', n: db.magicAbilities.length },
  ];
  const spellClasses = useMemo(() => [...new Set(db.spells.flatMap((s) => Object.keys(s.levels)))].sort(), [db]);

  let body: ReactNode = null;
  switch (tab) {
    case 'classes':
      body = (
        <Browser
          key={tab}
          items={db.classes}
          getId={(x) => x.id}
          getName={(x) => x.name}
          renderRow={(x) => <Row name={x.name} right={KIND_LABEL[x.kind]} />}
          filters={[{ key: 'kind', label: 'Tipo', options: Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label })), test: (x, v) => x.kind === v }]}
          renderDetail={(x) => <ClassDetail cls={x} db={db} />}
        />
      );
      break;
    case 'archetypes':
      body = (
        <Browser
          key={tab}
          items={db.archetypes}
          getId={(x) => x.id}
          getName={(x) => x.name}
          searchText={(x) => `${x.name} ${db.classById.get(x.classId)?.name}`}
          renderRow={(x) => <Row name={x.name} right={db.classById.get(x.classId)?.name} />}
          filters={[
            { key: 'cls', label: 'Classe', options: [...db.archetypesByClass.keys()].map((id) => ({ value: id, label: db.classById.get(id)?.name ?? id })).sort((a, b) => a.label.localeCompare(b.label)), test: (x, v) => x.classId === v },
            { key: 'book', label: 'Manuale', options: bookOptions(db.archetypes.map((x) => x.source)), test: (x, v) => x.source?.book === v },
          ]}
          renderDetail={(x) => <ArchetypeDetail a={x} db={db} />}
        />
      );
      break;
    case 'races':
      body = (
        <Browser
          key={tab}
          items={db.races}
          getId={(x) => x.id}
          getName={(x) => x.name}
          renderRow={(x) => <Row name={x.name} right={x.core ? 'Base' : SIZE_LABEL[x.size]} />}
          renderDetail={(r) => (
            <div className="space-y-3">
              <h2 className="font-display text-xl font-semibold">{r.name}</h2>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="accent">{r.flexible ? '+2 a scelta' : Object.entries(r.abilityMods).map(([k, v]) => `${signed(v!)} ${ABILITY_SHORT[k as 'str']}`).join(', ')}</Badge>
                <Badge>{SIZE_LABEL[r.size]}</Badge>
                <Badge>{r.speed.land} ft.</Badge>
                <SourceTag source={r.source} />
              </div>
              {r.traits && (
                <ul className="space-y-1 text-sm">
                  {r.traits.map((t) => (
                    <li key={t.name}>
                      <b>{t.name}</b>: {t.desc}
                    </li>
                  ))}
                </ul>
              )}
              {!!r.alternateTraits?.length && (
                <div>
                  <h3 className="mb-1 font-semibold">Tratti alternativi</h3>
                  <ul className="space-y-1 text-sm">
                    {r.alternateTraits.map((t) => (
                      <li key={t.name}>
                        <b>{t.name}</b> <span className="text-muted">({t.replaces.join(', ')})</span>: {t.desc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Html html={r.desc} className="text-sm" />
            </div>
          )}
        />
      );
      break;
    case 'feats':
      body = (
        <Browser
          key={tab}
          items={db.feats}
          getId={(x) => x.id}
          getName={(x) => x.name}
          searchText={(x) => `${x.name} ${x.types.join(' ')} ${x.summary ?? ''}`}
          renderRow={(x) => <Row name={x.name} right={x.types.slice(0, 2).join(', ')} />}
          filters={[
            { key: 'type', label: 'Tipo', options: [...new Set(db.feats.flatMap((f) => f.types))].sort().map((t) => ({ value: t, label: t })), test: (f, v) => f.types.includes(v) },
            { key: 'book', label: 'Manuale', options: bookOptions(db.feats.map((f) => f.source)), test: (f, v) => f.source?.book === v },
          ]}
          renderDetail={(f) => <FeatDetail f={f} />}
        />
      );
      break;
    case 'traits':
      body = (
        <Browser
          key={tab}
          items={db.traits}
          getId={(x) => x.id}
          getName={(x) => x.name}
          renderRow={(x) => <Row name={x.name} right={x.category} />}
          filters={[{ key: 'cat', label: 'Categoria', options: [...new Set(db.traits.map((t) => t.category))].sort().map((c) => ({ value: c, label: c })), test: (t, v) => t.category === v }]}
          renderDetail={(t) => <TraitDetail t={t} />}
        />
      );
      break;
    case 'spells':
      body = (
        <Browser
          key={tab}
          items={db.spells}
          getId={(x) => x.id}
          getName={(x) => x.name}
          searchText={(x) => `${x.name} ${x.summary ?? ''}`}
          renderRow={(x) => <Row name={x.name} right={SCHOOL_LABEL[x.school] ?? x.school} />}
          filters={[
            { key: 'cls', label: 'Classe', options: spellClasses.map((c) => ({ value: c, label: db.classById.get(c)?.name ?? c })), test: (s, v) => s.levels[v] !== undefined },
            { key: 'lvl', label: 'Livello', options: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => ({ value: String(l), label: `${l}°` })), test: (s, v) => Object.values(s.levels).includes(+v) },
            { key: 'school', label: 'Scuola', options: Object.entries(SCHOOL_LABEL).map(([value, label]) => ({ value, label })), test: (s, v) => s.school === v },
          ]}
          renderDetail={(s) => <SpellDetail s={s} />}
        />
      );
      break;
    case 'features':
      body = (
        <Browser
          key={tab}
          items={db.features}
          getId={(x) => x.id}
          getName={(x) => x.name}
          searchText={(x) => `${x.name} ${(x.tags ?? []).join(' ')} ${(x.classes ?? []).join(' ')}`}
          renderRow={(x) => <Row name={x.name} right={x.classes?.[0]} />}
          filters={[
            { key: 'class', label: 'Classe', options: [...new Set(db.features.flatMap((f) => f.classes ?? []))].sort().map((x) => ({ value: x, label: x })), test: (f, v) => !!f.classes?.includes(v) },
            { key: 'origin', label: 'Origine', options: [{ value: 'base', label: 'Classe base' }, { value: 'archetype', label: 'Archetipo' }, { value: 'prestige', label: 'Prestigio' }], test: (f, v) => f.origin === v },
          ]}
          renderDetail={(f) => <FeatureDetail f={f} />}
        />
      );
      break;
    case 'kinetic':
      body = (
        <Browser
          key={tab}
          items={db.kinetic.talents}
          getId={(x) => x.id}
          getName={(x) => x.name}
          renderRow={(x) => <Row name={x.name} right={`${x.typeText} · ${x.elements.join('/')}`} />}
          filters={[
            { key: 'type', label: 'Tipo', options: [...new Set(db.kinetic.talents.map((t) => t.type))].map((v) => ({ value: v, label: v })), test: (t, v) => t.type === v },
            { key: 'el', label: 'Elemento', options: [...db.kinetic.elements.map((e) => ({ value: e.id, label: e.name })), { value: 'universal', label: 'Universal' }], test: (t, v) => t.elements.includes(v) },
          ]}
          renderDetail={(t) => <KineticTalentDetail t={t} />}
        />
      );
      break;
    case 'abilities':
      body = (
        <Browser
          key={tab}
          items={db.magicAbilities}
          getId={(x) => x.id}
          getName={(x) => x.name}
          renderRow={(x) => <Row name={x.name} right={`${x.kind}${x.ranged ? ' (distanza)' : ''} · ${x.bonus ? '+' + x.bonus : gp(x.flat ?? 0)}`} />}
          filters={[{ key: 'kind', label: 'Per', options: [{ value: 'weapon', label: 'Armi' }, { value: 'armor', label: 'Armature' }, { value: 'shield', label: 'Scudi' }], test: (a, v) => a.kind === v }]}
          renderDetail={(a) => (
            <div className="space-y-2">
              <h2 className="font-display text-xl font-semibold">{a.name}</h2>
              <div className="text-sm">
                {a.bonus ? `Bonus equivalente +${a.bonus}` : `Costo ${gp(a.flat ?? 0)}`}
                {a.aura ? ` · ${a.aura}` : ''}
                {a.cl ? ` · LI ${a.cl}` : ''}
              </div>
              <SourceTag source={a.source} />
              <Html html={a.desc} className="text-sm" />
            </div>
          )}
        />
      );
      break;
    case 'weapons':
      body = (
        <Browser
          key={tab}
          items={db.weapons}
          getId={(x) => x.id}
          getName={(x) => x.name}
          renderRow={(x) => <Row name={x.name} right={`${x.damage} · ${gp(x.price)}`} />}
          renderDetail={(w) => (
            <div className="space-y-2">
              <h2 className="font-display text-xl font-semibold">{w.name}</h2>
              <div className="text-sm">
                {w.category} · {w.kind} · {w.damage} · {w.critRange < 20 ? `${w.critRange}-20` : '20'}/×{w.critMult} · {w.damageTypes.join(', ')} · {gp(w.price)} · {lbs(w.weight)}
              </div>
              <SourceTag source={w.source} />
              <Html html={w.desc} className="text-sm" />
            </div>
          )}
        />
      );
      break;
    case 'armor':
      body = (
        <Browser
          key={tab}
          items={db.armor}
          getId={(x) => x.id}
          getName={(x) => x.name}
          renderRow={(x) => <Row name={x.name} right={`+${x.ac} · ${gp(x.price)}`} />}
          renderDetail={(a) => (
            <div className="space-y-2">
              <h2 className="font-display text-xl font-semibold">{a.name}</h2>
              <div className="text-sm">
                CA +{a.ac} · Des max {a.maxDex ?? '—'} · PA −{a.acp} · FIA {a.asf}% · {gp(a.price)} · {lbs(a.weight)}
              </div>
              <Html html={a.desc} className="text-sm" />
            </div>
          )}
        />
      );
      break;
    case 'gear':
      body = (
        <Browser
          key={tab}
          items={db.gear}
          getId={(x) => x.id}
          getName={(x) => x.name}
          renderRow={(x) => <Row name={x.name} right={gp(x.price)} />}
          renderDetail={(g) => (
            <div className="space-y-2">
              <h2 className="font-display text-xl font-semibold">{g.name}</h2>
              <div className="text-sm">
                {g.slot && `slot ${g.slot} · `}
                {gp(g.price)} · {lbs(g.weight)}
              </div>
              <SourceTag source={g.source} />
              <Html html={g.desc} className="text-sm" />
            </div>
          )}
        />
      );
      break;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-line bg-panel px-4 py-2">
        <h1 className="mr-4 font-display text-lg font-semibold">Compendio</h1>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cx('whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors', tab === t.key ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-panel-2 hover:text-fg')}
          >
            {t.label} <span className="text-[11px] opacity-70">{t.n.toLocaleString('it-IT')}</span>
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 bg-panel">{body}</div>
    </div>
  );
}

function Row({ name, right }: { name: string; right?: string }) {
  return (
    <span className="flex items-center justify-between gap-2">
      <span className="truncate">{name}</span>
      {right && <span className="shrink-0 text-[11px] text-muted">{right}</span>}
    </span>
  );
}
