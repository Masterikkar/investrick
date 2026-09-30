'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { partiDataIso } from '@/lib/data-calendario'
import { LUNGHEZZA_MASSIMA_CAMPO_PROFILO, metadatiDaProfilo, type Profilo } from '@/lib/profilo'

export type RisultatoSalvaProfilo = { successo: true } | { errore: 'datiNonValidi' | 'salvataggio' }

export async function salvaProfilo(dati: Profilo): Promise<RisultatoSalvaProfilo> {
  const profilo: Profilo = {
    nome: dati.nome.trim(),
    cognome: dati.cognome.trim(),
    dataNascita: dati.dataNascita.trim(),
    citta: dati.citta.trim(),
    provincia: dati.provincia.trim(),
    regione: dati.regione.trim(),
  }

  const testiValidi = [profilo.nome, profilo.cognome, profilo.citta, profilo.provincia, profilo.regione].every(
    (v) => v.length <= LUNGHEZZA_MASSIMA_CAMPO_PROFILO
  )
  const dataValida = profilo.dataNascita === '' || partiDataIso(profilo.dataNascita) !== null
  if (!testiValidi || !dataValida) return { errore: 'datiNonValidi' }

  const supabase = await createClient()
  // updateUser unisce i metadati passati a quelli già presenti.
  const { error } = await supabase.auth.updateUser({ data: metadatiDaProfilo(profilo) })
  if (error) return { errore: 'salvataggio' }

  // Le iniziali nel menu principale vengono dal layout dell'app.
  revalidatePath('/', 'layout')
  return { successo: true }
}
