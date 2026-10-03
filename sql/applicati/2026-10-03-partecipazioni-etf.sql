-- Esposizione degli ETF del PAC — partecipazioni: le prime posizioni di ogni ETF (titoli o obbligazioni).
-- Stesso modello di public.geografia_etf: dati pubblici e condivisi, con chiave ISIN e senza user_id;
-- li scrive solo il cron con la chiave di servizio, gli utenti autenticati possono solo leggerli.
-- Non tocca nessuna tabella esistente: aggiunge una tabella e una funzione.
begin;

-- Solo l'ultima versione valida, al massimo le 100 posizioni più pesanti di ogni ETF, in ordine di peso.
-- Il peso è in % sui soli titoli, sulla stessa base di geografia_etf (quindi la somma delle righe salvate è <= 100).
-- Per le azioni contano nome e ticker; per le obbligazioni iShares cedola e scadenza; per Xtrackers l'ISIN del titolo.
create table public.partecipazioni_etf (
  isin         text not null references public.geografia_fonti (isin) on delete cascade,
  posizione    smallint not null check (posizione >= 1),   -- 1 = la più pesante
  nome         text not null check (length(btrim(nome)) > 0),
  ticker       text,
  isin_titolo  text,                                       -- solo se il file lo dichiara (Xtrackers)
  cedola_pct   numeric,                                    -- solo obbligazioni iShares
  scadenza     date,                                       -- solo obbligazioni iShares
  peso_pct     numeric not null check (peso_pct > 0 and peso_pct <= 100),
  primary key (isin, posizione)
);

comment on table public.partecipazioni_etf is 'Prime partecipazioni per ETF (al massimo 100), in % sui soli titoli, ultima versione valida. Dati condivisi, scritti solo da sostituisci_partecipazioni_etf().';

alter table public.partecipazioni_etf enable row level security;
create policy partecipazioni_etf_lettura on public.partecipazioni_etf for select to authenticated using (true);
revoke all on public.partecipazioni_etf from public, anon, authenticated;
grant select on public.partecipazioni_etf to authenticated;
grant all on public.partecipazioni_etf to service_role;

-- Sostituisce in un'unica transazione le partecipazioni di un ETF.
-- p_partecipazioni è un array JSON già in ordine di peso decrescente: la posizione è l'ordine nell'array.
-- Rifiuta pesi che sommano oltre 100 (tolleranza 0,5): un dato sbagliato non sovrascrive mai quello buono.
create or replace function public.sostituisci_partecipazioni_etf(
  p_isin            text,
  p_partecipazioni  jsonb
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

  if p_partecipazioni is null or jsonb_typeof(p_partecipazioni) <> 'array' or jsonb_array_length(p_partecipazioni) = 0 then
    raise exception 'Partecipazioni mancanti per %', p_isin;
  end if;
  if jsonb_array_length(p_partecipazioni) > 200 then
    raise exception 'Troppe partecipazioni per % (%)', p_isin, jsonb_array_length(p_partecipazioni);
  end if;

  select sum((e.elem ->> 'peso_pct')::numeric) into v_somma
    from jsonb_array_elements(p_partecipazioni) as e(elem);
  if v_somma is null then
    raise exception 'Pesi mancanti nelle partecipazioni di %', p_isin;
  end if;
  if v_somma > 100.5 then
    raise exception 'I pesi delle partecipazioni di % sommano % (oltre 100, tolleranza 0,5)', p_isin, v_somma;
  end if;

  delete from public.partecipazioni_etf where isin = p_isin;

  insert into public.partecipazioni_etf (isin, posizione, nome, ticker, isin_titolo, cedola_pct, scadenza, peso_pct)
  select p_isin,
         e.ord::smallint,
         e.elem ->> 'nome',
         nullif(e.elem ->> 'ticker', ''),
         nullif(e.elem ->> 'isin_titolo', ''),
         (e.elem ->> 'cedola_pct')::numeric,
         (e.elem ->> 'scadenza')::date,
         (e.elem ->> 'peso_pct')::numeric
    from jsonb_array_elements(p_partecipazioni) with ordinality as e(elem, ord);
  get diagnostics v_righe = row_count;

  return v_righe;
end;
$$;

revoke execute on function public.sostituisci_partecipazioni_etf(text, jsonb) from public, anon, authenticated;
grant execute on function public.sostituisci_partecipazioni_etf(text, jsonb) to service_role;

commit;
