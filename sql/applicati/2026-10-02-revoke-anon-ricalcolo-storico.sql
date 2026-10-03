-- 2026-10-02 — Chiude il permesso di esecuzione di default (PUBLIC/anon) sulle
-- due funzioni che modificano o ricostruiscono lo storico per intero.
-- Restano eseguibili da authenticated e service_role (l'app le chiama solo
-- da utente autenticato). Già applicato su Supabase.

revoke execute on function public.ricostruisci_storico_valorizzazioni() from public, anon;
revoke execute on function public.elimina_strumento(uuid) from public, anon;

-- Verifica: anon_exec = false, authenticated_exec = true, service_role_exec = true
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_exec,
       has_function_privilege('service_role', p.oid, 'execute') as service_role_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('ricostruisci_storico_valorizzazioni','elimina_strumento',
                    'pulisci_storico_valorizzazioni','ricostruisci_storico_gruppo')
order by p.proname;
