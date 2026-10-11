import { Download, FileDown, Printer } from 'lucide-react';
import { api, useComputed, useDb } from '@/store';
import { Button, cx } from '@/components/ui';
import { classSummary, gp, lbs } from '@/format';
import { ABILITIES, ABILITY_LABEL, ABILITY_SHORT, ALIGNMENTS, SAVES, SAVE_LABEL, SIZE_LABEL, signed } from '@/rules/constants';
import type { ReactNode } from 'react';

function Box({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx('avoid-break rounded-lg border border-line bg-panel', className)}>
      <h3 className="border-b border-line bg-panel-2 px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-widest text-accent">{title}</h3>
      <div className="p-3">{children}</div>
    </section>
  );
}

function Num({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-md border border-line px-2 py-1.5 text-center">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="font-display text-xl font-semibold leading-tight tabular">{value}</div>
      {sub && <div className="text-[10px] text-muted">{sub}</div>}
    </div>
  );
}

export function SheetStep() {
  const db = useDb();
  const { char, c } = useComputed()!;
  const align = ALIGNMENTS.find((a) => a.key === char.alignment)?.label;
  const trainedSkills = c.skills.filter((s) => s.usable);

  return (
    <div>
      <div className="no-print mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Scheda del personaggio</h1>
          <p className="text-sm text-muted">Riepilogo completo, pronto per la stampa o l'esportazione in PDF.</p>
        </div>
        <div className="flex gap-2">
          {api && (
            <Button onClick={() => api!.exportCharacter(char)}>
              <Download size={15} /> Esporta file
            </Button>
          )}
          <Button onClick={() => window.print()}>
            <Printer size={15} /> Stampa
          </Button>
          {api && (
            <Button variant="primary" onClick={() => api!.exportPdf(char.name)}>
              <FileDown size={15} /> Esporta PDF
            </Button>
          )}
        </div>
      </div>

      <div className="sheet space-y-3">
        {/* Intestazione */}
        <div className="avoid-break flex items-center gap-4 rounded-lg border border-line bg-panel p-4">
          {char.portrait && <img src={char.portrait} className="h-20 w-20 rounded-lg object-cover" />}
          <div className="min-w-0 flex-1">
            <div className="font-display text-3xl font-semibold leading-tight">{char.name}</div>
            <div className="text-sm">{classSummary(char, db) || '—'}</div>
            <div className="mt-1 text-xs text-muted">
              {[c.race?.name, SIZE_LABEL[c.size], align, char.deity && `Divinità: ${char.deity}`, char.gender, char.age && `${char.age} anni`, char.height, char.weight, char.homeland]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted">Livello</div>
            <div className="font-display text-4xl font-semibold">{c.level}</div>
          </div>
        </div>

        <div className="grid grid-cols-[180px_1fr] gap-3">
          <Box title="Caratteristiche">
            <div className="space-y-1.5">
              {ABILITIES.map((a) => (
                <div key={a} className="flex items-center justify-between rounded-md border border-line px-2 py-1">
                  <span className="text-xs font-semibold text-muted" title={ABILITY_LABEL[a]}>
                    {ABILITY_SHORT[a]}
                  </span>
                  <span className="font-display text-lg font-semibold tabular">{c.abilities[a].total}</span>
                  <span className="w-8 text-right font-semibold text-accent tabular">{signed(c.abilities[a].mod)}</span>
                </div>
              ))}
            </div>
          </Box>
          <div className="space-y-3">
            <Box title="Difesa">
              <div className="grid grid-cols-6 gap-2">
                <Num label="PF" value={c.hp.total} />
                <Num label="CA" value={c.ac.total} sub={`cont. ${c.touch} · sprov. ${c.flatFooted}`} />
                {SAVES.map((s) => (
                  <Num key={s} label={SAVE_LABEL[s]} value={signed(c.saves[s].total)} />
                ))}
                <Num label="DMC" value={c.cmd.total} />
              </div>
              {(c.sr > 0 || c.armor.armorName || c.armor.shieldName) && (
                <div className="mt-2 text-xs text-muted">
                  {[c.armor.armorName && `Armatura: ${c.armor.armorName}`, c.armor.shieldName && `Scudo: ${c.armor.shieldName}`, c.armor.acp && `Penalità armatura −${c.armor.acp}`, c.armor.asf && `Fallimento arcano ${c.armor.asf}%`, c.sr && `RI ${c.sr}`]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
            </Box>
            <Box title="Attacco">
              <div className="mb-3 grid grid-cols-4 gap-2">
                <Num label="BAB" value={signed(c.bab)} />
                <Num label="BMC" value={signed(c.cmb.total)} />
                <Num label="Iniziativa" value={signed(c.init.total)} />
                <Num label="Velocità" value={`${c.speed.land ?? 0}`} sub={Object.entries(c.speed).filter(([k, v]) => k !== 'land' && v).map(([k, v]) => `${k} ${v}`).join(', ') || 'piedi'} />
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted">
                    <th className="pb-1 font-semibold">Arma</th>
                    <th className="font-semibold">Attacco</th>
                    <th className="font-semibold">Danni</th>
                    <th className="font-semibold">Critico</th>
                    <th className="font-semibold">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {c.attacks.map((a) => (
                    <tr key={a.uid}>
                      <td className="py-1 font-medium">{a.name}</td>
                      <td className="font-semibold tabular">{a.attack.map(signed).join('/')}</td>
                      <td className="tabular">
                        {a.damage} <span className="text-xs text-muted">{a.type}</span>
                      </td>
                      <td className="tabular">{a.crit}</td>
                      <td className="text-xs text-muted">{a.notes.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Box title={`Abilità (${c.skillPoints.used}/${c.skillPoints.total} gradi)`}>
            <div className="columns-2 gap-4 text-[12px]">
              {trainedSkills.map((s) => (
                <div key={s.key} className="flex break-inside-avoid justify-between border-b border-line/60 py-0.5">
                  <span className={cx(s.classSkill && 'font-semibold')}>
                    {s.label}
                    {s.ranks > 0 && <span className="text-muted"> ({s.ranks})</span>}
                  </span>
                  <span className="tabular">{signed(s.total)}</span>
                </div>
              ))}
            </div>
            <div className="mt-1 text-[10px] text-muted">In grassetto le abilità di classe; tra parentesi i gradi.</div>
          </Box>
          <div className="space-y-3">
            <Box title="Talenti">
              <ul className="space-y-1 text-[12px]">
                {c.feats.map((f) => (
                  <li key={f.uid}>
                    <b>{f.feat?.name ?? f.featId}</b>
                    {f.detail && ` (${f.detail})`}
                    {f.feat?.summary && <span className="text-muted"> — {f.feat.summary}</span>}
                  </li>
                ))}
                {!c.feats.length && <li className="text-muted">Nessuno</li>}
              </ul>
            </Box>
            <Box title="Tratti">
              <ul className="space-y-1 text-[12px]">
                {char.traits.map((id) => {
                  const t = db.traitById.get(id);
                  return t ? (
                    <li key={id}>
                      <b>{t.name}</b> <span className="text-muted">({t.category})</span>
                    </li>
                  ) : null;
                })}
                {!char.traits.length && <li className="text-muted">Nessuno</li>}
              </ul>
            </Box>
          </div>
        </div>

        <Box title="Privilegi di classe e razziali">
          <div className="grid grid-cols-2 gap-x-6 text-[12px]">
            {c.classes.map((ci) => (
              <div key={ci.cls.id} className="mb-2 break-inside-avoid">
                <div className="mb-0.5 font-semibold text-accent">
                  {ci.cls.name} {ci.level}
                  {ci.archetypes.length > 0 && ` (${ci.archetypes.map((a) => a.name).join(', ')})`}
                </div>
                <div>
                  {c.features
                    .filter((f) => f.classId === ci.cls.id && !f.replaced)
                    .sort((a, b) => a.level - b.level)
                    .map((f) => f.label.replace(/\s*\([A-Z]{2,4}\)$/, ''))
                    .join(', ')}
                </div>
              </div>
            ))}
            {c.race && (
              <div className="mb-2">
                <div className="mb-0.5 font-semibold text-accent">{c.race.name}</div>
                <div>
                  {[
                    ...(c.race.traits ?? []).map((t) => t.name).filter((n) => !char.alternateTraits.some((a) => c.race!.alternateTraits?.find((x) => x.name === a)?.replaces.some((r) => r.toLowerCase() === n.toLowerCase()))),
                    ...char.alternateTraits,
                  ].join(', ')}
                </div>
              </div>
            )}
          </div>
        </Box>

        {c.kinetic && (
          <Box title={`Cineta — ${c.kinetic.elements.map((e) => e.name).join(', ') || 'elemento da scegliere'} (burn max ${c.kinetic.burnMax})`}>
            <table className="mb-2 w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted">
                  <th className="pb-1 font-semibold">Blast</th>
                  <th className="font-semibold">Attacco</th>
                  <th className="font-semibold">Danni</th>
                  <th className="font-semibold">Burn</th>
                  <th className="font-semibold">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {c.kinetic.blasts.map((b) => (
                  <tr key={b.talent.id}>
                    <td className="py-0.5 font-medium">{b.talent.name}</td>
                    <td className="tabular">{signed(b.attack)}</td>
                    <td className="tabular">{b.damage}</td>
                    <td className="tabular">{b.burn}</td>
                    <td className="text-muted">{b.notes.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-[12px]">
              <b>Talenti selvaggi:</b>{' '}
              {[...c.kinetic.automatic, ...c.kinetic.slots.map((s) => s.talent).filter(Boolean)].map((t) => t!.name).join(', ') || '—'}
            </div>
            <div className="mt-1 text-[11px] text-muted">
              CD blast {c.kinetic.blastDc} · CD forma {c.kinetic.formDc}
              {c.kinetic.infusionSpecialization ? ` · infusion specialization ${c.kinetic.infusionSpecialization}` : ''}
              {c.kinetic.internalBuffer ? ` · internal buffer ${c.kinetic.internalBuffer}` : ''}
              {c.kinetic.metakinesis.length ? ` · metakinesis: ${c.kinetic.metakinesis.join(', ')}` : ''}
            </div>
          </Box>
        )}

        {c.pools.map((p) => (
          <Box key={p.classId + p.def.key} title={`${p.def.label} (${p.used}/${p.points} punti)`}>
            <div className="text-[12px]">{p.picks.map((f) => `${f.name} (${f.cost ?? 1})`).join(', ') || '—'}</div>
          </Box>
        ))}

        {c.casters.map((ci) => {
          const sel = char.spells[ci.classId];
          return (
            <Box key={ci.classId} title={`Incantesimi — ${ci.cls.name} (LI ${ci.casterLevel}, CD ${ci.dcBase} + livello)`}>
              <div className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
                {ci.perDay.map((p, i) =>
                  p === null ? null : (
                    <span key={i} className="rounded border border-line px-1.5 py-0.5">
                      {i}°: {p === 'inf' ? '∞' : p}/giorno
                      {ci.known && ci.known[i] !== null ? ` · ${ci.known[i]} conosciuti` : ''}
                    </span>
                  ),
                )}
              </div>
              {sel && (
                <div className="space-y-0.5 text-[12px]">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((lv) => {
                    const known = sel.known.filter((id) => db.spellById.get(id)?.levels[ci.classId] === lv).map((id) => db.spellById.get(id)!);
                    const prep = (sel.prepared[lv] ?? []).map((id) => db.spellById.get(id)?.name).filter(Boolean);
                    if (!known.length && !prep.length) return null;
                    return (
                      <div key={lv}>
                        <b>{lv}°:</b> {known.map((s) => s.name).join(', ')}
                        {prep.length > 0 && <span className="text-muted">{known.length ? ' · ' : ''}preparati: {prep.join(', ')}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </Box>
          );
        })}

        <div className="grid grid-cols-[1fr_220px] gap-3">
          <Box title="Equipaggiamento">
            <div className="columns-2 gap-4 text-[12px]">
              {char.equipment.map((e) => (
                <div key={e.uid} className="flex break-inside-avoid justify-between border-b border-line/60 py-0.5">
                  <span>
                    {e.qty > 1 && `${e.qty}× `}
                    {e.name}
                    {e.enhancement ? ` +${e.enhancement}` : e.masterwork ? ' (perf.)' : ''}
                    {e.equipped && <span className="text-accent"> •</span>}
                  </span>
                  <span className="text-muted tabular">{lbs(e.weight * e.qty)}</span>
                </div>
              ))}
            </div>
          </Box>
          <Box title="Ricchezza e carico">
            <div className="space-y-1 text-[12px]">
              <div>
                {char.money.pp} mp · {char.money.gp} mo · {char.money.sp} ma · {char.money.cp} mr
              </div>
              <div className="text-muted">Valore oggetti: {gp(c.wealth.spent)}</div>
              <div className="text-muted">
                Peso: {lbs(c.load.weight)} ({['leggero', 'medio', 'pesante', 'sovraccarico'][c.load.level]})
              </div>
              <div className="text-muted">
                Carichi: {c.load.light}/{c.load.medium}/{c.load.heavy} lb
              </div>
            </div>
          </Box>
        </div>

        {(char.notes || char.languages) && (
          <Box title="Note">
            {char.languages && (
              <div className="mb-1 text-[12px]">
                <b>Linguaggi:</b> {char.languages}
              </div>
            )}
            <div className="whitespace-pre-wrap text-[12px]">{char.notes}</div>
          </Box>
        )}
      </div>
    </div>
  );
}
