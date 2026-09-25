import type { createClient } from '@/lib/supabase/server'

type ClientSupabase = Awaited<ReturnType<typeof createClient>>

// I gruppi che possono contenere transazioni e movimenti reali, da offrire
// come destinazione nei form e nelle tendine di riassegnazione: tutti tranne i
// Personalizzati, che sono solo di monitoraggio (il database lo impone con i
// trigger vincola_*_no_personalizzato).
export function leggiGruppiDestinazione(supabase: ClientSupabase) {
  return supabase.from('contenitori').select('id, nome, tipo').neq('tipo', 'Personalizzato').order('nome')
}
