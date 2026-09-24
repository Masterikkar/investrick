'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { creaAsset } from './actions'
import { MenuSelect } from '@/components/menu-select'
import { CHIAVE_TRADUZIONE_CATEGORIA } from '@/lib/i18n-categorie'
import { LARGHEZZA_STANDARD, GAP_CAMPI, LARGHEZZA_RIGA_QUATTRO_CAMPI, LARGHEZZA_NOME } from './layout-campi'

type TipiPerCategoria = Record<string, string[]>

const stileCampo: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '6px 10px',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
}

const stileErroreCampo: React.CSSProperties = {
  color: 'var(--danger)',
  fontSize: 'var(--fs-form-hint)',
  margin: '4px 0 0',
}

export function FormNuovoAsset({
  tipiPerCategoria,
  aliquoteDefaultPerCategoria,
}: {
  tipiPerCategoria: TipiPerCategoria
  aliquoteDefaultPerCategoria: Record<string, number>
}) {
  const t = useTranslations('PaginaGestioneStrumenti')
  const tCategorie = useTranslations('Categorie')
  const tContenitori = useTranslations('Contenitori')
  const tPaginaImpostazioni = useTranslations('PaginaImpostazioni')
  const tPaginaRibilanciamento = useTranslations('PaginaRibilanciamento')
  const categorie = Object.keys(tipiPerCategoria)
  const [categoria, setCategoria] = useState('')
  const [tipo, setTipo] = useState('')
  const [frequenzaCedola, setFrequenzaCedola] = useState('')
  const [erroriCampo, setErroriCampo] = useState<Record<string, string>>({})

  const tipiDisponibili = categoria ? tipiPerCategoria[categoria] ?? [] : []
  const isLiquidita = categoria === 'Liquidita'
  const isObbligazioni = categoria === 'Obbligazioni'
  const isMultiasset = categoria === 'Multiasset'

  function etichettaCategoria(cat: string): string {
    if (cat === 'Liquidita') return tContenitori('liquidita')
    return tCategorie(CHIAVE_TRADUZIONE_CATEGORIA[cat] ?? cat)
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
    ...tipiDisponibili.map((ti) => ({ value: ti, label: ti })),
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

  return (
    <form
      action={creaAsset}
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
            <input type="text" name="nome" required style={stileCampo} />
          </label>
        </div>

        <div style={{ width: LARGHEZZA_STANDARD }}>
          <label style={{ fontSize: 'var(--fs-form-label)' }}>
            {t('labelTicker')}
            <input type="text" name="ticker" style={stileCampo} />
          </label>
        </div>

        <div style={{ width: LARGHEZZA_STANDARD }}>
          <label style={{ fontSize: 'var(--fs-form-label)' }}>
            {t('labelIsin')}
            <input type="text" name="isin" style={stileCampo} />
          </label>
        </div>

        <div style={{ width: LARGHEZZA_STANDARD }}>
          <label style={{ fontSize: 'var(--fs-form-label)' }}>
            {t('labelValuta')}
            <input type="text" name="valuta" defaultValue="EUR" required style={stileCampo} />
          </label>
        </div>

        {!isLiquidita && (
          <div style={{ width: LARGHEZZA_STANDARD }}>
            <label style={{ fontSize: 'var(--fs-form-label)' }}>
              {t('labelCodicePrezzo')}
              <input type="text" name="codice_prezzo" placeholder="es. EUNL.XETRA" style={stileCampo} />
            </label>
          </div>
        )}

        {isLiquidita && (
          <>
            <div style={{ width: LARGHEZZA_STANDARD }}>
              <label style={{ fontSize: 'var(--fs-form-label)' }}>
                {t('labelProvider')}
                <input type="text" name="provider" style={stileCampo} />
              </label>
            </div>
            <div style={{ width: LARGHEZZA_STANDARD }}>
              <label style={{ fontSize: 'var(--fs-form-label)' }}>
                {t('labelTassoPercentuale')}
                <input type="number" name="tasso_percentuale" step="any" style={stileCampo} />
              </label>
            </div>
          </>
        )}
      </div>

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
              <input type="date" name="data_scadenza" style={stileCampo} />
            </label>
          </div>

          <div style={{ width: LARGHEZZA_STANDARD }}>
            <label style={{ fontSize: 'var(--fs-form-label)' }}>
              {t('labelCedolaPercentuale')}
              <input type="number" name="cedola_percentuale" min="0" step="any" style={stileCampo} />
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
        <p
          style={{
            width: '100%',
            maxWidth: LARGHEZZA_RIGA_QUATTRO_CAMPI,
            color: 'var(--warning)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--warning)',
            padding: '8px 10px',
            margin: 0,
            fontSize: 'var(--fs-form-hint)',
            boxSizing: 'border-box',
          }}
        >
          {t('notaMultiasset', {
            percentuale: aliquoteDefaultPerCategoria.Multiasset ?? 26,
            pagina: tPaginaImpostazioni('tabFiscalita'),
          })}
        </p>
      )}

      <div style={{ width: '100%', maxWidth: LARGHEZZA_RIGA_QUATTRO_CAMPI }}>
        <label style={{ fontSize: 'var(--fs-form-label)' }}>
          {t('labelNote')}
          <textarea name="note" rows={3} style={stileCampo} />
        </label>
      </div>

      <button
        type="submit"
        style={{
          background: 'var(--primary)',
          color: '#fff',
          border: 'none',
          padding: '8px 16px',
          fontSize: 'var(--fs-button)',
          fontWeight: 500,
          cursor: 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        {t('bottoneCreaAsset')}
      </button>
    </form>
  )
}