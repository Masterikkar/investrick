import { createClient } from '@/lib/supabase/server'
import { RippleLink } from '@/components/ripple-link'
import { Sezione } from '@/components/sezione'
import { aggiungiTransazione, aggiungiMovimentoLiquidita } from './actions'
import { ImportaExcel } from './importa-excel'
import { ImportaExcelLiquidita } from './importa-excel-liquidita'
import { EsportaTransazioniFinanziarie, EsportaTransazioniLiquidita } from './esporta-transazioni'

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

const stileCampo: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '6px 10px',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
}

const stileBottonePrimario: React.CSSProperties = {
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
  padding: '8px 16px',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  alignSelf: 'flex-start',
}

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

  const tipiPerCategoria: Record<string, string[]> = {}
  for (const t of tipiRaw ?? []) {
    if (!tipiPerCategoria[t.categoria]) tipiPerCategoria[t.categoria] = []
    tipiPerCategoria[t.categoria].push(t.tipo)
  }

  const strumentiLiquidita = (strumenti ?? []).filter((s) => s.categoria === 'Liquidita')

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Account</div>
      <h1 style={{ fontSize: 20, marginTop: 4, marginBottom: 4, fontWeight: 500 }}>Transazioni</h1>

      <div style={{ display: 'flex', gap: 16, fontSize: 13, marginTop: 12, marginBottom: 16 }}>
        <RippleLink href="/transazioni/asset" className="link-interattivo">
          Vedi storico Transazioni finanziarie →
        </RippleLink>
        <RippleLink href="/transazioni/liquidita" className="link-interattivo">
          Vedi storico Transazioni di liquidità →
        </RippleLink>
      </div>

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>Importa transazioni finanziarie da Excel</h2>
        <Sezione>
          <ImportaExcel
            strumenti={(strumenti ?? []).map((s) => ({ id: s.id, isin: s.isin, ticker: s.ticker, nome: s.nome }))}
            contenitori={contenitori ?? []}
            tipiPerCategoria={tipiPerCategoria}
          />
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>Importa transazioni di liquidità da Excel</h2>
        <Sezione>
          <ImportaExcelLiquidita
            strumenti={strumentiLiquidita.map((s) => ({ id: s.id, nome: s.nome }))}
            contenitori={contenitori ?? []}
          />
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>Nuova transazione</h2>
        <Sezione>
          <div style={{ display: 'flex', gap: 128, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 320px', maxWidth: 420 }}>
              <h3 style={{ fontSize: 15, fontWeight: 500, marginTop: 0, marginBottom: 12 }}>Transazione finanziaria</h3>

              {params.successo === '1' && <p style={{ color: 'var(--success)', marginBottom: 12 }}>Transazione salvata.</p>}
              {params.errore === '1' && <p style={{ color: 'var(--danger)', marginBottom: 12 }}>Qualcosa è andato storto, riprova.</p>}

              <form
                action={aggiungiTransazione}
                style={{ display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--text-primary)' }}
              >
                <label>
                  Strumento
                  <select name="strumento_id" style={stileCampo}>
                    <option value="">Seleziona...</option>
                    {strumenti?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome} {s.ticker ? `(${s.ticker})` : ''} — {s.categoria}
                      </option>
                    ))}
                  </select>
                  <small style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4, display: 'block' }}>
                    Lascia vuoto solo per &quot;Costo (in contanti)&quot;.
                  </small>
                </label>

                <label>
                  Categoria
                  <select name="categoria_manuale" style={stileCampo}>
                    <option value="">—</option>
                    {CATEGORIE.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <small style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4, display: 'block' }}>
                    Necessaria solo se Strumento è vuoto (operazione &quot;Costo in contanti&quot;).
                  </small>
                </label>

                <label>
                  Contenitore
                  <select name="contenitore_id" required style={stileCampo}>
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
                  <select name="operazione" required style={stileCampo}>
                    {OPERAZIONI.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Data
                  <input type="date" name="data" required style={stileCampo} />
                </label>

                <label>
                  Quantità
                  <input type="number" name="quantita" step="any" required style={stileCampo} />
                  <small style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4, display: 'block' }}>
                    Per &quot;Costo in contanti&quot; usa 1.
                  </small>
                </label>

                <label>
                  Prezzo unitario (€)
                  <input type="number" name="prezzo_unitario" step="any" required style={stileCampo} />
                  <small style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4, display: 'block' }}>
                    Per &quot;Costo in contanti&quot; è l&apos;importo speso.
                  </small>
                </label>

                <label>
                  Commissione (€)
                  <input type="number" name="commissione" step="any" defaultValue={0} style={stileCampo} />
                </label>

                <label>
                  Tassa trattenuta (€)
                  <input type="number" name="tassa_trattenuta" step="any" defaultValue={0} style={stileCampo} />
                </label>

                <button type="submit" style={stileBottonePrimario}>
                  Salva transazione
                </button>
              </form>
            </div>

            <div style={{ flex: '1 1 320px', maxWidth: 420 }}>
              <h3 style={{ fontSize: 15, fontWeight: 500, marginTop: 0, marginBottom: 12 }}>Transazione di liquidità</h3>

              {params.successo === '1' && <p style={{ color: 'var(--success)', marginBottom: 12 }}>Transazione salvata.</p>}
              {params.errore === '1' && <p style={{ color: 'var(--danger)', marginBottom: 12 }}>Qualcosa è andato storto, riprova.</p>}

              {strumentiLiquidita.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                  Nessuno strumento di categoria Liquidità trovato. Creane uno da &quot;Gestione strumenti&quot; prima di
                  registrare movimenti.
                </p>
              ) : (
                <form
                  action={aggiungiMovimentoLiquidita}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--text-primary)' }}
                >
                  <label>
                    Strumento
                    <select name="strumento_id" required style={stileCampo}>
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
                    <select name="contenitore_id" required style={stileCampo}>
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
                    <select name="tipo_movimento" required style={stileCampo}>
                      {TIPI_MOVIMENTO_LIQUIDITA.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Data
                    <input type="date" name="data" required style={stileCampo} />
                  </label>

                  <label>
                    Importo lordo (€)
                    <input type="number" name="importo" step="any" required style={stileCampo} />
                  </label>

                  <label>
                    Tassa trattenuta (€)
                    <input type="number" name="tassa_trattenuta" step="any" defaultValue={0} style={stileCampo} />
                    <small style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4, display: 'block' }}>
                      Rilevante solo per &quot;Interesse&quot;.
                    </small>
                  </label>

                  <button type="submit" style={stileBottonePrimario}>
                    Salva transazione
                  </button>
                </form>
              )}
            </div>
          </div>
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>Esporta transazioni</h2>
        <Sezione>
          <div style={{ display: 'flex', gap: 128, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 320px', maxWidth: 420 }}>
              <h3 style={{ fontSize: 15, fontWeight: 500, marginTop: 0, marginBottom: 12 }}>Transazioni finanziarie</h3>
              <EsportaTransazioniFinanziarie />
            </div>
            <div style={{ flex: '1 1 320px', maxWidth: 420 }}>
              <h3 style={{ fontSize: 15, fontWeight: 500, marginTop: 0, marginBottom: 12 }}>Transazioni di liquidità</h3>
              <EsportaTransazioniLiquidita />
            </div>
          </div>
        </Sezione>
      </section>
    </div>
  )
}