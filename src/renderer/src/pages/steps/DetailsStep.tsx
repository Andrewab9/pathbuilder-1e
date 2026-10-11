import { ImagePlus, Trash2 } from 'lucide-react';
import { useCharacter, useStore } from '@/store';
import { Button, Card, Field, Input, PageHeader, Select, Toggle } from '@/components/ui';
import { ALIGNMENTS } from '@/rules/constants';
import { BOOK_CATEGORIES } from '@/hooks';

export function DetailsStep() {
  const char = useCharacter()!;
  const update = useStore((s) => s.update);
  const setStep = useStore((s) => s.setStep);
  const text = (key: 'name' | 'player' | 'deity' | 'gender' | 'age' | 'height' | 'weight' | 'homeland' | 'languages') => ({
    value: char[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => update((c) => void (c[key] = e.target.value)),
  });

  const onPortrait = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      // Ridimensiona per non appesantire il file del personaggio
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        update((c) => void (c.portrait = canvas.toDataURL('image/jpeg', 0.85)));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Dettagli del personaggio" subtitle="Informazioni di base e regole opzionali." actions={<Button variant="primary" onClick={() => setStep('race')}>Avanti: razza</Button>} />
      <Card>
        <div className="flex gap-5">
          <div className="flex flex-col items-center gap-2">
            <label className="grid h-28 w-28 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-line bg-panel-2 text-muted hover:border-accent">
              {char.portrait ? <img src={char.portrait} className="h-full w-full object-cover" /> : <ImagePlus size={26} />}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onPortrait(e.target.files?.[0])} />
            </label>
            {char.portrait && (
              <Button size="sm" variant="danger" onClick={() => update((c) => void (c.portrait = undefined))}>
                <Trash2 size={12} /> Rimuovi
              </Button>
            )}
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3">
            <Field label="Nome">
              <Input {...text('name')} />
            </Field>
            <Field label="Giocatore">
              <Input {...text('player')} />
            </Field>
            <Field label="Allineamento">
              <Select value={char.alignment} onChange={(e) => update((c) => void (c.alignment = e.target.value))}>
                {ALIGNMENTS.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Divinità">
              <Input {...text('deity')} />
            </Field>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-3">
          <Field label="Sesso">
            <Input {...text('gender')} />
          </Field>
          <Field label="Età">
            <Input {...text('age')} />
          </Field>
          <Field label="Altezza">
            <Input {...text('height')} />
          </Field>
          <Field label="Peso">
            <Input {...text('weight')} />
          </Field>
          <Field label="Terra natale">
            <Input {...text('homeland')} />
          </Field>
        </div>
        <Field label="Linguaggi" className="mt-3">
          <Input {...text('languages')} placeholder="Comune, Elfico…" />
        </Field>
        <Field label="Note" className="mt-3">
          <textarea
            value={char.notes}
            onChange={(e) => update((c) => void (c.notes = e.target.value))}
            rows={4}
            className="rounded-lg border border-line bg-panel-2 p-3 text-sm outline-none focus:border-accent"
          />
        </Field>
      </Card>

      <Card title="Regole e opzioni">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Punti ferita dopo il 1° livello" hint="Al 1° livello si prende sempre il massimo del dado vita.">
            <Select value={char.settings.hpMethod} onChange={(e) => update((c) => void (c.settings.hpMethod = e.target.value as 'avg'))}>
              <option value="avg">Media (regola PFS: metà dado + 1)</option>
              <option value="max">Massimo</option>
              <option value="roll">Tiro (inserisci il risultato per livello)</option>
            </Select>
          </Field>
          <Field label="Abilità di background" hint="Regola opzionale di Pathfinder Unchained (2 gradi extra per livello solo in abilità di background, gestiti manualmente).">
            <div className="pt-1.5">
              <Toggle checked={char.settings.backgroundSkills} onChange={(v) => update((c) => void (c.settings.backgroundSkills = v))} label="Mostra Arte e Sapere" />
            </div>
          </Field>
        </div>
        <div className="mt-5">
          <div className="mb-2 text-xs font-medium text-muted">Manuali consentiti</div>
          <div className="grid grid-cols-2 gap-2">
            {BOOK_CATEGORIES.map((b) => (
              <Toggle
                key={b.key}
                checked={!char.settings.excludeCategories.includes(b.key)}
                onChange={(v) =>
                  update((c) => {
                    c.settings.excludeCategories = v ? c.settings.excludeCategories.filter((x) => x !== b.key) : [...c.settings.excludeCategories, b.key];
                  })
                }
                label={b.label}
              />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
