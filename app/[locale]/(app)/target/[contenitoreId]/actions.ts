'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'
import { categorieTarget, strumentiDelGruppo } from './gruppo-target'

// Converte un valore percentuale ricevuto dal form: vuoto = 0 (nessun target
// per quella categoria/strumento), qualunque altra cosa deve essere un
// numero finito tra 0 e 100. Ritorna null se non valido — un valore non
// numerico (es. campo manomesso con testo) produrrebbe altrimenti NaN, e
// NaN supera silenziosamente il controllo "somma diversa da 100" più sotto
// (ogni confronto con NaN restituisce false), aggirando la convalida.
function parsePercentuale(raw: string | null): number | null {
  if (raw === null || raw === '') return 0
  const valore = Number(raw)
  if (!Number.isFinite(valore) || valore < 0 || valore > 100) return null
  return valore
}

export async function salvaTarget(formData: FormData) {
  const supabase = await createClient()
  const locale = await getLocale()

  const contenitoreId = (formData.get('contenitore_id') as string) || ''
  const targetAttivo = formData.get('target_attivo') === 'on'

  if (!contenitoreId) {
    redirect({ href: '/investment-plans', locale })
  }

  // Verifica che il contenitore esista davvero (invece di affidarsi
  // implicitamente a un vincolo di chiave esterna nel database), e ne
  // recupera già il "tipo" per il reindirizzamento finale — evita una
  // seconda query identica in fondo alla funzione.
  const { data: contenitoreEsistente, error: erroreVerificaContenitore } = await supabase
    .from('contenitori')
    .select('id, tipo')
    .eq('id', contenitoreId)
    .single()

  if (erroreVerificaContenitore || !contenitoreEsistente) {
    redirect({ href: '/investment-plans', locale })
    return
  }

  const categorie = categorieTarget(contenitoreEsistente.tipo)
  const percentuali: Record<string, number> = {}
  for (const cat of categorie) {
    const valore = parsePercentuale(formData.get(`percentuale_${cat}`) as string | null)
    if (valore === null) {
      redirect({ href: `/target/${contenitoreId}?errore=1`, locale })
      return
    }
    percentuali[cat] = valore
  }

  const somma = categorie.reduce((acc, cat) => acc + percentuali[cat], 0)

  if (targetAttivo && Math.abs(somma - 100) > 0.01) {
    redirect({ href: `/target/${contenitoreId}?errore=somma`, locale })
  }

  const strumentiInfo = await strumentiDelGruppo(supabase, contenitoreId, contenitoreEsistente.tipo)

  const strumentiPerCategoria: Record<string, string[]> = {}
  for (const s of strumentiInfo) {
    if (!strumentiPerCategoria[s.categoria]) strumentiPerCategoria[s.categoria] = []
    strumentiPerCategoria[s.categoria].push(s.id)
  }

  const upsertSottotarget: { strumento_id: string; target_percentuale_categoria: number }[] = []
  const eliminaSottotarget: string[] = []

  for (const cat of Object.keys(strumentiPerCategoria)) {
    const idsCategoria = strumentiPerCategoria[cat]
    if (idsCategoria.length <= 1) continue

    const valori: { id: string; valore: number }[] = []
    for (const id of idsCategoria) {
      const valore = parsePercentuale(formData.get(`sub_${id}`) as string | null)
      if (valore === null) {
        redirect({ href: `/target/${contenitoreId}?errore=1`, locale })
        return
      }
      valori.push({ id, valore })
    }
    const sommaCategoria = valori.reduce((acc, v) => acc + v.valore, 0)

    if (sommaCategoria === 0) {
      eliminaSottotarget.push(...idsCategoria)
      continue
    }

    if (Math.abs(sommaCategoria - 100) > 0.01) {
      redirect({
        href: `/target/${contenitoreId}?errore=somma_strumento&erroreCategoria=${encodeURIComponent(cat)}`,
        locale,
      })
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
    redirect({ href: `/target/${contenitoreId}?errore=1`, locale })
  }

  for (const cat of categorie) {
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
      redirect({ href: `/target/${contenitoreId}?errore=1`, locale })
    }
  }

  if (eliminaSottotarget.length > 0) {
    const { error } = await supabase
      .from('target_allocazioni_strumento')
      .delete()
      .eq('contenitore_id', contenitoreId)
      .in('strumento_id', eliminaSottotarget)
    if (error) {
      redirect({ href: `/target/${contenitoreId}?errore=1`, locale })
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
      redirect({ href: `/target/${contenitoreId}?errore=1`, locale })
    }
  }

  const destinazione =
    contenitoreEsistente.tipo === 'Polizza'
      ? '/insurance-policies'
      : contenitoreEsistente.tipo === 'Personalizzato'
        ? '/personalizzati'
        : '/investment-plans'
  redirect({ href: destinazione, locale })
}