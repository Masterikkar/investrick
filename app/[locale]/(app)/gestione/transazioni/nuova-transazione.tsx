'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Modale } from '@/components/modale'
import { MenuSelect } from '@/components/menu-select'
import { aggiungiTransazione, aggiungiMovimentoLiquidita } from './actions'
import { ETICHETTA_OPERAZIONE } from '@/lib/operazioni'
import { CHIAVE_TRADUZIONE_OPERAZIONE } from '@/lib/i18n-tipi-operazione'
import { traduciCategoria } from '@/lib/i18n-categorie'
import { CHIAVE_TRADUZIONE_TIPO_MOVIMENTO_LIQUIDITA } from '@/lib/i18n-tipi-movimento-liquidita'
import { CATEGORIE_MERCATO } from '@/lib/categorie'

type Strumento = { id: string; nome: string; ticker: string | null; categoria: string }
type StrumentoLiquidita = { id: string; nome: string }
type Contenitore = { id: string; nome: string; tipo: string }

const CODICI_OPERAZIONE = [
  'Acquisto',
  'Vendita',
  'Dividendo',
  'Ricompensa',
  'Costo_quote',
  'Costo_contanti',
  'Scambio_cessione',
  'Scambio_acquisizione',
]


const CODICI_TIPO_MOVIMENTO_LIQUIDITA = ['Versamento', 'Prelievo', 'Interesse', 'Costo']

const stileEtichetta: React.CSSProperties = {
  fontSize: 'var(--fs-form-label)',
}

const stileCampo: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '6px 10px',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  fontSize: 'var(--fs-form-label)',
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
  const t = useTranslations('PaginaGestioneTransazioni')
  const tCategorie = useTranslations('Categorie')
  const tContenitori = useTranslations('Contenitori')
  const tTipiOperazione = useTranslations('TipiOperazione')
  const tPaginaFiscalita = useTranslations('PaginaFiscalita')
  const tPaginaStorico = useTranslations('PaginaStorico')
  const tPaginaRibilanciamento = useTranslations('PaginaRibilanciamento')
  const tPaginaGestioneStrumenti = useTranslations('PaginaGestioneStrumenti')

  function etichettaOperazione(codice: string): string {
    const etichettaItaliana = ETICHETTA_OPERAZIONE[codice] ?? codice
    const chiave = CHIAVE_TRADUZIONE_OPERAZIONE[etichettaItaliana]
    return chiave ? tTipiOperazione(chiave) : etichettaItaliana
  }

  const [aperto, setAperto] = useState(false)
  const [strumentoId, setStrumentoId] = useState('')
  const [categoriaManuale, setCategoriaManuale] = useState('')
  const [contenitoreId, setContenitoreId] = useState('')
  const [operazione, setOperazione] = useState('')
  const [erroriCampo, setErroriCampo] = useState<Record<string, string>>({})

  const opzioniOperazioni = [
    { value: '', label: tPaginaRibilanciamento('optionSeleziona') },
    ...CODICI_OPERAZIONE.map((codice) => ({ value: codice, label: etichettaOperazione(codice) })),
  ]

  const opzioniStrumenti = [
    { value: '', label: tPaginaRibilanciamento('optionSeleziona') },
    ...strumenti.map((s) => ({
      value: s.id,
      label: `${s.nome} ${s.ticker ? `(${s.ticker})` : ''} — ${traduciCategoria(tCategorie, s.categoria)}`,
    })),
  ]

  const opzioniCategoria = [
    { value: '', label: '—' },
    ...CATEGORIE_MERCATO.map((c) => ({ value: c, label: traduciCategoria(tCategorie, c) })),
  ]

  // Contenitore facoltativo: nessuna selezione = nessun contenitore.
  const opzioniContenitore = [
    { value: '', label: tPaginaRibilanciamento('optionSeleziona') },
    ...contenitori.map((c) => ({ value: c.id, label: c.nome })),
  ]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const nuoviErrori: Record<string, string> = {}

    if (!operazione) {
      nuoviErrori.operazione = t('erroreSelezionaOperazione')
    }
    // Stesso vincolo del database (vincola_scambio_solo_polizza), per un errore
    // chiaro sul campo invece di quello generico dopo l'invio.
    if (
      (operazione === 'Scambio_cessione' || operazione === 'Scambio_acquisizione') &&
      contenitori.find((c) => c.id === contenitoreId)?.tipo !== 'Polizza'
    ) {
      nuoviErrori.contenitore_id = t('erroreScambioSoloPolizza')
    }
    if (operazione === 'Costo_contanti') {
      if (!categoriaManuale) {
        nuoviErrori.categoria_manuale = tPaginaGestioneStrumenti('erroreSelezionaCategoria')
      }
    } else if (!strumentoId) {
      nuoviErrori.strumento_id = t('erroreSelezionaStrumento')
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
        {t('bottoneNuovaTransazione')}
      </button>

      {successo && <p style={{ color: 'var(--success)', marginTop: 12 }}>{t('successoTransazioneSalvata')}</p>}
      {errore && <p style={{ color: 'var(--danger)', marginTop: 12 }}>{t('erroreRiprova')}</p>}

      <Modale aperto={aperto} onChiudi={() => setAperto(false)} titolo={t('modaleTitoloNuovaTransazioneFinanziaria')}>
        <form
          action={aggiungiTransazione}
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--text-primary)' }}
        >
          <label style={stileEtichetta}>
            {tPaginaFiscalita('colonnaStrumento')}
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
              {t('hintStrumentoVuoto', { operazione: etichettaOperazione('Costo_contanti') })}
            </small>
          </label>

          <label style={stileEtichetta}>
            {tPaginaGestioneStrumenti('labelCategoria')}
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
              {t('hintCategoriaManuale', { operazione: etichettaOperazione('Costo_contanti') })}
            </small>
          </label>

          <label style={stileEtichetta}>
            {tPaginaFiscalita('colonnaContenitore')}
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

          <label style={stileEtichetta}>
            {tPaginaStorico('colonnaOperazione')}
            <div style={{ marginTop: 4 }}>
              <MenuSelect
                name="operazione"
                value={operazione}
                onChange={(v) => {
                  setOperazione(v)
                  if (v) setErroriCampo((prev) => ({ ...prev, operazione: '' }))
                }}
                options={opzioniOperazioni}
              />
            </div>
            {erroriCampo.operazione && <p style={stileErroreCampo}>{erroriCampo.operazione}</p>}
          </label>

          <label style={stileEtichetta}>
            {tPaginaFiscalita('colonnaData')}
            <input type="date" name="data" required style={stileCampo} />
          </label>

          <label style={stileEtichetta}>
            {tPaginaStorico('colonnaQuantita')}
            <input type="number" name="quantita" step="any" min={0} required style={stileCampo} />
            <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)', marginTop: 4, display: 'block' }}>
              {t('hintQuantitaCostoContanti', { operazione: etichettaOperazione('Costo_contanti') })}
            </small>
          </label>

          <label style={stileEtichetta}>
            {t('labelPrezzoUnitarioEuro')}
            <input type="number" name="prezzo_unitario" step="any" min={0} required style={stileCampo} />
            <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)', marginTop: 4, display: 'block' }}>
              {t('hintPrezzoCostoContanti', { operazione: etichettaOperazione('Costo_contanti') })}
            </small>
          </label>

          <label style={stileEtichetta}>
            {t('labelCommissioneEuro')}
            <input type="number" name="commissione" step="any" min={0} defaultValue={0} style={stileCampo} />
          </label>

          <label style={stileEtichetta}>
            {t('labelTassaTrattenutaEuro')}
            <input type="number" name="tassa_trattenuta" step="any" min={0} defaultValue={0} style={stileCampo} />
          </label>

          <button type="submit" style={stileBottonePrimario}>
            {t('bottoneSalvaTransazione')}
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
  const t = useTranslations('PaginaGestioneTransazioni')
  const tContenitori = useTranslations('Contenitori')
  const tTipiMovimentoLiquidita = useTranslations('TipiMovimentoLiquidita')
  const tPaginaFiscalita = useTranslations('PaginaFiscalita')
  const tPaginaStorico = useTranslations('PaginaStorico')
  const tPaginaRibilanciamento = useTranslations('PaginaRibilanciamento')
  const tPaginaGestioneStrumenti = useTranslations('PaginaGestioneStrumenti')

  function etichettaTipoMovimento(codice: string): string {
    const chiave = CHIAVE_TRADUZIONE_TIPO_MOVIMENTO_LIQUIDITA[codice]
    return chiave ? tTipiMovimentoLiquidita(chiave) : codice
  }

  const [aperto, setAperto] = useState(false)
  const [strumentoId, setStrumentoId] = useState('')
  const [contenitoreId, setContenitoreId] = useState('')
  const [tipoMovimento, setTipoMovimento] = useState('')
  const [erroriCampo, setErroriCampo] = useState<Record<string, string>>({})

  const opzioniTipoMovimento = [
    { value: '', label: tPaginaRibilanciamento('optionSeleziona') },
    ...CODICI_TIPO_MOVIMENTO_LIQUIDITA.map((codice) => ({ value: codice, label: etichettaTipoMovimento(codice) })),
  ]

  const opzioniStrumenti = [
    { value: '', label: tPaginaRibilanciamento('optionSeleziona') },
    ...strumentiLiquidita.map((s) => ({ value: s.id, label: s.nome })),
  ]

  // Contenitore facoltativo: nessuna selezione = nessun contenitore.
  const opzioniContenitore = [
    { value: '', label: tPaginaRibilanciamento('optionSeleziona') },
    ...contenitori.map((c) => ({ value: c.id, label: c.nome })),
  ]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const nuoviErrori: Record<string, string> = {}

    if (!strumentoId) {
      nuoviErrori.strumento_id = t('erroreSelezionaStrumento')
    }
    if (!tipoMovimento) {
      nuoviErrori.tipo_movimento = t('erroreSelezionaTipoMovimento')
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
          {t('alertNessunoStrumentoLiquidita', {
            liquidita: tContenitori('liquidita'),
            pagina: tPaginaGestioneStrumenti('titoloGestioneStrumenti'),
          })}
        </p>
      ) : (
        <button type="button" onClick={() => setAperto(true)} style={stileBottonePrimario}>
          {t('bottoneNuovaTransazione')}
        </button>
      )}

      {successo && <p style={{ color: 'var(--success)', marginTop: 12 }}>{t('successoTransazioneSalvata')}</p>}
      {errore && <p style={{ color: 'var(--danger)', marginTop: 12 }}>{t('erroreRiprova')}</p>}

      <Modale aperto={aperto} onChiudi={() => setAperto(false)} titolo={t('modaleTitoloNuovaTransazioneLiquidita')}>
        <form
          action={aggiungiMovimentoLiquidita}
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--text-primary)' }}
        >
          <label style={stileEtichetta}>
            {tPaginaFiscalita('colonnaStrumento')}
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

          <label style={stileEtichetta}>
            {tPaginaFiscalita('colonnaContenitore')}
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

          <label style={stileEtichetta}>
            {tPaginaStorico('colonnaTipoMovimento')}
            <div style={{ marginTop: 4 }}>
              <MenuSelect
                name="tipo_movimento"
                value={tipoMovimento}
                onChange={(v) => {
                  setTipoMovimento(v)
                  if (v) setErroriCampo((prev) => ({ ...prev, tipo_movimento: '' }))
                }}
                options={opzioniTipoMovimento}
              />
            </div>
            {erroriCampo.tipo_movimento && <p style={stileErroreCampo}>{erroriCampo.tipo_movimento}</p>}
          </label>

          <label style={stileEtichetta}>
            {tPaginaFiscalita('colonnaData')}
            <input type="date" name="data" required style={stileCampo} />
          </label>

          <label style={stileEtichetta}>
            {t('labelImportoLordoEuro')}
            <input type="number" name="importo" step="any" min={0} required style={stileCampo} />
          </label>

          <label style={stileEtichetta}>
            {t('labelTassaTrattenutaEuro')}
            <input type="number" name="tassa_trattenuta" step="any" min={0} defaultValue={0} style={stileCampo} />
            <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)', marginTop: 4, display: 'block' }}>
              {t('hintTassaSoloInteresse', { tipo: etichettaTipoMovimento('Interesse') })}
            </small>
          </label>

          <button type="submit" style={stileBottonePrimario}>
            {t('bottoneSalvaTransazione')}
          </button>
        </form>
      </Modale>
    </div>
  )
}