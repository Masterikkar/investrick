-- Nuova tabella per lo storico delle simulazioni di ribilanciamento
-- (wizard popup: portafoglio 5 step, per gruppo 3 step). Mostra le ultime 3
-- simulazioni con data/ora. Nessuna Vendita reale viene creata: parametri e
-- risultato sono solo un'istantanea jsonb del calcolo.

create table public.simulazioni_ribilanciamento (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  creato_at timestamptz not null default now(),
  tipo text not null check (tipo in ('portafoglio', 'gruppo')),
  contenitore_id uuid references public.contenitori(id) on delete set null,
  parametri jsonb not null,
  risultato jsonb not null
);

create index simulazioni_ribilanciamento_query_idx
  on public.simulazioni_ribilanciamento (user_id, tipo, contenitore_id, creato_at desc);

alter table public.simulazioni_ribilanciamento enable row level security;

create policy simulazioni_ribilanciamento_select_own on public.simulazioni_ribilanciamento
  for select using (user_id = auth.uid());
create policy simulazioni_ribilanciamento_insert_own on public.simulazioni_ribilanciamento
  for insert with check (user_id = auth.uid());
create policy simulazioni_ribilanciamento_update_own on public.simulazioni_ribilanciamento
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy simulazioni_ribilanciamento_delete_own on public.simulazioni_ribilanciamento
  for delete using (user_id = auth.uid());
