'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { partiDataIso } from '@/lib/data-calendario'
import { LUNGHEZZA_MASSIMA_CAMPO_PROFILO, metadatiDaProfilo, type Profilo } from '@/lib/profilo'
import { normalizzaTestoRicerca } from '@/lib/testo-ricerca'

export type Comune = {
  codice_istat: string
  nome: string
  nome_straniero: string | null
  sigla_provincia: string
  provincia: string
  regione: string
}

const COLONNE_COMUNE = 'codice_istat, nome, nome_straniero, sigla_provincia, provincia, regione'
const RISULTATI_MASSIMI = 10

// Suggerimenti per il campo Città: prima i comuni il cui nome inizia con il
// testo digitato, poi quelli con una parola che inizia così (es. "teodoro" →
// San Teodoro). Servono almeno 2 caratteri.
export async function cercaComuni(testo: string): Promise<Comune[]> {
  // Solo lettere, cifre e spazi: '%' e '_' sono caratteri speciali del LIKE.
  const q = normalizzaTestoRicerca(testo).replace(/[^a-z0-9 ]/g, '')
  if (q.length < 2 || q.length > 60) return []

  const supabase = await createClient()
  const { data: iniziano } = await supabase
    .from('comuni')
    .select(COLONNE_COMUNE)
    .like('nome_ricerca', `${q}*`)
    .order('nome')
    .limit(RISULTATI_MASSIMI)
  const risultati = iniziano ?? []
  if (risultati.length >= RISULTATI_MASSIMI) return risultati

  const { data: contengono } = await supabase
    .from('comuni')
    .select(COLONNE_COMUNE)
    .like('nome_ricerca', `* ${q}*`)
    .order('nome')
    .limit(RISULTATI_MASSIMI - risultati.length)
  return [...risultati, ...(contengono ?? [])]
}

export type DatiProfilo = {
  nome: string
  cognome: string
  dataNascita: string
  codiceIstat: string
}

export type RisultatoSalvaProfilo = { successo: true } | { errore: 'datiNonValidi' | 'salvataggio' }

export async function salvaProfilo(dati: DatiProfilo): Promise<RisultatoSalvaProfilo> {
  const nome = dati.nome.trim()
  const cognome = dati.cognome.trim()
  const dataNascita = dati.dataNascita.trim()
  const codiceIstat = dati.codiceIstat.trim()

  const testiValidi = [nome, cognome].every((v) => v.length <= LUNGHEZZA_MASSIMA_CAMPO_PROFILO)
  const dataValida = dataNascita === '' || partiDataIso(dataNascita) !== null
  if (!testiValidi || !dataValida) return { errore: 'datiNonValidi' }

  const supabase = await createClient()

  // Città, provincia e regione non arrivano dal client: si rileggono dalla
  // tabella dei comuni, così non si possono salvare combinazioni inventate.
  let citta = ''
  let provincia = ''
  let regione = ''
  if (codiceIstat !== '') {
    const { data: comune } = await supabase
      .from('comuni')
      .select('nome, provincia, regione')
      .eq('codice_istat', codiceIstat)
      .maybeSingle()
    if (!comune) return { errore: 'datiNonValidi' }
    citta = comune.nome
    provincia = comune.provincia
    regione = comune.regione
  }

  const profilo: Profilo = { nome, cognome, dataNascita, codiceIstat, citta, provincia, regione }
  // updateUser unisce i metadati passati a quelli già presenti.
  const { error } = await supabase.auth.updateUser({ data: metadatiDaProfilo(profilo) })
  if (error) return { errore: 'salvataggio' }

  // Le iniziali nel menu principale vengono dal layout dell'app.
  revalidatePath('/', 'layout')
  return { successo: true }
}
