'use server'

import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database.types'
import {
  simulaPortafoglio,
  simulaGruppo,
  nomeSimulazioneValido,
  MAX_SIMULAZIONI_STORICO,
  type ParametriSimulazionePortafoglio,
  type RisultatoSimulazionePortafoglio,
  type ParametriSimulazioneGruppo,
  type RisultatoSimulazioneGruppo,
} from '@/lib/ribilanciamento-simulazione'

type ClientSupabase = Awaited<ReturnType<typeof createClient>>

export type RigaStoricoSimulazione = {
  id: string
  nome: string
  creato_at: string
  parametri: unknown
  risultato: unknown
}

// Tiene lo storico a MAX_SIMULAZIONI_STORICO righe per tipo/gruppo: dopo un
// inserimento, elimina tutto ciò che eccede le più recenti — la stessa regola
// enunciata all'utente nel wizard ("procedendo, il sistema sovrascriverà
// quella meno recente"). Chiamata dopo l'insert invece che prima: si
// autocorregge anche se in passato fossero rimaste più di
// MAX_SIMULAZIONI_STORICO righe (lo storico non era ancora limitato lato DB).
async function eliminaSimulazioniEccedenti(
  supabase: ClientSupabase,
  tipo: 'portafoglio' | 'gruppo',
  contenitoreId: string | null
): Promise<void> {
  // Due rami separati invece di un unico query builder condizionale: stesso
  // stile già usato da leggiUltimeSimulazioniPortafoglio/Gruppo qui sotto
  // (.is contro .eq su contenitore_id), niente riassegnazioni di tipo del
  // builder Supabase.
  const { data } =
    contenitoreId === null
      ? await supabase
          .from('simulazioni_ribilanciamento')
          .select('id')
          .eq('tipo', tipo)
          .is('contenitore_id', null)
          .order('creato_at', { ascending: false })
          .range(MAX_SIMULAZIONI_STORICO, 9999)
      : await supabase
          .from('simulazioni_ribilanciamento')
          .select('id')
          .eq('tipo', tipo)
          .eq('contenitore_id', contenitoreId)
          .order('creato_at', { ascending: false })
          .range(MAX_SIMULAZIONI_STORICO, 9999)
  const idEccedenti = (data ?? []).map((r) => r.id)
  if (idEccedenti.length > 0) {
    await supabase.from('simulazioni_ribilanciamento').delete().in('id', idEccedenti)
  }
}

// Un solo punto di validazione lato server, non fidandosi del filtro live
// del campo input: nomeSimulazioneValido (lib/ribilanciamento-simulazione.ts)
// è la stessa regola usata dal client mentre digita.
async function salvaSimulazione(
  tipo: 'portafoglio' | 'gruppo',
  contenitoreId: string | null,
  nome: string,
  parametri: unknown,
  risultato: unknown
): Promise<{ ok: true; id: string } | { ok: false; errore: 'nomeInvalido' }> {
  if (!nomeSimulazioneValido(nome)) return { ok: false, errore: 'nomeInvalido' }
  const supabase = await createClient()
  const { data } = await supabase
    .from('simulazioni_ribilanciamento')
    .insert({
      tipo,
      contenitore_id: contenitoreId,
      nome: nome.trim(),
      parametri: parametri as unknown as Json,
      risultato: risultato as unknown as Json,
    })
    .select('id')
    .single()
  await eliminaSimulazioniEccedenti(supabase, tipo, contenitoreId)
  return { ok: true, id: data?.id ?? '' }
}

export async function eseguiSimulazionePortafoglio(
  nome: string,
  input: ParametriSimulazionePortafoglio
): Promise<{ ok: true; risultato: RisultatoSimulazionePortafoglio } | { ok: false; errore: string }> {
  if (!nomeSimulazioneValido(nome)) return { ok: false, errore: 'nomeInvalido' }
  try {
    const supabase = await createClient()
    const risultato = await simulaPortafoglio(supabase, input)
    await salvaSimulazione('portafoglio', null, nome, input, risultato)
    return { ok: true, risultato }
  } catch {
    return { ok: false, errore: 'generico' }
  }
}

export async function eseguiSimulazioneGruppo(
  nome: string,
  input: ParametriSimulazioneGruppo
): Promise<{ ok: true; risultato: RisultatoSimulazioneGruppo } | { ok: false; errore: string }> {
  if (!nomeSimulazioneValido(nome)) return { ok: false, errore: 'nomeInvalido' }
  try {
    const supabase = await createClient()
    const risultato = await simulaGruppo(supabase, input)
    if (risultato === null) return { ok: false, errore: 'nessunComparto' }
    await salvaSimulazione('gruppo', input.contenitoreId, nome, input, risultato)
    return { ok: true, risultato }
  } catch {
    return { ok: false, errore: 'generico' }
  }
}

export async function leggiUltimeSimulazioniPortafoglio(): Promise<RigaStoricoSimulazione[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('simulazioni_ribilanciamento')
    .select('id, nome, creato_at, parametri, risultato')
    .eq('tipo', 'portafoglio')
    .is('contenitore_id', null)
    .order('creato_at', { ascending: false })
    .limit(MAX_SIMULAZIONI_STORICO)
  return data ?? []
}

export async function leggiUltimeSimulazioniGruppo(contenitoreId: string): Promise<RigaStoricoSimulazione[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('simulazioni_ribilanciamento')
    .select('id, nome, creato_at, parametri, risultato')
    .eq('tipo', 'gruppo')
    .eq('contenitore_id', contenitoreId)
    .order('creato_at', { ascending: false })
    .limit(MAX_SIMULAZIONI_STORICO)
  return data ?? []
}

// Rinomina/elimina, usate dalle mini card dello storico. RLS (policy
// _update_own / _delete_own su user_id = auth.uid()) impedisce già di
// toccare righe di altri utenti; qui basta rivalidare il nome.
export async function rinominaSimulazione(id: string, nome: string): Promise<{ ok: true } | { ok: false; errore: 'nomeInvalido' }> {
  if (!nomeSimulazioneValido(nome)) return { ok: false, errore: 'nomeInvalido' }
  const supabase = await createClient()
  await supabase.from('simulazioni_ribilanciamento').update({ nome: nome.trim() }).eq('id', id)
  return { ok: true }
}

export async function eliminaSimulazione(id: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('simulazioni_ribilanciamento').delete().eq('id', id)
}
