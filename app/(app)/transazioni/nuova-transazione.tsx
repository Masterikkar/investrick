'use client'

import { useState } from 'react'
import { Modale } from '@/components/modale'
import { MenuSelect } from '@/components/menu-select'
import { aggiungiTransazione, aggiungiMovimentoLiquidita } from './actions'

type Strumento = { id: string; nome: string; ticker: string | null; categoria: string }
type StrumentoLiquidita = { id: string; nome: string }
type Contenitore = { id: string; nome: string }

const OPERAZIONI = [
  { value: '', label: 'Seleziona...' },
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
  { value: '', label: 'Seleziona...' },
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

const stileErroreCampo: React.CSSProperties = {
  color: 'var(--danger)',
  fontSize: 'var(--fs-form-hint)',
  margin: '4px 0 0',
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
  const [strumentoId, setStrumentoId] = useState('')
  const [categoriaManuale, setCategoriaManuale] = useState('')
  const [contenitoreId, setContenitoreId] = useState('')
  const [operazione, setOperazione] = useState('')
  const [erroriCampo, setErroriCampo] = useState<Record<string, string>>({})

  const opzioniStrumenti = [
    { value: '', label: 'Seleziona...' },
    ...strumenti.map((s) => ({
      value: s.id,
      label: `${s.nome} ${s.ticker ? `(${s.ticker})` : ''} — ${s.categoria}`,
    })),
  ]

  const opzioniCategoria = [{ value: '', label: '—' }, ...CATEGORIE.map((c) => ({ value: c, label: c }))]

  const opzioniContenitore = [
    { value: '', label: 'Seleziona...' },
    { value: 'diretto', label: 'Diretto' },
    ...contenitori.map((c) => ({ value: c.id, label: c.nome })),
  ]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const nuoviErrori: Record<string, string> = {}

    if (!operazione) {
      nuoviErrori.operazione = "Seleziona un'operazione."
    }
    if (!contenitoreId) {
      nuoviErrori.contenitore_id = 'Seleziona un contenitore.'
    }
    if (operazione === 'Costo_contanti') {
      if (!categoriaManuale) {
        nuoviErrori.categoria_manuale = 'Seleziona una categoria.'
      }
    } else if (!strumentoId) {
      nuoviErrori.strumento_id = 'Seleziona uno strumento.'
    }

    if (Object.keys(nuoviErrori).length > 0) {
      e.preventDefault()
      setErroriCampo(nuoviErrori)
      return
    }
    setErroriCampo({})
  }

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
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--text-primary)' }}
        >
          <label>
            Strumento
            <div style={{ marginTop: 4 }}>
              <MenuSelect
                name="strumento_id"
                value={strumentoId}
                onChange={(v) => {
                  setStrumentoId(v)
                  if (v) setErroriCampo((prev) => ({ ...prev, strumento_id: '' }))
                }}
                options={opzioniStrumenti}
              />
            </div>
            {erroriCampo.strumento_id && <p style={stileErroreCampo}>{erroriCampo.strumento_id}</p>}
            <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)', marginTop: 4, display: 'block' }}>
              Lascia vuoto solo per &quot;Costo (in contanti)&quot;.
            </small>
          </label>

          <label>
            Categoria
            <div style={{ marginTop: 4 }}>
              <MenuSelect
                name="categoria_manuale"
                value={categoriaManuale}
                onChange={(v) => {
                  setCategoriaManuale(v)
                  if (v) setErroriCampo((prev) => ({ ...prev, categoria_manuale: '' }))
                }}
                options={opzioniCategoria}
              />
            </div>
            {erroriCampo.categoria_manuale && <p style={stileErroreCampo}>{erroriCampo.categoria_manuale}</p>}
            <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)', marginTop: 4, display: 'block' }}>
              Necessaria solo se Strumento è vuoto (operazione &quot;Costo in contanti&quot;).
            </small>
          </label>

          <label>
            Contenitore
            <div style={{ marginTop: 4 }}>
              <MenuSelect
                name="contenitore_id"
                value={contenitoreId}
                onChange={(v) => {
                  setContenitoreId(v)
                  if (v) setErroriCampo((prev) => ({ ...prev, contenitore_id: '' }))
                }}
                options={opzioniContenitore}
              />
            </div>
            {erroriCampo.contenitore_id && <p style={stileErroreCampo}>{erroriCampo.contenitore_id}</p>}
          </label>

          <label>
            Operazione
            <div style={{ marginTop: 4 }}>
              <MenuSelect
                name="operazione"
                value={operazione}
                onChange={(v) => {
                  setOperazione(v)
                  if (v) setErroriCampo((prev) => ({ ...prev, operazione: '' }))
                }}
                options={OPERAZIONI}
              />
            </div>
            {erroriCampo.operazione && <p style={stileErroreCampo}>{erroriCampo.operazione}</p>}
          </label>

          <label>
            Data
            <input type="date" name="data" required style={stileCampo} />
          </label>

          <label>
            Quantità
            <input type="number" name="quantita" step="any" min={0} required style={stileCampo} />
            <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)', marginTop: 4, display: 'block' }}>
              Per &quot;Costo in contanti&quot; usa 1.
            </small>
          </label>

          <label>
            Prezzo unitario (€)
            <input type="number" name="prezzo_unitario" step="any" min={0} required style={stileCampo} />
            <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)', marginTop: 4, display: 'block' }}>
              Per &quot;Costo in contanti&quot; è l&apos;importo speso.
            </small>
          </label>

          <label>
            Commissione (€)
            <input type="number" name="commissione" step="any" min={0} defaultValue={0} style={stileCampo} />
          </label>

          <label>
            Tassa trattenuta (€)
            <input type="number" name="tassa_trattenuta" step="any" min={0} defaultValue={0} style={stileCampo} />
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
  const [strumentoId, setStrumentoId] = useState('')
  const [contenitoreId, setContenitoreId] = useState('')
  const [tipoMovimento, setTipoMovimento] = useState('')
  const [erroriCampo, setErroriCampo] = useState<Record<string, string>>({})

  const opzioniStrumenti = [
    { value: '', label: 'Seleziona...' },
    ...strumentiLiquidita.map((s) => ({ value: s.id, label: s.nome })),
  ]

  const opzioniContenitore = [
    { value: '', label: 'Seleziona...' },
    { value: 'diretto', label: 'Diretto' },
    ...contenitori.map((c) => ({ value: c.id, label: c.nome })),
  ]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const nuoviErrori: Record<string, string> = {}

    if (!strumentoId) {
      nuoviErrori.strumento_id = 'Seleziona uno strumento.'
    }
    if (!contenitoreId) {
      nuoviErrori.contenitore_id = 'Seleziona un contenitore.'
    }
    if (!tipoMovimento) {
      nuoviErrori.tipo_movimento = 'Seleziona un tipo movimento.'
    }

    if (Object.keys(nuoviErrori).length > 0) {
      e.preventDefault()
      setErroriCampo(nuoviErrori)
      return
    }
    setErroriCampo({})
  }

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
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--text-primary)' }}
        >
          <label>
            Strumento
            <div style={{ marginTop: 4 }}>
              <MenuSelect
                name="strumento_id"
                value={strumentoId}
                onChange={(v) => {
                  setStrumentoId(v)
                  if (v) setErroriCampo((prev) => ({ ...prev, strumento_id: '' }))
                }}
                options={opzioniStrumenti}
              />
            </div>
            {erroriCampo.strumento_id && <p style={stileErroreCampo}>{erroriCampo.strumento_id}</p>}
          </label>

          <label>
            Contenitore
            <div style={{ marginTop: 4 }}>
              <MenuSelect
                name="contenitore_id"
                value={contenitoreId}
                onChange={(v) => {
                  setContenitoreId(v)
                  if (v) setErroriCampo((prev) => ({ ...prev, contenitore_id: '' }))
                }}
                options={opzioniContenitore}
              />
            </div>
            {erroriCampo.contenitore_id && <p style={stileErroreCampo}>{erroriCampo.contenitore_id}</p>}
          </label>

          <label>
            Tipo movimento
            <div style={{ marginTop: 4 }}>
              <MenuSelect
                name="tipo_movimento"
                value={tipoMovimento}
                onChange={(v) => {
                  setTipoMovimento(v)
                  if (v) setErroriCampo((prev) => ({ ...prev, tipo_movimento: '' }))
                }}
                options={TIPI_MOVIMENTO_LIQUIDITA}
              />
            </div>
            {erroriCampo.tipo_movimento && <p style={stileErroreCampo}>{erroriCampo.tipo_movimento}</p>}
          </label>

          <label>
            Data
            <input type="date" name="data" required style={stileCampo} />
          </label>

          <label>
            Importo lordo (€)
            <input type="number" name="importo" step="any" min={0} required style={stileCampo} />
          </label>

          <label>
            Tassa trattenuta (€)
            <input type="number" name="tassa_trattenuta" step="any" min={0} defaultValue={0} style={stileCampo} />
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