-- Nome della simulazione salvata (step "Esecuzione" del wizard di
-- ribilanciamento): l'utente lo sceglie prima di avviare il calcolo, per
-- ritrovarla nello storico. Solo lettere, numeri e spazi, max 40 caratteri
-- (validazione applicativa in lib/ribilanciamento-simulazione.ts); qui solo
-- un vincolo di lunghezza come rete di sicurezza a livello DB.
--
-- Prima: 1 riga di test, nessuna colonna "nome".
-- Dopo: stessa riga, nome = 'Simulazione' (backfill), colonna NOT NULL.

alter table simulazioni_ribilanciamento add column nome text;

update simulazioni_ribilanciamento set nome = 'Simulazione' where nome is null;

alter table simulazioni_ribilanciamento alter column nome set not null;

alter table simulazioni_ribilanciamento
  add constraint simulazioni_ribilanciamento_nome_lunghezza
  check (char_length(nome) >= 1 and char_length(nome) <= 40);
