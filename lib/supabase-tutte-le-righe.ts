import type { PostgrestError } from '@supabase/supabase-js'

// PostgREST restituisce al massimo max_rows righe per richiesta (1000 in
// supabase/config.toml) e, quando tronca, non segnala nessun errore: la query
// sembra riuscita ma mancano le righe oltre il limite. Questa funzione legge
// una query a blocchi con .range() finché non arriva un blocco vuoto.
//
// - query riceve gli estremi (inclusi) del blocco e deve restituire una query
//   nuova a ogni chiamata, con .range(da, a) applicato: un builder Supabase
//   non si può riusare dopo averlo eseguito.
// - La query DEVE avere un ordinamento univoco (es. data, poi categoria):
//   con parità nell'ordinamento, blocchi diversi potrebbero ripetere o saltare
//   righe.
// - Ci si ferma solo su un blocco vuoto, non su un blocco "corto", e si avanza
//   di quante righe sono arrivate davvero: così il risultato resta completo
//   anche se il limite del server fosse più basso di DIMENSIONE_BLOCCO. Il costo
//   è una richiesta in più, vuota, alla fine.
// - In caso di errore su un blocco restituisce data: null, come un .select()
//   fallito, mai un risultato parziale.
const DIMENSIONE_BLOCCO = 1000

export async function tutteLeRighe<T>(
  query: (da: number, a: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<{ data: T[] | null; error: PostgrestError | null }> {
  const righe: T[] = []
  for (;;) {
    const { data, error } = await query(righe.length, righe.length + DIMENSIONE_BLOCCO - 1)
    if (error) return { data: null, error }
    if (!data || data.length === 0) return { data: righe, error: null }
    righe.push(...data)
  }
}
