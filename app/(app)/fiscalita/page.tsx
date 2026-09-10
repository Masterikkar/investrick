import { createClient } from '@/lib/supabase/server'
import { formatEuro } from '@/lib/format'

type RiepilogoPosizione = {
  strumento_id: string
  contenitore_id: string | null
  quantita_posseduta: number
  capitale_investito: number
  valore: number | null
  rendimento_pct: number | null
}
type PlusvalenzaRealizzata = {
  anno: number
  strumento_id: string
  contenitore_id: string | null
  plusvalenza_imponibile: number | null
  plusvalenza_esente_polizza: number | null
}
type TasseAnnuali = { anno: number; tassa_trattenuta_totale: number }
type VerificaTrattenuta = {
  vendita_id: string
  data_vendita: string
  strumento_id: string
  contenitore_id: string | null
  titolo_di_stato: boolean
  aliquota_attesa_pct: number
  plusvalenza_totale_vendita: number
  tassa_attesa: number
  tassa_trattenuta_effettiva: number
  differenza: number
}
type Strumento = { id: string; nome: string }
type Contenitore = { id: string; nome: string }

export default async function FiscalitaPage() {
  const supabase = await createClient()
  const annoCorrente = new Date().getFullYear()

  const [
    { data: riepilogoRaw },
    { data: realizzateRaw },
    { data: tasseAnnualiRaw },
    { data: verificaRaw },
    { data: strumentiRaw },
    { data: contenitoriRaw },
  ] = await Promise.all([
    supabase.from('v_riepilogo_posizione').select('strumento_id, contenitore_id, quantita_posseduta, capitale_investito, valore, rendimento_pct').returns<RiepilogoPosizione[]>(),
    supabase.from('v_plusvalenze_realizzate').select('anno, strumento_id, contenitore_id, plusvalenza_imponibile, plusvalenza_esente_polizza').eq('anno', annoCorrente).returns<PlusvalenzaRealizzata[]>(),
    supabase.from('v_tasse_trattenute_annuali').select('anno, tassa_trattenuta_totale').eq('anno', annoCorrente).returns<TasseAnnuali[]>(),
    supabase.from('v_verifica_trattenute').select('*').order('data_vendita', { ascending: false }).returns<VerificaTrattenuta[]>(),
    supabase.from('strumenti').select('id, nome').returns<Strumento[]>(),
    supabase.from('contenitori').select('id, nome').returns<Contenitore[]>(),
  ])

  const riepilogo = (riepilogoRaw ?? []).filter((r) => r.quantita_posseduta > 0)
  const realizzate = realizzateRaw ?? []
  const tasseAnnuali = tasseAnnualiRaw?.[0]?.tassa_trattenuta_totale ?? 0
  const verifica = verificaRaw ?? []
  const strumentoMap = new Map((strumentiRaw ?? []).map((s) => [s.id, s.nome]))
  const contenitoreMap = new Map((contenitoriRaw ?? []).map((c) => [c.id, c.nome]))

  const totaleNonRealizzato = riepilogo.reduce(
    (sum, r) => sum + (r.valore != null ? Number(r.valore) - Number(r.capitale_investito) : 0),
    0
  )

  const totaleRealizzatoImponibile = realizzate.reduce((sum, r) => sum + Number(r.plusvalenza_imponibile ?? 0), 0)
  const totaleRealizzatoEsente = realizzate.reduce((sum, r) => sum + Number(r.plusvalenza_esente_polizza ?? 0), 0)

  return (
    <div>
      <h1>Fiscalità</h1>

      <h2 style={{ marginTop: 32 }}>Non realizzate (stato attuale)</h2>
      <div style={{ fontSize: 28, color: totaleNonRealizzato >= 0 ? 'green' : '#b91c1c' }}>
        {formatEuro(totaleNonRealizzato)}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
            <th style={{ padding: 8 }}>Strumento</th>
            <th style={{ padding: 8 }}>Contenitore</th>
            <th style={{ padding: 8 }}>Plus/minus</th>
            <th style={{ padding: 8 }}>Rendimento</th>
          </tr>
        </thead>
        <tbody>
          {riepilogo.filter((r) => r.valore != null).map((r) => {
            const guadagno = Number(r.valore) - Number(r.capitale_investito)
            return (
              <tr key={`${r.strumento_id}|${r.contenitore_id ?? ''}`} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{strumentoMap.get(r.strumento_id) ?? '—'}</td>
                <td style={{ padding: 8 }}>{r.contenitore_id ? contenitoreMap.get(r.contenitore_id) ?? '—' : 'Diretto'}</td>
                <td style={{ padding: 8, color: guadagno >= 0 ? 'green' : '#b91c1c' }}>{formatEuro(guadagno)}</td>
                <td style={{ padding: 8 }}>{r.rendimento_pct != null ? `${r.rendimento_pct.toFixed(2)}%` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>Realizzate — {annoCorrente}</h2>
      <div style={{ display: 'flex', gap: 32, marginTop: 8 }}>
        <div>
          <span style={{ color: '#666' }}>Imponibile</span>
          <div style={{ fontSize: 20, color: totaleRealizzatoImponibile >= 0 ? 'green' : '#b91c1c' }}>
            {formatEuro(totaleRealizzatoImponibile)}
          </div>
        </div>
        <div>
          <span style={{ color: '#666' }}>Esente (switch Polizza)</span>
          <div style={{ fontSize: 20 }}>{formatEuro(totaleRealizzatoEsente)}</div>
        </div>
      </div>

      {realizzate.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
              <th style={{ padding: 8 }}>Strumento</th>
              <th style={{ padding: 8 }}>Contenitore</th>
              <th style={{ padding: 8 }}>Imponibile</th>
              <th style={{ padding: 8 }}>Esente</th>
            </tr>
          </thead>
          <tbody>
            {realizzate.map((r) => (
              <tr key={`${r.strumento_id}|${r.contenitore_id ?? ''}`} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{strumentoMap.get(r.strumento_id) ?? '—'}</td>
                <td style={{ padding: 8 }}>{r.contenitore_id ? contenitoreMap.get(r.contenitore_id) ?? '—' : 'Diretto'}</td>
                <td style={{ padding: 8 }}>{formatEuro(Number(r.plusvalenza_imponibile ?? 0))}</td>
                <td style={{ padding: 8 }}>{formatEuro(Number(r.plusvalenza_esente_polizza ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: 32 }}>Tasse trattenute — {annoCorrente}</h2>
      <div style={{ fontSize: 20 }}>{formatEuro(Number(tasseAnnuali))}</div>

      <h2 style={{ marginTop: 32 }}>Verifica trattenute</h2>
      <p style={{ color: '#666' }}>Aliquota attesa vs trattenuta effettiva, per ogni vendita imponibile.</p>
      {verifica.length === 0 ? (
        <p style={{ marginTop: 12 }}>Nessuna vendita imponibile registrata finora.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
              <th style={{ padding: 8 }}>Data</th>
              <th style={{ padding: 8 }}>Strumento</th>
              <th style={{ padding: 8 }}>Plusvalenza</th>
              <th style={{ padding: 8 }}>Aliquota attesa</th>
              <th style={{ padding: 8 }}>Tassa attesa</th>
              <th style={{ padding: 8 }}>Tassa trattenuta</th>
              <th style={{ padding: 8 }}>Differenza</th>
            </tr>
          </thead>
          <tbody>
            {verifica.map((v) => {
              const scostamentoRilevante = Math.abs(Number(v.differenza)) > 0.01
              return (
                <tr key={v.vendita_id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}>{new Date(v.data_vendita).toLocaleDateString('it-IT')}</td>
                  <td style={{ padding: 8 }}>{strumentoMap.get(v.strumento_id) ?? '—'}</td>
                  <td style={{ padding: 8 }}>{formatEuro(Number(v.plusvalenza_totale_vendita))}</td>
                  <td style={{ padding: 8 }}>{Number(v.aliquota_attesa_pct).toFixed(2)}%</td>
                  <td style={{ padding: 8 }}>{formatEuro(Number(v.tassa_attesa))}</td>
                  <td style={{ padding: 8 }}>{formatEuro(Number(v.tassa_trattenuta_effettiva))}</td>
                  <td style={{ padding: 8, color: scostamentoRilevante ? '#b45309' : undefined, fontWeight: scostamentoRilevante ? 600 : undefined }}>
                    {formatEuro(Number(v.differenza))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}