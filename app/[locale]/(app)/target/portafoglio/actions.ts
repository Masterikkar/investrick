'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { CATEGORIE } from '@/lib/categorie'

// Stessa conversione di /target/[contenitoreId]: vuoto = 0, altrimenti un
// numero finito tra 0 e 100, null se non valido (un NaN aggirerebbe il
// controllo sulla somma).
function parsePercentuale(raw: string | null): number | null {
  if (raw === null || raw === '') return 0
  const valore = Number(raw)
  if (!Number.isFinite(valore) || valore < 0 || valore > 100) return null
  return valore
}

// Target sull'intero portafoglio: le righe di target_allocazioni con
// contenitore_id nullo, una per categoria (Liquidità compresa). Non c'è un
// interruttore "target attivo" come per i contenitori: le percentuali devono
// sommare a 100, oppure essere tutte 0 per non avere nessun target sul
// portafoglio. Come per i contenitori, una categoria a 0 resta con attivo =
// false, cioè nessun vincolo, non "zero forzato".
export async function salvaTargetPortafoglio(formData: FormData) {
  const supabase = await createClient()
  const locale = await getLocale()

  const percentuali: Record<string, number> = {}
  for (const cat of CATEGORIE) {
    const valore = parsePercentuale(formData.get(`percentuale_${cat}`) as string | null)
    if (valore === null) {
      redirect({ href: '/target/portafoglio?errore=1', locale })
      return
    }
    percentuali[cat] = valore
  }

  const somma = CATEGORIE.reduce((acc, cat) => acc + percentuali[cat], 0)
  if (somma !== 0 && Math.abs(somma - 100) > 0.01) {
    redirect({ href: '/target/portafoglio?errore=somma', locale })
  }

  // Niente upsert: l'unicità delle righe di portafoglio è un indice parziale
  // (user_id, categoria) WHERE contenitore_id IS NULL, che ON CONFLICT senza
  // predicato non riconosce. Si aggiorna la riga esistente per id, o se ne
  // inserisce una nuova.
  const { data: esistenti, error: erroreLettura } = await supabase
    .from('target_allocazioni')
    .select('id, categoria')
    .is('contenitore_id', null)

  if (erroreLettura) {
    redirect({ href: '/target/portafoglio?errore=1', locale })
  }

  const idPerCategoria = new Map((esistenti ?? []).map((r) => [r.categoria, r.id]))

  for (const cat of CATEGORIE) {
    const valore = percentuali[cat]
    const id = idPerCategoria.get(cat)

    if (id) {
      const { error } = await supabase
        .from('target_allocazioni')
        .update({ target_percentuale: valore, attivo: valore > 0 })
        .eq('id', id)
      if (error) redirect({ href: '/target/portafoglio?errore=1', locale })
    } else if (valore > 0) {
      const { error } = await supabase
        .from('target_allocazioni')
        .insert({ contenitore_id: null, categoria: cat, target_percentuale: valore, attivo: true })
      if (error) redirect({ href: '/target/portafoglio?errore=1', locale })
    }
  }

  revalidatePath('/', 'layout')
  redirect({ href: '/ribilanciamento', locale })
}
