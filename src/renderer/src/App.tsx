import { useEffect, useState } from 'react';
import { BookOpen, Moon, Sun, Users } from 'lucide-react';
import { loadDatabase } from './data/db';
import { useStore } from './store';
import { Home } from './pages/Home';
import { Builder } from './pages/Builder';
import { Compendium } from './pages/Compendium';
import { cx } from './components/ui';

export function App() {
  const db = useStore((s) => s.db);
  const setDb = useStore((s) => s.setDb);
  const loadCharacters = useStore((s) => s.loadCharacters);
  const [loaded, setLoaded] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    loadDatabase((l) => setLoaded((x) => [...x, l]))
      .then(setDb)
      .catch((e) => setError(String(e)));
    loadCharacters();
  }, [setDb, loadCharacters]);

  if (!db) {
    return (
      <div className="grid h-full place-items-center">
        <div className="flex flex-col items-center gap-4">
          <Logo size={56} />
          <div className="font-display text-xl font-semibold">Pathbuilder 1e</div>
          {error ? (
            <div className="text-bad">Errore nel caricamento dei dati: {error}</div>
          ) : (
            <>
              <div className="h-1 w-56 overflow-hidden rounded-full bg-line">
                <div className="h-full bg-accent transition-all" style={{ width: `${(loaded.length / 14) * 100}%` }} />
              </div>
              <div className="text-xs text-muted">Caricamento {loaded.at(-1) ?? 'dati'}…</div>
            </>
          )}
        </div>
      </div>
    );
  }
  return <Shell />;
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M16 2 29 9.5v13L16 30 3 22.5v-13z" fill="var(--accent)" />
      <path d="M16 7.5 24.5 12.4v9.2L16 26.5l-8.5-4.9v-9.2z" fill="none" stroke="var(--accent-fg)" strokeWidth="1.6" />
      <path d="M16 7.5v19M7.5 12.4l17 9.2M24.5 12.4l-17 9.2" stroke="var(--accent-fg)" strokeWidth="1.1" opacity=".7" />
    </svg>
  );
}

function Shell() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const nav = [
    { key: 'home' as const, label: 'Personaggi', icon: Users },
    { key: 'compendium' as const, label: 'Compendio', icon: BookOpen },
  ];
  return (
    <div className="print-flow flex h-full">
      <aside className="no-print flex w-16 shrink-0 flex-col items-center gap-1 border-r border-line bg-panel py-3">
        <button onClick={() => setView('home')} className="mb-3" title="Pathbuilder 1e">
          <Logo />
        </button>
        {nav.map((n) => (
          <button
            key={n.key}
            title={n.label}
            onClick={() => setView(n.key)}
            className={cx(
              'flex w-12 flex-col items-center gap-0.5 rounded-lg py-2 text-[10px] transition-colors',
              view === n.key || (n.key === 'home' && view === 'builder') ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-panel-2 hover:text-fg',
            )}
          >
            <n.icon size={19} />
            {n.label}
          </button>
        ))}
        <div className="flex-1" />
        <button title="Cambia tema" onClick={toggleTheme} className="rounded-lg p-2 text-muted hover:bg-panel-2 hover:text-fg">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </aside>
      <main className="print-flow min-w-0 flex-1">
        {view === 'home' && <Home />}
        {view === 'builder' && <Builder />}
        {view === 'compendium' && <Compendium />}
      </main>
    </div>
  );
}
