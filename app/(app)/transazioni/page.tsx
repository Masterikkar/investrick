import { createClient } from '@/lib/supabase/server'
import { aggiungiTransazione, aggiungiMovimentoLiquidita } from './actions'
import { ImportaExcel } from './importa-excel'
import { StoricoTransazioni, type RigaStoricoTransazione } from './storico-transazioni'
import { StoricoMovimentiLiquidita, type RigaStoricoMovimentoLiquidita } from './storico-movimenti-liquidita'

const OPERAZIONI = [
  { value: 'Acquisto', label: 'Acquisto' },
  { value: 'Vendita', label: 'Vendita' },
  { value: 'Dividendo', label: 'Dividendo' },
  { value: 'Ricompensa', label: 'Ricompensa' },
  { value: 'Costo_quote', label: 'Costo (in quote)' },
  { value: 'Costo_contanti', label: 'Costo (in contanti)' },
  { value: 'Scambio_cessione', label: 'Scambio (cessione)' },
  { value: 'Scambio_acquisizione', label: 'Scambio (acquisizione)' },
]

const CATEGORIE = ['Azioni', 'Obbligazioni', 'Materie prime', 'Monetario', 'Multiasset', 'Crypto']

const TIPI_MOVIMENTO_LIQUIDITA = [
  { value: 'Versamento', label: 'Versamento' },
  { value: 'Prelievo', label: 'Prelievo' },
  { value: 'Interesse', label: 'Interesse' },
  { value: 'Costo', label: 'Costo' },
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
    .select('id, nome, ticker, categoria, isin')
    .order('categoria')
    .order('nome')

  const { data: contenitori } = await supabase
    .from('contenitori')
    .select('id, nome')
    .order('nome')

  const { data: tipiRaw } = await supabase
    .from('tipi_strumento')
    .select('categoria, tipo')
    .neq('categoria', 'Liquidita')
    .order('categoria')
    .order('tipo')

  const { data: transazioniStoricoRaw } = await supabase
    .from('transazioni')
    .select(
      'id, data, operazione, contenitore_id, quantita, prezzo_unitario, commissione, tassa_trattenuta, strumento_id'
    )
    .order('data', { ascending: false })

  const { data: movimentiLiquiditaStoricoRaw } = await supabase
    .from('movimenti_liquidita')
    .select('id, data, tipo_movimento, contenitore_id, importo, tassa_trattenuta, strumento_id')
    .order('data', { ascending: false })

  const tipiPerCategoria: Record<string, string[]> = {}
  for (const t of tipiRaw ?? []) {
    if (!tipiPerCategoria[t.categoria]) tipiPerCategoria[t.categoria] = []
    tipiPerCategoria[t.categoria].push(t.tipo)
  }

  const strumentoMap = new Map((strumenti ?? []).map((s) => [s.id, s]))
  const strumentiLiquidita = (strumenti ?? []).filter((s) => s.categoria === 'Liquidita')

  const storicoTransazioni: RigaStoricoTransazione[] = (transazioniStoricoRaw ?? []).map((t) => {
    const strumento = t.strumento_id ? strumentoMap.get(t.strumento_id) : undefined
    return {
      id: t.id,
      data: t.data,
      operazione: t.operazione,
      contenitore_id: t.contenitore_id,
      quantita: Number(t.quantita),
      prezzo_unitario: Number(t.prezzo_unitario),
      commissione: Number(t.commissione),
      tassa_trattenuta: Number(t.tassa_trattenuta),
      strumento_id: t.strumento_id,
      strumento_nome: strumento?.nome ?? '—',
      strumento_ticker: strumento?.ticker ?? null,
    }
  })

  const storicoMovimentiLiquidita: RigaStoricoMovimentoLiquidita[] = (movimentiLiquiditaStoricoRaw ?? []).map((m) => {
    const strumento = strumentoMap.get(m.strumento_id)
    return {
      id: m.id,
      data: m.data,
      tipo_movimento: m.tipo_movimento,
      contenitore_id: m.contenitore_id,
      importo: Number(m.importo),
      tassa_trattenuta: Number(m.tassa_trattenuta),
      strumento_id: m.strumento_id,
      strumento_nome: strumento?.nome ?? '—',
    }
  })

  return (
    <div>
      <h1>Transazioni</h1>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Importa da Excel</h2>
        <ImportaExcel
          strumenti={(strumenti ?? []).map((s) => ({ id: s.id, isin: s.isin, ticker: s.ticker, nome: s.nome }))}
          contenitori={contenitori ?? []}
          tipiPerCategoria={tipiPerCategoria}
        />
      </section>

      <hr style={{ margin: '32px 0' }} />

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Nuova transazione manuale</h2>

      {params.successo === '1' && <p style={{ color: 'green' }}>Transazione salvata.</p>}
      {params.errore === '1' && <p style={{ color: 'red' }}>Qualcosa è andato storto, riprova.</p>}

      <form
        action={aggiungiTransazione}
        style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400, marginTop: 16 }}
      >
        <label>
          Strumento
          <select name="strumento_id" style={{ width: '100%' }}>
            <option value="">Seleziona...</option>
            {strumenti?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} {s.ticker ? `(${s.ticker})` : ''} — {s.categoria}
              </option>
            ))}
          </select>
          <small style={{ color: '#666' }}>Lascia vuoto solo per "Costo (in contanti)".</small>
        </label>

        <label>
          Categoria
          <select name="categoria_manuale" style={{ width: '100%' }}>
            <option value="">—</option>
            {CATEGORIE.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <small style={{ color: '#666' }}>Necessaria solo se Strumento è vuoto (operazione "Costo in contanti").</small>
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
          <small style={{ color: '#666' }}>Per "Costo in contanti" usa 1.</small>
        </label>

        <label>
          Prezzo unitario (€)
          <input type="number" name="prezzo_unitario" step="any" required style={{ width: '100%' }} />
          <small style={{ color: '#666' }}>Per "Costo in contanti" è l'importo speso.</small>
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

      <hr style={{ margin: '32px 0' }} />

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Nuova operazione Liquidità</h2>

      {params.successo === '1' && <p style={{ color: 'green' }}>Transazione salvata.</p>}
      {params.errore === '1' && <p style={{ color: 'red' }}>Qualcosa è andato storto, riprova.</p>}

      {strumentiLiquidita.length === 0 ? (
        <p style={{ color: '#666' }}>
          Nessuno strumento di categoria Liquidità trovato. Creane uno da "Gestione strumenti" prima di registrare
          movimenti.
        </p>
      ) : (
        <form
          action={aggiungiMovimentoLiquidita}
          style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400, marginTop: 16 }}
        >
          <label>
            Strumento
            <select name="strumento_id" required style={{ width: '100%' }}>
              <option value="">Seleziona...</option>
              {strumentiLiquidita.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
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
            Tipo movimento
            <select name="tipo_movimento" required style={{ width: '100%' }}>
              {TIPI_MOVIMENTO_LIQUIDITA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Data
            <input type="date" name="data" required style={{ width: '100%' }} />
          </label>

          <label>
            Importo lordo (€)
            <input type="number" name="importo" step="any" required style={{ width: '100%' }} />
          </label>

          <label>
            Tassa trattenuta (€)
            <input type="number" name="tassa_trattenuta" step="any" defaultValue={0} style={{ width: '100%' }} />
            <small style={{ color: '#666' }}>Rilevante solo per "Interesse".</small>
          </label>

          <button type="submit">Salva operazione</button>
        </form>
      )}

      <hr style={{ margin: '32px 0' }} />

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Storico transazioni</h2>
      <StoricoTransazioni transazioni={storicoTransazioni} contenitori={contenitori ?? []} />

      <hr style={{ margin: '32px 0' }} />

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Storico movimenti Liquidità</h2>
      <StoricoMovimentiLiquidita movimenti={storicoMovimentiLiquidita} contenitori={contenitori ?? []} />
    </div>
  )
}