import { createClient } from '@/lib/supabase/server'
import { formatEuro } from '@/lib/format'

export default async function PolizzePage() {
  const supabase = await createClient()

  const { data: polizze } = await supabase
    .from('contenitori')
    .select('id, nome, data_attivazione, target_attivo')
    .eq('tipo', 'Polizza')
    .order('data_attivazione')

  const polizzeIds = polizze?.map((p) => p.id) ?? []

  const { data: valori } = polizzeIds.length
    ? await supabase
        .from('v_valore_per_contenitore')
        .select('contenitore_id, valore_totale')
        .in('contenitore_id', polizzeIds)
    : { data: null }

  const { data: costi } = polizzeIds.length
    ? await supabase
        .from('v_costo_per_contenitore')
        .select('contenitore_id, costo_totale')
        .in('contenitore_id', polizzeIds)
    : { data: null }

  const { data: posizioni } = polizzeIds.length
    ? await supabase
        .from('v_riepilogo_posizione')
        .select('contenitore_id, valore, capitale_investito')
        .in('contenitore_id', polizzeIds)
    : { data: null }

  const polizzeConTargetAttivo = (polizze ?? []).filter((p) => p.target_attivo)

  const { data: scostamenti } =
    polizzeConTargetAttivo.length === 1
      ? await supabase
          .from('v_scostamento_target')
          .select('*')
          .eq('contenitore_id', polizzeConTargetAttivo[0].id)
      : { data: null }

  const { data: impostazioni } = await supabase
    .from('impostazioni_utente')
    .select('soglia_ribilanciamento_pp')
    .maybeSingle()

  const soglia = impostazioni?.soglia_ribilanciamento_pp ?? 3

  const ORDINE_CATEGORIE = ['Azioni', 'Obbligazioni', 'Materie prime', 'Crypto', 'Multiasset']
  const composizione = (scostamenti ?? [])
    .slice()
    .sort(
      (a, b) => ORDINE_CATEGORIE.indexOf(a.categoria ?? '') - ORDINE_CATEGORIE.indexOf(b.categoria ?? '')
    )

  const righePolizze = (polizze ?? []).map((p) => {
    const valore = valori?.find((v) => v.contenitore_id === p.id)?.valore_totale ?? 0
    const costo = costi?.find((c) => c.contenitore_id === p.id)?.costo_totale ?? 0
    const posizioniPolizza = (posizioni ?? []).filter((pos) => pos.contenitore_id === p.id)
    const capitaleInvestito = posizioniPolizza.reduce(
      (acc, pos) => acc + (pos.capitale_investito ?? 0),
      0
    )
    const valorePosizioni = posizioniPolizza.reduce((acc, pos) => acc + (pos.valore ?? 0), 0)
    const plusMinus = valorePosizioni - capitaleInvestito
    return {
      id: p.id,
      nome: p.nome,
      dataAttivazione: p.data_attivazione,
      valore,
      costo,
      plusMinus,
    }
  })

  const valoreTotale = righePolizze.reduce((acc, r) => acc + r.valore, 0)

  return (
    <div>
      <div style={{ fontSize: 13, color: '#666' }}>Polizze</div>
      <h1 style={{ fontSize: 20, marginTop: 4, marginBottom: 16 }}>Polizze</h1>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 48, margin: 0 }}>
        {formatEuro(valoreTotale)}
      </p>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Composizione vs target</h2>
        {polizzeConTargetAttivo.length === 0 ? (
          <p style={{ color: '#666' }}>Nessuna polizza ha un target attivo.</p>
        ) : polizzeConTargetAttivo.length > 1 ? (
          <p style={{ color: '#666' }}>
            Più polizze con target attivo: aggregazione non ancora supportata.
          </p>
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
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Le tue polizze</h2>
        {righePolizze.length === 0 ? (
          <p style={{ color: '#666' }}>Nessuna polizza registrata.</p>
        ) : (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {righePolizze.map((r) => (
              <div
                key={r.id}
                style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minWidth: 220 }}
              >
                <div style={{ fontWeight: 'bold' }}>{r.nome}</div>
                <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                  {r.dataAttivazione
                    ? `Attiva dal ${new Date(r.dataAttivazione).toLocaleDateString('it-IT')}`
                    : 'Data di attivazione non impostata'}
                </div>
                <div style={{ marginTop: 12, fontSize: 20 }}>{formatEuro(r.valore)}</div>
                <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
                  Costo: {formatEuro(r.costo)}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    color: r.plusMinus >= 0 ? '#0a7d2c' : '#c0392b',
                  }}
                >
                  Plus/minus: {r.plusMinus >= 0 ? '+' : ''}
                  {formatEuro(r.plusMinus)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}