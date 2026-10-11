import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useComputed, useDb, useStore } from '@/store';
import { Badge, Button, Card, Empty, Html, PageHeader, SourceTag } from '@/components/ui';
import { Picker } from '@/components/Picker';
import type { TraitData } from '@/data/types';
import { bookOptions, useSourceFilter } from '@/hooks';

export function TraitDetail({ t }: { t: TraitData }) {
  return (
    <div className="space-y-2">
      <h2 className="font-display text-xl font-semibold">{t.name}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">{t.category}</Badge>
        <SourceTag source={t.source} />
      </div>
      <Html html={t.desc} className="text-sm" />
    </div>
  );
}

export function TraitsStep() {
  const db = useDb();
  const { char } = useComputed()!;
  const update = useStore((s) => s.update);
  const setStep = useStore((s) => s.setStep);
  const allowed = useSourceFilter();
  const [picker, setPicker] = useState(false);
  const chosen = char.traits.map((id) => db.traitById.get(id)).filter(Boolean) as TraitData[];
  const drawbacks = chosen.filter((t) => t.category === 'Drawback').length;
  const normal = chosen.length - drawbacks;
  const limit = 2 + Math.min(drawbacks, 1);
  const cats = useMemo(() => [...new Set(db.traits.map((t) => t.category))].sort().map((c) => ({ value: c, label: c })), [db]);
  const dupCats = chosen.filter((t, i) => t.category !== 'Drawback' && chosen.findIndex((x) => x.category === t.category) !== i);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tratti"
        subtitle="Normalmente 2 tratti di categorie diverse; un difetto (drawback) concede un tratto aggiuntivo."
        actions={
          <>
            <Button onClick={() => setPicker(true)}>
              <Plus size={15} /> Aggiungi tratto
            </Button>
            <Button variant="primary" onClick={() => setStep('spells')}>
              Avanti
            </Button>
          </>
        }
      />
      <div className="flex gap-2">
        <Badge tone={normal > limit ? 'bad' : normal === limit ? 'ok' : 'accent'} className="!px-2.5 !py-1 !text-sm">
          {normal} / {limit} tratti
        </Badge>
        {drawbacks > 0 && <Badge className="!px-2.5 !py-1 !text-sm">{drawbacks} difetti</Badge>}
        {dupCats.length > 0 && <Badge tone="warn" className="!px-2.5 !py-1 !text-sm">Più tratti della stessa categoria: {[...new Set(dupCats.map((t) => t.category))].join(', ')}</Badge>}
      </div>
      {chosen.length === 0 ? (
        <Card>
          <Empty title="Nessun tratto">I tratti rappresentano il passato del personaggio. Molti rendono un'abilità di classe o danno +1 a una statistica.</Empty>
        </Card>
      ) : (
        chosen.map((t) => (
          <Card
            key={t.id}
            title={t.name}
            actions={
              <>
                <Badge tone="accent">{t.category}</Badge>
                <button className="rounded p-1 text-muted hover:text-bad" onClick={() => update((x) => void (x.traits = x.traits.filter((id) => id !== t.id)))}>
                  <X size={15} />
                </button>
              </>
            }
          >
            <Html html={t.desc} className="text-sm" />
            <SourceTag source={t.source} />
          </Card>
        ))
      )}
      <Picker
        open={picker}
        onClose={() => setPicker(false)}
        title="Scegli un tratto"
        items={db.traits.filter((t) => allowed(t.source))}
        getId={(t) => t.id}
        getName={(t) => t.name}
        searchText={(t) => `${t.name} ${t.desc.replace(/<[^>]+>/g, ' ')}`}
        renderRow={(t) => (
          <span className="flex items-center justify-between gap-2">
            <span className="truncate">{t.name}</span>
            <span className="shrink-0 text-[11px] text-muted">{t.category}</span>
          </span>
        )}
        filters={[
          { key: 'cat', label: 'Categoria', options: cats, test: (t, v) => t.category === v },
          { key: 'book', label: 'Manuale', options: bookOptions(db.traits.map((t) => t.source)), test: (t, v) => t.source?.book === v },
        ]}
        selectedIds={new Set(char.traits)}
        onPick={(t) => {
          update((x) => void (x.traits = [...new Set([...x.traits, t.id])]));
          setPicker(false);
        }}
        pickLabel="Aggiungi tratto"
        renderDetail={(t) => <TraitDetail t={t} />}
      />
    </div>
  );
}
