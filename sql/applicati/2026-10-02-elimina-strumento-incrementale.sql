-- 2026-10-02 — elimina_strumento(): al posto del ricalcolo completo, la sola pulizia
--
-- Motivo: dopo aver eliminato strumento, transazioni e movimenti, la funzione
-- rilanciava ricostruisci_storico_valorizzazioni() (~1,7 s sui 8 s concessi a
-- ogni richiesta). Non serve: le righe di storico dello strumento spariscono già
-- da sole (storico_valorizzazioni.strumento_id è ON DELETE CASCADE), le righe
-- degli altri strumenti non dipendono da lui (quote, prezzo e capitale
-- investito si calcolano per strumento e gruppo) e il ricalcolo non cancella
-- mai righe di mercato. Resta solo la pulizia delle righe orfane, che ora è
-- pulisci_storico_valorizzazioni().
--
-- Verifica integrata, prima di cambiare la funzione: per un campione di strumenti
-- (uno per tipo di gruppo, più il conto di liquidità) si elimina lo strumento nei
-- due modi — vecchio (ricalcolo completo) e nuovo (sola pulizia) — e si confronta
-- l'impronta dello storico. Ogni prova è annullata: non cambia nessun dato.
-- Se anche una sola impronta differisce, lo script si ferma e non cambia niente.
--
-- L'app non cambia: eliminaAsset chiama già elimina_strumento().

begin;

do $verifica$
declare
  v_id uuid;
  v_ids uuid[] := array[
    'fbea981f-3904-4f00-9375-f158b3c2f8f4', -- Allianz Strategy Select 75 (Polizza)
    'fef47ade-12ec-441c-a777-4cbb1f4a6d23', -- Darta PIMCO Obbligazionario Prudente (Polizza, con switch)
    '76572927-1bdf-47ef-ad1a-95e16794f2a7', -- Darta MS Global Opportunity (Polizza)
    '9fde15cf-261d-4cc8-9dd8-630dc4a2c2ce', -- USD Coin (diretto)
    '955c6648-ba35-441d-930c-6c0d3c657d8a', -- VanEck Semiconductor (diretto)
    'e80a8bf3-a6f0-4450-b61b-c85c1a7b25c0', -- Pictet Short-Term Money Market (PAC)
    '169ef107-9fd9-4b78-a6d1-4958491c5a71', -- Invesco Physical Gold (PAC)
    '29bd0eff-eea5-407b-b8b1-41db966df6db', -- iShares Euro Government Bond 7-10yr (PAC, 1 transazione)
    '6ca59aab-2f0a-44b8-90bc-eb5119cc4f57'  -- Conto corrente Trade Republic (liquidità)
  ]::uuid[];
  v_hash_nuovo text;
  v_hash_vecchio text;
  v_provati integer := 0;
  v_diversi integer := 0;
begin
  foreach v_id in array v_ids loop
    if not exists (select 1 from strumenti where id = v_id) then
      continue;
    end if;

    -- Nuovo modo: eliminazione + sola pulizia.
    begin
      delete from movimenti_liquidita where strumento_id = v_id;
      delete from transazioni where strumento_id = v_id;
      delete from strumenti where id = v_id;
      perform pulisci_storico_valorizzazioni();
      select md5(coalesce(string_agg(strumento_id::text||'|'||contenitore_chiave::text||'|'||data::text||'|'||quantita::text||'|'||prezzo::text||'|'||coalesce(capitale_investito::text,'null'), ';' order by strumento_id, contenitore_chiave, data),'')) || ':' || count(*)
        into v_hash_nuovo from storico_valorizzazioni;
      raise exception 'annulla la prova' using errcode = 'RB001';
    exception when sqlstate 'RB001' then
      null;
    end;

    -- Vecchio modo: eliminazione + ricalcolo completo.
    begin
      delete from movimenti_liquidita where strumento_id = v_id;
      delete from transazioni where strumento_id = v_id;
      delete from strumenti where id = v_id;
      perform ricostruisci_storico_valorizzazioni();
      select md5(coalesce(string_agg(strumento_id::text||'|'||contenitore_chiave::text||'|'||data::text||'|'||quantita::text||'|'||prezzo::text||'|'||coalesce(capitale_investito::text,'null'), ';' order by strumento_id, contenitore_chiave, data),'')) || ':' || count(*)
        into v_hash_vecchio from storico_valorizzazioni;
      raise exception 'annulla la prova' using errcode = 'RB001';
    exception when sqlstate 'RB001' then
      null;
    end;

    v_provati := v_provati + 1;
    if v_hash_nuovo is distinct from v_hash_vecchio then
      v_diversi := v_diversi + 1;
      raise warning 'Storico diverso eliminando %: sola pulizia %, ricalcolo completo %', v_id, v_hash_nuovo, v_hash_vecchio;
    end if;
  end loop;

  if v_provati = 0 then
    raise exception 'Nessuno strumento del campione trovato: verifica non eseguita';
  end if;
  if v_diversi > 0 then
    raise exception 'Verifica fallita: % strumenti su % danno uno storico diverso', v_diversi, v_provati;
  end if;
  raise notice 'ok: % strumenti provati, nessuna differenza', v_provati;
end
$verifica$;

create or replace function public.elimina_strumento(p_strumento_id uuid)
returns table(transazioni_eliminate integer, movimenti_eliminati integer)
language plpgsql
as $function$
declare
  v_transazioni_eliminate integer := 0;
  v_movimenti_eliminati integer := 0;
begin
  delete from movimenti_liquidita where strumento_id = p_strumento_id;
  get diagnostics v_movimenti_eliminati = row_count;

  delete from transazioni where strumento_id = p_strumento_id;
  get diagnostics v_transazioni_eliminate = row_count;

  delete from strumenti where id = p_strumento_id;
  if not found then
    raise exception 'Strumento % non trovato o non eliminabile', p_strumento_id;
  end if;

  -- Le righe di storico dello strumento sono già sparite (ON DELETE CASCADE):
  -- basta togliere quelle rimaste senza transazioni né movimenti.
  perform pulisci_storico_valorizzazioni();

  return query select v_transazioni_eliminate, v_movimenti_eliminati;
end;
$function$;

commit;
