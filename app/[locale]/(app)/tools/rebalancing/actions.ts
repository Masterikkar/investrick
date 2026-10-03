'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const SOGLIA_MASSIMA = 100

export async function aggiornaSogliaRibilanciamento(
  nuovaSoglia: number
): Promise<{ successo: true } | { errore: string }> {
  const supabase = await createClient()

  if (!Number.isFinite(nuovaSoglia) || nuovaSoglia < 0 || nuovaSoglia > SOGLIA_MASSIMA) {
    return { errore: `Inserisci un valore tra 0 e ${SOGLIA_MASSIMA}.` }
  }

  const { data: esistente, error: erroreSelect } = await supabase
    .from('impostazioni_utente')
    .select('user_id')
    .maybeSingle()

  if (erroreSelect) {
    return { errore: erroreSelect.message }
  }

  if (esistente) {
    const { error: erroreUpdate } = await supabase
      .from('impostazioni_utente')
      .update({ soglia_ribilanciamento_pp: nuovaSoglia })
      .eq('user_id', esistente.user_id)

    if (erroreUpdate) {
      return { errore: erroreUpdate.message }
    }
  } else {
    // Nessuna riga ancora presente: non conosciamo con certezza se
    // user_id vada popolato esplicitamente (es. con l'id dell'utente
    // autenticato) o se un default/trigger del database lo gestisca da
    // solo. Proviamo l'inserimento senza specificarlo; se il database si
    // aspetta un valore esplicito, l'errore tornato qui lo dirà chiaramente
    // invece di fallire in silenzio.
    const { error: erroreInsert } = await supabase
      .from('impostazioni_utente')
      .insert({ soglia_ribilanciamento_pp: nuovaSoglia })

    if (erroreInsert) {
      return { errore: erroreInsert.message }
    }
  }

  revalidatePath('/', 'layout')

  return { successo: true }
}