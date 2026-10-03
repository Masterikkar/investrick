# Investrick — istruzioni per Claude Code

App web personale di gestione portafoglio multi-asset (regime amministrato italiano), sviluppata da un solo sviluppatore. Destinata in futuro a diventare un prodotto commerciale.

## Stack

- Next.js 16 (App Router, Turbopack, nessuna cartella `src/`), TypeScript, Tailwind, Recharts, SheetJS (installato dal CDN ufficiale SheetJS, non dal pacchetto npm `xlsx`, che ha una vulnerabilità nota)
- Supabase (progetto `uchkjvxhxuabmjaesvpv`), PostgreSQL con RLS su tutte le tabelle
- Vercel, cron in `vercel.json`: prezzi EODHD alle 22:00 UTC, scraping Teleborsa per i fondi assicurativi alle 21:45 UTC, esposizione degli ETF del PAC il lunedì alle 05:20 UTC. I cron partono solo dal deploy di Production e solo se `CRON_SECRET` esiste in Production; le tre route (`aggiorna-prezzi`, `aggiorna-prezzi-scraping`, `update-etf-geography`) rispondono 401 se il segreto non è impostato, quindi in Preview e in locale vanno chiamate a mano solo dopo aver impostato `CRON_SECRET`
- Middleware in `proxy.ts` (non `middleware.ts`)
- i18n con next-intl, prefisso di lingua sempre nell'URL (`/it/...`, `/en/...`)

## Comandi

- Tipi: `npx supabase gen types typescript --project-id uchkjvxhxuabmjaesvpv --schema public > types/database.types.ts`
- Build: `npm run build`
- Lint: `npx eslint .`

**Dopo qualunque modifica allo schema (tabella, colonna, vista, firma di funzione) rigenera i tipi PRIMA della build.** Tipi vecchi fanno fallire il build su Vercel.

## Database: regole tecniche

- Il database remoto è l'unica fonte di verità dello schema: non esistono migrazioni nel repo. Ogni SQL applicato al DB va salvato nel repo in `sql/applicati/AAAA-MM-GG-descrizione.sql` e committato insieme al codice. Non usare cartelle temporanee: vengono perse a fine sessione.
- Mai `CREATE TEMPORARY TABLE` nelle funzioni: fallisce in silenzio nelle transazioni read-only di PostgREST. Usa array in memoria.
- Ogni `CREATE VIEW` / `CREATE OR REPLACE VIEW` deve avere `security_invoker = true`.
- `CREATE OR REPLACE VIEW` non può togliere colonne: serve `DROP VIEW` + `CREATE VIEW`. Prima di un `DROP`, rileggi le dipendenze da `pg_depend` e ricrea tutte le viste dipendenti, non a memoria.
- Le colonne `GENERATED ALWAYS AS` (es. `transazioni.valore_totale`) non si scrivono mai esplicitamente.
- Un `DEFAULT` di colonna viene applicato prima dei trigger `BEFORE INSERT`: un trigger che controlla `IS NULL` non vedrà mai NULL se la colonna ha un default.
- `.upsert()` con `onConflict` non funziona su indici parziali di colonne nullable: usa una colonna generata di normalizzazione o update-poi-insert.
- PostgREST tronca in silenzio a 1000 righe: per le query lunghe usa `tutteLeRighe` (`lib/supabase-tutte-le-righe.ts`) con un ordinamento univoco.
- Usa `.maybeSingle()` quando l'assenza di una riga è un caso normale.
- Lo storico valorizzazioni si ricalcola dall'app solo con `lib/ricalcolo-storico.ts`: `ricalcolaStoricoPosizioni` dopo una singola modifica (solo strumento e gruppo toccati, dalla data in poi), `ricalcolaStoricoCompleto` dopo import massivi o eliminazione di un gruppo (un gruppo alla volta). Mai chiamare `ricostruisci_storico_valorizzazioni()` dall'app: dura ~3 s e cresce con lo storico, e ogni richiesta è interrotta dopo 8 s. Se il ricalcolo fallisce dopo un salvataggio riuscito è un avviso (`avvisoStoricoNonAggiornato`), non un errore da ripetere.
- Il ricalcolo toglie anche le righe di mercato delle date in cui la posizione non è più posseduta (es. data di un acquisto corretta, transazione eliminata); le righe del fine settimana dello snapshot notturno, con la posizione posseduta, restano.
- Dopo modifiche fatte a mano (SQL Editor) a transazioni, movimenti o prezzi storici va rilanciato `select * from ricostruisci_storico_valorizzazioni();`. Scelta voluta: non è automatizzato con trigger, perché scatterebbero riga per riga durante gli import e gli upsert notturni dei prezzi.
- `ricostruisci_storico_valorizzazioni()` e `elimina_strumento(uuid)` non sono eseguibili da `anon` (solo `authenticated` e `service_role`); le funzioni nuove vanno create con `revoke execute … from public, anon`.
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

## Esposizione degli ETF del PAC (geografia e partecipazioni)

- **Dati pubblici condivisi per ISIN**, senza `user_id`: RLS con sola lettura per `authenticated`; li scrive solo il cron con la chiave di servizio, tramite funzioni eseguibili solo da `service_role`. Tabelle: `geografia_fonti` (una riga per ETF: emittente, parametro, stato dell'ultimo aggiornamento), `geografia_etf` (paese come scritto dall'emittente, `peso_pct`), `paesi_macro_regioni` (nome nel file → codice ISO → macro-regione), `partecipazioni_etf` (prime 100 posizioni per ETF: nome, ticker, ISIN del titolo, cedola, scadenza, `peso_pct`). Funzioni `sostituisci_partecipazioni_etf` e `sostituisci_geografia_etf`: sostituiscono i dati di un ETF in una transazione e rifiutano pesi che non tornano. Prima si scrivono le partecipazioni, poi la geografia, che registra l'esito.
- **Aggiornamento**: `app/api/update-etf-geography/route.ts` con `lib/etf-geography.ts` (CSV iShares, Excel Xtrackers). Non usa EODHD. Segreto `CRON_SECRET` (header o `?secret=`); prove a mano con `?dryRun=1` (non scrive) e `?isin=`. Le date iShares usano l'inglese britannico ("Sept"). In caso di errore o controllo non superato resta l'ultimo dato valido; dato "scaduto" dopo 35 giorni; un file più vecchio di quello salvato si rifiuta.
- **Pesi**: solo titoli (azioni, obbligazioni); cash, derivati e valute esclusi; riportati a 100 sui soli titoli, quindi di pochi decimi sopra il sito dell'emittente. Dove non c'è un dato non si mostra niente; oro e fondi senza fonte sono esclusi.
- **Paesi non riconosciuti**: mai "Non classificato", si chiama **"Altro"**. Il messaggio dell'ultimo aggiornamento in `geografia_fonti` li elenca: vanno aggiunti a `paesi_macro_regioni`.
- **Calcolo nell'app**: `lib/geographic-exposure.ts`. Per il PAC è la media pesata sul valore degli ETF che hanno il dato, una vista per categoria. Lo stesso titolo in più ETF si unisce (ISIN del titolo, oppure nome + ticker + cedola + scadenza). Nomi dei titoli in "Prima Lettera Maiuscola" (`nomeTitoloLeggibile`); nomi dei paesi dal codice ISO con `Intl.DisplayNames`.
- **Schermata**: sezione "Esposizione" con due card affiancate, a sinistra Partecipazioni (prime 15, barre solo sulle prime 5) e a destra Esposizione geografica (regioni con barre, 10 paesi, poi "Altri paesi" in un blocco che si apre). Componenti `components/exposure-cards.tsx`, `etf-holdings.tsx`, `geographic-exposure.tsx`; usati in `investment-plans/[contenitoreId]` (una coppia per categoria) e in `asset/[strumentoId]`. Namespace i18n `Esposizione` e `Regioni`. Attenzione: `lib/geographic-exposure.ts` (libreria) e `components/geographic-exposure.tsx` (componente) hanno lo stesso nome in cartelle diverse: non confonderli.
- **Aggiungere un ETF**: una riga in `geografia_fonti` con `attiva = true`, l'ISIN dello strumento, l'emittente (`ishares` o `xtrackers`) e, per iShares, il `portfolioId` come `parametro` (per Xtrackers resta vuoto: il file si trova dall'ISIN). Nessun altro intervento sul codice.

## Regole di dominio

- **Gruppi e categorie**: lo stesso asset appartiene a un gruppo (PAC, Polizza, Personalizzato, oppure nessuno) e a una categoria (Azioni, Obbligazioni, Materie prime, Monetario, Multiasset, Criptovalute, Liquidità). Il totale si calcola una sola volta sulle posizioni, mai sommando gruppi e categorie.
- **Classificazione** per esposizione economica, non per involucro legale.
- **Totali**: solo posizioni di mercato aperte e saldi di liquidità da movimenti reali, mai redditi solo maturati (interessi, dividendi non versati).
- **FIFO**: un solo motore, `motore_fifo_posizione`. I lotti nascono da `Acquisto`, `Ricompensa` (al prezzo registrato) e `Scambio_acquisizione`. `Costo_quote` toglie quote senza togliere costo; se esaurisce l'ultimo lotto del fondo, il costo residuo diventa perdita realizzata a ricavo zero.
- **Polizze**: si tassano come contratto unico. I premi sono gli `Acquisto` dentro la polizza. Gli switch (`Scambio_*`, ammessi solo in polizza) sono fiscalmente neutri. Un riscatto è una `Vendita` in polizza: le vendite dello stesso giorno formano un solo riscatto, con calcolo pro-quota sui premi residui (logica unica in `riscatti_polizza`). Aliquota attesa fissa 26%. Polizza intera e somme del portafoglio: valore − premi residui; singolo fondo: lotti (solo performance).
- **Prezzi a una data**: ultimo prezzo disponibile fino a quella data (`prezzo_fondo_a_data`). Il ripiego sul prezzo dell'ultima transazione vale solo nelle polizze.
- **Ricompense** (cashback in quote): lotto al prezzo di mercato registrato. Nell'interfaccia, se una posizione ha lotti da ricompensa: "Capitale investito", "di cui da ricompense", "Capitale proprio investito".
- **Fiscalità**: l'app verifica le trattenute degli intermediari, non calcola per la dichiarazione. Aliquota per strumento in `strumenti.aliquota_tassazione`, default per categoria in `impostazioni_aliquote_categoria`.
