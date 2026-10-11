import { useState } from 'react';
import { Copy, Download, FolderOpen, Plus, Trash2, Upload, UserRound } from 'lucide-react';
import { api, useStore } from '@/store';
import { Button, Empty, Modal, PageHeader } from '@/components/ui';
import { classSummary, relativeTime } from '@/format';
import { ALIGNMENTS } from '@/rules/constants';

export function Home() {
  const db = useStore((s) => s.db)!;
  const characters = useStore((s) => s.characters);
  const create = useStore((s) => s.createCharacter);
  const open = useStore((s) => s.openCharacter);
  const duplicate = useStore((s) => s.duplicateCharacter);
  const remove = useStore((s) => s.deleteCharacter);
  const importChar = useStore((s) => s.importCharacter);
  const [confirm, setConfirm] = useState<string | null>(null);
  const toDelete = characters.find((c) => c.id === confirm);

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-6xl px-8 py-8">
        <PageHeader
          title="I tuoi personaggi"
          subtitle={`${characters.length} personaggi · ${db.classes.length} classi, ${db.archetypes.length} archetipi, ${db.feats.length} talenti, ${db.spells.length} incantesimi`}
          actions={
            <>
              {api && (
                <Button variant="ghost" onClick={() => api!.openCharactersFolder()} title="Apri la cartella dei salvataggi">
                  <FolderOpen size={16} /> Cartella
                </Button>
              )}
              {api && (
                <Button onClick={importChar}>
                  <Upload size={16} /> Importa
                </Button>
              )}
              <Button variant="primary" onClick={create}>
                <Plus size={16} /> Nuovo personaggio
              </Button>
            </>
          }
        />

        {characters.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line">
            <Empty icon={<UserRound size={40} />} title="Nessun personaggio">
              Crea il tuo primo personaggio: scegli razza, classi, abilità, talenti e incantesimi con tutti i calcoli fatti in automatico.
              <div className="mt-4">
                <Button variant="primary" onClick={create}>
                  <Plus size={16} /> Crea personaggio
                </Button>
              </div>
            </Empty>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-4">
            {characters.map((c) => {
              const race = c.raceId ? db.raceById.get(c.raceId)?.name : undefined;
              return (
                <div
                  key={c.id}
                  onClick={() => open(c.id)}
                  className="group relative cursor-pointer overflow-hidden rounded-xl border border-line bg-panel transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg"
                >
                  <div className="flex gap-3 p-4">
                    <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-accent-soft text-xl font-semibold text-accent">
                      {c.portrait ? <img src={c.portrait} className="h-full w-full object-cover" /> : (c.name[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-base font-semibold">{c.name || 'Senza nome'}</div>
                      <div className="truncate text-xs text-muted">
                        {[race, ALIGNMENTS.find((a) => a.key === c.alignment)?.label].filter(Boolean).join(' · ') || 'Razza da scegliere'}
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm">{classSummary(c, db) || <span className="text-muted">Nessuna classe</span>}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-muted">Liv.</div>
                      <div className="font-display text-2xl font-semibold leading-none">{c.levels.length}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-line px-3 py-1.5 text-[11px] text-muted">
                    <span>Modificato {relativeTime(c.updated)}</span>
                    <span className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                      <IconBtn title="Duplica" onClick={() => duplicate(c.id)}>
                        <Copy size={14} />
                      </IconBtn>
                      {api && (
                        <IconBtn title="Esporta" onClick={() => api!.exportCharacter(c)}>
                          <Download size={14} />
                        </IconBtn>
                      )}
                      <IconBtn title="Elimina" danger onClick={() => setConfirm(c.id)}>
                        <Trash2 size={14} />
                      </IconBtn>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Modal
        open={!!toDelete}
        onClose={() => setConfirm(null)}
        title="Eliminare il personaggio?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Annulla
            </Button>
            <Button
              variant="primary"
              className="!bg-bad !text-white"
              onClick={() => {
                remove(confirm!);
                setConfirm(null);
              }}
            >
              Elimina
            </Button>
          </>
        }
      >
        <p className="p-5 text-sm">
          <b>{toDelete?.name}</b> verrà eliminato definitivamente dal disco. Se vuoi conservarlo, esportalo prima.
        </p>
      </Modal>
    </div>
  );
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick} className={`rounded-md p-1.5 hover:bg-panel-2 ${danger ? 'hover:text-bad' : 'hover:text-fg'}`}>
      {children}
    </button>
  );
}
