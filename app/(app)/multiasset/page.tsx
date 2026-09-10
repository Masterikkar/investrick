import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatEuro } from '@/lib/format'

const CATEGORIA = 'Multiasset'

export default async function MultiassetPage() {
  const supabase = await createClient()

  const { data: categoriaValore } = await supabase
    .from('v_valore_per_categoria')
    .select('categoria, valore_totale')
    .eq('categoria', CATEGORIA)
    .maybeSingle()

  const valoreTotaleCategoria = categoriaValore?.valore_totale ?? 0

  const { data: strumentiCategoria } = await supabase
    .from('strumenti')
    .select('id, nome, tipo')
    .eq('categoria', CATEGORIA)

  const strumentoIds = strumentiCategoria?.map((s) => s.id) ?? []

  const { data: posizioni } = strumentoIds.length
    ? await supabase
        .from('v_riepilogo_posizione')
        .select(
          'strumento_id, contenitore_id, valore, rendimento_pct, capitale_investito, prezzo_medio_unitario, prezzo_attuale'
        )
        .in('strumento_id', strumentoIds)
    : { data: null }

  const { data: costi } = strumentoIds.length
    ? await supabase
        .from('v_costo_per_strumento')
        .select('strumento_id, contenitore_id, costo_totale')
        .in('strumento_id', strumentoIds)
    : { data: null }

  const contenitoreIds = Array.from(
    new Set(
      (posizioni ?? [])
        .map((p) => p.contenitore_id)
        .filter((id): id is string => id !== null)
    )
  )

  const { data: contenitori } = contenitoreIds.length
    ? await supabase.from('contenitori').select('id, nome').in('id', contenitoreIds)
    : { data: null }

  const righe = (posizioni ?? [])
    .map((p) => {
      const strumento = strumentiCategoria?.find((s) => s.id === p.strumento_id)
      const costo = costi?.find(
        (c) => c.strumento_id === p.strumento_id && c.contenitore_id === p.contenitore_id
      )
      const contenitore = p.contenitore_id
        ? contenitori?.find((c) => c.id === p.contenitore_id)
        : null
      return {
        key: `${p.strumento_id}-${p.contenitore_id ?? 'diretto'}`,
        strumentoId: p.strumento_id,
        nome: strumento?.nome ?? '—',
        tipo: strumento?.tipo ?? '—',
        rendimentoPct: p.rendimento_pct ?? 0,
        rendimentoAssoluto: (p.valore ?? 0) - (p.capitale_investito ?? 0),
        valore: p.valore ?? 0,
        peso: valoreTotaleCategoria > 0 ? ((p.valore ?? 0) / valoreTotaleCategoria) * 100 : 0,
        nav: p.prezzo_attuale ?? 0,
        prezzoMedioUnitario: p.prezzo_medio_unitario ?? 0,
        costo: costo?.costo_totale ?? 0,
        provenienza: contenitore?.nome ?? 'Diretto',
      }
    })
    .sort((a, b) => b.valore - a.valore)

  return (
    <div>
      <div style={{ fontSize: 13, color: '#666' }}>Categoria</div>
      <h1 style={{ fontSize: 20, marginTop: 4, marginBottom: 16 }}>{CATEGORIA}</h1>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 48, margin: 0 }}>
        {formatEuro(valoreTotaleCategoria)}
      </p>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Asset</h2>
        {righe.length === 0 ? (
          <p style={{ color: '#666' }}>Nessun asset in questa categoria.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th style={{ padding: '8px 12px' }}>Strumento</th>
                <th style={{ padding: '8px 12px' }}>Tipo</th>
                <th style={{ padding: '8px 12px' }}>Rendimento</th>
                <th style={{ padding: '8px 12px' }}>Rendimento (€)</th>
                <th style={{ padding: '8px 12px' }}>Valore</th>
                <th style={{ padding: '8px 12px' }}>Peso</th>
                <th style={{ padding: '8px 12px' }}>NAV</th>
                <th style={{ padding: '8px 12px' }}>Prezzo medio</th>
                <th style={{ padding: '8px 12px' }}>Costo</th>
                <th style={{ padding: '8px 12px' }}>Provenienza</th>
              </tr>
            </thead>
            <tbody>
              {righe.map((r) => (
                <tr key={r.key} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <Link href={`/asset/${r.strumentoId}`} style={{ color: 'inherit', textDecoration: 'underline' }}>
                      {r.nome}
                    </Link>
                  </td>
                  <td style={{ padding: '8px 12px' }}>{r.tipo}</td>
                  <td
                    style={{
                      padding: '8px 12px',
                      color: r.rendimentoPct >= 0 ? '#0a7d2c' : '#c0392b',
                    }}
                  >
                    {r.rendimentoPct >= 0 ? '+' : ''}
                    {r.rendimentoPct.toFixed(2)}%
                  </td>
                  <td
                    style={{
                      padding: '8px 12px',
                      color: r.rendimentoAssoluto >= 0 ? '#0a7d2c' : '#c0392b',
                    }}
                  >
                    {r.rendimentoAssoluto >= 0 ? '+' : ''}
                    {formatEuro(r.rendimentoAssoluto)}
                  </td>
                  <td style={{ padding: '8px 12px' }}>{formatEuro(r.valore)}</td>
                  <td style={{ padding: '8px 12px' }}>{r.peso.toFixed(1)}%</td>
                  <td style={{ padding: '8px 12px' }}>{formatEuro(r.nav)}</td>
                  <td style={{ padding: '8px 12px' }}>{formatEuro(r.prezzoMedioUnitario)}</td>
                  <td style={{ padding: '8px 12px' }}>{formatEuro(r.costo)}</td>
                  <td style={{ padding: '8px 12px' }}>{r.provenienza}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}