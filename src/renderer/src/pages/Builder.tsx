import { ArrowLeft, BookMarked, Flame, Dna, Dumbbell, FileText, Gem, Layers, ListChecks, Sparkles, Swords, UserRound, Wand2 } from 'lucide-react';
import { useComputed, useDb, useStore, type Step } from '@/store';
import { StatsPanel } from '@/components/StatsPanel';
import { cx } from '@/components/ui';
import { classSummary } from '@/format';
import { DetailsStep } from './steps/DetailsStep';
import { RaceStep } from './steps/RaceStep';
import { AbilitiesStep } from './steps/AbilitiesStep';
import { ClassesStep } from './steps/ClassesStep';
import { FeaturesStep } from './steps/FeaturesStep';
import { SkillsStep } from './steps/SkillsStep';
import { FeatsStep } from './steps/FeatsStep';
import { TraitsStep } from './steps/TraitsStep';
import { SpellsStep } from './steps/SpellsStep';
import { EquipmentStep } from './steps/EquipmentStep';
import { SheetStep } from './steps/SheetStep';
import { KineticistStep } from './steps/KineticistStep';

const STEPS: { key: Step; label: string; icon: typeof UserRound; section?: string }[] = [
  { key: 'details', label: 'Dettagli', icon: UserRound },
  { key: 'race', label: 'Razza', icon: Dna, section: 'race' },
  { key: 'abilities', label: 'Caratteristiche', icon: Dumbbell, section: 'abilities' },
  { key: 'classes', label: 'Classi e livelli', icon: Layers, section: 'classes' },
  { key: 'features', label: 'Privilegi', icon: Sparkles, section: 'features' },
  { key: 'kinetic', label: 'Talenti selvaggi', icon: Flame, section: 'kinetic' },
  { key: 'skills', label: 'Abilità', icon: ListChecks, section: 'skills' },
  { key: 'feats', label: 'Talenti', icon: Swords, section: 'feats' },
  { key: 'traits', label: 'Tratti', icon: BookMarked, section: 'traits' },
  { key: 'spells', label: 'Incantesimi', icon: Wand2, section: 'spells' },
  { key: 'equipment', label: 'Equipaggiamento', icon: Gem, section: 'equipment' },
  { key: 'sheet', label: 'Scheda', icon: FileText },
];

export function Builder() {
  const data = useComputed();
  const db = useDb();
  const step = useStore((s) => s.step);
  const setStep = useStore((s) => s.setStep);
  const setView = useStore((s) => s.setView);
  const saving = useStore((s) => s.saving);
  if (!data) return null;
  const { char, c } = data;
  const count = (section?: string) => c.warnings.filter((w) => w.section === section && w.level !== 'info').length;
  const todo = (section?: string) => c.warnings.filter((w) => w.section === section && w.level === 'info').length;

  return (
    <div className="print-flow flex h-full">
      <nav className="no-print flex w-56 shrink-0 flex-col border-r border-line bg-panel">
        <button onClick={() => setView('home')} className="flex items-center gap-2 px-4 pb-2 pt-4 text-xs text-muted hover:text-fg">
          <ArrowLeft size={14} /> Tutti i personaggi
        </button>
        <div className="px-4 pb-3">
          <div className="truncate font-display text-lg font-semibold">{char.name || 'Senza nome'}</div>
          <div className="line-clamp-2 text-xs text-muted">
            {[c.race?.name, classSummary(char, db)].filter(Boolean).join(' · ') || 'Personaggio vuoto'}
          </div>
        </div>
        <div className="flex-1 space-y-0.5 overflow-auto px-2 pb-3">
          {STEPS.filter((s) => s.key !== 'kinetic' || c.kinetic).map((s, i) => {
            const errs = count(s.section);
            const pending = todo(s.section);
            const hidden = s.key === 'spells' && !c.casters.length;
            return (
              <button
                key={s.key}
                onClick={() => setStep(s.key)}
                className={cx(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                  step === s.key ? 'bg-accent-soft font-medium text-accent' : 'text-fg/80 hover:bg-panel-2',
                  hidden && 'opacity-50',
                )}
              >
                <span className="w-4 text-[10px] text-muted tabular">{i + 1}</span>
                <s.icon size={16} />
                <span className="flex-1 text-left">{s.label}</span>
                {errs > 0 ? (
                  <span className="rounded-full bg-bad/15 px-1.5 text-[10px] font-semibold text-bad">{errs}</span>
                ) : pending > 0 ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-warn" title={`${pending} da completare`} />
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="border-t border-line px-4 py-2 text-[11px] text-muted">
          {saving ? 'Salvataggio…' : 'Salvato'}
        </div>
      </nav>
      <div className="print-flow min-w-0 flex-1 overflow-auto">
        <div className={cx('print-flow mx-auto px-8 py-7', step === 'sheet' ? 'max-w-5xl' : 'max-w-4xl')}>
          {step === 'details' && <DetailsStep />}
          {step === 'race' && <RaceStep />}
          {step === 'abilities' && <AbilitiesStep />}
          {step === 'classes' && <ClassesStep />}
          {step === 'features' && <FeaturesStep />}
          {step === 'kinetic' && <KineticistStep />}
          {step === 'skills' && <SkillsStep />}
          {step === 'feats' && <FeatsStep />}
          {step === 'traits' && <TraitsStep />}
          {step === 'spells' && <SpellsStep />}
          {step === 'equipment' && <EquipmentStep />}
          {step === 'sheet' && <SheetStep />}
        </div>
      </div>
      {step !== 'sheet' && <StatsPanel />}
    </div>
  );
}
