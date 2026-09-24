'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { aggiornaAsset, creaAsset } from './actions'
import { MenuSelect } from '@/components/menu-select'
import { RippleLink } from '@/components/ripple-link'
import { traduciCategoria } from '@/lib/i18n-categorie'
import { CHIAVE_TRADUZIONE_TIPO_LIQUIDITA } from '@/lib/i18n-tipi-liquidita'
import { LARGHEZZA_STANDARD, GAP_CAMPI, LARGHEZZA_RIGA_QUATTRO_CAMPI, LARGHEZZA_NOME } from './layout-campi'

type TipiPerCategoria = Record<string, string[]>

// Valori correnti di uno strumento da modificare.
export type StrumentoModificabile = {
  id: string
  categoria: string
  tipo: string
  nome: string
  ticker: string | null
  isin: string | null
  valuta: string
  codice_prezzo: string | null
  provider: string | null
  tasso_percentuale: number | null
  data_scadenza: string | null
  cedola_percentuale: number | null
  frequenza_cedola: string | null
  note: string | null
}

type ErroreModifica = { errore: 'campi' | 'generico' } | { errore: 'duplicato'; duplicatoId: string; duplicatoNome: string }

const stileCampo: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '6px 10px',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
}

const stileAvviso: React.CSSProperties = {
  width: '100%',
  color: 'var(--warning)',
  background: 'var(--bg-surface)',
  border: '1px solid var(--warning)',
  padding: '8px 10px',
  margin: 0,
  fontSize: 'var(--fs-form-hint)',
  boxSizing: 'border-box',
}

const stileBottone: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 'var(--fs-button)',
  fontWeight: 500,
  cursor: 'pointer',
}

const stileBottonePrimario: React.CSSProperties = {
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
}

const stileErroreCampo: React.CSSProperties = {
  color: 'var(--danger)',
  fontSize: 'var(--fs-form-hint)',
  margin: '4px 0 0',
}

// Form asset in due modalità. Senza strumento crea un asset nuovo (azione
// creaAsset, che poi reindirizza al dettaglio). Con strumento lo modifica:
// campi precompilati coi valori correnti, azione aggiornaAsset, nessun
// redirect — onSalvato chiude il modale e aggiorna la pagina.
export function FormAsset({
  tipiPerCategoria,
  aliquoteDefaultPerCategoria,
  strumento,
  haCollegamenti = false,
  onSalvato,
  onAnnulla,
}: {
  tipiPerCategoria: TipiPerCategoria
  aliquoteDefaultPerCategoria: Record<string, number>
  strumento?: StrumentoModificabile
  // Lo strumento ha transazioni o movimenti: cambiare categoria o tipo mostra un avviso.
  haCollegamenti?: boolean
  onSalvato?: () => void
  onAnnulla?: () => void
}) {
  const t = useTranslations('PaginaGestioneStrumenti')
  const tCategorie = useTranslations('Categorie')
  const tContenitori = useTranslations('Contenitori')
  const tTipiLiquidita = useTranslations('TipiLiquidita')
  const tPaginaImpostazioni = useTranslations('PaginaImpostazioni')
  const tPaginaRibilanciamento = useTranslations('PaginaRibilanciamento')
  const categorie = Object.keys(tipiPerCategoria)
  const [categoria, setCategoria] = useState(strumento?.categoria ?? '')
  const [tipo, setTipo] = useState(strumento?.tipo ?? '')
  const [frequenzaCedola, setFrequenzaCedola] = useState(strumento?.frequenza_cedola ?? '')
  const [erroriCampo, setErroriCampo] = useState<Record<string, string>>({})
  const [erroreModifica, setErroreModifica] = useState<ErroreModifica | null>(null)
  const [salvataggio, setSalvataggio] = useState(false)
  const inModifica = strumento !== undefined
  const categoriaOTipoCambiati = inModifica && (categoria !== strumento.categoria || tipo !== strumento.tipo)

  const tipiDisponibili = categoria ? tipiPerCategoria[categoria] ?? [] : []
  const isLiquidita = categoria === 'Liquidita'
  const isObbligazioni = categoria === 'Obbligazioni'
  const isMultiasset = categoria === 'Multiasset'

  function etichettaCategoria(cat: string): string {
    if (cat === 'Liquidita') return tContenitori('liquidita')
    return traduciCategoria(tCategorie, cat)
  }

  // Solo i tipi di liquidità hanno una traduzione; un tipo non mappato
  // resta com'è scritto nel database.
  function etichettaTipo(ti: string): string {
    const chiave = isLiquidita ? CHIAVE_TRADUZIONE_TIPO_LIQUIDITA[ti] : undefined
    return chiave ? tTipiLiquidita(chiave) : ti
  }

  const opzioniFrequenzaCedola = [
    { value: '', label: tPaginaRibilanciamento('optionSeleziona') },
    { value: 'Annuale', label: t('optFrequenzaAnnuale') },
    { value: 'Semestrale', label: t('optFrequenzaSemestrale') },
    { value: 'Trimestrale', label: t('optFrequenzaTrimestrale') },
    { value: 'Mensile', label: t('optFrequenzaMensile') },
    { value: 'Zero coupon', label: t('optFrequenzaZeroCoupon') },
  ]

  const opzioniCategoria = [
    { value: '', label: tPaginaRibilanciamento('optionSeleziona') },
    ...categorie.map((c) => ({ value: c, label: etichettaCategoria(c) })),
  ]
  const opzioniTipo = [
    { value: '', label: tPaginaRibilanciamento('optionSeleziona') },
    ...tipiDisponibili.map((ti) => ({ value: ti, label: etichettaTipo(ti) })),
  ]

  function handleCategoriaChange(nuovaCategoria: string) {
    setCategoria(nuovaCategoria)
    setTipo('')
    if (nuovaCategoria) setErroriCampo((prev) => ({ ...prev, categoria: '' }))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const nuoviErrori: Record<string, string> = {}
    if (!categoria) nuoviErrori.categoria = t('erroreSelezionaCategoria')
    if (!tipo) nuoviErrori.tipo = t('erroreSelezionaTipo')

    if (Object.keys(nuoviErrori).length > 0) {
      e.preventDefault()
      setErroriCampo(nuoviErrori)
      return
    }
    setErroriCampo({})
  }

  async function salvaModifica(formData: FormData) {
    if (!strumento) return
    setErroreModifica(null)
    setSalvataggio(true)
    const risultato = await aggiornaAsset(strumento.id, formData)
    setSalvataggio(false)
    if ('errore' in risultato) setErroreModifica(risultato)
    else onSalvato?.()
  }

  // Campi non controllati precompilati con defaultValue: bastano per partire
  // dai valori correnti, e un campo condizionale che ricompare (es. tornando
  // alla categoria originale) riparte dal valore dello strumento.
  const valore = (v: string | number | null | undefined) => (v == null ? undefined : String(v))

  return (
    <form
      action={inModifica ? salvaModifica : creaAsset}
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720, color: 'var(--text-primary)' }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: GAP_CAMPI }}>
        <div style={{ width: LARGHEZZA_STANDARD }}>
          <label style={{ fontSize: 'var(--fs-form-label)' }}>
            {t('labelCategoria')}
            <div style={{ marginTop: 4 }}>
              <MenuSelect name="categoria" value={categoria} onChange={handleCategoriaChange} options={opzioniCategoria} />
            </div>
          </label>
          {erroriCampo.categoria && <p style={stileErroreCampo}>{erroriCampo.categoria}</p>}
        </div>

        <div style={{ width: LARGHEZZA_STANDARD }}>
          <label style={{ fontSize: 'var(--fs-form-label)' }}>
            {t('labelTipo')}
            <div style={{ marginTop: 4 }}>
              <MenuSelect
                name="tipo"
                value={tipo}
                onChange={(v) => {
                  setTipo(v)
                  if (v) setErroriCampo((prev) => ({ ...prev, tipo: '' }))
                }}
                options={opzioniTipo}
                disabled={!categoria}
              />
            </div>
          </label>
          {erroriCampo.tipo && <p style={stileErroreCampo}>{erroriCampo.tipo}</p>}
        </div>

        <div style={{ width: '100%', maxWidth: LARGHEZZA_NOME }}>
          <label style={{ fontSize: 'var(--fs-form-label)' }}>
            {t('labelNome')}
            <input type="text" name="nome" required defaultValue={valore(strumento?.nome)} style={stileCampo} />
          </label>
        </div>

        {!isLiquidita && (
          <>
            <div style={{ width: LARGHEZZA_STANDARD }}>
              <label style={{ fontSize: 'var(--fs-form-label)' }}>
                {t('labelTicker')}
                <input type="text" name="ticker" defaultValue={valore(strumento?.ticker)} style={stileCampo} />
              </label>
            </div>

            <div style={{ width: LARGHEZZA_STANDARD }}>
              <label style={{ fontSize: 'var(--fs-form-label)' }}>
                {t('labelIsin')}
                <input type="text" name="isin" defaultValue={valore(strumento?.isin)} style={stileCampo} />
              </label>
            </div>
          </>
        )}

        <div style={{ width: LARGHEZZA_STANDARD }}>
          <label style={{ fontSize: 'var(--fs-form-label)' }}>
            {t('labelValuta')}
            <input type="text" name="valuta" defaultValue={strumento?.valuta ?? 'EUR'} required style={stileCampo} />
          </label>
        </div>

        {!isLiquidita && (
          <div style={{ width: LARGHEZZA_STANDARD }}>
            <label style={{ fontSize: 'var(--fs-form-label)' }}>
              {t('labelCodicePrezzo')}
              <input
                type="text"
                name="codice_prezzo"
                placeholder="es. EUNL.XETRA"
                defaultValue={valore(strumento?.codice_prezzo)}
                style={stileCampo}
              />
            </label>
          </div>
        )}

        {isLiquidita && (
          <>
            <div style={{ width: LARGHEZZA_STANDARD }}>
              <label style={{ fontSize: 'var(--fs-form-label)' }}>
                {t('labelProvider')}
                <input type="text" name="provider" defaultValue={valore(strumento?.provider)} style={stileCampo} />
              </label>
            </div>
            <div style={{ width: LARGHEZZA_STANDARD }}>
              <label style={{ fontSize: 'var(--fs-form-label)' }}>
                {t('labelTassoPercentuale')}
                <input
                  type="number"
                  name="tasso_percentuale"
                  step="any"
                  defaultValue={valore(strumento?.tasso_percentuale)}
                  style={stileCampo}
                />
              </label>
            </div>
          </>
        )}
      </div>

      {haCollegamenti && categoriaOTipoCambiati && (
        <p style={{ ...stileAvviso, maxWidth: LARGHEZZA_RIGA_QUATTRO_CAMPI }}>{t('avvisoCambioCategoriaTipo')}</p>
      )}

      {!isLiquidita && (
        <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)' }}>
          {t('hintCodicePrezzo')}
        </small>
      )}

      {isObbligazioni && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: GAP_CAMPI }}>
          <div style={{ width: LARGHEZZA_STANDARD }}>
            <label style={{ fontSize: 'var(--fs-form-label)' }}>
              {t('labelScadenza')}
              <input type="date" name="data_scadenza" defaultValue={valore(strumento?.data_scadenza)} style={stileCampo} />
            </label>
          </div>

          <div style={{ width: LARGHEZZA_STANDARD }}>
            <label style={{ fontSize: 'var(--fs-form-label)' }}>
              {t('labelCedolaPercentuale')}
              <input
                type="number"
                name="cedola_percentuale"
                min="0"
                step="any"
                defaultValue={valore(strumento?.cedola_percentuale)}
                style={stileCampo}
              />
            </label>
          </div>

          <div style={{ width: LARGHEZZA_STANDARD }}>
            <label style={{ fontSize: 'var(--fs-form-label)' }}>
              {t('labelFrequenzaCedola')}
              <div style={{ marginTop: 4 }}>
                <MenuSelect
                  name="frequenza_cedola"
                  value={frequenzaCedola}
                  onChange={setFrequenzaCedola}
                  options={opzioniFrequenzaCedola}
                />
              </div>
            </label>
          </div>
        </div>
      )}

      {isMultiasset && (
        <p style={{ ...stileAvviso, maxWidth: LARGHEZZA_RIGA_QUATTRO_CAMPI }}>
          {t('notaMultiasset', {
            percentuale: aliquoteDefaultPerCategoria.Multiasset ?? 26,
            pagina: tPaginaImpostazioni('tabFiscalita'),
          })}
        </p>
      )}

      <div style={{ width: '100%', maxWidth: LARGHEZZA_RIGA_QUATTRO_CAMPI }}>
        <label style={{ fontSize: 'var(--fs-form-label)' }}>
          {t('labelNote')}
          <textarea name="note" rows={3} defaultValue={valore(strumento?.note)} style={stileCampo} />
        </label>
      </div>

      {erroreModifica?.errore === 'duplicato' && (
        <p style={{ ...stileAvviso, color: 'var(--text-primary)', maxWidth: 420 }}>
          {t.rich('erroreIsinDuplicato', {
            nome: erroreModifica.duplicatoNome,
            strong: (chunks) => <strong>{chunks}</strong>,
            link: (chunks) => (
              <RippleLink href={`/asset/${erroreModifica.duplicatoId}`} className="link-interattivo">
                {chunks}
              </RippleLink>
            ),
          })}
        </p>
      )}
      {(erroreModifica?.errore === 'campi' || erroreModifica?.errore === 'generico') && (
        <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-body)', margin: 0 }}>{t('erroreGenerico')}</p>
      )}

      {inModifica ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onAnnulla}
            style={{ ...stileBottone, background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
          >
            {tPaginaRibilanciamento('bottoneAnnulla')}
          </button>
          <button type="submit" disabled={salvataggio} style={{ ...stileBottone, ...stileBottonePrimario, opacity: salvataggio ? 0.6 : 1 }}>
            {tPaginaRibilanciamento('bottoneSalva')}
          </button>
        </div>
      ) : (
        <button type="submit" style={{ ...stileBottone, ...stileBottonePrimario, alignSelf: 'flex-start' }}>
          {t('bottoneCreaAsset')}
        </button>
      )}
    </form>
  )
}