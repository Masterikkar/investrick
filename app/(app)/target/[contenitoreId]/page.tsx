import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FormTarget } from './form-target'
import { Sezione } from '@/components/sezione'
import { Breadcrumb } from '@/components/breadcrumb'

const CATEGORIE = ['Azioni', 'Obbligazioni', 'Materie prime', 'Monetario', 'Crypto', 'Multiasset'] as const

type StrumentoConPeso = { id: string; nome: string; ticker: string | null; percentualeIniziale: number }

export default async function TargetPage({
  params,
  searchParams,
}: {
  params: Promise<{ contenitoreId: string }>
  searchParams: Promise<{ errore?: string; erroreCategoria?: string }>
}) {
  const { contenitoreId } = await params
  const { errore, erroreCategoria } = await searchParams
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

  const { data: posizioni } = await supabase
    .from('v_riepilogo_posizione')
    .select('strumento_id, quantita_posseduta')
    .eq('contenitore_id', contenitoreId)

  const strumentoIdsPosseduti = (posizioni ?? [])
    .filter((p) => Number(p.quantita_posseduta) > 0)
    .map((p) => p.strumento_id)
    .filter((id): id is string => id !== null)

  const { data: strumentiInfo } = strumentoIdsPosseduti.length
    ? await supabase
        .from('strumenti')
        .select('id, nome, ticker, categoria')
        .in('id', strumentoIdsPosseduti)
    : { data: null }

  const { data: subTargetRaw } = await supabase
    .from('target_allocazioni_strumento')
    .select('strumento_id, target_percentuale_categoria')
    .eq('contenitore_id', contenitoreId)

  const subTargetMap = new Map(
    (subTargetRaw ?? []).map((t) => [t.strumento_id, Number(t.target_percentuale_categoria)])
  )

  const strumentiPerCategoria: Record<string, StrumentoConPeso[]> = {}
  for (const s of strumentiInfo ?? []) {
    if (!strumentiPerCategoria[s.categoria]) strumentiPerCategoria[s.categoria] = []
    strumentiPerCategoria[s.categoria].push({
      id: s.id,
      nome: s.nome,
      ticker: s.ticker,
      percentualeIniziale: subTargetMap.get(s.id) ?? 0,
    })
  }
  for (const cat of Object.keys(strumentiPerCategoria)) {
    if (strumentiPerCategoria[cat].length <= 1) delete strumentiPerCategoria[cat]
  }

  return (
    <div>
      <Breadcrumb />

      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)', marginTop: 12 }}>
        {contenitore.tipo}
      </div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>
        Target — {contenitore.nome}
      </h1>

      {errore === 'somma' && (
        <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-body)', marginBottom: 16 }}>
          Con il target attivo, le percentuali delle categorie devono sommare a 100. Controlla i valori e riprova.
        </p>
      )}
      {errore === 'somma_strumento' && (
        <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-body)', marginBottom: 16 }}>
          {erroreCategoria
            ? `In "${decodeURIComponent(erroreCategoria)}" le percentuali per singolo strumento non sommano a 100. Compilale tutte fino a 100, oppure lasciale tutte a 0.`
            : 'Le percentuali per singolo strumento in una categoria non sommano a 100.'}
        </p>
      )}
      {errore === '1' && (
        <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-body)', marginBottom: 16 }}>
          Qualcosa è andato storto, riprova.
        </p>
      )}

      <Sezione>
        <FormTarget
          contenitoreId={contenitore.id}
          targetAttivoIniziale={contenitore.target_attivo ?? false}
          percentualiIniziali={percentualiIniziali}
          strumentiPerCategoria={strumentiPerCategoria}
        />
      </Sezione>
    </div>
  )
}