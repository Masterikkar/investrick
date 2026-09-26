-- =============================================================================
-- ISTANTANEA DELLO STATO DEL DATABASE, NON UNA MIGRAZIONE DA RIESEGUIRE
-- =============================================================================
-- Progetto Supabase: uchkjvxhxuabmjaesvpv, schema public.
-- Estratta il 2026-09-26 con pg_get_functiondef / pg_get_viewdef, dopo
-- migrazione-4 (Ricompensa crea lotti FIFO; storico con l'ultimo prezzo
-- disponibile per tutte le posizioni, ripiego sul prezzo da transazione solo
-- nelle polizze).
--
-- Serve come copia di riferimento di fiscalità, motore FIFO e storico: gli SQL
-- originali applicati in quei giorni sono andati persi (erano in una cartella
-- temporanea). Il database remoto resta l'unica fonte di verità dello schema.
--
-- Non eseguire questo file così com'è:
-- - l'ordine non è garantito eseguibile (le funzioni LANGUAGE sql validano il
--   corpo alla creazione, e non_realizzato_fiscale_a_data legge
--   v_storico_valorizzazioni_dettaglio, che qui non c'è);
-- - CREATE OR REPLACE VIEW non toglie colonne: per cambiare una vista serve
--   DROP + CREATE delle viste dipendenti, rilette da pg_depend;
-- - ogni modifica nuova va in un file suo, sql/applicati/AAAA-MM-GG-descrizione.sql.
--
-- Contenuto:
-- - 10 funzioni: prezzo_fondo_a_data, fondi_polizza_a_data,
--   motore_fifo_posizione, calcola_fifo_posizione,
--   calcola_lotti_residui_posizione, capitale_investito_a_data,
--   premi_residui_polizza_a_data, riscatti_polizza,
--   non_realizzato_fiscale_a_data, ricostruisci_storico_valorizzazioni.
-- - 14 viste che le usano, direttamente o tramite altre viste (da pg_depend),
--   tutte con security_invoker = true: v_abbinamenti_fifo, v_lotti_residui,
--   v_riscatti_polizza, v_non_realizzato_fiscale_per_anno,
--   v_non_realizzato_inizio_anno, v_abbinamenti_fifo_dettaglio,
--   v_capitale_investito, v_premi_residui_polizza, v_plusvalenze_realizzate,
--   v_realizzato_per_anno, v_ricavi_da_vendite, v_verifica_trattenute,
--   v_riepilogo_posizione, v_non_realizzato_dettaglio.
--
-- Per verificare che il DB sia ancora uguale a questa istantanea, confronta
-- md5(pg_get_functiondef(oid)) e md5(pg_get_viewdef(oid, true)) con il testo
-- di ogni blocco (funzioni: senza il ";" finale; viste: il testo dopo la riga
-- "AS"). Al 2026-09-26 i 24 md5 coincidono.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FUNZIONI
-- -----------------------------------------------------------------------------

-- prezzo_fondo_a_data
CREATE OR REPLACE FUNCTION public.prezzo_fondo_a_data(p_strumento_id uuid, p_contenitore_id uuid, p_data date, OUT prezzo numeric, OUT stimato boolean)
 RETURNS record
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
begin
  stimato := false;
  select ps.prezzo into prezzo from prezzi_storici ps
  where ps.strumento_id = p_strumento_id and ps.data = p_data;

  if prezzo is null then
    select ps.prezzo into prezzo from prezzi_storici ps
    where ps.strumento_id = p_strumento_id and ps.data < p_data
    order by ps.data desc limit 1;
    stimato := prezzo is not null;
  end if;

  -- Il prezzo dell'ultima transazione come stima vale solo nelle polizze;
  -- fuori, la posizione parte dal suo primo prezzo storico.
  if prezzo is null and exists (select 1 from contenitori c where c.id = p_contenitore_id and c.tipo = 'Polizza') then
    select t.prezzo_unitario into prezzo from transazioni t
    where t.contenitore_id is not distinct from p_contenitore_id and t.strumento_id = p_strumento_id
      and t.data <= p_data and t.prezzo_unitario > 0
    order by t.data desc, t.created_at desc limit 1;
    stimato := prezzo is not null;
  end if;
end;
$function$
;

-- fondi_polizza_a_data
CREATE OR REPLACE FUNCTION public.fondi_polizza_a_data(p_contenitore_id uuid, p_data date, p_escludi_vendite_del_giorno boolean)
 RETURNS TABLE(strumento_id uuid, quote numeric, prezzo numeric, stimato boolean, mancante boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select q.strumento_id, q.quote, px.prezzo, px.stimato, px.prezzo is null
  from (
    select t.strumento_id,
           sum(case
                 when t.operazione in ('Acquisto', 'Ricompensa', 'Scambio_acquisizione') then t.quantita
                 when t.operazione in ('Vendita', 'Scambio_cessione', 'Costo_quote') then -t.quantita
                 else 0
               end) as quote
    from transazioni t
    where t.contenitore_id is not distinct from p_contenitore_id
      and t.strumento_id is not null
      and (t.data < p_data
           or (t.data = p_data and not (p_escludi_vendite_del_giorno and t.operazione = 'Vendita')))
    group by t.strumento_id
  ) q
  cross join lateral prezzo_fondo_a_data(q.strumento_id, p_contenitore_id, p_data) px
  where q.quote > 0
$function$
;

-- motore_fifo_posizione
CREATE OR REPLACE FUNCTION public.motore_fifo_posizione(p_strumento_id uuid, p_contenitore_id uuid, p_data_limite date DEFAULT NULL::date)
 RETURNS TABLE(tipo_riga text, vendita_id uuid, acquisto_id uuid, data_acquisto date, data_vendita date, quantita numeric, prezzo_acquisto numeric, prezzo_vendita numeric, commissione_acquisto_quota numeric, commissione_vendita_quota numeric, tassa_quota numeric, plusvalenza numeric)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  lot_id uuid[];
  lot_data date[];
  lot_qty numeric[];
  lot_costo numeric[];
  lot_comm numeric[];
  lot_tassa numeric[];
  ev record;
  da_coprire numeric;
  dal_lotto numeric;
  quota numeric;
  c_costo numeric;
  c_comm numeric;
  c_tassa numeric;
  i integer;
  j integer;
  n integer;
begin
  select array_agg(t.id order by t.data, t.id),
         array_agg(t.data order by t.data, t.id),
         array_agg(t.quantita order by t.data, t.id),
         array_agg(t.quantita * t.prezzo_unitario order by t.data, t.id),
         array_agg(t.commissione order by t.data, t.id),
         array_agg(t.tassa_trattenuta order by t.data, t.id)
    into lot_id, lot_data, lot_qty, lot_costo, lot_comm, lot_tassa
  from transazioni t
  where t.strumento_id = p_strumento_id
    and t.contenitore_id is not distinct from p_contenitore_id
    and t.operazione in ('Acquisto', 'Ricompensa', 'Scambio_acquisizione')
    and (p_data_limite is null or t.data <= p_data_limite);

  n := coalesce(array_length(lot_id, 1), 0);

  for ev in
    select t.id, t.data, t.operazione, t.quantita, t.prezzo_unitario, t.commissione
    from transazioni t
    where t.strumento_id = p_strumento_id
      and t.contenitore_id is not distinct from p_contenitore_id
      and t.operazione in ('Vendita', 'Scambio_cessione', 'Costo_quote')
      and (p_data_limite is null or t.data <= p_data_limite)
    order by t.data, t.id
  loop
    da_coprire := ev.quantita;
    i := 1;
    while da_coprire > 0 and i <= n loop
      if lot_qty[i] > 0 then
        dal_lotto := least(da_coprire, lot_qty[i]);

        if ev.operazione = 'Costo_quote' then
          -- Il costo resta sulle quote rimaste del lotto.
          lot_qty[i] := lot_qty[i] - dal_lotto;
          if lot_qty[i] = 0 then
            -- Lotto esaurito: il suo costo passa al lotto successivo con quote.
            j := i + 1;
            while j <= n and lot_qty[j] <= 0 loop j := j + 1; end loop;
            if j <= n then
              lot_costo[j] := lot_costo[j] + lot_costo[i];
              lot_comm[j] := lot_comm[j] + lot_comm[i];
              lot_tassa[j] := lot_tassa[j] + lot_tassa[i];
            elsif lot_costo[i] + lot_comm[i] > 0 then
              -- Nessun lotto successivo: il costo residuo è una perdita
              -- realizzata del fondo, abbinata a ricavo zero nella data del
              -- Costo_quote (in polizza non imponibile, come ogni abbinamento).
              tipo_riga := 'abbinamento';
              vendita_id := ev.id;
              acquisto_id := lot_id[i];
              data_acquisto := lot_data[i];
              data_vendita := ev.data;
              quantita := dal_lotto;
              prezzo_acquisto := lot_costo[i] / dal_lotto;
              prezzo_vendita := 0;
              commissione_acquisto_quota := lot_comm[i];
              commissione_vendita_quota := 0;
              tassa_quota := lot_tassa[i];
              plusvalenza := -(lot_costo[i] + lot_comm[i]);
              return next;
            end if;
            lot_costo[i] := 0; lot_comm[i] := 0; lot_tassa[i] := 0;
          end if;
        else
          quota := dal_lotto / lot_qty[i];
          c_costo := lot_costo[i] * quota;
          c_comm := lot_comm[i] * quota;
          c_tassa := lot_tassa[i] * quota;

          tipo_riga := 'abbinamento';
          vendita_id := ev.id;
          acquisto_id := lot_id[i];
          data_acquisto := lot_data[i];
          data_vendita := ev.data;
          quantita := dal_lotto;
          prezzo_acquisto := lot_costo[i] / lot_qty[i];
          prezzo_vendita := ev.prezzo_unitario;
          commissione_acquisto_quota := c_comm;
          commissione_vendita_quota := ev.commissione * (dal_lotto / ev.quantita);
          tassa_quota := c_tassa;
          plusvalenza := dal_lotto * ev.prezzo_unitario - c_costo - c_comm - commissione_vendita_quota;
          return next;

          lot_qty[i] := lot_qty[i] - dal_lotto;
          lot_costo[i] := lot_costo[i] - c_costo;
          lot_comm[i] := lot_comm[i] - c_comm;
          lot_tassa[i] := lot_tassa[i] - c_tassa;
        end if;

        da_coprire := da_coprire - dal_lotto;
      end if;
      i := i + 1;
    end loop;

    if da_coprire > 0 and ev.operazione <> 'Costo_quote' then
      raise warning
        'Vendita % (strumento %, contenitore %): mancano % quote in acquisto per completare l''abbinamento FIFO',
        ev.id, p_strumento_id, p_contenitore_id, da_coprire;
    end if;
  end loop;

  for i in 1..n loop
    if lot_qty[i] > 0 then
      tipo_riga := 'residuo';
      vendita_id := null;
      acquisto_id := lot_id[i];
      data_acquisto := lot_data[i];
      data_vendita := null;
      quantita := lot_qty[i];
      prezzo_acquisto := lot_costo[i] / lot_qty[i];
      prezzo_vendita := null;
      commissione_acquisto_quota := lot_comm[i];
      commissione_vendita_quota := null;
      tassa_quota := lot_tassa[i];
      plusvalenza := null;
      return next;
    end if;
  end loop;
end;
$function$
;

-- calcola_fifo_posizione
CREATE OR REPLACE FUNCTION public.calcola_fifo_posizione(p_strumento_id uuid, p_contenitore_id uuid)
 RETURNS TABLE(vendita_id uuid, acquisto_id uuid, data_acquisto date, data_vendita date, quantita_abbinata numeric, prezzo_acquisto numeric, prezzo_vendita numeric, commissione_acquisto_quota numeric, commissione_vendita_quota numeric, plusvalenza numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select m.vendita_id, m.acquisto_id, m.data_acquisto, m.data_vendita, m.quantita, m.prezzo_acquisto, m.prezzo_vendita,
         m.commissione_acquisto_quota, m.commissione_vendita_quota, m.plusvalenza
  from motore_fifo_posizione(p_strumento_id, p_contenitore_id, null) m where m.tipo_riga = 'abbinamento'
$function$
;

-- calcola_lotti_residui_posizione
CREATE OR REPLACE FUNCTION public.calcola_lotti_residui_posizione(p_strumento_id uuid, p_contenitore_id uuid)
 RETURNS TABLE(acquisto_id uuid, data_acquisto date, quantita_residua numeric, prezzo_acquisto numeric, commissione_residua numeric, tassa_residua numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select m.acquisto_id, m.data_acquisto, m.quantita, m.prezzo_acquisto, m.commissione_acquisto_quota, m.tassa_quota
  from motore_fifo_posizione(p_strumento_id, p_contenitore_id, null) m where m.tipo_riga = 'residuo'
$function$
;

-- capitale_investito_a_data
CREATE OR REPLACE FUNCTION public.capitale_investito_a_data(p_strumento_id uuid, p_contenitore_id uuid, p_data_limite date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(m.quantita * m.prezzo_acquisto + m.commissione_acquisto_quota + m.tassa_quota), 0)
  from motore_fifo_posizione(p_strumento_id, p_contenitore_id, p_data_limite) m where m.tipo_riga = 'residuo'
$function$
;

-- premi_residui_polizza_a_data
CREATE OR REPLACE FUNCTION public.premi_residui_polizza_a_data(p_contenitore_id uuid, p_data date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select
    coalesce((select sum(t.quantita * t.prezzo_unitario + t.commissione) from transazioni t
              where t.contenitore_id = p_contenitore_id and t.operazione = 'Acquisto' and t.data <= p_data), 0)
    - coalesce((select sum(r.premi_consumati) from riscatti_polizza(p_contenitore_id) r
                where r.data_riscatto <= p_data), 0)
$function$
;

-- riscatti_polizza
CREATE OR REPLACE FUNCTION public.riscatti_polizza(p_contenitore_id uuid)
 RETURNS TABLE(contenitore_id uuid, data_riscatto date, importo_lordo numeric, valore_polizza_prima numeric, premi_residui_prima numeric, premi_consumati numeric, imponibile numeric, premi_residui_dopo numeric, tassa_trattenuta numeric, commissione numeric, prezzo_stimato boolean, vendite_ids uuid[])
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  v_data date;
  v_consumati_cumulati numeric := 0;
  v_premi_fino_a_data numeric;
  v_fondo record;
  v_prezzo numeric;
  v_prezzo_vendita numeric;
  v_stimato boolean;
  v_valore numeric;
  v_importo numeric;
  v_residui numeric;
  v_consumati numeric;
begin
  for v_data in
    select distinct t.data
    from transazioni t
    where t.contenitore_id = p_contenitore_id and t.operazione = 'Vendita'
    order by t.data
  loop
    select coalesce(sum(t.quantita * t.prezzo_unitario + t.commissione), 0)
      into v_premi_fino_a_data
    from transazioni t
    where t.contenitore_id = p_contenitore_id and t.operazione = 'Acquisto' and t.data <= v_data;

    v_residui := v_premi_fino_a_data - v_consumati_cumulati;

    select coalesce(sum(t.quantita * t.prezzo_unitario), 0), coalesce(sum(t.tassa_trattenuta), 0),
           coalesce(sum(t.commissione), 0), array_agg(t.id order by t.id)
      into v_importo, tassa_trattenuta, commissione, vendite_ids
    from transazioni t
    where t.contenitore_id = p_contenitore_id and t.operazione = 'Vendita' and t.data = v_data;

    v_valore := 0;
    prezzo_stimato := false;
    for v_fondo in
      select f.strumento_id, f.quote, f.prezzo, f.stimato, f.mancante
      from fondi_polizza_a_data(p_contenitore_id, v_data, true) f
    loop
      v_prezzo := v_fondo.prezzo;
      v_stimato := v_fondo.stimato or v_fondo.mancante;

      select sum(t.quantita * t.prezzo_unitario) / nullif(sum(t.quantita), 0)
        into v_prezzo_vendita
      from transazioni t
      where t.contenitore_id = p_contenitore_id and t.strumento_id = v_fondo.strumento_id
        and t.operazione = 'Vendita' and t.data = v_data;

      if v_prezzo_vendita is not null then
        v_prezzo := v_prezzo_vendita;
        v_stimato := false;
      end if;

      v_valore := v_valore + v_fondo.quote * coalesce(v_prezzo, 0);
      prezzo_stimato := prezzo_stimato or v_stimato;
    end loop;

    if v_valore > 0 then
      v_consumati := least(v_residui, v_residui * v_importo / v_valore);
    else
      v_consumati := v_residui;
    end if;

    contenitore_id := p_contenitore_id;
    data_riscatto := v_data;
    importo_lordo := v_importo;
    valore_polizza_prima := v_valore;
    premi_residui_prima := v_residui;
    premi_consumati := v_consumati;
    imponibile := greatest(v_importo - v_consumati, 0);
    premi_residui_dopo := v_residui - v_consumati;
    return next;

    v_consumati_cumulati := v_consumati_cumulati + v_consumati;
  end loop;
end;
$function$
;

-- non_realizzato_fiscale_a_data
CREATE OR REPLACE FUNCTION public.non_realizzato_fiscale_a_data(p_data date)
 RETURNS TABLE(strumento_id uuid, contenitore_id uuid, categoria text, contenitore_tipo text, valore numeric, capitale_investito numeric, base_fiscale numeric, incompleta boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with ultime as (
    select distinct on (d.strumento_id, d.contenitore_id)
      d.strumento_id, d.contenitore_id, d.categoria, d.contenitore_tipo, d.valore, d.capitale_investito
    from v_storico_valorizzazioni_dettaglio d
    where d.data <= p_data and d.contenitore_tipo is distinct from 'Polizza'
    order by d.strumento_id, d.contenitore_id, d.data desc
  ), fondi as (
    select c.id as contenitore_id, f.strumento_id, f.quote, f.prezzo, f.mancante,
           f.quote * coalesce(f.prezzo, 0) as valore
    from contenitori c
    cross join lateral fondi_polizza_a_data(c.id, p_data, false) f
    where c.tipo = 'Polizza'
  ), polizze as (
    select f.contenitore_id, sum(f.valore) as valore_polizza, bool_or(f.mancante) as incompleta,
           premi_residui_polizza_a_data(f.contenitore_id, p_data) as premi_residui
    from fondi f
    group by f.contenitore_id
  )
  select u.strumento_id, u.contenitore_id, u.categoria, u.contenitore_tipo, u.valore, u.capitale_investito,
         u.capitale_investito, false
  from ultime u
  union all
  select f.strumento_id, f.contenitore_id, s.categoria, 'Polizza'::text, f.valore,
         capitale_investito_a_data(f.strumento_id, f.contenitore_id, p_data),
         case when p.valore_polizza > 0 then p.premi_residui * f.valore / p.valore_polizza else 0 end,
         p.incompleta
  from fondi f
  join polizze p on p.contenitore_id = f.contenitore_id
  join strumenti s on s.id = f.strumento_id
$function$
;

-- ricostruisci_storico_valorizzazioni
CREATE OR REPLACE FUNCTION public.ricostruisci_storico_valorizzazioni()
 RETURNS TABLE(righe_mercato integer, righe_liquidita integer, righe_orfane_rimosse integer, righe_fantasma_rimosse integer)
 LANGUAGE plpgsql
AS $function$
declare
  v_righe_mercato integer := 0;
  v_righe_liquidita integer := 0;
  v_righe_orfane integer := 0;
  v_righe_fantasma integer := 0;
begin
  -- Tutte le posizioni di mercato, con una sola regola: per ogni giorno in cui
  -- uno strumento del gruppo (contenitore, o posizioni dirette) ha un prezzo,
  -- ogni posizione posseduta nel gruppo ha la sua riga, con l'ultimo prezzo
  -- disponibile fino a quel giorno (fondi_polizza_a_data / prezzo_fondo_a_data).
  insert into storico_valorizzazioni (strumento_id, contenitore_id, data, quantita, prezzo, capitale_investito)
  select f.strumento_id, d.contenitore_id, d.data, f.quote, f.prezzo,
         capitale_investito_a_data(f.strumento_id, d.contenitore_id, d.data)
  from (
    select distinct m.contenitore_id, ps.data
    from (select distinct t.contenitore_id, t.strumento_id from transazioni t where t.strumento_id is not null) m
    join prezzi_storici ps on ps.strumento_id = m.strumento_id
  ) d
  cross join lateral fondi_polizza_a_data(d.contenitore_id, d.data, false) f
  where f.prezzo is not null
  on conflict (strumento_id, contenitore_chiave, data) do update
    set quantita = excluded.quantita, prezzo = excluded.prezzo, capitale_investito = excluded.capitale_investito;

  get diagnostics v_righe_mercato = row_count;

  insert into storico_valorizzazioni (strumento_id, contenitore_id, data, quantita, prezzo)
  select m.strumento_id, m.contenitore_id, m.data, 1, saldo.saldo
  from (select distinct strumento_id, contenitore_id, data from movimenti_liquidita) m
  cross join lateral (
    select coalesce(sum(
      case
        -- L'Interesse è escluso: è denaro maturato ma non "entrato" nel
        -- portafoglio tramite una transazione esplicita — coerente con
        -- v_saldo_liquidita, corretta con lo stesso criterio.
        when ml.tipo_movimento = 'Versamento' then ml.importo
        when ml.tipo_movimento in ('Prelievo', 'Costo') then -ml.importo
        else 0
      end
    ), 0) as saldo
    from movimenti_liquidita ml
    where ml.strumento_id = m.strumento_id
      and ml.contenitore_id is not distinct from m.contenitore_id
      and ml.data <= m.data
  ) saldo
  on conflict (strumento_id, contenitore_chiave, data) do update
    set quantita = excluded.quantita, prezzo = excluded.prezzo;

  get diagnostics v_righe_liquidita = row_count;

  -- Pulizia 1: righe orfane per coppie (strumento, contenitore) che non esistono più in
  -- nessuna transazione né movimento (es. dopo una riallocazione, o l'eliminazione
  -- dell'ultima transazione/movimento per quella combinazione).
  delete from storico_valorizzazioni sv
  where not exists (
    select 1 from transazioni t
    where t.strumento_id = sv.strumento_id
      and coalesce(t.contenitore_id, '00000000-0000-0000-0000-000000000000'::uuid) = sv.contenitore_chiave
  )
  and not exists (
    select 1 from movimenti_liquidita ml
    where ml.strumento_id = sv.strumento_id
      and coalesce(ml.contenitore_id, '00000000-0000-0000-0000-000000000000'::uuid) = sv.contenitore_chiave
  );

  get diagnostics v_righe_orfane = row_count;

  -- Pulizia 2 (solo liquidità): righe "fantasma" scritte dallo snapshot notturno su date che
  -- non corrispondono a nessun movimento reale né a oggi — tipicamente rimaste congelate perché
  -- storico è stato inserito retroattivamente dopo che il cron aveva già fotografato quella notte
  -- con dati incompleti.
  delete from storico_valorizzazioni sv
  where exists (
    select 1 from movimenti_liquidita ml
    where ml.strumento_id = sv.strumento_id
      and coalesce(ml.contenitore_id, '00000000-0000-0000-0000-000000000000'::uuid) = sv.contenitore_chiave
  )
  and sv.data <> current_date
  and not exists (
    select 1 from movimenti_liquidita ml2
    where ml2.strumento_id = sv.strumento_id
      and coalesce(ml2.contenitore_id, '00000000-0000-0000-0000-000000000000'::uuid) = sv.contenitore_chiave
      and ml2.data = sv.data
  );

  get diagnostics v_righe_fantasma = row_count;

  return query select v_righe_mercato, v_righe_liquidita, v_righe_orfane, v_righe_fantasma;
end;
$function$
;

-- -----------------------------------------------------------------------------
-- VISTE
-- -----------------------------------------------------------------------------

-- v_abbinamenti_fifo
CREATE OR REPLACE VIEW public.v_abbinamenti_fifo WITH (security_invoker = true) AS
 SELECT pos.strumento_id,
    pos.contenitore_id,
    f.vendita_id,
    f.acquisto_id,
    f.data_acquisto,
    f.data_vendita,
    f.quantita_abbinata,
    f.prezzo_acquisto,
    f.prezzo_vendita,
    f.commissione_acquisto_quota,
    f.commissione_vendita_quota,
    f.plusvalenza
   FROM ( SELECT DISTINCT transazioni.strumento_id,
            transazioni.contenitore_id
           FROM transazioni
          WHERE transazioni.operazione = ANY (ARRAY['Vendita'::text, 'Scambio_cessione'::text, 'Costo_quote'::text])) pos
     CROSS JOIN LATERAL calcola_fifo_posizione(pos.strumento_id, pos.contenitore_id) f(vendita_id, acquisto_id, data_acquisto, data_vendita, quantita_abbinata, prezzo_acquisto, prezzo_vendita, commissione_acquisto_quota, commissione_vendita_quota, plusvalenza);

-- v_lotti_residui
CREATE OR REPLACE VIEW public.v_lotti_residui WITH (security_invoker = true) AS
 SELECT pos.strumento_id,
    pos.contenitore_id,
    r.acquisto_id,
    r.data_acquisto,
    r.quantita_residua,
    r.prezzo_acquisto,
    r.commissione_residua,
    r.tassa_residua
   FROM ( SELECT DISTINCT transazioni.strumento_id,
            transazioni.contenitore_id
           FROM transazioni
          WHERE transazioni.operazione = ANY (ARRAY['Acquisto'::text, 'Scambio_acquisizione'::text])) pos
     CROSS JOIN LATERAL calcola_lotti_residui_posizione(pos.strumento_id, pos.contenitore_id) r(acquisto_id, data_acquisto, quantita_residua, prezzo_acquisto, commissione_residua, tassa_residua);

-- v_riscatti_polizza
CREATE OR REPLACE VIEW public.v_riscatti_polizza WITH (security_invoker = true) AS
 SELECT c.user_id,
    r.contenitore_id,
    r.data_riscatto,
    EXTRACT(year FROM r.data_riscatto)::integer AS anno,
    r.importo_lordo,
    r.valore_polizza_prima,
    r.premi_residui_prima,
    r.premi_consumati,
    r.imponibile,
    r.premi_residui_dopo,
    r.tassa_trattenuta,
    r.commissione,
    r.prezzo_stimato,
    r.vendite_ids
   FROM contenitori c
     CROSS JOIN LATERAL riscatti_polizza(c.id) r(contenitore_id, data_riscatto, importo_lordo, valore_polizza_prima, premi_residui_prima, premi_consumati, imponibile, premi_residui_dopo, tassa_trattenuta, commissione, prezzo_stimato, vendite_ids)
  WHERE c.tipo = 'Polizza'::text;

-- v_non_realizzato_fiscale_per_anno
CREATE OR REPLACE VIEW public.v_non_realizzato_fiscale_per_anno WITH (security_invoker = true) AS
 WITH date_fine AS (
         SELECT EXTRACT(year FROM sv.data)::integer AS anno,
            max(sv.data) AS data
           FROM storico_valorizzazioni sv
          GROUP BY (EXTRACT(year FROM sv.data)::integer)
        ), fuori_polizza AS (
         SELECT df_1.anno,
            sum(sv.valore) AS valore,
            sum(sv.capitale_investito) AS capitale
           FROM date_fine df_1
             JOIN storico_valorizzazioni sv ON sv.data = df_1.data
             LEFT JOIN contenitori c ON c.id = sv.contenitore_id
          WHERE c.tipo IS DISTINCT FROM 'Polizza'::text
          GROUP BY df_1.anno
        ), polizze AS (
         SELECT df_1.anno,
            f.contenitore_id,
            sum(f.valore) AS valore,
            sum(f.base_fiscale) AS base,
            bool_or(f.incompleta) AS incompleta
           FROM date_fine df_1
             CROSS JOIN LATERAL non_realizzato_fiscale_a_data(df_1.data) f(strumento_id, contenitore_id, categoria, contenitore_tipo, valore, capitale_investito, base_fiscale, incompleta)
          WHERE f.contenitore_tipo = 'Polizza'::text
          GROUP BY df_1.anno, f.contenitore_id
        )
 SELECT df.anno,
    df.data,
    COALESCE(fp.valore, 0::numeric) + COALESCE(( SELECT sum(p.valore) AS sum
           FROM polizze p
          WHERE p.anno = df.anno AND NOT p.incompleta), 0::numeric) AS valore,
    COALESCE(fp.capitale, 0::numeric) + COALESCE(( SELECT sum(p.base) AS sum
           FROM polizze p
          WHERE p.anno = df.anno AND NOT p.incompleta), 0::numeric) AS base_fiscale,
    COALESCE(( SELECT array_agg(p.contenitore_id) AS array_agg
           FROM polizze p
          WHERE p.anno = df.anno AND p.incompleta), '{}'::uuid[]) AS polizze_incomplete
   FROM date_fine df
     LEFT JOIN fuori_polizza fp ON fp.anno = df.anno;

-- v_non_realizzato_inizio_anno
CREATE OR REPLACE VIEW public.v_non_realizzato_inizio_anno WITH (security_invoker = true) AS
 SELECT strumento_id,
    contenitore_id,
    categoria,
    contenitore_tipo,
    valore::numeric(20,2) AS valore,
    capitale_investito,
    base_fiscale,
    incompleta
   FROM non_realizzato_fiscale_a_data(date_trunc('year'::text, CURRENT_DATE::timestamp with time zone)::date) f(strumento_id, contenitore_id, categoria, contenitore_tipo, valore, capitale_investito, base_fiscale, incompleta);

-- v_abbinamenti_fifo_dettaglio
CREATE OR REPLACE VIEW public.v_abbinamenti_fifo_dettaglio WITH (security_invoker = true) AS
 SELECT af.strumento_id,
    af.contenitore_id,
    af.vendita_id,
    af.acquisto_id,
    af.data_acquisto,
    af.data_vendita,
    af.quantita_abbinata,
    af.prezzo_acquisto,
    af.prezzo_vendita,
    af.commissione_acquisto_quota,
    af.commissione_vendita_quota,
    af.plusvalenza,
    tv.operazione AS operazione_vendita,
    c.tipo AS contenitore_tipo,
    c.tipo IS DISTINCT FROM 'Polizza'::text AS imponibile
   FROM v_abbinamenti_fifo af
     JOIN transazioni tv ON tv.id = af.vendita_id
     JOIN strumenti s ON s.id = af.strumento_id
     LEFT JOIN contenitori c ON c.id = af.contenitore_id;

-- v_capitale_investito
CREATE OR REPLACE VIEW public.v_capitale_investito WITH (security_invoker = true) AS
 SELECT strumento_id,
    contenitore_id,
    sum(quantita_residua) AS quantita_posseduta,
    sum(quantita_residua * prezzo_acquisto) AS valore_quote_costo,
    sum(commissione_residua) AS commissioni,
    sum(tassa_residua) AS tasse,
    sum(quantita_residua * prezzo_acquisto) + sum(commissione_residua) + sum(tassa_residua) AS capitale_investito,
        CASE
            WHEN sum(quantita_residua) > 0::numeric THEN (sum(quantita_residua * prezzo_acquisto) + sum(commissione_residua) + sum(tassa_residua)) / sum(quantita_residua)
            ELSE NULL::numeric
        END AS prezzo_medio_unitario
   FROM v_lotti_residui
  GROUP BY strumento_id, contenitore_id;

-- v_premi_residui_polizza
CREATE OR REPLACE VIEW public.v_premi_residui_polizza WITH (security_invoker = true) AS
 WITH premi AS (
         SELECT t.contenitore_id,
            sum(t.quantita * t.prezzo_unitario + t.commissione) AS premi_versati
           FROM transazioni t
          WHERE t.operazione = 'Acquisto'::text
          GROUP BY t.contenitore_id
        ), consumati AS (
         SELECT r.contenitore_id,
            sum(r.premi_consumati) AS premi_consumati
           FROM v_riscatti_polizza r
          GROUP BY r.contenitore_id
        ), valore AS (
         SELECT v_1.contenitore_id,
            sum(v_1.valore_attuale) AS valore_attuale
           FROM v_valore_posizioni_attuale v_1
          GROUP BY v_1.contenitore_id
        )
 SELECT c.id AS contenitore_id,
    c.user_id,
    COALESCE(p.premi_versati, 0::numeric) AS premi_versati,
    COALESCE(k.premi_consumati, 0::numeric) AS premi_consumati,
    COALESCE(p.premi_versati, 0::numeric) - COALESCE(k.premi_consumati, 0::numeric) AS premi_residui,
    COALESCE(v.valore_attuale, 0::numeric) AS valore_attuale,
    COALESCE(v.valore_attuale, 0::numeric) - (COALESCE(p.premi_versati, 0::numeric) - COALESCE(k.premi_consumati, 0::numeric)) AS non_realizzato_fiscale
   FROM contenitori c
     LEFT JOIN premi p ON p.contenitore_id = c.id
     LEFT JOIN consumati k ON k.contenitore_id = c.id
     LEFT JOIN valore v ON v.contenitore_id = c.id
  WHERE c.tipo = 'Polizza'::text;

-- v_plusvalenze_realizzate
CREATE OR REPLACE VIEW public.v_plusvalenze_realizzate WITH (security_invoker = true) AS
 SELECT EXTRACT(year FROM data_vendita)::integer AS anno,
    strumento_id,
    contenitore_id,
    sum(plusvalenza) FILTER (WHERE imponibile) AS plusvalenza_imponibile,
    sum(plusvalenza) FILTER (WHERE NOT imponibile) AS plusvalenza_esente_polizza
   FROM v_abbinamenti_fifo_dettaglio
  GROUP BY (EXTRACT(year FROM data_vendita)), strumento_id, contenitore_id;

-- v_realizzato_per_anno
CREATE OR REPLACE VIEW public.v_realizzato_per_anno WITH (security_invoker = true) AS
 WITH vendite AS (
         SELECT EXTRACT(year FROM d_1.data_vendita)::integer AS anno,
            sum(d_1.plusvalenza) FILTER (WHERE d_1.imponibile) AS imponibile_fifo
           FROM v_abbinamenti_fifo_dettaglio d_1
          GROUP BY (EXTRACT(year FROM d_1.data_vendita)::integer)
        ), riscatti AS (
         SELECT r_1.anno,
            sum(r_1.imponibile) AS imponibile_riscatti
           FROM v_riscatti_polizza r_1
          GROUP BY r_1.anno
        ), tasse_vendite AS (
         SELECT EXTRACT(year FROM t.data)::integer AS anno,
            sum(t.tassa_trattenuta) AS tasse_vendite
           FROM transazioni t
             LEFT JOIN contenitori c ON c.id = t.contenitore_id
          WHERE (t.operazione = ANY (ARRAY['Vendita'::text, 'Scambio_cessione'::text])) AND NOT (t.operazione = 'Scambio_cessione'::text AND c.tipo = 'Polizza'::text)
          GROUP BY (EXTRACT(year FROM t.data)::integer)
        ), dividendi AS (
         SELECT EXTRACT(year FROM t.data)::integer AS anno,
            sum(t.valore_totale) AS imponibile_dividendi,
            sum(t.tassa_trattenuta) AS tasse_dividendi
           FROM transazioni t
          WHERE t.operazione = 'Dividendo'::text
          GROUP BY (EXTRACT(year FROM t.data)::integer)
        ), tutti_gli_anni AS (
         SELECT vendite.anno
           FROM vendite
        UNION
         SELECT riscatti.anno
           FROM riscatti
        UNION
         SELECT tasse_vendite.anno
           FROM tasse_vendite
        UNION
         SELECT dividendi.anno
           FROM dividendi
        )
 SELECT a.anno,
    COALESCE(v.imponibile_fifo, 0::numeric) + COALESCE(r.imponibile_riscatti, 0::numeric) AS imponibile_vendite,
    COALESCE(r.imponibile_riscatti, 0::numeric) AS imponibile_riscatti_polizze,
    COALESCE(tv.tasse_vendite, 0::numeric) AS tasse_vendite,
    COALESCE(v.imponibile_fifo, 0::numeric) + COALESCE(r.imponibile_riscatti, 0::numeric) - COALESCE(tv.tasse_vendite, 0::numeric) AS netto_vendite,
    COALESCE(d.imponibile_dividendi, 0::numeric) AS imponibile_dividendi,
    COALESCE(d.tasse_dividendi, 0::numeric) AS tasse_dividendi,
    COALESCE(d.imponibile_dividendi, 0::numeric) - COALESCE(d.tasse_dividendi, 0::numeric) AS netto_dividendi,
    COALESCE(v.imponibile_fifo, 0::numeric) + COALESCE(r.imponibile_riscatti, 0::numeric) - COALESCE(tv.tasse_vendite, 0::numeric) + COALESCE(d.imponibile_dividendi, 0::numeric) - COALESCE(d.tasse_dividendi, 0::numeric) AS realizzato_netto_totale,
    COALESCE(tv.tasse_vendite, 0::numeric) + COALESCE(d.tasse_dividendi, 0::numeric) AS tasse_totali
   FROM tutti_gli_anni a
     LEFT JOIN vendite v ON v.anno = a.anno
     LEFT JOIN riscatti r ON r.anno = a.anno
     LEFT JOIN tasse_vendite tv ON tv.anno = a.anno
     LEFT JOIN dividendi d ON d.anno = a.anno
  ORDER BY a.anno;

-- v_ricavi_da_vendite
CREATE OR REPLACE VIEW public.v_ricavi_da_vendite WITH (security_invoker = true) AS
 SELECT d.strumento_id,
    d.contenitore_id,
    sum(d.quantita_abbinata) AS quantita_venduta,
    sum(d.quantita_abbinata * d.prezzo_vendita) AS ricavo_totale,
    sum(d.plusvalenza) AS plusvalenza_totale,
    sum(d.plusvalenza -
        CASE
            WHEN d.imponibile AND d.plusvalenza > 0::numeric THEN d.plusvalenza * (s.aliquota_tassazione / 100.0)
            ELSE 0::numeric
        END) AS netto_dopo_tasse_stimato
   FROM v_abbinamenti_fifo_dettaglio d
     JOIN strumenti s ON s.id = d.strumento_id
  GROUP BY d.strumento_id, d.contenitore_id;

-- v_verifica_trattenute
CREATE OR REPLACE VIEW public.v_verifica_trattenute WITH (security_invoker = true) AS
 SELECT d.vendita_id,
    tv.data AS data_vendita,
    d.strumento_id,
    d.contenitore_id,
    s.aliquota_tassazione AS aliquota_attesa_pct,
    sum(d.plusvalenza) AS plusvalenza_totale_vendita,
    round(GREATEST(sum(d.plusvalenza), 0::numeric) * (s.aliquota_tassazione / 100.0), 2) AS tassa_attesa,
    tv.tassa_trattenuta AS tassa_trattenuta_effettiva,
    round(tv.tassa_trattenuta - GREATEST(sum(d.plusvalenza), 0::numeric) * (s.aliquota_tassazione / 100.0), 2) AS differenza,
    'vendita'::text AS tipo_riga,
    tv.quantita * tv.prezzo_unitario AS valore_lordo,
    false AS prezzo_stimato,
    NULL::boolean AS ritenuta_eccessiva
   FROM v_abbinamenti_fifo_dettaglio d
     JOIN transazioni tv ON tv.id = d.vendita_id
     JOIN strumenti s ON s.id = d.strumento_id
  WHERE d.imponibile
  GROUP BY d.vendita_id, tv.data, d.strumento_id, d.contenitore_id, s.aliquota_tassazione, tv.tassa_trattenuta, tv.quantita, tv.prezzo_unitario
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

-- v_riepilogo_posizione
CREATE OR REPLACE VIEW public.v_riepilogo_posizione WITH (security_invoker = true) AS
 SELECT ci.strumento_id,
    ci.contenitore_id,
    ci.quantita_posseduta,
    ci.capitale_investito,
    ci.prezzo_medio_unitario,
    vp.valore_attuale AS valore,
    vp.prezzo_attuale,
        CASE
            WHEN ci.capitale_investito > 0::numeric THEN round((vp.valore_attuale - ci.capitale_investito) / ci.capitale_investito * 100::numeric, 2)
            ELSE NULL::numeric
        END AS rendimento_pct
   FROM v_capitale_investito ci
     LEFT JOIN v_valore_posizioni_attuale vp ON vp.strumento_id = ci.strumento_id AND NOT vp.contenitore_id IS DISTINCT FROM ci.contenitore_id;

-- v_non_realizzato_dettaglio
CREATE OR REPLACE VIEW public.v_non_realizzato_dettaglio WITH (security_invoker = true) AS
 SELECT rp.strumento_id,
    rp.contenitore_id,
    s.categoria,
    c.tipo AS contenitore_tipo,
    rp.valore,
    rp.capitale_investito,
        CASE
            WHEN c.tipo = 'Polizza'::text THEN
            CASE
                WHEN pp.valore_attuale > 0::numeric THEN pp.premi_residui * rp.valore / pp.valore_attuale
                ELSE 0::numeric
            END
            ELSE rp.capitale_investito
        END AS base_fiscale
   FROM v_riepilogo_posizione rp
     JOIN strumenti s ON s.id = rp.strumento_id
     LEFT JOIN contenitori c ON c.id = rp.contenitore_id
     LEFT JOIN v_premi_residui_polizza pp ON pp.contenitore_id = rp.contenitore_id
  WHERE rp.quantita_posseduta > 0::numeric;
