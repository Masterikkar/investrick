'use client'

import { useState } from 'react'
import { Modale } from '@/components/modale'
import { aggiungiTransazione, aggiungiMovimentoLiquidita } from './actions'

type Strumento = { id: string; nome: string; ticker: string | null; categoria: string }
type StrumentoLiquidita = { id: string; nome: string }
type Contenitore = { id: string; nome: string }

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
  fontSize: 'var(--fs-button)',
  fontWeight: 500,
  cursor: 'pointer',
  alignSelf: 'flex-start',
}

export function NuovaTransazioneFinanziaria({
  strumenti,
  contenitori,
  successo,
  errore,
}: {
  strumenti: Strumento[]
  contenitori: Contenitore[]
  successo?: boolean
  errore?: boolean
}) {
  const [aperto, setAperto] = useState(false)

  return (
    <div>
      <button type="button" onClick={() => setAperto(true)} style={stileBottonePrimario}>
        + Nuova transazione
      </button>

      {successo && <p style={{ color: 'var(--success)', marginTop: 12 }}>Transazione salvata.</p>}
      {errore && <p style={{ color: 'var(--danger)', marginTop: 12 }}>Qualcosa è andato storto, riprova.</p>}

      <Modale aperto={aperto} onChiudi={() => setAperto(false)} titolo="Nuova transazione finanziaria">
        <form
          action={aggiungiTransazione}
          style={{ display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--text-primary)' }}
        >
          <label>
            Strumento
            <select name="strumento_id" style={stileCampo}>
              <option value="">Seleziona...</option>
              {strumenti.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome} {s.ticker ? `(${s.ticker})` : ''} — {s.categoria}
                </option>
              ))}
            </select>
            <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)', marginTop: 4, display: 'block' }}>
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
            <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)', marginTop: 4, display: 'block' }}>
              Necessaria solo se Strumento è vuoto (operazione &quot;Costo in contanti&quot;).
            </small>
          </label>

          <label>
            Contenitore
            <select name="contenitore_id" required style={stileCampo}>
              <option value="diretto">Diretto</option>
              {contenitori.map((c) => (
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
            <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)', marginTop: 4, display: 'block' }}>
              Per &quot;Costo in contanti&quot; usa 1.
            </small>
          </label>

          <label>
            Prezzo unitario (€)
            <input type="number" name="prezzo_unitario" step="any" required style={stileCampo} />
            <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)', marginTop: 4, display: 'block' }}>
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
      </Modale>
    </div>
  )
}

export function NuovaTransazioneLiquidita({
  strumentiLiquidita,
  contenitori,
  successo,
  errore,
}: {
  strumentiLiquidita: StrumentoLiquidita[]
  contenitori: Contenitore[]
  successo?: boolean
  errore?: boolean
}) {
  const [aperto, setAperto] = useState(false)

  return (
    <div>
      {strumentiLiquidita.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Nessuno strumento di categoria Liquidità trovato. Creane uno da &quot;Gestione strumenti&quot; prima di
          registrare movimenti.
        </p>
      ) : (
        <button type="button" onClick={() => setAperto(true)} style={stileBottonePrimario}>
          + Nuova transazione
        </button>
      )}

      {successo && <p style={{ color: 'var(--success)', marginTop: 12 }}>Transazione salvata.</p>}
      {errore && <p style={{ color: 'var(--danger)', marginTop: 12 }}>Qualcosa è andato storto, riprova.</p>}

      <Modale aperto={aperto} onChiudi={() => setAperto(false)} titolo="Nuova transazione di liquidità">
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
              {contenitori.map((c) => (
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
            <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)', marginTop: 4, display: 'block' }}>
              Rilevante solo per &quot;Interesse&quot;.
            </small>
          </label>

          <button type="submit" style={stileBottonePrimario}>
            Salva transazione
          </button>
        </form>
      </Modale>
    </div>
  )
}