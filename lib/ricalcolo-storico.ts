import type { createClient } from '@/lib/supabase/server'

type ClientSupabase = Awaited<ReturnType<typeof createClient>>

// Ricalcolo dello storico valorizzazioni (tabella storico_valorizzazioni, che
// alimenta grafici e rendimenti) dopo una modifica a transazioni o movimenti.
//
// Si ricalcola solo ciò che la modifica tocca: lo strumento (o il conto) nel
// suo gruppo, dalla data della modifica in poi. Il motivo e la prova che il
// risultato è identico al ricalcolo completo sono in
// sql/applicati/2026-10-02-ricalcolo-storico-incrementale.sql. Il ricalcolo
// completo serve solo dopo un import massivo o l'eliminazione di un gruppo, e
// si fa un gruppo alla volta: ogni richiesta al database è interrotta dopo 8
// secondi, e un ricalcolo unico di tutto lo storico ci si avvicina.
//
// Le funzioni non lanciano eccezioni: restituiscono { errore } se qualcosa non
// riesce, così chi chiama può dire "salvato, ma lo storico non si è aggiornato"
// invece di un errore generico che invita a ripetere un'operazione già riuscita.

export type EsitoRicalcoloStorico = { errore: string } | null

export type PosizioneDaRicalcolare = {
  // null = posizione diretta, senza gruppo
  contenitoreId: string | null
  // null = nessuno strumento (es. Costo in contanti): non ha righe di storico
  strumentoId: string | null
  // YYYY-MM-DD: si ricalcola da questa data in poi
  daData: string
}

async function pulisciStorico(supabase: ClientSupabase): Promise<EsitoRicalcoloStorico> {
  const { error } = await supabase.rpc('pulisci_storico_valorizzazioni')
  return error ? { errore: error.message } : null
}

// Per una singola modifica: elenca le posizioni (strumento + gruppo) toccate,
// ognuna con la data da cui ricalcolare. Se una modifica sposta qualcosa da un
// gruppo a un altro, vanno indicate entrambe le posizioni.
export async function ricalcolaStoricoPosizioni(
  supabase: ClientSupabase,
  posizioni: PosizioneDaRicalcolare[]
): Promise<EsitoRicalcoloStorico> {
  // Una sola chiamata per posizione, dalla data più vecchia tra quelle indicate
  // (le date YYYY-MM-DD si confrontano come stringhe).
  const daRicalcolare = new Map<string, { contenitoreId: string | null; strumentoId: string; daData: string }>()
  for (const p of posizioni) {
    if (!p.strumentoId) continue
    const chiave = `${p.contenitoreId ?? ''}|${p.strumentoId}`
    const esistente = daRicalcolare.get(chiave)
    if (!esistente || p.daData < esistente.daData) {
      daRicalcolare.set(chiave, { contenitoreId: p.contenitoreId, strumentoId: p.strumentoId, daData: p.daData })
    }
  }

  // Nessuna posizione con strumento (es. solo un Costo in contanti): non c'è storico da toccare.
  if (daRicalcolare.size === 0) return null

  for (const p of daRicalcolare.values()) {
    const { error } = await supabase.rpc('ricostruisci_storico_gruppo', {
      // Se omesso, la funzione ricalcola le posizioni dirette.
      ...(p.contenitoreId ? { p_contenitore_id: p.contenitoreId } : {}),
      p_strumento_id: p.strumentoId,
      p_da_data: p.daData,
    })
    if (error) return { errore: error.message }
  }

  return pulisciStorico(supabase)
}

// Per import massivi ed eliminazione di un gruppo: tutti i gruppi, uno alla volta.
export async function ricalcolaStoricoCompleto(supabase: ClientSupabase): Promise<EsitoRicalcoloStorico> {
  const { data: gruppi, error: erroreGruppi } = await supabase.from('contenitori').select('id')
  if (erroreGruppi) return { errore: erroreGruppi.message }

  // null = le posizioni dirette, senza gruppo
  for (const id of [null, ...(gruppi ?? []).map((g) => g.id)]) {
    const { error } = await supabase.rpc('ricostruisci_storico_gruppo', id ? { p_contenitore_id: id } : {})
    if (error) return { errore: error.message }
  }

  return pulisciStorico(supabase)
}
