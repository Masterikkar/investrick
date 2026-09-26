'use server'

import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database.types'
import {
  simulaPortafoglio,
  simulaGruppo,
  type ParametriSimulazionePortafoglio,
  type RisultatoSimulazionePortafoglio,
  type ParametriSimulazioneGruppo,
  type RisultatoSimulazioneGruppo,
} from '@/lib/ribilanciamento-simulazione'

export type RigaStoricoSimulazione = {
  id: string
  creato_at: string
  parametri: unknown
  risultato: unknown
}

async function salvaSimulazione(
  tipo: 'portafoglio' | 'gruppo',
  contenitoreId: string | null,
  parametri: unknown,
  risultato: unknown
) {
  const supabase = await createClient()
  await supabase.from('simulazioni_ribilanciamento').insert({
    tipo,
    contenitore_id: contenitoreId,
    parametri: parametri as unknown as Json,
    risultato: risultato as unknown as Json,
  })
}

export async function eseguiSimulazionePortafoglio(
  input: ParametriSimulazionePortafoglio
): Promise<{ ok: true; risultato: RisultatoSimulazionePortafoglio } | { ok: false; errore: string }> {
  try {
    const supabase = await createClient()
    const risultato = await simulaPortafoglio(supabase, input)
    await salvaSimulazione('portafoglio', null, input, risultato)
    return { ok: true, risultato }
  } catch {
    return { ok: false, errore: 'generico' }
  }
}

export async function eseguiSimulazioneGruppo(
  input: ParametriSimulazioneGruppo
): Promise<{ ok: true; risultato: RisultatoSimulazioneGruppo } | { ok: false; errore: string }> {
  try {
    const supabase = await createClient()
    const risultato = await simulaGruppo(supabase, input)
    if (risultato === null) return { ok: false, errore: 'nessunComparto' }
    await salvaSimulazione('gruppo', input.contenitoreId, input, risultato)
    return { ok: true, risultato }
  } catch {
    return { ok: false, errore: 'generico' }
  }
}

export async function leggiUltimeSimulazioniPortafoglio(): Promise<RigaStoricoSimulazione[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('simulazioni_ribilanciamento')
    .select('id, creato_at, parametri, risultato')
    .eq('tipo', 'portafoglio')
    .is('contenitore_id', null)
    .order('creato_at', { ascending: false })
    .limit(3)
  return data ?? []
}

export async function leggiUltimeSimulazioniGruppo(contenitoreId: string): Promise<RigaStoricoSimulazione[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('simulazioni_ribilanciamento')
    .select('id, creato_at, parametri, risultato')
    .eq('tipo', 'gruppo')
    .eq('contenitore_id', contenitoreId)
    .order('creato_at', { ascending: false })
    .limit(3)
  return data ?? []
}
