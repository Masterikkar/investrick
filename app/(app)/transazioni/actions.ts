'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const CATEGORIE_VALIDE = ['Azioni', 'Obbligazioni', 'Materie prime', 'Crypto', 'Multiasset']

export async function aggiungiTransazione(formData: FormData) {
  const supabase = await createClient()

  const strumentoId = formData.get('strumento_id') as string
  const categoriaManuale = formData.get('categoria_manuale') as string
  const contenitoreId = formData.get('contenitore_id') as string
  const operazione = formData.get('operazione') as string
  const data = formData.get('data') as string
  const quantita = Number(formData.get('quantita'))
  const prezzoUnitario = Number(formData.get('prezzo_unitario'))
  const commissione = Number(formData.get('commissione') || 0)
  const tassaTrattenuta = Number(formData.get('tassa_trattenuta') || 0)

  let categoria: string
  let strumentoIdFinale: string | null

  if (operazione === 'Costo_contanti') {
    if (strumentoId) {
      // Costo in contanti richiede strumento vuoto (vincolo DB transazioni_strumento_coerente)
      redirect('/transazioni?errore=1')
    }
    if (!CATEGORIE_VALIDE.includes(categoriaManuale)) {
      redirect('/transazioni?errore=1')
    }
    categoria = categoriaManuale
    strumentoIdFinale = null
  } else {
    if (!strumentoId) {
      redirect('/transazioni?errore=1')
    }

    const { data: strumento, error: erroreStrumento } = await supabase
      .from('strumenti')
      .select('categoria')
      .eq('id', strumentoId)
      .single()

    if (erroreStrumento || !strumento) {
      redirect('/transazioni?errore=1')
    }

    categoria = strumento.categoria
    strumentoIdFinale = strumentoId
  }

  const { error } = await supabase.from('transazioni').insert({
    strumento_id: strumentoIdFinale,
    contenitore_id: contenitoreId === 'diretto' ? null : contenitoreId,
    categoria,
    operazione,
    data,
    valuta: 'EUR',
    quantita,
    prezzo_unitario: prezzoUnitario,
    commissione,
    tassa_trattenuta: tassaTrattenuta,
  })

  if (error) {
    redirect('/transazioni?errore=1')
  }

  revalidatePath('/')
  revalidatePath('/transazioni')
  redirect('/transazioni?successo=1')
}