import { createClient } from '@/lib/supabase/server'
import { formatEuro } from '@/lib/format'

export default async function LiquiditaPage() {
  const supabase = await createClient()

  const { data: liquidita } = await supabase
    .from('v_valore_per_contenitore')
    .select('contenitore_id, nome, valore_totale')
    .eq('tipo', 'Liquidita')
    .maybeSingle()

  const contenitoreId = liquidita?.contenitore_id
  const valoreTotale = liquidita?.valore_totale ?? 0

  const { data: saldi } = contenitoreId
    ? await supabase
        .from('v_saldo_liquidita')
        .select('strumento_id, saldo_corrente')
        .eq('contenitore_id', contenitoreId)
    : { data: null }

  const strumentoIds = saldi?.map((s) => s.strumento_id) ?? []

  const { data: strumenti } = strumentoIds.length
    ? await supabase
        .from('strumenti')
        .select('id, nome, tipo, provider, tasso_percentuale')
        .in('id', strumentoIds)
    : { data: null }

  const { data: costi } = contenitoreId
    ? await supabase
        .from('v_costo_liquidita')
        .select('strumento_id, costo_totale')
        .eq('contenitore_id', contenitoreId)
    : { data: null }

  const { data: interessi } = contenitoreId
    ? await supabase
        .from('v_interessi_liquidita')
        .select('strumento_id, interessi_totali')
        .eq('contenitore_id', contenitoreId)
    : { data: null }

  const righe = (saldi ?? [])
    .map((s) => {
      const strumento = strumenti?.find((str) => str.id === s.strumento_id)
      const costo = costi?.find((c) => c.strumento_id === s.strumento_id)
      const interesse = interessi?.find((i) => i.strumento_id === s.strumento_id)
      return {
        strumentoId: s.strumento_id,
        nome: strumento?.nome ?? '—',
        tipo: strumento?.tipo ?? '—',
        provider: strumento?.provider ?? '',
        valore: s.saldo_corrente ?? 0,
        tasso: strumento?.tasso_percentuale ?? 0,
        interessi: interesse?.interessi_totali ?? 0,
        costo: costo?.costo_totale ?? 0,
      }
    })
    .sort((a, b) => b.valore - a.valore)

  return (
    <div>
      <div style={{ fontSize: 13, color: '#666' }}>Contenitore</div>
      <h1 style={{ fontSize: 20, marginTop: 4, marginBottom: 16 }}>
        {liquidita?.nome ?? 'Liquidità'}
      </h1>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 48, margin: 0 }}>
        {formatEuro(valoreTotale)}
      </p>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Strumenti</h2>
        {righe.length === 0 ? (
          <p style={{ color: '#666' }}>Nessuno strumento registrato.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th style={{ padding: '8px 12px' }}>Strumento</th>
                <th style={{ padding: '8px 12px' }}>Tipo</th>
                <th style={{ padding: '8px 12px' }}>Provider</th>
                <th style={{ padding: '8px 12px' }}>Valore</th>
                <th style={{ padding: '8px 12px' }}>Tasso</th>
                <th style={{ padding: '8px 12px' }}>Interessi</th>
                <th style={{ padding: '8px 12px' }}>Costo</th>
              </tr>
            </thead>
            <tbody>
              {righe.map((r) => (
                <tr key={r.strumentoId} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px 12px' }}>{r.nome}</td>
                  <td style={{ padding: '8px 12px' }}>{r.tipo}</td>
                  <td style={{ padding: '8px 12px' }}>{r.provider}</td>
                  <td style={{ padding: '8px 12px' }}>{formatEuro(r.valore)}</td>
                  <td style={{ padding: '8px 12px' }}>{r.tasso.toFixed(2)}%</td>
                  <td style={{ padding: '8px 12px' }}>{formatEuro(r.interessi)}</td>
                  <td style={{ padding: '8px 12px' }}>{formatEuro(r.costo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}