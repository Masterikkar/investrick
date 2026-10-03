-- Esposizione geografica degli ETF del PAC — fase 1: database.
-- Dati pubblici e condivisi, con chiave ISIN e senza user_id (stesso modello di public.comuni):
-- li scrive solo il cron con la chiave di servizio, gli utenti autenticati possono solo leggerli.
-- Non tocca nessuna tabella esistente.
begin;

-- Una riga per ETF: da dove scaricare il file e come è andato l'ultimo aggiornamento.
create table public.geografia_fonti (
  isin               text primary key,
  emittente          text not null check (emittente in ('ishares', 'xtrackers')),
  parametro          text,                 -- iShares: portfolioId della pagina prodotto su ishares.com/uk; Xtrackers: non usato
  attiva             boolean not null default true,
  ultimo_tentativo   timestamptz,
  ultimo_successo    timestamptz,
  data_file          date,                 -- data delle holdings dichiarata dal file (iShares); nulla per Xtrackers, che non la dichiara
  esito              text check (esito in ('ok', 'errore')),
  messaggio          text,                 -- dettaglio dell'ultimo esito, anche i paesi non riconosciuti
  somma_pesi_grezza  numeric,              -- somma dei pesi dei titoli prima di riportarli a 100
  created_at         timestamptz not null default now(),
  constraint geografia_fonti_parametro_ishares check ((emittente = 'ishares') = (parametro is not null))
);

-- Solo l'ultima versione valida: peso per paese, già riportato a 100 sui soli titoli (niente cash, derivati, valute).
-- Il paese resta com'è scritto dall'emittente; macro-regione e nome da mostrare si ricavano da paesi_macro_regioni.
create table public.geografia_etf (
  isin      text not null references public.geografia_fonti (isin) on delete cascade,
  paese     text not null,
  peso_pct  numeric not null check (peso_pct >= 0 and peso_pct <= 100),
  primary key (isin, paese)
);

-- Dal nome usato dall'emittente al codice ISO (per il nome tradotto) e alla macro-regione.
-- Un paese assente da questa tabella viene mostrato come "Altro".
create table public.paesi_macro_regioni (
  nome_nel_file  text primary key,
  codice_iso     text not null check (codice_iso ~ '^[A-Z]{2}$'),
  macro_regione  text not null check (macro_regione in
    ('Nord America', 'America Latina', 'Europa', 'Asia-Pacifico', 'Medio Oriente e Africa'))
);

comment on table public.geografia_fonti is 'Fonti dei file holdings degli ETF (una riga per ISIN) e stato dell''ultimo aggiornamento. Dati condivisi, scritti solo dal cron.';
comment on table public.geografia_etf is 'Distribuzione geografica per ETF e paese, in % sui soli titoli, ultima versione valida. Dati condivisi, scritti solo da sostituisci_geografia_etf().';
comment on table public.paesi_macro_regioni is 'Mappa dal nome del paese scritto dall''emittente a codice ISO e macro-regione. Un paese assente si mostra come "Altro".';

alter table public.geografia_fonti enable row level security;
alter table public.geografia_etf enable row level security;
alter table public.paesi_macro_regioni enable row level security;

create policy geografia_fonti_lettura on public.geografia_fonti for select to authenticated using (true);
create policy geografia_etf_lettura on public.geografia_etf for select to authenticated using (true);
create policy paesi_macro_regioni_lettura on public.paesi_macro_regioni for select to authenticated using (true);

revoke all on public.geografia_fonti, public.geografia_etf, public.paesi_macro_regioni from public, anon, authenticated;
grant select on public.geografia_fonti, public.geografia_etf, public.paesi_macro_regioni to authenticated;
grant all on public.geografia_fonti, public.geografia_etf, public.paesi_macro_regioni to service_role;

-- Sostituisce in un'unica transazione i dati di un ETF e aggiorna il suo stato.
-- Rifiuta pesi che non sommano a 100 (tolleranza 0,5): un dato sbagliato non sovrascrive mai quello buono.
create or replace function public.sostituisci_geografia_etf(
  p_isin              text,
  p_data_file         date,
  p_somma_pesi_grezza numeric,
  p_messaggio         text,
  p_pesi              jsonb
) returns integer
language plpgsql
set search_path = public
as $$
declare
  v_somma numeric;
  v_righe integer;
begin
  if not exists (select 1 from public.geografia_fonti where isin = p_isin) then
    raise exception 'ISIN % non presente in geografia_fonti', p_isin;
  end if;

  if p_pesi is null or jsonb_typeof(p_pesi) <> 'object' or p_pesi = '{}'::jsonb then
    raise exception 'Pesi mancanti per %', p_isin;
  end if;

  select sum(value::numeric) into v_somma from jsonb_each_text(p_pesi);
  if abs(v_somma - 100) > 0.5 then
    raise exception 'I pesi di % sommano % invece di 100', p_isin, v_somma;
  end if;

  delete from public.geografia_etf where isin = p_isin;

  insert into public.geografia_etf (isin, paese, peso_pct)
  select p_isin, key, value::numeric from jsonb_each_text(p_pesi);
  get diagnostics v_righe = row_count;

  update public.geografia_fonti
     set ultimo_tentativo  = now(),
         ultimo_successo   = now(),
         data_file         = p_data_file,
         esito             = 'ok',
         messaggio         = p_messaggio,
         somma_pesi_grezza = p_somma_pesi_grezza
   where isin = p_isin;

  return v_righe;
end;
$$;

revoke execute on function public.sostituisci_geografia_etf(text, date, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.sostituisci_geografia_etf(text, date, numeric, text, jsonb) to service_role;

-- Fonti iniziali: ETF del PAC ETF (gli identificativi iShares sono stati abbinati agli ISIN del database).
insert into public.geografia_fonti (isin, emittente, parametro) values
  ('IE00B4L5Y983', 'ishares',   '251882'),  -- EUNL  iShares Core MSCI World
  ('IE00BKM4GZ66', 'ishares',   '264659'),  -- IS3N  iShares Core MSCI EM IMI
  ('IE00BP3QZB59', 'ishares',   '270048'),  -- IS3S  iShares Edge MSCI World Value Factor
  ('IE000R4ZNTN3', 'ishares',   '340748'),  -- IXUA  iShares MSCI World ex-USA
  ('IE00B3VTN290', 'ishares',   '253461'),  -- SXRQ  iShares Euro Government Bond 7-10yr
  ('IE00B0M62X26', 'ishares',   '251739'),  -- IBCI  iShares Euro Inflation Linked Government Bond
  ('LU0290356871', 'xtrackers', null);      -- DBXP  Xtrackers Eurozone Government Bond 1-3yr

-- Mappa iniziale dei paesi, con le varianti di scrittura più probabili.
-- I nomi esatti usati dagli emittenti si verificano alla prima esecuzione del cron:
-- quelli non riconosciuti vengono segnalati nel messaggio di geografia_fonti e si aggiungono qui.
insert into public.paesi_macro_regioni (nome_nel_file, codice_iso, macro_regione) values
  ('United States', 'US', 'Nord America'),
  ('Canada', 'CA', 'Nord America'),

  ('Brazil', 'BR', 'America Latina'),
  ('Mexico', 'MX', 'America Latina'),
  ('Chile', 'CL', 'America Latina'),
  ('Colombia', 'CO', 'America Latina'),
  ('Peru', 'PE', 'America Latina'),
  ('Argentina', 'AR', 'America Latina'),

  ('United Kingdom', 'GB', 'Europa'),
  ('France', 'FR', 'Europa'),
  ('Switzerland', 'CH', 'Europa'),
  ('Germany', 'DE', 'Europa'),
  ('Netherlands', 'NL', 'Europa'),
  ('Spain', 'ES', 'Europa'),
  ('Sweden', 'SE', 'Europa'),
  ('Italy', 'IT', 'Europa'),
  ('Denmark', 'DK', 'Europa'),
  ('Finland', 'FI', 'Europa'),
  ('Belgium', 'BE', 'Europa'),
  ('Norway', 'NO', 'Europa'),
  ('Ireland', 'IE', 'Europa'),
  ('Austria', 'AT', 'Europa'),
  ('Portugal', 'PT', 'Europa'),
  ('Luxembourg', 'LU', 'Europa'),
  ('Greece', 'GR', 'Europa'),
  ('Poland', 'PL', 'Europa'),
  ('Czech Republic', 'CZ', 'Europa'),
  ('Czechia', 'CZ', 'Europa'),
  ('Hungary', 'HU', 'Europa'),
  ('Turkey', 'TR', 'Europa'),
  ('Türkiye', 'TR', 'Europa'),
  ('Russian Federation', 'RU', 'Europa'),
  ('Russia', 'RU', 'Europa'),
  ('Iceland', 'IS', 'Europa'),

  ('Japan', 'JP', 'Asia-Pacifico'),
  ('Australia', 'AU', 'Asia-Pacifico'),
  ('Singapore', 'SG', 'Asia-Pacifico'),
  ('Hong Kong', 'HK', 'Asia-Pacifico'),
  ('New Zealand', 'NZ', 'Asia-Pacifico'),
  ('China', 'CN', 'Asia-Pacifico'),
  ('Taiwan', 'TW', 'Asia-Pacifico'),
  ('Korea (South)', 'KR', 'Asia-Pacifico'),
  ('South Korea', 'KR', 'Asia-Pacifico'),
  ('India', 'IN', 'Asia-Pacifico'),
  ('Indonesia', 'ID', 'Asia-Pacifico'),
  ('Thailand', 'TH', 'Asia-Pacifico'),
  ('Malaysia', 'MY', 'Asia-Pacifico'),
  ('Philippines', 'PH', 'Asia-Pacifico'),
  ('Vietnam', 'VN', 'Asia-Pacifico'),
  ('Pakistan', 'PK', 'Asia-Pacifico'),
  ('Macau', 'MO', 'Asia-Pacifico'),

  ('Israel', 'IL', 'Medio Oriente e Africa'),
  ('Saudi Arabia', 'SA', 'Medio Oriente e Africa'),
  ('United Arab Emirates', 'AE', 'Medio Oriente e Africa'),
  ('Qatar', 'QA', 'Medio Oriente e Africa'),
  ('Kuwait', 'KW', 'Medio Oriente e Africa'),
  ('Bahrain', 'BH', 'Medio Oriente e Africa'),
  ('Oman', 'OM', 'Medio Oriente e Africa'),
  ('Jordan', 'JO', 'Medio Oriente e Africa'),
  ('South Africa', 'ZA', 'Medio Oriente e Africa'),
  ('Egypt', 'EG', 'Medio Oriente e Africa'),
  ('Morocco', 'MA', 'Medio Oriente e Africa'),
  ('Nigeria', 'NG', 'Medio Oriente e Africa');

commit;
