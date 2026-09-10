import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatEuro } from '@/lib/format'

export default async function PacPage() {
  const supabase = await createClient()

  const { data: pac } = await supabase
    .from('v_valore_per_contenitore')
    .select('contenitore_id, nome, valore_totale')
    .eq('tipo', 'PAC')
    .maybeSingle()

  const contenitoreId = pac?.contenitore_id
  const valoreTotalePac = pac?.valore_totale ?? 0

  const { data: posizioni } = contenitoreId
    ? await supabase
        .from('v_riepilogo_posizione')
        .select(
          'strumento_id, valore, rendimento_pct, capitale_investito, prezzo_medio_unitario, prezzo_attuale'
        )
        .eq('contenitore_id', contenitoreId)
    : { data: null }

  const strumentoIds = posizioni?.map((p) => p.strumento_id) ?? []

  const { data: strumenti } = strumentoIds.length
    ? await supabase.from('strumenti').select('id, nome, tipo, categoria').in('id', strumentoIds)
    : { data: null }

  const { data: costi } = contenitoreId
    ? await supabase
        .from('v_costo_per_strumento')
        .select('strumento_id, costo_totale')
        .eq('contenitore_id', contenitoreId)
    : { data: null }

  const { data: contenitoreInfo } = contenitoreId
    ? await supabase.from('contenitori').select('target_attivo').eq('id', contenitoreId).maybeSingle()
    : { data: null }

  const { data: scostamenti } = contenitoreId && contenitoreInfo?.target_attivo
    ? await supabase.from('v_scostamento_target').select('*').eq('contenitore_id', contenitoreId)
    : { data: null }

  const { data: impostazioni } = await supabase
    .from('impostazioni_utente')
    .select('soglia_ribilanciamento_pp')
    .maybeSingle()

  const soglia = impostazioni?.soglia_ribilanciamento_pp ?? 3

  const ORDINE_CATEGORIE_PAC = ['Azioni', 'Obbligazioni', 'Materie prime', 'Crypto', 'Multiasset']
  const composizione = (scostamenti ?? [])
    .slice()
    .sort(
      (a, b) =>
        ORDINE_CATEGORIE_PAC.indexOf(a.categoria ?? '') - ORDINE_CATEGORIE_PAC.indexOf(b.categoria ?? '')
    )

  const righe = (posizioni ?? [])
    .map((p) => {
      const strumento = strumenti?.find((s) => s.id === p.strumento_id)
      const costo = costi?.find((c) => c.strumento_id === p.strumento_id)
      return {
        strumentoId: p.strumento_id,
        nome: strumento?.nome ?? '—',
        tipo: strumento?.tipo ?? '—',
        categoria: strumento?.categoria ?? '—',
        rendimentoPct: p.rendimento_pct ?? 0,
        rendimentoAssoluto: (p.valore ?? 0) - (p.capitale_investito ?? 0),
        valore: p.valore ?? 0,
        capitaleInvestito: p.capitale_investito ?? 0,
        nav: p.prezzo_attuale ?? 0,
        prezzoMedioUnitario: p.prezzo_medio_unitario ?? 0,
        peso: valoreTotalePac > 0 ? ((p.valore ?? 0) / valoreTotalePac) * 100 : 0,
        costo: costo?.costo_totale ?? 0,
      }
    })
    .sort((a, b) => b.valore - a.valore)

  const costoTotalePac = righe.reduce((acc, r) => acc + r.costo, 0)
  const valoreTotalePosizioni = righe.reduce((acc, r) => acc + r.valore, 0)
  const capitaleInvestitoTotale = righe.reduce((acc, r) => acc + r.capitaleInvestito, 0)
  const plusMinusNonRealizzata = valoreTotalePosizioni - capitaleInvestitoTotale

  return (
    <div>
      <div style={{ fontSize: 13, color: '#666' }}>PAC</div>
      <h1 style={{ fontSize: 20, marginTop: 4, marginBottom: 16 }}>{pac?.nome ?? '—'}</h1>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 48, margin: 0 }}>
        {formatEuro(valoreTotalePac)}
      </p>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Composizione vs target</h2>
        {!contenitoreInfo?.target_attivo ? (
          <p style={{ color: '#666' }}>Target disattivato per questo contenitore.</p>
        ) : composizione.length === 0 ? (
          <p style={{ color: '#666' }}>Nessun target impostato.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {composizione.map((c) => {
              const fuoriSoglia = Math.abs(c.scostamento_pp ?? 0) >= soglia
              const colore = fuoriSoglia ? '#e6a400' : '#0a7d2c'
              const pesoAttuale = Math.min(c.peso_attuale_pct ?? 0, 100)
              const target = Math.min(c.target_percentuale ?? 0, 100)
              return (
                <div key={c.categoria}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 14,
                      marginBottom: 4,
                    }}
                  >
                    <span>{c.categoria}</span>
                    <span>
                      {(c.peso_attuale_pct ?? 0).toFixed(1)}% attuale · {c.target_percentuale}% target (
                      {(c.scostamento_pp ?? 0) > 0 ? '+' : ''}
                      {c.scostamento_pp} pp)
                    </span>
                  </div>
                  <div style={{ position: 'relative', height: 10, background: '#eee', borderRadius: 4 }}>
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: '100%',
                        width: `${pesoAttuale}%`,
                        background: colore,
                        borderRadius: 4,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: -3,
                        left: `${target}%`,
                        width: 2,
                        height: 16,
                        background: '#333',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Strumenti</h2>
        {righe.length === 0 ? (
          <p style={{ color: '#666' }}>Nessuno strumento in portafoglio.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th style={{ padding: '8px 12px' }}>Strumento</th>
                <th style={{ padding: '8px 12px' }}>Tipo</th>
                <th style={{ padding: '8px 12px' }}>Categoria</th>
                <th style={{ padding: '8px 12px' }}>Rendimento</th>
                <th style={{ padding: '8px 12px' }}>Rendimento (€)</th>
                <th style={{ padding: '8px 12px' }}>Valore</th>
                <th style={{ padding: '8px 12px' }}>Peso</th>
                <th style={{ padding: '8px 12px' }}>NAV</th>
                <th style={{ padding: '8px 12px' }}>Prezzo medio</th>
                <th style={{ padding: '8px 12px' }}>Costo</th>
              </tr>
            </thead>
            <tbody>
              {righe.map((r) => (
                <tr key={r.strumentoId} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <Link href={`/asset/${r.strumentoId}`} style={{ color: 'inherit', textDecoration: 'underline' }}>
                      {r.nome}
                    </Link>
                  </td>
                  <td style={{ padding: '8px 12px' }}>{r.tipo}</td>
                  <td style={{ padding: '8px 12px' }}>{r.categoria}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: 32, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minWidth: 200 }}>
          <div style={{ fontSize: 13, color: '#666' }}>Costo totale</div>
          <div style={{ fontSize: 22, marginTop: 4 }}>{formatEuro(costoTotalePac)}</div>
          <Link href="/costi" style={{ fontSize: 13 }}>
            Vedi dettaglio costi →
          </Link>
        </div>

        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minWidth: 200 }}>
          <div style={{ fontSize: 13, color: '#666' }}>Plus/minusvalenza non realizzata</div>
          <div
            style={{
              fontSize: 22,
              marginTop: 4,
              color: plusMinusNonRealizzata >= 0 ? '#0a7d2c' : '#c0392b',
            }}
          >
            {plusMinusNonRealizzata >= 0 ? '+' : ''}
            {formatEuro(plusMinusNonRealizzata)}
          </div>
          <Link href="/fiscalita" style={{ fontSize: 13 }}>
            Vedi dettaglio fiscalità →
          </Link>
        </div>
      </section>
    </div>
  )
}