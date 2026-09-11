import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FormTarget } from './form-target'

const CATEGORIE = ['Azioni', 'Obbligazioni', 'Materie prime', 'Crypto', 'Multiasset'] as const

export default async function TargetPage({
  params,
  searchParams,
}: {
  params: Promise<{ contenitoreId: string }>
  searchParams: Promise<{ errore?: string }>
}) {
  const { contenitoreId } = await params
  const { errore } = await searchParams
  const supabase = await createClient()

  const { data: contenitore } = await supabase
    .from('contenitori')
    .select('id, nome, tipo, target_attivo')
    .eq('id', contenitoreId)
    .maybeSingle()

  if (!contenitore) {
    notFound()
  }

  const { data: targetRaw } = await supabase
    .from('target_allocazioni')
    .select('categoria, target_percentuale, attivo')
    .eq('contenitore_id', contenitoreId)

  const percentualiIniziali: Record<string, number> = {}
  for (const cat of CATEGORIE) {
    const riga = targetRaw?.find((t) => t.categoria === cat)
    percentualiIniziali[cat] = riga?.attivo ? Number(riga.target_percentuale) : 0
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: '#666' }}>{contenitore.tipo}</div>
      <h1 style={{ fontSize: 20, marginTop: 4, marginBottom: 24 }}>Target — {contenitore.nome}</h1>

      {errore === 'somma' && (
        <p style={{ color: 'red', marginBottom: 16 }}>
          Con il target attivo, le percentuali devono sommare a 100. Controlla i valori e riprova.
        </p>
      )}
      {errore === '1' && (
        <p style={{ color: 'red', marginBottom: 16 }}>Qualcosa è andato storto, riprova.</p>
      )}

      <FormTarget
        contenitoreId={contenitore.id}
        targetAttivoIniziale={contenitore.target_attivo ?? false}
        percentualiIniziali={percentualiIniziali}
      />
    </div>
  )
}