'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const CATEGORIE = ['Azioni', 'Obbligazioni', 'Materie prime', 'Crypto', 'Multiasset'] as const

export async function salvaTarget(formData: FormData) {
  const supabase = await createClient()

  const contenitoreId = formData.get('contenitore_id') as string
  const targetAttivo = formData.get('target_attivo') === 'on'

  const percentuali: Record<string, number> = {}
  for (const cat of CATEGORIE) {
    const raw = formData.get(`percentuale_${cat}`) as string
    percentuali[cat] = raw ? Number(raw) : 0
  }

  const somma = CATEGORIE.reduce((acc, cat) => acc + percentuali[cat], 0)

  if (targetAttivo && Math.abs(somma - 100) > 0.01) {
    redirect(`/target/${contenitoreId}?errore=somma`)
  }

  const { data: contenitore, error: erroreContenitore } = await supabase
    .from('contenitori')
    .update({ target_attivo: targetAttivo })
    .eq('id', contenitoreId)
    .select('tipo')
    .single()

  if (erroreContenitore || !contenitore) {
    redirect(`/target/${contenitoreId}?errore=1`)
  }

  for (const cat of CATEGORIE) {
    const valore = percentuali[cat]
    const { error } = await supabase.from('target_allocazioni').upsert(
      {
        contenitore_id: contenitoreId,
        categoria: cat,
        target_percentuale: valore,
        attivo: valore > 0,
      },
      { onConflict: 'contenitore_id,categoria' }
    )

    if (error) {
      redirect(`/target/${contenitoreId}?errore=1`)
    }
  }

  const destinazione = contenitore.tipo === 'Polizza' ? '/polizze' : '/pac'
  redirect(destinazione)
}