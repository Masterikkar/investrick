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

  const { data: posizioni } = await supabase
    .from('v_riepilogo_posizione')
    .select('strumento_id, quantita_posseduta')
    .eq('contenitore_id', contenitoreId)

  const strumentoIdsPosseduti = (posizioni ?? [])
    .filter((p) => Number(p.quantita_posseduta) > 0)
    .map((p) => p.strumento_id)
    .filter((id): id is string => id !== null)

  const { data: strumentiInfo } = strumentoIdsPosseduti.length
    ? await supabase.from('strumenti').select('id, categoria').in('id', strumentoIdsPosseduti)
    : { data: null }

  const strumentiPerCategoria: Record<string, string[]> = {}
  for (const s of strumentiInfo ?? []) {
    if (!strumentiPerCategoria[s.categoria]) strumentiPerCategoria[s.categoria] = []
    strumentiPerCategoria[s.categoria].push(s.id)
  }

  const upsertSottotarget: { strumento_id: string; target_percentuale_categoria: number }[] = []
  const eliminaSottotarget: string[] = []

  for (const cat of Object.keys(strumentiPerCategoria)) {
    const idsCategoria = strumentiPerCategoria[cat]
    if (idsCategoria.length <= 1) continue

    const valori = idsCategoria.map((id) => {
      const raw = formData.get(`sub_${id}`) as string | null
      return { id, valore: raw ? Number(raw) : 0 }
    })
    const sommaCategoria = valori.reduce((acc, v) => acc + v.valore, 0)

    if (sommaCategoria === 0) {
      eliminaSottotarget.push(...idsCategoria)
      continue
    }

    if (Math.abs(sommaCategoria - 100) > 0.01) {
      redirect(`/target/${contenitoreId}?errore=somma_strumento&erroreCategoria=${encodeURIComponent(cat)}`)
    }

    for (const v of valori) {
      upsertSottotarget.push({ strumento_id: v.id, target_percentuale_categoria: v.valore })
    }
  }

  const { error: erroreContenitore } = await supabase
    .from('contenitori')
    .update({ target_attivo: targetAttivo })
    .eq('id', contenitoreId)

  if (erroreContenitore) {
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

  if (eliminaSottotarget.length > 0) {
    const { error } = await supabase
      .from('target_allocazioni_strumento')
      .delete()
      .eq('contenitore_id', contenitoreId)
      .in('strumento_id', eliminaSottotarget)
    if (error) {
      redirect(`/target/${contenitoreId}?errore=1`)
    }
  }

  if (upsertSottotarget.length > 0) {
    const { error } = await supabase.from('target_allocazioni_strumento').upsert(
      upsertSottotarget.map((v) => ({
        contenitore_id: contenitoreId,
        strumento_id: v.strumento_id,
        target_percentuale_categoria: v.target_percentuale_categoria,
      })),
      { onConflict: 'contenitore_id,strumento_id' }
    )
    if (error) {
      redirect(`/target/${contenitoreId}?errore=1`)
    }
  }

  const { data: contenitore } = await supabase.from('contenitori').select('tipo').eq('id', contenitoreId).maybeSingle()
  const destinazione = contenitore?.tipo === 'Polizza' ? '/polizze' : '/pac'
  redirect(destinazione)
}