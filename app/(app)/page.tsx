import { createClient } from '@/lib/supabase/server'
import { formatEuro } from '@/lib/format'

const ORDINE_CATEGORIE = ['Azioni', 'Obbligazioni', 'Materie prime', 'Crypto', 'Multiasset']

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: totale } = await supabase
    .from('v_valore_totale_portafoglio')
    .select('valore_totale')
    .single()

  const { data: contenitori } = await supabase
    .from('v_valore_per_contenitore')
    .select('contenitore_id, tipo, nome, valore_totale')
    .order('tipo')

  const { data: categorieData } = await supabase
    .from('v_valore_per_categoria')
    .select('categoria, valore_totale')

  const categorie = ORDINE_CATEGORIE.map((nome) => ({
    categoria: nome,
    valore_totale: categorieData?.find((c) => c.categoria === nome)?.valore_totale ?? 0,
  }))

  const { data: scostamenti } = await supabase
    .from('v_scostamento_target')
    .select('*')

  const { data: impostazioni } = await supabase
    .from('impostazioni_utente')
    .select('soglia_ribilanciamento_pp')
    .maybeSingle()

  const soglia = impostazioni?.soglia_ribilanciamento_pp ?? 3

  const alert = (scostamenti ?? [])
    .filter((s) => Math.abs(s.scostamento_pp ?? 0) >= soglia)
    .sort((a, b) => Math.abs(b.scostamento_pp ?? 0) - Math.abs(a.scostamento_pp ?? 0))

  return (
    <div>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 48, margin: 0 }}>
        {formatEuro(totale?.valore_totale ?? 0)}
      </p>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Ribilanciamento</h2>
        {alert.length === 0 ? (
          <p style={{ color: '#666' }}>Tutto in linea con i target.</p>
        ) : (
          <ul style={{ paddingLeft: 20 }}>
            {alert.map((a) => (
              <li key={`${a.contenitore_id}-${a.categoria}`}>
                <strong>{a.contenitore_nome}</strong> — {a.categoria}: {a.peso_attuale_pct}% attuale
                vs {a.target_percentuale}% target (
                {a.scostamento_pp && a.scostamento_pp > 0 ? '+' : ''}
                {a.scostamento_pp} pp)
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>I tuoi contenitori</h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {contenitori?.map((c) => (
            <div
              key={c.contenitore_id}
              style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minWidth: 160 }}
            >
              <div style={{ fontSize: 13, color: '#666' }}>{c.tipo}</div>
              <div style={{ fontWeight: 'bold' }}>{c.nome}</div>
              <div style={{ marginTop: 8 }}>{formatEuro(c.valore_totale ?? 0)}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Categorie</h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {categorie.map((c) => (
            <div
              key={c.categoria}
              style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minWidth: 160 }}
            >
              <div style={{ fontWeight: 'bold' }}>{c.categoria}</div>
              <div style={{ marginTop: 8 }}>{formatEuro(c.valore_totale)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}