'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function aggiungiTransazione(formData: FormData) {
  const supabase = await createClient()

  const strumentoId = formData.get('strumento_id') as string
  const contenitoreId = formData.get('contenitore_id') as string
  const operazione = formData.get('operazione') as string
  const data = formData.get('data') as string
  const quantita = Number(formData.get('quantita'))
  const prezzoUnitario = Number(formData.get('prezzo_unitario'))
  const commissione = Number(formData.get('commissione') || 0)
  const tassaTrattenuta = Number(formData.get('tassa_trattenuta') || 0)

  const { data: strumento, error: erroreStrumento } = await supabase
    .from('strumenti')
    .select('categoria')
    .eq('id', strumentoId)
    .single()

  if (erroreStrumento || !strumento) {
    redirect('/transazioni?errore=1')
  }

  const { error } = await supabase.from('transazioni').insert({
    strumento_id: strumentoId,
    contenitore_id: contenitoreId === 'diretto' ? null : contenitoreId,
    categoria: strumento.categoria,
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