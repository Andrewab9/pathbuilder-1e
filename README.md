# Pathbuilder 1e

Character builder per **Pathfinder 1ª edizione**, app desktop per Windows (Electron + React).
Interfaccia in italiano, regole in inglese (come nei manuali originali).

## Cosa fa

- **Razze**: 80 razze con tratti standard, 655 tratti razziali alternativi e 722 opzioni di classe preferita.
- **Classi**: tutte le classi base, ibride, Unchained, PNG e 119 classi di prestigio, con multiclasse libero.
- **Archetipi**: 1.268 archetipi, con privilegi sostituiti barrati e controllo di compatibilità.
- **Scelte di classe** per livello: poteri d'ira, talenti da ladro, scoperte, malefici, domini, linee di sangue,
  misteri e rivelazioni, ordini, scuole, benedizioni, grazie e crudeltà, trucchi e sguardi del mesmerista,
  amplificazioni freniche, scuole di impianto e poteri focali dell'occultista, poteri ki e colpi di stile,
  focus emotivo del fantasma, talenti bonus di classe, nemici prescelti… con il livello minimo verificato.
- **Cineta** completo: elemento primario ed espansi (7° e 15°), blast semplici e compositi sbloccati
  automaticamente, 278 talenti selvaggi (infusioni di forma/sostanza e utilità) filtrati per elemento e livello,
  danni e attacco dei blast, burn massimo, elemental overflow con bonus di taglia, CD, infusion specialization,
  metakinesis, internal buffer.
- **Eidolon**: pool di punti evoluzione per livello (evocatore normale e unchained), evoluzioni con costo,
  sottotipi unchained e forma base.
- **Talenti**: 3.442 talenti con verifica dei requisiti in tempo reale (caratteristiche, BAB, gradi, talenti,
  livelli di classe, razza, privilegi).
- **Tratti**: 1.739 tratti; quelli con bonus numerici semplici vengono applicati automaticamente.
- **Incantesimi**: 3.028 incantesimi, slot giornalieri con bonus di caratteristica, conosciuti/preparati,
  slot e incantesimi di dominio, avanzamento delle classi di prestigio.
- **Calcoli automatici**: caratteristiche, PF (massimo/medio/tiro), BAB, TS, CA (contatto, sprovvisto),
  BMC/DMC, iniziativa, velocità, abilità con penalità d'armatura e taglia, attacchi iterativi e danni,
  carico, cumulo dei bonus per tipo, ricchezza per livello.
- **Equipaggiamento**: armi, armature, ~2.600 oggetti magici (meravigliosi, anelli, verghe, bastoni, armi e
  armature specifiche) con bonus automatici per i più comuni, 433 proprietà speciali di armi/armature con calcolo
  del prezzo, oggetti personalizzati e bonus temporanei.
- **Scheda** stampabile ed **esportazione PDF**; salvataggio automatico, import/export dei personaggi.
- **Compendio** consultabile di tutto il materiale, con ricerca e filtri per manuale.

I personaggi sono salvati in `Documenti\Pathbuilder 1e\Personaggi` (un file `.json` per personaggio).

## Installazione

Nella cartella `release/` dopo la build:

- `Pathbuilder 1e Setup 1.0.0.exe` — installer (crea il collegamento sul desktop)
- `Pathbuilder1e-portable-1.0.0.exe` — versione portatile, nessuna installazione

Gli eseguibili non sono firmati: al primo avvio Windows SmartScreen può chiedere conferma ("Ulteriori informazioni" → "Esegui comunque").

## Sviluppo

Requisiti: Node.js 20+.

```bash
npm install
npm run dev        # avvia l'app in modalità sviluppo
npm test           # test del motore delle regole
npm run typecheck
npm run dist       # crea installer e versione portatile in release/
```

Test di fumo dell'app compilata (avvia Electron, percorre tutti gli step ed esporta un PDF):

```bash
npx electron-vite build
node tools/smoke-electron.mjs
```

## Dati

I file in `src/renderer/public/data/` sono generati da `tools/build-data.mjs` e `tools/build-extra.mjs` a partire da:

| Fonte | Contenuto |
| --- | --- |
| [Sistema Foundry VTT Pathfinder 1e](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1) | classi, privilegi, razze, incantesimi, armi, armature, oggetti, tabelle degli incantesimi al giorno |
| [pf1e-archetypes](https://gitlab.com/Tryss_Farron/pf1e-archetypes) | archetipi, classi di prestigio e relativi privilegi |
| [Archives of Nethys](https://aonprd.com) | talenti, tratti, tratti razziali alternativi, opzioni di classe preferita, talenti selvaggi del cineta, oggetti magici e proprietà speciali, scelte di classe mancanti (grazie, trucchi, poteri ki, evoluzioni…), scoperte arcane |

Per rigenerarli serve la cartella `data-raw/` (non versionata):

```bash
git clone --depth 1 https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1.git data-raw/pf1
git clone --depth 1 https://gitlab.com/Tryss_Farron/pf1e-archetypes.git data-raw/arch
# indice talenti e pagine di dettaglio da Archives of Nethys (richieste rallentate e in cache)
curl -L -o data-raw/aon_feats.html https://aonprd.com/Feats.aspx
node tools/scrape-aon.mjs data-raw/aon_feats.html "FeatDisplay.aspx?ItemName=" data-raw/aon/feats
# indici dei tratti (una pagina per categoria) in data-raw/aon/traits-index/<Categoria>.html
# pagine delle razze: un nome per riga in data-raw/race-names.txt
node tools/scrape-aon.mjs data-raw/race-names.txt "RacesDisplay.aspx?ItemName=" data-raw/aon/races
# cineta: KineticistElements.aspx in data-raw/aon/kin/elements.html, poi le pagine dei talenti
node tools/scrape-aon.mjs data-raw/aon/kin/elements.html "KineticistTalentsDisplay.aspx?ItemName=" data-raw/aon/kin/talents
# oggetti magici: pagine indice per categoria in data-raw/aon/magic/idx/, poi i dettagli
node tools/scrape-links.mjs data-raw/aon/magic/items "Magic\\w+Display\\.aspx\\?\\w+=" data-raw/aon/magic/idx/*.html
# elenchi delle scelte di classe (PaladinMercies.aspx, MesmeristTricks.aspx, …) in data-raw/aon/options/
npm run data:build
```

`tools/build-data.mjs` estrae anche le tabelle di progressione degli incantesimi e l'elenco dei manuali
dal codice del sistema Foundry (`data-raw/casterProgression.json`, `data-raw/sources.json`).

## Limiti noti

- Le statistiche complete dell'eidolon e del fantasma (PF, CA, attacchi) non sono calcolate: l'app gestisce
  forma, sottotipo ed evoluzioni con i relativi punti.
- I talenti selvaggi sono validati sul livello attuale del cineta (non su quello in cui sono stati scelti), per
  rispecchiare la possibilità di sostituirli ai livelli 5, 11 e 17.
- Gli oggetti magici "specifici" (armi e armature uniche) sono nel catalogo oggetti: per i loro attacchi usa
  l'arma base con il bonus di potenziamento.
- Gli effetti dei talenti/privilegi senza formula numerica (la maggior parte di quelli situazionali) sono
  descritti ma non applicati; per i bonus temporanei c'è la sezione "Bonus temporanei" nell'equipaggiamento.
- Alcune descrizioni del modulo archetipi contengono imprecisioni della fonte originale.

## Licenza e crediti

Questa app usa marchi e/o materiale protetto da copyright di Paizo Inc., in base alla
[Community Use Policy](https://paizo.com/community/communityuse) di Paizo. Non è pubblicata, approvata
o licenziata da Paizo. Per maggiori informazioni su Pathfinder visita [paizo.com](https://paizo.com).

Il contenuto di gioco è Open Game Content ai sensi della Open Game License v1.0a.
