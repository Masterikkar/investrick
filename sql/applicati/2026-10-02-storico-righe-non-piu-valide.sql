-- 2026-10-02 — Storico valorizzazioni: via le righe di posizioni non più possedute
--
-- Problema: il ricalcolo scriveva righe (upsert) ma non ne cancellava mai.
-- Se correggi la data di un acquisto, o elimini una transazione, le righe
-- scritte quando la posizione "esisteva" restavano nello storico con le vecchie
-- quantità, e i grafici mostravano un valore dove oggi non possiedi più nulla.
-- Esempio misurato: spostando di 60 giorni in avanti l'unico acquisto di un ETF,
-- le 30 righe tra la vecchia e la nuova data restavano tutte.
--
-- Cosa cambia: dopo aver riscritto le righe di mercato, ricostruisci_storico_gruppo()
-- elimina, nello stesso ambito (gruppo, strumento se indicato, date dalla data di
-- partenza in poi), le righe delle date in cui la posizione non è posseduta
-- (fondi_polizza_a_data non la restituisce: quantità <= 0 o prezzo mancante).
--
-- Cosa NON cambia: le righe di date in cui la posizione è posseduta ma che non sono
-- giorni di prezzo del gruppo (es. le righe del fine settimana scritte dal
-- snapshot notturno) restano come sono: ricalcolarle le cambierebbe (prezzo e
-- capitale investito differiscono da quelli dello snapshot).
-- Firma e colonne restituite non cambiano: nessuna rigenerazione dei tipi.
--
-- Verifica integrata (tutto annullato se qualcosa non torna):
--  1. ricalcolo completo con la funzione nuova: sullo storico di oggi spariscono solo
--     le righe a quantità zero, tutto il resto è identico;
--  2. sei scenari (data spostata avanti e indietro, transazione eliminata, anche
--     in Polizza): ricalcolo incrementale come lo fa l'app == ricalcolo completo, e
--     nessuna riga resta prima della prima transazione. Ogni scenario è annullato.

begin;

create or replace function pg_temp.hash_storico(p_solo_con_quantita boolean default false) returns text
language sql as $$
  select md5(coalesce(string_agg(strumento_id::text||'|'||contenitore_chiave::text||'|'||data::text||'|'||quantita::text||'|'||prezzo::text||'|'||coalesce(capitale_investito::text,'null'), ';' order by strumento_id, contenitore_chiave, data),'')) || ':' || count(*)
  from storico_valorizzazioni
  where not p_solo_con_quantita or quantita > 0
$$;

-- Impronte prima: complessiva e senza le righe a quantità zero (quelle attese in meno).
do $prima$
begin
  perform set_config('app.hash_prima_senza_zero', pg_temp.hash_storico(true), true);
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
  --
  -- Le date da valutare sono i giorni di prezzo più quelle delle righe già
  -- presenti nell'ambito: le righe scritte (insert) sono quelle dei giorni di
  -- prezzo; sono tolte (delete) le righe esistenti per cui la posizione, a quella
  -- data, non risulta più posseduta (non compare nel calcolo).
  with giorni_prezzo as (
    select distinct ps.data
    from (select distinct t.strumento_id from transazioni t
          where t.strumento_id is not null
            and t.contenitore_id is not distinct from p_contenitore_id) m
    join prezzi_storici ps on ps.strumento_id = m.strumento_id
    where v_da_mercato is null or ps.data >= v_da_mercato
  ),
  esistenti as (
    select v.strumento_id, v.data
    from storico_valorizzazioni v
    where v.contenitore_chiave = v_chiave
      and exists (select 1 from transazioni t
                  where t.strumento_id = v.strumento_id
                    and t.contenitore_id is not distinct from p_contenitore_id)
      and (v_gruppo_intero or v.strumento_id = p_strumento_id)
      and (v_da_mercato is null or v.data >= v_da_mercato)
  ),
  giorni as (
    select data, bool_or(da_prezzo) as da_prezzo
    from (select data, true as da_prezzo from giorni_prezzo
          union all
          select data, false from esistenti) x
    group by data
  ),
  calcolate as (
    select f.strumento_id, g.data, f.quote, f.prezzo, g.da_prezzo
    from giorni g
    cross join lateral fondi_polizza_a_data(p_contenitore_id, g.data, false) f
    where f.prezzo is not null
      and (v_gruppo_intero or f.strumento_id = p_strumento_id)
  ),
  scritte as (
    insert into storico_valorizzazioni (strumento_id, contenitore_id, data, quantita, prezzo, capitale_investito)
    select c.strumento_id, p_contenitore_id, c.data, c.quote, c.prezzo,
           capitale_investito_a_data(c.strumento_id, p_contenitore_id, c.data)
    from calcolate c
    where c.da_prezzo
    on conflict (strumento_id, contenitore_chiave, data) do update
      set quantita = excluded.quantita, prezzo = excluded.prezzo, capitale_investito = excluded.capitale_investito
    returning 1
  ),
  tolte as (
    delete from storico_valorizzazioni v
    using esistenti e
    where e.strumento_id = v.strumento_id
      and e.data = v.data
      and v.contenitore_chiave = v_chiave
      and not exists (select 1 from calcolate c where c.strumento_id = v.strumento_id and c.data = v.data)
    returning 1
  )
  select count(*) into v_righe_mercato from scritte;

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

-- Verifica 1 e 2.
do $verifica$
declare
  s record;
  tr record;
  v_chiave uuid;
  v_da date;
  v_hash_inc text;
  v_hash_completo text;
  v_stantie integer;
  v_eseguiti integer := 0;
  v_saltati integer := 0;
  v_diversi integer := 0;
begin
  -- 1. Ricalcolo completo nuovo: spariscono solo le righe a quantità zero.
  perform public.ricostruisci_storico_valorizzazioni();
  if pg_temp.hash_storico() <> current_setting('app.hash_prima_senza_zero') then
    raise exception 'Il ricalcolo completo ha cambiato più delle sole righe a quantità zero: atteso %, trovato %',
      current_setting('app.hash_prima_senza_zero'), pg_temp.hash_storico();
  end if;

  -- 2. Scenari: ricalcolo incrementale (come l'app) contro ricalcolo completo.
  for s in select * from (values
    ('29bd0eff-eea5-407b-b8b1-41db966df6db'::uuid, 'prima', 'sposta', 60),   -- iShares Euro Gov 7-10yr (PAC): acquisto spostato avanti
    ('955c6648-ba35-441d-930c-6c0d3c657d8a'::uuid, 'prima', 'sposta', 45),   -- VanEck Semiconductor (diretto): primo acquisto avanti
    ('e80a8bf3-a6f0-4450-b61b-c85c1a7b25c0'::uuid, 'ultima', 'sposta', -20), -- Pictet (PAC): ultima vendita indietro
    ('fbea981f-3904-4f00-9375-f158b3c2f8f4'::uuid, 'prima', 'sposta', 30),   -- Allianz Strategy Select 75 (Polizza): acquisto avanti
    ('9fde15cf-261d-4cc8-9dd8-630dc4a2c2ce'::uuid, 'ultima', 'elimina', 0),  -- USD Coin (diretto): ultima transazione eliminata
    ('fef47ade-12ec-441c-a777-4cbb1f4a6d23'::uuid, 'ultima', 'sposta', -10)  -- Darta PIMCO (Polizza, con switch): ultimo switch indietro
  ) x(strumento_id, quale, azione, giorni)
  loop
    begin
      select t.id, t.data, t.contenitore_id into tr
      from transazioni t
      where t.strumento_id = s.strumento_id
      order by (case when s.quale = 'prima' then t.data end) asc nulls last,
               (case when s.quale = 'ultima' then t.data end) desc nulls last,
               t.id
      limit 1;
      if tr.id is null then
        raise exception 'nessuna transazione per %', s.strumento_id;
      end if;
      v_chiave := coalesce(tr.contenitore_id, '00000000-0000-0000-0000-000000000000'::uuid);
      v_da := case when s.azione = 'sposta' then least(tr.data, tr.data + s.giorni) else tr.data end;

      -- Come l'app: solo la posizione toccata, dalla data più vecchia, poi la pulizia.
      begin
        if s.azione = 'sposta' then
          update transazioni set data = data + s.giorni where id = tr.id;
        else
          delete from transazioni where id = tr.id;
        end if;
        perform public.ricostruisci_storico_gruppo(tr.contenitore_id, s.strumento_id, v_da);
        perform public.pulisci_storico_valorizzazioni();
        v_hash_inc := pg_temp.hash_storico();
        select count(*) into v_stantie
        from storico_valorizzazioni v
        where v.strumento_id = s.strumento_id
          and v.contenitore_chiave = v_chiave
          and v.data < (select min(t.data) from transazioni t
                        where t.strumento_id = s.strumento_id
                          and coalesce(t.contenitore_id, '00000000-0000-0000-0000-000000000000'::uuid) = v_chiave);
        raise exception 'annulla la prova' using errcode = 'RB001';
      exception when sqlstate 'RB001' then
        null;
      end;

      -- Riferimento: stessa modifica, ricalcolo completo.
      begin
        if s.azione = 'sposta' then
          update transazioni set data = data + s.giorni where id = tr.id;
        else
          delete from transazioni where id = tr.id;
        end if;
        perform public.ricostruisci_storico_valorizzazioni();
        v_hash_completo := pg_temp.hash_storico();
        raise exception 'annulla la prova' using errcode = 'RB001';
      exception when sqlstate 'RB001' then
        null;
      end;

      v_eseguiti := v_eseguiti + 1;
      if v_hash_inc is distinct from v_hash_completo or v_stantie > 0 then
        v_diversi := v_diversi + 1;
        raise warning 'Scenario % % %: incrementale %, completo %, righe prima della prima transazione %',
          s.strumento_id, s.azione, s.giorni, v_hash_inc, v_hash_completo, v_stantie;
      end if;
    exception when others then
      v_saltati := v_saltati + 1;
      raise warning 'Scenario saltato (% %): %', s.strumento_id, s.azione, sqlerrm;
    end;
  end loop;

  if v_diversi > 0 then
    raise exception 'Verifica fallita: % scenari su % non tornano', v_diversi, v_eseguiti;
  end if;
  if v_eseguiti < 4 then
    raise exception 'Verifica insufficiente: solo % scenari eseguiti, % saltati', v_eseguiti, v_saltati;
  end if;
  if pg_temp.hash_storico() <> current_setting('app.hash_prima_senza_zero') then
    raise exception 'Gli scenari hanno lasciato tracce nello storico';
  end if;
  raise notice 'ok: ricalcolo completo identico meno le righe a quantità zero; % scenari identici (% saltati)', v_eseguiti, v_saltati;
end
$verifica$;

commit;
