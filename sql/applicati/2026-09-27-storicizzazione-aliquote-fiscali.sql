-- Storicizzazione aliquote fiscali per strumento.
--
-- Prima di questa modifica `strumenti.aliquota_tassazione` era un valore
-- corrente senza storico: se l'aliquota reale fosse mai cambiata nel tempo,
-- `v_verifica_trattenute` avrebbe ricalcolato l'aliquota attesa anche sulle
-- vendite passate con il nuovo valore, invece di quello davvero in vigore
-- quando la vendita è avvenuta.
--
-- Soluzione: una tabella di storico con data di decorrenza (stesso pattern
-- di lettura di `prezzo_fondo_a_data`), popolata automaticamente da un
-- trigger su `strumenti` ad ogni creazione (decorrenza 2000-01-01, "vale da
-- sempre", ben prima di qualsiasi transazione registrata: la più vecchia è
-- 10/03/2025) o modifica (decorrenza oggi) di `aliquota_tassazione`.
-- `strumenti.aliquota_tassazione` resta il valore corrente, usato ovunque
-- tranne che in `v_verifica_trattenute` (che ora guarda il valore storico
-- alla data della vendita). Il ramo riscatto_polizza di quella vista resta
-- fisso al 26% (regola invariata per le polizze).
--
-- Verificato in transazione annullata prima dell'applicazione: 0 differenze
-- su tutte le righe esistenti di v_verifica_trattenute (nessuna aliquota è
-- mai cambiata finora); hash delle 10 funzioni collegate a fiscalità/FIFO
-- invariato. Applicato 27/09/2026.

create table storico_aliquote_strumento (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  strumento_id uuid not null references strumenti(id) on delete cascade,
  aliquota numeric not null,
  data_decorrenza date not null,
  created_at timestamptz not null default now(),
  unique (strumento_id, data_decorrenza)
);
alter table storico_aliquote_strumento enable row level security;
create policy storico_aliquote_strumento_select_own on storico_aliquote_strumento for select using (user_id = auth.uid());
create policy storico_aliquote_strumento_insert_own on storico_aliquote_strumento for insert with check (user_id = auth.uid());
create policy storico_aliquote_strumento_update_own on storico_aliquote_strumento for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy storico_aliquote_strumento_delete_own on storico_aliquote_strumento for delete using (user_id = auth.uid());
create index idx_storico_aliquote_strumento_lookup on storico_aliquote_strumento (strumento_id, data_decorrenza desc);

-- Backfill: una riga per ogni strumento esistente, valida "da sempre".
insert into storico_aliquote_strumento (strumento_id, aliquota, data_decorrenza, user_id)
select id, aliquota_tassazione, date '2000-01-01', user_id from strumenti;

create or replace function aliquota_tassazione_a_data(p_strumento_id uuid, p_data date)
returns numeric
language sql
stable
set search_path to 'public'
as $$
  select coalesce(
    (select s.aliquota from storico_aliquote_strumento s
      where s.strumento_id = p_strumento_id and s.data_decorrenza <= p_data
      order by s.data_decorrenza desc limit 1),
    (select st.aliquota_tassazione from strumenti st where st.id = p_strumento_id)
  )
$$;

create or replace function storicizza_aliquota_strumento()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  insert into storico_aliquote_strumento (strumento_id, aliquota, data_decorrenza, user_id)
  values (
    new.id,
    new.aliquota_tassazione,
    case when tg_op = 'INSERT' then date '2000-01-01' else current_date end,
    new.user_id
  )
  on conflict (strumento_id, data_decorrenza) do update set aliquota = excluded.aliquota;
  return new;
end;
$$;

create trigger trg_storicizza_aliquota_strumento
after insert or update of aliquota_tassazione on strumenti
for each row
execute function storicizza_aliquota_strumento();

create or replace view v_verifica_trattenute as
 SELECT d.vendita_id,
    tv.data AS data_vendita,
    d.strumento_id,
    d.contenitore_id,
    aliquota_tassazione_a_data(d.strumento_id, tv.data) AS aliquota_attesa_pct,
    sum(d.plusvalenza) AS plusvalenza_totale_vendita,
    round(GREATEST(sum(d.plusvalenza), 0::numeric) * (aliquota_tassazione_a_data(d.strumento_id, tv.data) / 100.0), 2) AS tassa_attesa,
    tv.tassa_trattenuta AS tassa_trattenuta_effettiva,
    round(tv.tassa_trattenuta - GREATEST(sum(d.plusvalenza), 0::numeric) * (aliquota_tassazione_a_data(d.strumento_id, tv.data) / 100.0), 2) AS differenza,
    'vendita'::text AS tipo_riga,
    tv.quantita * tv.prezzo_unitario AS valore_lordo,
    false AS prezzo_stimato,
    NULL::boolean AS ritenuta_eccessiva
   FROM v_abbinamenti_fifo_dettaglio d
     JOIN transazioni tv ON tv.id = d.vendita_id
     JOIN strumenti s ON s.id = d.strumento_id
  WHERE d.imponibile
  GROUP BY d.vendita_id, tv.data, d.strumento_id, d.contenitore_id, tv.tassa_trattenuta, tv.quantita, tv.prezzo_unitario
UNION ALL
 SELECT NULL::uuid AS vendita_id,
    r.data_riscatto AS data_vendita,
    NULL::uuid AS strumento_id,
    r.contenitore_id,
    26::numeric AS aliquota_attesa_pct,
    r.imponibile AS plusvalenza_totale_vendita,
    round(r.imponibile * 0.26, 2) AS tassa_attesa,
    r.tassa_trattenuta AS tassa_trattenuta_effettiva,
    round(r.tassa_trattenuta - r.imponibile * 0.26, 2) AS differenza,
    'riscatto_polizza'::text AS tipo_riga,
    r.importo_lordo AS valore_lordo,
    r.prezzo_stimato,
    (r.tassa_trattenuta - r.imponibile * 0.26) > 0.005 AS ritenuta_eccessiva
   FROM v_riscatti_polizza r;
alter view v_verifica_trattenute set (security_invoker = true);
