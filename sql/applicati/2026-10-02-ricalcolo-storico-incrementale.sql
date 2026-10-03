-- 2026-10-02 — Ricalcolo incrementale dello storico valorizzazioni
--
-- Motivo: ricostruisci_storico_valorizzazioni() riscriveva tutto lo storico a
-- ogni transazione (~3 s con 4.700 righe) e PostgREST interrompe le richieste
-- dopo 8 s: aggiungere un movimento di liquidità ha dato "statement timeout"
-- dopo il salvataggio. Ora ogni operazione ricalcola solo ciò che tocca.
--
-- Perché si può fare per singolo strumento: quote, prezzo e capitale investito
-- di una riga dipendono solo da (strumento, gruppo, data) — fondi_polizza_a_data,
-- prezzo_fondo_a_data e motore_fifo_posizione lavorano per strumento. L'unica
-- eccezione sono le date del gruppo (giorni in cui almeno uno strumento ha un
-- prezzo): quando uno strumento entra per la prima volta in un gruppo i suoi
-- prezzi aggiungono date, quindi righe anche per le altre posizioni. In quel
-- caso la funzione ricalcola il gruppo intero.
--
-- Cosa non cambia: la regola di calcolo è identica a prima (stesse query),
-- ricostruisci_storico_valorizzazioni() mantiene nome, colonne e risultato
-- (ora è un ciclo sui gruppi + la pulizia). Come prima, le righe di mercato
-- non vengono mai cancellate dal ricalcolo, solo dalla pulizia.
--
-- Verifica fatta prima di applicare: hash dello storico identico al ricalcolo
-- completo in ogni scenario (acquisto recente e retrodatato, strumento nuovo
-- nel gruppo, vendita e switch in polizza, modifica, spostamento,
-- movimenti di liquidità). Non provate (richiedono istruzioni DELETE): le
-- eliminazioni e elimina_strumento, che per questo qui non è toccata.

begin;

-- Hash dello storico prima di toccare qualunque cosa (serve alla verifica in fondo).
do $prima$
declare h text;
begin
  select md5(coalesce(string_agg(strumento_id::text||'|'||contenitore_chiave::text||'|'||data::text||'|'||quantita::text||'|'||prezzo::text||'|'||coalesce(capitale_investito::text,'null'), ';' order by strumento_id, contenitore_chiave, data),'')) || ':' || count(*) into h from storico_valorizzazioni;
  perform set_config('app.hash_storico_prima', h, true);
end
$prima$;

-- Ricalcola lo storico di un gruppo. Argomenti omessi = nessun filtro:
--   p_contenitore_id  il gruppo; omesso = posizioni dirette (senza gruppo)
--   p_strumento_id    solo le righe di questo strumento (o conto di liquidità);
--                     omesso = tutto il gruppo
--   p_da_data         solo dalle date >= questa; omesso = tutta la storia
create or replace function public.ricostruisci_storico_gruppo(
  p_contenitore_id uuid default null,
  p_strumento_id uuid default null,
  p_da_data date default null
)
returns table(righe_mercato integer, righe_liquidita integer)
language plpgsql
set search_path = public
as $function$
declare
  v_chiave uuid := coalesce(p_contenitore_id, '00000000-0000-0000-0000-000000000000'::uuid);
  v_gruppo_intero boolean;
  v_da_mercato date;
  v_righe_mercato integer := 0;
  v_righe_liquidita integer := 0;
begin
  -- Mercato: tutto il gruppo se non si indica lo strumento, oppure se lo
  -- strumento ha transazioni nel gruppo ma ancora nessuna riga di storico
  -- (entra per la prima volta: aggiunge date anche alle altre posizioni, e
  -- allora si riparte dall'inizio). Altrimenti solo le righe dello strumento.
  v_gruppo_intero := p_strumento_id is null
    or (
      exists (select 1 from transazioni t
              where t.strumento_id = p_strumento_id
                and t.contenitore_id is not distinct from p_contenitore_id)
      and not exists (select 1 from storico_valorizzazioni sv
                      where sv.strumento_id = p_strumento_id
                        and sv.contenitore_chiave = v_chiave)
    );
  v_da_mercato := case when p_strumento_id is not null and v_gruppo_intero then null else p_da_data end;

  -- Tutte le posizioni di mercato, con una sola regola: per ogni giorno in cui
  -- uno strumento del gruppo (contenitore, o posizioni dirette) ha un prezzo,
  -- ogni posizione posseduta nel gruppo ha la sua riga, con l'ultimo prezzo
  -- disponibile fino a quel giorno (fondi_polizza_a_data / prezzo_fondo_a_data).
  insert into storico_valorizzazioni (strumento_id, contenitore_id, data, quantita, prezzo, capitale_investito)
  select f.strumento_id, d.contenitore_id, d.data, f.quote, f.prezzo,
         capitale_investito_a_data(f.strumento_id, d.contenitore_id, d.data)
  from (
    select distinct m.contenitore_id, ps.data
    from (select distinct t.contenitore_id, t.strumento_id from transazioni t
          where t.strumento_id is not null
            and t.contenitore_id is not distinct from p_contenitore_id) m
    join prezzi_storici ps on ps.strumento_id = m.strumento_id
    where v_da_mercato is null or ps.data >= v_da_mercato
  ) d
  cross join lateral fondi_polizza_a_data(d.contenitore_id, d.data, false) f
  where f.prezzo is not null
    and (v_gruppo_intero or f.strumento_id = p_strumento_id)
  on conflict (strumento_id, contenitore_chiave, data) do update
    set quantita = excluded.quantita, prezzo = excluded.prezzo, capitale_investito = excluded.capitale_investito;

  get diagnostics v_righe_mercato = row_count;

  -- Liquidità: una riga per ogni data con un movimento, col saldo cumulato.
  -- Ogni conto è indipendente dagli altri: si filtra sempre per conto.
  insert into storico_valorizzazioni (strumento_id, contenitore_id, data, quantita, prezzo)
  select m.strumento_id, m.contenitore_id, m.data, 1, saldo.saldo
  from (select distinct strumento_id, contenitore_id, data from movimenti_liquidita
        where contenitore_id is not distinct from p_contenitore_id
          and (p_strumento_id is null or strumento_id = p_strumento_id)
          and (p_da_data is null or data >= p_da_data)) m
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

  return query select v_righe_mercato, v_righe_liquidita;
end;
$function$;

-- Le due pulizie, identiche a prima, ora in una funzione propria.
create or replace function public.pulisci_storico_valorizzazioni()
returns table(righe_orfane_rimosse integer, righe_fantasma_rimosse integer)
language plpgsql
set search_path = public
as $function$
declare
  v_righe_orfane integer := 0;
  v_righe_fantasma integer := 0;
begin
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

  return query select v_righe_orfane, v_righe_fantasma;
end;
$function$;

-- Stessa firma e stesso risultato di prima: ora è un ciclo sui gruppi (le
-- posizioni dirette, senza gruppo, sono il gruppo "null") più la pulizia.
create or replace function public.ricostruisci_storico_valorizzazioni()
returns table(righe_mercato integer, righe_liquidita integer, righe_orfane_rimosse integer, righe_fantasma_rimosse integer)
language plpgsql
set search_path = public
as $function$
declare
  g record;
  v_m integer;
  v_l integer;
  v_tot_mercato integer := 0;
  v_tot_liquidita integer := 0;
  v_orfane integer;
  v_fantasma integer;
begin
  for g in (
    select t.contenitore_id from transazioni t where t.strumento_id is not null
    union
    select ml.contenitore_id from movimenti_liquidita ml
  ) loop
    select x.righe_mercato, x.righe_liquidita into v_m, v_l
    from ricostruisci_storico_gruppo(g.contenitore_id) x;
    v_tot_mercato := v_tot_mercato + v_m;
    v_tot_liquidita := v_tot_liquidita + v_l;
  end loop;

  select p.righe_orfane_rimosse, p.righe_fantasma_rimosse into v_orfane, v_fantasma
  from pulisci_storico_valorizzazioni() p;

  return query select v_tot_mercato, v_tot_liquidita, v_orfane, v_fantasma;
end;
$function$;

-- Le due funzioni nuove non servono né a anon né a public.
revoke execute on function public.ricostruisci_storico_gruppo(uuid, uuid, date) from public, anon;
revoke execute on function public.pulisci_storico_valorizzazioni() from public, anon;

-- Verifica nella stessa transazione: il ricalcolo completo nuovo deve lasciare lo
-- storico identico a prima. Se cambia anche solo una riga, annulla tutto.
do $dopo$
declare h text; r record;
begin
  select * into r from public.ricostruisci_storico_valorizzazioni();
  select md5(coalesce(string_agg(strumento_id::text||'|'||contenitore_chiave::text||'|'||data::text||'|'||quantita::text||'|'||prezzo::text||'|'||coalesce(capitale_investito::text,'null'), ';' order by strumento_id, contenitore_chiave, data),'')) || ':' || count(*) into h from storico_valorizzazioni;
  if h <> current_setting('app.hash_storico_prima') then
    raise exception 'Storico cambiato dopo il ricalcolo completo: prima %, dopo %', current_setting('app.hash_storico_prima'), h;
  end if;
  raise notice 'ok % (mercato %, liquidita %, orfane %, fantasma %)', h, r.righe_mercato, r.righe_liquidita, r.righe_orfane_rimosse, r.righe_fantasma_rimosse;
end
$dopo$;

commit;
