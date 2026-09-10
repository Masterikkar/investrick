import { createClient } from '@/lib/supabase/server'
import { aggiungiTransazione } from './actions'

const OPERAZIONI = [
  { value: 'Acquisto', label: 'Acquisto' },
  { value: 'Vendita', label: 'Vendita' },
  { value: 'Dividendo', label: 'Dividendo' },
  { value: 'Ricompensa', label: 'Ricompensa' },
  { value: 'Costo_quote', label: 'Costo (in quote)' },
  { value: 'Scambio_cessione', label: 'Scambio (cessione)' },
  { value: 'Scambio_acquisizione', label: 'Scambio (acquisizione)' },
]

export default async function TransazioniPage({
  searchParams,
}: {
  searchParams: Promise<{ successo?: string; errore?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: strumenti } = await supabase
    .from('strumenti')
    .select('id, nome, ticker, categoria')
    .order('categoria')
    .order('nome')

  const { data: contenitori } = await supabase
    .from('contenitori')
    .select('id, nome')
    .order('nome')

  return (
    <div>
      <h1>Nuova transazione</h1>

      {params.successo === '1' && <p style={{ color: 'green' }}>Transazione salvata.</p>}
      {params.errore === '1' && <p style={{ color: 'red' }}>Qualcosa è andato storto, riprova.</p>}

      <form
        action={aggiungiTransazione}
        style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400, marginTop: 16 }}
      >
        <label>
          Strumento
          <select name="strumento_id" required style={{ width: '100%' }}>
            <option value="">Seleziona...</option>
            {strumenti?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} {s.ticker ? `(${s.ticker})` : ''} — {s.categoria}
              </option>
            ))}
          </select>
        </label>

        <label>
          Contenitore
          <select name="contenitore_id" required style={{ width: '100%' }}>
            <option value="diretto">Diretto</option>
            {contenitori?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>

        <label>
          Operazione
          <select name="operazione" required style={{ width: '100%' }}>
            {OPERAZIONI.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Data
          <input type="date" name="data" required style={{ width: '100%' }} />
        </label>

        <label>
          Quantità
          <input type="number" name="quantita" step="any" required style={{ width: '100%' }} />
        </label>

        <label>
          Prezzo unitario (€)
          <input type="number" name="prezzo_unitario" step="any" required style={{ width: '100%' }} />
        </label>

        <label>
          Commissione (€)
          <input type="number" name="commissione" step="any" defaultValue={0} style={{ width: '100%' }} />
        </label>

        <label>
          Tassa trattenuta (€)
          <input type="number" name="tassa_trattenuta" step="any" defaultValue={0} style={{ width: '100%' }} />
        </label>

        <button type="submit">Salva transazione</button>
      </form>
    </div>
  )
}