# Investrick — istruzioni per Claude Code

App web personale di gestione portafoglio multi-asset (regime amministrato italiano), sviluppata da un solo sviluppatore. Destinata in futuro a diventare un prodotto commerciale.

## Stack

- Next.js 16 (App Router, Turbopack, nessuna cartella `src/`), TypeScript, Tailwind, Recharts, SheetJS (installato dal CDN ufficiale SheetJS, non dal pacchetto npm `xlsx`, che ha una vulnerabilità nota)
- Supabase (progetto `uchkjvxhxuabmjaesvpv`), PostgreSQL con RLS su tutte le tabelle
- Vercel, cron prezzi in `vercel.json` (EODHD alle 22:00 UTC, scraping Teleborsa per i fondi assicurativi alle 21:45 UTC)
- Middleware in `proxy.ts` (non `middleware.ts`)
- i18n con next-intl, prefisso di lingua sempre nell'URL (`/it/...`, `/en/...`)

## Comandi

- Tipi: `npx supabase gen types typescript --project-id uchkjvxhxuabmjaesvpv --schema public > types/database.types.ts`
- Build: `npm run build`
- Lint: `npx eslint .`

**Dopo qualunque modifica allo schema (tabella, colonna, vista, firma di funzione) rigenera i tipi PRIMA della build.** Tipi vecchi fanno fallire il build su Vercel.

## Database: regole tecniche

- Il database remoto è l'unica fonte di verità dello schema: non esistono migrazioni nel repo. Gli SQL applicati vanno salvati in `scratchpad/` per riferimento.
- Mai `CREATE TEMPORARY TABLE` nelle funzioni: fallisce in silenzio nelle transazioni read-only di PostgREST. Usa array in memoria.
- Ogni `CREATE VIEW` / `CREATE OR REPLACE VIEW` deve avere `security_invoker = true`.
- `CREATE OR REPLACE VIEW` non può togliere colonne: serve `DROP VIEW` + `CREATE VIEW`. Prima di un `DROP`, rileggi le dipendenze da `pg_depend` e ricrea tutte le viste dipendenti, non a memoria.
- Le colonne `GENERATED ALWAYS AS` (es. `transazioni.valore_totale`) non si scrivono mai esplicitamente.
- Un `DEFAULT` di colonna viene applicato prima dei trigger `BEFORE INSERT`: un trigger che controlla `IS NULL` non vedrà mai NULL se la colonna ha un default.
- `.upsert()` con `onConflict` non funziona su indici parziali di colonne nullable: usa una colonna generata di normalizzazione o update-poi-insert.
- PostgREST tronca in silenzio a 1000 righe: per le query lunghe usa `tutteLeRighe` (`lib/supabase-tutte-le-righe.ts`) con un ordinamento univoco.
- Usa `.maybeSingle()` quando l'assenza di una riga è un caso normale.
- Dopo ogni modifica a transazioni, movimenti o prezzi storici va rilanciato `select * from ricostruisci_storico_valorizzazioni();`.
- `contenitore_id` nullo indica una posizione diretta, senza gruppo.

## Modo di lavorare

- **Modifiche al database: prima piano e numeri prima/dopo, poi aspetta l'ok.** Le prove si fanno dentro transazioni annullate. Si applica in un'unica transazione.
- Verifica sempre lo schema con query SQL invece di dare per scontati nomi di colonne, vincoli o nullability.
- Per ogni intervento sul DB conferma con hash prima/dopo che ciò che non doveva cambiare è rimasto identico.
- La logica condivisa vive in un solo punto (una funzione SQL, un file in `lib/`, un componente), mai duplicata.
- Interventi grossi: prima mappa tutto ciò che è toccato, poi proponi, poi applica.
- Backup e cancellazioni definitive di dati li esegue l'utente, non Claude Code.
- A fine lavoro: tipi (se cambiano), build, eslint, elenco dei file modificati con una riga di spiegazione ciascuno, e i numeri attesi da controllare nel browser.

## Convenzioni di codice

- Query Supabase direttamente nei Server Components, join lato JS con `.find()` / `.filter()`, nessun livello repository.
- Stili inline; nessun angolo arrotondato (border-radius 0), nessun gradiente. Tema scuro, primario `#4C5FE0`, accento raro `#7C8CFF`.
- Font: IBM Plex Sans/Mono per interfaccia e tabelle, Zilla Slab 600 per il numero "hero" (`var(--fs-hero)`). Titoli `h1` con `var(--fs-h1)`, mai dimensioni scritte a mano.
- Importi sempre con `formatEuro` di `lib/format.ts`. Formato numerico X.XXX,XX.
- Date `YYYY-MM-DD` solo tramite `lib/data-calendario.ts` e `lib/data-excel.ts`: mai `toISOString()` né `new Date('YYYY-MM-DD')` su una data senza orario. Eccezione voluta: le route dei cron prezzi usano la data UTC.
- Conferme con `useConferma()` (`components/conferma.tsx`), mai `window.confirm`.
- i18n: tradotto solo il testo visibile. Namespace = nome della pagina o del componente in PascalCase italiano, chiavi in camelCase, namespace condivisi riusati (es. "Categorie").
- Codice nuovo: rotte e nomi di file in inglese. Le rotte italiane esistenti (`/pac`, `/polizze`, ...) si correggeranno prima del rilascio.

## Regole di dominio

- **Gruppi e categorie**: lo stesso asset appartiene a un gruppo (PAC, Polizza, Personalizzato, oppure nessuno) e a una categoria (Azioni, Obbligazioni, Materie prime, Monetario, Multiasset, Criptovalute, Liquidità). Il totale si calcola una sola volta sulle posizioni, mai sommando gruppi e categorie.
- **Classificazione** per esposizione economica, non per involucro legale.
- **Totali**: solo posizioni di mercato aperte e saldi di liquidità da movimenti reali, mai redditi solo maturati (interessi, dividendi non versati).
- **FIFO**: un solo motore, `motore_fifo_posizione`. I lotti nascono da `Acquisto`, `Ricompensa` (al prezzo registrato) e `Scambio_acquisizione`. `Costo_quote` toglie quote senza togliere costo; se esaurisce l'ultimo lotto del fondo, il costo residuo diventa perdita realizzata a ricavo zero.
- **Polizze**: si tassano come contratto unico. I premi sono gli `Acquisto` dentro la polizza. Gli switch (`Scambio_*`, ammessi solo in polizza) sono fiscalmente neutri. Un riscatto è una `Vendita` in polizza: le vendite dello stesso giorno formano un solo riscatto, con calcolo pro-quota sui premi residui (logica unica in `riscatti_polizza`). Aliquota attesa fissa 26%. Polizza intera e somme del portafoglio: valore − premi residui; singolo fondo: lotti (solo performance).
- **Prezzi a una data**: ultimo prezzo disponibile fino a quella data (`prezzo_fondo_a_data`). Il ripiego sul prezzo dell'ultima transazione vale solo nelle polizze.
- **Ricompense** (cashback in quote): lotto al prezzo di mercato registrato. Nell'interfaccia, se una posizione ha lotti da ricompensa: "Capitale investito", "di cui da ricompense", "Capitale proprio investito".
- **Fiscalità**: l'app verifica le trattenute degli intermediari, non calcola per la dichiarazione. Aliquota per strumento in `strumenti.aliquota_tassazione`, default per categoria in `impostazioni_aliquote_categoria`.
