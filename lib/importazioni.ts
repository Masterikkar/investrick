import type { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database.types'

type ClientSupabase = Awaited<ReturnType<typeof createClient>>

export type ErroreRigaImport = { riga: number; messaggio: string }

// Dati del file che il client manda insieme alle righe da inserire: le righe
// scartate già in lettura (formato non valido, strumento non riconosciuto) non
// arrivano al server, ma vanno contate nel registro dell'import.
export type FileImport = {
  nomeFile: string
  righeTotali: number
  scartate: ErroreRigaImport[]
}

/**
 * Registra un import Excel in importazioni e ne esegue l'inserimento:
 * 1. crea una riga in importazioni (stato 'in_elaborazione');
 * 2. chiama inserisci con il suo id, da assegnare a importazione_id di ogni
 *    riga inserita;
 * 3. aggiorna righe_importate, righe_errore (scartate in lettura più fallite
 *    all'inserimento), dettaglio_errori e lo stato finale.
 * Se la riga di registro non si crea, non si inserisce nulla.
 */
export async function eseguiImportazione(
  supabase: ClientSupabase,
  file: FileImport,
  categoria: string | null,
  inserisci: (importazioneId: string) => Promise<{ inserite: number; errori: ErroreRigaImport[] }>
): Promise<{ inserite: number; errori: ErroreRigaImport[] } | { erroreRegistro: string }> {
  const { data: importazione, error: erroreApertura } = await supabase
    .from('importazioni')
    .insert({
      nome_file: file.nomeFile,
      righe_totali: file.righeTotali,
      stato: 'in_elaborazione',
      categoria,
    })
    .select('id')
    .single()

  if (erroreApertura || !importazione) {
    return { erroreRegistro: erroreApertura?.message ?? 'importazioni' }
  }

  let esito: { inserite: number; errori: ErroreRigaImport[] }
  try {
    esito = await inserisci(importazione.id)
  } catch (e) {
    await supabase
      .from('importazioni')
      .update({ stato: 'errore', dettaglio_errori: { eccezione: String(e) } })
      .eq('id', importazione.id)
    throw e
  }

  const tuttiGliErrori = [...file.scartate, ...esito.errori].sort((a, b) => a.riga - b.riga)
  const stato = esito.inserite === 0 ? 'errore' : tuttiGliErrori.length > 0 ? 'completato_con_errori' : 'completato'

  await supabase
    .from('importazioni')
    .update({
      righe_importate: esito.inserite,
      righe_errore: tuttiGliErrori.length,
      dettaglio_errori: tuttiGliErrori.length > 0 ? (tuttiGliErrori as unknown as Json) : null,
      stato,
    })
    .eq('id', importazione.id)

  return esito
}
